const MAX_SIDE = 520;

/**
 * Shrinks a picture to at most 520px on its longest side and returns it as a JPEG data URL,
 * so it travels to everyone in the room quickly. Resolves null if the file isn't a readable image.
 */
export function shrinkImage(file: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    let url: string;
    try {
      url = URL.createObjectURL(file);
    } catch {
      resolve(null);
      return;
    }
    const done = (v: string | null) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      resolve(v);
    };
    const im = new Image();
    im.onload = () => {
      try {
        const k = Math.min(1, MAX_SIDE / Math.max(im.width, im.height)),
          c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k));
        c.height = Math.max(1, Math.round(im.height * k));
        const g = c.getContext('2d');
        if (!g) return done(null);
        // JPEG has no transparency: put see-through pictures on white instead of black.
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(im, 0, 0, c.width, c.height);
        done(c.toDataURL('image/jpeg', 0.72));
      } catch {
        done(null);
      }
    };
    im.onerror = () => done(null);
    im.src = url;
  });
}

/** Browser implementation of GameEnv.probeImage. */
export function probeImage(src: string, onError: () => void) {
  const t = new Image();
  t.onerror = onError;
  t.src = src;
}
