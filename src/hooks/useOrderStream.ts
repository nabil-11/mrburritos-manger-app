/**
 * useOrderStream
 *
 * Maintains a persistent Server-Sent Events connection to the backend
 * (/api/orders/stream).  When the server pushes a "new-order" event this
 * hook plays the alarm and dispatches the app-wide NEW_ORDER_EVENT so that
 * the Orders page can react exactly as it does for FCM push notifications.
 *
 * Why fetch instead of EventSource?
 *   EventSource does not support custom request headers, so we cannot send
 *   the JWT `Authorization` header.  Using fetch + ReadableStream gives us
 *   full control while still reading the raw SSE byte stream.
 */

import { useEffect } from 'react';
import { NEW_ORDER_EVENT } from './useNotifications';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api';

/** How long to wait before reconnecting after an unexpected disconnection. */
const RECONNECT_DELAY_MS = 5_000;

export function useOrderStream(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController = new AbortController();
    // Tracks the createdAt of the last received order so we don't re-emit
    // duplicates when we reconnect after a dropout.
    let lastOrderTime = new Date().toISOString();

    async function connect() {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fresh controller for each connection attempt
      abortController = new AbortController();

      try {
        const url = `${API_URL}/orders/stream?since=${encodeURIComponent(lastOrderTime)}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE messages are separated by a blank line (\n\n)
          const parts = buffer.split('\n\n');
          // Keep any incomplete trailing fragment for the next read
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            // Skip empty parts and SSE comments (heartbeat pings start with ":")
            if (!part.trim() || part.startsWith(':')) continue;

            let eventType = 'message';
            let data = '';

            for (const line of part.split('\n')) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                data = line.slice(5).trim();
              }
            }

            if (eventType === 'new-order' && data) {
              try {
                const order = JSON.parse(data);

                // Advance the cursor so reconnects don't replay this order
                if (order.createdAt) {
                  lastOrderTime = order.createdAt;
                }

                const typeLabel =
                  order.type === 'delivery' ? 'Livraison' : 'À emporter';

                window.dispatchEvent(
                  new CustomEvent(NEW_ORDER_EVENT, {
                    detail: {
                      title: '🌯 Nouvelle commande !',
                      body: `#${order.orderNumber} — ${typeLabel} — ${order.total} DT`,
                    },
                  })
                );
              } catch {
                // Malformed JSON — ignore and continue
              }
            }
          }
        }
      } catch (err: unknown) {
        // AbortError means we intentionally closed the connection (cleanup)
        if (err instanceof Error && err.name === 'AbortError') return;

        // Any other error: schedule a reconnect
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    }

    connect();

    return () => {
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      abortController.abort();
    };
  }, [enabled]);
}
