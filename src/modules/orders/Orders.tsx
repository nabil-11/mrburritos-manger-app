import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
  IonSelect, IonSelectOption,
  IonSearchbar, IonSpinner, IonToast, IonAlert, IonActionSheet,
  IonMenuButton, IonHeader, IonToolbar,
} from '@ionic/react';
import { IonIcon } from '@ionic/react';
import {
  restaurantOutline, bicycleOutline,
  callOutline, locationOutline, mapOutline, chatbubbleOutline,
  chevronDownOutline, chevronUpOutline, logOutOutline,
  arrowForwardOutline, alertCircleOutline, timerOutline,
  addOutline, bagOutline, moonOutline, sunnyOutline, printOutline,
} from 'ionicons/icons';
import { ordersService, authService } from '../common/api';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Order, ORDER_STATUSES, getStatusLabel, getProductName } from './types';
import { NEW_ORDER_EVENT } from '../../hooks/useNotifications';
import { useOrderStream } from '../../hooks/useOrderStream';
import { startAlarm, stopAlarm, unlockAudio } from '../../hooks/useAlarm';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { dot: string; bar: string; gradient: string }> = {
  pending:   { dot: '#F59E0B', bar: '#F59E0B', gradient: 'linear-gradient(90deg, #F59E0B, #FCD34D)' },
  confirmed: { dot: '#3B82F6', bar: '#3B82F6', gradient: 'linear-gradient(90deg, #3B82F6, #93C5FD)' },
  preparing: { dot: '#8B5CF6', bar: '#8B5CF6', gradient: 'linear-gradient(90deg, #8B5CF6, #C4B5FD)' },
  ready:     { dot: '#10B981', bar: '#10B981', gradient: 'linear-gradient(90deg, #10B981, #6EE7B7)' },
  delivered: { dot: '#6B7280', bar: '#374151', gradient: 'linear-gradient(90deg, #374151, #4B5563)' },
  cancelled: { dot: '#EF4444', bar: '#EF4444', gradient: 'linear-gradient(90deg, #EF4444, #FCA5A5)' },
};
const STATUS_FALLBACK = STATUS_STYLE.delivered;

// ─── Quick actions per status ─────────────────────────────────────────────────
const QUICK_NEXT: Record<string, { status: string; label: string; gradient: string; shadow: string }> = {
  confirmed: {
    status: 'preparing',
    label: 'Démarrer la préparation',
    gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    shadow: 'rgba(109,40,217,0.4)',
  },
  preparing: {
    status: 'ready',
    label: 'Commande prête !',
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    shadow: 'rgba(5,150,105,0.4)',
  },
  ready: {
    status: 'delivered',
    label: 'Marquer comme livré',
    gradient: 'linear-gradient(135deg, #374151, #1F2937)',
    shadow: 'rgba(0,0,0,0.4)',
  },
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────
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

function loadTimers(): TimerMap {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY) ?? '{}'); } catch { return {}; }
}
function saveTimers(t: TimerMap) {
  localStorage.setItem(TIMER_KEY, JSON.stringify(t));
}

// ─── Theme color tokens ───────────────────────────────────────────────────────
function makeTokens(isDark: boolean) {
  return isDark ? {
    contentBg:        '#0F172A', // Darker slate for better depth
    cardBg:           '#1E293B', // Subtle blue-gray for cards
    cardBorder:       'rgba(255,255,255,0.08)',
    cardShadow:       '0 4px 24px rgba(0,0,0,0.4)',
    surf2:            '#334155',
    surf3:            '#475569',
    text1:            '#F1F5F9', // Brighter white for better readability
    text2:            '#94A3B8',
    text3:            '#64748B',
    ageBg:            '#334155',
    ageText:          '#CBD5E1',
    divider:          'rgba(255,255,255,0.08)',
    selectColor:      '#CBD5E1',
    addrBg:           'rgba(59,130,246,0.12)',
    addrBorder:       'rgba(59,130,246,0.2)',
    addrText:         '#60A5FA',
    itemRowBg:        '#334155',
    itemText:         '#F1F5F9',
    suppText:         '#94A3B8',
    totalBg:          '#0F172A',
    totalBorder:      'rgba(255,255,255,0.06)',
    notesBg:          'rgba(245,158,11,0.1)',
    notesBorder:      'rgba(245,158,11,0.2)',
    notesText:        '#F59E0B',
    emptyCardBg:      'linear-gradient(135deg, #1E293B, #334155)',
    emptyCardBorder:  'rgba(255,255,255,0.08)',
    emptyIcon:        '#64748B',
    emptyTitle:       '#F1F5F9',
    emptySubtitle:    '#94A3B8',
    skeletonBg:       '#1E293B',
    skeletonStripe:   '#334155',
    skeletonBlock:    '#475569',
    skeletonAlt:      '#334155',
    countText:        '#CBD5E1',
    headerBg:         'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
    headerBorder:     'rgba(255,255,255,0.08)',
    titleColor:       '#F1F5F9',
    onlineColor:      '#94A3B8',
    pillBg:           'rgba(255,255,255,0.06)',
    pillBorder:       'rgba(255,255,255,0.08)',
    pillText:         '#CBD5E1',
    searchBg:         '#334155',
    searchColor:      '#F1F5F9',
    searchPlaceholder:'#64748B',
    searchIcon:       '#64748B',
    chipBg:           'rgba(255,255,255,0.06)',
    chipBorder:       'rgba(255,255,255,0.09)',
    chipColor:        '#CBD5E1',
    chipCountBg:      'rgba(255,255,255,0.1)',
    chipCountColor:   '#CBD5E1',
    logoutBg:         'rgba(255,255,255,0.07)',
    logoutBorder:     'rgba(255,255,255,0.09)',
  } : {
    contentBg:        '#FAF7F2', // Softer cream background
    cardBg:           '#FFFFFF', // Pure white for cards
    cardBorder:       'rgba(0,0,0,0.08)',
    cardShadow:       '0 2px 16px rgba(0,0,0,0.08)',
    surf2:            '#F8FAFC',
    surf3:            '#F1F5F9',
    text1:            '#1E293B', // Darker for better contrast
    text2:            '#64748B',
    text3:            '#94A3B8',
    ageBg:            '#F1F5F9',
    ageText:          '#475569',
    divider:          'rgba(0,0,0,0.05)',
    selectColor:      '#475569',
    addrBg:           '#EFF6FF',
    addrBorder:       'rgba(59,130,246,0.3)',
    addrText:         '#1D4ED8',
    itemRowBg:        '#F8FAFC',
    itemText:         '#1E293B',
    suppText:         '#64748B',
    totalBg:          '#1E293B',
    totalBorder:      'rgba(0,0,0,0.1)',
    notesBg:          '#FFFBEB',
    notesBorder:      'rgba(245,158,11,0.3)',
    notesText:        '#D97706',
    emptyCardBg:      'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
    emptyCardBorder:  'rgba(0,0,0,0.06)',
    emptyIcon:        '#CBD5E1',
    emptyTitle:       '#1E293B',
    emptySubtitle:    '#64748B',
    skeletonBg:       '#FFFFFF',
    skeletonStripe:   '#F1F5F9',
    skeletonBlock:    '#E2E8F0',
    skeletonAlt:      '#F1F5F9',
    countText:        '#475569',
    headerBg:         'linear-gradient(180deg, #FFFFFF 0%, #FAF7F2 100%)',
    headerBorder:     'rgba(0,0,0,0.08)',
    titleColor:       '#1E293B',
    onlineColor:      '#64748B',
    pillBg:           'rgba(0,0,0,0.03)',
    pillBorder:       'rgba(0,0,0,0.06)',
    pillText:        '#475569',
    searchBg:         '#F1F5F9',
    searchColor:      '#1E293B',
    searchPlaceholder:'#94A3B8',
    searchIcon:       '#94A3B8',
    chipBg:           'rgba(0,0,0,0.03)',
    chipBorder:       'rgba(0,0,0,0.05)',
    chipColor:        '#64748B',
    chipCountBg:      'rgba(0,0,0,0.05)',
    chipCountColor:   '#64748B',
    logoutBg:         'rgba(0,0,0,0.03)',
    logoutBorder:     'rgba(0,0,0,0.05)',
  };
}

