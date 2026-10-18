(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.StarApp;
  const mode = location.hash.indexOf('match') !== -1 ? 'match' : 'daily';
  const canvas = document.querySelector('#posterCanvas');

  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;padding:0;overflow:hidden;background:#070615';
  canvas.style.cssText = 'display:block;width:1080px;height:1440px;max-width:none;max-height:none;border:0;border-radius:0';
  document.body.appendChild(canvas);

  const MOOD = { high: '顺风局', mid: '平稳局', low: '充电局' };

  if (mode === 'match') {
    const m = app.state.match;
    window.StarPoster.renderMatch(canvas, {
      a: m.a,
      b: m.b,
      result: {
        overall: m.overall,
        tierLabel: m.tierLabel,
        review: m.review,
        tags: m.tags,
        dimensions: m.dimensions,
        suggestions: m.suggestions
      },
      dateLabel: '2026.10.18',
      siteUrl: ''
    });
  } else {
    const sign = window.STAR_DATA.signs.find((s) => s.id === app.state.signId);
    const f = app.state.fortune;
    window.StarPoster.renderDaily(canvas, {
      sign: sign,
      fortune: Object.assign({}, f, { moodLabel: MOOD[f.tier] }),
      oracle: app.state.oracle,
      dateLabel: '2026.10.18',
      siteUrl: ''
    });
  }

  await sleep(300);
  return { mode: mode, w: canvas.width, h: canvas.height };
})()
