(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const target = document.querySelector('#chart');
  window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 30);
  await sleep(1100);
  return {
    scrollY: window.scrollY,
    hasSvg: !!document.querySelector('#chartVisual svg'),
    cards: document.querySelectorAll('.chart-card').length,
    meta: document.querySelector('.chart-meta')?.textContent
  };
})()
