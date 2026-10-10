/**
 * Background chiptune synthesized with the Web Audio API (no audio files to ship or license).
 * On by default; the on/off preference is remembered per browser. Browsers block audio
 * until a user gesture, so an enabled track starts at the first tap.
 */

const STORAGE_KEY = 'tennis-iq-music';
const BPM = 128;
const EIGHTH = 60 / BPM / 2;
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const VOLUME = 0.05;

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as AudioWindow;
  return w.AudioContext ?? w.webkitAudioContext;
}

// One bar per chord (C – Am – F – G), eight eighth-notes per bar. MIDI numbers; null = rest.
const MELODY: (number | null)[] = [
  76, 79, 84, 79, 76, 74, 72, 74,
  76, null, 72, 69, 72, 76, 81, 79,
  77, 81, 84, 81, 77, 76, 77, 79,
  79, 83, 86, 83, 79, null, 74, 71,
  76, 79, 84, 86, 84, 79, 76, 79,
  81, null, 76, 72, 69, 72, 76, 72,
  77, 76, 77, 81, 84, 81, 77, 76,
  74, 79, 83, 79, 74, 71, 72, null,
];
const BASS_ROOTS = [36, 33, 29, 31, 36, 33, 29, 31];
const BASS_PATTERN = [0, 12, 7, 12, 0, 12, 7, 12];

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type Listener = (on: boolean) => void;

function readPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writePref(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the toggle still works for this visit.
  }
}

class MusicPlayer {
  private enabled = readPref();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window === 'undefined') return;
    // A remembered "on" can only start after a gesture.
    const unlock = () => {
      if (this.enabled) this.start();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (this.enabled) void this.ctx.resume();
    });
  }

  get supported() {
    return !!audioContextCtor();
  }

  isOn() {
    return this.enabled;
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  /** Must be called from a user gesture (click/tap) to be allowed to play. */
  toggle() {
    this.setOn(!this.enabled);
  }

  setOn(on: boolean) {
    this.enabled = on;
    writePref(on);
    if (on) this.start();
    else this.stop();
    for (const l of [...this.listeners]) l(on);
  }

  private start() {
    if (!this.supported || this.timer) return;
    if (!this.ctx) {
      const AudioCtx = audioContextCtor();
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.05);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master!.gain.cancelScheduledValues(t);
    this.master!.gain.setValueAtTime(0, t);
    this.master!.gain.linearRampToValueAtTime(VOLUME, t + 0.5);
    this.step = 0;
    this.nextTime = t + 0.05;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.25);
    const ctx = this.ctx;
    setTimeout(() => !this.enabled && void ctx.suspend(), 300);
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % MELODY.length;
      this.nextTime += EIGHTH;
    }
  }

  private playStep(step: number, t: number) {
    const lead = MELODY[step];
    if (lead != null) this.tone('square', freq(lead), t, EIGHTH * 0.9, 0.35);
    const bar = Math.floor(step / 8);
    this.tone('triangle', freq(BASS_ROOTS[bar]! + BASS_PATTERN[step % 8]!), t, EIGHTH * 0.8, 0.9);
    if (step % 4 === 0) this.kick(t);
    if (step % 2 === 1) this.hat(t);
  }

  private tone(type: OscillatorType, hz: number, t: number, dur: number, level: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, t);
    env.gain.setValueAtTime(level, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(env).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private hat(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = this.noise;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    env.gain.setValueAtTime(0.25, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(filter).connect(env).connect(this.master!);
    src.start(t);
  }
}

export const music = new MusicPlayer();

type SfxKind = 'click' | 'correct' | 'wrong';

class SfxPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  get supported() {
    return !!audioContextCtor();
  }

  play(kind: SfxKind) {
    if (!this.supported) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state !== 'running') void ctx.resume();

    const t = ctx.currentTime + 0.005;
    if (kind === 'click') {
      this.tone('square', 880, t, 0.045, 0.12, 520);
      return;
    }
    if (kind === 'correct') {
      this.tone('square', 523.25, t, 0.075, 0.12);
      this.tone('square', 659.25, t + 0.07, 0.08, 0.12);
      this.tone('square', 783.99, t + 0.14, 0.12, 0.14);
      return;
    }
    this.tone('sawtooth', 220, t, 0.11, 0.12, 164.81);
    this.tone('square', 146.83, t + 0.1, 0.16, 0.1, 110);
  }

  click() {
    this.play('click');
  }

  answer(correct: boolean) {
    this.play(correct ? 'correct' : 'wrong');
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    const AudioCtx = audioContextCtor();
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private tone(type: OscillatorType, hz: number, t: number, dur: number, level: number, endHz = hz) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, t);
    if (endHz !== hz) osc.frequency.exponentialRampToValueAtTime(endHz, t + dur);
    env.gain.setValueAtTime(0.001, t);
    env.gain.exponentialRampToValueAtTime(level, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

export const sfx = new SfxPlayer();
