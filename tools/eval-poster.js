(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector('#posterBtn').click();
  await sleep(900);
  const modal = document.querySelector('#posterModal');
  const canvas = document.querySelector('#posterCanvas');
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let nonBlank = 0;
  for (let i = 3; i < data.length; i += 4000) {
    if (data[i] > 10) nonBlank++;
  }
  return {
    modalOpen: !modal.hidden,
    size: canvas.width + 'x' + canvas.height,
    nonTransparentSamples: nonBlank
  };
})()
