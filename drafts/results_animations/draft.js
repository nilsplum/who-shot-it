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
  frames: [
    { id: 'spotlight', title: 'Spotlight' },
    { id: 'jackpot', title: 'Jackpot' },
    { id: 'supercharge_app', title: 'Supercharge, in the app' },
    { id: 'supercharge', title: 'Supercharge' },
    { id: 'tricky', title: 'Tricky' },
    { id: 'photofinish', title: 'Photo finish' },
  ],
  controls: [{ key: 'players', label: 'Players', options: [['2', '2'], ['3', '3'], ['6', '6'], ['16', '16']], value: '6' }],
};
