export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {}

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Footstep thud synth.
   */
  public playStep() {
    if (this.isMuted || !this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Door opening creak synth.
   */
  public playDoorCreak() {
    if (this.isMuted || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Deep rumble oscillator
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.8);
      osc.frequency.linearRampToValueAtTime(45, now + 1.2);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Solid mechanical door close / latch click synth.
   */
  public playDoorClose() {
    if (this.isMuted || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Heavy door thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.15);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);

      // High latch click
      const click = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();

      click.type = 'square';
      click.frequency.setValueAtTime(800, now + 0.1);
      click.frequency.exponentialRampToValueAtTime(200, now + 0.14);

      clickGain.gain.setValueAtTime(0.12, now + 0.1);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      click.connect(clickGain);
      clickGain.connect(this.ctx.destination);

      click.start(now + 0.1);
      click.stop(now + 0.14);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Magical chime for room entry.
   */
  public playMagicChime() {
    if (this.isMuted || !this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        const startTime = this.ctx!.currentTime + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });
    } catch {
      // Audio fallback
    }
  }
}
