// cdp-shot.mjs — 通过 Chrome DevTools Protocol 截图 / 执行页面脚本（无需 puppeteer）
// 用法: node tools/cdp-shot.mjs <url> <out.png> [w] [h] [waitMs] [dpr] [evalFile] [waitAfterMs] [full]
//   先运行 tools/browser-start.ps1 启动无头 Edge（CDP 端口 9223）
import { readFileSync, writeFileSync } from 'node:fs';

const [, , url, out, wArg, hArg, waitArg, dprArg, evalFile, waitAfterArg, fullArg] = process.argv;
if (!url || !out) {
  console.error('usage: node tools/cdp-shot.mjs <url> <out.png> [w] [h] [waitMs] [dpr] [evalFile] [waitAfterMs] [full]');
  process.exit(2);
}
const width = parseInt(wArg || '1600', 10);
const height = parseInt(hArg || '1000', 10);
const waitMs = parseInt(waitArg || '1500', 10);
const dpr = parseFloat(dprArg || '1');
const waitAfter = parseInt(waitAfterArg || '800', 10);
const full = fullArg === '1' || fullArg === 'full';
const CDP = 'http://127.0.0.1:9223';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      }
    });
    ws.addEventListener('open', () => resolve({
      ws,
      send(method, params = {}) {
        const mid = ++id;
        return new Promise((res, rej) => {
          pending.set(mid, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      }
    }));
    ws.addEventListener('error', () => reject(new Error('ws error')));
  });
}

const version = await (await fetch(`${CDP}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });

const pending = new Map();
let pageId = 0;
const errors = [];
browser.ws.addEventListener('message', (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }
  if (msg.sessionId !== sessionId) return;
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    errors.push('EXCEPTION: ' + (d.exception?.description || d.text));
  }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    errors.push('[console.' + msg.params.type + '] ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
  }
});

const page = {
  send(method, params = {}) {
    const mid = ++pageId;
    return new Promise((res, rej) => {
      pending.set(mid, { resolve: res, reject: rej });
      browser.ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });
  }
};

await page.send('Page.enable');
await page.send('Runtime.enable');
await page.send('Network.enable');
await page.send('Network.setCacheDisabled', { cacheDisabled: true });
await page.send('Emulation.setLocaleOverride', { locale: 'zh-CN' });
await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
await page.send('Page.navigate', { url });
await sleep(waitMs);

let evalResult = null;
if (evalFile) {
  const expression = readFileSync(evalFile, 'utf8');
  evalResult = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (evalResult.exceptionDetails) {
    console.log('EVAL-EXCEPTION:', JSON.stringify(evalResult.exceptionDetails).slice(0, 1200));
  } else {
    console.log('EVAL:', JSON.stringify(evalResult.result?.value ?? null));
  }
  await sleep(waitAfter);
}

if (full) {
  const metrics = await page.send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize || metrics.contentSize;
  const shot = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 }
  });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('WROTE', out, 'full-page', Math.ceil(size.width) + 'x' + Math.ceil(size.height));
} else {
  const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('WROTE', out, width + 'x' + height);
}

console.log('PAGE-ERRORS:', errors.length ? JSON.stringify(errors) : 'none');
await browser.send('Target.closeTarget', { targetId });
process.exit(0);
