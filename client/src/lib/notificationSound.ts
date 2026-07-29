'use client';

// Web Audio API Notification Sound Engine
let audioCtx: AudioContext | null = null;
let isUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

// Unlock AudioContext on first user interaction to comply with browser autoplay policies
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        isUnlocked = true;
      }).catch(console.error);
    } else {
      isUnlocked = true;
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };

  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

/**
 * Play a crystal-clear synthesized notification chime for messages, tasks, or reminders.
 */
export function playNotificationSound(type: 'message' | 'task' | 'reminder' = 'message') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === 'message') {
      // Soft double-ding (520Hz -> 660Hz)
      playTone(ctx, 520, now, 0.08, 'sine', 0.15);
      playTone(ctx, 660, now + 0.09, 0.12, 'sine', 0.18);
    } else if (type === 'task') {
      // Upbeat double chime (440Hz -> 880Hz)
      playTone(ctx, 440, now, 0.08, 'triangle', 0.15);
      playTone(ctx, 880, now + 0.1, 0.15, 'sine', 0.2);
    } else if (type === 'reminder') {
      // Soft bell chime (587.33Hz -> 880Hz)
      playTone(ctx, 587.33, now, 0.1, 'sine', 0.18);
      playTone(ctx, 880, now + 0.12, 0.18, 'sine', 0.22);
    }
  } catch (err) {
    console.error('Failed to play notification sound', err);
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = 'sine',
  maxGain: number = 0.2
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  // Smooth attack & decay envelope
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}
