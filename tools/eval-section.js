(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const id = (location.hash || '#reading').replace('#', '') || 'reading';
  const el = document.getElementById(id) || document.getElementById('reading');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 30);
  await sleep(1000);
  document.querySelectorAll('.reveal').forEach((node) => node.classList.add('is-in'));
  await sleep(600);
  return { section: id, scrollY: window.scrollY };
})()
