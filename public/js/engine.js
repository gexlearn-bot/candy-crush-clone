/* Reef Crush — game engine (no DOM). Works in browser and Node. */
(function (root) {
  'use strict';

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SPECIAL_BONUS = { h: 60, v: 60, wrap: 120, bomb: 200 };

  class Engine {
    constructor(level, anim, rand) {
      this.level = level;
      this.anim = anim || {};
      this.rand = rand || Math.random;
      const L = level.layout;
      this.rows = L.length;
      this.cols = L[0].length;
      this.nColors = level.colors;
      this.grid = [];
      this.jelly = [];
      this.voidc = [];
      this.nextId = 1;
      this.score = 0;
      this.moves = level.moves;
      this.over = false;
      this.collected = [0, 0, 0, 0, 0, 0];
      this.jellyLeft = 0;
      this.blockersLeft = 0;

      for (let r = 0; r < this.rows; r++) {
        this.grid.push([]); this.jelly.push([]); this.voidc.push([]);
        for (let c = 0; c < this.cols; c++) {
          const ch = L[r][c];
          this.voidc[r].push(ch === '#');
          let j = 0;
          if (ch === 'j' || ch === 'k') j = 1;
          if (ch === 'J' || ch === 'K') j = 2;
          this.jelly[r].push(j);
          if (j) this.jellyLeft++;
          let p = null;
          if (ch === 'r' || ch === 'R') { p = this.mkRock(ch === 'R' ? 2 : 1); this.blockersLeft++; }
          this.grid[r].push(p);
        }
      }
      this.fillInitial();
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        if ('ikK'.includes(L[r][c])) { this.grid[r][c].ice = 1; this.blockersLeft++; }
      }
      this.jellyTotal = this.jellyLeft;
      this.blockersTotal = this.blockersLeft;
      if (!this.findMoves().length) this.shuffleSync();
    }

    /* ---------- helpers ---------- */
    call(name, ...args) { const f = this.anim[name]; return f ? f.apply(this.anim, args) : undefined; }
    mkPiece(color, special) { return { id: this.nextId++, color, special: special || null, ice: 0, rock: 0 }; }
    mkRock(hp) { return { id: this.nextId++, color: -1, special: null, ice: 0, rock: hp }; }
    ok(r, c) { return r >= 0 && c >= 0 && r < this.rows && c < this.cols && !this.voidc[r][c]; }
    at(r, c) { return this.ok(r, c) ? this.grid[r][c] : null; }
    isM(p) { return !!p && !p.rock && p.color >= 0; }
    movable(p) { return !!p && !p.rock && !p.ice; }
    same(r, c, col) { const q = this.at(r, c); return this.isM(q) && q.color === col; }
    randColor(ex) {
      const opts = [];
      for (let i = 0; i < this.nColors; i++) if (!ex || !ex.has(i)) opts.push(i);
      return opts[Math.floor(this.rand() * opts.length)];
    }
    forCells(fn) { for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.ok(r, c)) fn(r, c); }

    fillInitial() {
      this.forCells((r, c) => {
        if (this.grid[r][c]) return;
        const ex = new Set();
        const a = this.at(r, c - 1), b = this.at(r, c - 2);
        if (this.isM(a) && this.isM(b) && a.color === b.color) ex.add(a.color);
        const u = this.at(r - 1, c), v = this.at(r - 2, c);
        if (this.isM(u) && this.isM(v) && u.color === v.color) ex.add(u.color);
        this.grid[r][c] = this.mkPiece(this.randColor(ex));
      });
    }

    /* ---------- matching ---------- */
    matchAt(r, c) {
      const p = this.at(r, c);
      if (!this.isM(p)) return false;
      let n = 1;
      for (let x = c - 1; this.same(r, x, p.color); x--) n++;
      for (let x = c + 1; this.same(r, x, p.color); x++) n++;
      if (n >= 3) return true;
      n = 1;
      for (let y = r - 1; this.same(y, c, p.color); y--) n++;
      for (let y = r + 1; this.same(y, c, p.color); y++) n++;
      return n >= 3;
    }

    findGroups() {
      const runs = [];
      for (let r = 0; r < this.rows; r++) {
        let c = 0;
        while (c < this.cols) {
          const p = this.at(r, c);
          if (!this.isM(p)) { c++; continue; }
          let e = c + 1;
          while (e < this.cols && this.same(r, e, p.color)) e++;
          if (e - c >= 3) { const cells = []; for (let x = c; x < e; x++) cells.push([r, x]); runs.push({ dir: 'h', cells }); }
          c = e;
        }
      }
      for (let c = 0; c < this.cols; c++) {
        let r = 0;
        while (r < this.rows) {
          const p = this.at(r, c);
          if (!this.isM(p)) { r++; continue; }
          let e = r + 1;
          while (e < this.rows && this.same(e, c, p.color)) e++;
          if (e - r >= 3) { const cells = []; for (let y = r; y < e; y++) cells.push([y, c]); runs.push({ dir: 'v', cells }); }
          r = e;
        }
      }
      const owner = new Map();
      const groups = [];
      for (const run of runs) {
        let g = null;
        for (const [r, c] of run.cells) {
          const og = owner.get(r * this.cols + c);
          if (og && og !== g) {
            if (!g) g = og;
            else {
              for (const rr of og.runs) g.runs.push(rr);
              for (const kk of og.keys) { g.keys.add(kk); owner.set(kk, g); }
              groups.splice(groups.indexOf(og), 1);
            }
          }
        }
        if (!g) { g = { runs: [], keys: new Set() }; groups.push(g); }
        g.runs.push(run);
        for (const [r, c] of run.cells) { const k = r * this.cols + c; g.keys.add(k); owner.set(k, g); }
      }
      return groups;
    }

    analyze(g, swapCells) {
      let maxLen = 0, maxRun = null, hasH = false, hasV = false;
      for (const run of g.runs) {
        if (run.cells.length > maxLen) { maxLen = run.cells.length; maxRun = run; }
        if (run.dir === 'h') hasH = true; else hasV = true;
      }
      let type = null;
      if (maxLen >= 5) type = 'bomb';
      else if (hasH && hasV) type = 'wrap';
      else if (maxLen === 4) type = maxRun.dir === 'h' ? 'v' : 'h';
      const cells = [...g.keys].map(k => [Math.floor(k / this.cols), k % this.cols]);
      const color = this.grid[cells[0][0]][cells[0][1]].color;
      let pos = null;
      if (type) {
        const okCell = (r, c) => { const p = this.grid[r][c]; return p && !p.special && !p.ice; };
        if (swapCells) for (const s of swapCells) {
          if (g.keys.has(s.r * this.cols + s.c) && okCell(s.r, s.c)) { pos = [s.r, s.c]; break; }
        }
        if (!pos && type === 'wrap') {
          const count = new Map();
          for (const run of g.runs) for (const [r, c] of run.cells) { const k = r * this.cols + c; count.set(k, (count.get(k) || 0) + 1); }
          for (const [k, n] of count) if (n > 1) {
            const r = Math.floor(k / this.cols), c = k % this.cols;
            if (okCell(r, c)) { pos = [r, c]; break; }
          }
        }
        if (!pos) { const mid = maxRun.cells[Math.floor(maxRun.cells.length / 2)]; if (okCell(mid[0], mid[1])) pos = mid; }
        if (!pos) for (const [r, c] of cells) if (okCell(r, c)) { pos = [r, c]; break; }
        if (!pos) type = null;
      }
      return { cells, type, pos, color };
    }

    /* ---------- moves ---------- */
    canSwap(a, b) {
      if (!this.ok(a.r, a.c) || !this.ok(b.r, b.c)) return false;
      if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return false;
      return this.movable(this.grid[a.r][a.c]) && this.movable(this.grid[b.r][b.c]);
    }

    findMoves() {
      const list = [];
      this.forCells((r, c) => {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (!this.ok(r2, c2)) continue;
          const p = this.grid[r][c], q = this.grid[r2][c2];
          if (!this.movable(p) || !this.movable(q)) continue;
          if (p.special === 'bomb' || q.special === 'bomb' || (p.special && q.special)) { list.push([{ r, c }, { r: r2, c: c2 }]); continue; }
          this.grid[r][c] = q; this.grid[r2][c2] = p;
          const m = this.matchAt(r, c) || this.matchAt(r2, c2);
          this.grid[r][c] = p; this.grid[r2][c2] = q;
          if (m) list.push([{ r, c }, { r: r2, c: c2 }]);
        }
      });
      return list;
    }

    async move(a, b) {
      if (this.over || !this.canSwap(a, b)) return false;
      const pa = this.grid[a.r][a.c], pb = this.grid[b.r][b.c];
      this.grid[a.r][a.c] = pb; this.grid[b.r][b.c] = pa;
      await this.call('swap', pa, b, pb, a, false);
      let hits = null;
      if (pa.special === 'bomb' || pb.special === 'bomb' || (pa.special && pb.special)) {
        hits = await this.comboHits(pa, b, pb, a);
      } else if (!this.matchAt(a.r, a.c) && !this.matchAt(b.r, b.c)) {
        this.grid[a.r][a.c] = pa; this.grid[b.r][b.c] = pb;
        await this.call('swap', pa, a, pb, b, true);
        return false;
      }
      this.moves--;
      await this.call('hud');
      await this.resolve([a, b], hits);
      await this.ensureMoves();
      return true;
    }

    /* pa now sits at posA (the cell the player dragged it onto) */
    async comboHits(pa, posA, pb, posB) {
      const out = [];
      const all = fn => this.forCells((r, c) => { if (fn(r, c)) out.push([r, c]); });
      const sa = pa.special, sb = pb.special;
      if (sa === 'bomb' && sb === 'bomb') {
        pa.special = pb.special = null;
        await this.call('combo', { kind: 'bombbomb', r: posA.r, c: posA.c });
        all(() => true);
        return out;
      }
      if (sa === 'bomb' || sb === 'bomb') {
        const [bomb, bp, other] = sa === 'bomb' ? [pa, posA, pb] : [pb, posB, pa];
        bomb.special = null;
        const color = other.color, kind = other.special;
        all((r, c) => { const q = this.grid[r][c]; return this.isM(q) && q.color === color; });
        if (kind) {
          const conv = [];
          for (const [r, c] of out) {
            const q = this.grid[r][c];
            if (!q.special && !q.ice) { q.special = kind === 'wrap' ? 'wrap' : (this.rand() < 0.5 ? 'h' : 'v'); conv.push({ p: q, r, c }); }
          }
          if (conv.length) await this.call('convert', conv, false);
        }
        await this.call('combo', { kind: 'rainbow', r: bp.r, c: bp.c, targets: out.slice(), color });
        out.push([bp.r, bp.c]);
        return out;
      }
      pa.special = null; pb.special = null;
      const { r, c } = posA;
      const striped = s => s === 'h' || s === 'v';
      let kind;
      if (striped(sa) && striped(sb)) {
        kind = 'cross';
        for (let x = 0; x < this.cols; x++) out.push([r, x]);
        for (let y = 0; y < this.rows; y++) out.push([y, c]);
      } else if (sa === 'wrap' && sb === 'wrap') {
        kind = 'bigwrap';
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) out.push([r + dy, c + dx]);
      } else {
        kind = 'bigcross';
        for (let d = -1; d <= 1; d++) {
          for (let x = 0; x < this.cols; x++) out.push([r + d, x]);
          for (let y = 0; y < this.rows; y++) out.push([y, c + d]);
        }
      }
      await this.call('combo', { kind, r, c });
      out.push([posB.r, posB.c]);
      return out;
    }

    /* ---------- resolution ---------- */
    async resolve(swapCells, initialHits) {
      let cascade = 0;
      while (cascade < 60) {
        let hits, matchCells = null;
        const creates = [];
        if (initialHits) { hits = initialHits; initialHits = null; }
        else {
          const groups = this.findGroups();
          if (!groups.length) break;
          hits = [];
          for (const g of groups) {
            const info = this.analyze(g, cascade === 0 ? swapCells : null);
            for (const cell of info.cells) hits.push(cell);
            if (info.type) creates.push(info);
          }
          matchCells = hits.slice();
        }
        await this.blast(hits, matchCells, cascade);
        const made = [];
        for (const cr of creates) {
          const [r, c] = cr.pos;
          if (this.grid[r][c]) continue;
          const p = this.mkPiece(cr.type === 'bomb' ? -1 : cr.color, cr.type);
          this.grid[r][c] = p;
          this.score += SPECIAL_BONUS[cr.type];
          made.push({ p, r, c });
        }
        if (made.length) await this.call('create', made);
        await this.settle();
        cascade++;
      }
    }

    async blast(cells, matchCells, cascade) {
      const mult = cascade + 1;
      let layer = cells, depth = 0;
      while (layer.length && depth < 40) {
        const ev = { removed: [], specials: [], changed: [], jelly: [], points: 0, cascade, depth };
        const seen = new Set();
        const next = [];
        if (depth === 0 && matchCells) {
          const rocks = new Set();
          for (const [r, c] of matchCells) for (const [dr, dc] of DIRS) {
            const q = this.at(r + dr, c + dc);
            if (q && q.rock) rocks.add((r + dr) * this.cols + (c + dc));
          }
          for (const k of rocks) this.hitRock(Math.floor(k / this.cols), k % this.cols, ev);
        }
        for (const [r, c] of layer) {
          if (!this.ok(r, c)) continue;
          const k = r * this.cols + c;
          if (seen.has(k)) continue;
          seen.add(k);
          const p = this.grid[r][c];
          if (p && p.rock) { this.hitRock(r, c, ev); continue; }
          if (p && p.ice) {
            p.ice = 0; this.blockersLeft--; ev.points += 50;
            ev.changed.push({ p, r, c, what: 'ice' });
            this.hitJelly(r, c, ev);
            continue;
          }
          this.hitJelly(r, c, ev);
          if (!p) continue;
          this.grid[r][c] = null;
          if (p.color >= 0) this.collected[p.color]++;
          ev.points += 20 * mult;
          ev.removed.push({ p, r, c });
          if (p.special) {
            ev.specials.push({ p, r, c });
            for (const cell of this.specialCells(p, r, c)) next.push(cell);
          }
        }
        this.score += ev.points;
        await this.call('clear', ev);
        layer = next;
        depth++;
      }
    }

    hitRock(r, c, ev) {
      const p = this.grid[r][c];
      if (!p || !p.rock) return;
      p.rock--; ev.points += 50;
      if (p.rock <= 0) { this.grid[r][c] = null; this.blockersLeft--; ev.removed.push({ p, r, c, rock: true }); }
      else ev.changed.push({ p, r, c, what: 'rock' });
    }

    hitJelly(r, c, ev) {
      if (this.jelly[r][c] > 0) {
        this.jelly[r][c]--; ev.points += 50;
        if (this.jelly[r][c] === 0) this.jellyLeft--;
        ev.jelly.push([r, c, this.jelly[r][c]]);
      }
    }

    commonColor() {
      const n = new Array(this.nColors).fill(0);
      this.forCells((r, c) => { const q = this.grid[r][c]; if (this.isM(q)) n[q.color]++; });
      let best = -1, bn = 0;
      for (let i = 0; i < n.length; i++) if (n[i] > bn) { bn = n[i]; best = i; }
      return best;
    }

    specialCells(p, r, c) {
      const out = [];
      if (p.special === 'h') { for (let x = 0; x < this.cols; x++) if (x !== c) out.push([r, x]); }
      else if (p.special === 'v') { for (let y = 0; y < this.rows; y++) if (y !== r) out.push([y, c]); }
      else if (p.special === 'wrap') { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dy || dx) out.push([r + dy, c + dx]); }
      else if (p.special === 'bomb') {
        const col = this.commonColor();
        p.bombColor = col;
        p.bombTargets = [];
        if (col >= 0) this.forCells((y, x) => { if (this.same(y, x, col)) { out.push([y, x]); p.bombTargets.push([y, x]); } });
      }
      return out;
    }

    async settle() {
      const track = new Map();
      const spawnN = new Array(this.cols).fill(0);
      const mv = (p, fr, fc, tr, tc, spawn) => {
        let t = track.get(p.id);
        if (!t) { t = { p, fr, fc, spawn: !!spawn }; track.set(p.id, t); }
        t.tr = tr; t.tc = tc;
      };
      let guard = 0;
      while (guard++ < 500) {
        let changed = false;
        for (let c = 0; c < this.cols; c++) {
          for (let r = this.rows - 1; r >= 0; r--) {
            if (!this.ok(r, c) || this.grid[r][c]) continue;
            let rr = r - 1;
            while (rr >= 0 && (this.voidc[rr][c] || !this.grid[rr][c])) rr--;
            if (rr >= 0) {
              const p = this.grid[rr][c];
              if (this.movable(p)) { this.grid[r][c] = p; this.grid[rr][c] = null; mv(p, rr, c, r, c); changed = true; }
            } else {
              const p = this.mkPiece(this.randColor());
              spawnN[c]++;
              this.grid[r][c] = p;
              mv(p, -spawnN[c], c, r, c, true);
              changed = true;
            }
          }
        }
        if (!changed) {
          outer:
          for (let r = this.rows - 1; r > 0; r--) for (let c = 0; c < this.cols; c++) {
            if (!this.ok(r, c) || this.grid[r][c]) continue;
            const order = this.rand() < 0.5 ? [-1, 1] : [1, -1];
            for (const dc of order) {
              const sr = r - 1, sc = c + dc;
              if (!this.ok(sr, sc)) continue;
              const p = this.grid[sr][sc];
              if (!this.movable(p)) continue;
              this.grid[r][c] = p; this.grid[sr][sc] = null;
              mv(p, sr, sc, r, c);
              changed = true;
              break outer;
            }
          }
        }
        if (!changed) break;
      }
      const list = [...track.values()];
      if (list.length) await this.call('fall', list);
    }

    shuffleSync() {
      const cells = [], pieces = [];
      this.forCells((r, c) => { const p = this.grid[r][c]; if (this.movable(p)) { cells.push([r, c]); pieces.push(p); } });
      for (let t = 0; t < 400; t++) {
        for (let i = pieces.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
        cells.forEach(([r, c], i) => { this.grid[r][c] = pieces[i]; });
        if (!this.findGroups().length && this.findMoves().length) return true;
        if (t > 60) for (const p of pieces) if (!p.special) p.color = Math.floor(this.rand() * this.nColors);
      }
      return false;
    }

    async ensureMoves() {
      let n = 0;
      while (!this.findMoves().length && n++ < 5) {
        this.shuffleSync();
        await this.call('shuffle');
        if (this.findGroups().length) await this.resolve(null, null);
      }
    }

    /* ---------- goals ---------- */
    goalLeft(g) {
      switch (g.type) {
        case 'score': return Math.max(0, g.target - this.score);
        case 'collect': return Math.max(0, g.count - this.collected[g.color]);
        case 'jelly': return this.jellyLeft;
        case 'blockers': return this.blockersLeft;
      }
      return 0;
    }
    goalsMet() { return this.level.goals.every(g => this.goalLeft(g) === 0); }
    starsEarned() { const s = this.level.stars; return this.score >= s[2] ? 3 : this.score >= s[1] ? 2 : 1; }

    async bonus() {
      this.over = true;
      if (this.moves > 0) await this.call('bonusStart');
      while (this.moves > 0) {
        const cand = [];
        this.forCells((r, c) => { const q = this.grid[r][c]; if (this.isM(q) && !q.special && !q.ice) cand.push({ p: q, r, c }); });
        if (!cand.length) break;
        const pick = cand[Math.floor(this.rand() * cand.length)];
        pick.p.special = this.rand() < 0.5 ? 'h' : 'v';
        this.moves--;
        this.score += 100;
        await this.call('convert', [pick], true);
      }
      for (let i = 0; i < 12; i++) {
        const sp = [];
        this.forCells((r, c) => { const q = this.grid[r][c]; if (q && q.special && !q.ice) sp.push([r, c]); });
        if (!sp.length) break;
        await this.resolve(null, sp);
      }
    }

    clone() {
      const e = Object.create(Engine.prototype);
      Object.assign(e, this);
      e.anim = {};
      e.grid = this.grid.map(row => row.map(p => (p ? Object.assign({}, p) : null)));
      e.jelly = this.jelly.map(r => r.slice());
      e.collected = this.collected.slice();
      return e;
    }
  }

  const api = { Engine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReefEngine = api;
})(this);
