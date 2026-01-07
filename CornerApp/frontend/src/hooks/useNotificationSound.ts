import { useCallback, useRef } from 'react';

// Sonido de notificación en base64 (beep corto)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+jm5eHdmlcV1lmdYGOnJqbl42AcmRZU1RdaXmFkJWVkYl+cmZdWFleaHWAio+RjoeDe3JpZGFlbHV+hoyOjIqGgXp0bmtqbnN5f4WHiIeGhIF9eHRxcHJ1eX1/gYKCgYB+fHp4d3d4ent9fn9/fn59fHt6eXl5ent8fX5+fn59fHx7e3t7e3x8fX19fX19fHx8fHx8fHx8fH19fX19fX19fX19fX19fX19fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8';

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(() => {
    try {
      // Crear audio si no existe
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = 0.5;
      }
      
      // Reiniciar y reproducir
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        // El navegador puede bloquear autoplay sin interacción del usuario
        console.log('No se pudo reproducir sonido:', e);
      });
    } catch (error) {
      console.log('Error al reproducir sonido:', error);
    }
  }, []);

  return { playSound };
}

// Función helper para calcular tiempo transcurrido
export function getTimeElapsed(dateString: string): { text: string; isUrgent: boolean; minutes: number } {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  
  let text: string;
  let isUrgent = false;
  
  if (diffMinutes < 1) {
    text = 'ahora';
  } else if (diffMinutes < 60) {
    text = `${diffMinutes}min`;
    // Urgente si más de 5 min en pendiente o más de 20 en preparación
    isUrgent = diffMinutes > 15;
  } else if (diffHours < 24) {
    text = `${diffHours}h ${diffMinutes % 60}min`;
    isUrgent = true;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    text = `${diffDays}d`;
    isUrgent = true;
  }
  
  return { text, isUrgent, minutes: diffMinutes };
}

