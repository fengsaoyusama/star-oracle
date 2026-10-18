/* ============================================================
   星屿占卜馆 · 每日提醒
   - 页面内浏览器通知（需要页面保持打开）
   - .ics 日历订阅文件（导入手机日历后每天提醒）
   ============================================================ */
(function (root) {
  'use strict';

  var LS_KEY = 'star-oracle-reminder-v1';
  var timer = null;

  function pad(n) { return String(n).padStart(2, '0'); }

  function todayKey(d) {
    var t = d || new Date();
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
  }

  function load() {
    var def = { enabled: false, time: '21:00', lastFired: '' };
    try {
      var raw = root.localStorage && root.localStorage.getItem(LS_KEY);
      if (!raw) return def;
      var parsed = JSON.parse(raw);
      return {
        enabled: !!parsed.enabled,
        time: /^\d{2}:\d{2}$/.test(parsed.time || '') ? parsed.time : '21:00',
        lastFired: parsed.lastFired || ''
      };
    } catch (err) {
      return def;
    }
  }

  function save(settings) {
    try {
      root.localStorage.setItem(LS_KEY, JSON.stringify(settings));
    } catch (err) { /* ignore */ }
  }

  function notifySupported() {
    return typeof root.Notification !== 'undefined';
  }

  function requestPermission() {
    if (!notifySupported()) return Promise.resolve('unsupported');
    if (root.Notification.permission === 'granted') return Promise.resolve('granted');
    if (root.Notification.permission === 'denied') return Promise.resolve('denied');
    return root.Notification.requestPermission();
  }

  function fireNotification(title, body) {
    if (!notifySupported() || root.Notification.permission !== 'granted') return false;
    try {
      new root.Notification(title, {
        body: body,
        tag: 'star-isle-daily',
        icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2214%22 fill=%22%230a0818%22/%3E%3Ctext x=%2232%22 y=%2246%22 font-size=%2240%22 text-anchor=%22middle%22 fill=%22%23f2cf8d%22%3E%E2%9C%A6%3C/text%3E%3C/svg%3E'
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  /* 页面开着时，到点触发一次 */
  function startScheduler(getBody) {
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      var settings = load();
      if (!settings.enabled) return;
      var now = new Date();
      var nowTime = pad(now.getHours()) + ':' + pad(now.getMinutes());
      if (nowTime !== settings.time) return;
      if (settings.lastFired === todayKey(now)) return;
      var body = typeof getBody === 'function' ? getBody() : '今天的星星已经写好了，去看看今日运势和星签吧。';
      if (fireNotification('星屿占卜馆 · 今日星语', body)) {
        settings.lastFired = todayKey(now);
        save(settings);
      }
    }, 20000);
  }

  /* 生成每日重复的日历文件（浮动本地时间） */
  function buildIcs(time, siteUrl, title, description) {
    var parts = (time || '21:00').split(':');
    var hh = pad(Math.min(23, Math.max(0, parseInt(parts[0], 10) || 21)));
    var mm = pad(Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0)));

    var now = new Date();
    var stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) +
      'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + '00Z';

    var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var start = tomorrow.getFullYear() + pad(tomorrow.getMonth() + 1) + pad(tomorrow.getDate()) + 'T' + hh + mm + '00';

    var desc = (description || '打开星屿占卜馆，看看今天的星座运势与星签。') + (siteUrl ? ' ' + siteUrl : '');
    desc = desc.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Star Isle Oracle//DAILY//CN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:star-isle-daily@star-oracle',
      'DTSTAMP:' + stamp,
      'DTSTART:' + start,
      'RRULE:FREQ=DAILY',
      'SUMMARY:' + (title || '星屿占卜馆 · 今日星语'),
      'DESCRIPTION:' + desc,
      siteUrl ? 'URL:' + siteUrl : '',
      'BEGIN:VALARM',
      'TRIGGER:-PT0M',
      'ACTION:DISPLAY',
      'DESCRIPTION:看看今天的星星',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
  }

  function downloadText(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 800);
  }

  var api = {
    load: load,
    save: save,
    notifySupported: notifySupported,
    requestPermission: requestPermission,
    fireNotification: fireNotification,
    startScheduler: startScheduler,
    buildIcs: buildIcs,
    downloadText: downloadText
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StarReminder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
