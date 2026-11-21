/**
 * The round's photo effects: Blur, Zoom and Pixel (Classic shows the photo as it is).
 *
 * Mechanisms: `main.js` calls `startEffect` right after the stage shows a new photo in the
 * "show" phase, with the time the effect has left; the reveal always shows the plain
 * photo. Which effect and where Zoom starts come from the server (`view.round.mode/zoom`),
 * so everyone sees the same thing.
 *
 * Invariants: effects end at TIMING.effectShare of the answer time (or after
 * TIMING.untimedEffectMs without a timer), so the photo is fully visible before time is
 * up; a player who joins mid-round starts with the remaining duration. Blur starts at
 * 28 px, Zoom at 6x, Pixel runs through 11 steps.
 */

let pixelTimer = 0;

export function stopEffects() {
  clearTimeout(pixelTimer);
}

function runPixel(canvas, src, duration) {
  const img = new Image();
  img.onload = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, canvas.clientWidth * dpr);
    canvas.height = Math.max(1, canvas.clientHeight * dpr);
    const s = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * s;
    const h = img.height * s;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    const steps = [5, 8, 11, 15, 21, 29, 40, 56, 80, 120, 0];
    const tmp = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let i = 0;
    const draw = () => {
      if (!canvas.isConnected) return;
      const n = steps[i];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!n) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, x, y, w, h);
        return;
      }
      const tw = w >= h ? n : Math.max(1, Math.round((n * w) / h));
      const th = w >= h ? Math.max(1, Math.round((n * h) / w)) : n;
      tmp.width = tw;
      tmp.height = th;
      tmp.getContext('2d').drawImage(img, 0, 0, tw, th);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
      i += 1;
      pixelTimer = setTimeout(draw, duration / (steps.length - 1));
    };
    draw();
  };
  img.src = src;
}

/** Animates `img`/`canvas` inside `stage` from fully hidden to clear over `duration` ms. */
export function startEffect(stage, { mode, zoom, src, duration }) {
  stopEffects();
  const img = stage.querySelector('img');
  const canvas = stage.querySelector('canvas');
  const d = Math.max(1500, duration);
  // Apply the start state, force a layout, then transition to the end state.
  if (mode === 'blur' && img) {
    img.style.filter = 'blur(28px)';
    img.style.transform = 'scale(1.1)';
    img.getBoundingClientRect();
    img.style.transition = `filter ${d}ms cubic-bezier(.25,.5,.6,1), transform ${d}ms ease-out`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      img.style.filter = 'blur(0px)';
      img.style.transform = 'scale(1)';
    }));
  } else if (mode === 'zoom' && img) {
    const zx = Math.max(10, Math.min(90, Number(zoom && zoom.x) || 50));
    const zy = Math.max(10, Math.min(90, Number(zoom && zoom.y) || 50));
    img.style.transformOrigin = `${zx}% ${zy}%`;
    img.style.transform = 'scale(6)';
    img.getBoundingClientRect();
    img.style.transition = `transform ${d}ms cubic-bezier(.5,0,.3,1)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { img.style.transform = 'scale(1)'; }));
  } else if (mode === 'pixel' && canvas) {
    runPixel(canvas, src, d);
  }
}
