/* ============================================================
   星屿占卜馆 v1.0 · 交互逻辑
   - 生日 → 星座换算
   - 「星座 + 日期」种子随机 → 每日运势（本地 / 在线源可切换）
   - 星座轮盘、双人配对、简易星盘、今日星签
   - 分享海报、每日提醒、日历文件
   ============================================================ */
(function () {
  'use strict';

  var DATA = window.STAR_DATA;
  var SIGNS = DATA.signs;
  var LUCKY = DATA.lucky;
  var ELEMENTS = DATA.elements;
  var ORACLE = DATA.oracle;
  var PROFILES = DATA.profiles || {};
  var PAIRING = DATA.pairing;
  var Astro = window.StarAstro;
  var Online = window.StarOnline;
  var Poster = window.StarPoster;
  var Reminder = window.StarReminder;
  var CONFIG = window.STAR_ORACLE_CONFIG || {};

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  function signById(id) {
    for (var i = 0; i < SIGNS.length; i++) if (SIGNS[i].id === id) return SIGNS[i];
    return null;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  var state = {
    signId: null,
    mode: 'today', // today | birthday | manual
    birthLabel: '',
    fortune: null,
    oracle: null,
    oracleSalt: 0,
    drawn: [],
    flipped: false,
    onlineStatus: 'local', // local | loading | online | failed
    onlineToken: 0,
    onlineRetryAt: 0,
    match: null,
    chart: null,
    chartLabel: '',
    chartReady: false,
    posterMode: 'daily'
  };

  var MOOD = { high: '顺风局', mid: '平稳局', low: '充电局' };

  /* ============================================================
     日期
     ============================================================ */
  function pad2(n) { return String(n).padStart(2, '0'); }

  function getToday() {
    var d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }

  function dateKey(t) {
    var d = t || getToday();
    return d.y + '-' + pad2(d.m) + '-' + pad2(d.d);
  }

  function dateText(t) {
    var d = t || getToday();
    return d.m + '.' + d.d;
  }

  function fullDateText(t) {
    var d = t || getToday();
    return d.y + '.' + pad2(d.m) + '.' + pad2(d.d);
  }

  function getSignByMd(m, d) {
    var md = m * 100 + d;
    for (var i = 0; i < SIGNS.length; i++) {
      var s = SIGNS[i];
      var wrap = s.start > s.end;
      if (wrap ? (md >= s.start || md <= s.end) : (md >= s.start && md <= s.end)) return s;
    }
    return null;
  }

  function parseBirthday(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;
    var y = +match[1], m = +match[2], d = +match[3];
    var check = new Date(y, m - 1, d);
    if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
    return { y: y, m: m, d: d };
  }

  /* ============================================================
     种子随机（同一天 / 同一星座 → 结果不变）
     ============================================================ */
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFor() {
    var parts = Array.prototype.slice.call(arguments);
    return mulberry32(hashStr(parts.join('|')));
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length) % arr.length];
  }

  function pickN(rng, arr, n) {
    var pool = arr.slice();
    var out = [];
    while (pool.length && out.length < n) {
      out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return out;
  }

  /* ============================================================
     每日运势（本地）
     ============================================================ */
  function buildFortune(sign) {
    var key = dateKey();
    var rng = rngFor('fortune', sign.id, key);
    var overall = 62 + Math.floor(rng() * 37); // 62 – 98
    var tier = overall >= 85 ? 'high' : overall >= 72 ? 'mid' : 'low';
    var star = function () { return 2 + Math.floor(rng() * 4); }; // 2 – 5

    var others = SIGNS.filter(function (s) { return s.id !== sign.id; });

    return {
      overall: overall,
      tier: tier,
      moodLabel: MOOD[tier],
      love: star(),
      career: star(),
      money: star(),
      luckyColor: pick(rng, LUCKY.colors[sign.element]),
      luckyNum: 1 + Math.floor(rng() * 9),
      luckyTime: pick(rng, LUCKY.times),
      luckyDir: pick(rng, LUCKY.directions),
      luckyStar: pick(rng, others).name,
      notice: pick(rng, LUCKY.notices[tier]),
      tip: pick(rng, ELEMENTS[sign.element].tips),
      dos: pickN(rng, LUCKY.dos, 2),
      donts: pickN(rng, LUCKY.donts, 2),
      online: false
    };
  }

  /* ============================================================
     在线数据源
     ============================================================ */
  function getSourceSettings() {
    if (!Online) return { provider: 'local', showapiKey: '', customUrl: '' };
    return Online.loadSettings();
  }

  function badgeInfo() {
    var settings = getSourceSettings();
    if (state.onlineStatus === 'loading') return { text: '在线获取中…', cls: 'is-loading' };
    if (state.onlineStatus === 'online') {
      return { text: Online ? Online.providerLabel(settings) : '在线星象', cls: 'is-online' };
    }
    if (state.onlineStatus === 'failed') return { text: '在线失败 · 本地', cls: 'is-failed' };
    return { text: '本地星象', cls: '' };
  }

  function applyOnlinePartial(sign, partial) {
    var base = buildFortune(sign);
    var merged = Object.assign({}, base);
    ['overall', 'love', 'career', 'money', 'luckyColor', 'luckyNum', 'luckyTime', 'luckyDir', 'luckyStar', 'notice', 'tip'].forEach(function (k) {
      if (partial[k] !== undefined && partial[k] !== null && partial[k] !== '') merged[k] = partial[k];
    });
    merged.overall = clamp(parseInt(merged.overall, 10) || base.overall, 55, 99);
    merged.tier = merged.overall >= 85 ? 'high' : merged.overall >= 72 ? 'mid' : 'low';
    merged.moodLabel = MOOD[merged.tier];
    merged.online = true;
    state.fortune = merged;
    state.onlineStatus = 'online';
    state.onlineRetryAt = 0;
    renderReading();
  }

  function refreshOnlineFortune(signId) {
    var settings = getSourceSettings();
    if (!Online || settings.provider === 'local') {
      state.onlineStatus = 'local';
      return;
    }
    var sign = signById(signId);
    if (!sign) return;
    if (state.onlineRetryAt && Date.now() < state.onlineRetryAt) {
      state.onlineStatus = 'failed';
      renderReading();
      return;
    }
    var token = ++state.onlineToken;
    state.onlineStatus = 'loading';
    renderReading();

    Online.fetchDailyCached(sign, settings, dateKey()).then(function (res) {
      if (token !== state.onlineToken || state.signId !== signId) return;
      applyOnlinePartial(sign, res.partial);
    }).catch(function (err) {
      if (token !== state.onlineToken || state.signId !== signId) return;
      state.onlineStatus = 'failed';
      state.onlineRetryAt = Date.now() + 60000;
      state.onlineError = err && err.message ? err.message : '';
      renderReading();
      showToast('在线源没连上，已自动回退本地星象');
    });
  }

  /* ============================================================
     渲染：星座轮盘
     ============================================================ */
  function buildWheel() {
    var wheel = $('#wheel');
    if (!wheel) return;

    SIGNS.forEach(function (sign, i) {
      var angle = (-90 + i * 30) * Math.PI / 180;
      var x = 50 + 41.5 * Math.cos(angle);
      var y = 50 + 41.5 * Math.sin(angle);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sign-node';
      btn.dataset.id = sign.id;
      btn.style.left = x.toFixed(3) + '%';
      btn.style.top = y.toFixed(3) + '%';
      btn.setAttribute('aria-label', sign.name + ' ' + sign.range);
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML =
        '<span class="node-glyph">' + sign.symbol + '\uFE0E</span>' +
        '<span class="node-name">' + sign.short + '</span>';

      btn.addEventListener('click', function () {
        selectSign(sign.id, 'manual');
        if (window.innerWidth < 980) {
          var reading = $('#reading');
          if (reading) reading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      wheel.appendChild(btn);
    });
  }

  function updateWheel() {
    var sign = signById(state.signId);
    if (!sign) return;

    $$('.sign-node').forEach(function (node) {
      var on = node.dataset.id === state.signId;
      node.classList.toggle('is-active', on);
      node.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var center = $('.wheel-center');
    var glyph = $('#centerGlyph');
    if (glyph) glyph.textContent = sign.symbol + '\uFE0E';
    if ($('#centerName')) $('#centerName').textContent = sign.name;
    if ($('#centerSub')) {
      $('#centerSub').textContent =
        state.mode === 'birthday' ? '你的生日星座'
          : state.mode === 'manual' ? '你点亮的星星'
            : '今日太阳所在';
    }
    if (center) {
      center.classList.remove('is-swap');
      void center.offsetWidth;
      center.classList.add('is-swap');
    }
  }

  /* ============================================================
     渲染：解读卡
     ============================================================ */
  function starRow(label, n) {
    var stars = '';
    for (var i = 0; i < 5; i++) {
      stars += '<span class="star' + (i < n ? ' is-on' : '') + '">★</span>';
    }
    return '<div class="star-row">' +
      '<span class="sr-label">' + label + '</span>' +
      '<span class="sr-stars">' + stars + '</span>' +
      '<span class="sr-val">' + n + '/5</span>' +
      '</div>';
  }

  function luckyItem(label, value) {
    return '<div class="lucky-item">' +
      '<span class="li-label">' + label + '</span>' +
      '<span class="li-value">' + value + '</span>' +
      '</div>';
  }

  function renderReading() {
    var sign = signById(state.signId);
    var f = state.fortune;
    var card = $('#readCard');
    if (!sign || !f || !card) return;

    var modeLabel = state.mode === 'birthday'
      ? '你的生日星座 · ' + state.birthLabel
      : state.mode === 'manual'
        ? '你点亮的星星 · ' + dateText()
        : '今日星象 · ' + dateText();

    var bestChips = sign.best.slice(0, 2).map(function (id) {
      var s = signById(id);
      return '<span class="pair-chip"><b>' + s.symbol + '\uFE0E</b>' + s.name + '</span>';
    }).join('');

    var hard = signById(sign.hard);
    var hardChip = '<span class="pair-chip is-hard"><b>' + hard.symbol + '\uFE0E</b>' + hard.name + '</span>';

    var badge = badgeInfo();

    card.innerHTML =
      '<div class="rc-glow" aria-hidden="true"></div>' +
      '<div class="rc-glow rc-glow-b" aria-hidden="true"></div>' +
      '<div class="rc-top">' +
        '<div class="rc-glyph">' + sign.symbol + '\uFE0E</div>' +
        '<div class="rc-title">' +
          '<p class="rc-eyebrow">' + modeLabel + '</p>' +
          '<h3>' + sign.name + '<span class="rc-en">' + sign.en + '</span></h3>' +
          '<p class="rc-meta">' + sign.range + ' · ' + ELEMENTS[sign.element].label + ' · ' + sign.planet + '守护</p>' +
        '</div>' +
        '<div class="rc-score">' +
          '<div class="score-ring" id="scoreRing" style="--pct:0">' +
            '<span class="score-num">' + f.overall + '</span>' +
          '</div>' +
          '<div class="rc-score-txt">' +
            '<span class="score-label">综合指数</span>' +
            '<span class="score-mood">' + (f.moodLabel || MOOD[f.tier] || '平稳局') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<p class="rc-trait">' + sign.trait + '</p>' +
      '<ul class="rc-tags">' + sign.keywords.map(function (k) { return '<li>' + k + '</li>'; }).join('') + '</ul>' +
      '<div class="rc-divider"></div>' +
      '<div class="rc-fortune">' +
        '<div class="fortune-head">' +
          '<h4>今日运势</h4>' +
          '<div class="fortune-meta">' +
            '<button type="button" class="source-badge ' + badge.cls + '" data-action="source" title="切换数据源">' + badge.text + '</button>' +
            '<span class="fortune-date">' + fullDateText() + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="star-rows">' +
          starRow('爱情', f.love) +
          starRow('事业', f.career) +
          starRow('财运', f.money) +
        '</div>' +
        '<div class="lucky-grid">' +
          luckyItem('幸运色', '<i class="swatch" style="--sw:' + f.luckyColor.hex + '"></i>' + f.luckyColor.name) +
          luckyItem('幸运数字', f.luckyNum) +
          luckyItem('吉时', f.luckyTime) +
          luckyItem('幸运方位', f.luckyDir) +
          luckyItem('贵人星座', f.luckyStar) +
          luckyItem('幸运石', sign.stone) +
        '</div>' +
        '<div class="yiji">' +
          '<div class="yiji-item yi"><span class="yiji-tag">宜</span><span class="yiji-text">' + f.dos.join(' · ') + '</span></div>' +
          '<div class="yiji-item ji"><span class="yiji-tag">忌</span><span class="yiji-text">' + f.donts.join(' · ') + '</span></div>' +
        '</div>' +
        '<p class="rc-notice">“' + f.notice + '”</p>' +
        '<p class="rc-tip">' + f.tip + '</p>' +
      '</div>' +
      '<div class="rc-divider"></div>' +
      '<div class="rc-pair">' +
        '<div class="pair-group">' +
          '<span class="pair-label">最佳拍档</span>' +
          '<div class="pair-chips">' + bestChips + '</div>' +
        '</div>' +
        '<div class="pair-group">' +
          '<span class="pair-label">需要磨合</span>' +
          '<div class="pair-chips">' + hardChip + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="rc-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="draw">抽一支今日星签</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="poster">生成海报</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="copy">复制星语</button>' +
      '</div>';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var ring = $('#scoreRing');
        if (ring) ring.style.setProperty('--pct', String(f.overall));
      });
    });

    card.classList.remove('is-pop');
    void card.offsetWidth;
    card.classList.add('is-pop');
  }

  /* ============================================================
     选星座
     ============================================================ */
  function selectSign(id, mode, opts) {
    var sign = signById(id);
    if (!sign) return;

    state.signId = id;
    state.mode = mode;
    state.fortune = buildFortune(sign);
    state.oracle = null;
    state.oracleSalt = 0;
    state.drawn = [];
    state.flipped = false;
    state.onlineStatus = 'local';
    if (mode === 'birthday' && opts && opts.label) state.birthLabel = opts.label;

    updateWheel();
    renderReading();
    renderOracle(true);
    syncMatchYou();
    refreshOnlineFortune(id);

    // 同步星盘的生日（如果之前已经排过盘）
    if (mode === 'birthday' && opts && opts.dateValue && state.chartReady && $('#chartDate')) {
      $('#chartDate').value = opts.dateValue;
      computeChartFromForm(true);
    }
  }

  /* ============================================================
     渲染：今日星签
     ============================================================ */
  function buildOracle(signId, salt, drawn) {
    var rng = rngFor('oracle', signId, dateKey(), String(salt));
    var index = Math.floor(rng() * ORACLE.length) % ORACLE.length;

    if (drawn && drawn.length < ORACLE.length && drawn.indexOf(index) !== -1) {
      for (var step = 1; step <= ORACLE.length; step++) {
        var next = (index + step) % ORACLE.length;
        if (drawn.indexOf(next) === -1) { index = next; break; }
      }
    }

    return {
      index: index,
      text: ORACLE[index].text,
      tag: ORACLE[index].tag,
      no: 1 + Math.floor(rng() * 99)
    };
  }

  function renderOracle(reset) {
    var sign = signById(state.signId);
    if (!sign) return;

    if (!state.oracle) {
      state.oracle = buildOracle(state.signId, state.oracleSalt, state.drawn);
      state.drawn.push(state.oracle.index);
    }

    var o = state.oracle;
    var frontSub = $('#oracleFrontSub');
    if (frontSub) frontSub.textContent = '为 ' + sign.name + ' 准备';

    var slip = $('#oracleSlip');
    if (slip) {
      slip.innerHTML =
        '<div class="slip-head">' +
          '<span>星屿 · 今日星签</span>' +
          '<span class="slip-no">No. ' + pad2(o.no) + '</span>' +
        '</div>' +
        '<div class="slip-glyph">✦ ✦ ✦</div>' +
        '<span class="slip-tag">' + o.tag + '</span>' +
        '<p class="slip-text">' + o.text + '</p>' +
        '<div class="slip-foot">' +
          '<span>为' + sign.name + '抽取 · ' + dateText() + '</span>' +
          '<span class="slip-seal">星屿<br>占卜</span>' +
        '</div>';
      slip.classList.remove('is-new');
      void slip.offsetWidth;
      slip.classList.add('is-new');
    }

    if (reset) setOracleFlipped(false);
  }

  function setOracleFlipped(next) {
    var card = $('#flipCard');
    if (!card) return;
    state.flipped = next;
    card.classList.toggle('is-flipped', next);
    card.setAttribute('aria-pressed', next ? 'true' : 'false');
    card.setAttribute('aria-label', next ? '收起今日星签' : '翻开今日星签');
  }

  function drawOracle() {
    var sign = signById(state.signId);
    if (!sign) return;

    state.oracleSalt += 1;
    state.oracle = buildOracle(state.signId, state.oracleSalt, state.drawn);
    state.drawn.push(state.oracle.index);
    if (state.drawn.length > ORACLE.length) state.drawn = state.drawn.slice(-ORACLE.length);

    renderOracle(false);
    setOracleFlipped(true);
  }

  /* ============================================================
     星轨配对
     ============================================================ */
  function elementRelation(a, b) {
    if (a.element === b.element) return { key: 'same', pair: a.element };
    var pair = [a.element, b.element].sort().join('-');
    if (pair === 'air-fire' || pair === 'earth-water') return { key: 'complement', pair: pair };
    if (pair === 'earth-fire' || pair === 'air-water') return { key: 'neutral', pair: pair };
    return { key: 'challenge', pair: pair };
  }

  function buildMatch(a, b) {
    var relation = elementRelation(a, b);
    var relData = PAIRING.relations[relation.key];
    var rng = rngFor('match', [a.id, b.id].sort().join('|'));
    var jitter = function () { return Math.floor(rng() * 13) - 6; };

    var isBest = a.best.indexOf(b.id) !== -1 || b.best.indexOf(a.id) !== -1;
    var isOpposite = a.hard === b.id && b.hard === a.id;

    var base = relData.base;
    if (isBest) base += 5;
    if (isOpposite) base -= 2;

    var love = clamp(base + jitter() + (isOpposite ? 8 : 0), 30, 99);
    var tacit = clamp(base + jitter() + (relation.key === 'same' ? 5 : 0), 30, 99);
    var stay = clamp(base + jitter() + (relation.key === 'complement' ? 4 : 0) - (relation.key === 'challenge' ? 3 : 0), 30, 99);
    var talk = clamp(base + jitter(), 30, 99);
    var overall = Math.round(love * 0.3 + tacit * 0.25 + stay * 0.2 + talk * 0.25);

    var tier = PAIRING.tiers[PAIRING.tiers.length - 1];
    for (var i = 0; i < PAIRING.tiers.length; i++) {
      if (overall >= PAIRING.tiers[i].min) { tier = PAIRING.tiers[i]; break; }
    }

    var relationText = relation.key === 'same'
      ? relData.texts[a.element]
      : relData.texts[relation.pair];

    var tags = [relData.label];
    if (isOpposite) tags.push('对宫吸引');
    if (relation.key === 'same') tags.push(ELEMENTS[a.element].name + '同频');
    if (isBest) tags.push('星盘拍档');
    if (a.id === b.id) tags.push('同一个星座');

    var suggestions = PAIRING.suggestions[relation.key === 'same' ? 'same' : relation.pair] || [];
    if (isOpposite) suggestions = suggestions.concat(['对宫的吸引很迷人，但别把「互补」当成「必须改变对方」。']);

    return {
      a: a,
      b: b,
      overall: overall,
      tierLabel: tier.label,
      review: relationText + ' ' + tier.suffix,
      tags: tags,
      dimensions: [
        { label: PAIRING.dimensionLabels.love, value: love },
        { label: PAIRING.dimensionLabels.tacit, value: tacit },
        { label: PAIRING.dimensionLabels.stay, value: stay },
        { label: PAIRING.dimensionLabels.talk, value: talk }
      ],
      suggestions: suggestions.slice(0, 2)
    };
  }

  function renderMatch() {
    var you = $('#matchYou');
    var ta = $('#matchTa');
    var target = $('#matchResult');
    if (!you || !ta || !target) return;

    var a = signById(you.value);
    var b = signById(ta.value);
    if (!a || !b) return;

    var m = buildMatch(a, b);
    state.match = m;

    var dims = m.dimensions.map(function (dim) {
      return '<div class="match-dim">' +
        '<div class="match-dim-head"><span>' + dim.label + '</span><b>' + dim.value + '</b></div>' +
        '<div class="match-dim-track"><i style="--w:' + dim.value + '%"></i></div>' +
        '</div>';
    }).join('');

    target.innerHTML =
      '<div class="match-card' + (target.dataset.rendered ? ' is-pop' : '') + '">' +
        '<div class="match-top">' +
          '<div class="match-pair">' +
            '<div class="match-sign"><span class="ms-glyph">' + a.symbol + '\uFE0E</span><span class="ms-name">' + a.name + '</span></div>' +
            '<span class="match-link">✦</span>' +
            '<div class="match-sign"><span class="ms-glyph">' + b.symbol + '\uFE0E</span><span class="ms-name">' + b.name + '</span></div>' +
          '</div>' +
          '<div class="match-score">' +
            '<div class="score-ring" id="matchRing" style="--pct:0"><span class="score-num">' + m.overall + '</span></div>' +
            '<span class="score-label">匹配指数</span>' +
            '<span class="match-verdict">' + m.tierLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="match-body">' +
          '<div class="match-copy">' +
            '<p class="match-review">' + m.review + '</p>' +
            '<ul class="match-tags">' + m.tags.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
            '<div class="match-suggest">' +
              '<p class="match-suggest-title">相处小建议</p>' +
              '<ul>' + m.suggestions.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>' +
            '</div>' +
            '<div class="match-actions">' +
              '<button type="button" class="btn btn-sm btn-ghost" data-match-action="swap">⇄ 交换位置</button>' +
              '<button type="button" class="btn btn-sm btn-primary" data-match-action="poster">生成配对海报</button>' +
            '</div>' +
          '</div>' +
          '<div class="match-dims">' + dims + '</div>' +
        '</div>' +
      '</div>';

    target.dataset.rendered = '1';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var ring = $('#matchRing');
        if (ring) ring.style.setProperty('--pct', String(m.overall));
      });
    });
  }

  function initMatch() {
    var you = $('#matchYou');
    var ta = $('#matchTa');
    if (!you || !ta) return;

    var options = SIGNS.map(function (s) {
      return '<option value="' + s.id + '">' + s.symbol + '\uFE0E ' + s.name + '</option>';
    }).join('');
    you.innerHTML = options;
    ta.innerHTML = options;

    var start = state.signId || 'libra';
    you.value = start;
    ta.value = signById(start).best[0];

    you.addEventListener('change', renderMatch);
    ta.addEventListener('change', renderMatch);

    var swap = $('#matchSwap');
    if (swap) {
      swap.addEventListener('click', function () {
        var tmp = you.value;
        you.value = ta.value;
        ta.value = tmp;
        renderMatch();
      });
    }

    var result = $('#matchResult');
    if (result) {
      result.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-match-action]');
        if (!btn) return;
        if (btn.dataset.matchAction === 'swap') {
          var tmp = you.value;
          you.value = ta.value;
          ta.value = tmp;
          renderMatch();
        } else if (btn.dataset.matchAction === 'poster') {
          openPoster('match');
        }
      });
    }

    renderMatch();
  }

  function syncMatchYou() {
    var you = $('#matchYou');
    var ta = $('#matchTa');
    if (!you || !ta || !state.signId) return;
    you.value = state.signId;
    if (ta.value === state.signId) ta.value = signById(state.signId).best[0];
    renderMatch();
  }

  /* ============================================================
     简易星盘
     ============================================================ */
  function initChart() {
    var form = $('#chartForm');
    var citySel = $('#chartCity');
    if (!form || !citySel || !Astro) return;
    state.chartReady = true;

    citySel.innerHTML = Astro.CITIES.map(function (c, i) {
      return '<option value="' + i + '">' + c.name + '</option>';
    }).join('') + '<option value="-1">其他（手动输入经纬度）</option>';

    var dateInput = $('#chartDate');
    var today = getToday();
    if (dateInput) dateInput.value = dateKey(today);

    citySel.addEventListener('change', function () {
      var manual = citySel.value === '-1';
      var box = $('#chartManual');
      if (box) box.hidden = !manual;
      if (!manual) computeChartFromForm(true);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      computeChartFromForm(false);
    });

    var result = $('#chartInfo');
    if (result) {
      result.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-chart-action]');
        if (!btn) return;
        if (btn.dataset.chartAction === 'download') downloadChartImage();
      });
    }

    computeChartFromForm(true);
  }

  function getChartInput() {
    var dateInput = $('#chartDate');
    var bd = parseBirthday(dateInput ? dateInput.value : '');
    if (!bd) return null;

    var timeInput = $('#chartTime');
    var time = (timeInput && timeInput.value) || '12:00';
    var parts = time.split(':');
    var hour = parseInt(parts[0], 10);
    var minute = parseInt(parts[1], 10);
    if (isNaN(hour)) hour = 12;
    if (isNaN(minute)) minute = 0;
    hour = clamp(hour, 0, 23);
    minute = clamp(minute, 0, 59);

    var citySel = $('#chartCity');
    var lon, lat, cityName;
    if (citySel && citySel.value === '-1') {
      lon = parseFloat($('#chartLon') ? $('#chartLon').value : '');
      lat = parseFloat($('#chartLat') ? $('#chartLat').value : '');
      cityName = '手动经纬度';
      if (isNaN(lon) || isNaN(lat)) return null;
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    } else {
      var index = citySel ? parseInt(citySel.value, 10) : 0;
      var city = Astro.CITIES[index] || Astro.CITIES[0];
      lon = city.lon;
      lat = city.lat;
      cityName = city.name;
    }

    return {
      birth: bd,
      hour: hour,
      minute: minute,
      lon: lon,
      lat: lat,
      cityName: cityName,
      label: bd.y + '.' + pad2(bd.m) + '.' + pad2(bd.d) + ' ' + pad2(hour) + ':' + pad2(minute) + ' · ' + cityName
    };
  }

  function computeChartFromForm(silent) {
    if (!Astro) return;
    var input = getChartInput();
    if (!input) {
      if (!silent) showToast('先填一下完整的生日和出生地嘛～');
      return;
    }

    var chart = Astro.computeChart({
      y: input.birth.y,
      m: input.birth.m,
      d: input.birth.d,
      hour: input.hour,
      minute: input.minute,
      lon: input.lon,
      lat: input.lat
    });

    state.chart = chart;
    state.chartLabel = input.label;
    renderChartResult(chart, input.label);
    if (!silent) showToast('小星盘排好啦 ✦');
  }

  function renderChartResult(chart, label) {
    var visual = $('#chartVisual');
    var info = $('#chartInfo');
    if (!visual || !info) return;

    visual.innerHTML = Astro.renderChart(chart, SIGNS);

    var sunSign = SIGNS[chart.sun.index];
    var moonSign = SIGNS[chart.moon.index];
    var ascSign = SIGNS[chart.asc.index];
    var moonLine = (PROFILES[moonSign.id] && PROFILES[moonSign.id].moon) || moonSign.trait.split('。')[0] + '。';
    var risingLine = (PROFILES[ascSign.id] && PROFILES[ascSign.id].rising) || ascSign.trait.split('。')[0] + '。';
    var sunLine = sunSign.trait.split('。')[0] + '。';

    var counts = { fire: 0, earth: 0, air: 0, water: 0 };
    [sunSign, moonSign, ascSign].forEach(function (s) { counts[s.element] += 1; });
    var eb = ['fire', 'earth', 'air', 'water'].map(function (el) {
      var dots = [0, 1, 2].map(function (i) {
        return '<i class="' + (i < counts[el] ? 'on' : '') + '"></i>';
      }).join('');
      return '<div class="eb-item" style="--c:' + ELEMENTS[el].color + '">' +
        '<div class="eb-head"><span>' + ELEMENTS[el].name + '</span><b>' + counts[el] + '</b></div>' +
        '<div class="eb-dots">' + dots + '</div>' +
        '</div>';
    }).join('');

    info.innerHTML =
      '<p class="chart-meta">' + label + ' · 按东八区时间估算</p>' +
      '<div class="chart-cards">' +
        chartCard('日', '太阳星座', sunSign.name, chart.sun.deg, sunLine) +
        chartCard('月', '月亮星座', moonSign.name, chart.moon.deg, moonLine) +
        chartCard('升', '上升星座', ascSign.name, chart.asc.deg, risingLine) +
      '</div>' +
      '<div class="element-balance">' +
        '<p class="eb-title">三重奏元素分布</p>' +
        '<div class="eb-bars">' + eb + '</div>' +
      '</div>' +
      '<div class="chart-actions">' +
        '<button type="button" class="btn btn-sm btn-primary" data-chart-action="download">保存星盘图</button>' +
      '</div>';
  }

  function chartCard(glyph, title, name, deg, line) {
    return '<div class="chart-card">' +
      '<span class="cc-glyph">' + glyph + '</span>' +
      '<div class="cc-body">' +
        '<p class="cc-title">' + title + '<b>' + name + '</b><em>' + deg.toFixed(1) + '°</em></p>' +
        '<p class="cc-line">' + line + '</p>' +
      '</div>' +
      '</div>';
  }

  function downloadChartImage() {
    var svg = $('#chartVisual') && $('#chartVisual').querySelector('svg');
    if (!svg || !Poster) return;
    try {
      var markup = new XMLSerializer().serializeToString(svg);
      Poster.downloadSvg(markup, '星屿占卜馆-简易星盘.png');
      showToast('星盘图已开始下载 ✦');
    } catch (err) {
      showToast('星盘图导出失败，换个浏览器试试');
    }
  }

  /* ============================================================
     分享海报 / 数据源弹窗
     ============================================================ */
  function getSiteUrl() {
    if (CONFIG && CONFIG.siteUrl) return String(CONFIG.siteUrl).replace(/\/+$/, '');
    if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      if (!/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname)) {
        return (location.origin + location.pathname).replace(/index\.html$/, '').replace(/\/+$/, '');
      }
    }
    return '';
  }

  function openPoster(mode) {
    if (!Poster) return;
    var canvas = $('#posterCanvas');
    var title = $('#posterTitle');
    if (!canvas) return;

    state.posterMode = mode;
    var siteUrl = getSiteUrl();

    if (mode === 'match') {
      var m = state.match;
      if (!m) return;
      if (title) title.textContent = '配对结果海报';
      Poster.renderMatch(canvas, {
        a: m.a,
        b: m.b,
        result: {
          overall: m.overall,
          tierLabel: m.tierLabel,
          review: m.review,
          tags: m.tags,
          dimensions: m.dimensions,
          suggestions: m.suggestions
        },
        dateLabel: fullDateText(),
        siteUrl: siteUrl
      });
    } else {
      var sign = signById(state.signId);
      var f = state.fortune;
      if (!sign || !f) return;
      if (title) title.textContent = '今日星语海报';
      Poster.renderDaily(canvas, {
        sign: sign,
        fortune: Object.assign({}, f, { moodLabel: MOOD[f.tier] }),
        oracle: state.oracle,
        dateLabel: fullDateText(),
        siteUrl: siteUrl
      });
    }
    openModal('poster');
  }

  function downloadPoster() {
    if (!Poster) return;
    var canvas = $('#posterCanvas');
    if (!canvas) return;
    var name = state.posterMode === 'match'
      ? '星屿占卜馆-配对海报-' + dateKey() + '.png'
      : '星屿占卜馆-今日星语-' + (state.signId || '') + '-' + dateKey() + '.png';
    Poster.downloadCanvas(canvas, name);
    showToast('海报已开始下载 ✦');
  }

  function openSourceModal() {
    var settings = getSourceSettings();
    $$('input[name="sourceProvider"]').forEach(function (r) {
      r.checked = r.value === settings.provider;
    });
    if ($('#showapiKey')) $('#showapiKey').value = settings.showapiKey || '';
    if ($('#customUrl')) $('#customUrl').value = settings.customUrl || '';
    toggleSourceConfig();
    openModal('source');
  }

  function toggleSourceConfig() {
    var checked = $('input[name="sourceProvider"]:checked');
    var value = checked ? checked.value : 'local';
    if ($('#showapiConfig')) $('#showapiConfig').hidden = value !== 'showapi';
    if ($('#customConfig')) $('#customConfig').hidden = value !== 'custom';
  }

  function saveSourceSettings() {
    if (!Online) return;
    var checked = $('input[name="sourceProvider"]:checked');
    var provider = checked ? checked.value : 'local';
    var key = ($('#showapiKey') && $('#showapiKey').value || '').trim();
    var url = ($('#customUrl') && $('#customUrl').value || '').trim();

    if (provider === 'showapi' && !key) {
      showToast('先填一下 ShowAPI AppKey 哦');
      return;
    }
    if (provider === 'custom' && !url) {
      showToast('自定义模式需要填接口地址');
      return;
    }

    Online.saveSettings({ provider: provider, showapiKey: key, customUrl: url });
    state.onlineRetryAt = 0;
    closeModal('source');

    if (provider === 'local') {
      state.onlineStatus = 'local';
      state.onlineToken += 1;
      state.fortune = buildFortune(signById(state.signId));
      renderReading();
      showToast('已切回本地星象');
      return;
    }

    showToast('正在测试在线源…');
    refreshOnlineFortune(state.signId);
  }

  /* ============================================================
     每日提醒 / 分享站点
     ============================================================ */
  function getReminderBody() {
    if (state.fortune && state.fortune.notice) {
      return state.fortune.notice + ' 打开星屿占卜馆，看看今天的星星。';
    }
    return '今天的星星已经写好了，去看看今日运势和星签吧。';
  }

  function updateReminderUI() {
    if (!Reminder) return;
    var s = Reminder.load();
    var timeInput = $('#remindTime');
    var btn = $('#remindBtn');
    var status = $('#remindStatus');
    var testBtn = $('#testNotifyBtn');
    if (timeInput) timeInput.value = s.time;
    if (btn) {
      btn.textContent = s.enabled ? '关闭提醒' : '开启提醒';
      btn.classList.toggle('btn-primary', !s.enabled);
      btn.classList.toggle('btn-ghost', s.enabled);
    }
    var supported = Reminder.notifySupported();
    var permission = supported && typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    if (testBtn) testBtn.hidden = !(s.enabled && supported && permission === 'granted');
    if (status) {
      if (s.enabled) {
        status.textContent = '已开启 · 每天 ' + s.time + ' · ' +
          (permission === 'granted' ? '页面开着时会提醒你' : '通知权限未授予，建议用日历提醒');
      } else {
        status.textContent = '未开启 · 浏览器通知需要页面保持打开，日历提醒更稳';
      }
    }
  }

  function toggleReminder() {
    if (!Reminder) return;
    var s = Reminder.load();
    var timeInput = $('#remindTime');
    var time = (timeInput && timeInput.value) || s.time || '21:00';

    if (s.enabled) {
      s.enabled = false;
      s.time = time;
      Reminder.save(s);
      updateReminderUI();
      showToast('已关闭每日提醒');
      return;
    }

    Reminder.requestPermission().then(function (permission) {
      var next = Reminder.load();
      if (permission === 'unsupported') {
        showToast('这个浏览器不支持通知，建议下载日历提醒');
        return;
      }
      if (permission !== 'granted') {
        showToast('通知权限没打开，可以用日历提醒代替');
        return;
      }
      next.enabled = true;
      next.time = time;
      Reminder.save(next);
      updateReminderUI();
      showToast('每天 ' + time + ' 提醒你来看星星 ✦');
    });
  }

  function downloadIcs() {
    if (!Reminder) return;
    var timeInput = $('#remindTime');
    var time = (timeInput && timeInput.value) || '21:00';
    var content = Reminder.buildIcs(time, getSiteUrl());
    Reminder.downloadText('星屿占卜馆-每日提醒.ics', content, 'text/calendar;charset=utf-8');
    showToast('日历文件已开始下载，导入手机日历即可 ✦');
  }

  function shareSite() {
    var url = getSiteUrl() || (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? location.href : '');
    var text = '星屿占卜馆 · 把今晚的星星装进你的口袋';
    if (navigator.share) {
      navigator.share({ title: '星屿占卜馆', text: text, url: url || undefined }).catch(function () { /* 用户取消 */ });
      return;
    }
    if (!url) {
      showToast('当前是本地打开，发布到线上后就能分享网址啦');
      return;
    }
    copyText(text + '\n' + url).then(function (ok) {
      showToast(ok ? '链接已复制，去分享给朋友吧 ✦' : '复制没成功，手动复制地址栏吧');
    });
  }

  function initShare() {
    var posterBtn = $('#posterBtn');
    if (posterBtn) posterBtn.addEventListener('click', function () { openPoster('daily'); });

    var shareBtn = $('#shareBtn');
    if (shareBtn) shareBtn.addEventListener('click', shareSite);

    var shareUrl = $('#shareUrl');
    if (shareUrl) {
      var site = getSiteUrl();
      shareUrl.textContent = site
        ? ('当前网址：' + site)
        : '当前是本地打开，发布到线上后这里会显示你的网址';
    }

    var remindBtn = $('#remindBtn');
    if (remindBtn) remindBtn.addEventListener('click', toggleReminder);

    var icsBtn = $('#icsBtn');
    if (icsBtn) icsBtn.addEventListener('click', downloadIcs);

    var testBtn = $('#testNotifyBtn');
    if (testBtn) {
      testBtn.addEventListener('click', function () {
        var ok = Reminder.fireNotification('星屿占卜馆 · 提醒测试', '到点啦，这只是测试通知 ✦');
        showToast(ok ? '测试通知已发出' : '通知没发出去，检查一下浏览器权限');
      });
    }

    if (Reminder) {
      Reminder.startScheduler(getReminderBody);
      updateReminderUI();
    }
  }

  /* ============================================================
     复制
     ============================================================ */
  function copyText(text) {
    return new Promise(function (resolve) {
      function fallback() {
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.top = '-1000px';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          resolve(ok);
        } catch (err) {
          resolve(false);
        }
      }

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { resolve(true); }).catch(fallback);
      } else {
        fallback();
      }
    });
  }

  function copyFortune() {
    var sign = signById(state.signId);
    var f = state.fortune;
    if (!sign || !f) return;

    var text = [
      '✦ 星屿占卜馆 · 今日星语 ✦',
      '星座：' + sign.name + '（' + sign.range + '）',
      '综合指数：' + f.overall + ' · ' + (f.moodLabel || MOOD[f.tier]),
      '爱情 ' + f.love + '/5 · 事业 ' + f.career + '/5 · 财运 ' + f.money + '/5',
      '幸运色：' + f.luckyColor.name + ' · 幸运数字：' + f.luckyNum + ' · 吉时：' + f.luckyTime,
      '今日神谕：' + f.notice,
      '—— 星屿占卜馆 v1.0 · 仅供娱乐'
    ].join('\n');

    copyText(text).then(function (ok) {
      showToast(ok ? '今日星语已复制，去分享给朋友吧 ✦' : '复制没成功，手动选中文字试试～');
    });
  }

  /* ============================================================
     弹窗
     ============================================================ */
  function openModal(name) {
    var el = $('#' + name + 'Modal');
    if (!el) return;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(name) {
    var el = $('#' + name + 'Modal');
    if (!el) return;
    el.hidden = true;
    var open = $$('.modal').some(function (m) { return !m.hidden; });
    if (!open) document.body.style.overflow = '';
  }

  function bindModals() {
    document.addEventListener('click', function (e) {
      var closer = e.target.closest('[data-close]');
      if (closer) {
        closeModal(closer.dataset.close);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeModal('poster');
        closeModal('source');
      }
    });

    var download = $('#posterDownload');
    if (download) download.addEventListener('click', downloadPoster);

    $$('input[name="sourceProvider"]').forEach(function (radio) {
      radio.addEventListener('change', toggleSourceConfig);
    });
    var sourceSave = $('#sourceSave');
    if (sourceSave) sourceSave.addEventListener('click', saveSourceSettings);
  }

  /* ============================================================
     Toast
     ============================================================ */
  var toastTimer = null;

  function showToast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-show');
    }, 2800);
  }

  /* ============================================================
     星空 canvas
     ============================================================ */
  function initSky() {
    var canvas = $('#sky');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = 0, H = 0, stars = [], shooting = [];
    var lastShoot = performance.now();
    var nextShoot = 5000;
    var raf = 0;

    function starColor(gold) {
      return gold ? '242, 207, 141' : '226, 232, 255';
    }

    function makeStars() {
      var count = Math.min(220, Math.round((W * H) / 9000));
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.25 + 0.25,
          a: Math.random() * 0.45 + 0.2,
          speed: Math.random() * 0.12 + 0.03,
          phase: Math.random() * Math.PI * 2,
          tw: Math.random() * 0.9 + 0.4,
          gold: Math.random() < 0.22
        });
      }
    }

    function drawStatic() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + starColor(s.gold) + ', ' + s.a + ')';
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function spawnShoot() {
      shooting.push({
        x: W * (0.45 + Math.random() * 0.75),
        y: H * (Math.random() * 0.4),
        vx: -240 - Math.random() * 140,
        vy: 130 + Math.random() * 70,
        life: 0,
        ttl: 900 + Math.random() * 500,
        len: 90 + Math.random() * 80
      });
    }

    function frame(t) {
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var alpha = s.a * (0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.phase));
        if (alpha > 0.02) {
          ctx.beginPath();
          ctx.fillStyle = 'rgba(' + starColor(s.gold) + ', ' + alpha.toFixed(3) + ')';
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        s.y += s.speed;
        if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
      }

      if (t - lastShoot > nextShoot) {
        spawnShoot();
        lastShoot = t;
        nextShoot = 5200 + Math.random() * 6200;
      }

      for (var j = shooting.length - 1; j >= 0; j--) {
        var sh = shooting[j];
        sh.x += sh.vx * 0.016;
        sh.y += sh.vy * 0.016;
        sh.life += 16;
        if (sh.life > sh.ttl || sh.x < -260 || sh.y > H + 120) {
          shooting.splice(j, 1);
          continue;
        }
        var speed = Math.hypot(sh.vx, sh.vy) || 1;
        var tailX = sh.x - (sh.vx / speed) * sh.len;
        var tailY = sh.y - (sh.vy / speed) * sh.len;
        var fade = 1 - sh.life / sh.ttl;
        var grad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
        grad.addColorStop(0, 'rgba(255, 255, 255, ' + (0.72 * fade).toFixed(3) + ')');
        grad.addColorStop(0.35, 'rgba(242, 207, 141, ' + (0.34 * fade).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(242, 207, 141, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeStars();
      if (reduce) drawStatic();
    }

    resize();
    window.addEventListener('resize', resize);

    if (!reduce) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
  }

  /* ============================================================
     滚动显现
     ============================================================ */
  function initReveal() {
    var targets = $$('.sec-head, .wheel-wrap, .read-card, .match-shell, .chart-shell, .oracle-stage, .share-grid, .note-grid');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ============================================================
     手机底栏 scroll-spy
     ============================================================ */
  function initTabbar() {
    var bar = $('#tabbar');
    if (!bar) return;
    var links = $$('a', bar);
    var ids = ['top', 'reading', 'match', 'chart', 'oracle', 'share'];
    var sections = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);

    var update = function () {
      var marker = window.scrollY + window.innerHeight * 0.4;
      var current = sections[0];
      sections.forEach(function (sec) {
        var top = sec.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) current = sec;
      });
      var hash = '#' + current.id;
      if (hash === '#oracle') hash = '#share';
      links.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === hash);
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {
    var form = $('#birthForm');
    var input = $('#birthday');

    if (input) {
      var today = getToday();
      input.max = dateKey(today);
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var bd = parseBirthday(input ? input.value : '');
        if (!bd) {
          showToast('先告诉我你的生日嘛～');
          if (input) input.focus();
          return;
        }
        if (dateKey(bd) > dateKey(getToday())) {
          showToast('你来自未来吗？换一个生日试试～');
          return;
        }
        var sign = getSignByMd(bd.m, bd.d);
        if (!sign) {
          showToast('这个日期好像不对哦');
          return;
        }
        selectSign(sign.id, 'birthday', {
          label: bd.m + '月' + bd.d + '日',
          dateValue: input ? input.value : ''
        });
        showToast('星星认出你了：' + sign.name + ' ' + sign.symbol + '\uFE0E');
        var reading = $('#reading');
        if (reading) reading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    var skip = $('#skipBirth');
    if (skip) {
      skip.addEventListener('click', function () {
        var reading = $('#reading');
        if (reading) reading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('点一颗你喜欢的星星试试 ✦');
      });
    }

    var card = $('#readCard');
    if (card) {
      card.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.dataset.action;
        if (action === 'copy') copyFortune();
        if (action === 'source') openSourceModal();
        if (action === 'poster') openPoster('daily');
        if (action === 'draw') {
          var oracleSection = $('#oracle');
          if (oracleSection) oracleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(function () {
            renderOracle(false);
            setOracleFlipped(true);
          }, 480);
        }
      });
    }

    var flip = $('#flipCard');
    if (flip) {
      flip.addEventListener('click', function () { setOracleFlipped(!state.flipped); });
      flip.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOracleFlipped(!state.flipped);
        }
      });
    }

    var drawBtn = $('#drawBtn');
    if (drawBtn) drawBtn.addEventListener('click', drawOracle);

    var toReading = $('#toReadingBtn');
    if (toReading) {
      toReading.addEventListener('click', function () {
        var reading = $('#reading');
        if (reading) reading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    var nav = $('#nav');
    if (nav) {
      var onScroll = function () {
        nav.classList.toggle('is-scrolled', window.scrollY > 40);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* ============================================================
     启动
     ============================================================ */
  function init() {
    buildWheel();
    initSky();
    initReveal();
    bindEvents();
    initMatch();
    initChart();
    initShare();
    bindModals();
    initTabbar();

    var today = getToday();
    var sunSign = getSignByMd(today.m, today.d);
    selectSign(sunSign ? sunSign.id : 'libra', 'today');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* 测试 / 调试入口 */
  window.StarApp = {
    state: state,
    selectSign: selectSign,
    buildMatch: buildMatch,
    computeChartFromForm: computeChartFromForm,
    openPoster: openPoster,
    openSourceModal: openSourceModal,
    refreshOnlineFortune: refreshOnlineFortune,
    getSiteUrl: getSiteUrl,
    getSourceSettings: getSourceSettings,
    saveSourceSettings: saveSourceSettings,
    renderMatch: renderMatch,
    renderReading: renderReading
  };
})();
