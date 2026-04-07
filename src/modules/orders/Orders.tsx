import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
  IonCard, IonCardContent,
  IonChip, IonBadge, IonButton, IonIcon,
  IonSelect, IonSelectOption,
  IonSearchbar, IonSpinner, IonToast, IonAlert, IonActionSheet,
} from '@ionic/react';
import {
  timeOutline, checkmarkCircleOutline, restaurantOutline,
  bicycleOutline, checkmarkDoneOutline, closeCircleOutline,
  callOutline, locationOutline, chatbubbleOutline,
  chevronDownOutline, chevronUpOutline, logOutOutline,
  arrowForwardOutline, alertCircleOutline, timerOutline,
  addOutline, bagOutline, bicycleOutline as deliveryIcon,
} from 'ionicons/icons';
import { ordersService, authService } from '../common/api';
import { useAuth } from '../auth/AuthContext';
import { Order, ORDER_STATUSES, getStatusLabel, getProductName } from './types';
import { NEW_ORDER_EVENT } from '../../hooks/useNotifications';
import { startAlarm, stopAlarm, unlockAudio } from '../../hooks/useAlarm';

// ─── Status colors ────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { chip: string; dot: string; bar: string; border: string }> = {
  pending:   { chip: 'bg-amber-100 text-amber-800',    dot: '#F59E0B', bar: '#F59E0B', border: '#FDE68A' },
  confirmed: { chip: 'bg-blue-100 text-blue-800',      dot: '#3B82F6', bar: '#3B82F6', border: '#BFDBFE' },
  preparing: { chip: 'bg-purple-100 text-purple-800',  dot: '#8B5CF6', bar: '#8B5CF6', border: '#DDD6FE' },
  ready:     { chip: 'bg-green-100 text-green-800',    dot: '#10B981', bar: '#10B981', border: '#A7F3D0' },
  delivered: { chip: 'bg-stone-100 text-stone-600',    dot: '#9CA3AF', bar: '#D1D5DB', border: '#E7E5E4' },
  cancelled: { chip: 'bg-red-100 text-red-800',        dot: '#EF4444', bar: '#EF4444', border: '#FECACA' },
};
const STATUS_FALLBACK = STATUS_STYLE.delivered;

