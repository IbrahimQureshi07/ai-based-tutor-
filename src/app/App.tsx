import { AppProvider, useApp } from '@/app/context/ExamContext';
import { AuthScreen } from '@/app/components/AuthScreen';
import { Dashboard } from '@/app/components/Dashboard';
import { PracticeTest } from '@/app/components/PracticeTest';
import { MockTest } from '@/app/components/MockTest';
import { FinalExam } from '@/app/components/FinalExam';
import { Results } from '@/app/components/Results';
import { Assessment } from '@/app/components/Assessment';
import { AIChatbot } from '@/app/components/AIChatbot';
import { SplashScreen } from '@/app/components/SplashScreen';
import { Toaster } from '@/app/components/ui/sonner';
import { useState, useEffect } from 'react';

function AppContent() {
  const { currentScreen, isAuthenticated } = useApp();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Show splash screen for 2 seconds on first load
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'assessment':
        return <Assessment />;
      case 'practice':
        return <PracticeTest questionLimit={3} />;
      case 'mock':
        return <MockTest />;
      case 'final':
        return <FinalExam />;
      case 'results':
        return <Results />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      {renderScreen()}
      <AIChatbot />
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}