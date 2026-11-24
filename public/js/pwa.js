/* Reef Crush — Progressive Web App glue:
   registers the service worker, offers an install button, and tells the player when an update is ready. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const ui = () => window.ReefUI;

  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;
  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      const hadController = !!navigator.serviceWorker.controller; // false on the very first visit
      navigator.serviceWorker.register('/sw.js').then(reg => {
        // A new version finished installing while this page was open: offer a reload.
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated' && hadController) showUpdateToast();
          });
        });
        // Check for updates whenever the app comes back to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      }).catch(err => console.warn('Service worker registration failed', err));
    });
  }

  function showUpdateToast() {
    if (document.querySelector('.toast')) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span>A new version of the reef is ready</span><button type="button">Reload</button>';
    t.querySelector('button').addEventListener('click', () => location.reload());
    document.body.appendChild(t);
  }

  /* ---------- install button ---------- */
  const btn = $('#installBtn');
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  let deferredPrompt = null;

  // Chrome, Edge and Samsung Internet on Android (and desktop Chrome) fire this when the app is installable.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    btn.hidden = true;
  });

  // iOS Safari has no install prompt; show the button and explain "Add to Home Screen" instead.
  if (isIOS() && !standalone()) btn.hidden = false;

  btn.addEventListener('click', async () => {
    if (ui()) ui().tick();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) { /* dismissed */ }
      deferredPrompt = null;
      btn.hidden = true;
      return;
    }
    if (ui()) ui().modal(installHelp());
  });

  function installHelp() {
    const share = '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M8 7.5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 10.5H6.5A1.5 1.5 0 0 0 5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    const plus = '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    const steps = isIOS()
      ? `<div>${share}<span>Tap the <b>Share</b> button in Safari's toolbar</span></div>
         <div>${plus}<span>Scroll down and choose <b>Add to Home Screen</b></span></div>`
      : `<div>${plus}<span>Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b></span></div>`;
    return `<img class="app-icon-preview" src="/icons/icon-192.png" alt="Reef Crush icon">
      <div class="card-title" style="margin-top:10px">Install Reef Crush</div>
      <div class="card-sub">Play full screen from your home screen, even offline.</div>
      <div class="ios-steps">${steps}</div>
      <div class="btns"><button class="btn" data-act="close">Got it</button></div>`;
  }
})();
