/**
 * The demo draft: a small lobby-like screen (who is here, a Start button) whose players
 * arrive with two different entrances, side by side. It shows how a draft is built and is
 * the folder to copy for a new one (drafts/README.md, "A new draft").
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) reads this description and shows
 * `screen.js` once per frame; the controls below come on top of the kit's own (which
 * frame, the phone, Reduce Motion) and reach the screen as `options.players`.
 */
export default {
  title: 'Demo',
  frames: [
    { id: 'pop', title: 'Pop' },
    { id: 'slide', title: 'Slide' },
  ],
  controls: [{ key: 'players', label: 'Players', options: [['3', '3'], ['6', '6']], value: '3' }],
};
