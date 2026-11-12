import { DEFAULT_SETTINGS, type GameSettings } from "./types";

/**
 * Fully procedural ambience and SFX through WebAudio. No audio assets to load,
 * which keeps the prototype light and lets everything start on first gesture.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private started = false;
  private droneNodes: OscillatorNode[] = [];
  private birdTimer = 2.2;
  private night = false;
  private cricketTimer = 0.4;

  async unlock(): Promise<void> {
    if (this.started) {
      if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    try {
      const context = new AudioContext();
      this.ctx = context;
      this.master = context.createGain();
      this.master.gain.value = this.settings.volume;
      this.master.connect(context.destination);

      this.musicGain = context.createGain();
      this.musicGain.gain.value = this.settings.music ? 0.5 : 0;
      this.musicGain.connect(this.master);

      this.sfxGain = context.createGain();
      this.sfxGain.gain.value = this.settings.sfx ? 0.85 : 0;
      this.sfxGain.connect(this.master);

      this.noiseBuffer = this.createNoise(context);
      this.startAmbience(context);
      this.started = true;
      if (context.state === "suspended") await context.resume();
    } catch {
      this.started = false;
    }
  }

  private createNoise(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  private startAmbience(context: AudioContext): void {
    if (!this.noiseBuffer || !this.musicGain) return;
    const wind = context.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = context.createGain();
    gain.gain.value = 0.09;
    wind.connect(filter).connect(gain).connect(this.musicGain);
    wind.start();

    // Warm pad — two detuned oscillators, very quiet.
    [110, 164.8].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 0 ? -6 : 8;
      const padGain = context.createGain();
      padGain.gain.value = 0.02;
      oscillator.connect(padGain).connect(this.musicGain!);
      oscillator.start();
      this.droneNodes.push(oscillator);
    });
  }

  setNight(night: boolean): void {
    this.night = night;
    this.birdTimer = 0.6;
    this.cricketTimer = 0.25;
  }

  setSettings(settings: GameSettings): void {
    this.settings = settings;
    if (this.ctx && this.master && this.musicGain && this.sfxGain) {
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(settings.volume, now, 0.08);
      this.musicGain.gain.setTargetAtTime(settings.music ? 0.5 : 0, now, 0.15);
      this.sfxGain.gain.setTargetAtTime(settings.sfx ? 0.85 : 0, now, 0.05);
    }
  }

  update(dt: number): void {
    if (!this.started || !this.ctx || !this.settings.music) return;
    if (this.night) {
      this.cricketTimer -= dt;
      if (this.cricketTimer <= 0) {
        this.cricketTimer = 0.8 + Math.random() * 2.2;
        this.cricket();
      }
      return;
    }
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 4 + Math.random() * 9;
      this.chirp();
    }
  }

  private cricket(): void {
    const context = this.ctx;
    if (!context || !this.musicGain) return;
    const start = context.currentTime + Math.random() * 0.05;
    const base = 3000 + Math.random() * 900;
    for (let i = 0; i < 3; i += 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(base, start + i * 0.065);
      gain.gain.setValueAtTime(0.0001, start + i * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.018, start + i * 0.065 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.065 + 0.045);
      oscillator.connect(gain).connect(this.musicGain);
      oscillator.start(start + i * 0.065);
      oscillator.stop(start + i * 0.065 + 0.06);
    }
  }

  private chirp(): void {
    const context = this.ctx;
    if (!context || !this.musicGain) return;
    const start = context.currentTime + Math.random() * 0.1;
    const base = 1900 + Math.random() * 1100;
    for (let i = 0; i < 3; i += 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(base + i * 180, start + i * 0.12);
      oscillator.frequency.exponentialRampToValueAtTime(base + 520, start + i * 0.12 + 0.07);
      gain.gain.setValueAtTime(0.0001, start + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.05, start + i * 0.12 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.12 + 0.1);
      oscillator.connect(gain).connect(this.musicGain);
      oscillator.start(start + i * 0.12);
      oscillator.stop(start + i * 0.12 + 0.16);
    }
  }

  private noiseBurst(duration: number, frequency: number, volume: number, type: BiquadFilterType = "bandpass"): void {
    const context = this.ctx;
    if (!context || !this.sfxGain || !this.noiseBuffer) return;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  private tone(frequency: number, duration: number, volume: number, delay = 0, type: OscillatorType = "sine"): void {
    const context = this.ctx;
    if (!context || !this.sfxGain) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    const start = context.currentTime + delay;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  footstep(): void {
    this.noiseBurst(0.15, 240 + Math.random() * 90, 0.12, "lowpass");
  }

  uiClick(): void {
    this.tone(720, 0.07, 0.045, 0, "triangle");
  }

  door(): void {
    this.noiseBurst(0.45, 320, 0.1, "lowpass");
    this.tone(120, 0.5, 0.05, 0, "sawtooth");
  }

  chime(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.tone(frequency, 1.1, 0.07, index * 0.14, "sine");
    });
  }

  dispose(): void {
    for (const oscillator of this.droneNodes) {
      try {
        oscillator.stop();
      } catch {
        /* already stopped */
      }
    }
    this.droneNodes = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.started = false;
  }
}
