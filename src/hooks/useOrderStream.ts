/**
 * useOrderStream
 *
 * Maintains a persistent Server-Sent Events connection to the backend
 * (/api/orders/stream).
 *
 * The backend now uses an in-process event bus: as soon as a customer places
 * an order the POST route emits on the bus, the SSE handler picks it up
 * instantly (< 10 ms) and pushes it here — no polling delay.
 * A 500 ms DB-poll fallback on the server side catches orders that arrive via
 * a different server instance.
 *
 * Why SSE instead of WebSocket?
 *   Next.js Route Handlers are serverless functions: WebSocket connections
 *   close immediately after the response is generated.  SSE (streaming
 *   ReadableStream response) is the only persistent push mechanism that works
 *   in this environment.  For order notifications (server → client only) SSE
 *   is the correct protocol choice.
 *
 * Why fetch instead of EventSource?
 *   EventSource does not support custom request headers.  Using fetch +
 *   ReadableStream lets us send the JWT Authorization header.
 */

import { useEffect } from 'react';
import { NEW_ORDER_EVENT, ORDER_DELIVERED_EVENT, playNotificationSound } from './useNotifications';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api';

/** Reconnect delay after an unexpected disconnection. */
const RECONNECT_DELAY_MS = 3_000;

export function useOrderStream(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController = new AbortController();
    let lastOrderTime = new Date().toISOString();

    async function connect() {
      const token = localStorage.getItem('token');
      if (!token) return;

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

          // SSE messages are separated by \n\n
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
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

                // Advance cursor so reconnects don't replay this order
                if (order.createdAt) lastOrderTime = order.createdAt;

                const typeLabel = order.type === 'delivery' ? 'Livraison' : 'À emporter';

                // Dispatch with full order payload so Orders.tsx can prepend
                // it to the list instantly without an extra HTTP request.
                window.dispatchEvent(
                  new CustomEvent(NEW_ORDER_EVENT, {
                    detail: {
                      title: '🌯 Nouvelle commande !',
                      body: `#${order.orderNumber} — ${typeLabel} — ${order.total} DT`,
                      order,
                    },
                  })
                );
              } catch {
                // Malformed JSON — ignore
              }
            } else if (eventType === 'order-delivered' && data) {
              try {
                const order = JSON.parse(data);
                const typeLabel = order.type === 'delivery' ? 'Livraison' : 'À emporter';
                playNotificationSound();
                window.dispatchEvent(
                  new CustomEvent(ORDER_DELIVERED_EVENT, {
                    detail: {
                      title: '✅ Commande livrée',
                      body: `#${order.orderNumber} — ${typeLabel} — ${order.total} DT`,
                      orderId: order._id,
                      orderNumber: order.orderNumber,
                      order,
                    },
                  })
                );
              } catch {
                // Malformed JSON — ignore
              }
            }
          }
        }

        // Stream ended cleanly (server closed it — e.g. Vercel 30s function timeout).
        // This is NOT an error, but we must reconnect or new orders will never arrive.
        if (!abortController.signal.aborted) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Network error or bad HTTP status — reconnect after a short delay
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
