import { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent, IonPage, IonHeader, IonToolbar,
  IonButtons, IonButton, IonIcon, IonRefresher, IonRefresherContent,
  IonCard, IonCardContent,
  IonChip, IonBadge, IonSelect, IonSelectOption,
  IonSpinner, IonToast, IonSearchbar, IonText, IonAlert,
  IonList, IonItem, IonLabel,
} from '@ionic/react';
import {
  exitOutline, timeOutline, checkmarkCircleOutline,
  restaurantOutline, bicycleOutline, checkmarkDoneOutline,
  closeCircleOutline, notificationsOutline, callOutline,
  carOutline, locationOutline, chevronDownOutline, chevronUpOutline,
  chatbubbleOutline, addCircleOutline,
} from 'ionicons/icons';
import { ordersService, authService } from '../common/api';
import { useAuth } from '../auth/AuthContext';
import { Order, ORDER_STATUSES, getStatusLabel, getProductName } from './types';
import { NEW_ORDER_EVENT } from '../../hooks/useNotifications';
import { startAlarm, stopAlarm, unlockAudio } from '../../hooks/useAlarm';

const STATUS_FILTERS = [
  { value: '', label: 'Toutes', icon: null },
  { value: 'pending', label: 'Attente', icon: timeOutline },
  { value: 'confirmed', label: 'Confirmée', icon: checkmarkCircleOutline },
  { value: 'preparing', label: 'Prép.', icon: restaurantOutline },
  { value: 'ready', label: 'Prête', icon: checkmarkDoneOutline },
  { value: 'delivered', label: 'Livrée', icon: bicycleOutline },
  { value: 'cancelled', label: 'Annulée', icon: closeCircleOutline },
];