// ─── Order age helper ─────────────────────────────────────────────────────────
function getOrderAge(createdAt: string, now: number): string {
  const diffMs   = now - new Date(createdAt).getTime();
  const diffSecs = Math.floor(diffMs / 1_000);
  if (diffSecs < 60)  return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  const secs     = diffSecs % 60;
  if (diffMins < 60)  return `${diffMins}m ${secs}s`;
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return `${h}h${m ? ` ${m}m` : ''}`;
}

// ─── Skeleton loading card ────────────────────────────────────────────────────
function SkeletonCard({ t }: { t: ReturnType<typeof makeTokens> }) {
  const base: React.CSSProperties = {
    background: t.skeletonBlock, borderRadius: 999,
    animation: 'skeletonPulse 1.6s ease-in-out infinite',
  };
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: t.skeletonBg, animation: 'skeletonPulse 1.6s ease-in-out infinite' }}>
      <div style={{ height: 4, background: t.skeletonStripe }} />
      <div style={{ padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...base, height: 12, width: 58 }} />
            <div style={{ ...base, height: 28, width: 170, borderRadius: 8 }} />
            <div style={{ ...base, height: 14, width: 120, borderRadius: 6 }} />
          </div>
          <div style={{ ...base, height: 52, width: 64, borderRadius: 12 }} />
        </div>
        <div style={{ ...base, height: 54, borderRadius: 14, background: t.skeletonAlt }} />
      </div>
      <div style={{ borderTop: `1px solid ${t.divider}`, height: 44 }} />
    </div>
  );
}

