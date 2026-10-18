// 关闭本项目的无头 Edge（Browser.close，不会误伤用户自己的浏览器）
const CDP = 'http://127.0.0.1:9223';

try {
  const version = await (await fetch(`${CDP}/json/version`)).json();
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      setTimeout(resolve, 300);
    });
    ws.addEventListener('error', reject);
  });
  console.log('closed');
} catch (err) {
  console.log('no browser to close:', err.message);
}
process.exit(0);
