// 导演：按时段安排"来访者"。白天鸟多、行人多；傍晚归鸦与远寺钟声；夜里只有猫头鹰与偶尔的夜赏人。
import { R, chance } from './lib/util.js';
import { spawnSwallows, spawnFlock, spawnMejiro, spawnSparrows } from './view/birds.js';
import { spawnWalker } from './view/walkers.js';
import * as V from './audio/voices.js';
import { audioOn } from './audio/engine.js';

export class Director {
  constructor() {
    this.n = {};
    this.audioStart = -1;
  }

  start(t) {
    // 第一轮来得快一些，让人一进来就能看到点什么
    this.n = {
      mejiro: t + R(7, 14),
      swallow: t + R(14, 26),
      flock: t + R(20, 40),
      crow: t + R(8, 20),
      sparrow: t + R(30, 55),
      walker: t + R(18, 34),
      song: Infinity,
      bell: Infinity,
      owl: Infinity,
    };
  }

  update(t, pal) {
    const h = pal.hour;
    const life = pal.life;
    const day = h >= 5.5 && h < 18.6;
    const dusk = h >= 16.6 && h < 19.4;
    const night = pal.dark > 0.6;
    const n = this.n;

    if (audioOn() && this.audioStart < 0) {
      this.audioStart = t;
      n.song = t + R(5, 11);
      n.bell = dusk ? t + R(4, 9) : Infinity;
      n.owl = night ? t + R(12, 30) : Infinity;
    }

    if (t > n.mejiro) {
      if (day && life > 0.5) spawnMejiro(chance(0.35) ? 2 : 1);
      n.mejiro = t + R(45, 110);
    }
    if (t > n.swallow) {
      if (day && h < 18.2 && life > 0.6) spawnSwallows(chance(0.4) ? 2 : 1);
      n.swallow = t + R(30, 80);
    }
    if (t > n.flock) {
      if (life > 0.4 && !dusk) spawnFlock('far');
      n.flock = t + R(55, 130);
    }
    if (t > n.crow) {
      if (dusk) spawnFlock('crow');
      n.crow = t + R(35, 80);
    }
    if (t > n.sparrow) {
      if (day && h < 18 && life > 0.6) spawnSparrows(Math.floor(R(1, 3.99)));
      n.sparrow = t + R(70, 160);
    }
    if (t > n.walker) {
      if (!night || chance(0.45)) spawnWalker();
      n.walker = t + (night ? R(110, 240) : R(60, 140));
    }

    if (!audioOn()) return;
    if (t > n.song) {
      if (h >= 5 && h < 17.5) {
        if (chance(0.22)) V.uguisuValley();
        else V.uguisu();
      }
      n.song = t + (h < 10 ? R(30, 70) : R(50, 120));
    }
    if (t > n.bell) {
      if (dusk) V.bell();
      n.bell = t + R(300, 480);
    }
    if (dusk && n.bell === Infinity) n.bell = t + R(20, 60);
    if (t > n.owl) {
      if (night) V.owl();
      n.owl = t + R(80, 200);
    }
    if (night && n.owl === Infinity) n.owl = t + R(30, 90);
  }
}
