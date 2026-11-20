/**
 * Tiny synthesized sound layer. It avoids network audio assets while still
 * giving the runner footsteps, pickups, collisions and a low ambient pulse.
 */
export class MessRunAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private sfxEnabled: boolean;
  private musicEnabled: boolean;

  constructor(sfxEnabled = true, musicEnabled = true) {
    this.sfxEnabled = sfxEnabled;
    this.musicEnabled = musicEnabled;
  }

  get enabled(): boolean {
    return this.sfxEnabled;
  }

  setSfx(enabled: boolean): void {
    this.sfxEnabled = enabled;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(enabled ? 0.28 : 0, this.context.currentTime, 0.04);
    }
  }

  setMusic(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) this.stopMusic();
    else if (this.context) this.startMusic();
  }

  async resume(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
    if (this.musicEnabled) this.startMusic();
  }

  footstep(heavy = false): void {
    const base = heavy ? 120 : 155;
    this.tone(base, heavy ? 0.055 : 0.04, "triangle", heavy ? 0.035 : 0.02, -18);
  }

  jump(): void {
    this.sweep(330, 680, 0.14, 0.035);
  }

  slide(): void {
    this.noise(0.13, 0.04, 440);
  }

  coin(): void {
    this.tone(740, 0.07, "sine", 0.05);
    window.setTimeout(() => this.tone(1080, 0.09, "sine", 0.035), 55);
  }

  nearMiss(): void {
    this.tone(520, 0.045, "sine", 0.02);
  }

  hit(): void {
    this.tone(92, 0.22, "sawtooth", 0.09, -10);
    this.noise(0.16, 0.07, 220);
  }

  power(): void {
    this.sweep(420, 1320, 0.28, 0.05);
    window.setTimeout(() => this.tone(1560, 0.16, "sine", 0.025), 130);
  }

  catch(): void {
    this.tone(70, 0.5, "sawtooth", 0.12, -22);
    this.noise(0.35, 0.08, 150);
  }

  success(): void {
    [523, 659, 784, 1046].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.22, "triangle", 0.04), index * 110);
    });
  }

  dispose(): void {
    this.stopMusic();
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
    this.master = null;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;
    const Ctor = window.AudioContext;
    if (!Ctor) return null;
    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.gain.value = this.sfxEnabled ? 0.28 : 0;
    this.master.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.05;
    this.musicGain.connect(this.context.destination);
    return this.context;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    detune = 0,
  ): void {
    if (!this.sfxEnabled) return;
    const context = this.ensureContext();
    if (!context || !this.master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private sweep(from: number, to: number, duration: number, volume: number): void {
    if (!this.sfxEnabled) return;
    const context = this.ensureContext();
    if (!context || !this.master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private noise(duration: number, volume: number, lowpass: number): void {
    if (!this.sfxEnabled) return;
    const context = this.ensureContext();
    if (!context || !this.master) return;
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  private startMusic(): void {
    if (!this.musicEnabled || !this.context || !this.musicGain || this.musicOscillators.length) {
      return;
    }
    const now = this.context.currentTime;
    const frequencies = [55, 82.5, 110];
    this.musicOscillators = frequencies.map((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.45 : 0.16;
      oscillator.connect(gain);
      gain.connect(this.musicGain!);
      oscillator.start(now);
      return oscillator;
    });
  }

  private stopMusic(): void {
    for (const oscillator of this.musicOscillators) {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
    }
    this.musicOscillators = [];
  }
}
