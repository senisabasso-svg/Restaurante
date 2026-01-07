import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Alias para evitar conflicto con React Navigation
export const useAppTheme = useTheme;

export const ThemeProvider = ({ children }) => {
  // Tema fijo - siempre usa el tema claro
  const colors = {
    background: '#720026',
    cardBackground: '#ffffff',
    text: '#ffffff',
    textSecondary: '#f0f0f0',
    cardText: '#1f2937',
    cardTextSecondary: '#4b5563',
    border: '#e5e7eb',
    primary: '#4a4e69',
    success: '#10b981',
    error: '#ef4444',
  };

  return (
    <ThemeContext.Provider value={{ colors }}>
      {children}
    </ThemeContext.Provider>
  );
};
