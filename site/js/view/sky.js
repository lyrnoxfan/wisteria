// 天空：纸色渐变 + 纸纹 + 地平线余晖 + 日/月（真实月相）+ 星 + 横向飘移的"霞"带
import { S, parX, parY } from './stage.js';
import { TAU, R, Rng, clamp, mix, rgba, makeCanvas, lighten } from '../lib/util.js';
import { moonPhase } from '../env/clock.js';

let bg = null;
let grain = null;
let key = '';
let stars = [];
let bands = [];
let bandSprite = null;
let bandKey = '';
const phase = moonPhase();

function makeGrain() {
  const n = 256;
  const c = makeCanvas(n, n);
  const g = c.ctx;
  const img = g.createImageData(n, n);
  const r = new Rng(77);
  for (let i = 0; i < n * n; i++) {
    const v = r.next();
    const light = v > 0.5;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = light ? 255 : 60;
    img.data[i * 4 + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 14);
  }
  g.putImageData(img, 0, 0);
  // 稀疏纸纤维
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = r.range(0, n), y = r.range(0, n), a = r.range(0, TAU), l = r.range(4, 16);
    g.strokeStyle = `rgba(90,80,70,${r.range(0.03, 0.07)})`;
    g.lineWidth = r.range(0.4, 0.9);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r.range(-2, 2), y + Math.sin(a) * l * 0.5 + r.range(-2, 2), x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c;
}

export function layoutSky(seed) {
  bg = makeCanvas(S.W * S.dpr, S.H * S.dpr);
  if (!grain) grain = makeGrain();
  key = '';
  const r = new Rng(seed ^ 0x51a9);
  stars = [];
  const n = Math.round(clamp((S.W * S.H) / 9000, 28, 90));
  for (let i = 0; i < n; i++) {
    stars.push({ x: r.range(0, S.W), y: Math.pow(r.next(), 1.6) * S.H * 0.62, s: r.range(0.35, 1.15) * Math.max(1, S.k), ph: r.range(0, TAU), f: r.range(0.4, 1.6), b: r.range(0.35, 1) });
  }
  bands = [];
  for (let i = 0; i < 3; i++) {
    bands.push({
      x: r.range(-0.3, 1) * S.W,
      y: S.H * r.range(0.16, 0.66),
      w: S.W * r.range(0.7, 1.25) + S.tree.w * 0.5,
      h: S.k * r.range(16, 34),
      v: S.k * r.range(1.5, 4) * (r.chance(0.5) ? 1 : -1),
      a: r.range(0.55, 1),
    });
  }
}

function drawMoon(g, x, y, r, alpha, dark) {
  const lit = (1 - Math.cos(phase * TAU)) / 2;
  const halo = g.createRadialGradient(x, y, r * 0.8, x, y, r * 6);
  halo.addColorStop(0, `rgba(215,222,255,${0.16 * alpha * (0.4 + lit)})`);
  halo.addColorStop(1, 'rgba(215,222,255,0)');
  g.fillStyle = halo;
  g.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
  // 暗面（地照）
  g.fillStyle = `rgba(70,76,104,${0.28 * alpha * dark * dark})`;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  if (lit < 0.02) return;
  g.save();
  g.translate(x, y);
  if (phase >= 0.5) g.scale(-1, 1);
  const tx = r * Math.cos(phase * TAU);
  g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  g.ellipse(0, 0, Math.max(0.01, Math.abs(tx)), r, 0, Math.PI / 2, -Math.PI / 2, tx > 0);
  g.closePath();
  const mg = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  mg.addColorStop(0, `rgba(250,247,232,${alpha})`);
  mg.addColorStop(1, `rgba(222,217,196,${alpha})`);
  g.fillStyle = mg;
  g.fill();
  g.clip();
  // 月海
  g.fillStyle = `rgba(150,148,140,${0.16 * alpha})`;
  for (const [mx, my, mr] of [[-0.25, -0.2, 0.28], [0.18, -0.32, 0.18], [0.1, 0.18, 0.24], [-0.3, 0.3, 0.14]]) {
    g.beginPath();
    g.arc(mx * r, my * r, mr * r, 0, TAU);
    g.fill();
  }
  g.restore();
}

