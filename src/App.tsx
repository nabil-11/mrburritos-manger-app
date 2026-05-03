import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonButtons,
  IonMenuButton,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  restaurantOutline,
  logOutOutline,
  settingsOutline,
  informationCircleOutline
} from 'ionicons/icons';
import Login from './modules/auth/Login';
import Orders from './modules/orders/Orders';
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

function AppMenu() {
  const { logout } = useAuth();
  const { isDark } = useTheme();

  const bg       = isDark ? '#111111' : '#FFFBF6';
  const border   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const text1    = isDark ? '#F9FAFB' : '#1C1917';
  const text2    = isDark ? '#9CA3AF' : '#78716C';
  const itemHover = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(245,168,0,0.08)';

  return (
    <IonMenu contentId="main-content" type="overlay">
      <IonHeader>
        <IonToolbar style={{
          '--background': isDark ? '#1A1A1A' : '#F5A800',
          '--color': isDark ? '#F5A800' : '#000000',
          '--border-color': border,
        }}>
          <IonTitle style={{ fontWeight: 800, letterSpacing: 1 }}>Mr. Burritos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent style={{ '--background': bg }}>
        <IonList style={{ background: 'transparent', padding: '8px 0' }}>
          <IonItem
            routerLink="/orders"
            routerDirection="root"
            style={{
              '--background': 'transparent',
              '--background-hover': itemHover,
              '--color': text1,
              '--border-color': border,
              '--padding-start': '20px',
              margin: '2px 8px',
              borderRadius: 12,
            }}
          >
            <IonIcon slot="start" icon={restaurantOutline} style={{ color: '#F5A800' }} />
            <IonLabel style={{ fontWeight: 600 }}>Commandes</IonLabel>
          </IonItem>
          <IonItem
            button
            onClick={logout}
            style={{
              '--background': 'transparent',
              '--background-hover': itemHover,
              '--color': text2,
              '--border-color': 'transparent',
              '--padding-start': '20px',
              margin: '2px 8px',
              borderRadius: 12,
            }}
          >
            <IonIcon slot="start" icon={logOutOutline} style={{ color: '#EF4444' }} />
            <IonLabel style={{ fontWeight: 600 }}>Déconnexion</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonMenu>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  useNotifications(isAuthenticated);

  if (isLoading) return null;

  return (
    <IonRouterOutlet>
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
        exact
        path="/"
        render={() => <Redirect to={isAuthenticated ? '/orders' : '/login'} />}
      />
    </IonRouterOutlet>
  );
}

export default function App() {
  return (
    <IonApp>
      <ThemeProvider>
        <AuthProvider>
          <IonReactRouter>
            <AppMenu />
            <AppRoutes />
          </IonReactRouter>
        </AuthProvider>
      </ThemeProvider>
    </IonApp>
  );
}
