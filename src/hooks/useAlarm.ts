import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
}

function playTone(freq: number, start: number, duration: number, volume: number = 0.15) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.setValueAtTime(volume, start + duration - 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.start(start);
  osc.stop(start + duration);
}

async function vibrate() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch { /* ignore */ }
}

export function startAlarm() {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  
  playTone(392, now, 0.15, 0.12);        // G4
  playTone(523, now + 0.12, 0.15, 0.12); // C5
  playTone(392, now + 0.24, 0.15, 0.12); // G4
  playTone(523, now + 0.36, 0.15, 0.12); // C5
  playTone(659, now + 0.48, 0.3, 0.12);  // E5
  playTone(784, now + 0.72, 0.3, 0.12);  // G5
  playTone(659, now + 0.96, 0.2, 0.10);  // E5
  playTone(784, now + 1.10, 0.4, 0.10);  // G5
  
  vibrate();
}

export function stopAlarm() {
  // No alarm to stop - sounds play once and stop
}
