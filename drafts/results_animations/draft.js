/**
 * The results animations: five ways to reveal the podium at the end of a game, side by
 * side, to choose one for the app (it replaces today's reveal, main.js `startPodium`).
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) shows `screen.js` once per frame below;
 * each frame paints an end screen and plays its animation (one file each). "Supercharge,
 * in the app" is the chosen one as the app plays it (web/js/podium.js), beside the draft
 * it came from. The players control reaches the screen as `options.players`.
 *
 * Invariants: all end on the app's end screen (the podium, fastest guess, best fooler, the
 * ranking, "Play again"; the first five on it as it was when they were made, end_before.js);
 * they differ only in how they get there. All build up for each place in turn (third,
 * second, the winner), each bigger than the one before, and end with fireworks across the
 * whole screen.
 */
export default {
  title: 'Results animations',
  note: 'The end of a game, five times: the same end screen, each with its own way to reveal third place, second place and the winner. Every place builds up and releases, each bigger than the one before, and the winner gets fireworks across the whole screen. Under each phone you see the vibrations as they would be felt.',
  frames: [
    { id: 'spotlight', title: 'Spotlight', idea: 'A dark stage. A spotlight searches the lineup, slows down, wavers and stops: that player leaps onto the podium. For the winner two lights race, stop on two players, then join on one.' },
    { id: 'jackpot', title: 'Jackpot', idea: 'Every place is a slot reel of all the players. Second stops one player too early. The winner’s reel crawls to a stop on someone else, goes dark, creeps on and clicks to the winner.' },
    { id: 'supercharge_app', title: 'Supercharge, in the app', idea: 'What the app now plays: the orb fills in four or five jumps and bursts without a stop, the rays sit centred behind the winner, the rest of the ranking scrolls in its own list, and it is about 15% shorter.' },
    { id: 'supercharge', title: 'Supercharge', idea: 'Each place charges like a power-up: sparks rush into a trembling orb, a ring fills up, then a shockwave. The winner’s orb grows and cracks, time stands still, and it blasts the screen white.' },
    { id: 'tricky', title: 'Tricky', idea: 'The game’s own Tricky mode: dark pixel shapes that sharpen step by step while the names decode, so everyone guesses. The winner beats like a heart in the middle of the screen.' },
    { id: 'photofinish', title: 'Photo finish', idea: 'Everyone’s score races up and the lowest drop out. Third and second get stamped as they stop, the last two climb bar to bar in slow motion, and the winner surges over the line.' },
  ],
  controls: [{ key: 'players', label: 'Players', options: [['2', '2'], ['3', '3'], ['6', '6'], ['16', '16']], value: '6' }],
};
