// Firebase Cloud Messaging — background / closed-tab notification handler
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDTqLuJD5M-HDbbieuIsy85ZRsE296Re74',
  authDomain:        'mr-burritos-d1e5e.firebaseapp.com',
  projectId:         'mr-burritos-d1e5e',
  storageBucket:     'mr-burritos-d1e5e.firebasestorage.app',
  messagingSenderId: '281985179029',
  appId:             '1:281985179029:web:5f0166ae52015f0da56a9c',
});

const messaging = firebase.messaging();

// Called when the app is in the background or the tab is closed
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Nouvelle commande';
  const body  = payload.notification?.body  ?? 'Mr. Burritos — une commande attend votre attention.';

  self.registration.showNotification(title, {
    body,
    icon:     '/favicon.png',
    badge:    '/favicon.png',
    vibrate:  [200, 100, 200, 100, 200],
    tag:      'new-order',
    renotify: true,
    data:     payload.data ?? {},
  });
});

// Open / focus the orders page when the notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow('/orders');
      })
  );
});
