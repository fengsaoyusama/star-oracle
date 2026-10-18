(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector('[data-match-action="poster"]').click();
  await sleep(900);
  return {
    modalOpen: !document.querySelector('#posterModal').hidden,
    title: document.querySelector('#posterTitle').textContent
  };
})()