// 只在光色明显变化时重画背景
export function renderSky(pal) {
  const k = [pal.sky0, pal.sky1, pal.glow].map((c) => c.map((v) => v | 0).join(',')).join('|') +
    [pal.glowA, pal.sun, pal.moon, pal.sunY, pal.dark].map((v) => v.toFixed(3)).join(',');
  if (k === key) return false;
  key = k;
  const g = bg.ctx;
  const { W, H } = S;
  g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  g.globalAlpha = 1;
  const lin = g.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, rgba(pal.sky0));
  lin.addColorStop(0.6, rgba(mix(pal.sky0, pal.sky1, 0.55)));
  lin.addColorStop(1, rgba(pal.sky1));
  g.fillStyle = lin;
  g.fillRect(0, 0, W, H);

  // 地平线余晖（偏向太阳一侧）
  if (pal.glowA > 0.005) {
    const gx = W * (pal.sun > 0.05 ? pal.sunX : 0.5);
    const rad = Math.max(W, H) * 0.95;
    const rg = g.createRadialGradient(gx, S.groundY, 0, gx, S.groundY, rad);
    rg.addColorStop(0, rgba(pal.glow, pal.glowA));
    rg.addColorStop(0.45, rgba(pal.glow, pal.glowA * 0.35));
    rg.addColorStop(1, rgba(pal.glow, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }

  // 日轮：朝阳淡杏、夕阳朱红，边缘略化开
  if (pal.sun > 0.01) {
    const sx = W * pal.sunX, sy = H * pal.sunY;
    const sr = clamp(Math.min(W, H) * 0.06, 18, 46);
    const col = mix([246, 168, 128], [228, 86, 58], pal.sunWarm);
    const halo = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 5);
    halo.addColorStop(0, rgba(col, 0.22 * pal.sun));
    halo.addColorStop(1, rgba(col, 0));
    g.fillStyle = halo;
    g.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
    const disc = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
    disc.addColorStop(0, rgba(lighten(col, 0.12), 0.62 * pal.sun));
    disc.addColorStop(0.86, rgba(col, 0.55 * pal.sun));
    disc.addColorStop(1, rgba(col, 0));
    g.fillStyle = disc;
    g.beginPath();
    g.arc(sx, sy, sr, 0, TAU);
    g.fill();
  }

  if (pal.moon > 0.01) {
    const mr = clamp(Math.min(W, H) * 0.036, 12, 30);
    const mx = W * (S.tree.baseX > W * 0.5 ? 0.2 : 0.8);
    const my = Math.min(H * 0.1 + mr, S.tree.y * 0.55 + mr);
    drawMoon(g, mx, Math.max(mr * 2.2, my), mr, pal.moon, pal.dark);
  }

  // 纸纹
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 0.8 + pal.dark * 0.2;
  g.fillStyle = g.createPattern(grain, 'repeat');
  g.fillRect(0, 0, bg.width, bg.height);
  g.globalAlpha = 1;
  g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);

  // 极淡的暗角
  const vr = Math.max(W, H);
  const vg = g.createRadialGradient(W / 2, H * 0.45, vr * 0.35, W / 2, H * 0.45, vr * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(${pal.dark > 0.5 ? '0,0,10' : '70,55,40'},${0.06 + pal.dark * 0.22})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  return true;
}

function ensureBandSprite(pal) {
  const k = pal.haze.map((v) => v | 0).join(',');
  if (k === bandKey && bandSprite) return;
  bandKey = k;
  bandSprite = bandSprite || makeCanvas(256, 48);
  const g = bandSprite.ctx;
  g.clearRect(0, 0, 256, 48);
  g.save();
  g.translate(128, 24);
  g.scale(128, 24);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  rg.addColorStop(0, rgba(pal.haze, 1));
  rg.addColorStop(0.55, rgba(pal.haze, 0.55));
  rg.addColorStop(1, rgba(pal.haze, 0));
  g.fillStyle = rg;
  g.beginPath();
  g.arc(0, 0, 1, 0, TAU);
  g.fill();
  g.restore();
}

export function drawSky(ctx, pal, t, dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(bg, 0, 0);
  const d = S.dpr;
  // 星
  if (pal.stars > 0.01) {
    ctx.setTransform(d, 0, 0, d, parX(0.05) * d, parY(0.05) * d);
    ctx.fillStyle = '#f2f0ff';
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * s.f + s.ph);
      ctx.globalAlpha = pal.stars * s.b * tw * 0.85;
      ctx.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
    }
  }
  // 霞带
  ensureBandSprite(pal);
  const ba = pal.hazeA * (0.55 + pal.mist * 0.6);
  if (ba > 0.01) {
    for (const b of bands) {
      b.x += b.v * dt;
      if (b.v > 0 && b.x > S.W + b.w * 0.2) b.x = -b.w * 1.1;
      if (b.v < 0 && b.x < -b.w * 1.2) b.x = S.W + b.w * 0.1;
      ctx.setTransform(d, 0, 0, d, parX(0.2) * d, parY(0.2) * d);
      ctx.globalAlpha = Math.min(1, ba * b.a);
      ctx.drawImage(bandSprite, b.x, b.y - b.h / 2, b.w, b.h);
    }
  }
  ctx.globalAlpha = 1;
}

// 晨雾：贴地的一层，画在最前
export function drawMist(ctx, pal) {
  if (pal.mist < 0.05 || !bandSprite) return;
  const d = S.dpr;
  ctx.setTransform(d, 0, 0, d, parX(1) * d, 0);
  ctx.globalAlpha = pal.mist * 0.55;
  const h = S.k * 60;
  ctx.drawImage(bandSprite, -S.W * 0.2, S.groundY - h * 0.55, S.W * 1.4, h);
  ctx.globalAlpha = pal.mist * 0.3;
  ctx.drawImage(bandSprite, -S.W * 0.4 + Math.sin(S.t * 0.03) * S.W * 0.1, S.groundY - h * 1.4, S.W * 1.8, h * 1.2);
  ctx.globalAlpha = 1;
}
