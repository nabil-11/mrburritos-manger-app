import { useState, useEffect } from 'react';
import { IonIcon } from '@ionic/react';
import { timerOutline } from 'ionicons/icons';

interface CountdownTimerProps {
  confirmedAt?: string;
  preparationDuration?: number;
}

export function CountdownTimer({ confirmedAt, preparationDuration }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number>(0);
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    if (!confirmedAt || !preparationDuration) return;

    const calcRemaining = () => {
      const confirmed = new Date(confirmedAt).getTime();
      const end = confirmed + preparationDuration * 60 * 1000;
      const now = Date.now();
      const remainingSec = Math.max(0, Math.floor((end - now) / 1000));
      setIsLate(remainingSec === 0);
      return remainingSec;
    };

    setRemaining(calcRemaining());
    const interval = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(interval);
  }, [confirmedAt, preparationDuration]);

  if (!confirmedAt || !preparationDuration) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  if (isLate) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: '#FEE2E2', borderRadius: 99, padding: '4px 10px',
      }}>
        <IonIcon icon={timerOutline} style={{ fontSize: 12, color: '#DC2626' }} />
        <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 700 }}>En retard!</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: '#D1FAE5', borderRadius: 99, padding: '4px 10px',
    }}>
      <IonIcon icon={timerOutline} style={{ fontSize: 12, color: '#059669' }} />
      <span style={{ color: '#059669', fontSize: 11, fontWeight: 700 }}>
        {mins}:{secs.toString().padStart(2, '0')}
      </span>
    </div>
  );
}