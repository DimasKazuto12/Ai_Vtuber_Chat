interface Flake {
  x: number;
  y: number;
  vy: number;
  phase: number;
  speed: number;
  sprite: number;
  size: number;
}

const PALETTE = [
  { fill: "#ffffff", glow: "rgba(110,160,255,0.9)" },
  { fill: "#fff4e8", glow: "rgba(255,170,120,0.9)" },
  { fill: "#e8f1ff", glow: "rgba(130,180,255,0.9)" },
  { fill: "#ffeef5", glow: "rgba(255,150,190,0.9)" },
];

// Cahaya (shadowBlur) digambar sekali ke sprite, bukan tiap frame
function makeSprite(fill: string, glow: string, star: boolean) {
  const size = 32;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const m = size / 2;
  g.fillStyle = fill;
  g.shadowColor = glow;
  g.shadowBlur = 6;
  g.beginPath();
  if (star) {
    const s = 8;
    g.moveTo(m, m - s);
    g.quadraticCurveTo(m, m, m + s, m);
    g.quadraticCurveTo(m, m, m, m + s);
    g.quadraticCurveTo(m, m, m - s, m);
    g.quadraticCurveTo(m, m, m, m - s);
  } else {
    g.arc(m, m, 5, 0, Math.PI * 2);
  }
  g.fill();
  return c;
}

export function startSparkles(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // urutan: [lingkaran, bintang] untuk tiap warna
  const sprites = PALETTE.flatMap((p) => [makeSprite(p.fill, p.glow, false), makeSprite(p.fill, p.glow, true)]);

  let w = 0;
  let h = 0;
  let items: Flake[] = [];

  const spawn = (anywhere: boolean): Flake => {
    const star = Math.random() < 0.3;
    const r = 1 + Math.random() * 2.2;
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -10,
      vy: 0.15 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.03,
      sprite: Math.floor(Math.random() * PALETTE.length) * 2 + (star ? 1 : 0),
      size: star ? 8.8 * r : 6.4 * r,
    };
  };

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    items = Array.from({ length: Math.round((w * h) / 24000) }, () => spawn(true));
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      p.phase += p.speed;
      p.y += p.vy;
      p.x += Math.sin(p.phase) * 0.3;
      if (p.y > h + 20) items[i] = spawn(false);
      ctx.globalAlpha = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(p.phase * 2));
      ctx.drawImage(sprites[p.sprite], p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };

  let raf = 0;
  const loop = () => {
    draw();
    raf = requestAnimationFrame(loop);
  };

  resize();
  window.addEventListener("resize", resize);
  if (reduceMotion) draw();
  else loop();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  };
}