import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getToken, onMessage, Messaging } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { notificationsService } from '../modules/common/api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

export const NEW_ORDER_EVENT = 'mr-burritos:new-order';

function playNotificationSound() {
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
    
    note(587.33, now, 0.2, 0.25);     // D5 - marimba style
    note(698.46, now + 0.1, 0.2, 0.25); // F5
    note(880, now + 0.2, 0.25, 0.25);   // A5
    note(1174.66, now + 0.3, 0.3, 0.2); // D6
    
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Web Audio not available
  }
}

function dispatch(title?: string, body?: string) {
  playNotificationSound();
  window.dispatchEvent(new CustomEvent(NEW_ORDER_EVENT, { detail: { title, body } }));
}

async function initNative() {
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive !== 'granted') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return;

  await PushNotifications.register();

  (PushNotifications as any).addListener('registration', async (token: { value: string }) => {
    try {
      await notificationsService.registerToken(token.value);
    } catch {}
  });

  (PushNotifications as any).addListener('pushNotificationReceived', (notification: { notification: { title?: string; body?: string } }) => {
    const { title, body } = notification.notification;
    dispatch(title ?? '', body ?? '');
  });
}

async function initWeb() {
  const messaging = await getMessagingInstance() as Messaging | null;
  if (!messaging) return;

  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    try {
      await notificationsService.registerToken(token);
    } catch {}
  } catch {}

  onMessage(messaging, (payload) => {
    const { notification } = payload;
    if (notification) {
      dispatch(notification.title ?? '', notification.body ?? '');
    }
  });
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
