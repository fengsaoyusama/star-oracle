(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.scrollTo(0, document.querySelector('#reading').getBoundingClientRect().top + window.scrollY - 30);
  await sleep(700);
  document.querySelector('.source-badge').click();
  await sleep(500);
  return {
    modalOpen: !document.querySelector('#sourceModal').hidden,
    checked: document.querySelector('input[name="sourceProvider"]:checked')?.value
  };
})()
