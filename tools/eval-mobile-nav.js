(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);
  const checks = [];
  const check = (name, ok, extra) => checks.push({ name, ok: !!ok, extra: extra === undefined ? null : extra });
  const bar = q('#tabbar');

  check('手机底栏显示', getComputedStyle(bar).display === 'flex');
  check('底栏 5 个入口', bar.querySelectorAll('a').length === 5);
  const r = bar.getBoundingClientRect();
  check('底栏宽度合理', r.width > 260 && r.width < 390, Math.round(r.width));
  check('底栏文字单行', getComputedStyle(bar.querySelector('a')).whiteSpace === 'nowrap');

  bar.querySelector('a[href="#chart"]').click();
  await sleep(1600);
  const chartTop = q('#chart').getBoundingClientRect().top;
  check('点底栏跳到星盘', Math.abs(chartTop) < 220, Math.round(chartTop));
  check('底栏高亮星盘', bar.querySelector('a[href="#chart"]').classList.contains('is-active'));

  q('#posterBtn').click();
  await sleep(1000);
  const canvas = q('#posterCanvas').getBoundingClientRect();
  check('手机海报不溢出', canvas.width <= 390 && canvas.height <= window.innerHeight - 60, Math.round(canvas.width) + 'x' + Math.round(canvas.height));
  check('手机海报弹窗打开', !q('#posterModal').hidden);
  q('[data-close="poster"]').click();
  await sleep(200);

  const failed = checks.filter((c) => !c.ok);
  return { passed: checks.length - failed.length, total: checks.length, failed };
})()
