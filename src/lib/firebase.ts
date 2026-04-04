import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Prevent re-initializing on hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * Returns the Firebase Messaging instance, or null when the browser
 * does not support push notifications (e.g. Safari < 16.4, HTTP context).
 */
export async function getMessagingInstance() {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
}

export default app;
