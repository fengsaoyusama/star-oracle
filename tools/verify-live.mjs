// 验证 GitHub Pages 线上站点
const BASE = 'https://fengsaoyusama.github.io/star-oracle/';

async function get(path) {
  const res = await fetch(BASE + path, {
    headers: { 'User-Agent': 'star-oracle-verify', 'Cache-Control': 'no-cache' }
  });
  return res;
}

const out = {};
const htmlRes = await get('');
const html = await htmlRes.text();
out.html = { status: htmlRes.status, bytes: html.length };
out.title = (html.match(/<title>(.*?)<\/title>/) || [])[1];
out.description = (html.match(/<meta name="description" content="(.*?)"/) || [])[1];
out.ogImage = (html.match(/property="og:image" content="([^"]+)"/) || [])[1];
out.ogImageWidth = (html.match(/property="og:image:width" content="([^"]+)"/) || [])[1];
out.twitterImage = (html.match(/name="twitter:image" content="([^"]+)"/) || [])[1];
out.siteUrl = (html.match(/siteUrl: '([^']+)'/) || [])[1];
out.charset = html.includes('charset="utf-8"');
out.hasAbsoluteOg = (out.ogImage || '').startsWith('https://');

for (const path of [
  'src/style.css',
  'src/style-v1.css',
  'src/app.js',
  'src/data.js',
  'src/astro.js',
  'src/online.js',
  'src/poster.js',
  'src/reminder.js',
  'preview/og-cover.png',
  'preview/poster-daily.png',
  'README.md',
  '.nojekyll'
]) {
  try {
    const res = await get(path);
    const buf = await res.arrayBuffer();
    out[path] = { status: res.status, type: res.headers.get('content-type'), bytes: buf.byteLength };
  } catch (err) {
    out[path] = { error: err.message };
  }
}

// 检查 404 页面不会误命中
try {
  const res = await get('definitely-not-exist-' + Date.now() + '.html');
  out.notFound = res.status;
} catch (err) {
  out.notFound = err.message;
}

console.log(JSON.stringify(out, null, 2));

const problems = [];
if (out.html.status !== 200) problems.push('首页非 200');
if (!(out.title || '').includes('星屿占卜馆')) problems.push('标题缺失');
if (!out.hasAbsoluteOg) problems.push('og:image 不是绝对地址');
if (out.siteUrl !== 'https://fengsaoyusama.github.io/star-oracle') problems.push('siteUrl 配置不正确');
for (const path of ['src/style.css', 'src/app.js', 'preview/og-cover.png']) {
  if (!out[path] || out[path].status !== 200) problems.push(path + ' 资源异常');
}
if (out.notFound !== 404) problems.push('404 状态异常: ' + out.notFound);

if (problems.length) {
  console.error('\nVERIFY FAILED:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\nLIVE VERIFY PASSED');