// ─── Thermal receipt printer (80 mm roll) ────────────────────────────────────
function printOrderReceipt(order: Order, prepMinutes?: number) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const typeLabel = order.type === 'delivery' ? 'LIVRAISON' : 'A EMPORTER';
  const typeIcon  = order.type === 'delivery' ? '>>>' : '>>>';

  const rows = (order.items ?? []).map(item => {
    const name      = getProductName(item.productName);
    const suppTotal = (item.supplements ?? []).reduce((a, x) => a + x.price, 0);
    const lineTotal = (item.unitPrice + suppTotal) * item.quantity;
    const suppList  = (item.supplements ?? [])
      .filter(s => s.name?.fr || s.name?.ar)
      .map(s => `+ ${s.name?.fr ?? s.name?.ar}${s.price > 0 ? ` (${s.price.toFixed(2)})` : ''}`)
      .join('<br>');
    const suppHtml  = suppList ? `<div class="supp">${suppList}</div>` : '';
    const noteHtml  = item.notes ? `<div class="note">"${item.notes}"</div>` : '';
    return `
      <tr>
        <td class="qty">x${item.quantity}</td>
        <td class="name">${name}${suppHtml}${noteHtml}</td>
        <td class="price">${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join('');

  const addrHtml = order.type === 'delivery' && order.customer.address
    ? `<tr><td class="lbl">ADRESSE</td><td class="val addr" colspan="1">${order.customer.address}</td></tr>`
    : '';

  const notesHtml = order.notes
    ? `<hr class="dash"><div class="notesbox">NOTE: ${order.notes}</div>`
    : '';

  const prepHtml = prepMinutes
    ? `<div class="prep-row">
        <span class="prep-lbl">Temps de preparation</span>
        <span class="prep-val">${prepMinutes >= 60 ? `${Math.floor(prepMinutes / 60)}h${prepMinutes % 60 ? ` ${prepMinutes % 60}min` : ''}` : `${prepMinutes} min`}</span>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Commande #${order.orderNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    margin: 0;
    padding: 6px 8px 24px;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .brand {
    font-size: 22px;
    font-weight: 900;
    text-align: center;
    letter-spacing: 2px;
    margin-bottom: 2px;
  }
  .tagline { font-size: 10px; text-align: center; color: #444; }
  .dash {
    border: none;
    border-top: 1.5px dashed #000;
    margin: 7px 0;
  }
  .ordnum {
    font-size: 17px;
    font-weight: 900;
    text-align: center;
    letter-spacing: 2px;
    margin: 5px 0 2px;
  }
  .datetime {
    font-size: 11px;
    text-align: center;
    color: #333;
    margin-bottom: 5px;
  }
  .mode {
    font-size: 15px;
    font-weight: 900;
    text-align: center;
    border: 2px solid #000;
    padding: 5px 0;
    margin: 7px 0;
    letter-spacing: 1.5px;
  }
  .info-table { width: 100%; border-collapse: collapse; margin: 3px 0; }
  .lbl { font-size: 9px; color: #555; padding-bottom: 1px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .val { font-size: 13px; font-weight: 700; padding-bottom: 5px; }
  .addr { font-size: 12px; line-height: 1.45; word-break: break-word; }
  .section-head {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 7px 0 4px;
    color: #444;
  }
  table.items { width: 100%; border-collapse: collapse; }
  .qty  { width: 24px; vertical-align: top; font-weight: 900; font-size: 13px; padding-right: 5px; white-space: nowrap; }
  .name { vertical-align: top; font-size: 13px; line-height: 1.45; word-break: break-word; }
  .price {
    text-align: right; vertical-align: top;
    white-space: nowrap; padding-left: 5px;
    font-weight: 800; font-size: 13px;
    width: 1%;
  }
  td { padding-bottom: 6px; }
  .supp { font-size: 10px; color: #444; margin-top: 2px; }
  .note { font-size: 10px; color: #555; font-style: italic; margin-top: 2px; }
  .tot-label { font-size: 17px; font-weight: 900; padding-top: 4px; }
  .tot-val   { font-size: 17px; font-weight: 900; text-align: right; padding-top: 4px; white-space: nowrap; }
  .notesbox  {
    border: 1.5px dashed #000;
    padding: 6px 8px;
    font-size: 12px;
    font-style: italic;
    line-height: 1.5;
    margin: 5px 0;
    word-break: break-word;
  }
  .thanks { font-size: 11px; text-align: center; margin-top: 10px; letter-spacing: 0.5px; }
  .prep-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f0f0f0;
    border: 1.5px solid #000;
    border-radius: 3px;
    padding: 5px 8px;
    margin: 6px 0;
  }
  .prep-lbl { font-size: 11px; font-weight: 700; }
  .prep-val { font-size: 14px; font-weight: 900; }
  @media print {
    @page {
      size: 80mm auto;
      margin: 0;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 4px 6px 20px;
    }
  }
</style>
</head>
<body>
  <div class="brand">MR. BURRITOS</div>
  <div class="tagline">Gestionnaire de commandes</div>
  <hr class="dash">
  <div class="ordnum">COMMANDE #${order.orderNumber}</div>
  <div class="datetime">${dateStr} a ${timeStr}</div>
  <div class="mode">${typeIcon} ${typeLabel} ${typeIcon}</div>
  ${prepHtml}
  <hr class="dash">
  <table class="info-table"><tbody>
    <tr>
      <td>
        <div class="lbl">CLIENT</div>
        <div class="val">${order.customer.name}</div>
      </td>
      <td style="text-align:right">
        <div class="lbl">TEL</div>
        <div class="val">${order.customer.phone}</div>
      </td>
    </tr>
    ${addrHtml}
  </tbody></table>
  <hr class="dash">
  <div class="section-head">Articles commandes</div>
  <table class="items"><tbody>${rows}</tbody></table>
  <hr class="dash">
  <table style="width:100%"><tbody>
    <tr>
      <td class="tot-label">TOTAL</td>
      <td class="tot-val">${order.total.toFixed(2)} DT</td>
    </tr>
  </tbody></table>
  ${notesHtml}
  <hr class="dash">
  <div class="thanks">Merci pour votre commande !</div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2_000);
    }, 450);
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const history  = useHistory();
  const { logout, isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // ── Real-time order stream (SSE) ─────────────────────────────────────────
  useOrderStream(isAuthenticated);
  const T = makeTokens(isDark);

  const [orders,        setOrders]       = useState<Order[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [activeFilter,  setActiveFilter] = useState('pending');
  const [search,        setSearch]       = useState('');
  const [toast,         setToast]        = useState<{ open: boolean; message: string; color: string }>
                                           ({ open: false, message: '', color: 'success' });
  const [updatingId,    setUpdatingId]   = useState<string | null>(null);
  const [expandedId,    setExpandedId]   = useState<string | null>(null);
  const [newOrderAlert, setNewOrderAlert]= useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [prepTimers,    setPrepTimers]   = useState<TimerMap>(loadTimers);
  const [prepSheet,     setPrepSheet]    = useState<{ open: boolean; orderId: string; orderNumber: string; deliveryFee?: number }>
                                           ({ open: false, orderId: '', orderNumber: '' });
  const [deliveryFeeModal, setDeliveryFeeModal] = useState<{ open: boolean; orderId: string; orderNumber: string }>
                                           ({ open: false, orderId: '', orderNumber: '' });
  const [deliveryFeeValue, setDeliveryFeeValue] = useState('');
  const [now,           setNow]          = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await ordersService.getAll(activeFilter || undefined);
      setOrders(data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (!authService.isAuthenticated()) { history.push('/login'); return; }
    setLoading(true);
    fetchOrders();
  }, [history, fetchOrders]);

  useEffect(() => {
    const handle = (e: Event) => {
      const { title, body } = (e as CustomEvent).detail ?? {};
      startAlarm();
      setNewOrderAlert({ open: true, message: body ?? title ?? 'Nouvelle commande reçue !' });
      fetchOrders();
    };
    window.addEventListener(NEW_ORDER_EVENT, handle);
    return () => window.removeEventListener(NEW_ORDER_EVENT, handle);
  }, [fetchOrders]);

  useEffect(() => {
    const done = new Set(
      orders.filter(o => o.status === 'delivered' || o.status === 'cancelled').map(o => o._id)
    );
    if (done.size === 0) return;
    const cleaned = { ...prepTimers };
    let changed = false;
    done.forEach(id => { if (cleaned[id]) { delete cleaned[id]; changed = true; } });
    if (changed) { setPrepTimers(cleaned); saveTimers(cleaned); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const handleRefresh = async (e: CustomEvent) => { await fetchOrders(); e.detail.complete(); };

  const handleStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    if (orders.find(o => o._id === orderId)?.status === newStatus) return;
    setUpdatingId(orderId);
    try {
      await ordersService.updateStatus(orderId, newStatus);
      setToast({ open: true, message: 'Statut mis à jour ✓', color: 'success' });
      await fetchOrders();
    } catch {
      setToast({ open: true, message: 'Erreur de mise à jour', color: 'danger' });
    } finally {
      setUpdatingId(null);
    }
  }, [orders, fetchOrders]);

  const handleDeliveryFeeContinue = () => {
    const fee = Math.max(0, Math.min(10, parseFloat(deliveryFeeValue) || 0));
    setPrepSheet({ open: true, orderId: deliveryFeeModal.orderId, orderNumber: deliveryFeeModal.orderNumber, deliveryFee: fee });
    setDeliveryFeeModal({ open: false, orderId: '', orderNumber: '' });
    setDeliveryFeeValue('');
  };

  const handleConfirmWithTime = async (orderId: string, minutes: number, deliveryFee?: number) => {
    const endMs   = now + minutes * 60_000;
    const totalMs = minutes * 60_000;
    const updated = { ...prepTimers, [orderId]: { endMs, totalMs } };
    setPrepTimers(updated);
    saveTimers(updated);
    setUpdatingId(orderId);
    try {
      await ordersService.updateStatus(orderId, 'confirmed', minutes, deliveryFee);
      setToast({ open: true, message: 'Statut mis à jour ✓', color: 'success' });
      await fetchOrders();
    } catch {
      setToast({ open: true, message: 'Erreur de mise à jour', color: 'danger' });
    } finally {
      setUpdatingId(null);
    }
    // Auto-print receipt on confirmation
    const orderToPrint = orders.find(o => o._id === orderId);
    if (orderToPrint) printOrderReceipt(orderToPrint, minutes);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customer.name?.toLowerCase().includes(q) ||
      o.customer.phone?.includes(q)
    );
  }, [orders, search]);

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const lateCount    = Object.values(prepTimers).filter(t => t.endMs < now).length;

  const statusCounts = ['pending', 'confirmed', 'preparing', 'ready'].map(s => ({
    status: s,
    count: orders.filter(o => o.status === s).length,
    color: STATUS_STYLE[s].dot,
    label: s === 'pending' ? 'Attente' : s === 'confirmed' ? 'Confirmé' : s === 'preparing' ? 'Prépa' : 'Prête',
  })).filter(s => s.count > 0);

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonAlert
        isOpen={newOrderAlert.open}
        header="🌯 Nouvelle commande !"
        message={newOrderAlert.message}
        buttons={[{ text: 'OK', handler: () => { stopAlarm(); setNewOrderAlert({ open: false, message: '' }); setActiveFilter('pending'); } }]}
        onDidDismiss={() => { stopAlarm(); setNewOrderAlert({ open: false, message: '' }); }}
      />
      <IonActionSheet
        isOpen={prepSheet.open}
        header="Temps de préparation"
        subHeader={prepSheet.orderNumber ? `Commande #${prepSheet.orderNumber}` : undefined}
        buttons={[
          { text: '15 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(prepSheet.orderId, 15, prepSheet.deliveryFee) },
          { text: '30 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(prepSheet.orderId, 30, prepSheet.deliveryFee) },
          { text: '45 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(prepSheet.orderId, 45, prepSheet.deliveryFee) },
          { text: '1 heure',    icon: timerOutline, handler: () => handleConfirmWithTime(prepSheet.orderId, 60, prepSheet.deliveryFee) },
          { text: 'Annuler', role: 'cancel' },
        ]}
        onDidDismiss={() => setPrepSheet({ open: false, orderId: '', orderNumber: '' })}
      />

      {/* ════════════════════ HEADER ════════════════════ */}
      <IonHeader style={{ background: T.headerBg, borderBottom: `1px solid ${T.headerBorder}` }}>
        <IonToolbar
          style={{
            '--background': 'transparent',
            '--border-color': 'transparent',
            minHeight: 'auto',
            padding: '14px 16px 10px',
          }}
          onClick={unlockAudio}
        >
          {/* ── Brand row ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            {/* Menu Button */}
            <IonMenuButton
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.03)',
                border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.05)',
                '--color': T.text2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 0,
              }}
            />

            {/* Logo */}
            <div style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg, #F5A800, #FF6B00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 14px rgba(245,168,0,0.45)',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: -0.5 }}>MR</span>
            </div>

            {/* Title + live dot */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: T.titleColor, fontWeight: 800, fontSize: 18, letterSpacing: -0.4 }}>Commandes</span>
                {pendingCount > 0 && (
                  <div style={{
                    background: '#EF4444', borderRadius: 999,
                    padding: '2px 8px', fontSize: 11, fontWeight: 800, color: '#fff',
                  }}>
                    {pendingCount} nouveau{pendingCount > 1 ? 'x' : ''}
                  </div>
                )}
                {lateCount > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'rgba(239,68,68,0.12)', borderRadius: 999,
                    padding: '2px 8px', border: '1px solid rgba(239,68,68,0.2)',
                  }}>
                    <IonIcon icon={alertCircleOutline} style={{ fontSize: 10, color: '#FCA5A5' }} />
                    <span style={{ fontSize: 10, color: '#FCA5A5', fontWeight: 700 }}>{lateCount} en retard</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#10B981',
                  animation: 'liveDot 2.5s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 11, color: T.onlineColor, fontWeight: 500 }}>En ligne</span>
              </div>
            </div>

            {/* ── Dark/Light toggle ── */}
            <button
              onClick={e => { e.stopPropagation(); toggleTheme(); }}
              title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
              style={{
                width: 40, height: 40, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(245,168,0,0.15)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(245,168,0,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s, border 0.2s',
              }}
            >
              <IonIcon
                icon={isDark ? sunnyOutline : moonOutline}
                style={{
                  fontSize: 18,
                  color: isDark ? '#F5A800' : '#C4A35A',
                  transition: 'color 0.2s',
                }}
              />
            </button>

            {/* Logout */}
            <button
              onClick={e => { e.stopPropagation(); stopAlarm(); logout(); history.push('/login'); }}
              style={{
                width: 40, height: 40, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                background: T.logoutBg,
                border: `1px solid ${T.logoutBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s, border 0.2s',
              }}
            >
              <IonIcon icon={logOutOutline} style={{ fontSize: 18, color: T.text2 }} />
            </button>
          </div>
        </IonToolbar>

        {/* ── Live status summary pills ── */}
        {!loading && statusCounts.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {statusCounts.map(s => (
              <button
                key={s.status}
                onClick={() => setActiveFilter(s.status)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer',
                  background: activeFilter === s.status ? `${s.color}22` : T.pillBg,
                  border: `1px solid ${activeFilter === s.status ? `${s.color}44` : T.pillBorder}`,
                  borderRadius: 10, padding: '5px 12px',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.count}</span>
                <span style={{ fontSize: 11, color: T.pillText, fontWeight: 500 }}>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Search ── */}
        <div style={{ padding: '0 12px 10px' }}>
          <IonSearchbar
            value={search}
            onIonInput={e => setSearch(e.detail.value ?? '')}
            placeholder="N° commande, client, téléphone…"
            animated={false}
            style={{
              '--background': T.searchBg, '--color': T.searchColor,
              '--placeholder-color': T.searchPlaceholder, '--icon-color': T.searchIcon,
              '--clear-button-color': T.text2,
              '--border-radius': '13px', '--box-shadow': 'none', padding: 0,
            }}
          />
        </div>

        {/* ── Filter chips ── */}
        <div style={{ display: 'flex', gap: 6, padding: '0 12px 14px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const isActive = activeFilter === tab.value;
            const ss       = tab.value ? STATUS_STYLE[tab.value] : null;
            const cnt      = tab.value ? orders.filter(o => o.status === tab.value).length : orders.length;
            const hasLate  = tab.value
              ? orders.filter(o => o.status === tab.value).some(o => prepTimers[o._id] && prepTimers[o._id].endMs < now)
              : lateCount > 0;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                style={{
                  height: 34, padding: '0 13px', fontSize: 12, cursor: 'pointer',
                  borderRadius: 9, flexShrink: 0, position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 6,
                  border: isActive ? 'none' : `1px solid ${T.chipBorder}`,
                  background: isActive
                    ? (ss ? ss.gradient : 'linear-gradient(135deg, #F5A800, #FF8C00)')
                    : T.chipBg,
                  color: isActive ? (tab.value ? '#fff' : '#1C1200') : T.chipColor,
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.15s',
                  boxShadow: isActive && ss ? `0 2px 10px ${ss.dot}33` : 'none',
                }}
              >
                {tab.label}
                {cnt > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, borderRadius: 999,
                    padding: '1px 5px',
                    background: isActive ? 'rgba(0,0,0,0.2)' : T.chipCountBg,
                    color: isActive ? 'rgba(255,255,255,0.9)' : T.chipCountColor,
                  }}>
                    {cnt}
                  </span>
                )}
                {hasLate && !isActive && (
                  <span style={{
                    position: 'absolute', top: 5, right: 5,
                    width: 5, height: 5, borderRadius: '50%', background: '#EF4444',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </IonHeader>

      {/* ════════════════════ CONTENT ════════════════════ */}
      <IonContent style={{ '--background': T.contentBg, transition: 'background 0.25s' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingText="Actualiser…" />
        </IonRefresher>

        {loading ? (
          <div style={{ padding: '12px 12px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonCard t={T} />
            <SkeletonCard t={T} />
            <SkeletonCard t={T} />
          </div>
        ) : (
          <div style={{ padding: '12px 12px 80px' }}>

            {/* Count */}
            <div style={{ marginBottom: 10, paddingLeft: 2 }}>
              <span style={{ fontSize: 12, color: T.countText, fontWeight: 500 }}>
                {filtered.length} commande{filtered.length !== 1 ? 's' : ''}
                {search && <span style={{ color: '#F5A800' }}> · « {search} »</span>}
              </span>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                paddingTop: 64, gap: 18, animation: 'slideUp 0.3s ease-out',
              }}>
                <div style={{
                  width: 84, height: 84, borderRadius: '50%',
                  background: T.emptyCardBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: `1px solid ${T.emptyCardBorder}`,
                }}>
                  <IonIcon icon={restaurantOutline} style={{ fontSize: 36, color: T.emptyIcon }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: T.emptyTitle, fontWeight: 700, fontSize: 18, margin: 0 }}>
                    Aucune commande
                  </p>
                  <p style={{ color: T.emptySubtitle, fontSize: 13, marginTop: 6, margin: '6px 0 0' }}>
                    {search ? `Aucun résultat pour « ${search} »` : 'Les commandes apparaîtront ici'}
                  </p>
                </div>
              </div>
            )}

            {/* ════════ ORDER CARDS ════════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(order => {
                const ss         = STATUS_STYLE[order.status] ?? STATUS_FALLBACK;
                const timer      = order.status === 'confirmed' ? prepTimers[order._id] : undefined;
                const isLate     = timer ? timer.endMs < now : false;
                const isUpdating = updatingId === order._id;
                const isExpanded = expandedId === order._id;
                const hasDetails = !!(order.customer.address || (order.items && order.items.length > 0) || order.notes);
                const nextAction = QUICK_NEXT[order.status];

                // Compact timer text for confirmed orders
                const timerText = (() => {
                  if (!timer) return null;
                  if (isLate) return { label: 'En retard', color: '#EF4444' };
                  const rem  = Math.max(0, Math.floor((timer.endMs - now) / 1_000));
                  const m    = Math.floor(rem / 60);
                  const s    = rem % 60;
                  const pct  = (timer.endMs - now) / timer.totalMs;
                  const color = pct > 0.5 ? '#10B981' : pct > 0.25 ? '#F59E0B' : '#EF4444';
                  return { label: `${m}:${s.toString().padStart(2, '0')} restant`, color };
                })();

                return (
                  <div
                    key={order._id}
                    style={{
                      borderRadius: 16,
                      overflow: 'hidden',
                      background: isLate
                        ? (isDark ? 'rgba(239,68,68,0.07)' : '#FEF2F2')
                        : order.status === 'pending'
                          ? (isDark ? 'rgba(245,158,11,0.06)' : '#FFFBEB')
                          : T.cardBg,
                      border: isLate
                        ? '1px solid rgba(239,68,68,0.25)'
                        : order.status === 'pending'
                          ? '1px solid rgba(245,158,11,0.25)'
                          : `1px solid ${T.cardBorder}`,
                      boxShadow: T.cardShadow,
                      animation: !isUpdating
                        ? isLate
                          ? 'latePulse 1.5s ease-in-out infinite'
                          : order.status === 'pending'
                            ? 'pendingPulse 2.5s ease-in-out infinite'
                            : undefined
                        : undefined,
                      opacity: isUpdating ? 0.6 : 1,
                      transition: 'opacity 0.15s, background 0.25s, border-color 0.25s',
                      display: 'flex',
                    }}
                  >
                    {/* ── Left status accent stripe ── */}
                    <div style={{ width: 4, flexShrink: 0, background: ss.gradient }} />

                    {/* ── Main card content ── */}
                    <div style={{ flex: 1, minWidth: 0 }}>

                      {/* Timer progress bar — confirmed orders only */}
                      {timer && (
                        <div style={{ height: 3, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{
                            position: 'absolute', left: 0, top: 0, height: '100%',
                            width: `${Math.max(0, Math.min(100, ((timer.endMs - now) / timer.totalMs) * 100))}%`,
                            background: isLate ? '#EF4444' : (timer.endMs - now) / timer.totalMs > 0.25 ? '#10B981' : '#F59E0B',
                            transition: 'width 1s linear',
                          }} />
                        </div>
                      )}

                      {/* ── Row 1: order number · age · NEW badge | type ── */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 900, fontSize: 13, color: '#F5A800', letterSpacing: 0.3 }}>
                            #{order.orderNumber}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: T.ageText,
                            background: T.ageBg, borderRadius: 999, padding: '2px 8px',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {getOrderAge(order.createdAt, now)}
                          </span>
                          {order.status === 'pending' && (
                            <span style={{
                              fontSize: 9, fontWeight: 900, letterSpacing: 1,
                              color: '#92400E', background: '#FDE68A',
                              borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase',
                            }}>
                              Nouveau
                            </span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                          background: order.type === 'delivery' ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.12)',
                          border: `1px solid ${order.type === 'delivery' ? 'rgba(16,185,129,0.28)' : 'rgba(139,92,246,0.28)'}`,
                          color: order.type === 'delivery' ? '#10B981' : '#8B5CF6',
                          borderRadius: 8, padding: '4px 11px', fontSize: 11, fontWeight: 700,
                        }}>
                          <IonIcon icon={order.type === 'delivery' ? bicycleOutline : bagOutline} style={{ fontSize: 13 }} />
                          {order.type === 'delivery' ? 'Livraison' : 'À emporter'}
                        </div>
                      </div>

                      {/* ── Row 2: customer name + total ── */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 13px 0', gap: 8 }}>
                        {/* Left: name + phone + map */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 18, fontWeight: 800, color: T.text1,
                            letterSpacing: -0.4, lineHeight: 1.15, margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {order.customer.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                            <IonIcon icon={callOutline} style={{ fontSize: 12, color: T.text3, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: T.text2, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {order.customer.phone}
                            </span>
                            {order.type === 'delivery' && order.customer.address && (() => {
                              const mapsUrl = order.customer.latitude && order.customer.longitude
                                ? `https://www.google.com/maps/dir/?api=1&destination=${order.customer.latitude},${order.customer.longitude}`
                                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.customer.address)}`;
                              return (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                                    background: T.addrBg, border: `1px solid ${T.addrBorder}`,
                                    color: isDark ? '#60A5FA' : '#2563EB',
                                    borderRadius: 7, padding: '3px 9px',
                                    fontSize: 11, fontWeight: 700, textDecoration: 'none',
                                  }}
                                >
                                  <IonIcon icon={mapOutline} style={{ fontSize: 11 }} />
                                  Map
                                </a>
                              );
                            })()}
                          </div>
                        </div>
                        {/* Right: total + status badge */}
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
                            <span style={{
                              fontSize: 24, fontWeight: 900, color: T.text1,
                              letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                            }}>
                              {order.total.toFixed(2)}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#F5A800', letterSpacing: 0.5 }}>DT</span>
                          </div>
                          {!timerText && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5,
                              padding: '3px 9px', borderRadius: 7,
                              background: `${ss.dot}15`, border: `1px solid ${ss.dot}32`,
                            }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: ss.dot }}>
                                {getStatusLabel(order.status)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Delivery info row (company · fee · phone) ── */}
                      {order.type === 'delivery' && (order.deliveryCompany?.name || order.deliveryFee != null || order.deliveryCompany?.phone) && (
                        <div style={{
                          margin: '8px 13px 0',
                          padding: '8px 11px',
                          borderRadius: 10,
                          background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(220,252,231,0.7)',
                          border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.25)'}`,
                          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 14px',
                        }}>
                          <IonIcon icon={bicycleOutline} style={{ fontSize: 14, color: '#10B981', flexShrink: 0 }} />
                          {order.deliveryCompany?.name && (
                            <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#6EE7B7' : '#065F46' }}>
                              {order.deliveryCompany.name}
                              {order.deliveryCompany.commission > 0 && (
                                <span style={{ fontWeight: 500, color: T.text2, marginLeft: 4 }}>
                                  ({order.deliveryCompany.commission}%)
                                </span>
                              )}
                            </span>
                          )}
                          {order.deliveryCompany?.phone && (
                            <a
                              href={`tel:${order.deliveryCompany.phone}`}
                              onClick={e => e.stopPropagation()}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: 12, fontWeight: 700, textDecoration: 'none',
                                color: isDark ? '#6EE7B7' : '#065F46',
                              }}
                            >
                              <IonIcon icon={callOutline} style={{ fontSize: 11 }} />
                              {order.deliveryCompany.phone}
                            </a>
                          )}
                          {order.deliveryFee != null && order.deliveryFee > 0 && (
                            <span style={{
                              marginLeft: 'auto', flexShrink: 0,
                              fontSize: 13, fontWeight: 900,
                              color: isDark ? '#6EE7B7' : '#065F46',
                            }}>
                              +{order.deliveryFee.toFixed(2)} DT
                            </span>
                          )}
                        </div>
                      )}

                      {/* ── Timer countdown box (confirmed orders) ── */}
                      {timerText && (
                        <div style={{
                          margin: '9px 13px 0',
                          padding: '8px 12px',
                          borderRadius: 11,
                          background: isLate
                            ? (isDark ? 'rgba(239,68,68,0.14)' : 'rgba(254,226,226,0.9)')
                            : timer && (timer.endMs - now) / timer.totalMs > 0.25
                              ? (isDark ? 'rgba(16,185,129,0.1)' : 'rgba(220,252,231,0.9)')
                              : (isDark ? 'rgba(245,158,11,0.12)' : 'rgba(254,243,199,0.9)'),
                          border: `1px solid ${timerText.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <IonIcon icon={timerOutline} style={{ fontSize: 16, color: timerText.color }} />
                            <span style={{ fontSize: 15, fontWeight: 800, color: timerText.color, fontVariantNumeric: 'tabular-nums' }}>
                              {timerText.label}
                            </span>
                          </div>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 9px', borderRadius: 7,
                            background: `${ss.dot}15`, border: `1px solid ${ss.dot}32`,
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: ss.dot }}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* ── Primary action button — full width ── */}
                      {!isUpdating && (order.status === 'pending' || nextAction) && (
                        <div style={{ padding: '10px 13px 0' }}>
                          {order.status === 'pending' ? (
                            <button
                              onClick={() => {
                                if (order.type === 'delivery') {
                                  setDeliveryFeeValue('');
                                  setDeliveryFeeModal({ open: true, orderId: order._id, orderNumber: order.orderNumber });
                                } else {
                                  setPrepSheet({ open: true, orderId: order._id, orderNumber: order.orderNumber });
                                }
                              }}
                              style={{
                                width: '100%', height: 46, borderRadius: 12,
                                border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #F5A800, #FF8C00)',
                                color: '#1C1200', fontWeight: 800, fontSize: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                boxShadow: '0 4px 16px rgba(245,168,0,0.4)',
                                letterSpacing: 0.2,
                              }}
                            >
                              <IonIcon icon={timerOutline} style={{ fontSize: 17 }} />
                              Confirmer la commande
                            </button>
                          ) : nextAction ? (
                            <button
                              onClick={() => handleStatusChange(order._id, nextAction.status)}
                              style={{
                                width: '100%', height: 46, borderRadius: 12,
                                border: 'none', cursor: 'pointer',
                                background: nextAction.gradient,
                                color: '#fff', fontWeight: 800, fontSize: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                boxShadow: `0 4px 16px ${nextAction.shadow}`,
                                letterSpacing: 0.2,
                              }}
                            >
                              <IonIcon icon={arrowForwardOutline} style={{ fontSize: 17 }} />
                              {nextAction.label}
                            </button>
                          ) : null}
                        </div>
                      )}

                      {/* ── Updating spinner ── */}
                      {isUpdating && (
                        <div style={{ padding: '14px 13px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <IonSpinner name="dots" style={{ color: '#F5A800', width: 22, height: 22 }} />
                          <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>Mise à jour…</span>
                        </div>
                      )}

                      {/* ── Footer bar ── */}
                      <div style={{
                        borderTop: `1px solid ${T.divider}`, marginTop: 11,
                        display: 'flex', alignItems: 'center',
                        padding: '0 4px 0 13px', minHeight: 42,
                      }}>
                        {/* Left: items count + print */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto' }}>
                          {order.items && order.items.length > 0 && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              background: T.surf2, borderRadius: 7, padding: '3px 9px',
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#F5A800' }}>{order.items.length}</span>
                              <span style={{ fontSize: 10, color: T.text2, fontWeight: 500 }}>art.</span>
                            </div>
                          )}
                          {!isUpdating && ['confirmed', 'preparing', 'ready'].includes(order.status) && (
                            <button
                              onClick={() => printOrderReceipt(order, prepTimers[order._id] ? Math.round(prepTimers[order._id].totalMs / 60_000) : undefined)}
                              title="Imprimer le reçu"
                              style={{
                                width: 30, height: 30, borderRadius: 8,
                                border: `1px solid ${T.chipBorder}`,
                                background: T.chipBg, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <IonIcon icon={printOutline} style={{ fontSize: 14, color: T.text2 }} />
                            </button>
                          )}
                        </div>
                        {/* Status select */}
                        {!isUpdating && (
                          <IonSelect
                            value={order.status}
                            onIonChange={e => handleStatusChange(order._id, e.detail.value!)}
                            interface="action-sheet"
                            interfaceOptions={{ header: `Commande #${order.orderNumber}` }}
                            style={{
                              '--padding-start': '0px',
                              '--highlight-color-focused': '#F5A800',
                              '--color': T.selectColor,
                              fontSize: 11, fontWeight: 600,
                            }}
                          >
                            {ORDER_STATUSES.map(os => (
                              <IonSelectOption key={os.value} value={os.value}>{os.label}</IonSelectOption>
                            ))}
                          </IonSelect>
                        )}
                        {/* Details toggle */}
                        {hasDetails && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : order._id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 3,
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: '10px 12px 10px 8px', flexShrink: 0,
                              color: isExpanded ? '#F5A800' : T.text3,
                              fontSize: 11, fontWeight: 600,
                            }}
                          >
                            <span>{isExpanded ? 'Masquer' : 'Détails'}</span>
                            <IonIcon icon={isExpanded ? chevronUpOutline : chevronDownOutline} style={{ fontSize: 11 }} />
                          </button>
                        )}
                      </div>

                      {/* ── Expandable details ── */}
                      {isExpanded && (
                        <div style={{
                          padding: '14px 14px 18px',
                          borderTop: `1px solid ${T.divider}`,
                          display: 'flex', flexDirection: 'column', gap: 8,
                          animation: 'slideUp 0.2s ease-out',
                        }}>
                          {order.type === 'delivery' && order.customer.address && (() => {
                            const mapsUrl = order.customer.latitude && order.customer.longitude
                              ? `https://www.google.com/maps/dir/?api=1&destination=${order.customer.latitude},${order.customer.longitude}`
                              : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.customer.address)}`;
                            return (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 10,
                                  background: T.addrBg, borderRadius: 12,
                                  border: `1px solid ${T.addrBorder}`, padding: '11px 13px',
                                  textDecoration: 'none',
                                }}
                              >
                                <IonIcon icon={locationOutline} style={{ fontSize: 15, color: '#60A5FA', flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 13, color: T.addrText, lineHeight: 1.55, display: 'block' }}>
                                    {order.customer.address}
                                  </span>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    fontSize: 10, fontWeight: 700,
                                    color: isDark ? '#60A5FA' : '#2563EB',
                                    marginTop: 4,
                                  }}>
                                    <IonIcon icon={mapOutline} style={{ fontSize: 10 }} />
                                    Ouvrir dans Maps
                                  </span>
                                </div>
                              </a>
                            );
                          })()}

                          {order.items && order.items.length > 0 && (
                            <div>
                              <p style={{
                                fontSize: 10, fontWeight: 800, color: T.text3,
                                letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px 2px',
                              }}>
                                Articles
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {order.items.map((item, idx) => {
                                  const name      = getProductName(item.productName);
                                  const suppTotal = (item.supplements ?? []).reduce((a, x) => a + x.price, 0);
                                  const lineTotal = (item.unitPrice + suppTotal) * item.quantity;
                                  return (
                                    <div key={idx} style={{
                                      display: 'flex', alignItems: 'flex-start', gap: 11,
                                      background: T.itemRowBg, borderRadius: 13, padding: '11px 13px',
                                    }}>
                                      <div style={{
                                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                        background: 'linear-gradient(135deg, #F5A800, #FF8C00)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 900, fontSize: 15, color: '#1C1200',
                                      }}>
                                        {item.quantity}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: T.itemText, margin: 0 }}>
                                          {name}
                                        </p>
                                        {item.supplements && item.supplements.length > 0 && (
                                          <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {item.supplements.map((sup, si) => (
                                              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <IonIcon icon={addOutline} style={{ fontSize: 9, color: '#10B981' }} />
                                                <span style={{ fontSize: 11, color: T.suppText }}>
                                                  {sup.name?.fr ?? sup.name?.ar ?? '—'}
                                                  {sup.price > 0 ? ` +${sup.price.toFixed(2)} DT` : ''}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {item.notes && (
                                          <p style={{ fontSize: 11, color: T.text3, fontStyle: 'italic', margin: '5px 0 0' }}>
                                            {item.notes}
                                          </p>
                                        )}
                                      </div>
                                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: T.text1, margin: 0 }}>
                                          {lineTotal.toFixed(2)}
                                        </p>
                                        <p style={{ fontSize: 10, color: T.text2, margin: 0 }}>DT</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div style={{
                                background: T.totalBg, borderRadius: 13,
                                padding: '11px 14px', marginTop: 8,
                                border: `1px solid ${T.totalBorder}`,
                              }}>
                                {order.subtotal !== undefined && order.subtotal !== order.total && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                                    <span style={{ fontSize: 12, color: '#6B7280' }}>Sous-total</span>
                                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>{order.subtotal.toFixed(2)} DT</span>
                                  </div>
                                )}
                                {order.deliveryCompany?.name && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                                      Livreur — {order.deliveryCompany.name}
                                      {order.deliveryCompany.commission > 0 && ` (${order.deliveryCompany.commission}%)`}
                                    </span>
                                    {order.deliveryCompany.phone && (
                                      <a
                                        href={`tel:${order.deliveryCompany.phone}`}
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: 3,
                                          fontSize: 11, fontWeight: 700, textDecoration: 'none',
                                          color: '#10B981',
                                        }}
                                      >
                                        <IonIcon icon={callOutline} style={{ fontSize: 11 }} />
                                        {order.deliveryCompany.phone}
                                      </a>
                                    )}
                                  </div>
                                )}
                                {order.deliveryFee != null && order.deliveryFee > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                                    <span style={{ fontSize: 12, color: '#6B7280' }}>Frais de livraison</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>+{order.deliveryFee.toFixed(2)} DT</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#9CA3AF' }}>Total</span>
                                  <span style={{ fontSize: 24, fontWeight: 900, color: '#F5A800' }}>
                                    {order.total.toFixed(2)} DT
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {order.notes && (
                            <div style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              background: T.notesBg, borderRadius: 12,
                              border: `1px solid ${T.notesBorder}`, padding: '11px 13px',
                            }}>
                              <IonIcon icon={chatbubbleOutline} style={{ fontSize: 14, color: '#F5A800', flexShrink: 0, marginTop: 1 }} />
                              <span style={{ fontSize: 12, color: T.notesText, lineHeight: 1.55 }}>
                                {order.notes}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <IonToast
          isOpen={toast.open}
          message={toast.message}
          duration={2000}
          color={toast.color}
          position="bottom"
          onDidDismiss={() => setToast(t => ({ ...t, open: false }))}
        />
      </IonContent>

      {/* ── Delivery fee custom modal (replaces IonAlert to fix value-capture bug) ── */}
      {deliveryFeeModal.open && (
        <div
          onClick={() => setDeliveryFeeModal({ open: false, orderId: '', orderNumber: '' })}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark ? '#1E293B' : '#fff',
              borderRadius: 20, padding: '24px 20px 20px',
              width: '100%', maxWidth: 340,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              border: `1px solid ${T.cardBorder}`,
            }}
          >
            <p style={{ fontSize: 17, fontWeight: 800, color: T.text1, margin: '0 0 4px', textAlign: 'center' }}>
              Frais de livraison
            </p>
            {deliveryFeeModal.orderNumber && (
              <p style={{ fontSize: 12, color: T.text2, margin: '0 0 16px', textAlign: 'center' }}>
                Commande #{deliveryFeeModal.orderNumber}
              </p>
            )}
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min={0}
              max={10}
              placeholder="0"
              value={deliveryFeeValue}
              onChange={e => setDeliveryFeeValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleDeliveryFeeContinue(); }}
              style={{
                width: '100%', height: 56, borderRadius: 13,
                border: `2px solid ${T.cardBorder}`,
                background: isDark ? '#0F172A' : '#F8FAFC',
                color: T.text1, fontSize: 26, fontWeight: 800, textAlign: 'center',
                outline: 'none', padding: '0 16px',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <p style={{ fontSize: 11, color: T.text3, margin: '7px 0 18px', textAlign: 'center' }}>
              Montant en DT (0 — 10)
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeliveryFeeModal({ open: false, orderId: '', orderNumber: '' })}
                style={{
                  flex: 1, height: 46, borderRadius: 12,
                  border: `1px solid ${T.cardBorder}`, background: T.surf2,
                  color: T.text2, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeliveryFeeContinue}
                style={{
                  flex: 2, height: 46, borderRadius: 12,
                  border: 'none', background: 'linear-gradient(135deg, #F5A800, #FF8C00)',
                  color: '#1C1200', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                }}
              >
                Continuer →
              </button>
            </div>
          </div>
        </div>
      )}
    </IonPage>
  );
}
