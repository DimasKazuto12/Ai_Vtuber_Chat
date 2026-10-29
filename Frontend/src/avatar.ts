import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

(window as any).PIXI = PIXI;

type Params = Record<string, number>;

/** Satu kalimat dalam jawaban. start/end (detik) boleh kosong, nanti diperkirakan dari audio. */
export interface Cue {
  text: string;
  emotion: string;
  start?: number | null;
  end?: number | null;
}
export interface ResolvedCue {
  text: string;
  emotion: string;
  start: number;
  end: number;
}

interface Emotion {
  params: Params;
  eyeOpen?: number;
  mouthOpen?: number;
  mouthScale?: number;
  motion?: number;
  gazeX?: number;
  gazeY?: number;
  laugh?: boolean;
  blend?: number; // detik untuk berpindah ke ekspresi ini
}

/** Arah nilai (+/-) tiap model bisa berbeda. Uji lewat console: avatar.setEmotion("sad") */
const EMOTIONS: Record<string, Emotion> = {
  neutral: { params: {}, blend: 0.45 },
  happy: {
    params: { ParamEyeLSmile: 0.7, ParamEyeRSmile: 0.7, ParamMouthForm: 0.9, ParamCheek: 0.6, ParamBrowLY: 0.3, ParamBrowRY: 0.3, ParamAngleZ: 3 },
    blend: 0.3,
  },
  laughing: {
    params: { ParamEyeLSmile: 1, ParamEyeRSmile: 1, ParamMouthForm: 1, ParamCheek: 1, ParamBrowLY: 0.5, ParamBrowRY: 0.5, ParamAngleY: 5, ParamAngleZ: 4 },
    eyeOpen: 0.6, mouthOpen: 0.3, mouthScale: 1.3, motion: 1.6, laugh: true, blend: 0.22,
  },
  sad: {
    params: { ParamMouthForm: -0.9, ParamBrowLY: -0.3, ParamBrowRY: -0.3, ParamBrowLAngle: 0.8, ParamBrowRAngle: 0.8, ParamAngleY: -6, ParamAngleZ: -3, ParamBodyAngleY: -2 },
    eyeOpen: 0.8, mouthScale: 0.6, motion: 0.5, gazeY: -0.35, blend: 0.5,
  },
  angry: {
    params: { ParamMouthForm: -0.6, ParamBrowLY: -0.6, ParamBrowRY: -0.6, ParamBrowLAngle: -0.8, ParamBrowRAngle: -0.8, ParamBrowLForm: -0.5, ParamBrowRForm: -0.5, ParamAngleY: 2 },
    eyeOpen: 0.9, mouthScale: 1.1, motion: 1.2, blend: 0.25,
  },
  surprised: {
    params: { ParamBrowLY: 0.9, ParamBrowRY: 0.9, ParamAngleY: 3, ParamBodyAngleY: 2 },
    mouthOpen: 0.35, motion: 1.2, blend: 0.15,
  },
  relaxed: {
    params: { ParamEyeLSmile: 0.5, ParamEyeRSmile: 0.5, ParamMouthForm: 0.5, ParamCheek: 0.5, ParamAngleZ: -3 },
    eyeOpen: 0.9, motion: 0.7, blend: 0.45,
  },
  shy: {
    params: { ParamEyeLSmile: 0.4, ParamEyeRSmile: 0.4, ParamMouthForm: 0.3, ParamCheek: 1, ParamBrowLY: 0.2, ParamAngleX: -5, ParamAngleY: -3, ParamAngleZ: 4 },
    eyeOpen: 0.9, mouthScale: 0.8, gazeX: 0.35, gazeY: -0.2, blend: 0.35,
  },
};

const EMOTION_PARAMS = [...new Set(Object.values(EMOTIONS).flatMap((e) => Object.keys(e.params)))];