// ─── Quick actions (next logical step per status) ─────────────────────────────
const QUICK_NEXT: Record<string, { status: string; label: string; color: string }> = {
  confirmed: { status: 'preparing', label: 'Démarrer préparation', color: 'secondary' },
  preparing: { status: 'ready',     label: 'Commande prête !',     color: 'success'   },
  ready:     { status: 'delivered', label: 'Marquer comme livré',  color: 'dark'      },
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

// ─── Countdown ring SVG ───────────────────────────────────────────────────────
function CountdownRing({ endMs, totalMs, now }: { endMs: number; totalMs: number; now: number }) {
  const remaining = endMs - now;
  const isLate    = remaining <= 0;
  const pct       = isLate ? 0 : Math.min(1, remaining / totalMs);
  const mins      = Math.ceil(remaining / 60_000);
  const r = 18, c = 2 * Math.PI * r;
  const color = isLate ? '#EF4444' : pct > 0.5 ? '#10B981' : pct > 0.25 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div className="relative" style={{ width: 44, height: 44 }}>
        <svg width={44} height={44} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={22} cy={22} r={r} fill="none" stroke="#E7E5E4" strokeWidth={3.5} />
          <circle cx={22} cy={22} r={r} fill="none" stroke={color} strokeWidth={3.5}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-black" style={{ fontSize: 11, color }}>
            {isLate ? '!' : `${mins}m`}
          </span>
        </div>
      </div>
      <span className="font-bold" style={{ fontSize: 10, color }}>
        {isLate ? 'EN RETARD' : 'restant'}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const history  = useHistory();
  const { logout } = useAuth();

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

  // Live clock — 1-second tick for countdown rings
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────
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

  // ── Push notification listener ─────────────────────────────────────────────
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

  // ── Clean up timers for delivered / cancelled orders ───────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  // Called after user picks a prep time from the action sheet
  const handleConfirmWithTime = async (orderId: string, minutes: number) => {
    const endMs    = now + minutes * 60_000;
    const totalMs  = minutes * 60_000;
    const updated  = { ...prepTimers, [orderId]: { endMs, totalMs } };
    setPrepTimers(updated);
    saveTimers(updated);
    await handleStatusChange(orderId, 'confirmed');
  };

  // ── Derived values ─────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <IonPage>
      {/* New order alert */}
      <IonAlert
        isOpen={newOrderAlert.open}
        header="🌯 Nouvelle commande !"
        message={newOrderAlert.message}
        buttons={[{ text: 'OK', handler: () => { stopAlarm(); setNewOrderAlert({ open: false, message: '' }); setActiveFilter('pending'); } }]}
        onDidDismiss={() => { stopAlarm(); setNewOrderAlert({ open: false, message: '' }); }}
      />

      {/* Preparation time picker */}
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

      {/* ════════════════════ TOP APP BAR ════════════════════ */}
      <div className="bg-stone-900" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.4)', zIndex: 100 }} onClick={unlockAudio}>

        {/* Brand row */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          {/* Logo */}
          <div className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#F5A800,#D97706)', boxShadow: '0 2px 8px rgba(245,168,0,0.3)' }}>
            <span className="text-white font-black text-sm tracking-tight">MR</span>
          </div>

          {/* Title + counters */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-lg leading-tight">Commandes</span>
              {pendingCount > 0 && (
                <IonBadge color="danger" className="text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </IonBadge>
              )}
              {lateCount > 0 && (
                <div className="flex items-center gap-1 bg-red-950 rounded-full px-2 py-0.5">
                  <IonIcon icon={alertCircleOutline} style={{ fontSize: 11, color: '#FCA5A5' }} />
                  <span className="text-red-300 font-bold" style={{ fontSize: 10 }}>{lateCount} en retard</span>
                </div>
              )}
            </div>
            <span className="text-stone-500 text-xs">Mr. Burritos Manager</span>
          </div>

          {/* Logout */}
          <IonButton fill="clear" onClick={e => { e.stopPropagation(); stopAlarm(); logout(); history.push('/login'); }}
            style={{ '--color': '#78716C', '--padding-start': '8px', '--padding-end': '8px' }}>
            <IonIcon slot="icon-only" icon={logOutOutline} />
          </IonButton>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <IonSearchbar
            value={search}
            onIonInput={e => setSearch(e.detail.value ?? '')}
            placeholder="N° commande, client, téléphone…"
            animated={false}
            style={{
              '--background': '#292524', '--color': '#F5F5F4', '--placeholder-color': '#78716C',
              '--icon-color': '#78716C', '--clear-button-color': '#78716C',
              '--border-radius': '12px', '--box-shadow': 'none', padding: 0,
            }}
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 px-3 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const isActive = activeFilter === tab.value;
            const cnt = tab.value ? orders.filter(o => o.status === tab.value).length : orders.length;
            const hasLate = tab.value
              ? orders.filter(o => o.status === tab.value).some(o => prepTimers[o._id] && prepTimers[o._id].endMs < now)
              : lateCount > 0;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className="flex items-center gap-1.5 flex-shrink-0 font-semibold rounded-lg relative"
                style={{
                  height: 32, padding: '0 12px', fontSize: 12, cursor: 'pointer',
                  border: isActive ? 'none' : '1.5px solid #3C3732',
                  background: isActive ? '#F5A800' : 'transparent',
                  color: isActive ? '#1C1200' : '#A8A29E',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {tab.label}
                {cnt > 0 && (
                  <span className="rounded-full font-bold px-1.5 leading-relaxed"
                    style={{ fontSize: 10, background: isActive ? 'rgba(0,0,0,0.15)' : '#3C3732', color: isActive ? '#1C1200' : '#D6D3D1' }}>
                    {cnt}
                  </span>
                )}
                {hasLate && !isActive && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════ CONTENT ════════════════════ */}
      <IonContent style={{ '--background': '#F0EBE3' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingText="Actualiser…" />
        </IonRefresher>

        {loading ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-4">
            <IonSpinner name="crescent" style={{ color: '#F5A800', width: 44, height: 44 }} />
            <span className="text-stone-400 text-sm">Chargement des commandes…</span>
          </div>
        ) : (
          <div className="px-3 pt-3 pb-16">

            {/* Count */}
            <p className="text-xs text-stone-400 font-medium mb-3 pl-1">
              {filtered.length} commande{filtered.length !== 1 ? 's' : ''}
              {search && <span className="text-amber-500"> · « {search} »</span>}
            </p>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center pt-16 gap-3">
                <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center">
                  <IonIcon icon={restaurantOutline} style={{ fontSize: 32, color: '#A8A29E' }} />
                </div>
                <p className="text-stone-600 font-semibold text-base">Aucune commande</p>
                <p className="text-stone-400 text-sm">Aucun résultat pour ce filtre</p>
              </div>
            )}

            {/* Cards */}
            <div className="flex flex-col gap-3">
              {filtered.map(order => {
                const ss         = STATUS_STYLE[order.status] ?? STATUS_FALLBACK;
                const timer      = prepTimers[order._id];
                const isLate     = timer ? timer.endMs < now : false;
                const isUpdating = updatingId === order._id;
                const isExpanded = expandedId  === order._id;
                const hasDetails = !!(order.customer.address || (order.items && order.items.length > 0) || order.notes);
                const nextAction = QUICK_NEXT[order.status];

                return (
                  <IonCard
                    key={order._id}
                    className="m-0 overflow-hidden"
                    style={{
                      '--background': '#FFFBF6',
                      borderRadius: 18,
                      boxShadow: isLate
                        ? '0 0 0 2px #EF4444, 0 4px 16px rgba(239,68,68,0.15)'
                        : '0 1px 4px rgba(0,0,0,0.08), 0 4px 14px rgba(0,0,0,0.06)',
                      opacity: isUpdating ? 0.6 : 1,
                      transition: 'opacity 0.2s, box-shadow 0.3s',
                    }}
                  >
                    {/* Top accent + optional prep-timer progress bar */}
                    {timer ? (
                      <div className="h-1.5 bg-stone-100 relative overflow-hidden">
                        <div
                          className="h-full absolute left-0 top-0 transition-all duration-1000"
                          style={{
                            width: `${Math.max(0, Math.min(100, ((timer.endMs - now) / timer.totalMs) * 100))}%`,
                            background: isLate ? '#EF4444' : now > timer.endMs - timer.totalMs * 0.25 ? '#F59E0B' : '#10B981',
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-1" style={{ background: ss.bar }} />
                    )}

                    <IonCardContent className="p-0">
                      <div className="flex">
                        {/* Left accent bar */}
                        <div className="w-1 flex-shrink-0" style={{ background: ss.bar }} />

                        <div className="flex-1 p-4 space-y-3">

                          {/* ── Row 1: # · type · price · timer ── */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-bold text-xs tracking-wider" style={{ color: '#F5A800' }}>
                                #{order.orderNumber}
                              </span>
                              <IonChip
                                className="m-0"
                                style={{
                                  '--background': order.type === 'delivery' ? '#ECFDF5' : '#EEF2FF',
                                  '--color':      order.type === 'delivery' ? '#065F46' : '#3730A3',
                                  height: 24, fontSize: 11, fontWeight: 700, padding: '0 9px',
                                }}
                              >
                                <IonIcon
                                  icon={order.type === 'delivery' ? bicycleOutline : bagOutline}
                                  style={{ fontSize: 12, marginRight: 4 }}
                                />
                                {order.type === 'delivery' ? 'Livraison' : 'À emporter'}
                              </IonChip>
                            </div>

                            {/* Price + countdown ring */}
                            <div className="flex items-center gap-3">
                              {timer && (
                                <CountdownRing endMs={timer.endMs} totalMs={timer.totalMs} now={now} />
                              )}
                              <div className="text-right">
                                <div className="font-black text-stone-900 leading-none" style={{ fontSize: 26, letterSpacing: -1 }}>
                                  {order.total.toFixed(2)}
                                </div>
                                <div className="font-bold text-xs tracking-widest" style={{ color: '#F5A800' }}>DT</div>
                              </div>
                            </div>
                          </div>

                          {/* ── Row 2: customer ── */}
                          <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#F5F0EA' }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-stone-900 text-base truncate leading-tight">{order.customer.name}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <IonIcon icon={callOutline} style={{ fontSize: 12, color: '#A8A29E' }} />
                                <span className="text-stone-500 text-xs">{order.customer.phone}</span>
                              </div>
                            </div>
                            {order.items && order.items.length > 0 && (
                              <div className="flex-shrink-0 rounded-lg px-3 py-1.5 text-center" style={{ background: '#1C1917' }}>
                                <div className="font-black leading-none" style={{ fontSize: 18, color: '#F5A800' }}>{order.items.length}</div>
                                <div className="font-semibold leading-none mt-0.5" style={{ fontSize: 9, color: '#78716C', letterSpacing: 0.5 }}>
                                  article{order.items.length > 1 ? 's' : ''}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ── Row 3: status badge + IonSelect ── */}
                          <div className="flex items-center gap-2">
                            <IonChip
                              className={`m-0 font-bold ${ss.chip}`}
                              style={{ height: 30, fontSize: 12, padding: '0 10px', '--background': 'transparent' }}
                            >
                              <span className="w-2 h-2 rounded-full mr-1.5 flex-shrink-0" style={{ background: ss.dot }} />
                              {getStatusLabel(order.status)}
                            </IonChip>
                            <div className="flex-1 flex justify-end">
                              {isUpdating ? (
                                <IonSpinner name="dots" style={{ color: '#F5A800', width: 26, height: 26 }} />
                              ) : (
                                <IonSelect
                                  value={order.status}
                                  onIonChange={e => handleStatusChange(order._id, e.detail.value!)}
                                  interface="action-sheet"
                                  interfaceOptions={{ header: `#${order.orderNumber}` }}
                                  fill="outline"
                                  style={{
                                    '--border-color': '#D6D0C8', '--border-radius': '8px',
                                    '--padding-start': '10px', '--highlight-color-focused': '#F5A800',
                                    '--color': '#78716C', fontSize: 12, fontWeight: 600, minWidth: 135,
                                  }}
                                >
                                  {ORDER_STATUSES.map(os => (
                                    <IonSelectOption key={os.value} value={os.value}>{os.label}</IonSelectOption>
                                  ))}
                                </IonSelect>
                              )}
                            </div>
                          </div>

                          {/* ── Row 4: QUICK ACTION button ── */}
                          {!isUpdating && (
                            <>
                              {/* Pending → open prep-time picker */}
                              {order.status === 'pending' && (
                                <IonButton
                                  expand="block"
                                  color="warning"
                                  className="font-bold rounded-xl"
                                  style={{ '--border-radius': '10px', height: 42, '--color': '#1C1200' }}
                                  onClick={() => setPrepSheet({ open: true, orderId: order._id, orderNumber: order.orderNumber })}
                                >
                                  <IonIcon slot="start" icon={timerOutline} />
                                  Confirmer + Temps de prépa
                                </IonButton>
                              )}

                              {/* Other statuses → direct advance */}
                              {nextAction && (
                                <IonButton
                                  expand="block"
                                  color={nextAction.color as any}
                                  className="font-bold rounded-xl"
                                  style={{ '--border-radius': '10px', height: 42 }}
                                  onClick={() => handleStatusChange(order._id, nextAction.status)}
                                >
                                  <IonIcon slot="start" icon={arrowForwardOutline} />
                                  {nextAction.label}
                                </IonButton>
                              )}
                            </>
                          )}

                          {/* ── Row 5: details toggle ── */}
                          {hasDetails && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : order._id)}
                              className="w-full flex items-center justify-between rounded-xl px-4 font-semibold text-xs"
                              style={{
                                height: 38,
                                background: isExpanded ? '#1C1917' : '#F0EBE3',
                                color: isExpanded ? '#F5A800' : '#78716C',
                                border: 'none', cursor: 'pointer',
                              }}
                            >
                              <span>
                                {isExpanded ? 'Masquer les détails' : `Détails${order.items?.length ? ` (${order.items.length} article${order.items.length > 1 ? 's' : ''})` : ''}`}
                              </span>
                              <IonIcon
                                icon={isExpanded ? chevronUpOutline : chevronDownOutline}
                                style={{ fontSize: 16 }}
                              />
                            </button>
                          )}

                          {/* ══════════ EXPANDABLE DETAILS ══════════ */}
                          {isExpanded && (
                            <div className="flex flex-col gap-2 pt-1">

                              {/* Address */}
                              {order.type === 'delivery' && order.customer.address && (
                                <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: '#EFF6FF', borderLeft: '3px solid #3B82F6' }}>
                                  <IonIcon icon={locationOutline} style={{ fontSize: 16, color: '#3B82F6', flexShrink: 0, marginTop: 1 }} />
                                  <span className="text-blue-700 text-sm leading-relaxed">{order.customer.address}</span>
                                </div>
                              )}

                              {/* Items list */}
                              {order.items && order.items.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider px-1 mb-2">Articles</p>
                                  <div className="flex flex-col gap-1.5">
                                    {order.items.map((item, idx) => {
                                      const name      = getProductName(item.productName);
                                      const suppTotal = (item.supplements ?? []).reduce((a, x) => a + x.price, 0);
                                      const lineTotal = (item.unitPrice + suppTotal) * item.quantity;
                                      return (
                                        <div key={idx} className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#F5F0EA' }}>
                                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm"
                                            style={{ background: '#1C1917', color: '#F5A800' }}>
                                            {item.quantity}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-stone-900 text-sm">{name}</p>
                                            {item.supplements && item.supplements.length > 0 && (
                                              <div className="mt-1 space-y-0.5">
                                                {item.supplements.map((sup, si) => (
                                                  <div key={si} className="flex items-center gap-1.5">
                                                    <IonIcon icon={addOutline} style={{ fontSize: 10, color: '#10B981' }} />
                                                    <span className="text-stone-500 text-xs">
                                                      {sup.name?.fr ?? sup.name?.ar ?? '—'}
                                                      {sup.price > 0 ? ` +${sup.price.toFixed(2)} DT` : ''}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {item.notes && (
                                              <p className="text-stone-400 text-xs italic mt-1">{item.notes}</p>
                                            )}
                                          </div>
                                          <div className="text-right flex-shrink-0">
                                            <p className="font-bold text-stone-900 text-sm">{lineTotal.toFixed(2)}</p>
                                            <p className="text-stone-400 text-xs">DT</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Total */}
                                  <div className="rounded-xl p-3 mt-2" style={{ background: '#1C1917' }}>
                                    {order.subtotal !== undefined && order.subtotal !== order.total && (
                                      <div className="flex justify-between mb-2">
                                        <span className="text-stone-500 text-xs">Sous-total</span>
                                        <span className="text-stone-400 text-xs">{order.subtotal.toFixed(2)} DT</span>
                                      </div>
                                    )}
                                    {order.deliveryCompany?.name && (
                                      <div className="flex justify-between mb-2">
                                        <span className="text-stone-500 text-xs">{order.deliveryCompany.name} ({order.deliveryCompany.commission}%)</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-baseline">
                                      <span className="text-stone-300 font-semibold text-sm">Total</span>
                                      <span className="font-black text-xl" style={{ color: '#F5A800' }}>{order.total.toFixed(2)} DT</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Notes */}
                              {order.notes && (
                                <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: '#FFFBEB', borderLeft: '3px solid #F59E0B' }}>
                                  <IonIcon icon={chatbubbleOutline} style={{ fontSize: 15, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />
                                  <span className="text-amber-800 text-xs leading-relaxed">{order.notes}</span>
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    </IonCardContent>
                  </IonCard>
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
