// Balance check: a greedy bot plays each level and reports win rate and star spread.
// Run: npm run balance   (optional args: runs per level, comma-separated level numbers)
const { Engine } = require('../public/js/engine.js');
const LEVELS = require('../public/js/levels.js');

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function check(E, where) {
  // invariants: no ghost ids, counters agree with board
  let jl = 0, bl = 0; const ids = new Set();
  E.forCells((r, c) => {
    if (E.jelly[r][c] > 0) jl++;
    const p = E.grid[r][c];
    if (p) { if (ids.has(p.id)) throw new Error(where + ' dup id'); ids.add(p.id); if (p.rock || p.ice) bl++; }
  });
  if (jl !== E.jellyLeft) throw new Error(`${where} jelly ${jl} vs ${E.jellyLeft}`);
  if (bl !== E.blockersLeft) throw new Error(`${where} blockers ${bl} vs ${E.blockersLeft}`);
}

function deficit(E) {
  let d = 0;
  for (const g of E.level.goals) {
    const left = E.goalLeft(g);
    const tot = g.type === 'score' ? g.target : g.type === 'collect' ? g.count : g.type === 'jelly' ? E.jellyTotal : E.blockersTotal;
    d += tot ? left / tot : 0;
  }
  return d;
}

async function play(li, seed, mode) {
  const L = LEVELS[li];
  const R = rng(seed);
  const E = new Engine(L, null, R);
  check(E, 'init');
  let empties = 0;
  while (!E.goalsMet() && E.moves > 0) {
    const moves = E.findMoves();
    if (!moves.length) throw new Error('no moves after ensureMoves');
    let pick;
    if (mode === 'random') pick = moves[Math.floor(R() * moves.length)];
    else {
      let best = -1e9;
      for (const m of moves) {
        const C = E.clone();
        await C.move(m[0], m[1]);
        const v = (deficit(E) - deficit(C)) * 100 + (C.score - E.score) * 0.002 + R() * 0.01;
        if (v > best) { best = v; pick = m; }
      }
    }
    const ok = await E.move(pick[0], pick[1]);
    if (!ok) throw new Error('move rejected');
    check(E, 'after move');
    // empty playable cells should not persist
    E.forCells((r, c) => { if (!E.grid[r][c]) empties++; });
  }
  const won = E.goalsMet();
  if (won) { await E.bonus(); check(E, 'bonus'); }
  return { won, score: E.score, stars: won ? E.starsEarned() : 0, movesLeftAtWin: 0, empties };
}

(async () => {
  const runs = +process.argv[2] || 12;
  const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
  for (let li = 0; li < LEVELS.length; li++) {
    if (only && !only.includes(li + 1)) continue;
    let wins = 0, scores = [], stars = [0, 0, 0, 0], empties = 0;
    for (let s = 0; s < runs; s++) {
      const r = await play(li, 1000 * li + s, 'greedy');
      if (r.won) wins++;
      scores.push(r.score); stars[r.stars]++; empties += r.empties;
    }
    scores.sort((a, b) => a - b);
    const med = scores[Math.floor(scores.length / 2)];
    console.log(`L${String(li + 1).padStart(2)} win ${(wins / runs * 100).toFixed(0).padStart(3)}%  median ${String(med).padStart(6)}  stars0/1/2/3 ${stars.join('/')}  emptyCells ${empties}`);
  }
})().catch(e => { console.error('FAIL', e); process.exit(1); });
