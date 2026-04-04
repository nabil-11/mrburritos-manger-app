import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useHistory } from 'react-router-dom';
import {
  IonContent, IonPage, IonInput, IonButton, IonIcon, IonText, IonSpinner,
} from '@ionic/react';
import { eyeOutline, eyeOffOutline, lockClosedOutline, mailOutline } from 'ionicons/icons';

export default function Login() {
  const { login } = useAuth();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      history.replace('/orders');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent style={{ '--background': '#0F0F0F' }}>
        <div className="flex flex-col items-center justify-center min-h-screen px-6">

          {/* Logo */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-1 mb-3">
              <span style={{
                color: '#F5A800',
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: -2,
                lineHeight: 1,
              }}>MR.</span>
              <span style={{
                color: '#FF6B00',
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: -2,
                lineHeight: 1,
              }}>🌯</span>
            </div>
            <p style={{ color: '#F5A800', fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: 2 }}>
              BURRITOS
            </p>
            <p style={{ color: '#6B7280', fontSize: 13, marginTop: 6 }}>
              Espace Manager
            </p>
          </div>

          {/* Card */}
          <div className="w-full max-w-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Email */}
              <div style={{ position: 'relative' }}>
                <IonInput
                  fill="outline"
                  label="Email"
                  labelPlacement="floating"
                  type="email"
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value || '')}
                  required
                  autocomplete="email"
                  style={{
                    '--background': '#1C1C1C',
                    '--color': '#FFFFFF',
                    '--placeholder-color': '#4B5563',
                    '--border-color': '#2D2D2D',
                    '--border-color-focused': '#F5A800',
                    '--highlight-color-focused': '#F5A800',
                    '--label-color': '#6B7280',
                    '--border-radius': '14px',
                    '--padding-start': '48px',
                  }}
                />
                <IonIcon
                  icon={mailOutline}
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6B7280',
                    fontSize: 18,
                    zIndex: 10,
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ position: 'relative' }}>
                <IonInput
                  fill="outline"
                  label="Mot de passe"
                  labelPlacement="floating"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value || '')}
                  required
                  autocomplete="current-password"
                  style={{
                    '--background': '#1C1C1C',
                    '--color': '#FFFFFF',
                    '--placeholder-color': '#4B5563',
                    '--border-color': '#2D2D2D',
                    '--border-color-focused': '#F5A800',
                    '--highlight-color-focused': '#F5A800',
                    '--label-color': '#6B7280',
                    '--border-radius': '14px',
                    '--padding-start': '48px',
                    '--padding-end': '48px',
                  }}
                />
                <IonIcon
                  icon={lockClosedOutline}
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6B7280',
                    fontSize: 18,
                    zIndex: 10,
                    pointerEvents: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    zIndex: 10,
                    padding: 4,
                  }}
                >
                  <IonIcon
                    icon={showPw ? eyeOffOutline : eyeOutline}
                    style={{ color: '#6B7280', fontSize: 18 }}
                  />
                </button>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: '#2D1515',
                  border: '1px solid #EF444440',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <IonText style={{ color: '#F87171', fontSize: 13 }}>{error}</IonText>
                </div>
              )}

              {/* Submit */}
              <IonButton
                type="submit"
                expand="block"
                disabled={loading}
                style={{
                  '--background': '#F5A800',
                  '--background-hover': '#FF6B00',
                  '--background-activated': '#D97706',
                  '--color': '#000000',
                  '--border-radius': '14px',
                  '--box-shadow': '0 4px 24px #F5A80040',
                  height: 54,
                  fontWeight: 700,
                  fontSize: 16,
                  marginTop: 4,
                }}
              >
                {loading
                  ? <IonSpinner name="crescent" style={{ color: '#000', width: 20, height: 20 }} />
                  : 'Se connecter'
                }
              </IonButton>
            </form>
          </div>

          {/* Footer */}
          <p style={{ color: '#374151', fontSize: 12, marginTop: 40 }}>
            Mr. Burritos © {new Date().getFullYear()}
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
}
