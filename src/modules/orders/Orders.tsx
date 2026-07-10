import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
  IonSelect, IonSelectOption,
  IonSearchbar, IonSpinner, IonToast, IonActionSheet,
  IonMenuButton, IonHeader, IonToolbar, IonIcon,
} from '@ionic/react';
import {
  restaurantOutline, bicycleOutline, callOutline, locationOutline, mapOutline,
  chatbubbleOutline, chevronDownOutline, chevronUpOutline, logOutOutline,
  arrowForwardOutline, timerOutline, addOutline, bagOutline,
  moonOutline, sunnyOutline, printOutline, calendarOutline,
  notificationsOutline, checkmarkCircleOutline, alertCircleOutline,
} from 'ionicons/icons';
import { ordersService, authService } from '../common/api';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Order, ORDER_STATUSES, getStatusLabel, getProductName } from './types';
import { NEW_ORDER_EVENT } from '../../hooks/useNotifications';
import { useOrderStream } from '../../hooks/useOrderStream';
import { startAlarm, stopAlarm, unlockAudio } from '../../hooks/useAlarm';

// ─── Single accent — everything else is neutral ──────────────────────────────
const PRIMARY = '#F5A800';
const PRIMARY_2 = '#FF7A00';
const GRAD = `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_2})`;

// ─── Date range helpers (local YYYY-MM-DD, avoids UTC off-by-one) ─────────────
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => toDateStr(new Date());
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d); };

const QUICK_NEXT: Record<string, { status: string; label: string }> = {
  confirmed: { status: 'preparing', label: 'Démarrer la préparation' },
  preparing: { status: 'ready',     label: 'Commande prête' },
  ready:     { status: 'delivered', label: 'Marquer comme livré' },
};

const TABS = [
  { value: '',          label: 'Toutes'   },
  { value: 'pending',   label: 'Attente'  },
  { value: 'confirmed', label: 'Confirmé' },
  { value: 'preparing', label: 'Prépa'    },
  { value: 'ready',     label: 'Prête'    },
  { value: 'delivered', label: 'Livré'    },
  { value: 'cancelled', label: 'Annulé'   },
];

// ─── Prep timer persistence ───────────────────────────────────────────────────
const TIMER_KEY = 'mr_burritos_prep_timers';
type TimerMap = Record<string, { endMs: number; totalMs: number }>;
const loadTimers = (): TimerMap => { try { return JSON.parse(localStorage.getItem(TIMER_KEY) ?? '{}'); } catch { return {}; } };
const saveTimers = (t: TimerMap) => localStorage.setItem(TIMER_KEY, JSON.stringify(t));

// ─── Neutral theme tokens (primary is the only accent) ────────────────────────
function makeTokens(isDark: boolean) {
  return isDark ? {
    bg: '#0E0E0F', card: '#18181B', surface: '#26262A', border: 'rgba(255,255,255,0.08)',
    text: '#F4F4F5', muted: '#A1A1AA', faint: '#71717A', headerBg: '#141416',
    tint: 'rgba(245,168,0,0.10)', tintBorder: 'rgba(245,168,0,0.35)',
  } : {
    bg: '#F6F5F3', card: '#FFFFFF', surface: '#F2F1EE', border: '#EAE8E3',
    text: '#18181B', muted: '#6B7280', faint: '#9CA3AF', headerBg: '#FFFFFF',
    tint: 'rgba(245,168,0,0.09)', tintBorder: 'rgba(245,168,0,0.35)',
  };
}
type Tokens = ReturnType<typeof makeTokens>;

