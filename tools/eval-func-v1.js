(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);
  const text = (sel) => (q(sel) ? q(sel).textContent.trim() : null);
  const checks = [];
  const check = (name, ok, extra) => checks.push({ name, ok: !!ok, extra: extra === undefined ? null : extra });

  /* ---------- 星图 / 运势 ---------- */
  check('初始天秤座', text('#centerName') === '天秤座', text('#centerName'));
  check('轮盘 12 节点', document.querySelectorAll('.sign-node').length === 12);
  check('唯一激活节点', document.querySelectorAll('.sign-node.is-active').length === 1);
  check('综合指数存在', /^\d+$/.test(text('.score-num') || ''), text('.score-num'));
  check('数据源徽标默认本地', (text('.source-badge') || '').indexOf('本地') !== -1, text('.source-badge'));

  const caseList = [
    ['2000-01-19', '摩羯座'], ['2000-01-20', '水瓶座'],
    ['2000-03-20', '双鱼座'], ['2000-03-21', '白羊座'],
    ['2000-10-23', '天秤座'], ['2000-10-24', '天蝎座'],
    ['2000-12-21', '射手座'], ['2000-12-22', '摩羯座']
  ];
  let boundaryOk = true;
  for (const [date, expected] of caseList) {
    q('#birthday').value = date;
    q('#birthForm').requestSubmit();
    await sleep(110);
    if (text('#centerName') !== expected) boundaryOk = false;
  }
  check('8 个星座交界日', boundaryOk);

  /* ---------- 生日联动配对 / 星盘 ---------- */
  q('#birthday').value = '1998-08-19';
  q('#birthForm').requestSubmit();
  await sleep(500);
  check('生日→狮子座', text('#centerName') === '狮子座', text('#centerName'));
  check('配对同步「你」', q('#matchYou').value === 'leo', q('#matchYou').value);
  check('星盘生日同步', q('#chartDate').value === '1998-08-19', q('#chartDate').value);
  check('星盘太阳同步狮子', text('.chart-card .cc-title b') === '狮子座', text('.chart-card .cc-title b'));

  /* ---------- 配对 ---------- */
  q('#matchTa').value = 'aquarius';
  q('#matchTa').dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(250);
  const names1 = [...document.querySelectorAll('.ms-name')].map((n) => n.textContent);
  check('配对双方显示', names1[0] === '狮子座' && names1[1] === '水瓶座', names1.join('/'));
  const score1 = text('#matchRing .score-num');
  check('配对分数存在', /^\d+$/.test(score1 || ''), score1);
  q('#matchSwap').click();
  await sleep(250);
  const names2 = [...document.querySelectorAll('.ms-name')].map((n) => n.textContent);
  check('交换位置', names2[0] === '水瓶座' && names2[1] === '狮子座', names2.join('/'));
  const before = text('#matchRing .score-num');
  q('#matchYou').dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(120);
  check('配对结果稳定', before === text('#matchRing .score-num'), before + '/' + text('#matchRing .score-num'));
  check('配对四维', document.querySelectorAll('.match-dim').length === 4);

  /* ---------- 星盘 ---------- */
  q('#chartDate').value = '2000-01-01';
  q('#chartTime').value = '12:00';
  q('#chartCity').value = '0';
  q('#chartCity').dispatchEvent(new Event('change', { bubbles: true }));
  q('#chartForm').requestSubmit();
  await sleep(350);
  const titles = [...document.querySelectorAll('.cc-title b')].map((b) => b.textContent);
  check('2000-01-01 太阳摩羯', titles[0] === '摩羯座', titles.join('/'));
  check('星盘 SVG 存在', !!q('#chartVisual svg'));
  check('星盘三张卡', document.querySelectorAll('.chart-card').length === 3);
  check('元素分布四格', document.querySelectorAll('.eb-item').length === 4);
  check('星盘 meta 正确', (text('.chart-meta') || '').indexOf('2000.01.01 12:00') === 0, text('.chart-meta'));

  q('#chartCity').value = '-1';
  q('#chartCity').dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(120);
  check('手动经纬度展开', !q('#chartManual').hidden);
  q('#chartCity').value = '0';
  q('#chartCity').dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(120);
  check('手动经纬度收起', q('#chartManual').hidden);

  /* ---------- 海报 ---------- */
  q('#posterBtn').click();
  await sleep(900);
  check('今日海报打开', !q('#posterModal').hidden);
  const canvas = q('#posterCanvas');
  check('海报尺寸 1080×1440', canvas.width === 1080 && canvas.height === 1440, canvas.width + 'x' + canvas.height);
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let nonBlank = 0;
  for (let i = 3; i < data.length; i += 4000) if (data[i] > 10) nonBlank++;
  check('海报非空白', nonBlank > 500, nonBlank);
  q('[data-close="poster"]').click();
  await sleep(200);
  check('海报关闭', q('#posterModal').hidden);

  q('[data-match-action="poster"]').click();
  await sleep(500);
  check('配对海报打开', !q('#posterModal').hidden && (text('#posterTitle') || '').indexOf('配对') !== -1, text('#posterTitle'));
  q('[data-close="poster"]').click();
  await sleep(150);

  /* ---------- 数据源 / 提醒 ---------- */
  q('.source-badge').click();
  await sleep(300);
  check('数据源弹窗打开', !q('#sourceModal').hidden);
  check('默认选中本地', q('input[name="sourceProvider"]:checked').value === 'local');
  q('[data-close="source"]').click();
  await sleep(150);
  check('数据源弹窗关闭', q('#sourceModal').hidden);

  const ics = window.StarReminder.buildIcs('21:00', '');
  check('日历文件含每日重复', ics.indexOf('FREQ=DAILY') !== -1 && ics.indexOf('BEGIN:VALARM') !== -1);
  check('日历文件含时间', /DTSTART:\d{8}T210000/.test(ics));
  check('提醒状态有文案', (text('#remindStatus') || '').length > 0, text('#remindStatus'));

  /* ---------- 复制 ---------- */
  q('[data-action="copy"]').click();
  await sleep(500);
  check('复制有反馈', (text('#toast') || '').indexOf('复制') !== -1, text('#toast'));

  /* ---------- 底栏（桌面应隐藏） ---------- */
  check('桌面隐藏手机底栏', getComputedStyle(q('#tabbar')).display === 'none');

  const failed = checks.filter((c) => !c.ok);
  return { passed: checks.length - failed.length, total: checks.length, failed };
})()
