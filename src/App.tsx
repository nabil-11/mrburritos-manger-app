import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Login from './modules/auth/Login';
import Orders from './modules/orders/Orders';
import Statistics from './modules/statistics/Statistics';
import Commander from './modules/commander/Commander';
import BottomNav from './components/BottomNav';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
/* Dark palette — activated by the `ion-palette-dark` class (toggled in ThemeContext).
   Without this, Ionic overlays (action-sheet, alert, toast) render with no theme
   colours and look faded/broken on the dark UI. */
import '@ionic/react/css/palettes/dark.class.css';
import './theme/variables.css';
import './index.css';

setupIonicReact();

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  useNotifications(isAuthenticated);

  if (isLoading) return null;

  return (
    <>
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
      {isAuthenticated && <BottomNav />}
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
