(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += 480) {
    window.scrollTo(0, y);
    await sleep(110);
  }
  window.scrollTo(0, h);
  await sleep(700);
  window.scrollTo(0, 0);
  await sleep(900);
  return { height: h, width: document.documentElement.scrollWidth };
})()
