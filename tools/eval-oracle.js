(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const target = document.querySelector('#oracle');
  window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 30);
  await sleep(1000);
  document.querySelectorAll('.reveal').forEach((node) => node.classList.add('is-in'));
  await sleep(500);
  document.querySelector('#flipCard').click();
  await sleep(1200);
  return {
    flipped: document.querySelector('#flipCard').classList.contains('is-flipped'),
    tag: document.querySelector('.slip-tag')?.textContent,
    no: document.querySelector('.slip-no')?.textContent
  };
})()
