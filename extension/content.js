(() => {
  const CHANNEL = 'kdl';

  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'video' || !parts[1]) return;

  function videoId(cfg) {
    const box = document.getElementById('video-container');
    const attr = box && box.getAttribute('data-id');
    if (attr && /^\d+$/.test(attr)) return attr;

    const seg = parts[1];
    if (!/^[a-f0-9]{15}$/i.test(seg)) {
      const m = seg.match(/^(\d+)/);
      if (m) return m[1];
    }

    if (cfg && /^\d+$/.test(String(cfg.v_id))) return String(cfg.v_id);
    return null;
  }

  function pageConfig() {
    for (const s of document.querySelectorAll('script')) {
      const m = s.textContent.match(/video_Init\s*\(\s*["']([A-Za-z0-9+/=]{40,})["']/);
      if (!m) continue;
      try {
        return JSON.parse(atob(m[1]));
      } catch {
      }
    }
    return null;
  }

  function isStub() {
    const box = document.getElementById('video-container');
    if (!box) return false;
    return !box.querySelector('video');
  }

  function poster() {
    const og = document.querySelector('meta[property="og:image"]');
    return og ? og.getAttribute('content') : null;
  }

  const ask = (msg) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          void chrome.runtime.lastError;
          resolve(res || null);
        });
      } catch {
        resolve(null);
      }
    });

  const toPage = (payload) =>
    window.postMessage({ channel: CHANNEL, ...payload }, location.origin);

  async function start() {
    const { enabled = true } = await chrome.storage.local.get('enabled');
    if (!enabled) return;

    const cfg = pageConfig();
    const id = videoId(cfg);
    if (!id) return;

    const stub = isStub();

    if (!stub) {
      const siteUrl = cfg && (cfg.url || cfg.url2);
      if (!siteUrl) return;
      const probe = await ask({ type: 'probe', url: siteUrl });
      if (!probe || !probe.ok || !probe.blocked) return;
    }

    const res = await ask({ type: 'getUrl', id });
    if (!res) return;
    if (!res.ok) {
      toPage({
        action: 'error',
        text: res.error === 'NO_SESSION' ? 'вы не вошли на сайте' : res.error,
      });
      return;
    }

    toPage({
      action: 'fix',
      stub,
      id,
      mpd: res.mpd || null,
      mp4: res.url,
      poster: poster(),
    });
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
