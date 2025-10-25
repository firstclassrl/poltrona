import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppNavigator } from '@/navigation/AppNavigator';
import { LoginScreen } from '@/screens/LoginScreen';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LinearGradient } from 'expo-linear-gradient';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={{ flex: 1 }}>
        <LoadingSpinner />
      </LinearGradient>
    );
  }

  return user ? <AppNavigator /> : <LoginScreen />;
};

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AppContent />
    </AuthProvider>
  );
}