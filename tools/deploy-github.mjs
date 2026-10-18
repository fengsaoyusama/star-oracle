// ============================================================
// 星屿占卜馆 · 一键部署到 GitHub Pages
// 不依赖本地 git（走 GitHub REST / Git Data API，绕开部分环境的 TLS 问题）
//
// 用法（PowerShell）：
//   $env:GITHUB_TOKEN = (gh auth token)
//   $env:GITHUB_OWNER = 'fengsaoyusama'
//   $env:GITHUB_REPO  = 'star-oracle'
//   node tools/deploy-github.mjs
//
// 可选参数：
//   --force  覆盖一个已有内容的仓库（会先做安全检查，默认拒绝）
// ============================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO || 'star-oracle';
const BRANCH = 'main';
const FORCE = process.argv.includes('--force');
const ROOT = resolve(process.cwd());
const API = 'https://api.github.com';
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.edge-profile', '.deploy-tmp', '.tmp']);
const ALLOW_DOTFILES = new Set(['.nojekyll', '.gitignore']);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

if (!TOKEN) {
  console.error('缺少 GITHUB_TOKEN 环境变量');
  process.exit(1);
}
if (!OWNER) {
  console.error('缺少 GITHUB_OWNER 环境变量');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body, retry = 2) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'star-oracle-deploy'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    if ((res.status === 429 || res.status >= 500) && retry > 0) {
      await sleep(1500);
      return api(method, path, body, retry - 1);
    }
    const err = new Error(`${method} ${path} → ${res.status}\n${text.slice(0, 500)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && !ALLOW_DOTFILES.has(entry.name)) {
      if (entry.isDirectory() || entry.name.startsWith('.')) continue;
    }
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function posix(rel) {
  return rel.split(sep).join('/');
}

async function pool(items, size, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

async function main() {
  console.log('== 星屿占卜馆 → GitHub Pages 部署 ==');
  const me = await api('GET', '/user');
  console.log(`账号：${me.login}`);
  if (me.login.toLowerCase() !== OWNER.toLowerCase()) {
    throw new Error(`token 属于 ${me.login}，与 GITHUB_OWNER=${OWNER} 不一致`);
  }

  const repoPath = `/repos/${OWNER}/${REPO}`;
  let repo = null;
  try {
    repo = await api('GET', repoPath);
    console.log(`仓库已存在：${repo.full_name}（${repo.private ? 'private' : 'public'}）`);
  } catch (err) {
    if (err.status !== 404) throw err;
    console.log(`创建仓库 ${OWNER}/${REPO} …`);
    repo = await api('POST', '/user/repos', {
      name: REPO,
      description: '星屿占卜馆 · 星座运势 / 双人配对 / 简易星盘 / 今日星签 / 分享海报',
      private: false,
      auto_init: false,
      has_issues: true,
      has_wiki: false
    });
    console.log(`仓库已创建：${repo.html_url}`);
  }

  // 读取已有 main 分支（用于更新和安全检查）
  let parentSha = null;
  let bootstrapped = false;
  try {
    const ref = await api('GET', `${repoPath}/git/ref/heads/${BRANCH}`);
    parentSha = ref.object.sha;
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      console.log('仓库为空，先创建初始提交 …');
      const initContent = Buffer.from('# 星屿占卜馆\n\n> 初始化文件，部署脚本会立即覆盖。\n').toString('base64');
      const init = await api('PUT', `${repoPath}/contents/README.md`, {
        message: 'init: 初始化仓库',
        content: initContent
      });
      parentSha = init.commit.sha;
      bootstrapped = true;
    } else {
      throw err;
    }
  }

  if (parentSha && !bootstrapped) {
    const parent = await api('GET', `${repoPath}/git/commits/${parentSha}`);
    const previousTree = await api('GET', `${repoPath}/git/trees/${parent.tree.sha}?recursive=1`);
    const paths = new Set((previousTree.tree || []).map((item) => item.path));
    const looksLikeOurs = paths.has('index.html') &&
      (parent.message || '').includes('星屿占卜馆') || paths.has('src/app.js');
    if (!looksLikeOurs && !FORCE) {
      throw new Error('目标仓库已有其它项目内容，为避免覆盖已中止。确认要覆盖请加 --force，或换一个 GITHUB_REPO。');
    }
    console.log(`将更新 existing 提交：${parentSha.slice(0, 7)}`);
  }

  // 收集文件
  if (!readFileSync(join(ROOT, 'index.html'), 'utf8').includes('星屿占卜馆')) {
    throw new Error('当前目录不像星屿占卜馆项目根目录');
  }
  const files = walk(ROOT)
    .filter((file) => !file.endsWith('.log'))
    .sort();
  let totalBytes = 0;
  for (const file of files) totalBytes += statSync(file).size;
  console.log(`待上传：${files.length} 个文件，共 ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  // 1) blobs
  let done = 0;
  const blobs = await pool(files, 5, async (file) => {
    const rel = posix(relative(ROOT, file));
    const size = statSync(file).size;
    if (size > MAX_FILE_BYTES) throw new Error(`文件过大：${rel}`);
    const content = readFileSync(file).toString('base64');
    const blob = await api('POST', `${repoPath}/git/blobs`, { content, encoding: 'base64' });
    done += 1;
    if (done % 10 === 0 || done === files.length) console.log(`  已上传 ${done}/${files.length}`);
    return { path: rel, mode: '100644', type: 'blob', sha: blob.sha };
  });

  // 2) tree
  console.log('创建目录树 …');
  const tree = await api('POST', `${repoPath}/git/trees`, { tree: blobs });
  console.log(`tree: ${tree.sha.slice(0, 7)}`);

  // 3) commit
  const message = `deploy: 星屿占卜馆 · 星座占卜小站 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const commit = await api('POST', `${repoPath}/git/commits`, {
    message,
    tree: tree.sha,
    parents: parentSha ? [parentSha] : []
  });
  console.log(`commit: ${commit.sha.slice(0, 7)}`);

  // 4) ref
  if (parentSha) {
    await api('PATCH', `${repoPath}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: true });
  } else {
    await api('POST', `${repoPath}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
  }
  console.log(`分支 ${BRANCH} 已更新`);

  // 5) Pages
  const pagesUrl = `https://${OWNER}.github.io/${REPO}/`;
  let pages = null;
  try {
    pages = await api('GET', `${repoPath}/pages`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  if (!pages) {
    console.log('开启 GitHub Pages …');
    await api('POST', `${repoPath}/pages`, { source: { branch: BRANCH, path: '/' } });
  } else if (pages.source && pages.source.branch !== BRANCH) {
    console.log('调整 Pages 分支 …');
    await api('PUT', `${repoPath}/pages`, { source: { branch: BRANCH, path: '/' } });
  }

  // 6) 等构建完成
  console.log('等待 Pages 构建 …');
  let build = null;
  for (let i = 0; i < 40; i++) {
    try {
      build = await api('GET', `${repoPath}/pages/builds/latest`);
      if (build.status === 'built') break;
      if (build.status === 'errored') throw new Error('Pages 构建失败：' + JSON.stringify(build.error || {}));
      process.stdout.write(`  ${build.status || 'queued'} ${i + 1}/40\r`);
    } catch (err) {
      if (err.status !== 404) throw err;
      process.stdout.write(`  等待构建任务 ${i + 1}/40\r`);
    }
    await sleep(3000);
  }
  console.log('');
  if (build && build.status === 'built') console.log('Pages 构建完成');
  else console.log('构建状态未确认，稍后刷新页面即可');

  // 7) 仓库信息 / topics
  try {
    await api('PATCH', repoPath, {
      description: '星屿占卜馆 · 星座运势 / 双人配对 / 简易星盘 / 今日星签 / 分享海报',
      homepage: pagesUrl,
      has_wiki: false
    });
    await api('PUT', `${repoPath}/topics`, {
      names: ['astrology', 'horoscope', 'zodiac', 'github-pages', 'vanilla-javascript', 'canvas']
    });
  } catch (err) {
    console.log('仓库信息更新失败（不影响站点）：' + err.message.split('\n')[0]);
  }

  // 8) 在线验证
  console.log('验证线上页面 …');
  let live = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(pagesUrl, { headers: { 'User-Agent': 'star-oracle-deploy', 'Cache-Control': 'no-cache' } });
      if (res.ok) {
        const html = await res.text();
        live = { status: res.status, hasTitle: html.includes('星屿占卜馆') };
        break;
      }
    } catch (err) { /* 继续等 */ }
    await sleep(4000);
  }

  console.log('\n===== 部署完成 =====');
  console.log('仓库：' + repo.html_url);
  console.log('站点：' + pagesUrl);
  if (live) console.log(`线上检查：HTTP ${live.status}，标题${live.hasTitle ? '正常' : '未匹配'}`);
  else console.log('线上检查：暂未取到页面（GitHub Pages 首次构建可能要 1-3 分钟）');
  console.log('提交：' + commit.sha);
  console.log('文件：' + files.length + ' 个');
}

main().catch((err) => {
  console.error('\n部署失败：' + err.message);
  process.exit(1);
});
