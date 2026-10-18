(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);
  const text = (sel) => (q(sel) ? q(sel).textContent.trim() : null);
  const checks = [];
  const check = (name, ok, extra) => checks.push({ name, ok: !!ok, extra: extra === undefined ? null : extra });

  /* 数据源弹窗的配置显隐 */
  q('.source-badge').click();
  await sleep(250);
  q('input[name="sourceProvider"][value="showapi"]').click();
  await sleep(120);
  check('ShowAPI 配置显示', !q('#showapiConfig').hidden && q('#customConfig').hidden);
  q('input[name="sourceProvider"][value="custom"]').click();
  await sleep(120);
  check('自定义配置显示', !q('#customConfig').hidden && q('#showapiConfig').hidden);
  q('input[name="sourceProvider"][value="local"]').click();
  q('[data-close="source"]').click();
  await sleep(180);

  /* 提醒 */
  const before = text('#remindStatus');
  q('#remindBtn').click();
  await sleep(1400);
  const after = text('#remindStatus');
  const toast1 = text('#toast');
  check('提醒按钮有反馈', before !== after || (toast1 || '').length > 0, (before || '') + ' => ' + (after || '') + ' | ' + (toast1 || ''));
  q('#icsBtn').click();
  await sleep(500);
  check('日历下载按钮可用', (text('#toast') || '').indexOf('日历') !== -1, text('#toast'));
  if (text('#remindBtn') === '关闭提醒') {
    q('#remindBtn').click();
    await sleep(400);
  }
  check('提醒未开启（默认）', text('#remindBtn') === '开启提醒', text('#remindBtn'));

  /* 分享按钮 */
  q('#shareBtn').click();
  await sleep(500);
  check('分享按钮有反馈', (text('#toast') || '').length > 0, text('#toast'));

  check('星盘保存按钮存在', !!q('[data-chart-action="download"]'));
  check('桌面隐藏手机底栏', getComputedStyle(q('#tabbar')).display === 'none');

  const failed = checks.filter((c) => !c.ok);
  return { passed: checks.length - failed.length, total: checks.length, failed };
})()