function orderAge(createdAt: string, now: number): string {
  const s = Math.floor((now - new Date(createdAt).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`;
}

const mapsUrl = (o: Order) =>
  o.customer.latitude && o.customer.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${o.customer.latitude},${o.customer.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.customer.address ?? '')}`;

// ─── Thermal receipt printer (80 mm) ─────────────────────────────────────────
function printOrderReceipt(order: Order, prepMinutes?: number) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const typeLabel = order.type === 'delivery' ? 'LIVRAISON' : 'A EMPORTER';
  const rows = (order.items ?? []).map(item => {
    const name = getProductName(item.productName);
    const suppTotal = (item.supplements ?? []).reduce((a, x) => a + x.price, 0);
    const lineTotal = (item.unitPrice + suppTotal) * item.quantity;
    const suppList = (item.supplements ?? []).filter(s => s.name?.fr || s.name?.ar)
      .map(s => `+ ${s.name?.fr ?? s.name?.ar}${s.price > 0 ? ` (${s.price.toFixed(2)})` : ''}`).join('<br>');
    const suppHtml = suppList ? `<div class="supp">${suppList}</div>` : '';
    const noteHtml = item.notes ? `<div class="note">"${item.notes}"</div>` : '';
    return `<tr><td class="qty">x${item.quantity}</td><td class="name">${name}${suppHtml}${noteHtml}</td><td class="price">${lineTotal.toFixed(2)}</td></tr>`;
  }).join('');
  const addrHtml = order.type === 'delivery' && order.customer.address
    ? `<tr><td class="lbl">ADRESSE</td><td class="val addr">${order.customer.address}</td></tr>` : '';
  const notesHtml = order.notes ? `<hr class="dash"><div class="notesbox">NOTE: ${order.notes}</div>` : '';
  const prepHtml = prepMinutes
    ? `<div class="prep-row"><span class="prep-lbl">Temps de preparation</span><span class="prep-val">${prepMinutes >= 60 ? `${Math.floor(prepMinutes / 60)}h${prepMinutes % 60 ? ` ${prepMinutes % 60}min` : ''}` : `${prepMinutes} min`}</span></div>` : '';
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Commande #${order.orderNumber}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:13px;padding:6px 8px 24px;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .brand{font-size:22px;font-weight:900;text-align:center;letter-spacing:2px;margin-bottom:2px}.tagline{font-size:10px;text-align:center;color:#444}
    .dash{border:none;border-top:1.5px dashed #000;margin:7px 0}.ordnum{font-size:17px;font-weight:900;text-align:center;letter-spacing:2px;margin:5px 0 2px}
    .datetime{font-size:11px;text-align:center;color:#333;margin-bottom:5px}.mode{font-size:15px;font-weight:900;text-align:center;border:2px solid #000;padding:5px 0;margin:7px 0;letter-spacing:1.5px}
    .info-table{width:100%;border-collapse:collapse;margin:3px 0}.lbl{font-size:9px;color:#555;padding-bottom:1px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .val{font-size:13px;font-weight:700;padding-bottom:5px}.addr{font-size:12px;line-height:1.45;word-break:break-word}
    .section-head{font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin:7px 0 4px;color:#444}
    table.items{width:100%;border-collapse:collapse}.qty{width:24px;vertical-align:top;font-weight:900;font-size:13px;padding-right:5px;white-space:nowrap}
    .name{vertical-align:top;font-size:13px;line-height:1.45;word-break:break-word}.price{text-align:right;vertical-align:top;white-space:nowrap;padding-left:5px;font-weight:800;font-size:13px;width:1%}
    td{padding-bottom:6px}.supp{font-size:10px;color:#444;margin-top:2px}.note{font-size:10px;color:#555;font-style:italic;margin-top:2px}
    .tot-label{font-size:17px;font-weight:900;padding-top:4px}.tot-val{font-size:17px;font-weight:900;text-align:right;padding-top:4px;white-space:nowrap}
    .notesbox{border:1.5px dashed #000;padding:6px 8px;font-size:12px;font-style:italic;line-height:1.5;margin:5px 0;word-break:break-word}
    .thanks{font-size:11px;text-align:center;margin-top:10px;letter-spacing:.5px}
    .prep-row{display:flex;justify-content:space-between;align-items:center;background:#f0f0f0;border:1.5px solid #000;border-radius:3px;padding:5px 8px;margin:6px 0}.prep-lbl{font-size:11px;font-weight:700}.prep-val{font-size:14px;font-weight:900}
    @media print{@page{size:80mm auto;margin:0}html,body{width:100%;margin:0;padding:4px 6px 20px}}
  </style></head><body>
    <div class="brand">MR. BURRITOS</div><div class="tagline">Gestionnaire de commandes</div><hr class="dash">
    <div class="ordnum">COMMANDE #${order.orderNumber}</div><div class="datetime">${dateStr} a ${timeStr}</div>
    <div class="mode">&gt;&gt;&gt; ${typeLabel} &gt;&gt;&gt;</div>${prepHtml}<hr class="dash">
    <table class="info-table"><tbody><tr><td><div class="lbl">CLIENT</div><div class="val">${order.customer.name}</div></td>
    <td style="text-align:right"><div class="lbl">TEL</div><div class="val">${order.customer.phone}</div></td></tr>${addrHtml}</tbody></table><hr class="dash">
    <div class="section-head">Articles commandes</div><table class="items"><tbody>${rows}</tbody></table><hr class="dash">
    <table style="width:100%"><tbody><tr><td class="tot-label">TOTAL</td><td class="tot-val">${order.total.toFixed(2)} DT</td></tr></tbody></table>
    ${notesHtml}<hr class="dash"><div class="thanks">Merci pour votre commande !</div>
  </body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (doc) { doc.open(); doc.write(html); doc.close(); setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 2000); }, 450); }
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────
function Pill({ t, children, primary, style }: { t: Tokens; children: React.ReactNode; primary?: boolean; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 8,
      padding: '3px 9px', fontSize: 11, fontWeight: 700, lineHeight: 1,
      background: primary ? t.tint : t.surface,
      color: primary ? PRIMARY : t.muted,
      border: `1px solid ${primary ? t.tintBorder : t.border}`,
      ...style,
    }}>{children}</span>
  );
}

function SkeletonCard({ t }: { t: Tokens }) {
  const block = (w: number | string, h: number, r = 8): React.CSSProperties => ({
    width: w, height: h, borderRadius: r, background: t.surface, animation: 'skeletonPulse 1.6s ease-in-out infinite',
  });
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={block(90, 12)} /><div style={block(150, 22)} /></div>
        <div style={block(64, 30)} />
      </div>
      <div style={block('100%', 44, 12)} />
    </div>
  );
}

// ─── Order card ─────────────────────────────────────────────────────────────
function OrderCard({
  order, t, isDark, now, timers, updating, expanded, onExpand, onConfirm, onDeliveryFee, onStatus,
}: {
  order: Order; t: Tokens; isDark: boolean; now: number; timers: TimerMap; updating: boolean;
  expanded: boolean; onExpand: () => void; onConfirm: () => void; onDeliveryFee: () => void; onStatus: (s: string) => void;
}) {
  const isPending = order.status === 'pending';
  const showTimer = order.status === 'confirmed' || order.status === 'preparing';
  const timer = showTimer
    ? timers[order._id] ?? (order.confirmedAt && order.preparationDuration
        ? { endMs: new Date(order.confirmedAt).getTime() + order.preparationDuration * 60000, totalMs: order.preparationDuration * 60000 }
        : undefined)
    : undefined;
  const isLate = timer ? timer.endMs < now : false;
  const livreur = order.assignedDelivery && typeof order.assignedDelivery === 'object'
    ? order.assignedDelivery as { _id: string; name: string; phone: string } : null;
  const hasDetails = !!(order.customer.address || order.items?.length || order.notes);
  const nextAction = QUICK_NEXT[order.status];
  const emphasise = isPending || isLate;

  const timerText = (() => {
    if (!timer) return null;
    if (isLate) return 'En retard';
    const rem = Math.max(0, Math.floor((timer.endMs - now) / 1000));
    return `${Math.floor(rem / 60)}:${(rem % 60).toString().padStart(2, '0')} restant`;
  })();

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', background: emphasise ? (isDark ? '#1C1710' : '#FFFDF7') : t.card,
      border: `1px solid ${emphasise ? t.tintBorder : t.border}`,
      opacity: updating ? 0.55 : 1, transition: 'opacity 0.15s',
      animation: !updating && emphasise ? 'pendingPulse 2.4s ease-in-out infinite' : undefined,
      display: 'flex',
    }}>
      {/* accent stripe: primary for anything needing attention, neutral otherwise */}
      <div style={{ width: 3, flexShrink: 0, background: emphasise ? GRAD : t.border }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {timer && (
          <div style={{ height: 3, background: t.surface }}>
            <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, ((timer.endMs - now) / timer.totalMs) * 100))}%`, background: GRAD, transition: 'width 1s linear' }} />
          </div>
        )}

        <div style={{ padding: 14 }}>
          {/* row 1 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: PRIMARY, letterSpacing: 0.3 }}>#{order.orderNumber}</span>
              <Pill t={t}>{orderAge(order.createdAt, now)}</Pill>
              {isPending && <Pill t={t} primary>NOUVEAU</Pill>}
            </div>
            <Pill t={t}>
              <IonIcon icon={order.type === 'delivery' ? bicycleOutline : bagOutline} style={{ fontSize: 13 }} />
              {order.type === 'delivery' ? 'Livraison' : 'À emporter'}
            </Pill>
          </div>

          {/* row 2: name + total */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customer.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <IonIcon icon={callOutline} style={{ fontSize: 12, color: t.faint }} />
                <span style={{ fontSize: 13, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customer.phone}</span>
                {order.type === 'delivery' && order.customer.address && (
                  <a href={mapsUrl(order)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                     style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, textDecoration: 'none', color: PRIMARY, background: t.tint, border: `1px solid ${t.tintBorder}`, borderRadius: 7, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                    <IonIcon icon={mapOutline} style={{ fontSize: 11 }} /> Map
                  </a>
                )}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 23, fontWeight: 900, color: t.text, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{order.total.toFixed(2)}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: PRIMARY }}>DT</span>
              </div>
              <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700, color: t.muted, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 7, padding: '3px 8px' }}>
                {getStatusLabel(order.status)}
              </span>
            </div>
          </div>

          {/* delivery / livreur (neutral surfaces, primary accents) */}
          {order.type === 'delivery' && (order.deliveryCompany?.name || order.deliveryFee != null || order.deliveryCompany?.phone) && (
            <div style={{ marginTop: 8, padding: '8px 11px', borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px' }}>
              <IonIcon icon={bicycleOutline} style={{ fontSize: 14, color: PRIMARY }} />
              {order.deliveryCompany?.name && <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{order.deliveryCompany.name}{order.deliveryCompany.commission > 0 && <span style={{ fontWeight: 500, color: t.muted }}> ({order.deliveryCompany.commission}%)</span>}</span>}
              {order.deliveryCompany?.phone && <a href={`tel:${order.deliveryCompany.phone}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: t.text, textDecoration: 'none' }}><IonIcon icon={callOutline} style={{ fontSize: 11 }} />{order.deliveryCompany.phone}</a>}
              {order.deliveryFee != null && order.deliveryFee > 0 && <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: PRIMARY }}>+{order.deliveryFee.toFixed(2)} DT</span>}
            </div>
          )}
          {livreur && (
            <div style={{ marginTop: 8, padding: '8px 11px', borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: t.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IonIcon icon={bicycleOutline} style={{ fontSize: 15, color: PRIMARY }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: t.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Livreur assigné</p>
                <p style={{ margin: '1px 0 0', fontSize: 13, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{livreur.name}</p>
              </div>
              <a href={`tel:${livreur.phone}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, textDecoration: 'none', fontSize: 12, fontWeight: 700, color: PRIMARY, background: t.tint, border: `1px solid ${t.tintBorder}`, borderRadius: 8, padding: '5px 10px' }}><IonIcon icon={callOutline} style={{ fontSize: 13 }} />{livreur.phone}</a>
            </div>
          )}

          {/* timer */}
          {timerText && (
            <div style={{ marginTop: 9, padding: '8px 12px', borderRadius: 11, background: t.tint, border: `1px solid ${t.tintBorder}`, display: 'flex', alignItems: 'center', gap: 7 }}>
              <IonIcon icon={timerOutline} style={{ fontSize: 16, color: PRIMARY }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{timerText}</span>
            </div>
          )}

          {/* primary action */}
          {!updating && (isPending || nextAction) && (
            <button
              onClick={() => isPending ? (order.type === 'delivery' ? onDeliveryFee() : onConfirm()) : onStatus(nextAction!.status)}
              style={{ marginTop: 10, width: '100%', height: 46, borderRadius: 12, border: 'none', cursor: 'pointer', background: GRAD, color: '#1C1200', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <IonIcon icon={isPending ? timerOutline : arrowForwardOutline} style={{ fontSize: 17 }} />
              {isPending ? 'Confirmer la commande' : nextAction!.label}
            </button>
          )}
          {updating && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <IonSpinner name="dots" style={{ color: PRIMARY, width: 22, height: 22 }} />
              <span style={{ fontSize: 12, color: t.muted, fontWeight: 600 }}>Mise à jour…</span>
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', padding: '0 6px 0 12px', minHeight: 42 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto' }}>
            {!!order.items?.length && <Pill t={t}><span style={{ color: PRIMARY, fontWeight: 800 }}>{order.items.length}</span> art.</Pill>}
            {!updating && ['confirmed', 'preparing', 'ready'].includes(order.status) && (
              <button onClick={() => printOrderReceipt(order, timers[order._id] ? Math.round(timers[order._id].totalMs / 60000) : undefined)}
                      title="Imprimer" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IonIcon icon={printOutline} style={{ fontSize: 14, color: t.muted }} />
              </button>
            )}
          </div>
          {!updating && (
            <IonSelect value={order.status} onIonChange={e => onStatus(e.detail.value!)} interface="action-sheet"
              interfaceOptions={{ header: `Commande #${order.orderNumber}` }}
              style={{ '--padding-start': '0px', '--color': t.muted, fontSize: 11, fontWeight: 600, minHeight: 'auto' }}>
              {ORDER_STATUSES.map(os => <IonSelectOption key={os.value} value={os.value}>{os.label}</IonSelectOption>)}
            </IonSelect>
          )}
          {hasDetails && (
            <button onClick={onExpand} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 10px', color: expanded ? PRIMARY : t.faint, fontSize: 11, fontWeight: 600 }}>
              {expanded ? 'Masquer' : 'Détails'}<IonIcon icon={expanded ? chevronUpOutline : chevronDownOutline} style={{ fontSize: 11 }} />
            </button>
          )}
        </div>

        {/* expandable */}
        {expanded && (
          <div style={{ padding: 14, borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 8, animation: 'slideUp 0.2s ease-out' }}>
            {order.type === 'delivery' && order.customer.address && (
              <a href={mapsUrl(order)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, padding: 11, textDecoration: 'none' }}>
                <IonIcon icon={locationOutline} style={{ fontSize: 15, color: PRIMARY, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: t.text, lineHeight: 1.5, display: 'block' }}>{order.customer.address}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: PRIMARY, marginTop: 4 }}><IonIcon icon={mapOutline} style={{ fontSize: 10 }} /> Ouvrir dans Maps</span>
                </div>
              </a>
            )}
            {!!order.items?.length && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, color: t.faint, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px 2px' }}>Articles</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {order.items.map((item, idx) => {
                    const name = getProductName(item.productName);
                    const suppTotal = (item.supplements ?? []).reduce((a, x) => a + x.price, 0);
                    const lineTotal = (item.unitPrice + suppTotal) * item.quantity;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: t.surface, borderRadius: 12, padding: 11 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#1C1200' }}>{item.quantity}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: 0 }}>{name}</p>
                          {!!item.supplements?.length && (
                            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {item.supplements.map((sup, si) => (
                                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: t.muted }}>
                                  <IonIcon icon={addOutline} style={{ fontSize: 9, color: PRIMARY }} />
                                  {sup.name?.fr ?? sup.name?.ar ?? '—'}{sup.price > 0 ? ` +${sup.price.toFixed(2)} DT` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                          {item.notes && <p style={{ fontSize: 11, color: t.faint, fontStyle: 'italic', margin: '4px 0 0' }}>{item.notes}</p>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: 0 }}>{lineTotal.toFixed(2)}</p>
                          <p style={{ fontSize: 10, color: t.muted, margin: 0 }}>DT</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background: t.surface, borderRadius: 12, padding: 12, marginTop: 8, border: `1px solid ${t.border}` }}>
                  {order.subtotal !== undefined && order.subtotal !== order.total && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12, color: t.muted }}>Sous-total</span><span style={{ fontSize: 12, color: t.muted }}>{order.subtotal.toFixed(2)} DT</span></div>
                  )}
                  {order.deliveryFee != null && order.deliveryFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12, color: t.muted }}>Frais de livraison</span><span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>+{order.deliveryFee.toFixed(2)} DT</span></div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 14, fontWeight: 700, color: t.muted }}>Total</span><span style={{ fontSize: 22, fontWeight: 900, color: PRIMARY }}>{order.total.toFixed(2)} DT</span></div>
                </div>
              </div>
            )}
            {order.notes && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: t.tint, borderRadius: 12, border: `1px solid ${t.tintBorder}`, padding: 11 }}>
                <IonIcon icon={chatbubbleOutline} style={{ fontSize: 14, color: PRIMARY, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.5 }}>{order.notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const history = useHistory();
  const { logout, isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const t = makeTokens(isDark);

  useOrderStream(isAuthenticated);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(tomorrowStr);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ open: boolean; message: string; color: string }>({ open: false, message: '', color: 'primary' });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [prepTimers, setPrepTimers] = useState<TimerMap>(loadTimers);
  const [prepSheet, setPrepSheet] = useState<{ open: boolean; orderId: string; orderNumber: string; deliveryFee?: number }>({ open: false, orderId: '', orderNumber: '' });
  const [feeModal, setFeeModal] = useState<{ open: boolean; orderId: string; orderNumber: string }>({ open: false, orderId: '', orderNumber: '' });
  const [feeValue, setFeeValue] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const fetchOrders = useCallback(async () => {
    try { setOrders(await ordersService.getAll(activeFilter || undefined)); }
    catch { /* silent */ } finally { setLoading(false); }
  }, [activeFilter]);

  useEffect(() => {
    if (!authService.isAuthenticated()) { history.push('/login'); return; }
    setLoading(true); fetchOrders();
  }, [history, fetchOrders]);

  useEffect(() => {
    const handle = (e: Event) => {
      const { title, body, order } = (e as CustomEvent<{ title?: string; body?: string; order?: Order }>).detail ?? {};
      if (order?._id) setOrders(prev => prev.some(o => o._id === order._id) ? prev : [order, ...prev]);
      startAlarm();
      setNewOrderAlert({ open: true, message: body ?? title ?? 'Nouvelle commande reçue !' });
      fetchOrders();
    };
    window.addEventListener(NEW_ORDER_EVENT, handle);
    return () => window.removeEventListener(NEW_ORDER_EVENT, handle);
  }, [fetchOrders]);

  useEffect(() => {
    const done = new Set(orders.filter(o => o.status === 'delivered' || o.status === 'cancelled').map(o => o._id));
    if (!done.size) return;
    const cleaned = { ...prepTimers }; let changed = false;
    done.forEach(id => { if (cleaned[id]) { delete cleaned[id]; changed = true; } });
    if (changed) { setPrepTimers(cleaned); saveTimers(cleaned); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const handleRefresh = async (e: CustomEvent) => { await fetchOrders(); (e.detail as { complete: () => void }).complete(); };

  const handleStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    if (orders.find(o => o._id === orderId)?.status === newStatus) return;
    setUpdatingId(orderId);
    try { await ordersService.updateStatus(orderId, newStatus); setToast({ open: true, message: 'Statut mis à jour ✓', color: 'primary' }); await fetchOrders(); }
    catch { setToast({ open: true, message: 'Erreur de mise à jour', color: 'danger' }); }
    finally { setUpdatingId(null); }
  }, [orders, fetchOrders]);

  const handleFeeContinue = () => {
    const fee = Math.max(0, Math.min(10, parseFloat(feeValue) || 0));
    setPrepSheet({ open: true, orderId: feeModal.orderId, orderNumber: feeModal.orderNumber, deliveryFee: fee });
    setFeeModal({ open: false, orderId: '', orderNumber: '' });
    setFeeValue('');
  };

  const handleConfirmWithTime = async (orderId: string, minutes: number, deliveryFee?: number) => {
    const updated = { ...prepTimers, [orderId]: { endMs: now + minutes * 60000, totalMs: minutes * 60000 } };
    setPrepTimers(updated); saveTimers(updated);
    setUpdatingId(orderId);
    try { await ordersService.updateStatus(orderId, 'confirmed', minutes, deliveryFee); setToast({ open: true, message: 'Statut mis à jour ✓', color: 'primary' }); await fetchOrders(); }
    catch { setToast({ open: true, message: 'Erreur de mise à jour', color: 'danger' }); }
    finally { setUpdatingId(null); }
    const toPrint = orders.find(o => o._id === orderId);
    if (toPrint) printOrderReceipt(toPrint, minutes);
  };

  const dateOrders = useMemo(() => orders.filter(o => {
    const d = toDateStr(new Date(o.createdAt));
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  }), [orders, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return dateOrders;
    const q = search.toLowerCase();
    return dateOrders.filter(o => o.orderNumber?.toLowerCase().includes(q) || o.customer.name?.toLowerCase().includes(q) || o.customer.phone?.includes(q));
  }, [dateOrders, search]);

  const pendingCount = dateOrders.filter(o => o.status === 'pending').length;
  const lateCount = Object.values(prepTimers).filter(t2 => t2.endMs < now).length;
  const statusCounts = ['pending', 'confirmed', 'preparing', 'ready']
    .map(s => ({ status: s, count: dateOrders.filter(o => o.status === s).length,
      label: s === 'pending' ? 'Attente' : s === 'confirmed' ? 'Confirmé' : s === 'preparing' ? 'Prépa' : 'Prête' }))
    .filter(s => s.count > 0);

  const iconBtn: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
    background: t.surface, border: `1px solid ${t.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <IonPage>
      <IonToast
        isOpen={newOrderAlert.open}
        header="🌯 Nouvelle commande !"
        message={newOrderAlert.message}
        icon={notificationsOutline}
        position="top"
        layout="stacked"
        buttons={[
          { text: 'Voir', role: 'info', handler: () => { stopAlarm(); setActiveFilter('pending'); } },
          { text: 'OK', role: 'cancel' },
        ]}
        onDidDismiss={() => { stopAlarm(); setNewOrderAlert({ open: false, message: '' }); }}
        style={{
          '--background': t.card,
          '--color': t.text,
          '--border-radius': '16px',
          '--button-color': PRIMARY,
          '--box-shadow': '0 10px 34px rgba(0,0,0,0.28)',
        } as React.CSSProperties}
      />
      <IonActionSheet isOpen={prepSheet.open} header="Temps de préparation"
        subHeader={prepSheet.orderNumber ? `Commande #${prepSheet.orderNumber}` : undefined}
        buttons={[
          { text: '15 minutes', handler: () => handleConfirmWithTime(prepSheet.orderId, 15, prepSheet.deliveryFee) },
          { text: '30 minutes', handler: () => handleConfirmWithTime(prepSheet.orderId, 30, prepSheet.deliveryFee) },
          { text: '45 minutes', handler: () => handleConfirmWithTime(prepSheet.orderId, 45, prepSheet.deliveryFee) },
          { text: '1 heure', handler: () => handleConfirmWithTime(prepSheet.orderId, 60, prepSheet.deliveryFee) },
          { text: 'Annuler', role: 'cancel' },
        ]}
        onDidDismiss={() => setPrepSheet({ open: false, orderId: '', orderNumber: '' })} />

      {/* ════ HEADER ════ */}
      <IonHeader style={{ background: t.headerBg, borderBottom: `1px solid ${t.border}` }}>
        <IonToolbar style={{ '--background': 'transparent', '--border-color': 'transparent', minHeight: 'auto', padding: '12px 14px 8px' }} onClick={unlockAudio}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <IonMenuButton style={{ ...iconBtn, '--color': t.muted, margin: 0 } as React.CSSProperties} />
            <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#1C1200', fontWeight: 900, fontSize: 13 }}>MR</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: t.text, fontWeight: 800, fontSize: 18, letterSpacing: -0.4 }}>Commandes</span>
                {pendingCount > 0 && <span style={{ background: GRAD, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 800, color: '#1C1200' }}>{pendingCount} nouveau{pendingCount > 1 ? 'x' : ''}</span>}
                {lateCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: t.tint, border: `1px solid ${t.tintBorder}`, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: PRIMARY }}><IonIcon icon={timerOutline} style={{ fontSize: 11 }} />{lateCount} en retard</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIMARY, animation: 'liveDot 2.5s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, color: t.muted }}>En ligne</span>
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); toggleTheme(); }} style={iconBtn}>
              <IonIcon icon={isDark ? sunnyOutline : moonOutline} style={{ fontSize: 18, color: PRIMARY }} />
            </button>
            <button onClick={e => { e.stopPropagation(); stopAlarm(); logout(); history.push('/login'); }} style={iconBtn}>
              <IonIcon icon={logOutOutline} style={{ fontSize: 18, color: t.muted }} />
            </button>
          </div>
        </IonToolbar>

        {/* status summary */}
        {!loading && statusCounts.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 14px 8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {statusCounts.map(s => {
              const active = activeFilter === s.status;
              return (
                <button key={s.status} onClick={() => setActiveFilter(s.status)} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer', background: active ? t.tint : t.surface, border: `1px solid ${active ? t.tintBorder : t.border}`, borderRadius: 10, padding: '5px 11px' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: active ? PRIMARY : t.text }}>{s.count}</span>
                  <span style={{ fontSize: 11, color: t.muted }}>{s.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 8px' }}>
          {([
            { label: 'Du', value: dateFrom, set: setDateFrom, max: dateTo || undefined },
            { label: 'Au', value: dateTo, set: setDateTo, min: dateFrom || undefined },
          ] as const).map((f, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 10px', borderRadius: 12, background: t.surface, border: `1px solid ${t.border}` }}>
              <IonIcon icon={calendarOutline} style={{ fontSize: 14, color: t.faint }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: t.faint }}>{f.label}</span>
              <input type="date" value={f.value} min={'min' in f ? f.min : undefined} max={'max' in f ? f.max : undefined}
                onChange={e => f.set(e.target.value)}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: 13, fontWeight: 600, colorScheme: isDark ? 'dark' : 'light' }} />
            </div>
          ))}
          {(dateFrom !== todayStr() || dateTo !== tomorrowStr()) && (
            <button onClick={() => { setDateFrom(todayStr()); setDateTo(tomorrowStr()); }} style={{ height: 40, padding: '0 12px', borderRadius: 12, cursor: 'pointer', flexShrink: 0, border: 'none', background: GRAD, color: '#1C1200', fontSize: 11, fontWeight: 700 }}>Auj.</button>
          )}
        </div>

        {/* search */}
        <div style={{ padding: '0 12px 8px' }}>
          <IonSearchbar value={search} onIonInput={e => setSearch(e.detail.value ?? '')} placeholder="N° commande, client, téléphone…" animated={false}
            style={{ '--background': t.surface, '--color': t.text, '--placeholder-color': t.faint, '--icon-color': t.faint, '--border-radius': '12px', '--box-shadow': 'none', padding: 0 }} />
        </div>

        {/* filter chips */}
        <div style={{ display: 'flex', gap: 6, padding: '0 12px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const active = activeFilter === tab.value;
            const cnt = tab.value ? dateOrders.filter(o => o.status === tab.value).length : dateOrders.length;
            const hasLate = tab.value ? dateOrders.filter(o => o.status === tab.value).some(o => prepTimers[o._id] && prepTimers[o._id].endMs < now) : lateCount > 0;
            return (
              <button key={tab.value} onClick={() => setActiveFilter(tab.value)}
                style={{ height: 34, padding: '0 13px', fontSize: 12, cursor: 'pointer', borderRadius: 10, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', gap: 6, border: active ? 'none' : `1px solid ${t.border}`, background: active ? GRAD : t.surface, color: active ? '#1C1200' : t.muted, fontWeight: active ? 800 : 500 }}>
                {tab.label}
                {cnt > 0 && <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '1px 6px', background: active ? 'rgba(0,0,0,0.18)' : t.card, color: active ? '#1C1200' : t.muted }}>{cnt}</span>}
                {hasLate && !active && <span style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: '50%', background: PRIMARY }} />}
              </button>
            );
          })}
        </div>
      </IonHeader>

      {/* ════ CONTENT ════ */}
      <IonContent style={{ '--background': t.bg }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}><IonRefresherContent pullingText="Actualiser…" /></IonRefresher>

        {loading ? (
          <div style={{ padding: '12px 12px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonCard t={t} /><SkeletonCard t={t} /><SkeletonCard t={t} />
          </div>
        ) : (
          <div style={{ padding: '12px 12px 90px' }}>
            <p style={{ margin: '0 0 10px 2px', fontSize: 12, color: t.muted }}>
              {filtered.length} commande{filtered.length !== 1 ? 's' : ''}{search && <span style={{ color: PRIMARY }}> · « {search} »</span>}
            </p>

            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 16, animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: t.surface, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IonIcon icon={restaurantOutline} style={{ fontSize: 34, color: t.faint }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: t.text, fontWeight: 700, fontSize: 17, margin: 0 }}>Aucune commande</p>
                  <p style={{ color: t.muted, fontSize: 13, margin: '6px 0 0' }}>{search ? `Aucun résultat pour « ${search} »` : 'Les commandes apparaîtront ici'}</p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(order => (
                  <OrderCard key={order._id} order={order} t={t} isDark={isDark} now={now} timers={prepTimers}
                    updating={updatingId === order._id} expanded={expandedId === order._id}
                    onExpand={() => setExpandedId(expandedId === order._id ? null : order._id)}
                    onConfirm={() => setPrepSheet({ open: true, orderId: order._id, orderNumber: order.orderNumber })}
                    onDeliveryFee={() => { setFeeValue(''); setFeeModal({ open: true, orderId: order._id, orderNumber: order.orderNumber }); }}
                    onStatus={s => handleStatusChange(order._id, s)} />
                ))}
              </div>
            )}
          </div>
        )}

        <IonToast isOpen={toast.open} message={toast.message} duration={2000} color={toast.color} position="bottom"
          icon={toast.color === 'danger' ? alertCircleOutline : checkmarkCircleOutline}
          onDidDismiss={() => setToast(prev => ({ ...prev, open: false }))} />
      </IonContent>

      {/* delivery fee modal */}
      {feeModal.open && (
        <div onClick={() => setFeeModal({ open: false, orderId: '', orderNumber: '' })}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 18, padding: '22px 18px 18px', width: '100%', maxWidth: 340, border: `1px solid ${t.border}` }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: t.text, margin: '0 0 4px', textAlign: 'center' }}>Frais de livraison</p>
            {feeModal.orderNumber && <p style={{ fontSize: 12, color: t.muted, margin: '0 0 16px', textAlign: 'center' }}>Commande #{feeModal.orderNumber}</p>}
            <input autoFocus type="number" inputMode="decimal" min={0} max={10} placeholder="0" value={feeValue}
              onChange={e => setFeeValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleFeeContinue(); }}
              style={{ width: '100%', height: 54, borderRadius: 12, border: `2px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 26, fontWeight: 800, textAlign: 'center', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
            <p style={{ fontSize: 11, color: t.faint, margin: '7px 0 18px', textAlign: 'center' }}>Montant en DT (0 — 10)</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setFeeModal({ open: false, orderId: '', orderNumber: '' })} style={{ flex: 1, height: 46, borderRadius: 12, border: `1px solid ${t.border}`, background: t.surface, color: t.muted, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleFeeContinue} style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: GRAD, color: '#1C1200', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Continuer →</button>
            </div>
          </div>
        </div>
      )}
    </IonPage>
  );
}