const SC: Record<string, { bg: string; text: string; dot: string; bar: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', bar: '#F59E0B' },
  confirmed: { bg: '#DBEAFE', text: '#1E3A8A', dot: '#3B82F6', bar: '#3B82F6' },
  preparing: { bg: '#EDE9FE', text: '#4C1D95', dot: '#8B5CF6', bar: '#8B5CF6' },
  ready:     { bg: '#D1FAE5', text: '#064E3B', dot: '#10B981', bar: '#10B981' },
  delivered: { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF', bar: '#9CA3AF' },
  cancelled: { bg: '#FEE2E2', text: '#7F1D1D', dot: '#EF4444', bar: '#EF4444' },
};
const fallbackSC = { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF', bar: '#E5E7EB' };

export default function OrdersPage() {
  const history = useHistory();
  const { logout } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ open: boolean; message: string; color: string }>({
    open: false, message: '', color: 'success',
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<{ open: boolean; message: string }>({
    open: false, message: '',
  });

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

  const handleRefresh = async (e: CustomEvent) => { await fetchOrders(); e.detail.complete(); };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (orders.find(o => o._id === orderId)?.status === newStatus) return;
    setUpdatingId(orderId);
    try {
      await ordersService.updateStatus(orderId, newStatus);
      setToast({ open: true, message: '✅ Statut mis à jour', color: 'success' });
      await fetchOrders();
    } catch {
      setToast({ open: true, message: '❌ Erreur de mise à jour', color: 'danger' });
    } finally {
      setUpdatingId(null);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.orderNumber?.toLowerCase().includes(q)
      || o.customer.name?.toLowerCase().includes(q)
      || o.customer.phone?.includes(q);
  });

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <IonPage>
      <IonAlert
        isOpen={newOrderAlert.open}
        header="🌯 Nouvelle commande !"
        message={newOrderAlert.message}
        buttons={[{
          text: '✅ OK',
          handler: () => {
            stopAlarm();
            setNewOrderAlert({ open: false, message: '' });
            setActiveFilter('pending');
          },
        }]}
        onDidDismiss={() => { stopAlarm(); setNewOrderAlert({ open: false, message: '' }); }}
      />

      <IonHeader className="ion-no-border">
        <IonToolbar
          style={{ '--background': '#0F0F0F', '--border-color': 'transparent' }}
          onClick={unlockAudio}
        >
          <div slot="start" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
            <span style={{ color: '#F5A800', fontWeight: 900, fontSize: 22, letterSpacing: -1 }}>MR.</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Commandes</span>
            {pendingCount > 0 && (
              <IonBadge color="danger" style={{ borderRadius: 99, minWidth: 20, fontSize: 11 }}>
                {pendingCount}
              </IonBadge>
            )}
          </div>
          <IonButtons slot="end">
            <IonButton
              onClick={() => { stopAlarm(); logout(); history.push('/login'); }}
              style={{ '--color': '#6B7280' }}
            >
              <IonIcon slot="icon-only" icon={exitOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>

        <div style={{ background: '#0F0F0F', paddingBottom: 10, paddingTop: 2 }}>
          <div style={{ display: 'flex', gap: 8, paddingLeft: 14, paddingRight: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {STATUS_FILTERS.map((f) => {
              const active = activeFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                    background: active ? '#F5A800' : '#1C1C1C',
                    color: active ? '#000' : '#9CA3AF',
                    border: active ? 'none' : '1px solid #2D2D2D',
                    borderRadius: 99, padding: '5px 13px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {f.icon && <IonIcon icon={f.icon} style={{ fontSize: 12 }} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </IonHeader>

      <IonContent style={{ '--background': '#EFEFEF' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingText="Actualiser" />
        </IonRefresher>

        <div style={{ padding: '10px 12px 4px' }}>
          <IonSearchbar
            value={search}
            onIonInput={(e) => setSearch(e.detail.value || '')}
            placeholder="N° commande, client, téléphone..."
            style={{ '--background': 'white', '--border-radius': '14px', '--box-shadow': '0 1px 6px rgba(0,0,0,0.06)', '--color': '#111', padding: 0 }}
            animated={false}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 12 }}>
            <IonSpinner name="crescent" style={{ color: '#F5A800', width: 40, height: 40 }} />
            <IonText style={{ color: '#9CA3AF', fontSize: 14 }}>Chargement...</IonText>
          </div>
        ) : (
          <div style={{ padding: '0 12px 40px' }}>
            <div style={{ padding: '6px 4px 4px', color: '#9CA3AF', fontSize: 12, fontWeight: 500 }}>
              {filtered.length} commande{filtered.length !== 1 ? 's' : ''}
            </div>

            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 10 }}>
                <IonIcon icon={notificationsOutline} style={{ fontSize: 56, color: '#D1D5DB' }} />
                <IonText style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 15 }}>Aucune commande</IonText>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map((order) => {
                  const s = SC[order.status] ?? fallbackSC;
                  const isUpdating = updatingId === order._id;
                  const isExpanded = expandedId === order._id;
                  const hasDetails = !!(order.customer.address || (order.items && order.items.length > 0) || order.notes);

                  return (
                    <IonCard
                      key={order._id}
                      style={{
                        '--background': 'white', borderRadius: 20, margin: 0,
                        boxShadow: '0 2px 14px rgba(0,0,0,0.08)', overflow: 'hidden',
                        opacity: isUpdating ? 0.65 : 1, transition: 'opacity 0.2s',
                      }}
                    >
                      <div style={{ height: 5, background: s.bar }} />

                      <IonCardContent style={{ padding: '14px 16px 14px' }}>

                        {/* Row 1 — number + type + price */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ color: '#F5A800', fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>
                              #{order.orderNumber}
                            </span>
                            <IonChip
                              style={{
                                '--background': order.type === 'delivery' ? '#ECFDF5' : '#EFF6FF',
                                '--color': order.type === 'delivery' ? '#059669' : '#2563EB',
                                height: 24, fontSize: 11, fontWeight: 700,
                                margin: 0, padding: '0 9px',
                              }}
                            >
                              <IonIcon icon={order.type === 'delivery' ? bicycleOutline : carOutline} style={{ fontSize: 12, marginRight: 4 }} />
                              {order.type === 'delivery' ? 'Livraison' : 'À emporter'}
                            </IonChip>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#111827', fontWeight: 900, fontSize: 24, lineHeight: 1 }}>
                              {order.total.toFixed(2)}
                            </div>
                            <div style={{ color: '#9CA3AF', fontSize: 10, fontWeight: 600 }}>DT</div>
                          </div>
                        </div>

                        {/* Row 2 — customer */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ color: '#111827', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{order.customer.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <IonIcon icon={callOutline} style={{ color: '#9CA3AF', fontSize: 13 }} />
                            <span style={{ color: '#6B7280', fontSize: 13 }}>{order.customer.phone}</span>
                          </div>
                        </div>

                        <div style={{ height: 1, background: '#F3F4F6', marginBottom: 10 }} />

                        {/* Row 3 — status + selector */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: s.bg, borderRadius: 99, padding: '5px 12px', flexShrink: 0 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }} />
                            <span style={{ color: s.text, fontSize: 12, fontWeight: 700 }}>{getStatusLabel(order.status)}</span>
                          </div>

                          {isUpdating ? (
                            <IonSpinner name="dots" style={{ color: '#F5A800', width: 24, height: 24 }} />
                          ) : (
                            <IonSelect
                              value={order.status}
                              onIonChange={(e) => handleStatusChange(order._id, e.detail.value!)}
                              interface="action-sheet"
                              interfaceOptions={{ header: `#${order.orderNumber}` }}
                              fill="outline"
                              style={{
                                '--border-color': '#E5E7EB', '--border-radius': '10px',
                                '--highlight-color-focused': '#F5A800',
                                '--padding-start': '10px',
                                fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 120,
                              }}
                            >
                              {ORDER_STATUSES.map((os) => (
                                <IonSelectOption key={os.value} value={os.value}>{os.label}</IonSelectOption>
                              ))}
                            </IonSelect>
                          )}
                        </div>

                        {/* Row 4 — date + details toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                          <span style={{ color: '#C4C4C4', fontSize: 11 }}>{fmt(order.createdAt)}</span>
                          {hasDetails && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : order._id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: isExpanded ? '#FEF3C7' : '#F9FAFB',
                                border: 'none', borderRadius: 8,
                                color: isExpanded ? '#92400E' : '#6B7280',
                                fontSize: 12, fontWeight: 600,
                                padding: '4px 10px', cursor: 'pointer',
                              }}
                            >
                              <IonIcon icon={isExpanded ? chevronUpOutline : chevronDownOutline} style={{ fontSize: 13 }} />
                              {isExpanded ? 'Masquer' : 'Détails'}
                            </button>
                          )}
                        </div>

                        {/* ── Expandable details ── */}
                        {isExpanded && (
                          <div style={{ marginTop: 14, borderTop: '1px dashed #E5E7EB', paddingTop: 14 }}>

                            {/* Address */}
                            {order.type === 'delivery' && order.customer.address && (
                              <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                background: '#EFF6FF', borderRadius: 10, padding: '8px 12px', marginBottom: 12,
                              }}>
                                <IonIcon icon={locationOutline} style={{ color: '#3B82F6', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
                                <span style={{ color: '#1E40AF', fontSize: 13, lineHeight: 1.5 }}>{order.customer.address}</span>
                              </div>
                            )}

                            {/* Items */}
                            {order.items && order.items.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                                  <IonIcon icon={restaurantOutline} style={{ fontSize: 14, color: '#F5A800' }} />
                                  Articles
                                </div>

                                <IonList lines="none" style={{ '--background': 'transparent', padding: 0, margin: 0 }}>
                                  {order.items.map((item, idx) => {
                                    const name = getProductName(item.productName);
                                    const suppTotal = (item.supplements ?? []).reduce((acc, x) => acc + x.price, 0);
                                    const lineTotal = (item.unitPrice + suppTotal) * item.quantity;
                                    return (
                                      <IonItem
                                        key={idx}
                                        style={{
                                          '--background': idx % 2 === 0 ? '#FAFAFA' : 'white',
                                          '--border-radius': '10px',
                                          '--min-height': '44px',
                                          '--padding-start': '8px',
                                          marginBottom: 4, borderRadius: 10, overflow: 'hidden',
                                        }}
                                      >
                                        <div slot="start" style={{
                                          background: '#F5A800', color: '#000',
                                          borderRadius: 8, fontSize: 12, fontWeight: 800,
                                          padding: '2px 8px', textAlign: 'center', minWidth: 30,
                                        }}>
                                          ×{item.quantity}
                                        </div>
                                        <IonLabel>
                                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{name}</div>
                                          {item.supplements && item.supplements.length > 0 && (
                                            <div style={{ marginTop: 2 }}>
                                              {item.supplements.map((sup, si) => (
                                                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                  <IonIcon icon={addCircleOutline} style={{ fontSize: 10, color: '#10B981' }} />
                                                  <span style={{ fontSize: 11, color: '#6B7280' }}>
                                                    {sup.name?.fr ?? sup.name?.ar ?? '—'}
                                                    {sup.price > 0 ? ` +${sup.price.toFixed(2)} DT` : ''}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {item.notes && (
                                            <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</div>
                                          )}
                                        </IonLabel>
                                        <div slot="end" style={{ textAlign: 'right' }}>
                                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{lineTotal.toFixed(2)}</div>
                                          <div style={{ fontSize: 10, color: '#9CA3AF' }}>DT</div>
                                        </div>
                                      </IonItem>
                                    );
                                  })}
                                </IonList>

                                {/* Total footer */}
                                <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '10px 14px', marginTop: 8 }}>
                                  {order.subtotal !== undefined && order.subtotal !== order.total && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>Sous-total</span>
                                      <span style={{ color: '#6B7280', fontSize: 12 }}>{order.subtotal.toFixed(2)} DT</span>
                                    </div>
                                  )}
                                  {order.type === 'delivery' && order.deliveryCompany?.name && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>{order.deliveryCompany.name} ({order.deliveryCompany.commission}%)</span>
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#111827', fontSize: 14, fontWeight: 700 }}>Total</span>
                                    <span style={{ color: '#F5A800', fontSize: 14, fontWeight: 800 }}>{order.total.toFixed(2)} DT</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {order.notes && (
                              <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                background: '#FFFBEB', border: '1px solid #FDE68A',
                                borderRadius: 10, padding: '8px 12px',
                              }}>
                                <IonIcon icon={chatbubbleOutline} style={{ color: '#F59E0B', fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                                <span style={{ color: '#92400E', fontSize: 12, lineHeight: 1.5 }}>{order.notes}</span>
                              </div>
                            )}
                          </div>
                        )}

                      </IonCardContent>
                    </IonCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <IonToast
          isOpen={toast.open}
          message={toast.message}
          duration={2500}
          color={toast.color}
          position="top"
          onDidDismiss={() => setToast(t => ({ ...t, open: false }))}
        />
      </IonContent>
    </IonPage>
  );
}
