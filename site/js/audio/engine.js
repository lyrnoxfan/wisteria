// 音频引擎：首次触摸后创建；主压缩防爆音；合成卷积混响营造"远处"的空间感
import { clamp, params } from '../lib/util.js';

export const A = { ac: null, master: null, bus: null, rev: null, ready: false, noise: null };

function makeIR(ac, secs, decay) {
  const len = Math.floor(ac.sampleRate * secs);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    const pre = Math.floor(ac.sampleRate * 0.018);
    for (let i = 0; i < len; i++) {
      if (i < pre) { d[i] = 0; continue; }
      const t = (i - pre) / (len - pre);
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; // 稍暗一些，像户外
      d[i] = lp * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

export function unlockAudio() {
  if (params.mute) return;
  if (A.ac) {
    if (A.ac.state === 'suspended') A.ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let ac;
  try {
    ac = new AC({ latencyHint: 'playback' });
  } catch (e) {
    ac = new AC();
  }
  A.ac = ac;
  // iOS：在手势里播一个静音缓冲，彻底解锁
  const sil = ac.createBufferSource();
  sil.buffer = ac.createBuffer(1, 1, 22050);
  sil.connect(ac.destination);
  sil.start(0);

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 14;
  comp.ratio.value = 3;
  comp.attack.value = 0.008;
  comp.release.value = 0.35;
  comp.connect(ac.destination);
  A.master = ac.createGain();
  A.master.gain.value = 0;
  A.master.connect(comp);
  A.master.gain.setTargetAtTime(1, ac.currentTime + 0.05, 0.9);

  A.bus = ac.createGain();
  A.bus.connect(A.master);
  const conv = ac.createConvolver();
  conv.buffer = makeIR(ac, 3.4, 2.8);
  A.rev = ac.createGain();
  A.rev.gain.value = 0.55;
  A.rev.connect(conv);
  conv.connect(A.master);

  const n = ac.sampleRate * 2;
  A.noise = ac.createBuffer(1, n, ac.sampleRate);
  const nd = A.noise.getChannelData(0);
  for (let i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1;

  if (ac.state === 'suspended') ac.resume();
  A.ready = true;
  document.addEventListener('visibilitychange', () => {
    if (!A.ac) return;
    if (document.hidden) A.ac.suspend();
    else A.ac.resume();
  });
}

export const audioOn = () => A.ready && A.ac && A.ac.state === 'running';

// 声像 + 干/湿 + 可选低通（距离感）
export function voiceOut(pan = 0, dry = 0.6, wet = 0.5, lp = 0) {
  const ac = A.ac;
  const input = ac.createGain();
  let node = input;
  if (lp) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    f.Q.value = 0.5;
    node.connect(f);
    node = f;
  }
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    node.connect(p);
    node = p;
  }
  const d = ac.createGain();
  d.gain.value = dry;
  const w = ac.createGain();
  w.gain.value = wet;
  node.connect(d);
  node.connect(w);
  d.connect(A.bus);
  w.connect(A.rev);
  return input;
}
