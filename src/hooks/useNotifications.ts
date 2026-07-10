import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';
import { getToken, onMessage, Messaging } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { notificationsService } from '../modules/common/api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

export const NEW_ORDER_EVENT = 'mr-burritos:new-order';
export const ORDER_DELIVERED_EVENT = 'mr-burritos:order-delivered';

export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const note = (freq: number, start: number, duration: number, volume: number = 0.2) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.015);
      gain.gain.setValueAtTime(volume * 0.7, start + duration * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;

    note(587.33, now, 0.2, 0.25);
    note(698.46, now + 0.1, 0.2, 0.25);
    note(880, now + 0.2, 0.25, 0.25);
    note(1174.66, now + 0.3, 0.3, 0.2);

    setTimeout(() => ctx.close(), 800);
  } catch {
    // Web Audio not available
  }
}

function dispatch(title?: string, body?: string) {
  playNotificationSound();
  window.dispatchEvent(new CustomEvent(NEW_ORDER_EVENT, { detail: { title, body } }));
}

/** Route an incoming push by its data.type — delivered orders vs new orders. */
function handleIncoming(data: Record<string, string> | undefined, title?: string, body?: string) {
  if (data?.type === 'order-delivered') {
    playNotificationSound();
    window.dispatchEvent(new CustomEvent(ORDER_DELIVERED_EVENT, {
      detail: { title, body, orderId: data.orderId ?? '', orderNumber: data.orderNumber ?? '' },
    }));
    return;
  }
  dispatch(title, body);
}

async function initNative() {
  try {
    // High-importance channel with a loud custom sound. Once created it persists
    // on the device, so FCM notifications ring on it even after the app is later
    // force-closed (Android shows the notification; the app itself isn't running).
    try {
      await PushNotifications.createChannel({
        id: 'new_orders',
        name: 'Nouvelles commandes',
        description: 'Alertes sonores de nouvelles commandes',
        importance: 5,            // MAX — heads-up banner + sound
        sound: 'notification.mp3',
        vibration: true,
        visibility: 1,            // visible on the lock screen
        lights: true,
        lightColor: '#F5A800',
      });
    } catch {}

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    // Register listeners BEFORE calling register()
    await PushNotifications.addListener('registration', async (token) => {
      try {
        await notificationsService.registerToken(token.value);
      } catch {}
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration error:', err);
    });

    // App in foreground when the push arrives → in-app alert + looping alarm.
    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      handleIncoming(notification.data as Record<string, string> | undefined, notification.title ?? '', notification.body ?? '');
    });

    // App was in background / closed and the user tapped the system notification.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const n = action.notification;
      handleIncoming(n.data as Record<string, string> | undefined, n.title ?? '🌯 Nouvelle commande !', n.body ?? '');
    });

    await PushNotifications.register();
  } catch (err) {
    // Firebase not configured or permission denied — app continues normally
    console.warn('Push notifications unavailable:', err);
  }
}

async function initWeb() {
  try {
    const messaging = await getMessagingInstance() as Messaging | null;
    if (!messaging) return;

    try {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      try {
        await notificationsService.registerToken(token);
      } catch {}
    } catch {}

    onMessage(messaging, (payload) => {
      const { notification, data } = payload;
      handleIncoming(
        data as Record<string, string> | undefined,
        notification?.title ?? '',
        notification?.body ?? '',
      );
    });
  } catch (err) {
    console.warn('Web push notifications unavailable:', err);
  }
}

export function useNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    if (Capacitor.isNativePlatform()) {
      initNative();
    } else {
      initWeb();
    }
  }, [enabled]);
}
