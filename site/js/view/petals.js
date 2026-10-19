// 花瓣：从花串上掉下，翻转着飘落（终端速度 + 侧向摆荡 + 风），落地后静静躺一会儿再淡去。
import { S } from './stage.js';
import { randomBloomPoint } from './racemes.js';
import { TAU, R, clamp, rgba, lighten, darken, makeCanvas } from '../lib/util.js';

const MAX_AIR = 90;
const MAX_GROUND = 260;
const air = [];
const ground = [];
let sprites = [];
let spawnAcc = 0;
const tmp = { x: 0, y: 0, layer: 1 };

function petalSprite(col, shape) {
  const n = 32;
  const c = makeCanvas(n, n);
  const g = c.ctx;
  g.translate(n / 2, n / 2);
  const grad = g.createRadialGradient(-2, -3, 1, 0, 0, 13);
  grad.addColorStop(0, rgba(lighten(col, 0.3)));
  grad.addColorStop(0.7, rgba(col));
  grad.addColorStop(1, rgba(darken(col, 0.12)));
  g.fillStyle = grad;
  g.beginPath();
  if (shape === 0) {
    // 旗瓣：圆扇形，顶端微凹
    g.moveTo(0, 11);
    g.bezierCurveTo(-13, 6, -13, -9, -3, -11);
    g.quadraticCurveTo(0, -8, 3, -11);
    g.bezierCurveTo(13, -9, 13, 6, 0, 11);
  } else if (shape === 1) {
    // 龙骨瓣：小船形
    g.moveTo(-11, 3);
    g.bezierCurveTo(-7, -8, 7, -8, 12, -1);
    g.bezierCurveTo(6, 7, -4, 8, -11, 3);
  } else {
    // 翼瓣：偏长的勺形
    g.moveTo(-10, 5);
    g.bezierCurveTo(-12, -4, -2, -10, 6, -7);
    g.bezierCurveTo(13, -4, 9, 6, -10, 5);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = rgba(darken(col, 0.4), 0.3);
  g.lineWidth = 0.8;
  g.stroke();
  if (shape === 0) {
    // 旗瓣基部那点淡黄
    g.fillStyle = 'rgba(236,214,120,0.55)';
    g.beginPath();
    g.ellipse(0, 4, 2.4, 3.6, 0, 0, TAU);
    g.fill();
  }
  return c;
}

export function initPetals(colors) {
  sprites = [];
  colors.forEach((col, i) => {
    sprites.push(petalSprite(col, i % 3));
    sprites.push(petalSprite(col, (i + 1) % 3));
  });
}

export function resetPetals() {
  air.length = 0;
  ground.length = 0;
}

export function spawnPetal(x, y, vx = 0, vy = 0, near = 1) {
  if (air.length >= MAX_AIR) return;
  const size = R(5, 8.5) * S.k * (0.85 + near * 0.15);
  air.push({
    x, y,
    vx: vx + R(-14, 14) * S.k,
    vy: vy + R(4, 22) * S.k,
    size,
    rot: R(0, TAU),
    vr: R(-2.6, 2.6),
    flip: R(0, TAU),
    vf: R(2.2, 5.5) * (Math.random() < 0.5 ? -1 : 1),
    sway: R(0.6, 1.4),
    ph: R(0, TAU),
    sp: Math.floor(Math.random() * sprites.length),
    land: S.groundY + R(-5, 18) * S.k,
    term: R(42, 66) * S.k,
  });
}

export function burstAt(x, y, energy) {
  const n = Math.round(1 + energy * 4 + Math.random());
  for (let i = 0; i < n; i++) spawnPetal(x + R(-6, 6) * S.k, y + R(-6, 6) * S.k, R(-30, 30) * S.k, R(-10, 30) * S.k);
}

// 行人走过：把脚边的花瓣踢起一点
export function kick(x, vx) {
  for (let i = ground.length - 1; i >= 0; i--) {
    const p = ground[i];
    if (Math.abs(p.x - x) < 9 * S.k && Math.random() < 0.3 && air.length < MAX_AIR) {
      ground.splice(i, 1);
      air.push({ ...p, vx: vx * 0.4 + R(-18, 18) * S.k, vy: -R(30, 70) * S.k, vr: R(-6, 6), vf: R(4, 9), flip: R(0, TAU), ph: R(0, TAU), sway: 0.6, land: p.y, term: R(42, 66) * S.k });
    }
  }
}

export function updatePetals(dt, wind, active) {
  const t = S.t;
  // 自然落花：风越大掉得越多
  if (active) {
    spawnAcc += dt * (0.45 + Math.pow(wind.level, 1.4) * 9);
    while (spawnAcc > 1) {
      spawnAcc -= 1;
      if (randomBloomPoint(tmp)) spawnPetal(tmp.x, tmp.y, 0, 0, tmp.layer / 2);
    }
  }
  for (let i = air.length - 1; i >= 0; i--) {
    const p = air[i];
    p.vy += (p.term - p.vy) * Math.min(1, dt * 1.6);
    const wx = wind.at(p.x, t) * 170 * S.k;
    p.vx += (wx - p.vx) * Math.min(1, dt * 1.1);
    p.ph += dt * p.sway * 2.5;
    p.x += (p.vx + Math.sin(p.ph) * 20 * S.k * p.sway) * dt;
    p.y += (p.vy + Math.cos(p.ph * 2) * 7 * S.k) * dt;
    p.rot += p.vr * dt * (1 + wind.level);
    p.flip += p.vf * dt;
    if (p.y >= p.land) {
      air.splice(i, 1);
      const fx = Math.cos(p.flip);
      ground.push({ x: p.x, y: p.land, rot: p.rot, sx: Math.sign(fx || 1) * Math.max(0.35, Math.abs(fx)), sp: p.sp, size: p.size, age: 0, life: R(60, 150) });
      if (ground.length > MAX_GROUND) ground[0].life = Math.min(ground[0].life, ground[0].age + 2);
      continue;
    }
    if (p.x < -60 || p.x > S.W + 60 || p.y < -80) air.splice(i, 1);
  }
  const gust = wind.level > 0.45;
  for (let i = ground.length - 1; i >= 0; i--) {
    const p = ground[i];
    p.age += dt;
    if (gust && Math.random() < dt * 2) p.x += wind.at(p.x, t) * R(4, 16) * S.k;
    if (p.age > p.life) ground.splice(i, 1);
  }
}

export function drawGroundPetals(ctx, pal) {
  const d = S.dpr;
  const dim = 1 - pal.dark * 0.35;
  for (const p of ground) {
    const a = clamp((p.life - p.age) / 6, 0, 1) * 0.92 * dim;
    if (a <= 0.01) continue;
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const sx = p.sx * 0.9;
    ctx.globalAlpha = a;
    // 先旋转再纵向压扁：平躺在地上的透视
    ctx.setTransform(c * sx * d, 0.5 * s * sx * d, -s * d, 0.5 * c * d, p.x * d, p.y * d);
    ctx.drawImage(sprites[p.sp], -p.size / 2, -p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function drawAirPetals(ctx, pal) {
  const d = S.dpr;
  const dim = 1 - pal.dark * 0.2;
  for (const p of air) {
    const fx = Math.cos(p.flip);
    const sx = Math.abs(fx) < 0.12 ? 0.12 * Math.sign(fx || 1) : fx;
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    ctx.globalAlpha = (fx < 0 ? 0.82 : 0.96) * dim;
    ctx.setTransform(c * sx * d, s * sx * d, -s * d, c * d, p.x * d, p.y * d);
    ctx.drawImage(sprites[p.sp], -p.size / 2, -p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
