(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const target = document.querySelector('#match');
  window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 30);
  await sleep(1100);
  return { scrollY: window.scrollY, score: document.querySelector('#matchRing .score-num')?.textContent };
})()