const MOTION = {
  head: 1.2,       // goyang kepala saat diam (derajat), 0 = diam
  body: 0.8,       // goyang badan saat diam
  gaze: 0.12,      // gerak bola mata saat diam
  talkBoost: 2.2,  // gerakan saat bicara = gerakan diam x angka ini
};
const LIPSYNC = { gain: 1.15, attack: 28, release: 11 };
const ANTICIPATION = 0.2; // ekspresi berganti sedikit lebih awal dari kalimatnya
const VIEW = { zoom: 1.0, offsetX: 0, offsetY: 0 };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export class Avatar {
  onSpeakingChange?: (speaking: boolean) => void;
  onEmotionChange?: (emotion: string) => void;

  private canvas: HTMLCanvasElement;
  private app: PIXI.Application;
  private model?: Live2DModel;
  private baseW = 1;
  private baseH = 1;

  private audioCtx = new AudioContext();
  private analyser = this.audioCtx.createAnalyser();
  private timeData = new Uint8Array(1024);
  private freqData = new Uint8Array(512);
  private peak = 0.1;

  private speaking = false;
  private emotion = "neutral";
  private resetTimer = 0;
  private timeline: ResolvedCue[] = [];
  private startAt = 0;
  private emoIdx = -1;
  private textIdx = -1;
  private onCue?: (index: number, cue: ResolvedCue) => void;

  private overrides: Params = {};
  private levels: Params = {};
  private vels: Params = {};
  private eyeOpen = 1;
  private mouthBase = 0;
  private mouthScale = 1;
  private motionScale = 1;
  private gazeBias = { x: 0, y: 0 };
  private gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
  private mouth = 0;
  private env = 0;
  private prevLevel = 0;
  private nodTime = 99;
  private talkAmt = 0;
  private laughAmt = 0;
  private blinkStart = -1;
  private nextBlink = 0;
  private lastT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.app = new PIXI.Application({
      view: canvas,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.5;
    this.analyser.connect(this.audioCtx.destination);

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  async load(url: string) {
    const model = await Live2DModel.from(url, { autoInteract: false });
    this.baseW = model.width;
    this.baseH = model.height;
    this.model = model;

    (model.internalModel as any).breath = undefined; // napas diatur sendiri lewat ParamBreath
    this.app.stage.addChild(model);
    this.layout();

    this.lastT = performance.now() / 1000;
    this.nextBlink = this.lastT + 2;
    // Dipanggil sebelum physics, jadi rambut/pita/telinga ikut bergoyang
    model.internalModel.on("afterMotionUpdate", this.onAfterMotion);
  }

  /**
   * Memutar SATU klip audio utuh. Ekspresi dan teks berganti mengikuti garis waktu kalimat.
   * Promise selesai saat audio habis.
   */
  async speak(
    audioB64: string,
    cues: Cue[],
    onCue?: (index: number, cue: ResolvedCue) => void,
  ) {
    await this.audioCtx.resume();
    window.clearTimeout(this.resetTimer);

    const buffer = await this.decode(audioB64);
    this.timeline = this.buildTimeline(buffer, cues.length ? cues : [{ text: "", emotion: "neutral" }]);
    this.onCue = onCue;
    this.emoIdx = 0;
    this.textIdx = 0;
    this.setEmotion(this.timeline[0].emotion);
    this.onCue?.(0, this.timeline[0]);

    this.speaking = true;
    this.onSpeakingChange?.(true);
    await new Promise<void>((resolve) => {
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.analyser);
      source.onended = () => resolve();
      this.startAt = this.audioCtx.currentTime + 0.05;
      source.start(this.startAt);
    });

    this.speaking = false;
    this.timeline = [];
    this.onSpeakingChange?.(false);
    // Ekspresi terakhir ditahan sebentar sebelum kembali netral
    this.resetTimer = window.setTimeout(() => this.setEmotion("neutral"), 900);
  }

  /** Reaksi saat avatar diklik: kaget, lalu malu. */
  poke() {
    if (this.speaking) return;
    window.clearTimeout(this.resetTimer);
    this.setEmotion("surprised");
    this.resetTimer = window.setTimeout(() => {
      this.setEmotion("shy");
      this.resetTimer = window.setTimeout(() => this.setEmotion("neutral"), 1600);
    }, 700);
  }

  // ----- alat uji (console saat development) -----
  setEmotion(emotion: string) {
    const next = emotion in EMOTIONS ? emotion : "neutral";
    if (next === this.emotion) return;
    this.emotion = next;
    this.onEmotionChange?.(next);
  }
  setParam(id: string, value: number) {
    this.overrides[id] = value;
  }
  clearParams() {
    this.overrides = {};
  }

  // ----- internal -----
  private async decode(base64: string) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return this.audioCtx.decodeAudioData(bytes.buffer as ArrayBuffer);
  }

  /** Waktu mulai/selesai tiap kalimat: dari provider, atau diperkirakan lalu "ditempelkan" ke jeda di audio. */
  private buildTimeline(buffer: AudioBuffer, cues: Cue[]): ResolvedCue[] {
    if (cues.every((c) => c.start != null && c.end != null)) {
      return cues.map((c) => ({ text: c.text, emotion: c.emotion, start: c.start as number, end: c.end as number }));
    }

    const win = Math.max(1, Math.round(buffer.sampleRate * 0.02));
    const dt = win / buffer.sampleRate;
    const data = buffer.getChannelData(0);
    const env: number[] = [];
    let peak = 0;
    for (let i = 0; i + win <= data.length; i += win) {
      let s = 0;
      for (let j = 0; j < win; j++) s += data[i + j] * data[i + j];
      const r = Math.sqrt(s / win);
      env.push(r);
      if (r > peak) peak = r;
    }
    const thr = peak * 0.1;
    const first = Math.max(0, env.findIndex((v) => v > thr));
    let last = env.length - 1;
    while (last > first && env[last] <= thr) last--;
    const t0 = first * dt;
    const t1 = (last + 1) * dt;

    const weights = cues.map((c) => c.text.length + 6 * (c.text.match(/[.,!?…]/g)?.length ?? 0));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const bounds: number[] = [t0];
    let acc = 0;
    for (let i = 0; i < cues.length - 1; i++) {
      acc += weights[i];
      let b = t0 + (t1 - t0) * (acc / total);

      // tempelkan ke jeda (senyap) terdekat
      const radius = Math.min(1.2, (t1 - t0) * 0.2);
      const from = Math.max(0, Math.floor((b - radius) / dt));
      const to = Math.min(env.length - 1, Math.ceil((b + radius) / dt));
      let best = -1;
      let bestDist = Infinity;
      for (let k = from; k <= to; ) {
        if (env[k] < thr) {
          let e = k;
          while (e + 1 <= to && env[e + 1] < thr) e++;
          if (e - k + 1 >= 3) {
            const center = ((k + e + 1) / 2) * dt;
            const d = Math.abs(center - b);
            if (d < bestDist) {
              bestDist = d;
              best = center;
            }
          }
          k = e + 1;
        } else {
          k++;
        }
      }
      if (best >= 0) b = best;
      bounds.push(Math.max(b, bounds[bounds.length - 1] + 0.1));
    }
    bounds.push(t1);
    return cues.map((c, i) => ({ text: c.text, emotion: c.emotion, start: bounds[i], end: bounds[i + 1] }));
  }

  private updateCues() {
    if (!this.speaking || this.timeline.length === 0) return;
    const el = this.audioCtx.currentTime - this.startAt;
    let emo = 0;
    let txt = 0;
    this.timeline.forEach((c, i) => {
      if (el + ANTICIPATION >= c.start) emo = i;
      if (el >= c.start) txt = i;
    });
    if (emo !== this.emoIdx) {
      this.emoIdx = emo;
      this.setEmotion(this.timeline[emo].emotion);
    }
    if (txt !== this.textIdx) {
      this.textIdx = txt;
      this.onCue?.(txt, this.timeline[txt]);
    }
  }

  /** Volume ternormalisasi (0..1) dan nada suara (0 = "oo" bulat, 1 = "ee" lebar). */
  private readVoice() {
    this.analyser.getByteTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.timeData.length);
    this.peak = Math.max(rms, this.peak * 0.995);
    const level = rms < 0.015 ? 0 : clamp(rms / Math.max(this.peak, 0.08));

    this.analyser.getByteFrequencyData(this.freqData);
    let weighted = 0;
    let total = 0;
    for (let i = 2; i < 40; i++) {
      weighted += i * this.freqData[i];
      total += this.freqData[i];
    }
    const centroid = total > 0 ? weighted / total : 15;
    return { level, tone: clamp((centroid - 6) / 18) };
  }

  /** Smooth damping: bergerak halus tanpa lonjakan kecepatan. */
  private damp(key: string, cur: number, target: number, smoothTime: number, dt: number) {
    const omega = 2 / Math.max(0.0001, smoothTime);
    const x = omega * dt;
    const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = cur - target;
    const v = this.vels[key] ?? 0;
    const temp = (v + omega * change) * dt;
    this.vels[key] = (v - omega * temp) * k;
    return target + (change + temp) * k;
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.app.renderer.resize(w, h);
    this.layout();
  }

  private layout() {
    const m = this.model;
    if (!m) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    m.scale.set(Math.min((w * 0.95) / this.baseW, (h * 0.85) / this.baseH) * VIEW.zoom);
    m.anchor.set(0.5, 0.5);
    m.position.set(w / 2 + VIEW.offsetX * w, h * 0.46 + VIEW.offsetY * h);
  }

  private onAfterMotion = () => {
    const core = this.model?.internalModel.coreModel as any;
    if (!core) return;

    const t = performance.now() / 1000;
    const dt = clamp(t - this.lastT, 0.001, 0.1);
    this.lastT = t;
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);

    this.updateCues();

    const emo = EMOTIONS[this.emotion] ?? EMOTIONS.neutral;
    const bt = emo.blend ?? 0.3;
    const out: Params = {};
    const add = (id: string, v: number) => {
      out[id] = (out[id] ?? 0) + v;
    };

    // 1. Ekspresi: tiap bagian punya kecepatan sendiri (mulut/pipi dulu, alis lalu kepala menyusul)
    for (const id of EMOTION_PARAMS) {
      const f = id.startsWith("ParamAngle") || id.startsWith("ParamBody") ? 1.7 : id.startsWith("ParamBrow") ? 1.2 : 1;
      this.levels[id] = this.damp(id, this.levels[id] ?? 0, emo.params[id] ?? 0, bt * f, dt);
      out[id] = this.levels[id];
    }
    this.eyeOpen = this.damp("_eye", this.eyeOpen, emo.eyeOpen ?? 1, bt * 0.7, dt);
    this.mouthBase = this.damp("_mb", this.mouthBase, emo.mouthOpen ?? 0, bt, dt);
    this.mouthScale = this.damp("_ms", this.mouthScale, emo.mouthScale ?? 1, bt, dt);
    this.motionScale = this.damp("_mo", this.motionScale, emo.motion ?? 1, bt, dt);
    this.gazeBias.x = this.damp("_gx", this.gazeBias.x, emo.gazeX ?? 0, bt, dt);
    this.gazeBias.y = this.damp("_gy", this.gazeBias.y, emo.gazeY ?? 0, bt, dt);
    this.talkAmt = this.damp("_ta", this.talkAmt, this.speaking ? 1 : 0, 0.5, dt);
    this.laughAmt = clamp(this.damp("_la", this.laughAmt, emo.laugh && this.speaking ? 1 : 0, 0.2, dt));

    // 2. Suara: lip sync, anggukan, alis
    let level = 0;
    let tone = 0.5;
    if (this.speaking) ({ level, tone } = this.readVoice());

    const target = clamp(level * LIPSYNC.gain * this.mouthScale);
    this.mouth += (target - this.mouth) * ease(target > this.mouth ? LIPSYNC.attack : LIPSYNC.release);
    this.env += (level - this.env) * ease(4);

    // Anggukan hanya di tekanan kata yang kuat, berbentuk gelombang halus (bukan lompatan)
    this.nodTime += dt;
    if (this.speaking && level > 0.65 && level - this.prevLevel > 0.25 && this.nodTime > 1.2) this.nodTime = 0;
    this.prevLevel = level;
    const p = this.nodTime / 0.45;
    const nod = p < 1 ? Math.sin(Math.PI * p) : 0;

    // 3. Gerak: kecil saat diam, lebih hidup saat bicara
    const m = this.motionScale * (1 + this.talkAmt * (MOTION.talkBoost - 1));
    add("ParamAngleX", Math.sin(t * 0.5) * MOTION.head * m);
    add("ParamAngleY", Math.sin(t * 0.37 + 1) * MOTION.head * 0.6 * m - nod * 2.2 - this.env * 0.6);
    add("ParamAngleZ", Math.sin(t * 0.43 + 2) * MOTION.head * 0.5 * m);
    add("ParamBodyAngleX", Math.sin(t * 0.3) * MOTION.body * m);
    add("ParamBodyAngleZ", Math.sin(t * 0.26 + 1) * MOTION.body * 0.5 * m);
    add("ParamBodyAngleY", -nod * 0.8);
    add("ParamBrowLY", this.env * 0.12);
    add("ParamBrowRY", this.env * 0.12);
    out.ParamBreath = (Math.sin(t * 1.4) + 1) / 2;

    // 4. Tertawa: mulut berdenyut "ha-ha-ha", bahu dan kepala terguncang
    let laughMouth = 0;
    const L = this.laughAmt;
    if (L > 0.01) {
      const ph = t * Math.PI * 2 * 5.5;
      laughMouth = L * (0.3 + 0.6 * ((Math.sin(ph) + 1) / 2));
      add("ParamAngleY", L * Math.sin(ph) * 1.6);
      add("ParamBodyAngleY", L * Math.sin(ph) * 1.4);
      add("ParamBodyAngleZ", L * Math.sin(ph * 0.5) * 1.8);
      add("ParamAngleZ", L * Math.sin(ph * 0.5) * 1.5);
    }

    // 5. Mulut: bukaan dari volume, bentuk dari nada suara
    out.ParamMouthOpenY = Math.max(this.mouth, this.mouthBase, laughMouth);
    add("ParamMouthForm", (tone - 0.5) * 0.7 * this.mouth);

    // 6. Bola mata
    const g = this.gaze;
    if (t > g.next) {
      g.tx = (Math.random() * 2 - 1) * MOTION.gaze;
      g.ty = (Math.random() * 2 - 1) * MOTION.gaze;
      g.next = t + 2 + Math.random() * 4;
    }
    g.x += (g.tx - g.x) * ease(4);
    g.y += (g.ty - g.y) * ease(4);
    out.ParamEyeBallX = g.x + this.gazeBias.x;
    out.ParamEyeBallY = g.y + this.gazeBias.y;

    // 7. Kedip (ParamEyeROpen juga memicu telinga dan ahoge lewat physics)
    let blink = 1;
    if (this.blinkStart < 0 && t > this.nextBlink) this.blinkStart = t;
    if (this.blinkStart >= 0) {
      const q = (t - this.blinkStart) / 0.18;
      if (q >= 1) {
        this.blinkStart = -1;
        this.nextBlink = t + 2.5 + Math.random() * 3.5;
      } else {
        blink = 1 - Math.sin(q * Math.PI);
      }
    }
    out.ParamEyeLOpen = this.eyeOpen * blink;
    out.ParamEyeROpen = this.eyeOpen * blink;

    Object.assign(out, this.overrides);
    for (const [id, value] of Object.entries(out)) core.setParameterValueById(id, value);
  };
}