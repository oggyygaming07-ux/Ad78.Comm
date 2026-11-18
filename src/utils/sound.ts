let audioCtx: AudioContext | null = null;
let isMuted = false;

// Active Aviator continuous flight audio nodes
let flightOsc: OscillatorNode | null = null;
let flightSubOsc: OscillatorNode | null = null;
let flightGain: GainNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || isMuted) return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setSoundMuted(muted: boolean) {
  isMuted = muted;
  if (muted) {
    stopAviatorFlightLoop();
  }
}

export function getSoundMuted(): boolean {
  return isMuted;
}

/**
 * Clean soft tick during the final 5-second WinGo countdown (5..1).
 */
export function playCountdownTick(secondLeft: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(secondLeft === 1 ? 880 : 660, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {
    // Ignore autoplay restrictions
  }
}

/**
 * Crisp bell ring sound played right when a WinGo round result reveals.
 */
export function playResultRing() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const tones = [
      { freq: 1046.5, delay: 0, dur: 0.45, vol: 0.14 },
      { freq: 1567.98, delay: 0.04, dur: 0.5, vol: 0.1 },
      { freq: 2093.0, delay: 0.08, dur: 0.55, vol: 0.07 },
    ];
    tones.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.freq, now + t.delay);
      gain.gain.setValueAtTime(0.001, now + t.delay);
      gain.gain.exponentialRampToValueAtTime(t.vol, now + t.delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.delay + t.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t.delay);
      osc.stop(now + t.delay + t.dur + 0.02);
    });
  } catch {
    // Ignore
  }
}

export function playSirenBeep(secondLeft: number) {
  playCountdownTick(secondLeft);
}

export function playBetConfirm() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Ignore
  }
}

export function playWinChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.001, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.28);
    });
  } catch {
    // Ignore
  }
}

export function playLossTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.22);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Ignore
  }
}

/**
 * Real Aviator takeoff whoosh + rising propeller hum.
 */
export function playAviatorTakeoff() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.45);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.45);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.52);
  } catch {
    // Ignore
  }
}

/**
 * Continuous gentle aircraft engine climb loop while plane is flying.
 */
export function startAviatorFlightLoop(initialMultiplier = 1.0) {
  const ctx = getAudioContext();
  if (!ctx || flightOsc) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const baseFreq = Math.min(480, 130 + (initialMultiplier - 1) * 45);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(baseFreq * 0.5, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.2);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);

    flightOsc = osc;
    flightSubOsc = subOsc;
    flightGain = gain;
  } catch {
    // Ignore
  }
}

export function updateAviatorFlightPitch(multiplier: number) {
  if (!audioCtx || !flightOsc || !flightSubOsc || isMuted) return;
  try {
    const now = audioCtx.currentTime;
    const targetFreq = Math.min(540, 130 + Math.max(0, multiplier - 1) * 52);
    flightOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    flightSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.08);
  } catch {
    // Ignore
  }
}

export function stopAviatorFlightLoop() {
  try {
    if (flightGain && audioCtx) {
      flightGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.04);
    }
    const o1 = flightOsc;
    const o2 = flightSubOsc;
    setTimeout(() => {
      try {
        o1?.stop();
        o2?.stop();
        o1?.disconnect();
        o2?.disconnect();
      } catch {
        // Ignore
      }
    }, 90);
  } catch {
    // Ignore
  }
  flightOsc = null;
  flightSubOsc = null;
  flightGain = null;
}

/**
 * Aviator "Flew Away / Crash" descending turbine stall + whoosh sound.
 */
export function playAviatorCrash() {
  stopAviatorFlightLoop();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Descending turbine stall sweep
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.55);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.55);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);

    // 2. Low thud impact
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.25);
    subGain.gain.setValueAtTime(0.16, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.3);
  } catch {
    // Ignore
  }
}

export function playAviatorCashout() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [880, 1174.66, 1567.98].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.001, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.13, now + i * 0.05 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.27);
    });
  } catch {
    // Ignore
  }
}
