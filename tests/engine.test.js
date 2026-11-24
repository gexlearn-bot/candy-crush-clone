// Headless tests for the Reef Crush engine and PWA wiring. Run: npm test
// Plays every level start-to-finish with a seeded random player and checks the board stays consistent.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Engine } = require('../public/js/engine.js');
const LEVELS = require('../public/js/levels.js');

const PUBLIC = path.join(__dirname, '..', 'public');

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function checkBoard(E, where) {
  let jelly = 0, blockers = 0;
  const ids = new Set();
  E.forCells((r, c) => {
    if (E.jelly[r][c] > 0) jelly++;
    const p = E.grid[r][c];
    assert.ok(p, `${where}: empty cell at ${r},${c}`);
    assert.ok(!ids.has(p.id), `${where}: duplicate piece id`);
    ids.add(p.id);
    if (p.rock || p.ice) blockers++;
  });
  assert.equal(jelly, E.jellyLeft, `${where}: coral counter out of sync`);
  assert.equal(blockers, E.blockersLeft, `${where}: blocker counter out of sync`);
  assert.equal(E.findGroups().length, 0, `${where}: unresolved matches left on board`);
  assert.ok(E.findMoves().length > 0, `${where}: no valid moves left`);
}

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (e) { failures++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

(async () => {
  await test('20 levels, each with valid layout and goals', () => {
    assert.equal(LEVELS.length, 20);
    for (const [i, L] of LEVELS.entries()) {
      assert.equal(L.layout.length, 8, `level ${i + 1} rows`);
      for (const row of L.layout) assert.match(row, /^[.#jJikKrR]{8}$/, `level ${i + 1} row "${row}"`);
      assert.ok(L.goals.length > 0 && L.moves > 0, `level ${i + 1} goals/moves`);
      assert.ok(L.stars[0] <= L.stars[1] && L.stars[1] <= L.stars[2], `level ${i + 1} star thresholds`);
    }
  });

  for (const [i, L] of LEVELS.entries()) {
    await test(`level ${i + 1} plays to the end without breaking the board`, async () => {
      for (let seed = 0; seed < 3; seed++) {
        const R = rng(i * 100 + seed);
        const E = new Engine(L, null, R);
        checkBoard(E, 'start');
        while (!E.goalsMet() && E.moves > 0) {
          const moves = E.findMoves();
          const [a, b] = moves[Math.floor(R() * moves.length)];
          assert.equal(await E.move(a, b), true, 'valid move rejected');
          checkBoard(E, `after move (${E.moves} left)`);
        }
        if (E.goalsMet()) {
          await E.bonus();
          assert.equal(E.moves, 0);
          assert.ok(E.starsEarned() >= 1);
        }
      }
    });
  }

  await test('invalid swaps are refused and cost no moves', async () => {
    const E = new Engine(LEVELS[0], null, rng(7));
    const before = E.moves;
    assert.equal(await E.move({ r: 0, c: 0 }, { r: 2, c: 2 }), false);
    assert.equal(E.moves, before);
  });

  await test('rainbow pearl swap clears every creature of that colour', async () => {
    const E = new Engine(LEVELS[0], null, rng(3));
    const pearl = E.grid[4][4];
    pearl.special = 'bomb'; pearl.color = -1;
    const color = E.grid[4][5].color;
    await E.move({ r: 4, c: 4 }, { r: 4, c: 5 });
    assert.ok(E.collected[color] >= 3);
  });

  await test('PWA: manifest icons and service-worker shell files exist', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.webmanifest'), 'utf8'));
    assert.ok(manifest.icons.some(x => x.purpose === 'maskable' && x.sizes === '512x512'));
    assert.ok(manifest.icons.some(x => x.purpose === 'any' && x.sizes === '192x192'));
    for (const icon of [...manifest.icons, ...(manifest.screenshots || [])]) {
      assert.ok(fs.existsSync(path.join(PUBLIC, icon.src)), `missing ${icon.src}`);
    }
    const sw = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
    const shell = JSON.parse(sw.match(/APP_SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
    for (const url of shell) {
      if (url === '/') continue;
      assert.ok(fs.existsSync(path.join(PUBLIC, url)), `service worker caches missing file ${url}`);
    }
  });

  console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed');
  process.exit(failures ? 1 : 0);
})();
