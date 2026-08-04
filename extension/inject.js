(() => {
  const CHANNEL = 'kdl';

  function playerBox() {
    return (
      document.getElementById('video-container') ||
      (document.querySelector('video') || {}).parentElement ||
      null
    );
  }

  function note(text, isError) {
    const box = playerBox();
    if (!box || !box.parentElement) return;

    const bar = document.createElement('div');
    bar.style.cssText =
      'padding:6px 9px;background:#1e2128;color:' +
      (isError ? '#e5534b' : '#8b93a3') +
      ';font:12px/1.4 "Segoe UI",system-ui,sans-serif';
    bar.textContent = text;
    box.parentElement.insertBefore(bar, box);
  }

  function preferBestQuality(tries) {
    tries = tries || 0;
    const sp =
      window.Static && Static.player && Static.player.media
        ? Static.player.media.dash_player
        : null;

    const again = () => {
      if (tries < 40) setTimeout(() => preferBestQuality(tries + 1), 250);
    };

    if (!sp || typeof sp.getVariantTracks !== 'function') return again();

    let tracks = [];
    try {
      sp.configure({
        restrictions: { maxHeight: Infinity, maxWidth: Infinity, maxBandwidth: Infinity },
        abr: {
          restrictions: { maxHeight: Infinity, maxWidth: Infinity, maxBandwidth: Infinity },
        },
      });
      tracks = sp.getVariantTracks() || [];
    } catch {
      return again();
    }

    if (!tracks.length) return again();

    const best = tracks.reduce((a, b) => {
      const ha = a.height || 0;
      const hb = b.height || 0;
      if (hb !== ha) return hb > ha ? b : a;
      return (b.bandwidth || 0) > (a.bandwidth || 0) ? b : a;
    });

    if (!best.active) {
      try {
        sp.selectVariantTrack(best, true);
      } catch {

      }
    }
  }

  function bootNativePlayer(d) {
    if (typeof window.video_Init !== 'function') return false;
    if (typeof window.jQuery !== 'function') return false;

    const holder =
      document.getElementById('video-flash-container') ||
      document.getElementById('video-container');
    if (!holder) return false;

    let v = document.getElementById('video-flash');
    if (!v) {
      holder.replaceChildren();
      v = document.createElement('video');
      v.id = 'video-flash';
      v.setAttribute('preload', 'none');
      v.style.width = '100%';
      holder.append(v);
    }

    const w = holder.clientWidth || 720;
    v.setAttribute('width', w);
    v.setAttribute('height', Math.round((w * 9) / 16));

    const cfg = {
      v_id: Number(d.id) || d.id,
      url: d.mpd || d.mp4,
      url2: d.mp4,
      dash: d.mpd ? 1 : 0,
      type: d.mpd ? 'application/dash+xml' : 'video/mp4',
      image: d.poster || '',
      duration: 0,
      audio: 1,
      play: false,
    };

    try {
      const json = JSON.stringify(cfg).replace(/[^\x00-\x7F]/g, '');
      window.video_Init(btoa(json));
      preferBestQuality();
      return true;
    } catch {
      return false;
    }
  }

  function setSrc(url) {
    const p = window.Static && Static.player;
    if (p && typeof p.setSrc === 'function') {
      const at = p.media && p.media.currentTime;
      try {
        p.setSrc(url);
        p.load();
        if (at > 0 && typeof p.setCurrentTime === 'function') p.setCurrentTime(at);
        preferBestQuality();
        return true;
      } catch {
        return false;
      }
    }

    const v = document.querySelector('video');
    if (!v) return false;
    v.src = url;
    v.load();
    return true;
  }

  function ownPlayer(d) {
    const box = playerBox();
    if (!box) return false;

    for (const m of document.querySelectorAll('video, audio')) {
      try {
        m.pause();
        m.muted = true;
      } catch {
      }
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;background:#000';

    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = d.mp4;
    if (d.poster) video.poster = d.poster;
    video.style.cssText = 'display:block;width:100%;max-height:80vh;background:#000';

    const bar = document.createElement('div');
    bar.style.cssText =
      'display:flex;gap:8px;padding:7px 9px;background:#1e2128;' +
      'font:12px/1.4 "Segoe UI",system-ui,sans-serif';

    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Открыть файл';
    open.style.cssText =
      'padding:4px 9px;border:1px solid #2c313b;border-radius:5px;' +
      'background:transparent;color:#e6e8ec;font:inherit;cursor:pointer';
    open.addEventListener('click', () => window.open(d.mp4, '_blank', 'noopener'));

    bar.append(open);
    wrap.append(video, bar);

    if (box.id === 'video-container') {
      const holder = document.getElementById('video-flash-container');
      if (holder) holder.replaceChildren(wrap);
      else box.prepend(wrap);
    } else {
      box.style.display = 'none';
      box.parentElement.insertBefore(wrap, box);
    }
    return true;
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.channel !== CHANNEL) return;

    if (d.action === 'error') {
      note(`Прямая ссылка недоступна: ${d.text}`, true);
      return;
    }
    if (d.action !== 'fix') return;


    const ok = d.stub ? bootNativePlayer(d) : setSrc(d.mpd || d.mp4);
    if (!ok && !ownPlayer(d)) {
      note('Не удалось встроить проигрыватель.', true);
    }
  });
})();
