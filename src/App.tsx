import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
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
// dark.system.css removed — conflicts with the custom #1A1A1A dark theme in Login/Orders
import './index.css';

setupIonicReact();

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // Start FCM only after the user is logged in
  useNotifications(isAuthenticated);

  if (isLoading) return null;

  return (
    <IonRouterOutlet>
      {/* IonRouterOutlet requires the render prop — children JSX breaks Ionic page lifecycle */}
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
      {/* AuthProvider must wrap IonReactRouter so auth state is available before routing */}
      <AuthProvider>
        <IonReactRouter>
          <AppRoutes />
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
}
