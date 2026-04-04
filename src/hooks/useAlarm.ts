import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// ── AudioContext singleton ──────────────────────────────────────────────────
let ctx: AudioContext | null = null;

/** Must be called inside a user-gesture handler (tap, click) to unlock audio */
export function unlockAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
}

/**
 * Play a single "ding-dong" alarm note.
 * freq1 → freq2 with an exponential decay — sounds like a restaurant bell.
 */
function beep(freq1 = 880, freq2 = 660, duration = 0.35) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq1, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + duration * 0.5);

  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

async function vibrate() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  } catch { /* ignore */ }
}

// ── Alarm state ────────────────────────────────────────────────────────────
let alarmTimer: ReturnType<typeof setInterval> | null = null;
let repeatCount = 0;
const MAX_REPEATS = 8; // stop after 8 beeps (~8 s)

function stopAlarmInternal() {
  if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
  repeatCount = 0;
}

/**
 * Play a repeating alarm (ding-dong × MAX_REPEATS) then stop automatically.
 * Call stopAlarm() to dismiss early (e.g. user taps "OK").
 */
export function startAlarm() {
  stopAlarmInternal(); // reset if already running

  const fire = () => {
    beep(1046, 784);          // C6 → G5
    setTimeout(() => beep(784, 523), 200); // G5 → C5 (half beat later)
    vibrate();
    repeatCount++;
    if (repeatCount >= MAX_REPEATS) stopAlarmInternal();
  };

  fire();
  alarmTimer = setInterval(fire, 1000);
}

export function stopAlarm() {
  stopAlarmInternal();
}
