import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { notificationsService } from '../modules/common/api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/** Dispatched on window so any page can react without prop drilling */
export const NEW_ORDER_EVENT = 'mr-burritos:new-order';

/** Play a 3-tone chime using Web Audio API */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const tones = [880, 1100, 1320]; // A5 → C#6 → E6 (major chord arpeggio)
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.start(start);
      osc.stop(start + 0.35);
    });
    // Close context after all tones finish
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Web Audio not available — silent fallback
  }
}

function dispatch(title?: string, body?: string) {
  playNotificationSound();
  window.dispatchEvent(new CustomEvent(NEW_ORDER_EVENT, { detail: { title, body } }));
}

// ── Native Android / iOS via @capacitor/push-notifications ───────────────────
async function initNative() {
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive !== 'granted') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return;

  await PushNotifications.register();

  await PushNotifications.addListener('registration', ({ value: token }) => {
    notificationsService.registerToken(token).catch(() => {});
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('[Push] registration error', err);
  });

  // App in foreground — show toast + refresh orders
  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    dispatch(notification.title, notification.body);
  });

  // User tapped notification from shade — refresh
  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    dispatch();
  });
}

// ── Web / PWA via Firebase Messaging ─────────────────────────────────────────
async function initWeb(): Promise<(() => void) | undefined> {
  const messaging = await getMessagingInstance();
  if (!messaging) {
    console.info('[FCM] Push API not supported in this context.');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[FCM] Permission denied.');
    return;
  }

  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) await notificationsService.registerToken(token).catch(() => {});
  } catch (e) {
    console.error('[FCM] getToken failed', e);
  }

  return onMessage(messaging, (payload) => {
    dispatch(payload.notification?.title, payload.notification?.body);
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let unsubscribe: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      initNative();
    } else {
      initWeb().then((unsub) => { unsubscribe = unsub; });
    }

    return () => { unsubscribe?.(); };
  }, [enabled]);
}
