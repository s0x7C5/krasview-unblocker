const $enabled = document.getElementById('enabled');
const $state = document.getElementById('state');
const $warn = document.getElementById('warn');

function paintState(on) {
  $state.textContent = on ? 'включена' : 'выключена';
  $state.className = 'state' + (on ? ' on' : '');
}

async function checkSession() {
  const res = await new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'session' }, (r) => {
        void chrome.runtime.lastError;
        resolve(r || null);
      });
    } catch {
      resolve(null);
    }
  });

  $warn.textContent =
    res && res.ok && res.host ? '' : 'Вы не вошли на сайте — починить видео не выйдет.';
}

$enabled.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: $enabled.checked });
  paintState($enabled.checked);
});

(async () => {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  $enabled.checked = enabled;
  paintState(enabled);
  await checkSession();
})();
