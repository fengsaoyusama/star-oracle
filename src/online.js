/* ============================================================
   星屿占卜馆 · 在线运势源（可配置，失败自动回退本地）
   - ShowAPI（万维易源 872-1）：需要 AppKey
   - 自定义接口：返回 ShowAPI 结构或简化 JSON 均可
   ============================================================ */
(function (root) {
  'use strict';

  var SETTINGS_KEY = 'star-oracle-source-v1';
  var CACHE_KEY = 'star-oracle-online-cache-v1';
  var SHOWAPI_URL = 'https://route.showapi.com/872-1';

  var SHOWAPI_CODES = {
    aries: 'baiyang',
    taurus: 'jinniu',
    gemini: 'shuangzi',
    cancer: 'juxie',
    leo: 'shizi',
    virgo: 'chunv',
    libra: 'tiancheng',
    scorpio: 'tianxie',
    sagittarius: 'sheshou',
    capricorn: 'mojie',
    aquarius: 'shuiping',
    pisces: 'shuangyu'
  };

  var COLOR_HEX = {
    '金色': '#f2c14e', '黄色': '#f6d55c', '橙色': '#ff9a5c', '红色': '#ff5b5b',
    '粉色': '#ff9ec7', '紫色': '#b9a7e8', '蓝色': '#7cc7ff', '青色': '#8ce5ff',
    '绿色': '#7fc99b', '白色': '#f0e9e2', '银色': '#dfe6f5', '黑色': '#4a4658',
    '灰色': '#b8bcc8', '棕色': '#a97c5b', '咖啡色': '#a97c5b', '米色': '#f3ead8',
    '玫瑰金': '#e6b6a2', '香槟色': '#f7d8b8', '深蓝色': '#4f6fff', '深紫色': '#8b6fc4'
  };

  function clampInt(v, min, max) {
    v = parseInt(v, 10);
    if (isNaN(v)) v = min;
    return Math.min(max, Math.max(min, v));
  }

  function colorHex(name) {
    if (!name) return COLOR_HEX['金色'];
    var key = String(name).replace(/\s/g, '');
    if (COLOR_HEX[key]) return COLOR_HEX[key];
    var best = null;
    for (var k in COLOR_HEX) {
      if (key.indexOf(k) !== -1 && (!best || k.length > best.length)) best = k;
    }
    return best ? COLOR_HEX[best] : COLOR_HEX['金色'];
  }

  function loadSettings() {
    var def = { provider: 'local', showapiKey: '', customUrl: '' };
    try {
      var raw = root.localStorage && root.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return def;
      var parsed = JSON.parse(raw);
      return {
        provider: parsed.provider || 'local',
        showapiKey: parsed.showapiKey || '',
        customUrl: parsed.customUrl || ''
      };
    } catch (err) {
      return def;
    }
  }

  function saveSettings(settings) {
    try {
      root.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) { /* 隐私模式忽略 */ }
  }

  function providerLabel(settings) {
    if (!settings) settings = loadSettings();
    if (settings.provider === 'showapi') return '在线 · ShowAPI';
    if (settings.provider === 'custom') return '在线 · 自定义';
    return '本地星象';
  }

  /* ---------- 字段映射 ---------- */
  function mapShowapiDay(day) {
    if (!day || typeof day !== 'object') throw new Error('接口返回里没有 day 数据');
    var summary = clampInt(day.summary_star, 3, 5);
    return {
      overall: Math.round(52 + summary * 9),
      love: clampInt(day.love_star, 1, 5),
      career: clampInt(day.work_star, 1, 5),
      money: clampInt(day.money_star, 1, 5),
      luckyColor: {
        name: day.lucky_color || '金色',
        hex: colorHex(day.lucky_color)
      },
      luckyNum: day.lucky_num != null ? day.lucky_num : '—',
      luckyTime: day.lucky_time || '—',
      luckyDir: day.lucky_direction || '—',
      luckyStar: day.grxz || '—',
      notice: day.day_notice || (day.general_txt ? String(day.general_txt).split('。')[0] + '。' : ''),
      tip: day.general_txt || ''
    };
  }

  function mapCustom(json) {
    if (!json || typeof json !== 'object') throw new Error('自定义接口返回的不是 JSON 对象');
    if (json.showapi_res_code !== undefined) {
      if (Number(json.showapi_res_code) !== 0) {
        throw new Error('接口错误：' + (json.showapi_res_error || json.showapi_res_code));
      }
      var body = json.showapi_res_body || {};
      if (body.ret_code !== undefined && String(body.ret_code) !== '0') {
        throw new Error('接口错误：' + (body.remark || body.ret_code));
      }
      var dayRaw = Array.isArray(body.day) ? body.day[0] : body.day;
      return mapShowapiDay(dayRaw);
    }

    var data = json.data || json;
    var day = Array.isArray(data.day) ? data.day[0] : (data.day || data);
    if (!day || typeof day !== 'object') throw new Error('无法识别自定义接口的数据结构');

    if (day.overall !== undefined || day.love !== undefined || day.career !== undefined) {
      return {
        overall: clampInt(day.overall, 55, 99),
        love: clampInt(day.love, 1, 5),
        career: clampInt(day.career, 1, 5),
        money: clampInt(day.money, 1, 5),
        luckyColor: {
          name: (day.luckyColor && day.luckyColor.name) || day.lucky_color || '金色',
          hex: (day.luckyColor && day.luckyColor.hex) || colorHex(day.lucky_color)
        },
        luckyNum: day.luckyNum != null ? day.luckyNum : (day.lucky_num != null ? day.lucky_num : '—'),
        luckyTime: day.luckyTime || day.lucky_time || '—',
        luckyDir: day.luckyDir || day.lucky_direction || '—',
        luckyStar: day.luckyStar || day.grxz || '—',
        notice: day.notice || '—',
        tip: day.tip || day.general_txt || ''
      };
    }

    if (day.summary_star !== undefined) return mapShowapiDay(day);
    throw new Error('无法识别自定义接口的字段');
  }

  function fetchJson(url, fetchImpl, timeoutMs) {
    var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) return Promise.reject(new Error('当前环境不支持 fetch'));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, timeoutMs || 8000);

    var opts = ctrl ? { signal: ctrl.signal } : {};
    return f(url, opts).then(
      function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      },
      function (err) {
        clearTimeout(timer);
        throw err;
      }
    );
  }

  function fetchShowapi(sign, settings, fetchImpl) {
    var key = (settings && settings.showapiKey || '').trim();
    if (!key) return Promise.reject(new Error('还没有填写 ShowAPI AppKey'));
    var code = SHOWAPI_CODES[sign.id] || sign.id;
    var url = SHOWAPI_URL + '?appKey=' + encodeURIComponent(key) + '&star=' + encodeURIComponent(code);
    return fetchJson(url, fetchImpl, 8000).then(function (json) {
      if (Number(json.showapi_res_code) !== 0) {
        throw new Error('接口错误：' + (json.showapi_res_error || json.showapi_res_code));
      }
      var body = json.showapi_res_body || {};
      if (body.ret_code !== undefined && String(body.ret_code) !== '0') {
        throw new Error('接口错误：' + (body.remark || body.ret_code));
      }
      var day = Array.isArray(body.day) ? body.day[0] : body.day;
      return mapShowapiDay(day);
    });
  }

  function fetchCustom(sign, settings, fetchImpl) {
    var url = (settings && settings.customUrl || '').trim();
    if (!url) return Promise.reject(new Error('还没有填写自定义接口地址'));
    return fetchJson(url, fetchImpl, 8000).then(mapCustom);
  }

  function fetchDaily(sign, settings, fetchImpl) {
    settings = settings || loadSettings();
    if (settings.provider === 'showapi') {
      return fetchShowapi(sign, settings, fetchImpl).then(function (partial) {
        return { ok: true, provider: 'showapi', partial: partial };
      });
    }
    if (settings.provider === 'custom') {
      return fetchCustom(sign, settings, fetchImpl).then(function (partial) {
        return { ok: true, provider: 'custom', partial: partial };
      });
    }
    return Promise.reject(new Error('当前使用的是本地星象'));
  }

  /* ---------- 当日缓存 ---------- */
  function cacheKey(dateKey) {
    return CACHE_KEY + ':' + dateKey;
  }

  function readCache(dateKey) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(cacheKey(dateKey));
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function writeCache(dateKey, provider, signId, partial) {
    try {
      var all = readCache(dateKey);
      all[provider + ':' + signId] = partial;
      root.localStorage.setItem(cacheKey(dateKey), JSON.stringify(all));
    } catch (err) { /* ignore */ }
  }

  function fetchDailyCached(sign, settings, dateKey, fetchImpl) {
    settings = settings || loadSettings();
    if (settings.provider === 'local') {
      return Promise.reject(new Error('当前使用的是本地星象'));
    }
    var cached = readCache(dateKey)[settings.provider + ':' + sign.id];
    if (cached) {
      return Promise.resolve({ ok: true, provider: settings.provider, partial: cached, cached: true });
    }
    return fetchDaily(sign, settings, fetchImpl).then(function (res) {
      writeCache(dateKey, res.provider, sign.id, res.partial);
      return res;
    });
  }

  var api = {
    SETTINGS_KEY: SETTINGS_KEY,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    providerLabel: providerLabel,
    fetchDaily: fetchDaily,
    fetchDailyCached: fetchDailyCached,
    colorHex: colorHex,
    _mapShowapiDay: mapShowapiDay,
    _mapCustom: mapCustom
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StarOnline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
