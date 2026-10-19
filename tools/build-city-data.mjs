// 生成全国城市坐标库 src/city-data.js
// 数据源：阿里 DataV 行政区划 GeoJSON（含城市中心点）
// 用法：node tools/build-city-data.mjs
import { writeFileSync } from 'node:fs';

const HEADERS = { 'User-Agent': 'star-oracle-city-builder' };
const BASE = 'https://geo.datav.aliyun.com/areas_v3/bound/';
const OUT = 'src/city-data.js';

const MUNICIPALITIES = new Set([110000, 120000, 310000, 500000]);
const SPECIAL = new Map([
  [810000, '香港'],
  [820000, '澳门'],
  [710000, '台湾']
]);
const ETHNIC = [
  '土家族', '苗族', '藏族', '羌族', '彝族', '壮族', '朝鲜族', '蒙古族', '回族',
  '哈萨克族', '柯尔克孜族', '黎族', '侗族', '傣族', '白族', '哈尼族', '景颇族',
  '傈僳族', '拉祜族', '佤族', '纳西族', '土族', '撒拉族', '布依族', '水族',
  '仡佬族', '瑶族', '畲族', '满族', '维吾尔族', '塔吉克族', '锡伯族',
  '蒙古', '哈萨克', '柯尔克孜', '维吾尔'
];

const OVERSEAS = [
  { name: '新加坡', province: '新加坡', lon: 103.85007, lat: 1.28967, tz: 8 },
  { name: '吉隆坡', province: '马来西亚', lon: 101.68653, lat: 3.13900, tz: 8 },
  { name: '曼谷', province: '泰国', lon: 100.50176, lat: 13.75633, tz: 7 },
  { name: '东京', province: '日本', lon: 139.69171, lat: 35.68950, tz: 9 },
  { name: '首尔', province: '韩国', lon: 126.97800, lat: 37.56650, tz: 9 },
  { name: '河内', province: '越南', lon: 105.84117, lat: 21.02776, tz: 7 },
  { name: '胡志明市', province: '越南', lon: 106.62970, lat: 10.82310, tz: 7 },
  { name: '马尼拉', province: '菲律宾', lon: 120.98220, lat: 14.59950, tz: 8 },
  { name: '雅加达', province: '印度尼西亚', lon: 106.84560, lat: -6.20880, tz: 7 },
  { name: '巴厘岛', province: '印度尼西亚', lon: 115.18890, lat: -8.67050, tz: 8 },
  { name: '金边', province: '柬埔寨', lon: 104.91670, lat: 11.55000, tz: 7 }
];

function shortName(full) {
  if (!full) return full;
  let name = full;
  name = name.replace(/林区$/, '');
  name = name.replace(/(市|地区|盟)$/, '');
  for (const word of ETHNIC) {
    name = name.split(word).join('');
  }
  if (name.endsWith('自治州')) name = name.slice(0, -3);
  return name.trim() || full;
}

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.json();
}

function collect(features, provinceName) {
  const out = [];
  for (const f of features || []) {
    const p = f.properties || {};
    if (!p.name || !p.center || p.center.length < 2) continue;
    if (p.name.indexOf('直辖县级') !== -1) continue;
    if (p.level !== 'city') continue;
    out.push({
      name: shortName(p.name),
      full: p.name,
      province: provinceName.replace(/(省|市|自治区|特别行政区|维吾尔|壮族|回族|自治区)/g, '') || provinceName,
      lon: Math.round(p.center[0] * 10000) / 10000,
      lat: Math.round(p.center[1] * 10000) / 10000,
      tz: 8
    });
  }
  return out;
}

const provinces = await getJson(BASE + '100000_full.json');
const provinceFeatures = provinces.features || [];
console.log('省级要素：' + provinceFeatures.length);

const cities = [];
for (const f of provinceFeatures) {
  const p = f.properties || {};
  const adcode = Number(p.adcode);
  if (adcode === 710000) {
    // 台湾省 GeoJSON 无城市文件，用省级中心点（台北）代替
    const center = p.center || [];
    if (center.length === 2) {
      cities.push({ name: '台北', full: p.name, province: '台湾', lon: center[0], lat: center[1], tz: 8 });
      console.log('台湾：使用省级中心 ' + center.join(','));
    }
    continue;
  }
  if (SPECIAL.has(adcode)) {
    const center = p.center || [];
    if (center.length === 2) {
      cities.push({ name: SPECIAL.get(adcode), full: p.name, province: SPECIAL.get(adcode), lon: center[0], lat: center[1], tz: 8 });
      console.log(SPECIAL.get(adcode) + '：' + center.join(','));
    }
    continue;
  }
  if (MUNICIPALITIES.has(adcode)) {
    const center = p.center || [];
    if (center.length === 2) {
      cities.push({
        name: shortName(p.name),
        full: p.name,
        province: shortName(p.name),
        lon: Math.round(center[0] * 10000) / 10000,
        lat: Math.round(center[1] * 10000) / 10000,
        tz: 8
      });
    }
    continue;
  }
  if (adcode % 10000 !== 0) continue;
  try {
    const json = await getJson(BASE + adcode + '_full.json');
    const list = collect(json.features, p.name);
    cities.push(...list);
    console.log(p.name + '：' + list.length + ' 个');
  } catch (err) {
    console.log(p.name + ' 获取失败：' + err.message);
  }
  await new Promise((r) => setTimeout(r, 80));
}

cities.push(...OVERSEAS);

// 去重 & 按省份排序
const seen = new Set();
const unique = [];
for (const c of cities) {
  const key = c.name + '|' + c.province;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(c);
}
unique.sort((a, b) => a.province.localeCompare(b.province, 'zh-Hans-CN') || a.name.localeCompare(b.name, 'zh-Hans-CN'));

const content = `/* ============================================================
   星屿占卜馆 · 全国城市坐标库（自动生成，请勿手改）
   数据源：阿里 DataV 行政区划 GeoJSON（城市中心点）
   生成脚本：tools/build-city-data.mjs
   时区：中国城市统一 UTC+8；海外仅收录无夏令时的亚洲城市
   ============================================================ */
window.STAR_CITIES = ${JSON.stringify(unique, null, 0).replace(/\},\{/g, '},\n{')};
`;
writeFileSync(OUT, content);
console.log(`\n生成完成：${OUT}`);
console.log(`城市总数：${unique.length}`);
const spots = ['北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '乌鲁木齐', '三亚', '延边', '恩施', '香港', '台北', '新加坡', '东京'];
for (const spot of spots) {
  const hit = unique.filter((c) => c.name === spot || c.full === spot)[0];
  console.log(spot + ' => ' + (hit ? `${hit.name}(${hit.province}) lon=${hit.lon} lat=${hit.lat} tz=${hit.tz}` : '未找到'));
}
