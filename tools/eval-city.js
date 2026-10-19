(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);
  const text = (sel) => (q(sel) ? q(sel).textContent.trim() : null);
  const checks = [];
  const check = (name, ok, extra) => checks.push({ name, ok: !!ok, extra: extra === undefined ? null : extra });

  const cities = window.STAR_CITIES || [];
  check('城市库已加载', cities.length >= 300, cities.length);
  check('城市库包含西藏城市', cities.some((c) => c.name === '拉萨'));
  check('城市库包含县级市', cities.some((c) => c.name === '昆山') || cities.some((c) => c.name === '义乌') || cities.some((c) => c.name === '仙桃'), '');
  check('城市库包含海外城市', cities.some((c) => c.name === '东京' && c.tz === 9));

  q('#cityManualBtn').click();
  await sleep(120);
  check('手动经纬度模式展开', !q('#chartManual').hidden);
  q('#cityManualBtn').hidden = false;
  q('#chartCityInput').value = '';
  q('#chartCityInput').dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(100);

  // 搜索成都
  q('#chartCityInput').value = '成';
  q('#chartCityInput').dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(150);
  const options = [...document.querySelectorAll('#cityDropdown .city-option')];
  const chengdu = options.find((o) => o.textContent.includes('成都'));
  check('输入「成」出现成都', !!chengdu, options.slice(0, 3).map((o) => o.textContent.trim()).join(' / '));
  if (chengdu) chengdu.click();
  await sleep(250);
  check('选择成都后输入框更新', q('#chartCityInput').value === '成都', q('#chartCityInput').value);
  check('手动区自动收起', q('#chartManual').hidden);
  q('#chartForm').requestSubmit();
  await sleep(350);
  check('星盘 meta 显示成都', (text('.chart-meta') || '').includes('成都'), text('.chart-meta'));

  // 搜索三亚（县级/地级都覆盖）
  q('#chartCityInput').value = '三亚';
  q('#chartCityInput').dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(150);
  const sanya = [...document.querySelectorAll('#cityDropdown .city-option')].find((o) => o.textContent.includes('三亚'));
  check('搜索三亚', !!sanya);
  if (sanya) sanya.click();
  await sleep(200);
  q('#chartForm').requestSubmit();
  await sleep(300);
  check('星盘 meta 显示三亚', (text('.chart-meta') || '').includes('三亚'), text('.chart-meta'));

  // 海外城市 & 时区
  q('#chartCityInput').value = '东京';
  q('#chartCityInput').dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(150);
  const tokyo = [...document.querySelectorAll('#cityDropdown .city-option')].find((o) => o.textContent.includes('东京'));
  check('搜索东京', !!tokyo);
  if (tokyo) tokyo.click();
  await sleep(250);
  q('#chartForm').requestSubmit();
  await sleep(300);
  check('东京显示 UTC+9', (text('.chart-meta') || '').includes('UTC+9'), text('.chart-meta'));

  // 地级市搜索（恩施 / 延边这类自治州）
  q('#chartCityInput').value = '恩施';
  q('#chartCityInput').dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(150);
  const enshi = [...document.querySelectorAll('#cityDropdown .city-option')].find((o) => o.textContent.includes('恩施'));
  check('搜索自治州城市', !!enshi, enshi ? enshi.textContent.trim() : 'n/a');
  if (enshi) enshi.click();
  await sleep(250);
  check('选择恩施后 meta 更新', (text('.chart-meta') || '').includes('恩施'), text('.chart-meta'));

  // 键盘选择
  q('#chartCityInput').focus();
  q('#chartCityInput').value = '乌鲁';
  q('#chartCityInput').dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(150);
  q('#chartCityInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  q('#chartCityInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(250);
  check('键盘选中乌鲁木齐', q('#chartCityInput').value === '乌鲁木齐', q('#chartCityInput').value);

  // 地图/星空仍正常
  check('星盘 SVG 仍存在', !!q('#chartVisual svg'));
  check('城市下拉可关闭', q('#cityDropdown').hidden || q('#cityDropdown').hidden === true);

  const failed = checks.filter((c) => !c.ok);
  return { passed: checks.length - failed.length, total: checks.length, failed };
})()
