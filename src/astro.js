/* ============================================================
   星屿占卜馆 · 简易星盘计算
   - 太阳黄经：Meeus 低精度公式（误差 < 0.01°）
   - 月亮黄经：Meeus 第 47 章截断周期项（误差约 0.1° 以内）
   - 上升星座：RAMC + 黄赤交角 + 地理纬度的标准球面公式
   - 仅用于娱乐向「简易星盘」，不作专业排盘
   ============================================================ */
(function (root) {
  'use strict';

  var RAD = Math.PI / 180;
  var DEG = 180 / Math.PI;
  var OBLIQUITY = 23.4392911;
  var BASE_JD = 2451545.0;

  /* 中文城市经纬度（时间统一按东八区估算） */
  var CITIES = [
    { name: '北京', lon: 116.41, lat: 39.90 },
    { name: '上海', lon: 121.47, lat: 31.23 },
    { name: '广州', lon: 113.26, lat: 23.13 },
    { name: '深圳', lon: 114.06, lat: 22.54 },
    { name: '杭州', lon: 120.16, lat: 30.27 },
    { name: '成都', lon: 104.07, lat: 30.57 },
    { name: '重庆', lon: 106.55, lat: 29.56 },
    { name: '武汉', lon: 114.30, lat: 30.59 },
    { name: '西安', lon: 108.94, lat: 34.34 },
    { name: '南京', lon: 118.80, lat: 32.06 },
    { name: '天津', lon: 117.20, lat: 39.13 },
    { name: '长沙', lon: 112.94, lat: 28.23 },
    { name: '郑州', lon: 113.63, lat: 34.75 },
    { name: '沈阳', lon: 123.43, lat: 41.81 },
    { name: '哈尔滨', lon: 126.53, lat: 45.80 },
    { name: '昆明', lon: 102.71, lat: 25.04 },
    { name: '乌鲁木齐', lon: 87.62, lat: 43.83 },
    { name: '香港', lon: 114.17, lat: 22.32 },
    { name: '台北', lon: 121.57, lat: 25.03 },
    { name: '澳门', lon: 113.54, lat: 22.20 },
    { name: '新加坡', lon: 103.82, lat: 1.35 }
  ];

  function norm360(x) {
    x = x % 360;
    return x < 0 ? x + 360 : x;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  /* 由 UTC 年/月/日/小时（小数）得到儒略日 */
  function julianDay(y, m, d, hourUTC) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + hourUTC / 24;
  }

  /* 格林尼治平恒星时（度） */
  function gmstDeg(jd) {
    var T = (jd - BASE_JD) / 36525;
    var gmst = 280.46061837
      + 360.98564736629 * (jd - BASE_JD)
      + 0.000387933 * T * T
      - T * T * T / 38710000;
    return norm360(gmst);
  }

  /* 太阳视黄经（度） */
  function sunLongitude(jd) {
    var T = (jd - BASE_JD) / 36525;
    var L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    var M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    var Mr = M * RAD;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
      + 0.000289 * Math.sin(3 * Mr);
    return norm360(L0 + C);
  }

  /* 月亮真黄经（度），Meeus 截断级数 */
  var MOON_TERMS = [
    [6288774, 0, 0, 1, 0],
    [1274027, 2, 0, -1, 0],
    [658314, 2, 0, 0, 0],
    [213618, 0, 0, 2, 0],
    [-185116, 0, 1, 0, 0],
    [-114332, 0, 0, 0, 2],
    [58793, 2, 0, -2, 0],
    [57066, 2, -1, -1, 0],
    [53322, 2, 0, 1, 0],
    [45758, 2, -1, 0, 0],
    [-40923, 0, 1, -1, 0],
    [-34720, 1, 0, 0, 0],
    [-30383, 0, 1, 1, 0],
    [15327, 2, 0, 0, -2],
    [-12528, 0, 0, 1, 2],
    [10980, 0, 0, 1, -2],
    [10675, 4, 0, -1, 0],
    [10034, 0, 0, 3, 0],
    [8548, 4, 0, -2, 0],
    [-7888, 2, 1, -1, 0],
    [-6766, 2, 1, 0, 0],
    [-5163, 1, 0, -1, 0],
    [4987, 1, 1, 0, 0],
    [4036, 2, -1, 1, 0],
    [3994, 2, 0, 2, 0],
    [3861, 4, 0, 0, 0],
    [3665, 2, 0, -3, 0],
    [-2689, 0, 1, -2, 0],
    [-2602, 2, 0, -1, 2],
    [2390, 2, -1, -2, 0],
    [-2348, 1, 0, 1, 0],
    [2236, 2, -2, 0, 0],
    [-2120, 0, 1, 2, 0],
    [-2069, 0, 2, 0, 0],
    [2048, 2, -2, -1, 0],
    [-1773, 2, 0, 1, -2],
    [-1595, 2, 0, 0, 2],
    [1215, 4, -1, -1, 0],
    [-1110, 0, 0, 2, 2],
    [-892, 3, 0, -1, 0],
    [-810, 2, 1, 1, 0],
    [759, 4, -1, -2, 0],
    [-713, 0, 2, -1, 0],
    [-700, 2, 2, -1, 0],
    [691, 2, 1, -2, 0],
    [596, 2, -1, 0, -2],
    [549, 4, 0, 1, 0],
    [537, 0, 0, 4, 0],
    [520, 4, -1, 0, 0],
    [-487, 1, 0, -2, 0],
    [-399, 2, 1, 0, -2],
    [-381, 0, 0, 2, -2],
    [351, 1, 1, 1, 0],
    [-340, 3, 0, -2, 0],
    [330, 4, 0, -3, 0],
    [327, 2, -1, 2, 0],
    [-323, 0, 2, 1, 0],
    [299, 1, 1, -1, 0],
    [294, 2, 0, 3, 0]
  ];

  function moonLongitude(jd) {
    var T = (jd - BASE_JD) / 36525;
    var T2 = T * T;
    var T3 = T2 * T;
    var T4 = T3 * T;
    var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
    var D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
    var M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
    var Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
    var F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;

    var sum = 0;
    for (var i = 0; i < MOON_TERMS.length; i++) {
      var t = MOON_TERMS[i];
      var arg = t[1] * D + t[2] * M + t[3] * Mp + t[4] * F;
      sum += t[0] * Math.sin(arg * RAD);
    }
    return norm360(Lp + sum / 1000000);
  }

  /* 上升星座黄经：θ = 当地恒星时（RAMC） */
  function ascendant(lstDeg, latDeg) {
    var theta = lstDeg * RAD;
    var phi = latDeg * RAD;
    var eps = OBLIQUITY * RAD;
    var y = Math.cos(theta);
    var x = -(Math.sin(theta) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps));
    return norm360(Math.atan2(y, x) * DEG);
  }

  /* 黄道点 → 赤经赤纬（用于校验） */
  function eclipticToEquatorial(lonDeg) {
    var l = lonDeg * RAD;
    var e = OBLIQUITY * RAD;
    var ra = Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) * DEG;
    var dec = Math.asin(Math.sin(l) * Math.sin(e)) * DEG;
    return { ra: norm360(ra), dec: dec };
  }

  function splitLongitude(lon) {
    var index = Math.floor(norm360(lon) / 30) % 12;
    return { lon: norm360(lon), index: index, deg: norm360(lon) % 30 };
  }

  /* 简易星盘：输入本地时间（默认东八区）、经度、纬度 */
  function computeChart(opts) {
    var tz = opts.tzOffset == null ? 8 : opts.tzOffset;
    var hour = opts.hour == null ? 12 : opts.hour;
    var minute = opts.minute == null ? 0 : opts.minute;

    var utc = new Date(Date.UTC(opts.y, opts.m - 1, opts.d, hour - tz, minute, 0));
    var jd = julianDay(
      utc.getUTCFullYear(),
      utc.getUTCMonth() + 1,
      utc.getUTCDate(),
      utc.getUTCHours() + utc.getUTCMinutes() / 60
    );

    var sunLon = sunLongitude(jd);
    var moonLon = moonLongitude(jd);
    var lst = norm360(gmstDeg(jd) + opts.lon);
    var ascLon = ascendant(lst, opts.lat);

    return {
      jd: jd,
      lst: lst,
      sunLon: sunLon,
      moonLon: moonLon,
      ascLon: ascLon,
      sun: splitLongitude(sunLon),
      moon: splitLongitude(moonLon),
      asc: splitLongitude(ascLon),
      input: {
        y: opts.y, m: opts.m, d: opts.d, hour: hour, minute: minute,
        lon: opts.lon, lat: opts.lat, tzOffset: tz
      }
    };
  }

  /* ---------------- 星盘 SVG ---------------- */
  var ELEMENT_ORDER = ['fire', 'earth', 'air', 'water'];
  var ELEMENT_FILL = {
    fire: 'rgba(255, 138, 91, 0.08)',
    earth: 'rgba(127, 201, 155, 0.08)',
    air: 'rgba(124, 199, 255, 0.08)',
    water: 'rgba(185, 167, 232, 0.1)'
  };
  var GLYPH_FONT = "'Segoe UI Symbol', 'Arial Unicode MS', serif";

  function polar(cx, cy, r, deg) {
    var rad = deg * RAD;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  /* 屏幕上：上升点固定在左侧，黄经逆时针（屏幕上自上而下）推进 */
  function screenAngle(lon, ascLon) {
    return 180 - (lon - ascLon);
  }

  function sectorPath(cx, cy, r1, r2, a1, a2) {
    var p1 = polar(cx, cy, r2, a1);
    var p2 = polar(cx, cy, r2, a2);
    var p3 = polar(cx, cy, r1, a2);
    var p4 = polar(cx, cy, r1, a1);
    var large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return 'M' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) +
      ' A' + r2 + ' ' + r2 + ' 0 ' + large + ' 1 ' + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2) +
      ' L' + p3.x.toFixed(2) + ' ' + p3.y.toFixed(2) +
      ' A' + r1 + ' ' + r1 + ' 0 ' + large + ' 0 ' + p4.x.toFixed(2) + ' ' + p4.y.toFixed(2) + ' Z';
  }

  function svgText(x, y, text, size, fill, extra) {
    return '<text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" font-size="' + size +
      '" fill="' + fill + '" text-anchor="middle" dominant-baseline="central"' +
      (extra || '') + '>' + text + '</text>';
  }

  function renderChart(chart, signs) {
    var cx = 210;
    var cy = 210;
    var rOuter = 190;
    var rSign = 156;
    var rInner = 118;
    var parts = [];

    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" width="420" height="420" role="img" aria-label="简易星盘">');
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + rOuter + '" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>');
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + rSign + '" fill="none" stroke="rgba(242,207,141,0.2)" stroke-width="1"/>');
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + rInner + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>');

    for (var i = 0; i < 12; i++) {
      var startLon = i * 30;
      var endLon = startLon + 30;
      var a1 = screenAngle(startLon, chart.ascLon);
      var a2 = screenAngle(endLon, chart.ascLon);
      var element = ELEMENT_ORDER[i % 4];
      parts.push('<path d="' + sectorPath(cx, cy, rSign, rOuter, a1, a2) + '" fill="' + ELEMENT_FILL[element] + '"/>');
      var mid = screenAngle(startLon + 15, chart.ascLon);
      var gp = polar(cx, cy, (rSign + rOuter) / 2, mid);
      parts.push(svgText(gp.x, gp.y, (signs[i] ? signs[i].symbol : '') + '\uFE0E', 20, 'rgba(242,207,141,0.9)',
        ' style="font-family:' + GLYPH_FONT.replace(/'/g, "&apos;") + ';font-variant-emoji:text"'));
      var bp = polar(cx, cy, rSign, a1);
      parts.push('<line x1="' + bp.x.toFixed(2) + '" y1="' + bp.y.toFixed(2) + '" x2="' +
        polar(cx, cy, rOuter, a1).x.toFixed(2) + '" y2="' + polar(cx, cy, rOuter, a1).y.toFixed(2) +
        '" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>');
      parts.push('<line x1="' + bp.x.toFixed(2) + '" y1="' + bp.y.toFixed(2) + '" x2="' +
        polar(cx, cy, rInner, a1).x.toFixed(2) + '" y2="' + polar(cx, cy, rInner, a1).y.toFixed(2) +
        '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>');
    }

    /* 上升点标记（固定在左侧） */
    var ascA = screenAngle(chart.ascLon, chart.ascLon);
    var pAsc1 = polar(cx, cy, rInner, ascA);
    var pAsc2 = polar(cx, cy, rOuter + 8, ascA);
    parts.push('<line x1="' + pAsc1.x.toFixed(2) + '" y1="' + pAsc1.y.toFixed(2) + '" x2="' + pAsc2.x.toFixed(2) + '" y2="' + pAsc2.y.toFixed(2) + '" stroke="rgba(242,207,141,0.7)" stroke-width="2" stroke-linecap="round"/>');
    parts.push(svgText(pAsc2.x + 16, pAsc2.y - 10, 'ASC', 9, 'rgba(242,207,141,0.85)'));

    /* 太阳 / 月亮 */
    var points = [
      { lon: chart.sunLon, r: 98, color: '#f2cf8d', label: '日', textColor: '#f2cf8d' },
      { lon: chart.moonLon, r: 76, color: '#bcd4ff', label: '月', textColor: '#bcd4ff' }
    ];

    points.forEach(function (pt) {
      var angle = screenAngle(pt.lon, chart.ascLon);
      var pos = polar(cx, cy, pt.r, angle);
      parts.push('<circle cx="' + pos.x.toFixed(2) + '" cy="' + pos.y.toFixed(2) + '" r="5" fill="' + pt.color + '"/>');
      parts.push('<circle cx="' + pos.x.toFixed(2) + '" cy="' + pos.y.toFixed(2) + '" r="9" fill="none" stroke="' + pt.color + '" stroke-opacity="0.35" stroke-width="1"/>');
      var lp = polar(cx, cy, pt.r + 17, angle);
      parts.push(svgText(lp.x, lp.y, pt.label, 10, pt.textColor));
    });

    /* 中心：上升星座 */
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="60" fill="rgba(255,255,255,0.035)" stroke="rgba(242,207,141,0.28)" stroke-width="1"/>');
    parts.push(svgText(cx, cy - 36, '上升星座', 9, 'rgba(169,162,199,0.9)', ' letter-spacing="2"'));
    parts.push(svgText(cx, cy - 8, (signs[chart.asc.index] ? signs[chart.asc.index].symbol : '') + '\uFE0E', 28, '#f2cf8d',
      ' style="font-family:' + GLYPH_FONT.replace(/'/g, "&apos;") + ';font-variant-emoji:text"'));
    parts.push(svgText(cx, cy + 24, signs[chart.asc.index] ? signs[chart.asc.index].name : '', 13, '#f6f2ff'));
    parts.push(svgText(cx, cy + 42, chart.asc.deg.toFixed(1) + '°', 9, 'rgba(169,162,199,0.85)'));

    parts.push('</svg>');
    return parts.join('');
  }

  var api = {
    CITIES: CITIES,
    julianDay: julianDay,
    gmstDeg: gmstDeg,
    sunLongitude: sunLongitude,
    moonLongitude: moonLongitude,
    ascendant: ascendant,
    eclipticToEquatorial: eclipticToEquatorial,
    computeChart: computeChart,
    renderChart: renderChart
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StarAstro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
