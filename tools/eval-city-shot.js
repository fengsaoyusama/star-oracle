(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = document.querySelector('#chart');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 30);
  await sleep(1000);
  document.querySelectorAll('.reveal').forEach((node) => node.classList.add('is-in'));
  await sleep(400);
  const input = document.querySelector('#chartCityInput');
  input.focus();
  input.value = '成';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);
  return {
    value: input.value,
    options: document.querySelectorAll('#cityDropdown .city-option').length,
    meta: document.querySelector('.chart-meta')?.textContent || ''
  };
})()
