/**
 * The one paint mechanism of the app.
 *
 * Mechanisms: every view returns a screen `{ key, layout, parts }`: `layout` is the
 * screen's skeleton with `data-part="name"` slots, `parts` maps slot names to HTML.
 * `paint` replaces the layout only when the screen `key` changes and then fills only the
 * parts whose HTML changed. So a running photo effect, an animation or a focused input is
 * never reset by an unrelated update, and re-rendering often (main.js does it four times
 * a second) costs almost nothing.
 *
 * Invariant: views are pure string builders; all DOM writes happen here (plus the
 * timer bar, the effects and the entrances, which main.js and effects.js animate directly
 * on the painted markup until the next repaint replaces it).
 */

export function createPainter(root) {
  let key = null;
  const cache = new Map();
  /** Paints `screen` (null empties the root); returns the names of the parts that changed. */
  return function paint(screen) {
    const changed = [];
    if (!screen) {
      if (key !== null) root.innerHTML = '';
      key = null;
      cache.clear();
      return changed;
    }
    if (screen.key !== key) {
      root.innerHTML = screen.layout;
      key = screen.key;
      cache.clear();
      changed.push('layout');
    }
    for (const [name, html] of Object.entries(screen.parts || {})) {
      if (cache.get(name) === html) continue;
      const el = root.querySelector(`[data-part="${name}"]`);
      if (!el) continue;
      el.innerHTML = html;
      cache.set(name, html);
      changed.push(name);
    }
    return changed;
  };
}
