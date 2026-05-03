import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
  IonSelect, IonSelectOption,
  IonSearchbar, IonSpinner, IonToast, IonAlert, IonActionSheet,
} from '@ionic/react';
import { IonIcon } from '@ionic/react';
import {
  restaurantOutline, bicycleOutline,
  callOutline, locationOutline, mapOutline, chatbubbleOutline,
  chevronDownOutline, chevronUpOutline, logOutOutline,
  arrowForwardOutline, alertCircleOutline, timerOutline,
  addOutline, bagOutline, moonOutline, sunnyOutline,
} from 'ionicons/icons';
import { ordersService, authService } from '../common/api';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Order, ORDER_STATUSES, getStatusLabel, getProductName } from './types';
import { NEW_ORDER_EVENT } from '../../hooks/useNotifications';
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
    contentBg:        '#0D0D0D',
    cardBg:           '#1A1A1A',
    cardBorder:       'rgba(255,255,255,0.05)',
    cardShadow:       '0 4px 20px rgba(0,0,0,0.35)',
    surf2:            '#222222',
    surf3:            '#262626',
    text1:            '#F9FAFB',
    text2:            '#6B7280',
    text3:            '#374151',
    ageBg:            '#222222',
    ageText:          '#6B7280',
    divider:          'rgba(255,255,255,0.05)',
    selectColor:      '#374151',
    addrBg:           'rgba(59,130,246,0.08)',
    addrBorder:       'rgba(59,130,246,0.15)',
    addrText:         '#93C5FD',
    itemRowBg:        '#222222',
    itemText:         '#F9FAFB',
    suppText:         '#6B7280',
    totalBg:          '#111111',
    totalBorder:      'rgba(255,255,255,0.04)',
    notesBg:          'rgba(245,168,0,0.07)',
    notesBorder:      'rgba(245,168,0,0.15)',
    notesText:        '#D97706',
    emptyCardBg:      'linear-gradient(135deg, #1A1A1A, #222222)',
    emptyCardBorder:  'rgba(255,255,255,0.05)',
    emptyIcon:        '#374151',
    emptyTitle:       '#F9FAFB',
    emptySubtitle:    '#4B5563',
    skeletonBg:       '#1A1A1A',
    skeletonStripe:   '#2A2A2A',
    skeletonBlock:    '#262626',
    skeletonAlt:      '#222222',
    countText:        '#374151',
    headerBg:         'linear-gradient(180deg, #141414 0%, #111111 100%)',
    headerBorder:     'rgba(255,255,255,0.05)',
    titleColor:       '#F9FAFB',
    onlineColor:      '#4B5563',
    pillBg:           'rgba(255,255,255,0.04)',
    pillBorder:       'rgba(255,255,255,0.06)',
    pillText:         '#6B7280',
    searchBg:         '#1E1E1E',
    searchColor:      '#F9FAFB',
    searchPlaceholder:'#374151',
    searchIcon:       '#374151',
    chipBg:           'rgba(255,255,255,0.04)',
    chipBorder:       'rgba(255,255,255,0.07)',
    chipColor:        '#6B7280',
    chipCountBg:      'rgba(255,255,255,0.08)',
    chipCountColor:   '#6B7280',
    logoutBg:         'rgba(255,255,255,0.05)',
    logoutBorder:     'rgba(255,255,255,0.07)',
  } : {
    contentBg:        '#F0EBE3',
    cardBg:           '#FFFBF6',
    cardBorder:       'rgba(0,0,0,0.07)',
    cardShadow:       '0 2px 14px rgba(0,0,0,0.09)',
    surf2:            '#F5F0EA',
    surf3:            '#EDE9E3',
    text1:            '#1C1917',
    text2:            '#78716C',
    text3:            '#A8A29E',
    ageBg:            '#EDE9E3',
    ageText:          '#A8A29E',
    divider:          'rgba(0,0,0,0.06)',
    selectColor:      '#A8A29E',
    addrBg:           '#EFF6FF',
    addrBorder:       'rgba(59,130,246,0.25)',
    addrText:         '#1E40AF',
    itemRowBg:        '#F5F0EA',
    itemText:         '#1C1917',
    suppText:         '#78716C',
    totalBg:          '#1C1917',
    totalBorder:      'rgba(0,0,0,0.12)',
    notesBg:          '#FFFBEB',
    notesBorder:      'rgba(245,168,0,0.3)',
    notesText:        '#92400E',
    emptyCardBg:      'linear-gradient(135deg, #F5F0EA, #E8E2DA)',
    emptyCardBorder:  'rgba(0,0,0,0.05)',
    emptyIcon:        '#C4BAB0',
    emptyTitle:       '#1C1917',
    emptySubtitle:    '#78716C',
    skeletonBg:       '#FFFBF6',
    skeletonStripe:   '#EDE9E3',
    skeletonBlock:    '#E7E5E4',
    skeletonAlt:      '#EDE9E3',
    countText:        '#A8A29E',
    headerBg:         'linear-gradient(180deg, #FFFBF6 0%, #F5EDE0 100%)',
    headerBorder:     'rgba(0,0,0,0.09)',
    titleColor:       '#1C1917',
    onlineColor:      '#78716C',
    pillBg:           'rgba(0,0,0,0.04)',
    pillBorder:       'rgba(0,0,0,0.09)',
    pillText:         '#A8A29E',
    searchBg:         '#EDE9E3',
    searchColor:      '#1C1917',
    searchPlaceholder:'#A8A29E',
    searchIcon:       '#A8A29E',
    chipBg:           'rgba(0,0,0,0.04)',
    chipBorder:       'rgba(0,0,0,0.08)',
    chipColor:        '#78716C',
    chipCountBg:      'rgba(0,0,0,0.06)',
    chipCountColor:   '#78716C',
    logoutBg:         'rgba(0,0,0,0.04)',
    logoutBorder:     'rgba(0,0,0,0.08)',
  };
}

