/**
 * The bubble animations: three ways for the lobby to tease the one player the group still
 * waits for (docs/plans/2026-11-25-lobby-and-start.md, section 3.3), each with one big
 * bubble carrying the line and smaller bubbles carrying the player's name. The text is
 * white (or barely tinted, like the colours on a bubble's skin), opaque, very fat and
 * bulging as if printed on a ball; the bubbles and how they move differ:
 * - Soap bubbles (soap.js): a big iridescent soap bubble, its skin's colours swirling,
 *   wobbling like a real one; small soap bubbles with the name rise past it and pop.
 * - Comic chorus (comic.js): a pop-art speech bubble in the player's own colour slams in
 *   over turning rays and bounces; the others' small speech bubbles shout the name in turn.
 * - Gummy orbit (gummy.js): a glossy jelly sweet drops in and wobbles, a glint sweeping
 *   over it; glossy marbles with the name orbit it in 3D, in front of it and behind it.
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) shows `screen.js` once per frame; the
 * controls below reach the screen as `options.line` and `options.name`. Under every bubble
 * is the app's own lobby as the ready players see it (lobby.js).
 */
export default {
  title: 'Bubble animations',
  frames: [
    { id: 'soap', title: 'Soap bubbles' },
    { id: 'comic', title: 'Comic chorus' },
    { id: 'gummy', title: 'Gummy orbit' },
  ],
  controls: [
    {
      key: 'line',
      label: 'Line',
      options: [['all', 'One after another'], ['1', 'It’s always…'], ['2', 'What is … hiding?'], ['3', '… staring at you.']],
      value: 'all',
    },
    { key: 'name', label: 'Name', options: [['Mia', 'Mia'], ['Maximilian-Alexa', '16 letters']], value: 'Mia' },
  ],
};
