import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../src/astro.js');

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
let failed = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined ? '' : '  ::  ' + extra));
  if (!ok) failed++;
}
function angleDiff(a, b) {
  return (((a - b) % 360) + 540) % 360 - 180;
}
function ascCheck(y, m, d, hour, minute, lon, lat) {
  const chart = A.computeChart({ y, m, d, hour, minute, lon, lat });
  const eq = A.eclipticToEquatorial(chart.ascLon);
  const H = (((chart.lst - eq.ra) % 360) + 540) % 360 - 180;
  const alt = Math.asin(
    Math.sin(lat * RAD) * Math.sin(eq.dec * RAD) +
    Math.cos(lat * RAD) * Math.cos(eq.dec * RAD) * Math.cos(H * RAD)
  ) * DEG;
  return { chart, H, alt };
}

console.log('--- 儒略日 / 太阳 ---');
check('JD(2000-01-01 12UT) = 2451545.0', Math.abs(A.julianDay(2000, 1, 1, 12) - 2451545.0) < 1e-9, A.julianDay(2000, 1, 1, 12));
const sun2000 = A.sunLongitude(2451545.0);
check('J2000 太阳黄经 ≈ 280.5°', Math.abs(angleDiff(sun2000, 280.55)) < 0.2, sun2000.toFixed(4));
const jdEq = A.julianDay(2024, 3, 20, 3 + 6 / 60);
const sunEq = A.sunLongitude(jdEq);
check('2024 春分太阳黄经 ≈ 0°', Math.abs(angleDiff(sunEq, 0)) < 0.1, sunEq.toFixed(4));

console.log('--- 月亮（用日月相位校验）---');
const nm1 = A.julianDay(2000, 1, 6, 18 + 14 / 60);
const d1 = angleDiff(A.sunLongitude(nm1), A.moonLongitude(nm1));
check('新月 2000-01-06 18:14 UTC 日月差≈0', Math.abs(d1) < 0.3, d1.toFixed(3));
const nm2 = A.julianDay(2024, 4, 8, 18 + 21 / 60);
const d2 = angleDiff(A.sunLongitude(nm2), A.moonLongitude(nm2));
check('新月 2024-04-08 18:21 UTC 日月差≈0', Math.abs(d2) < 0.3, d2.toFixed(3));
const fm = A.julianDay(2024, 4, 23, 23 + 49 / 60);
const fmDiff = Math.abs(Math.abs(angleDiff(A.sunLongitude(fm), A.moonLongitude(fm))) - 180);
check('满月 2024-04-23 23:49 UTC 日月差≈180°', fmDiff < 0.3, fmDiff.toFixed(3));

console.log('--- 上升点自检（高度角应为 0，且在东方升起）---');
const cases = [
  [1998, 8, 19, 12, 0, 116.41, 39.90, '北京'],
  [2001, 3, 21, 6, 30, 121.47, 31.23, '上海'],
  [1988, 12, 22, 23, 45, 104.07, 30.57, '成都'],
  [2010, 7, 23, 18, 15, 87.62, 43.83, '乌鲁木齐'],
  [1970, 1, 1, 0, 5, 114.17, 22.32, '香港'],
  [2005, 11, 22, 9, 0, 103.82, 1.35, '新加坡']
];
for (const [y, m, d, hh, mm, lon, lat, label] of cases) {
  const { chart, H, alt } = ascCheck(y, m, d, hh, mm, lon, lat);
  check(label + ' ASC 高度角≈0°', Math.abs(alt) < 0.06, alt.toFixed(4) + '°, H=' + H.toFixed(1) + '°');
  check(label + ' ASC 在东方升起', H < 0 || Math.abs(H) < 0.01, 'H=' + H.toFixed(1) + '°');
  console.log('       → 太阳 ' + ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'][chart.sun.index] +
    ' / 月亮 ' + ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'][chart.moon.index] +
    ' / 上升 ' + ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'][chart.asc.index] +
    '（' + chart.asc.deg.toFixed(1) + '°）');
}

const chart = A.computeChart({ y: 1998, m: 8, d: 19, hour: 12, minute: 0, lon: 116.41, lat: 39.90 });
check('1998-08-19 太阳在狮子座', chart.sun.index === 4, chart.sun.index + ' / ' + chart.sun.deg.toFixed(2) + '°');

const signs = Array.from({ length: 12 }, (_, i) => ({ symbol: ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'][i], name: '星座' + i }));
const svg = A.renderChart(chart, signs);
check('星盘 SVG 已生成', svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length > 3000, svg.length + ' chars');
check('星盘 SVG 含上升/日月标记', svg.includes('上升星座') && svg.includes('>日<') && svg.includes('>月<') && svg.includes('ASC'));

console.log(failed === 0 ? '\nALL ASTRO TESTS PASSED' : '\n' + failed + ' ASTRO TESTS FAILED');
process.exit(failed === 0 ? 0 : 1);
