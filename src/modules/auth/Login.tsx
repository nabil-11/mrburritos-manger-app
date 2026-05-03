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
        <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ position: 'relative' }}>

          {/* Ambient background orbs */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            <div style={{
              position: 'absolute', width: 340, height: 340, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245,168,0,0.09) 0%, transparent 70%)',
              top: -100, left: -100,
              animation: 'floatOrb1 12s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', width: 260, height: 260, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,107,0,0.07) 0%, transparent 70%)',
              bottom: 80, right: -70,
              animation: 'floatOrb2 16s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', width: 180, height: 180, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245,168,0,0.05) 0%, transparent 70%)',
              top: '45%', right: 10,
              animation: 'floatOrb1 10s ease-in-out 3s infinite',
            }} />
          </div>

          {/* Logo */}
          <div className="text-center mb-10" style={{ position: 'relative', zIndex: 1, animation: 'fadeInUp 0.5s ease-out' }}>
            <div className="flex items-center justify-center gap-1 mb-3"
              style={{ filter: 'drop-shadow(0 0 28px rgba(245,168,0,0.25))' }}>
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
          <div className="w-full max-w-sm" style={{ position: 'relative', zIndex: 1, animation: 'fadeInUp 0.5s ease-out 0.1s both' }}>
            <div style={{
              background: 'rgba(24, 24, 24, 0.75)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.07)',
              padding: '28px 22px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
            }}>
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
                  background: 'rgba(45,21,21,0.9)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  animation: 'fadeInUp 0.3s ease-out',
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>⚠️</span>
                  </div>
                  <IonText style={{ color: '#F87171', fontSize: 13 }}>{error}</IonText>
                </div>
              )}

              {/* Submit */}
              <IonButton
                type="submit"
                expand="block"
                disabled={loading}
                style={{
                  '--background': 'linear-gradient(135deg, #F5A800 0%, #FF8C00 100%)',
                  '--background-activated': '#D97706',
                  '--color': '#000000',
                  '--border-radius': '14px',
                  '--box-shadow': '0 6px 28px rgba(245,168,0,0.38)',
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
          </div>

          {/* Footer */}
          <p style={{ color: '#374151', fontSize: 12, marginTop: 40, position: 'relative', zIndex: 1 }}>
            Mr. Burritos © {new Date().getFullYear()}
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
}
