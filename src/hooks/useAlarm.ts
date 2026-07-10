import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// ─── HTML5 Audio (browser / Android) ──────────────────────────────────────────
let ringtone: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (ringtone) return ringtone;
  ringtone = new Audio('/notification.mp3');
  ringtone.loop    = true;
  ringtone.volume  = 1.0;
  ringtone.preload = 'auto';
  ringtone.load();
  return ringtone;
}

// Pre-load the audio file as soon as the module is imported
if (typeof window !== 'undefined') getAudio();

// ─── Auto-stop timer ──────────────────────────────────────────────────────────
let alarmTimeout: ReturnType<typeof setTimeout> | null = null;
const ALARM_AUTO_STOP_MS = 3 * 60_000; // 3 minutes

// ─── Legacy export — keeps existing onClick={unlockAudio} compiling ───────────
export function unlockAudio() {}

// ─── Haptic feedback (Android / Capacitor only) ───────────────────────────────
async function vibrate() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  } catch { /* ignore */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the notification ringtone via HTML5 <audio loop>.
 *
 * Auto-stops after 3 minutes if the manager does not dismiss the alert.
 */
export function startAlarm() {
  stopAlarm(); // clear any previous alarm first

  const audio = getAudio();
  audio.currentTime = 0;
  audio.play().catch((err: unknown) => {
    console.error('[Alarm] audio.play() failed:', err);
  });

  vibrate();

  // Auto-stop after 3 minutes
  alarmTimeout = setTimeout(stopAlarm, ALARM_AUTO_STOP_MS);
}

/**
 * Stop the ringtone immediately.
 * Called when the manager taps OK on the new-order alert.
 */
export function stopAlarm() {
  if (alarmTimeout !== null) { clearTimeout(alarmTimeout); alarmTimeout = null; }

  if (ringtone) {
    ringtone.pause();
    ringtone.currentTime = 0;
  }
}
