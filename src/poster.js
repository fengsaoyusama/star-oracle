/* ============================================================
   星屿占卜馆 · 分享海报（Canvas）
   - 今日星语海报 1080 × 1440
   - 配对结果海报 1080 × 1440
   - 星盘 SVG 导出 PNG
   ============================================================ */
(function (root) {
  'use strict';

  var W = 1080;
  var H = 1440;
  var GOLD = '#f2cf8d';
  var INK = '#f6f2ff';
  var MUTED = '#a9a2c7';
  var FAINT = '#6f6a8f';
  var SANS = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif';
  var SERIF = '"Songti SC", "SimSun", "Noto Serif SC", "STSong", serif';
  var ELEMENT_COLORS = { fire: '#ff8a5b', earth: '#7fc99b', air: '#7cc7ff', water: '#b9a7e8' };
  var SIGN_NAMES = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];

  function rngFrom(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    var a = h >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function setFont(ctx, weight, size, family) {
    ctx.font = weight + ' ' + size + 'px ' + family;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function text(ctx, str, x, y, opts) {
    opts = opts || {};
    ctx.save();
    ctx.fillStyle = opts.color || INK;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.letterSpacing) {
      try { ctx.letterSpacing = opts.letterSpacing; } catch (err) { /* ignore */ }
    }
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    setFont(ctx, opts.weight || '400', opts.size || 24, opts.family || SANS);
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function wrapLines(ctx, str, maxWidth) {
    var lines = [];
    var current = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === '\n') { lines.push(current); current = ''; continue; }
      var test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /* 海报引言：按字数均分成 1–2 行，避免出现只有一个引号的尴尬行 */
  function balancedQuote(str, maxChars) {
    var chars = Array.from(str || '');
    if (!chars.length) return [];
    if (chars.length <= maxChars) return ['“' + str + '”'];
    var lineCount = Math.ceil(chars.length / maxChars);
    var per = Math.ceil(chars.length / lineCount);
    var lines = [];
    for (var i = 0; i < chars.length; i += per) {
      lines.push(chars.slice(i, i + per).join(''));
    }
    lines[0] = '“' + lines[0];
    lines[lines.length - 1] = lines[lines.length - 1] + '”';
    return lines.slice(0, 3);
  }

  function drawBackground(ctx, seed) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#080617');
    g.addColorStop(0.45, '#0e0b22');
    g.addColorStop(1, '#0a0819');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var glow1 = ctx.createRadialGradient(820, 140, 20, 820, 140, 620);
    glow1.addColorStop(0, 'rgba(124,86,255,0.26)');
    glow1.addColorStop(1, 'rgba(124,86,255,0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

    var glow2 = ctx.createRadialGradient(160, 1180, 20, 160, 1180, 560);
    glow2.addColorStop(0, 'rgba(255,138,190,0.14)');
    glow2.addColorStop(1, 'rgba(255,138,190,0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    var glow3 = ctx.createRadialGradient(540, 620, 40, 540, 620, 480);
    glow3.addColorStop(0, 'rgba(242,207,141,0.09)');
    glow3.addColorStop(1, 'rgba(242,207,141,0)');
    ctx.fillStyle = glow3;
    ctx.fillRect(0, 0, W, H);

    var rng = rngFrom(seed || 'star-isle');
    for (var i = 0; i < 150; i++) {
      var x = rng() * W;
      var y = rng() * H;
      var r = rng() * 1.7 + 0.4;
      var alpha = rng() * 0.5 + 0.08;
      ctx.fillStyle = rng() < 0.2 ? 'rgba(242,207,141,' + alpha.toFixed(3) + ')' : 'rgba(226,232,255,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (var s = 0; s < 7; s++) {
      drawSparkle(ctx, rng() * W, rng() * H, rng() * 8 + 5, rng() * 0.4 + 0.16);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(540, 620, 430, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(540, 620, 486, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawSparkle(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.strokeStyle = 'rgba(242,207,141,' + alpha.toFixed(3) + ')';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
    ctx.stroke();
    ctx.restore();
  }

  function drawHairline(ctx, y) {
    var g = ctx.createLinearGradient(90, y, 990, y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(90, y, 900, 1);
  }

  function drawBrand(ctx, dateLabel) {
    text(ctx, '✦ 星屿占卜馆', 90, 92, { color: GOLD, size: 30, family: SERIF, letterSpacing: '4px' });
    text(ctx, dateLabel || '', 990, 94, { color: MUTED, size: 22, align: 'right', letterSpacing: '2px' });
    drawHairline(ctx, 132);
  }

  function drawStars5(ctx, cx, cy, count, size) {
    for (var i = 0; i < 5; i++) {
      text(ctx, '★', cx + (i - 2) * (size + 8), cy, {
        color: i < count ? GOLD : 'rgba(255,255,255,0.16)',
        size: size,
        align: 'center'
      });
    }
  }

  function drawScoreRing(ctx, cx, cy, r, score, opts) {
    opts = opts || {};
    ctx.save();
    ctx.lineWidth = opts.lineWidth || 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    var start = -Math.PI / 2;
    var end = start + (Math.PI * 2 * Math.max(0, Math.min(100, score))) / 100;
    var grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, '#ffe7b3');
    grad.addColorStop(0.55, '#f2cf8d');
    grad.addColorStop(1, '#e6b6a2');
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.stroke();
    ctx.restore();

    text(ctx, String(score), cx, cy - 4, {
      color: '#ffe9bd',
      size: opts.numSize || 64,
      family: SERIF,
      align: 'center'
    });
    if (opts.label) {
      text(ctx, opts.label, cx, cy + (opts.labelOffset || 46), {
        color: MUTED, size: 20, align: 'center', letterSpacing: '2px'
      });
    }
  }

  function drawFooter(ctx, siteUrl) {
    drawHairline(ctx, 1340);
    var label = siteUrl
      ? '在浏览器打开 ' + siteUrl
      : '保存这张图 · 在浏览器搜索「星屿占卜馆」';
    text(ctx, label, 540, 1372, { color: MUTED, size: 19, align: 'center', letterSpacing: '1px' });
    text(ctx, '占卜内容由本地算法生成 · 仅供娱乐', 540, 1400, { color: FAINT, size: 15, align: 'center' });
  }

  /* ---------------- 今日星语海报 ---------------- */
  function renderDaily(canvas, opts) {
    var sign = opts.sign;
    var f = opts.fortune || {};
    var oracle = opts.oracle || null;
    var dateLabel = opts.dateLabel || '';
    var siteUrl = opts.siteUrl || '';

    if (canvas) { canvas.width = W; canvas.height = H; }
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, 'daily|' + (sign ? sign.id : '') + '|' + dateLabel);
    drawBrand(ctx, dateLabel);

    /* 星座头部 */
    var glow = ctx.createRadialGradient(540, 300, 10, 540, 300, 210);
    glow.addColorStop(0, 'rgba(242,207,141,0.16)');
    glow.addColorStop(1, 'rgba(242,207,141,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(280, 40, 520, 520);

    ctx.save();
    ctx.beginPath();
    ctx.arc(540, 292, 88, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,207,141,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    text(ctx, (sign ? sign.symbol : '') + '\uFE0E', 540, 288, {
      color: GOLD, size: 86, align: 'center',
      family: '"Segoe UI Symbol", "Arial Unicode MS", serif'
    });

    text(ctx, sign ? sign.name : '', 540, 424, {
      color: INK, size: 72, family: SERIF, align: 'center', letterSpacing: '6px'
    });
    text(ctx, (sign ? sign.range : '') + ' · ' + (sign ? sign.en : ''), 540, 480, {
      color: MUTED, size: 22, align: 'center', letterSpacing: '3px'
    });

    drawHairline(ctx, 522);
    drawScoreRing(ctx, 540, 632, 92, f.overall || 0, {
      numSize: 64, label: '综合指数 · ' + (f.moodLabel || ''), labelOffset: 124
    });

    /* 三星运 */
    var rows = [
      { label: '爱情', value: f.love || 0 },
      { label: '事业', value: f.career || 0 },
      { label: '财运', value: f.money || 0 }
    ];
    rows.forEach(function (row, i) {
      var cx = 270 + i * 270;
      text(ctx, row.label, cx, 806, { color: MUTED, size: 20, align: 'center', letterSpacing: '4px' });
      drawStars5(ctx, cx, 846, row.value, 22);
      text(ctx, row.value + '/5', cx, 878, { color: FAINT, size: 16, align: 'center' });
    });

    drawHairline(ctx, 916);

    /* 今日星语 */
    text(ctx, '今 日 星 语', 540, 962, { color: GOLD, size: 20, align: 'center', letterSpacing: '4px' });
    var quoteLines = balancedQuote(f.notice || '', 19);
    quoteLines.forEach(function (line, i) {
      text(ctx, line, 540, 1022 + i * 58, { color: '#f2e8cf', size: 36, family: SERIF, align: 'center' });
    });

    /* 幸运三件套 */
    var luckyY = 1170;
    drawHairline(ctx, 1118);
    if (f.luckyColor) {
      ctx.fillStyle = f.luckyColor.hex || GOLD;
      ctx.beginPath();
      ctx.arc(256, luckyY + 6, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    text(ctx, '幸运色', 300, luckyY - 22, { color: MUTED, size: 18, letterSpacing: '3px' });
    text(ctx, f.luckyColor ? f.luckyColor.name : '—', 300, luckyY + 12, { color: INK, size: 28 });

    text(ctx, '幸运数字', 540, luckyY - 22, { color: MUTED, size: 18, align: 'center', letterSpacing: '3px' });
    text(ctx, String(f.luckyNum == null ? '—' : f.luckyNum), 540, luckyY + 12, { color: INK, size: 28, align: 'center' });

    text(ctx, '吉时', 810, luckyY - 22, { color: MUTED, size: 18, align: 'center', letterSpacing: '3px' });
    text(ctx, f.luckyTime || '—', 810, luckyY + 12, { color: INK, size: 26, align: 'center' });

    /* 今日星签 */
    if (oracle && oracle.text) {
      roundRect(ctx, 90, 1216, 900, 104, 26);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(242,207,141,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, '今日星签 · ' + (oracle.tag || ''), 122, 1246, {
        color: GOLD, size: 18, letterSpacing: '3px'
      });
      setFont(ctx, '400', 23, SANS);
      var oracleLines = wrapLines(ctx, oracle.text, 800).slice(0, 2);
      oracleLines.forEach(function (line, i) {
        text(ctx, line, 122, 1282 + i * 32, { color: '#e6e0f5', size: 23 });
      });
    }

    drawFooter(ctx, siteUrl);
    return canvas;
  }

  /* ---------------- 配对结果海报 ---------------- */
  function renderMatch(canvas, opts) {
    var a = opts.a;
    var b = opts.b;
    var result = opts.result || {};
    var dateLabel = opts.dateLabel || '';
    var siteUrl = opts.siteUrl || '';

    if (canvas) { canvas.width = W; canvas.height = H; }
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, 'match|' + (a ? a.id : '') + '|' + (b ? b.id : ''));
    drawBrand(ctx, dateLabel);

    function personCard(sign, cx, label) {
      text(ctx, label, cx, 226, { color: MUTED, size: 20, align: 'center', letterSpacing: '6px' });
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, 340, 84, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(242,207,141,0.32)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      text(ctx, (sign ? sign.symbol : '') + '\uFE0E', cx, 336, {
        color: GOLD, size: 80, align: 'center', family: '"Segoe UI Symbol", "Arial Unicode MS", serif'
      });
      text(ctx, sign ? sign.name : '', cx, 472, { color: INK, size: 42, family: SERIF, align: 'center', letterSpacing: '4px' });
      text(ctx, sign ? sign.range : '', cx, 514, { color: FAINT, size: 18, align: 'center', letterSpacing: '2px' });
    }

    personCard(a, 300, '你');
    personCard(b, 780, 'TA');
    text(ctx, '✦', 540, 340, { color: GOLD, size: 46, align: 'center', alpha: 0.85 });
    drawHairline(ctx, 566);

    drawScoreRing(ctx, 540, 688, 102, result.overall || 0, {
      numSize: 70, label: '匹配指数', labelOffset: 136
    });
    text(ctx, result.tierLabel || '', 540, 852, {
      color: GOLD, size: 34, family: SERIF, align: 'center', letterSpacing: '4px'
    });

    /* 标签 */
    var tags = result.tags || [];
    var tagTexts = tags.join('   ·   ');
    if (tagTexts) {
      setFont(ctx, '400', 19, SANS);
      var tw = ctx.measureText(tagTexts).width + 56;
      roundRect(ctx, 540 - tw / 2, 890, tw, 42, 21);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.stroke();
      text(ctx, tagTexts, 540, 912, { color: MUTED, size: 19, align: 'center', letterSpacing: '2px' });
    }

    /* 一句话点评 */
    setFont(ctx, '400', 26, SANS);
    var reviewLines = wrapLines(ctx, result.review || '', 860).slice(0, 3);
    reviewLines.forEach(function (line, i) {
      text(ctx, line, 540, 960 + i * 42, { color: '#d9d3ee', size: 26, align: 'center' });
    });

    /* 四个维度条 */
    var dims = result.dimensions || [];
    dims.forEach(function (dim, i) {
      var y = 1090 + i * 48;
      text(ctx, dim.label, 90, y, { color: MUTED, size: 21 });
      roundRect(ctx, 260, y - 5, 660, 10, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      var grad = ctx.createLinearGradient(260, 0, 920, 0);
      grad.addColorStop(0, 'rgba(242,207,141,0.5)');
      grad.addColorStop(1, '#f2cf8d');
      roundRect(ctx, 260, y - 5, 660 * Math.max(0, Math.min(100, dim.value)) / 100, 10, 5);
      ctx.fillStyle = grad;
      ctx.fill();
      text(ctx, String(dim.value), 960, y, { color: GOLD, size: 22, align: 'right' });
    });

    /* 相处小建议 */
    if (result.suggestions && result.suggestions.length) {
      text(ctx, '相处小建议', 540, 1270, { color: GOLD, size: 18, align: 'center', letterSpacing: '4px' });
      text(ctx, result.suggestions.slice(0, 1)[0] || '', 540, 1304, {
        color: MUTED, size: 21, align: 'center'
      });
    }

    drawFooter(ctx, siteUrl);
    return canvas;
  }

  /* ---------------- 导出 ---------------- */
  function downloadCanvas(canvas, filename) {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'star-isle-poster.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
    }, 'image/png');
  }

  function downloadSvg(svgMarkup, filename) {
    var size = 840;
    var img = new Image();
    var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      var bg = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size / 1.4);
      bg.addColorStop(0, '#121029');
      bg.addColorStop(1, '#080617');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      downloadCanvas(canvas, filename || 'star-isle-chart.png');
    };
    img.src = url;
  }

  var api = {
    W: W,
    H: H,
    renderDaily: renderDaily,
    renderMatch: renderMatch,
    downloadCanvas: downloadCanvas,
    downloadSvg: downloadSvg,
    _wrapLines: wrapLines
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StarPoster = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
