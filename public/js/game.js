(function () {
  'use strict';
  const { Engine } = window.ReefEngine;
  const LEVELS = window.REEF_LEVELS;
  const $ = s => document.querySelector(s);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const COLORS = ['#ff8f2e', '#f04a3c', '#ffc531', '#a85ff2', '#2fbf63', '#45aefc'];
  const NAMES = ['clownfish', 'crabs', 'starfish', 'octopuses', 'turtles', 'pufferfish'];
  const RAINBOW = ['#ff6fa5', '#ffd36b', '#8dffb5', '#6bd8ff', '#b48cff'];

  const ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24"><path d="M3.5 9v6h4l5 4V5l-5 4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24"><path d="M3.5 9v6h4l5 4V5l-5 4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    vibOn: '<svg viewBox="0 0 24 24"><rect x="7.5" y="3" width="9" height="18" rx="2.4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3.5 8.5v7M20.5 8.5v7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    vibOff: '<svg viewBox="0 0 24 24"><rect x="7.5" y="3" width="9" height="18" rx="2.4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    lock: '<svg class="lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10.5" rx="2.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#fff" stroke-width="2.6"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    swap: '<svg class="tip-arrow" viewBox="0 0 24 24"><path d="M4 9h15l-4-4M20 15H5l4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const starSVG = cls => `<svg class="${cls || ''}" viewBox="0 0 24 24"><use href="#star"/></svg>`;

  /* ================= storage ================= */
  const Store = {
    key: 'reefcrush.save.v1', data: null,
    load() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(this.key)); } catch (e) { /* storage unavailable */ }
      this.data = Object.assign({ unlocked: 1, stars: [], best: [], sound: true, haptics: true, unlockAll: false }, d || {});
    },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ } }
  };
  Store.load();

  /* ================= sound (synthesised) ================= */
  const Sound = {
    ctx: null, master: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    get on() { return Store.data.sound && this.ctx; },
    tone(f, d, type, v, f2, delay) {
      if (!this.on) return;
      const t = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v || 0.2, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + d + 0.03);
    },
    noise(d, v, freq, delay) {
      if (!this.on) return;
      const t = this.ctx.currentTime + (delay || 0);
      const len = Math.floor(this.ctx.sampleRate * d);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq || 1000;
      const g = this.ctx.createGain(); g.gain.value = v || 0.2;
      s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t);
    },
    pop(n) { const f = 420 * Math.pow(1.122, Math.min(n, 12)); this.tone(f, 0.15, 'sine', 0.24, f * 1.6); this.tone(f * 2, 0.07, 'triangle', 0.05, null, 0.02); },
    swap() { this.tone(300, 0.1, 'triangle', 0.1, 470); },
    bad() { this.tone(210, 0.16, 'square', 0.045, 150); },
    tick() { this.tone(950, 0.05, 'sine', 0.07); },
    special() { [784, 988, 1319].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.12, null, i * 0.06)); },
    blast() { this.noise(0.45, 0.32, 900); this.tone(170, 0.38, 'sine', 0.24, 45); },
    crack() { this.noise(0.14, 0.22, 3200); this.tone(1400, 0.06, 'square', 0.03, 700); },
    bubble() { this.tone(500 + Math.random() * 300, 0.12, 'sine', 0.1, 1200); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, null, i * 0.1)); },
    lose() { [392, 349, 294, 247].forEach((f, i) => this.tone(f, 0.34, 'sine', 0.14, null, i * 0.17)); },
    star(i) { this.tone(880 * Math.pow(1.26, i), 0.35, 'triangle', 0.16); this.tone(1760 * Math.pow(1.26, i), 0.2, 'sine', 0.05, null, 0.04); }
  };
  function buzz(p) {
    if (!Store.data.haptics) return;
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* not allowed here */ }
  }
  document.addEventListener('pointerdown', () => Sound.init(), { capture: true, passive: true });

  /* ================= background ================= */
  (function makeBackground() {
    const bg = $('#bg');
    [[8, -14, 16], [30, -6, 10], [55, 4, 18], [78, 12, 12]].forEach(([left, a, w], i) => {
      const r = document.createElement('div');
      r.className = 'ray';
      r.style.cssText = `left:${left}%;width:${w}vw;--a:${a}deg;animation-delay:${-i * 2.5}s`;
      bg.appendChild(r);
    });
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('div');
      const s = 6 + Math.random() * 18;
      b.className = 'bub';
      b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;--drift:${(Math.random() * 40 - 20).toFixed(0)}px;animation-duration:${(9 + Math.random() * 12).toFixed(1)}s;animation-delay:${(-Math.random() * 20).toFixed(1)}s`;
      bg.appendChild(b);
    }
  })();

  /* ================= piece rendering ================= */
  function pieceHTML(p) {
    if (p.rock) return `<div class="pc"><svg viewBox="0 0 100 100"><use href="#rock${p.rock > 1 ? 2 : 1}"/></svg></div>`;
    let inner;
    if (p.special === 'bomb') inner = '<div class="pearl"><div class="sheen"></div></div>';
    else {
      inner = `<svg viewBox="0 0 100 100"><use href="#cr${p.color}"/></svg>`;
      if (p.special === 'h' || p.special === 'v') inner += `<svg class="stripes ${p.special}" viewBox="0 0 100 100"><use href="#stripes"/></svg>`;
      if (p.special === 'wrap') inner += '<div class="bubble-ov"></div>';
    }
    if (p.ice) inner += '<div class="ice"></div>';
    return `<div class="pc">${inner}</div>`;
  }
  const demo = (p, extra) => `<div class="demo ${extra || ''}">${pieceHTML(Object.assign({ color: 0, special: null, ice: 0, rock: 0 }, p))}</div>`;

  /* ================= game state ================= */
  const G = { E: null, idx: 0, els: new Map(), tiles: [], cell: 44, busy: false, sel: null, hintTimer: 0, cheerMax: 0 };
  const boardEl = $('#board'), piecesEl = $('#pieces'), tilesEl = $('#tiles'), fxEl = $('#fx');

  function setPos(el, r, c) { el.style.setProperty('--x', c); el.style.setProperty('--y', r); }
  function makeEl(p, r, c) {
    const el = document.createElement('div');
    el.className = 'piece';
    el.innerHTML = pieceHTML(p);
    setPos(el, r, c);
    piecesEl.appendChild(el);
    G.els.set(p.id, el);
    return el;
  }
  function refreshEl(p) { const el = G.els.get(p.id); if (el) el.innerHTML = pieceHTML(p); return el; }
  function flashClass(el, cls, ms) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }

  function layoutBoard() {
    if (!G.E) return;
    const wrap = $('#boardWrap');
    const w = wrap.clientWidth - 12, h = wrap.clientHeight - 12;
    const cell = Math.max(24, Math.floor(Math.min(w / G.E.cols, h / G.E.rows, 76)));
    G.cell = cell;
    boardEl.style.setProperty('--cell', cell + 'px');
    boardEl.style.width = cell * G.E.cols + 'px';
    boardEl.style.height = cell * G.E.rows + 'px';
  }

  function buildBoard() {
    piecesEl.innerHTML = ''; tilesEl.innerHTML = ''; fxEl.innerHTML = '';
    G.els.clear(); G.tiles = [];
    const E = G.E;
    for (let r = 0; r < E.rows; r++) {
      G.tiles.push([]);
      for (let c = 0; c < E.cols; c++) {
        if (!E.ok(r, c)) { G.tiles[r].push(null); continue; }
        const t = document.createElement('div');
        t.className = 'tile' + ((r + c) % 2 ? ' alt' : '');
        t.innerHTML = '<div class="coral"></div>';
        setPos(t, r, c);
        tilesEl.appendChild(t);
        G.tiles[r].push(t);
        updateTile(r, c);
        const p = E.grid[r][c];
        if (p) makeEl(p, r, c);
      }
    }
  }
  function updateTile(r, c) {
    const t = G.tiles[r] && G.tiles[r][c];
    if (!t) return;
    const j = G.E.jelly[r][c];
    t.classList.toggle('j1', j === 1);
    t.classList.toggle('j2', j >= 2);
  }

  /* ================= effects ================= */
  function fx(cls, css) { const d = document.createElement('div'); d.className = cls; if (css) d.style.cssText = css; fxEl.appendChild(d); return d; }
  function fxDone(d, ms) { setTimeout(() => d.remove(), ms); }
  function center(r, c) { return [(c + 0.5) * G.cell, (r + 0.5) * G.cell]; }

  function particles(r, c, color, n) {
    const [x, y] = center(r, c);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = G.cell * (0.5 + Math.random() * 0.6);
      const col = color === 'rainbow' ? RAINBOW[i % RAINBOW.length] : color;
      fxDone(fx('pt', `left:${x}px;top:${y}px;background:${col};box-shadow:0 0 0 2px rgba(255,255,255,.5);--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`), 600);
    }
  }
  function shards(r, c, what) {
    const [x, y] = center(r, c);
    const col = what === 'ice' ? '#e8f8ff' : '#9aa6b3';
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, d = G.cell * (0.4 + Math.random() * 0.5);
      fxDone(fx('shard', `left:${x}px;top:${y}px;background:${col};transform:rotate(${Math.random() * 90}deg);--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`), 550);
    }
  }
  function beam(dir, idx, color) {
    const pos = idx * G.cell;
    fxDone(fx('beam ' + dir, (dir === 'h' ? `top:${pos}px;` : `left:${pos}px;`) + `--c:${color}`), 450);
  }
  function ring(r, c, cells) {
    const [x, y] = center(r, c), s = G.cell * cells;
    fxDone(fx('ring', `left:${x}px;top:${y}px;width:${s}px;height:${s}px`), 520);
  }
  function zap(r1, c1, r2, c2) {
    const [x1, y1] = center(r1, c1), [x2, y2] = center(r2, c2);
    const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
    fxDone(fx('zap', `left:${x1}px;top:${y1}px;width:${len}px;transform:rotate(${ang}rad)`), 480);
  }
  function popup(text, r, c, color) {
    const [x, y] = center(r, c);
    const d = fx('popup', `left:${x}px;top:${y}px;--c:${color}`);
    d.textContent = text;
    fxDone(d, 950);
  }
  function banner(text, tone) {
    const old = document.querySelector('#boardWrap .banner'); if (old) old.remove();
    const b = document.createElement('div');
    b.className = 'banner ' + (tone || '');
    b.textContent = text;
    $('#boardWrap').appendChild(b);
    setTimeout(() => b.remove(), 1150);
  }
  function fxSpecial(s) {
    const col = s.p.color >= 0 ? COLORS[s.p.color] : '#fff';
    if (s.p.special === 'h') beam('h', s.r, col);
    else if (s.p.special === 'v') beam('v', s.c, col);
    else if (s.p.special === 'wrap') ring(s.r, s.c, 3.4);
    else if (s.p.special === 'bomb') {
      ring(s.r, s.c, 4);
      for (const [y, x] of (s.p.bombTargets || []).slice(0, 24)) zap(s.r, s.c, y, x);
    }
  }

  /* ================= animation hooks for the engine ================= */
  const CHEERS = ['Splash!', 'Tidal!', 'Fintastic!', 'Oceanic!'];
  const Anim = {
    async swap(p1, to1, p2, to2, revert) {
      const a = G.els.get(p1.id), b = G.els.get(p2.id);
      [a, b].forEach(el => el.style.setProperty('--t', '170ms'));
      a.style.zIndex = 3;
      setPos(a, to1.r, to1.c); setPos(b, to2.r, to2.c);
      if (revert) { Sound.bad(); buzz(25); } else Sound.swap();
      await wait(185);
      a.style.zIndex = '';
    },
    hud() { updateHUD(); },
    async clear(ev) {
      if (ev.removed.length || ev.changed.length || ev.jelly.length) Sound.pop(ev.cascade + ev.depth);
      for (const s of ev.specials) fxSpecial(s);
      if (ev.specials.length) { Sound.blast(); buzz(45); } else if (ev.removed.length) buzz(12);
      const many = ev.removed.length > 18;
      let sx = 0, sy = 0, sn = 0;
      for (const { p, r, c, rock } of ev.removed) {
        const el = G.els.get(p.id);
        if (el) { el.classList.remove('sel', 'hint'); el.classList.add('gone'); G.els.delete(p.id); setTimeout(() => el.remove(), 260); }
        if (rock) { shards(r, c, 'rock'); Sound.crack(); }
        else particles(r, c, p.color >= 0 ? COLORS[p.color] : 'rainbow', many ? 2 : 5);
        sx += r; sy += c; sn++;
      }
      for (const { p, r, c, what } of ev.changed) {
        const el = refreshEl(p);
        flashClass(el, 'hit', 260);
        shards(r, c, what);
        Sound.crack();
      }
      for (const [r, c] of ev.jelly) { updateTile(r, c); if (!sn) { sx += r; sy += c; } }
      if (!sn && ev.jelly.length) sn = ev.jelly.length;
      if (ev.points && sn) {
        const tone = ['#0a7fd0', '#d0408a', '#7a3ad0', '#e07a00', '#14a05a'][ev.cascade % 5];
        popup('+' + ev.points, sx / sn, sy / sn, tone);
      }
      if (ev.depth === 0 && ev.cascade >= 2 && ev.cascade > G.cheerMax && !G.E.over) {
        G.cheerMax = ev.cascade;
        banner(CHEERS[Math.min(ev.cascade, 5) - 2]);
      }
      updateHUD(ev);
      await wait(ev.specials.length ? 250 : 205);
    },
    async create(list) {
      for (const { p, r, c } of list) {
        const el = makeEl(p, r, c);
        flashClass(el, 'new', 360);
      }
      Sound.special(); buzz([18, 30, 18]);
      await wait(230);
    },
    async convert(list, bonus) {
      for (const { p } of list) flashClass(refreshEl(p), 'new', 360);
      if (bonus) { Sound.bubble(); updateHUD(); await wait(120); }
      else { Sound.special(); await wait(300); }
    },
    async fall(list) {
      for (const t of list) {
        let el = G.els.get(t.p.id);
        if (!el) el = makeEl(t.p, t.fr, t.fc);
        el.style.setProperty('--t', '0ms');
      }
      void piecesEl.offsetWidth;
      let max = 0;
      for (const t of list) {
        const el = G.els.get(t.p.id);
        const d = Math.hypot(t.tr - t.fr, t.tc - t.fc);
        const dur = Math.round(130 + 85 * Math.sqrt(d));
        max = Math.max(max, dur);
        el.style.setProperty('--t', dur + 'ms');
        setPos(el, t.tr, t.tc);
      }
      await wait(max + 15);
    },
    async combo(info) {
      const names = { cross: 'Crossfire!', bigcross: 'Riptide!', bigwrap: 'Bubble Burst!', rainbow: 'Rainbow!', bombbomb: 'Tsunami!' };
      banner(names[info.kind], 'blue');
      Sound.blast(); buzz([30, 40, 70]);
      const { r, c } = info;
      if (info.kind === 'cross') { beam('h', r, '#fff'); beam('v', c, '#fff'); }
      else if (info.kind === 'bigcross') { for (let d = -1; d <= 1; d++) { beam('h', r + d, '#8fe4ff'); beam('v', c + d, '#8fe4ff'); } }
      else if (info.kind === 'bigwrap') ring(r, c, 6);
      else if (info.kind === 'rainbow') { ring(r, c, 4); for (const [y, x] of info.targets.slice(0, 30)) zap(r, c, y, x); }
      else if (info.kind === 'bombbomb') fxDone(fx('flash'), 650);
      await wait(info.kind === 'rainbow' ? 420 : 280);
    },
    async shuffle() {
      banner('Shuffle!', 'blue');
      await wait(450);
      const E = G.E;
      E.forCells((r, c) => {
        const p = E.grid[r][c];
        const el = p && G.els.get(p.id);
        if (el) { el.style.setProperty('--t', '420ms'); setPos(el, r, c); }
      });
      Sound.swap();
      await wait(460);
    },
    async bonusStart() { banner('Tidal Bonus!', 'gold'); Sound.win(); await wait(900); }
  };

  /* ================= HUD ================= */
  const fmt = n => n.toLocaleString('en-US');
  function blockerKinds(L) {
    const s = L.layout.join('');
    return { rock: /[rR]/.test(s), ice: /[ikK]/.test(s) };
  }
  function goalIcon(g, L) {
    if (g.type === 'score') return `<svg class="gi" viewBox="0 0 24 24" fill="#ffd54a" stroke="#a25a00" stroke-width="1"><use href="#star"/></svg>`;
    if (g.type === 'collect') return `<svg class="gi" viewBox="0 0 100 100"><use href="#cr${g.color}"/></svg>`;
    if (g.type === 'jelly') return '<svg class="gi" viewBox="0 0 100 100"><use href="#coralico"/></svg>';
    const k = blockerKinds(L);
    if (k.rock && k.ice) return '<div class="gi-stack"><svg viewBox="0 0 100 100"><use href="#iceico"/></svg><svg viewBox="0 0 100 100"><use href="#rock1"/></svg></div>';
    return `<svg class="gi" viewBox="0 0 100 100"><use href="#${k.rock ? 'rock1' : 'iceico'}"/></svg>`;
  }
  function goalText(g, L) {
    if (g.type === 'score') return `Score ${fmt(g.target)} points`;
    if (g.type === 'collect') return `Collect ${g.count} ${NAMES[g.color]}`;
    if (g.type === 'jelly') return 'Clear all the coral';
    const k = blockerKinds(L);
    return 'Break all the ' + (k.rock && k.ice ? 'ice and rocks' : k.rock ? 'rocks' : 'ice');
  }
  function buildGoals() {
    const L = G.E.level;
    $('#goals').innerHTML = L.goals.map((g, i) => `<div class="goal" data-i="${i}">${goalIcon(g, L)}<div class="gn"></div><div class="tick">${ICON.tick}</div></div>`).join('');
    const bar = $('#bar');
    bar.querySelectorAll('.mk').forEach(m => m.remove());
    L.stars.forEach((s, i) => {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      m.setAttribute('viewBox', '0 0 24 24');
      m.setAttribute('class', 'mk');
      m.innerHTML = '<use href="#star"/>';
      m.style.left = Math.min(97, (s / L.stars[2]) * 100) + '%';
      m.dataset.i = i;
      bar.appendChild(m);
    });
    G.lastGoal = [];
  }
  function updateHUD() {
    const E = G.E; if (!E) return;
    const L = E.level;
    $('#movesN').textContent = Math.max(0, E.moves);
    $('#movesBox').classList.toggle('low', E.moves <= 5 && E.moves > 0 && !E.over);
    $('#scoreN').textContent = fmt(E.score);
    $('#barFill').style.width = Math.min(100, (E.score / L.stars[2]) * 100) + '%';
    document.querySelectorAll('#bar .mk').forEach(m => m.classList.toggle('on', E.score >= L.stars[+m.dataset.i]));
    document.querySelectorAll('#goals .goal').forEach(el => {
      const i = +el.dataset.i, g = L.goals[i], left = E.goalLeft(g);
      const txt = g.type === 'score' ? (left ? fmt(g.target) : '') : (left ? String(left) : '');
      const gn = el.querySelector('.gn');
      if (gn.textContent !== txt) gn.textContent = txt;
      if (G.lastGoal[i] !== undefined && G.lastGoal[i] !== left) flashClass(el, 'bump', 320);
      G.lastGoal[i] = left;
      el.classList.toggle('done', left === 0);
    });
  }

  /* ================= hints & selection ================= */
  function clearHint() { clearTimeout(G.hintTimer); piecesEl.querySelectorAll('.hint').forEach(e => e.classList.remove('hint')); }
  function armHint() {
    clearHint();
    if (!G.E || G.E.over) return;
    G.hintTimer = setTimeout(() => {
      if (G.busy || !G.E || G.E.over) return;
      const m = G.E.findMoves();
      if (!m.length) return;
      const [a, b] = m[Math.floor(Math.random() * m.length)];
      for (const s of [a, b]) { const p = G.E.grid[s.r][s.c]; const el = p && G.els.get(p.id); if (el) el.classList.add('hint'); }
    }, 5000);
  }
  function clearSel() { if (G.sel) { const p = G.E.grid[G.sel.r][G.sel.c]; const el = p && G.els.get(p.id); if (el) el.classList.remove('sel'); } G.sel = null; }

  /* ================= input: swipe or tap-tap ================= */
  let drag = null;
  function cellAt(e) {
    const rect = boardEl.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / G.cell), r = Math.floor((e.clientY - rect.top) / G.cell);
    return G.E && G.E.ok(r, c) ? { r, c } : null;
  }
  boardEl.addEventListener('pointerdown', e => {
    if (G.busy || !G.E || G.E.over) return;
    const cell = cellAt(e);
    if (!cell) return;
    e.preventDefault();
    drag = { cell, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
    try { boardEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    armHint();
  });
  boardEl.addEventListener('pointermove', e => {
    if (!drag || drag.moved || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < G.cell * 0.3) return;
    drag.moved = true;
    const t = Math.abs(dx) > Math.abs(dy) ? { r: drag.cell.r, c: drag.cell.c + Math.sign(dx) } : { r: drag.cell.r + Math.sign(dy), c: drag.cell.c };
    clearSel();
    tryMove(drag.cell, t);
  });
  boardEl.addEventListener('pointerup', e => {
    if (drag && !drag.moved && e.pointerId === drag.id) tap(drag.cell);
    drag = null;
  });
  boardEl.addEventListener('pointercancel', () => { drag = null; });
  boardEl.addEventListener('contextmenu', e => e.preventDefault());

  function nudge(cell) {
    const p = G.E.grid[cell.r][cell.c];
    flashClass(p && G.els.get(p.id), 'nope', 320);
    Sound.bad();
  }
  function tryMove(a, b) {
    if (!G.E.ok(b.r, b.c)) return;
    if (!G.E.canSwap(a, b)) { nudge(G.E.movable(G.E.grid[a.r][a.c]) ? b : a); return; }
    doMove(a, b);
  }
  function tap(cell) {
    const E = G.E, p = E.grid[cell.r][cell.c];
    if (G.sel) {
      const s = G.sel;
      if (s.r === cell.r && s.c === cell.c) { clearSel(); return; }
      if (Math.abs(s.r - cell.r) + Math.abs(s.c - cell.c) === 1) { clearSel(); tryMove(s, cell); return; }
    }
    clearSel();
    if (E.movable(p)) { G.sel = cell; G.els.get(p.id).classList.add('sel'); Sound.tick(); }
    else if (p) nudge(cell);
  }

  async function doMove(a, b) {
    if (G.busy || G.E.over) return;
    G.busy = true; clearHint(); G.cheerMax = 0;
    const E = G.E;
    let ok = false;
    try { ok = await E.move(a, b); } catch (err) { console.error(err); }
    if (E !== G.E) return;
    if (ok) {
      if (E.goalsMet()) {
        await wait(250);
        await E.bonus();
        updateHUD();
        await wait(500);
        if (E === G.E) showWin();
        return;
      }
      if (E.moves <= 0) {
        E.over = true;
        await wait(450);
        if (E === G.E) showLose();
        return;
      }
    }
    G.busy = false;
    armHint();
  }

  /* ================= screens ================= */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  }
  function startLevel(i) {
    closeModal();
    G.idx = i;
    G.E = new Engine(LEVELS[i], Anim);
    G.busy = false; G.sel = null;
    show('game');
    $('#lvlLabel').textContent = 'Level ' + (i + 1);
    buildGoals();
    layoutBoard();
    buildBoard();
    updateHUD();
    armHint();
  }
  function goMap() {
    clearHint();
    G.E = null;
    closeModal();
    show('map');
    buildMap();
  }

  function refreshToggles() {
    const s = Store.data.sound ? ICON.soundOn : ICON.soundOff;
    $('#mapSound').innerHTML = s; $('#gameSound').innerHTML = s;
    $('#mapVib').innerHTML = Store.data.haptics ? ICON.vibOn : ICON.vibOff;
    $('#mapSound').setAttribute('aria-pressed', Store.data.sound);
    $('#gameSound').setAttribute('aria-pressed', Store.data.sound);
    $('#mapVib').setAttribute('aria-pressed', Store.data.haptics);
  }
  function toggleSound() { Store.data.sound = !Store.data.sound; Store.save(); refreshToggles(); Sound.init(); Sound.tick(); }
  $('#mapSound').addEventListener('click', toggleSound);
  $('#gameSound').addEventListener('click', toggleSound);
  $('#mapVib').addEventListener('click', () => { Store.data.haptics = !Store.data.haptics; Store.save(); refreshToggles(); buzz(40); });
  $('#backBtn').innerHTML = ICON.back;
  $('#backBtn').addEventListener('click', () => {
    if (G.busy) return;
    modal(`<div class="card-title">Leave level?</div><div class="card-sub">Your progress on this level will be lost.</div>
      <div class="btns"><button class="btn ghost" data-act="map">Leave</button><button class="btn" data-act="close">Keep playing</button></div>`);
  });
  refreshToggles();

  /* ================= map ================= */
  function buildMap() {
    const host = $('#mapPath');
    const W = Math.min($('#mapScroll').clientWidth, 520);
    const gap = 104, top = 70;
    const pts = LEVELS.map((_, i) => ({ x: W / 2 + Math.sin(i * 0.82) * W * 0.27, y: top + i * gap }));
    const H = top + (LEVELS.length - 1) * gap + 70;
    host.style.width = W + 'px';
    host.style.height = H + 'px';
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      d += ` C${a.x.toFixed(1)} ${a.y + gap / 2} ${b.x.toFixed(1)} ${b.y - gap / 2} ${b.x.toFixed(1)} ${b.y}`;
    }
    const earned = Math.min(Store.data.unlocked, LEVELS.length);
    const unlocked = Store.data.unlockAll ? LEVELS.length : earned;
    let html = `<svg class="trail" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <path d="${d}" fill="none" stroke="rgba(0,30,70,.28)" stroke-width="18" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="rgba(255,240,200,.75)" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 14"/></svg>`;
    // decorations along the trail
    for (let i = 0; i < LEVELS.length; i += 2) {
      const p = pts[i], side = p.x > W / 2 ? -1 : 1;
      const x = Math.max(4, Math.min(W - 48, p.x + side * W * 0.3 - 22));
      if (i % 4 === 0) html += `<svg class="decor" viewBox="0 0 40 100" style="left:${x + 10}px;top:${p.y - 10}px;width:24px;height:60px;animation-delay:${-i}s"><use href="#weed"/></svg>`;
      else html += `<svg class="decor" viewBox="0 0 100 100" style="left:${x}px;top:${p.y + 16}px;animation-delay:${-i * 0.7}s"><use href="#cr${(i / 2) % 6}"/></svg>`;
    }
    LEVELS.forEach((_, i) => {
      const p = pts[i], st = Store.data.stars[i] || 0;
      const locked = i + 1 > unlocked, current = i + 1 === earned && !st;
      const cls = 'node' + (locked ? ' locked' : st ? ' done' : '') + (current ? ' current' : '');
      const stars = locked ? '' : `<div class="nstars">${[0, 1, 2].map(k => starSVG(k < st ? 'on' : '')).join('')}</div>`;
      html += `<button class="${cls}" data-lvl="${i}" style="left:${p.x}px;top:${p.y}px" aria-label="Level ${i + 1}${locked ? ' (locked)' : ''}">${locked ? ICON.lock : i + 1}${stars}</button>`;
    });
    host.innerHTML = html;
    $('#starTotal').textContent = `${Store.data.stars.reduce((a, b) => a + (b || 0), 0)} / ${LEVELS.length * 3}`;
    const cur = pts[earned - 1];
    const ua = $('#unlockAll');
    ua.classList.toggle('on', !!Store.data.unlockAll);
    ua.setAttribute('aria-checked', !!Store.data.unlockAll);
    const sc = $('#mapScroll');
    sc.scrollTop = Math.max(0, cur.y - sc.clientHeight / 2);
  }
  $('#mapPath').addEventListener('click', e => {
    const n = e.target.closest('.node');
    if (!n) return;
    const i = +n.dataset.lvl;
    if (!Store.data.unlockAll && i + 1 > Store.data.unlocked) { flashClass(n, 'nope', 300); Sound.bad(); buzz(25); return; }
    Sound.tick();
    showIntro(i);
  });
  $('#unlockAll').addEventListener('click', () => {
    Store.data.unlockAll = !Store.data.unlockAll; Store.save(); Sound.tick(); buildMap();
  });
  $('#resetBtn').addEventListener('click', () => {
    modal(`<div class="card-title">Reset progress?</div><div class="card-sub">This clears all stars and locks every level except the first.</div>
      <div class="btns"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="reset">Reset</button></div>`);
  });

  /* ================= modals ================= */
  function modal(html) { $('#card').innerHTML = html; $('#modal').classList.remove('hidden'); }
  function closeModal() { $('#modal').classList.add('hidden'); }

  const TIP_ART = {
    swipe: () => demo({ color: 0 }) + ICON.swap + demo({ color: 1 }),
    collect: () => demo({ color: 0 }) + demo({ color: 1 }),
    h: () => demo({ color: 2, special: 'h' }) + demo({ color: 3, special: 'v' }),
    wrap: () => demo({ color: 4, special: 'wrap' }),
    bomb: () => demo({ color: -1, special: 'bomb' }),
    coral: () => demo({ color: 3 }, 'coral'),
    coral2: () => demo({ color: 2 }, 'coral2'),
    ice: () => demo({ color: 3, ice: 1 }),
    rock: () => demo({ rock: 1, color: -1 }),
    rock2: () => demo({ rock: 2, color: -1 }),
    six: () => demo({ color: 5 })
  };
  function showIntro(i) {
    const L = LEVELS[i];
    const tip = L.tip ? `<div class="tip"><div class="tip-art">${TIP_ART[L.tip.kind]()}</div><div><b>${L.tip.title}</b><span>${L.tip.text}</span></div></div>` : '';
    const best = Store.data.best[i] ? `<div class="best">Best ${fmt(Store.data.best[i])}</div>` : '';
    modal(`<div class="card-title">Level ${i + 1}</div>
      <div class="goal-list">${L.goals.map(g => `<div class="goal-row">${goalIcon(g, L)}<b>${goalText(g, L)}</b></div>`).join('')}</div>
      <div class="moves-pill">${L.moves} moves</div>${best}
      ${tip}
      <div class="btns"><button class="btn ghost" data-act="close">Back</button><button class="btn" data-act="play" data-i="${i}">Play</button></div>`);
  }
  function showWin() {
    const E = G.E, i = G.idx, stars = E.starsEarned();
    const d = Store.data;
    const newBest = E.score > (d.best[i] || 0);
    d.stars[i] = Math.max(d.stars[i] || 0, stars);
    d.best[i] = Math.max(d.best[i] || 0, E.score);
    d.unlocked = Math.max(d.unlocked, Math.min(i + 2, LEVELS.length));
    Store.save();
    const last = i === LEVELS.length - 1;
    const title = last ? 'Reef champion!' : ['Level complete!', 'Great swimming!', 'Fin-tastic!'][stars - 1];
    modal(`<div class="card-title">${title}</div>
      <div class="big-stars">${[0, 1, 2].map(k => `<svg class="${k < stars ? 'on' : ''}" style="--d:${0.25 + k * 0.35}s" viewBox="0 0 24 24"><use href="#star"/></svg>`).join('')}</div>
      <div class="final-score">${fmt(E.score)}</div>
      <div class="best">${newBest ? 'New best score!' : 'Best ' + fmt(d.best[i])}</div>
      ${last ? '<div class="card-sub" style="margin-top:10px">You have cleared all 20 levels of the reef.</div>' : ''}
      <div class="btns"><button class="btn ghost" data-act="replay">Replay</button>${last ? '<button class="btn" data-act="map">Map</button>' : '<button class="btn" data-act="next">Next</button>'}</div>
      ${last ? '' : '<div class="btns" style="margin-top:10px"><button class="link-btn" style="color:#3c6688" data-act="map">Back to map</button></div>'}`);
    for (let k = 0; k < stars; k++) setTimeout(() => { Sound.star(k); buzz(30); }, 250 + k * 350 + 120);
  }
  function showLose() {
    const E = G.E, L = E.level;
    Sound.lose(); buzz([60, 60, 60]);
    const rows = L.goals.map(g => {
      const left = E.goalLeft(g);
      const note = left ? (g.type === 'score' ? fmt(left) + ' to go' : left + ' left') : '';
      return `<div class="goal-row ${left ? 'left' : ''}">${goalIcon(g, L)}<b data-left="${note}">${left ? goalText(g, L) : '✓ ' + goalText(g, L)}</b></div>`;
    }).join('');
    modal(`<div class="card-title">Out of moves!</div><div class="card-sub">So close. Here's what was left:</div>
      <div class="goal-list">${rows}</div>
      <div class="btns"><button class="btn ghost" data-act="map">Map</button><button class="btn" data-act="replay">Try again</button></div>`);
  }
  $('#card').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    Sound.tick();
    if (act === 'close') closeModal();
    else if (act === 'play') startLevel(+b.dataset.i);
    else if (act === 'replay') startLevel(G.idx);
    else if (act === 'next') { closeModal(); goMap(); showIntro(Math.min(G.idx + 1, LEVELS.length - 1)); }
    else if (act === 'map') goMap();
    else if (act === 'reset') { Store.data.unlocked = 1; Store.data.stars = []; Store.data.best = []; Store.save(); closeModal(); buildMap(); }
  });

  /* ================= resize ================= */
  let rz = 0;
  function onResize() {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if ($('#game').classList.contains('active')) layoutBoard();
      else buildMap();
    }, 80);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // Small API for pwa.js (install prompts and update toasts).
  window.ReefUI = { modal, closeModal, tick: () => Sound.tick() };

  buildMap();
  if (Store.data.unlocked === 1 && !Store.data.stars[0]) showIntro(0);
})();
