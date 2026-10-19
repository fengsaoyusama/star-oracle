(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);
  const text = (sel) => (q(sel) ? q(sel).textContent.trim() : null);
  const checks = [];
  const check = (name, ok, extra) => checks.push({ name, ok: !!ok, extra: extra === undefined ? null : extra });

  check('爱情与财运区块存在', !!q('#fortune'));
  check('两张卡片', document.querySelectorAll('.lm-card').length === 2);
  check('桃花指数数字', /^\d+$/.test(text('.lm-love .score-num') || ''), text('.lm-love .score-num'));
  check('财运指数数字', /^\d+$/.test(text('.lm-money .score-num') || ''), text('.lm-money .score-num'));
  check('爱情三维星级', document.querySelectorAll('.lm-love .star-row').length === 3);
  check('财运三维星级', document.querySelectorAll('.lm-money .star-row').length === 3);
  check('桃花幸运四项', document.querySelectorAll('.lm-love .lucky-item').length === 4);
  check('财神幸运四项', document.querySelectorAll('.lm-money .lucky-item').length === 4);
  check('桃花签有内容', (text('.lm-love .lm-oracle-text') || '').length > 4, text('.lm-love .lm-oracle-text'));
  check('财神签有内容', (text('.lm-money .lm-oracle-text') || '').length > 4, text('.lm-money .lm-oracle-text'));

  const loveOracle1 = text('.lm-love .lm-oracle-text');
  q('[data-lm-action="love-oracle"]').click();
  await sleep(250);
  check('桃花签可换一支', loveOracle1 !== text('.lm-love .lm-oracle-text'), loveOracle1 + ' => ' + text('.lm-love .lm-oracle-text'));

  const moneyOracle1 = text('.lm-money .lm-oracle-text');
  q('[data-lm-action="money-oracle"]').click();
  await sleep(250);
  check('财神签可换一支', moneyOracle1 !== text('.lm-money .lm-oracle-text'));

  const advice1 = text('.lm-love .lm-block-text');
  q('[data-lm-action="status"][data-status="taken"]').click();
  await sleep(250);
  check('有伴状态高亮', q('[data-lm-action="status"][data-status="taken"]').classList.contains('is-active'));
  check('建议随状态变化', advice1 !== text('.lm-love .lm-block-text'), (advice1 || '').slice(0, 12) + ' => ' + (text('.lm-love .lm-block-text') || '').slice(0, 12));
  q('[data-lm-action="status"][data-status="single"]').click();
  await sleep(200);

  document.querySelector('.sign-node[data-id="aries"]').click();
  await sleep(350);
  check('板块跟随星座切换', (text('.lm-love .lm-eyebrow') || '').includes('白羊座'), text('.lm-love .lm-eyebrow'));
  check('财板块跟随星座切换', (text('.lm-money .lm-eyebrow') || '').includes('白羊座'), text('.lm-money .lm-eyebrow'));
  const stableScore = text('.lm-love .score-num');
  document.querySelector('.sign-node[data-id="aries"]').click();
  await sleep(250);
  check('同一天同星座结果稳定', stableScore === text('.lm-love .score-num'), stableScore + ' / ' + text('.lm-love .score-num'));

  check('星图卡有详解入口', !!q('[data-action="lm"]'));
  check('底栏含情财入口', !!q('#tabbar a[href="#fortune"]'));
  check('导航含情财入口', !!q('.nav-links a[href="#fortune"]'));

  const failed = checks.filter((c) => !c.ok);
  return { passed: checks.length - failed.length, total: checks.length, failed };
})()
