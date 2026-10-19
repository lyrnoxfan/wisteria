// 风场：底风 + 若干阵风。阵风有方向，从屏幕一侧以有限速度扫过，
// 所以左边的花先动、右边的后动；每处还叠加一点湍流。
import { R, chance, damp, smooth, noise1 } from '../lib/util.js';

export class Wind {
  constructor() {
    this.W = 400;
    this.gusts = [];
    this.dir = chance(0.5) ? 1 : -1;
    this.base = 0.07;
    this.baseTarget = 0.07;
    this.next = R(5, 10);
    this.level = 0.07; // 树附近的风力（无符号）
    this.calm = 1;
  }

  update(dt, t, W, pal) {
    this.W = W;
    // 夜里风小一些
    this.calm = pal ? 1 - pal.dark * 0.3 : 1;
    if (t > this.next) {
      const strong = chance(0.33);
      if (chance(0.2)) this.dir *= -1;
      this.gusts.push({
        t0: t,
        s: (strong ? R(0.55, 0.95) : R(0.2, 0.42)) * this.calm,
        dir: this.dir,
        c: W * R(0.45, 0.8), // 风头推进速度（px/s）
        rise: R(0.8, 1.8),
        dur: strong ? R(3, 6.5) : R(2.5, 5),
        fall: R(1.8, 3.2),
        seed: R(0, 100),
      });
      this.next = t + (strong ? R(9, 18) : R(5, 12));
      this.baseTarget = R(0.03, 0.15) * this.calm;
    }
    this.base = damp(this.base, this.baseTarget, 0.25, dt);
    const span = W * 1.3;
    this.gusts = this.gusts.filter((g) => t - g.t0 < g.dur + g.fall + span / g.c + 1);
    this.t = t;
    this.level = Math.min(1.2, Math.abs(this.at(W * 0.5, t)));
  }

  gustEnv(g, x, t) {
    const dist = g.dir > 0 ? x + this.W * 0.15 : this.W * 1.15 - x;
    const tau = t - g.t0 - dist / g.c;
    if (tau <= 0) return 0;
    if (tau < g.rise) return smooth(tau / g.rise);
    if (tau < g.dur) return 1;
    return Math.max(0, 1 - (tau - g.dur) / g.fall);
  }

  // 带方向的风（正 = 向右）
  at(x, t = this.t) {
    let v = this.base * this.dir * (0.7 + 0.3 * noise1(t * 0.21 + x * 0.0021));
    for (const g of this.gusts) {
      const e = this.gustEnv(g, x, t);
      if (e > 0) v += g.s * g.dir * e * (0.78 + 0.22 * noise1(t * 1.15 + x * 0.008 + g.seed));
    }
    return v;
  }
}
