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

  return (
    <IonMenu contentId="main-content" type="overlay">
      <IonHeader>
        <IonToolbar color="warning">
          <IonTitle>Mr. Burritos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem routerLink="/orders" routerDirection="root">
            <IonIcon slot="start" icon={restaurantOutline} />
            <IonLabel>Commandes</IonLabel>
          </IonItem>
          <IonItem button onClick={logout}>
            <IonIcon slot="start" icon={logOutOutline} />
            <IonLabel>Déconnexion</IonLabel>
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
      <AuthProvider>
        <IonReactRouter>
          <AppMenu />
          <AppRoutes />
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
}
