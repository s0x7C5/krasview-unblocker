const API_BASE = 'https://atoto.ru';
const COOKIE_URL = 'https://atoto.ru/';

const SITE_HOSTS = [
  'zseek.ru',
  'hlamer.ru',
  'krasview.ru',
  'smartkino.ru',
  'sersoap.ru',
  'qanime.ru',
];

async function sessionFromSite() {
  for (const host of SITE_HOSTS) {
    try {
      const c = await chrome.cookies.get({ url: `https://${host}/`, name: 'user' });
      if (c && c.value) return { value: c.value, host };
    } catch {
      }
  }
  return null;
}

async function setTokenCookie(value) {
  await chrome.cookies.set({
    url: COOKIE_URL,
    name: 'token',
    value,
    path: '/',
    secure: true,
    sameSite: 'no_restriction',
  });
}

async function callUrlEndpoint(videoId) {
  const res = await fetch(`${API_BASE}/api/video/${encodeURIComponent(videoId)}/url`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return res.json().catch(() => ({}));
}

async function probeMedia(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    credentials: 'omit',
    cache: 'no-store',
  });

  let ovs = null;
  for (const [name, value] of res.headers.entries()) {
    if (/ovs/i.test(name) || /\bblocked\b/i.test(value)) {
      ovs = `${name}: ${value}`;
      break;
    }
  }

  const blocked = res.status === 404 || Boolean(ovs && /blocked/i.test(ovs));
  return { status: res.status, ovs, blocked };
}

async function mpdBeside(mp4Url) {
  const mpd = mp4Url.replace(/\.[a-z0-9]+(\?.*)?$/i, '.mpd');
  if (mpd === mp4Url) return null;
  try {
    const res = await fetch(mpd, { method: 'GET', credentials: 'omit' });
    return res.ok ? mpd : null;
  } catch {
    return null;
  }
}

async function getDirectUrl(numericId) {
  if (!/^\d+$/.test(String(numericId))) throw new Error('Нужен числовой id видео.');

  const site = await sessionFromSite();
  if (!site) throw new Error('NO_SESSION');

  await setTokenCookie(site.value);
  const data = await callUrlEndpoint(numericId);

  if (data && data.message === 'Unauthenticated') throw new Error('NO_SESSION');
  if (data && data.error) throw new Error(`API вернул ошибку: ${data.error}`);

  const mp4 = data && (data.url1 || data.url2);
  if (!mp4) throw new Error('API не вернул ссылку на файл.');

  return { url: mp4, mpd: await mpdBeside(mp4) };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  (async () => {
    try {
      if (req.type === 'getUrl') {
        sendResponse({ ok: true, ...(await getDirectUrl(req.id)) });
      } else if (req.type === 'probe') {
        sendResponse({ ok: true, ...(await probeMedia(req.url)) });
      } else if (req.type === 'session') {
        const site = await sessionFromSite();
        sendResponse({ ok: true, host: site ? site.host : null });
      } else {
        sendResponse({ ok: false, error: 'Неизвестный запрос.' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  return true; });
