(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const App = window.StarApp;
  // 1) 切到自定义在线源（地址故意写一个连不上的），验证自动回退
  App.openSourceModal();
  await sleep(200);
  const customRadio = document.querySelector('input[name="sourceProvider"][value="custom"]');
  customRadio.checked = true;
  customRadio.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#customUrl').value = 'http://127.0.0.1:9/horoscope';
  document.querySelector('#sourceSave').click();
  await sleep(2500);
  const afterFail = {
    status: App.state.onlineStatus,
    badge: document.querySelector('.source-badge')?.textContent,
    toast: document.querySelector('#toast')?.textContent
  };
  // 2) 切回本地
  App.openSourceModal();
  await sleep(200);
  const localRadio = document.querySelector('input[name="sourceProvider"][value="local"]');
  localRadio.checked = true;
  localRadio.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#sourceSave').click();
  await sleep(500);
  return {
    afterFail,
    finalStatus: App.state.onlineStatus,
    finalBadge: document.querySelector('.source-badge')?.textContent,
    settings: App.getSourceSettings()
  };
})()
