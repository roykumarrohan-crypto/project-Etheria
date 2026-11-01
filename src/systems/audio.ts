// Procedural Web Audio API synthesizer for Project Etheria
// Zero external audio asset dependencies; pitch-varied (±8%) weight-scaled effects

class EtheriaAudioSystem {
  private ctx: AudioContext | null = null;
  private masterVolume = 0.75;
  private sfxEnabled = true;
  private musicEnabled = true;
  private isMuted = false;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || navigator.webdriver) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public configure(opts: {
    masterVolume?: number;
    sfxEnabled?: boolean;
    musicEnabled?: boolean;
    isMuted?: boolean;
  }) {
    if (opts.masterVolume !== undefined) this.masterVolume = opts.masterVolume;
    if (opts.sfxEnabled !== undefined) this.sfxEnabled = opts.sfxEnabled;
    if (opts.musicEnabled !== undefined) this.musicEnabled = opts.musicEnabled;
    if (opts.isMuted !== undefined) this.isMuted = opts.isMuted;

    if (this.droneGain && this.ctx) {
      const target =
        this.isMuted || !this.musicEnabled ? 0 : 0.035 * this.masterVolume;
      this.droneGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.configure({ isMuted: this.isMuted });
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public startAmbientMusic() {
    const ctx = this.ensureContext();
    if (!ctx || this.droneOsc) return;
    try {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, ctx.currentTime); // A2 warm fantasy drone
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, ctx.currentTime);

      const initialGain =
        this.isMuted || !this.musicEnabled ? 0 : 0.035 * this.masterVolume;
      gain.gain.setValueAtTime(initialGain, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.droneOsc = osc;
      this.droneGain = gain;
    } catch {
      // Ignore autoplay blocks
    }
  }

  public stopAmbientMusic() {
    if (this.droneOsc) {
      try {
        this.droneOsc.stop();
        this.droneOsc.disconnect();
      } catch {
        // ignore
      }
      this.droneOsc = null;
      this.droneGain = null;
    }
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.2
  ) {
    if (this.isMuted || !this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const pitchJitter = 1 + (Math.random() * 0.16 - 0.08); // ±8% pitch variation
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(25, freqEnd * pitchJitter),
        now + duration
      );

      const finalVol = Math.min(0.45, volume * this.masterVolume);
      gain.gain.setValueAtTime(finalVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // ignore
    }
  }

  public playFootstep() {
    this.playTone(130, 65, 0.055, 'sine', 0.06);
  }

  public playAttackSwing() {
    this.playTone(320, 110, 0.11, 'triangle', 0.16);
  }

  public playSpellCast() {
    this.playTone(480, 760, 0.18, 'sine', 0.18);
  }

  public playHitEnemy(isHeavy = false) {
    if (isHeavy) {
      this.playTone(190, 52, 0.19, 'sawtooth', 0.25);
      setTimeout(() => this.playTone(580, 880, 0.12, 'triangle', 0.15), 25);
    } else {
      this.playTone(230, 85, 0.1, 'square', 0.14);
    }
  }

  public playPlayerHurt() {
    this.playTone(165, 58, 0.22, 'sawtooth', 0.26);
  }

  public playDodge() {
    this.playTone(240, 420, 0.13, 'sine', 0.14);
  }

  public playPickupOrGather() {
    this.playTone(520, 780, 0.14, 'triangle', 0.16);
  }

  public playPotion() {
    this.playTone(380, 640, 0.18, 'sine', 0.18);
  }

  public playLevelUpOrQuest() {
    this.playTone(440, 660, 0.16, 'triangle', 0.2);
    setTimeout(() => this.playTone(660, 880, 0.24, 'triangle', 0.22), 110);
  }

  public playUiClick() {
    this.playTone(620, 480, 0.045, 'sine', 0.08);
  }
}

export const audio = new EtheriaAudioSystem();