// ─── Order age helper ─────────────────────────────────────────────────────────
function getOrderAge(createdAt: string, now: number): string {
  const diffMs   = now - new Date(createdAt).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)  return "à l'instant";
  if (diffMins < 60) return `${diffMins}m`;
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return `${h}h${m ? `${m}m` : ''}`;
}

// ─── Countdown ring ───────────────────────────────────────────────────────────
function CountdownRing({ endMs, totalMs, now }: { endMs: number; totalMs: number; now: number }) {
  const remaining = endMs - now;
  const isLate    = remaining <= 0;
  const pct       = isLate ? 0 : Math.min(1, remaining / totalMs);
  const mins      = Math.ceil(remaining / 60_000);
  const r = 20, c = 2 * Math.PI * r;
  const color = isLate ? '#EF4444' : pct > 0.5 ? '#10B981' : pct > 0.25 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, userSelect: 'none' }}>
      <div style={{ position: 'relative', width: 50, height: 50 }}>
        <svg width={50} height={50} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={25} cy={25} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
          <circle cx={25} cy={25} r={r} fill="none" stroke={color} strokeWidth={4}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 900, color }}>
            {isLate ? '!' : `${mins}m`}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {isLate ? 'Retard' : 'restant'}
      </span>
    </div>
  );
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const history  = useHistory();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
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
  const [prepSheet,     setPrepSheet]    = useState<{ open: boolean; orderId: string; orderNumber: string }>
                                           ({ open: false, orderId: '', orderNumber: '' });
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

  const handleConfirmWithTime = async (orderId: string, minutes: number) => {
    const endMs   = now + minutes * 60_000;
    const totalMs = minutes * 60_000;
    const updated = { ...prepTimers, [orderId]: { endMs, totalMs } };
    setPrepTimers(updated);
    saveTimers(updated);
    await handleStatusChange(orderId, 'confirmed');
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
          { text: '15 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(prepSheet.orderId, 15) },
          { text: '30 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(prepSheet.orderId, 30) },
          { text: '45 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(prepSheet.orderId, 45) },
          { text: '1 heure',    icon: timerOutline, handler: () => handleConfirmWithTime(prepSheet.orderId, 60) },
          { text: 'Annuler', role: 'cancel' },
        ]}
        onDidDismiss={() => setPrepSheet({ open: false, orderId: '', orderNumber: '' })}
      />

      {/* ════════════════════ HEADER ════════════════════ */}
      <div
        style={{
          background: T.headerBg,
          borderBottom: `1px solid ${T.headerBorder}`,
          zIndex: 100,
          transition: 'background 0.25s',
        }}
        onClick={unlockAudio}
      >
        {/* ── Brand row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
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
      </div>

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
                const timer      = prepTimers[order._id];
                const isLate     = timer ? timer.endMs < now : false;
                const isUpdating = updatingId === order._id;
                const isExpanded = expandedId === order._id;
                const hasDetails = !!(order.customer.address || (order.items && order.items.length > 0) || order.notes);
                const nextAction = QUICK_NEXT[order.status];

                return (
                  <div
                    key={order._id}
                    style={{
                      borderRadius: 20,
                      overflow: 'hidden',
                      background: T.cardBg,
                      border: `1px solid ${T.cardBorder}`,
                      boxShadow: isUpdating || (!isLate && order.status !== 'pending')
                        ? T.cardShadow
                        : undefined,
                      animation: !isUpdating
                        ? isLate
                          ? 'latePulse 1.5s ease-in-out infinite'
                          : order.status === 'pending'
                            ? 'pendingPulse 2.5s ease-in-out infinite'
                            : undefined
                        : undefined,
                      opacity: isUpdating ? 0.55 : 1,
                      transition: 'opacity 0.15s, background 0.25s, border-color 0.25s',
                    }}
                  >
                    {/* Color stripe / timer bar */}
                    {timer ? (
                      <div style={{ height: 5, background: isDark ? 'rgba(255,255,255,0.04)' : '#E7E5E4', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${Math.max(0, Math.min(100, ((timer.endMs - now) / timer.totalMs) * 100))}%`,
                          background: isLate ? '#EF4444' : now > timer.endMs - timer.totalMs * 0.25 ? '#F59E0B' : '#10B981',
                          transition: 'width 1s linear',
                          boxShadow: isLate ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 6px rgba(16,185,129,0.4)',
                        }} />
                      </div>
                    ) : (
                      <div style={{ height: 4, background: ss.gradient }} />
                    )}

                    {/* Card body */}
                    <div style={{ padding: '15px 16px 14px' }}>

                      {/* Row 1 — Meta */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: '#F5A800', letterSpacing: 0.3 }}>
                            #{order.orderNumber}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: T.ageText,
                            background: T.ageBg, borderRadius: 999, padding: '2px 8px',
                          }}>
                            {getOrderAge(order.createdAt, now)}
                          </span>
                          {order.status === 'pending' && (
                            <span style={{
                              fontSize: 9, fontWeight: 800, letterSpacing: 1,
                              color: '#92400E', background: '#FDE68A',
                              borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase',
                            }}>
                              Nouveau
                            </span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                          background: order.type === 'delivery' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                          border: `1px solid ${order.type === 'delivery' ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)'}`,
                          color: order.type === 'delivery' ? '#34D399' : '#A78BFA',
                          borderRadius: 999, padding: '5px 11px',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          <IonIcon icon={order.type === 'delivery' ? bicycleOutline : bagOutline} style={{ fontSize: 13 }} />
                          {order.type === 'delivery' ? 'Livraison' : 'À emporter'}
                        </div>
                      </div>

                      {/* Row 2 — Customer + Price */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 11 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 22, fontWeight: 900, color: T.text1,
                            letterSpacing: -0.5, lineHeight: 1.15, margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {order.customer.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                            <IonIcon icon={callOutline} style={{ fontSize: 11, color: T.text3 }} />
                            <span style={{ fontSize: 12, color: T.text2, fontWeight: 500 }}>
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
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    background: T.addrBg,
                                    border: `1px solid ${T.addrBorder}`,
                                    color: isDark ? '#60A5FA' : '#2563EB',
                                    borderRadius: 999, padding: '3px 10px',
                                    fontSize: 11, fontWeight: 700,
                                    textDecoration: 'none',
                                    flexShrink: 0,
                                  }}
                                >
                                  <IonIcon icon={mapOutline} style={{ fontSize: 12 }} />
                                  Carte
                                </a>
                              );
                            })()}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {timer ? (
                            <CountdownRing endMs={timer.endMs} totalMs={timer.totalMs} now={now} />
                          ) : (
                            <>
                              <div style={{
                                fontSize: 32, fontWeight: 900, color: T.text1,
                                letterSpacing: -1.5, lineHeight: 1,
                              }}>
                                {order.total.toFixed(2)}
                              </div>
                              <div style={{
                                fontSize: 11, fontWeight: 800, color: '#F5A800',
                                letterSpacing: 2.5, marginTop: 2,
                              }}>
                                DT
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Row 3 — Items + Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {order.items && order.items.length > 0 && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            background: T.surf2, borderRadius: 999, padding: '5px 12px',
                          }}>
                            <span style={{ fontSize: 14, fontWeight: 900, color: '#F5A800' }}>
                              {order.items.length}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: T.text2 }}>
                              article{order.items.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}

                        {timer && (
                          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: T.text1, letterSpacing: -1, lineHeight: 1 }}>
                              {order.total.toFixed(2)}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#F5A800', letterSpacing: 2.5 }}>DT</div>
                          </div>
                        )}

                        {!timer && (
                          <div style={{
                            marginLeft: 'auto',
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 11px', borderRadius: 999,
                            background: `${ss.dot}14`, border: `1px solid ${ss.dot}30`,
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: ss.dot }}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Primary CTA */}
                    {!isUpdating && (order.status === 'pending' || nextAction) && (
                      <div style={{ padding: '0 12px 12px' }}>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => setPrepSheet({ open: true, orderId: order._id, orderNumber: order.orderNumber })}
                            style={{
                              width: '100%', height: 54, borderRadius: 15, border: 'none', cursor: 'pointer',
                              background: 'linear-gradient(135deg, #F5A800 0%, #FF8C00 100%)',
                              color: '#1C1200', fontWeight: 800, fontSize: 15,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                              boxShadow: '0 4px 22px rgba(245,168,0,0.45)',
                            }}
                          >
                            <IonIcon icon={timerOutline} style={{ fontSize: 20 }} />
                            Confirmer + Temps de prépa
                          </button>
                        )}
                        {nextAction && (
                          <button
                            onClick={() => handleStatusChange(order._id, nextAction.status)}
                            style={{
                              width: '100%', height: 54, borderRadius: 15, border: 'none', cursor: 'pointer',
                              background: nextAction.gradient,
                              color: '#FFFFFF', fontWeight: 800, fontSize: 15,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                              boxShadow: `0 4px 22px ${nextAction.shadow}`,
                            }}
                          >
                            <IonIcon icon={arrowForwardOutline} style={{ fontSize: 20 }} />
                            {nextAction.label}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Updating */}
                    {isUpdating && (
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <IonSpinner name="dots" style={{ color: '#F5A800', width: 24, height: 24 }} />
                        <span style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>Mise à jour…</span>
                      </div>
                    )}

                    {/* Bottom bar */}
                    <div style={{
                      borderTop: `1px solid ${T.divider}`,
                      display: 'flex', alignItems: 'center',
                      padding: '0 4px 0 14px', minHeight: 46,
                    }}>
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
                            fontSize: 12, fontWeight: 600, flex: 1,
                          }}
                        >
                          {ORDER_STATUSES.map(os => (
                            <IonSelectOption key={os.value} value={os.value}>{os.label}</IonSelectOption>
                          ))}
                        </IonSelect>
                      )}
                      {hasDetails && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : order._id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '12px 14px 12px 10px', flexShrink: 0,
                            color: isExpanded ? '#F5A800' : T.text3,
                            fontSize: 12, fontWeight: 600,
                          }}
                        >
                          <span>{isExpanded ? 'Masquer' : 'Détails'}</span>
                          <IonIcon icon={isExpanded ? chevronUpOutline : chevronDownOutline} style={{ fontSize: 13 }} />
                        </button>
                      )}
                    </div>

                    {/* Expandable details */}
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
                                      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                                      background: 'linear-gradient(135deg, #F5A800, #FF8C00)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 900, fontSize: 14, color: '#1C1200',
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                                  <span style={{ fontSize: 12, color: '#6B7280' }}>
                                    {order.deliveryCompany.name} ({order.deliveryCompany.commission}%)
                                  </span>
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
    </IonPage>
  );
}
