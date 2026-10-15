// Procedural Web Audio API sound generator for military tactical effects
class TacticalAudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.isMuted = false;
    this.volume = 0.8;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.masterGain);
        this.setVolume(this.volume);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    this.setVolume(this.volume);
  }

  // Realistic Sniper Gunshot customized per weapon sound profile
  playSniperShot(soundProfile = "STANDARD", recoil = 0.05) {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    let blastPitch = 800;
    let subBassFreq = 160;
    let snapFreq = 2200;
    let decayTime = 0.35;

    if (soundProfile === "CRISP_LIGHT") {
      // Falcon XR: Crisp high-frequency report, rapid crack
      blastPitch = 1200;
      subBassFreq = 130;
      snapFreq = 2800;
      decayTime = 0.22;
    } else if (soundProfile === "HEAVY_PUNCH") {
      // Sentinel M4: Deep mechanical thump, heavy gunpowder boom
      blastPitch = 650;
      subBassFreq = 190;
      snapFreq = 1800;
      decayTime = 0.42;
    } else if (soundProfile === "DEEP_CANNON") {
      // Phantom X: Massive magnum roar, reverberating desert canyon echo
      blastPitch = 500;
      subBassFreq = 220;
      snapFreq = 1500;
      decayTime = 0.55;
    } else if (soundProfile === "SCI_FI_RAIL") {
      // Crosshair Protocol X: High-tech electromagnetic kinetic pulse
      blastPitch = 1400;
      subBassFreq = 120;
      snapFreq = 3400;
      decayTime = 0.45;
    }

    // 1. Noise transient (Muzzle blast)
    const bufferSize = Math.floor(this.ctx.sampleRate * decayTime);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(blastPitch, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + decayTime * 0.8);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(1.0, now);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

    noise.connect(filter);
    filter.connect(blastGain);
    blastGain.connect(this.sfxGain);
    noise.start(now);

    // 2. Heavy Sub Bass Thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(subBassFreq, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + decayTime * 0.7);

    oscGain.gain.setValueAtTime(1.0, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime * 0.85);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + decayTime);

    // 3. Supersonic crack / Snap
    const crack = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crack.type = soundProfile === "SCI_FI_RAIL" ? "sawtooth" : "triangle";
    crack.frequency.setValueAtTime(snapFreq, now);
    crack.frequency.exponentialRampToValueAtTime(soundProfile === "SCI_FI_RAIL" ? 500 : 300, now + 0.08);

    crackGain.gain.setValueAtTime(0.7, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    crack.connect(crackGain);
    crackGain.connect(this.sfxGain);
    crack.start(now);
    crack.stop(now + 0.12);
  }

  // Hit Target - satisfying tactical feedback with critical chime
  playHitConfirm(isHeadshot = false) {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isHeadshot ? "sine" : "triangle";
    osc.frequency.setValueAtTime(isHeadshot ? 1200 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 1900 : 180, now + 0.12);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);

    if (isHeadshot) {
      setTimeout(() => {
        if (!this.ctx) return;
        const chime = this.ctx.createOscillator();
        const chimeGain = this.ctx.createGain();
        chime.type = "sine";
        chime.frequency.setValueAtTime(2400, this.ctx.currentTime);
        chimeGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        chime.connect(chimeGain);
        chimeGain.connect(this.sfxGain);
        chime.start();
        chime.stop(this.ctx.currentTime + 0.2);
      }, 50);
    }
  }

  // Miss / Ricochet in sand or stone
  playMissRicochet() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(2800, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.22);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  // Bolt action cycling sound / reload click
  playBoltCycle() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [0, 0.12, 0.28].forEach((delay, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(idx === 1 ? 600 : 350, now + delay);
      osc.frequency.exponentialRampToValueAtTime(150, now + delay + 0.05);

      gain.gain.setValueAtTime(0.2, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.07);
    });
  }

  // Scope Zoom hum
  playScopeZoom(isZoomIn = true) {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(isZoomIn ? 300 : 700, now);
    osc.frequency.exponentialRampToValueAtTime(isZoomIn ? 750 : 250, now + 0.15);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  // Heartbeat when holding breath
  playHeartbeat() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // UI Beep
  playUiBeep(pitch = 880) {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.2, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Purchase sound (credits spent)
  playPurchase() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.16);
    });
  }

  // Victory fanfare
  playVictory() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.25, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.38);
    });
  }

  // Defeat / mission failed sound effect
  playDefeat() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [311.13, 277.18, 246.94, 207.65]; // D#4, C#4, B3, G#3 (descending ominous minor cadence)
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0.25, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.32);
    });
  }

  // Grand campaign completion fanfare (Level 20 Final Victory)
  playCampaignComplete() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C, E, G, C, E, G
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.3, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.5);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.55);
    });
  }
}

window.tacticalAudio = new TacticalAudioSystem();
