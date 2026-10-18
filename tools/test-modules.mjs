import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Online = require('../src/online.js');
const Reminder = require('../src/reminder.js');
const Poster = require('../src/poster.js');

let failed = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined ? '' : '  ::  ' + extra));
  if (!ok) failed++;
}

console.log('--- 在线源字段映射 ---');
const sampleDay = {
  summary_star: 4, love_star: 3, money_star: 4, work_star: 5,
  grxz: '狮子座', lucky_num: '54', lucky_time: '06:00-08:00',
  lucky_direction: '东南方', lucky_color: '金色',
  day_notice: '保持耐心，稳步前行。',
  general_txt: '今日整体运势呈现上升态势，你的自信与热情感染了周围的人。'
};
const mapped = Online._mapShowapiDay(sampleDay);
check('综合指数 4 星 → 88', mapped.overall === 88, mapped.overall);
check('爱情/事业/财运', mapped.love === 3 && mapped.career === 5 && mapped.money === 4, `${mapped.love}/${mapped.career}/${mapped.money}`);
check('幸运色映射 hex', mapped.luckyColor.name === '金色' && mapped.luckyColor.hex === '#f2c14e', JSON.stringify(mapped.luckyColor));
check('幸运数字/吉时/方位/贵人', mapped.luckyNum === '54' && mapped.luckyTime === '06:00-08:00' && mapped.luckyDir === '东南方' && mapped.luckyStar === '狮子座');
check('神谕取 day_notice', mapped.notice === '保持耐心，稳步前行。', mapped.notice);
check('tip 取 general_txt', mapped.tip.indexOf('上升态势') !== -1);

const sign = { id: 'leo', name: '狮子座', symbol: '♌' };

console.log('--- 在线源适配器 ---');
const mockShowapi = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({
    showapi_res_code: 0,
    showapi_res_body: { ret_code: 0, star: 'shizi', day: sampleDay }
  })
});
Online.fetchDaily(sign, { provider: 'showapi', showapiKey: 'test-key' }, mockShowapi).then((res) => {
  check('ShowAPI 适配器 fetch 成功', res.ok && res.provider === 'showapi', JSON.stringify(res.partial.luckyColor));
}).catch((e) => check('ShowAPI 适配器 fetch 成功', false, e.message));

const mockCustom = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({
    data: { overall: 91, love: 4, career: 5, money: 3, luckyColor: { name: '雾紫', hex: '#b9a7e8' }, luckyNum: 7, luckyTime: '21:00-23:00', luckyDir: '正北', luckyStar: '水瓶座', notice: '今天适合放慢脚步。', tip: '测试 tip' }
  })
});
Online.fetchDaily(sign, { provider: 'custom', customUrl: 'https://example.test/api' }, mockCustom).then((res) => {
  check('自定义接口适配器', res.ok && res.partial.overall === 91 && res.partial.luckyColor.hex === '#b9a7e8', JSON.stringify(res.partial).slice(0, 80));
}).catch((e) => check('自定义接口适配器', false, e.message));

const mockFail = () => Promise.reject(new Error('网络炸了'));
Online.fetchDaily(sign, { provider: 'showapi', showapiKey: 'k' }, mockFail).then(() => {
  check('网络失败会抛错（供 UI 回退）', false, 'unexpected success');
}).catch((e) => check('网络失败会抛错（供 UI 回退）', e.message === '网络炸了', e.message));

Online.fetchDaily(sign, { provider: 'showapi', showapiKey: '' }, mockShowapi).then(() => {
  check('缺 AppKey 直接拒绝', false);
}).catch((e) => check('缺 AppKey 直接拒绝', e.message.indexOf('AppKey') !== -1, e.message));

check('颜色名模糊匹配', Online.colorHex('香槟色系') === '#f7d8b8' && Online.colorHex('不存在色') === '#f2c14e');
check('本地模式拒绝在线请求', Online.loadSettings().provider === 'local');

console.log('--- 提醒 / 日历 ---');
const ics = Reminder.buildIcs('21:05', 'https://example.com/star');
check('ICS 含日历头', ics.indexOf('BEGIN:VCALENDAR') === 0);
check('ICS 含每日重复', ics.indexOf('FREQ=DAILY') !== -1);
check('ICS 含提醒时间 21:05', /DTSTART:\d{8}T210500/.test(ics), (ics.match(/DTSTART:.*/) || [''])[0]);
check('ICS 含闹钟', ics.indexOf('BEGIN:VALARM') !== -1);
check('ICS 含网址', ics.indexOf('https://example.com/star') !== -1);

console.log('--- 海报文本换行 ---');
const fakeCtx = { measureText: (s) => ({ width: [...s].length * 10 }) };
const lines = Poster._wrapLines(fakeCtx, '把你的星星装进你的口袋', 100);
check('CJK 换行按宽度切分', lines.length > 1 && lines.every((l) => [...l].length <= 10), JSON.stringify(lines));

await new Promise((r) => setTimeout(r, 120));
console.log(failed === 0 ? '\nALL MODULE TESTS PASSED' : '\n' + failed + ' MODULE TESTS FAILED');
process.exit(failed === 0 ? 0 : 1);
