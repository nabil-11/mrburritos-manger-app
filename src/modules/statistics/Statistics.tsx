import { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSpinner, IonMenuButton, IonHeader, IonToolbar,
} from '@ionic/react';
import { IonIcon as IonIconComponent } from '@ionic/react';
import {
  barChartOutline, cashOutline, restaurantOutline,
  trendingUpOutline, calendarOutline, starOutline,
  logOutOutline, sunnyOutline, moonOutline,
  bicycleOutline, bagHandleOutline, alertCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import { authService, statisticsService } from '../common/api';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type Range = 'today' | '7d' | '30d' | 'all';

interface ReportData {
  totalRevenue: number;
  netTotalRevenue: number;
  orderCount: number;
  avgOrder: number;
  byType: {
    delivery: { count: number; revenue: number };
    pickup:   { count: number; revenue: number };
  };
  deliverySummary: { gross: number; commissionAmount: number; net: number };
  byDeliveryCompany: Array<{
    name: string; count: number; revenue: number;
    commission: number; net: number; commissionAmount: number;
  }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  byDay:  Array<{ date: string; revenue: number; count: number }>;
  byHour: Array<{ hour: number; revenue: number; count: number }>;
  byStatus: {
    pending: number; confirmed: number; preparing: number;
    ready: number; delivered: number;
  };
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
function makeTokens(isDark: boolean) {
  return isDark ? {
    contentBg:    '#0F172A',
    cardBg:       '#1E293B',
    cardBorder:   'rgba(255,255,255,0.08)',
    cardShadow:   '0 4px 24px rgba(0,0,0,0.4)',
    surf2:        '#334155',
    surf3:        '#475569',
    text1:        '#F1F5F9',
    text2:        '#94A3B8',
    text3:        '#64748B',
    divider:      'rgba(255,255,255,0.08)',
    headerBg:     'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
    headerBorder: 'rgba(255,255,255,0.08)',
    titleColor:   '#F1F5F9',
    logoutBg:     'rgba(255,255,255,0.07)',
    logoutBorder: 'rgba(255,255,255,0.09)',
    pillBg:       'rgba(255,255,255,0.06)',
    pillBorder:   'rgba(255,255,255,0.10)',
    errBg:        'rgba(239,68,68,0.12)',
    errBorder:    'rgba(239,68,68,0.25)',
  } : {
    contentBg:    '#FAF7F2',
    cardBg:       '#FFFFFF',
    cardBorder:   'rgba(0,0,0,0.08)',
    cardShadow:   '0 2px 16px rgba(0,0,0,0.08)',
    surf2:        '#F8FAFC',
    surf3:        '#E2E8F0',
    text1:        '#1E293B',
    text2:        '#64748B',
    text3:        '#94A3B8',
    divider:      'rgba(0,0,0,0.05)',
    headerBg:     'linear-gradient(180deg, #FFFFFF 0%, #FAF7F2 100%)',
    headerBorder: 'rgba(0,0,0,0.08)',
    titleColor:   '#1E293B',
    logoutBg:     'rgba(0,0,0,0.03)',
    logoutBorder: 'rgba(0,0,0,0.05)',
    pillBg:       'rgba(0,0,0,0.04)',
    pillBorder:   'rgba(0,0,0,0.08)',
    errBg:        'rgba(239,68,68,0.07)',
    errBorder:    'rgba(239,68,68,0.20)',
  };
}

// ─── Date range helpers ───────────────────────────────────────────────────────
function getDateRange(range: Range): { from?: string; to?: string } {
  const today = new Date();
  const toStr = today.toISOString().slice(0, 10);
  if (range === 'today') return { from: toStr, to: toStr };
  if (range === '7d') {
    const d = new Date(today); d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: toStr };
  }
  if (range === '30d') {
    const d = new Date(today); d.setDate(d.getDate() - 29);
    return { from: d.toISOString().slice(0, 10), to: toStr };
  }
  return {};
}

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: "Auj." },
  { key: '7d',   label: '7 jours' },
  { key: '30d',  label: '30 jours' },
  { key: 'all',  label: 'Tout' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, title, value, subtitle, color, T }: {
  icon: string; title: string; value: string; subtitle?: string; color: string;
  T: ReturnType<typeof makeTokens>;
}) {
  return (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: 16, padding: '16px 14px', boxShadow: T.cardShadow,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 2,
      }}>
        <IonIconComponent icon={icon} style={{ fontSize: 20, color }} />
      </div>
      <p style={{ fontSize: 11, color: T.text3, fontWeight: 700, margin: 0,
        textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </p>
      <p style={{ fontSize: 22, color: T.text1, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
        {value}
      </p>
      {subtitle && (
        <p style={{ fontSize: 11, color: T.text2, margin: 0 }}>{subtitle}</p>
      )}
    </div>
  );
}

function TypeBreakdown({ data, T }: { data: ReportData; T: ReturnType<typeof makeTokens> }) {
  const total = data.byType.delivery.count + data.byType.pickup.count;
  if (total === 0) return null;
  const delivPct = total > 0 ? (data.byType.delivery.count / total) * 100 : 0;
  const pickPct  = 100 - delivPct;

  return (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: 16, padding: '18px 16px', boxShadow: T.cardShadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <IonIconComponent icon={trendingUpOutline} style={{ fontSize: 19, color: '#3B82F6' }} />
        <h3 style={{ fontSize: 15, color: T.text1, fontWeight: 700, margin: 0 }}>
          Répartition des commandes
        </h3>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8, borderRadius: 8, background: T.surf3,
        display: 'flex', overflow: 'hidden', marginBottom: 14,
      }}>
        <div style={{
          width: `${delivPct}%`, background: 'linear-gradient(90deg,#3B82F6,#60A5FA)',
          transition: 'width 0.5s ease',
        }} />
        <div style={{
          width: `${pickPct}%`, background: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {/* Delivery */}
        <div style={{
          flex: 1, background: 'rgba(59,130,246,0.08)', borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <IonIconComponent icon={bicycleOutline} style={{ fontSize: 17, color: '#3B82F6' }} />
            <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>Livraison</span>
          </div>
          <p style={{ fontSize: 22, color: '#3B82F6', fontWeight: 900, margin: 0 }}>
            {data.byType.delivery.count}
          </p>
          <p style={{ fontSize: 11, color: T.text3, margin: '2px 0 0' }}>
            {delivPct.toFixed(0)}% · {data.byType.delivery.revenue.toFixed(0)} DT
          </p>
        </div>

        {/* Pickup */}
        <div style={{
          flex: 1, background: 'rgba(245,158,11,0.08)', borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <IonIconComponent icon={bagHandleOutline} style={{ fontSize: 17, color: '#F59E0B' }} />
            <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>À emporter</span>
          </div>
          <p style={{ fontSize: 22, color: '#F59E0B', fontWeight: 900, margin: 0 }}>
            {data.byType.pickup.count}
          </p>
          <p style={{ fontSize: 11, color: T.text3, margin: '2px 0 0' }}>
            {pickPct.toFixed(0)}% · {data.byType.pickup.revenue.toFixed(0)} DT
          </p>
        </div>
      </div>

      {/* Commission info (if delivery exists) */}
      {data.byType.delivery.count > 0 && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'rgba(239,68,68,0.06)', borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>
            Commissions livraison
          </span>
          <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 700 }}>
            -{data.deliverySummary.commissionAmount.toFixed(2)} DT
          </span>
        </div>
      )}
    </div>
  );
}

function TopProducts({ products, T }: {
  products: ReportData['topProducts']; T: ReturnType<typeof makeTokens>;
}) {
  if (!products.length) return null;
  const maxRevenue = Math.max(...products.map(p => p.revenue));
  return (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: 16, padding: '18px 16px', boxShadow: T.cardShadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <IonIconComponent icon={starOutline} style={{ fontSize: 19, color: '#F59E0B' }} />
        <h3 style={{ fontSize: 15, color: T.text1, fontWeight: 700, margin: 0 }}>
          Top produits
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {products.slice(0, 8).map((item, idx) => (
          <div key={idx}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#F5A800',
                  background: 'rgba(245,168,0,0.12)', borderRadius: 6,
                  width: 22, height: 22, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <p style={{
                  fontSize: 13, color: T.text1, fontWeight: 600,
                  margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.name}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                <p style={{ fontSize: 13, color: '#10B981', fontWeight: 700, margin: 0 }}>
                  {item.revenue.toFixed(0)} DT
                </p>
                <p style={{ fontSize: 10, color: T.text3, margin: 0 }}>
                  ×{item.qty}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: T.surf3, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${(item.revenue / maxRevenue) * 100}%`,
                background: idx === 0
                  ? 'linear-gradient(90deg,#F5A800,#FF6B00)'
                  : idx === 1
                    ? 'linear-gradient(90deg,#10B981,#34D399)'
                    : 'linear-gradient(90deg,#3B82F6,#60A5FA)',
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyTrend({ byDay, T }: {
  byDay: ReportData['byDay']; T: ReturnType<typeof makeTokens>;
}) {
  if (!byDay.length) return null;
  const maxCount = Math.max(...byDay.map(d => d.count), 1);

  const fmt = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Limit to last 14 days for readability
  const days = byDay.slice(-14);

  return (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: 16, padding: '18px 16px', boxShadow: T.cardShadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <IonIconComponent icon={trendingUpOutline} style={{ fontSize: 19, color: '#10B981' }} />
        <h3 style={{ fontSize: 15, color: T.text1, fontWeight: 700, margin: 0 }}>
          Tendance des commandes
        </h3>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          minWidth: days.length * 42,
        }}>
          {days.map((day, idx) => (
            <div key={idx} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', flex: '0 0 38px',
            }}>
              {/* Count label */}
              <span style={{ fontSize: 10, color: T.text2, fontWeight: 600, marginBottom: 4 }}>
                {day.count}
              </span>
              {/* Bar track */}
              <div style={{
                width: 24, height: 90, background: T.surf3,
                borderRadius: 8, position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'flex-end',
              }}>
                <div style={{
                  width: '100%',
                  height: `${Math.max((day.count / maxCount) * 100, day.count > 0 ? 4 : 0)}%`,
                  background: 'linear-gradient(180deg, #10B981 0%, #059669 100%)',
                  borderRadius: 8,
                  transition: 'height 0.5s ease',
                }} />
              </div>
              {/* Date label */}
              <span style={{
                fontSize: 9, color: T.text3, fontWeight: 600,
                marginTop: 5, textAlign: 'center',
                writingMode: days.length > 10 ? 'vertical-rl' as const : undefined,
                transform: days.length > 10 ? 'rotate(180deg)' : undefined,
              }}>
                {fmt(day.date)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HourlyBreakdown({ byHour, T }: {
  byHour: ReportData['byHour']; T: ReturnType<typeof makeTokens>;
}) {
  const active = byHour.filter(h => h.count > 0);
  if (!active.length) return null;
  const maxCount = Math.max(...active.map(h => h.count), 1);
  const peakHour = active.reduce((a, b) => b.count > a.count ? b : a, active[0]);

  // Show hours from min active - 1 to max active + 1
  const minH = Math.max(0,  Math.min(...active.map(h => h.hour)) - 0);
  const maxH = Math.min(23, Math.max(...active.map(h => h.hour)) + 0);
  const displayHours = byHour.filter(h => h.hour >= minH && h.hour <= maxH);

  return (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: 16, padding: '18px 16px', boxShadow: T.cardShadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IonIconComponent icon={timeOutline} style={{ fontSize: 19, color: '#8B5CF6' }} />
          <h3 style={{ fontSize: 15, color: T.text1, fontWeight: 700, margin: 0 }}>
            Activité par heure
          </h3>
        </div>
        <div style={{
          background: 'rgba(139,92,246,0.12)', borderRadius: 8,
          padding: '4px 10px',
        }}>
          <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 700 }}>
            Pic: {peakHour.hour}h ({peakHour.count})
          </span>
        </div>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 4,
          minWidth: displayHours.length * 34,
        }}>
          {displayHours.map((h) => (
            <div key={h.hour} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', flex: '0 0 30px',
            }}>
              {h.count > 0 && (
                <span style={{ fontSize: 9, color: T.text2, fontWeight: 600, marginBottom: 3 }}>
                  {h.count}
                </span>
              )}
              <div style={{
                width: 20, height: 70, background: T.surf3,
                borderRadius: 6, overflow: 'hidden',
                display: 'flex', alignItems: 'flex-end',
              }}>
                <div style={{
                  width: '100%',
                  height: h.count > 0
                    ? `${Math.max((h.count / maxCount) * 100, 5)}%`
                    : '0%',
                  background: h.hour === peakHour.hour
                    ? 'linear-gradient(180deg,#8B5CF6,#7C3AED)'
                    : 'linear-gradient(180deg,#A78BFA,#8B5CF6)',
                  borderRadius: 6,
                }} />
              </div>
              <span style={{ fontSize: 9, color: T.text3, marginTop: 4 }}>
                {h.hour}h
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeliveryCompanies({ companies, T }: {
  companies: ReportData['byDeliveryCompany']; T: ReturnType<typeof makeTokens>;
}) {
  if (!companies.length) return null;
  return (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: 16, padding: '18px 16px', boxShadow: T.cardShadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <IonIconComponent icon={bicycleOutline} style={{ fontSize: 19, color: '#3B82F6' }} />
        <h3 style={{ fontSize: 15, color: T.text1, fontWeight: 700, margin: 0 }}>
          Sociétés de livraison
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {companies.map((c, idx) => (
          <div key={idx} style={{
            background: T.surf2, borderRadius: 12, padding: '12px 14px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: 8,
            }}>
              <div>
                <p style={{ fontSize: 14, color: T.text1, fontWeight: 700, margin: 0 }}>
                  {c.name}
                </p>
                <p style={{ fontSize: 11, color: T.text3, margin: '2px 0 0' }}>
                  {c.count} commandes · commission {c.commission}%
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 14, color: '#10B981', fontWeight: 700, margin: 0 }}>
                  {c.net.toFixed(2)} DT net
                </p>
                <p style={{ fontSize: 10, color: '#EF4444', margin: '2px 0 0' }}>
                  -{c.commissionAmount.toFixed(2)} DT
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const history = useHistory();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const T = makeTokens(isDark);

  const [range,   setRange]   = useState<Range>('7d');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [data,    setData]    = useState<ReportData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRange(range);
      const result = await statisticsService.getReports(from, to);
      setData(result);
    } catch {
      setError('Impossible de charger les statistiques.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (!authService.isAuthenticated()) { history.push('/login'); return; }
    fetchData();
  }, [history, fetchData]);

  const handleRefresh = async (e: CustomEvent) => {
    await fetchData();
    e.detail.complete();
  };

  // ── Loading state ──
  if (loading && !data) {
    return (
      <IonPage>
        <IonContent style={{ '--background': T.contentBg }}>
          <div style={{
            height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
          }}>
            <IonSpinner name="dots" style={{ color: '#F5A800', width: 44, height: 44 }} />
            <p style={{ color: T.text2, fontSize: 14, margin: 0 }}>Chargement…</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      {/* ════════════════════ HEADER ════════════════════ */}
      <IonHeader style={{ background: T.headerBg, borderBottom: `1px solid ${T.headerBorder}` }}>
        <IonToolbar style={{
          '--background': 'transparent',
          '--border-color': 'transparent',
          minHeight: 'auto',
          padding: '14px 16px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            {/* Menu Button */}
            <IonMenuButton style={{
              width: 40, height: 40, borderRadius: 12,
              background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.03)',
              border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.05)',
              '--color': T.text2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0,
            }} />

            {/* Logo */}
            <div style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg, #F5A800, #FF6B00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 14px rgba(245,168,0,0.45)',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: -0.5 }}>MR</span>
            </div>

            {/* Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: T.titleColor, fontWeight: 800, fontSize: 18, letterSpacing: -0.4 }}>
                Statistiques
              </span>
            </div>

            {/* Theme toggle */}
            <button onClick={toggleTheme} style={{
              width: 40, height: 40, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(245,168,0,0.15)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(245,168,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IonIcon icon={isDark ? sunnyOutline : moonOutline}
                style={{ fontSize: 18, color: isDark ? '#F5A800' : '#C4A35A' }} />
            </button>

            {/* Logout */}
            <button onClick={() => { logout(); history.push('/login'); }} style={{
              width: 40, height: 40, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              background: T.logoutBg, border: `1px solid ${T.logoutBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IonIcon icon={logOutOutline} style={{ fontSize: 18, color: T.text2 }} />
            </button>
          </div>
        </IonToolbar>
      </IonHeader>

      {/* ════════════════════ CONTENT ════════════════════ */}
      <IonContent style={{ '--background': T.contentBg, transition: 'background 0.25s' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingText="Actualiser…" />
        </IonRefresher>

        <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Date range filter ── */}
          <div style={{
            display: 'flex', gap: 8, padding: '4px 2px',
          }}>
            {RANGES.map(r => {
              const isActive = range === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 12,
                    border: isActive ? '1.5px solid #F5A800' : `1px solid ${T.pillBorder}`,
                    background: isActive ? 'rgba(245,168,0,0.14)' : T.pillBg,
                    color: isActive ? '#F5A800' : T.text2,
                    fontWeight: isActive ? 700 : 600,
                    fontSize: 13, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* ── Error state ── */}
          {error && (
            <div style={{
              background: T.errBg, border: `1px solid ${T.errBorder}`,
              borderRadius: 14, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <IonIcon icon={alertCircleOutline} style={{ fontSize: 22, color: '#EF4444', flexShrink: 0 }} />
              <p style={{ color: '#EF4444', fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* ── Loading overlay on refetch ── */}
          {loading && data && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <IonSpinner name="dots" style={{ color: '#F5A800', width: 32, height: 32 }} />
            </div>
          )}

          {data && (
            <>
              {/* ── KPI Cards 2x2 ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatCard
                  icon={restaurantOutline}
                  title="Commandes"
                  value={data.orderCount.toLocaleString()}
                  subtitle="Total période"
                  color="#3B82F6" T={T}
                />
                <StatCard
                  icon={cashOutline}
                  title="CA Net"
                  value={`${data.netTotalRevenue.toFixed(0)} DT`}
                  subtitle="Après commissions"
                  color="#10B981" T={T}
                />
                <StatCard
                  icon={barChartOutline}
                  title="CA Brut"
                  value={`${data.totalRevenue.toFixed(0)} DT`}
                  subtitle="Avant commissions"
                  color="#F5A800" T={T}
                />
                <StatCard
                  icon={calendarOutline}
                  title="Panier Moyen"
                  value={`${data.avgOrder.toFixed(2)} DT`}
                  subtitle="Net / commande"
                  color="#8B5CF6" T={T}
                />
              </div>

              {/* ── Type breakdown ── */}
              <TypeBreakdown data={data} T={T} />

              {/* ── Trend chart (daily for 7d/30d/all, hourly for today) ── */}
              {range === 'today'
                ? <HourlyBreakdown byHour={data.byHour} T={T} />
                : <DailyTrend byDay={data.byDay} T={T} />
              }

              {/* ── Top products ── */}
              <TopProducts products={data.topProducts} T={T} />

              {/* ── Delivery companies ── */}
              <DeliveryCompanies companies={data.byDeliveryCompany} T={T} />

              {/* ── Empty state ── */}
              {data.orderCount === 0 && (
                <div style={{
                  background: T.cardBg, border: `1px solid ${T.cardBorder}`,
                  borderRadius: 16, padding: '40px 20px', textAlign: 'center',
                  boxShadow: T.cardShadow,
                }}>
                  <IonIcon icon={restaurantOutline} style={{ fontSize: 48, color: T.text3 }} />
                  <p style={{ fontSize: 16, color: T.text2, fontWeight: 600, margin: '12px 0 4px' }}>
                    Aucune commande
                  </p>
                  <p style={{ fontSize: 13, color: T.text3, margin: 0 }}>
                    Pas de données pour cette période.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
