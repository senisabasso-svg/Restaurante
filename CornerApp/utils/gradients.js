import { LinearGradient } from 'expo-linear-gradient';

// Instalar expo-linear-gradient para gradientes
// Si no está disponible, usamos una alternativa simple
export const GradientButton = ({ children, style, colors = ['#ea580c', '#f97316'], ...props }) => {
  // Por ahora, retornamos un View con backgroundColor como fallback
  // En producción, usar LinearGradient de expo-linear-gradient
  return children;
};

export const getGradientColors = (theme) => {
  if (theme === 'orange') {
    return ['#ea580c', '#f97316'];
  }
  return ['#ea580c', '#f97316'];
};
