/* Reef Crush — level data.
   Layout key:  .  normal cell   #  no cell (gap in the board)
                j  coral (1 layer)   J  coral (2 layers)
                i  frozen creature   k  frozen on coral   K  frozen on 2-layer coral
                r  rock (1 hit)      R  boulder (2 hits)
   Creature colours: 0 clownfish, 1 crab, 2 starfish, 3 octopus, 4 turtle, 5 pufferfish */
(function (root) {
  const FULL = ['........', '........', '........', '........', '........', '........', '........', '........'];
  const LEVELS = [
    { // 1
      moves: 20, colors: 5, layout: FULL,
      goals: [{ type: 'score', target: 2000 }], stars: [2000, 4500, 7000],
      tip: { kind: 'swipe', title: 'Welcome to the reef!', text: 'Swipe a creature into its neighbour, or tap one and then the other, to line up 3 of a kind.' }
    },
    { // 2
      moves: 20, colors: 5, layout: FULL,
      goals: [{ type: 'collect', color: 0, count: 20 }, { type: 'collect', color: 1, count: 20 }], stars: [2000, 6000, 10000],
      tip: { kind: 'collect', title: 'Collect creatures', text: 'Match the creatures shown at the top. Collect them all before your moves run out.' }
    },
    { // 3
      moves: 18, colors: 5, layout: FULL,
      goals: [{ type: 'score', target: 4000 }], stars: [4000, 6000, 8000],
      tip: { kind: 'h', title: 'Striped creatures', text: 'Match 4 in a row to make a striped creature. Match it again to sweep a whole row or column.' }
    },
    { // 4
      moves: 22, colors: 5,
      layout: ['........', '........', '..jjjj..', '..jjjj..', '..jjjj..', '..jjjj..', '........', '........'],
      goals: [{ type: 'jelly' }], stars: [3000, 7500, 10000],
      tip: { kind: 'coral', title: 'Coral reef', text: 'Make matches on top of the pink coral to clear it. Clear all the coral to win.' }
    },
    { // 5
      moves: 22, colors: 5, layout: FULL,
      goals: [{ type: 'collect', color: 2, count: 25 }, { type: 'collect', color: 4, count: 25 }], stars: [3000, 7000, 11000],
      tip: { kind: 'wrap', title: 'Bubble creatures', text: 'Make an L or T shaped match to wrap a creature in a bubble. Match it to burst everything around it.' }
    },
    { // 6
      moves: 20, colors: 5,
      layout: ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'],
      goals: [{ type: 'score', target: 5000 }], stars: [5000, 7500, 10000],
      tip: { kind: 'bomb', title: 'Rainbow Pearl', text: 'Match 5 in a row to make a Rainbow Pearl. Swap it with any creature to clear every one of that kind.' }
    },
    { // 7
      moves: 20, colors: 5,
      layout: ['........', '........', '.i.ii.i.', '..i..i..', '..i..i..', '.i.ii.i.', '........', '........'],
      goals: [{ type: 'blockers' }], stars: [3000, 7000, 10000],
      tip: { kind: 'ice', title: 'Frozen creatures', text: 'Ice holds a creature in place. Match it, or hit it with a special, to crack the ice.' }
    },
    { // 8
      moves: 27, colors: 5,
      layout: ['........', '.JJ..JJ.', '.JJ..JJ.', '........', '........', '.JJ..JJ.', '.JJ..JJ.', '........'],
      goals: [{ type: 'jelly' }], stars: [5000, 11000, 15000],
      tip: { kind: 'coral2', title: 'Thick coral', text: 'Darker coral needs two matches on top of it to clear.' }
    },
    { // 9
      moves: 22, colors: 5,
      layout: ['........', '........', '........', '.rr..rr.', '........', '........', '.r....r.', '........'],
      goals: [{ type: 'blockers' }], stars: [3500, 5500, 8000],
      tip: { kind: 'rock', title: 'Rocks', text: 'Rocks block the way. Match right next to a rock, or blast it, to break it. Creatures slide around obstacles.' }
    },
    { // 10
      moves: 28, colors: 5,
      layout: ['jjjjjjjj', 'j......j', 'j......j', 'j......j', 'j......j', 'j......j', 'j......j', 'jjjjjjjj'],
      goals: [{ type: 'jelly' }, { type: 'collect', color: 3, count: 20 }], stars: [6000, 11000, 15000]
    },
    { // 11
      moves: 24, colors: 6, layout: FULL,
      goals: [{ type: 'score', target: 6000 }], stars: [6000, 8000, 10000],
      tip: { kind: 'six', title: 'A busier reef', text: 'Pufferfish join the reef from here on. Six kinds of creature make matches harder to find.' }
    },
    { // 12
      moves: 28, colors: 5,
      layout: ['j......j', '.j....j.', '..J..J..', '...JJ...', '...JJ...', '..J..J..', '.j....j.', 'j......j'],
      goals: [{ type: 'jelly' }], stars: [6000, 12000, 16000]
    },
    { // 13
      moves: 22, colors: 5,
      layout: ['........', '........', '.R....R.', '.R.rr.R.', '........', '...rr...', '........', '........'],
      goals: [{ type: 'blockers' }], stars: [5000, 6500, 9500],
      tip: { kind: 'rock2', title: 'Boulders', text: 'Dark boulders take two hits to break.' }
    },
    { // 14
      moves: 26, colors: 6,
      layout: ['........', '.i.ii.i.', '........', 'i..ii..i', '........', '.i.ii.i.', '........', '........'],
      goals: [{ type: 'collect', color: 1, count: 22 }, { type: 'collect', color: 5, count: 22 }], stars: [4000, 7000, 10000]
    },
    { // 15
      moves: 28, colors: 5,
      layout: ['jjjjjjjj', 'jjjjjjjj', '........', '.r.rr.r.', '........', '........', 'jjjjjjjj', 'jjjjjjjj'],
      goals: [{ type: 'jelly' }], stars: [7000, 11000, 16000]
    },
    { // 16
      moves: 30, colors: 5,
      layout: ['###jj###', '##jjjj##', '#jjjjjj#', 'jjjjjjjj', 'jjjjjjjj', '#jjjjjj#', '##jjjj##', '###jj###'],
      goals: [{ type: 'jelly' }], stars: [6000, 8000, 11000]
    },
    { // 17
      moves: 26, colors: 6, layout: FULL,
      goals: [{ type: 'collect', color: 0, count: 25 }, { type: 'collect', color: 3, count: 25 }, { type: 'collect', color: 5, count: 25 }], stars: [5000, 7000, 10000]
    },
    { // 18
      moves: 23, colors: 5,
      layout: ['........', '.r.ii.r.', '..i..i..', 'R..ii..R', '..i..i..', '.r.ii.r.', '........', '........'],
      goals: [{ type: 'blockers' }], stars: [6000, 8000, 11500]
    },
    { // 19
      moves: 38, colors: 5,
      layout: ['JJJJJJJJ', 'JJJJJJJJ', 'JJJJJJJJ', 'JJJJJJJJ', 'JJJJJJJJ', 'JJJJJJJJ', 'JJJJJJJJ', 'JJJJJJJJ'],
      goals: [{ type: 'jelly' }], stars: [12000, 26000, 34000]
    },
    { // 20
      moves: 27, colors: 5,
      layout: ['#jjjjjj#', 'jj.kk.jj', 'j.r..r.j', 'j..JJ..j', 'j..JJ..j', 'j.r..r.j', 'jj.kk.jj', '#jjjjjj#'],
      goals: [{ type: 'jelly' }, { type: 'blockers' }, { type: 'collect', color: 2, count: 20 }], stars: [8000, 13000, 18000]
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.REEF_LEVELS = LEVELS;
})(this);
