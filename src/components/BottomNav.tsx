import { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import {
  restaurant, restaurantOutline,
  fastFood, fastFoodOutline,
  barChart, barChartOutline,
} from 'ionicons/icons';
import { useTheme } from '../context/ThemeContext';

/** Orders page dispatches this with the current pending-order count. */
export const PENDING_COUNT_EVENT = 'manager:pending-count';

const TABS = [
  { path: '/orders',     label: 'Commandes', icon: restaurantOutline, iconActive: restaurant, badge: true },
  { path: '/commander',  label: 'Commander', icon: fastFoodOutline,   iconActive: fastFood,   badge: false },
  { path: '/statistics', label: 'Stats',     icon: barChartOutline,   iconActive: barChart,   badge: false },
] as const;

const ACCENT = '#F5A800';

export default function BottomNav() {
  const history = useHistory();
  const location = useLocation();
  const { isDark } = useTheme();
  const [pending, setPending] = useState(0);

  // Reserve space at the bottom of every ion-content while the nav is mounted
  useEffect(() => {
    document.body.classList.add('has-bottom-nav');
    return () => document.body.classList.remove('has-bottom-nav');
  }, []);

  useEffect(() => {
    const onCount = (e: Event) => setPending((e as CustomEvent<number>).detail ?? 0);
    window.addEventListener(PENDING_COUNT_EVENT, onCount);
    return () => window.removeEventListener(PENDING_COUNT_EVENT, onCount);
  }, []);

  const bg     = isDark ? 'rgba(20,20,22,0.92)' : 'rgba(255,255,255,0.94)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const idle   = isDark ? '#8A8A93' : '#9A948C';

  return (
    <nav
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
        background: bg,
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderTop: `1px solid ${border}`,
        paddingBottom: 'var(--ion-safe-area-bottom, 0px)',
        boxShadow: isDark ? '0 -6px 24px rgba(0,0,0,0.4)' : '0 -6px 24px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', height: 62, maxWidth: 560, margin: '0 auto' }}>
        {TABS.map(tab => {
          const active = location.pathname === tab.path;
          const showBadge = tab.badge && pending > 0;
          return (
            <button
              key={tab.path}
              onClick={() => { if (!active) history.push(tab.path); }}
              style={{
                flex: 1, border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '6px 0 4px', position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* active top indicator */}
              <span style={{
                position: 'absolute', top: 0, width: 34, height: 3, borderRadius: 3,
                background: active ? ACCENT : 'transparent',
                transition: 'background 0.2s',
              }} />

              <span style={{ position: 'relative', display: 'flex' }}>
                <IonIcon
                  icon={active ? tab.iconActive : tab.icon}
                  style={{ fontSize: 24, color: active ? ACCENT : idle, transition: 'color 0.2s' }}
                />
                {showBadge && (
                  <span style={{
                    position: 'absolute', top: -5, right: -8, minWidth: 17, height: 17, padding: '0 4px',
                    borderRadius: 9, background: '#EF4444', color: '#fff',
                    fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 0 2px ' + (isDark ? '#141416' : '#fff'),
                  }}>
                    {pending > 9 ? '9+' : pending}
                  </span>
                )}
              </span>

              <span style={{
                fontSize: 11, fontWeight: active ? 800 : 600,
                color: active ? ACCENT : idle, letterSpacing: 0.2, transition: 'color 0.2s',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
