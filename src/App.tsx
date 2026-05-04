import { Redirect, Route, useLocation } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  restaurantOutline,
  logOutOutline,
  barChartOutline,
  fastFoodOutline,
} from 'ionicons/icons';
import Login from './modules/auth/Login';
import Orders from './modules/orders/Orders';
import Statistics from './modules/statistics/Statistics';
import Commander from './modules/commander/Commander';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useNotifications } from './hooks/useNotifications';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './index.css';

setupIonicReact();

const NAV_ITEMS = [
  { path: '/orders',     label: 'Commandes',    icon: restaurantOutline, color: '#F5A800' },
  { path: '/commander',  label: 'Commander',    icon: fastFoodOutline,   color: '#FF6B00' },
  { path: '/statistics', label: 'Statistiques', icon: barChartOutline,   color: '#10B981' },
];

function AppMenu() {
  const { logout } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();

  const bg        = isDark ? '#111111' : '#FFFBF6';
  const border    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const text1     = isDark ? '#F9FAFB' : '#1C1917';
  const text2     = isDark ? '#9CA3AF' : '#78716C';
  const itemHover = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,168,0,0.09)';

  return (
    <IonMenu contentId="main-content" type="overlay">
      {/* ── Header ── */}
      <IonHeader>
        <IonToolbar style={{
          '--background': isDark ? '#1A1A1A' : '#F5A800',
          '--border-color': 'transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              background: isDark
                ? 'linear-gradient(135deg, #F5A800, #FF6B00)'
                : 'rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>MR</span>
            </div>
            <div>
              <p style={{
                margin: 0, fontWeight: 900, fontSize: 17, letterSpacing: -0.3,
                color: isDark ? '#F9FAFB' : '#000',
              }}>
                Mr. Burritos
              </p>
              <p style={{
                margin: 0, fontSize: 11, fontWeight: 600,
                color: isDark ? '#F5A800' : 'rgba(0,0,0,0.55)',
              }}>
                Manager
              </p>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      {/* ── Content ── */}
      <IonContent style={{ '--background': bg }}>
        <IonList style={{ background: 'transparent', padding: '10px 0' }}>

          {/* Nav items */}
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <IonItem
                key={item.path}
                routerLink={item.path}
                routerDirection="root"
                lines="none"
                style={{
                  '--background': isActive ? `${item.color}18` : 'transparent',
                  '--background-hover': itemHover,
                  '--color': isActive ? item.color : text1,
                  '--border-color': 'transparent',
                  '--padding-start': '0px',
                  '--inner-padding-end': '12px',
                  margin: '2px 10px',
                  borderRadius: 12,
                  borderLeft: isActive ? `3px solid ${item.color}` : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div slot="start" style={{
                  width: 40, display: 'flex', justifyContent: 'center',
                  paddingLeft: 14,
                }}>
                  <IonIcon
                    icon={item.icon}
                    style={{ fontSize: 21, color: item.color }}
                  />
                </div>
                <IonLabel style={{ fontWeight: isActive ? 700 : 600, fontSize: 15 }}>
                  {item.label}
                </IonLabel>
              </IonItem>
            );
          })}

          {/* Divider */}
          <div style={{ height: 1, background: border, margin: '12px 18px' }} />

          {/* Logout */}
          <IonItem
            button
            lines="none"
            onClick={logout}
            style={{
              '--background': 'transparent',
              '--background-hover': 'rgba(239,68,68,0.08)',
              '--color': text2,
              '--border-color': 'transparent',
              '--padding-start': '0px',
              '--inner-padding-end': '12px',
              margin: '2px 10px',
              borderRadius: 12,
              borderLeft: '3px solid transparent',
            }}
          >
            <div slot="start" style={{
              width: 40, display: 'flex', justifyContent: 'center',
              paddingLeft: 14,
            }}>
              <IonIcon icon={logOutOutline} style={{ fontSize: 21, color: '#EF4444' }} />
            </div>
            <IonLabel style={{ fontWeight: 600, fontSize: 15 }}>Déconnexion</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonMenu>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  useNotifications(isAuthenticated);

  if (isLoading) return null;

  return (
    <>
      {isAuthenticated && <AppMenu />}
      <IonRouterOutlet id="main-content">
        <Route
          path="/login"
          exact
          render={() => (isAuthenticated ? <Redirect to="/orders" /> : <Login />)}
        />
        <Route
          path="/orders"
          exact
          render={() => (!isAuthenticated ? <Redirect to="/login" /> : <Orders />)}
        />
        <Route
          path="/commander"
          exact
          render={() => (!isAuthenticated ? <Redirect to="/login" /> : <Commander />)}
        />
        <Route
          path="/statistics"
          exact
          render={() => (!isAuthenticated ? <Redirect to="/login" /> : <Statistics />)}
        />
        <Route
          exact
          path="/"
          render={() => <Redirect to={isAuthenticated ? '/orders' : '/login'} />}
        />
      </IonRouterOutlet>
    </>
  );
}

export default function App() {
  return (
    <IonApp>
      <ThemeProvider>
        <AuthProvider>
          <IonReactRouter>
            <AppContent />
          </IonReactRouter>
        </AuthProvider>
      </ThemeProvider>
    </IonApp>
  );
}
