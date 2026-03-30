import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { loadUserData } from './api';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Lobby from './components/Lobby';
import Wallet from './components/Wallet';
import Tareas from './components/Tareas';
import Amigos from './components/Amigos';
import type { Section } from './types';

export default function App() {
  const { user, isReady, showAlert, haptic } = useTelegram();
  const [activeSection, setActiveSection] = useState<Section>('lobby');
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load user data from backend
  useEffect(() => {
    if (!isReady || !user) return;

    const fetchData = async () => {
      try {
        const data = await loadUserData(user.id.toString(), user.username || 'Usuario');
        const coins = data.user?.coins ?? data.coins ?? 1000;
        setBalance(coins);
      } catch (error) {
        console.error('Error loading data:', error);
        setBalance(1000); // Default
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isReady, user]);

  const handleNavigate = (section: Section) => {
    haptic('light');
    setActiveSection(section);
  };

  // Loading screen
  if (!isReady || isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#121212]">
        <div className="animate-bounce text-6xl">🎰</div>
        <h1 className="mt-4 text-xl font-bold text-white">Animalito Lotto</h1>
        <p className="mt-2 animate-pulse text-sm text-gray-400">Cargando...</p>
        <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="animate-loading h-full w-1/2 rounded-full bg-gradient-to-r from-[#0088cc] to-[#4caf50]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#121212] text-white">
      {/* Header */}
      <Header user={user} balance={balance} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {activeSection === 'lobby' && (
          <Lobby
            balance={balance}
            onBalanceChange={setBalance}
            showAlert={showAlert}
            haptic={haptic}
            telegramId={user?.id?.toString() || ''}
            username={user?.username || 'Usuario'}
          />
        )}
        {activeSection === 'tareas' && (
          <Tareas
            balance={balance}
            onBalanceChange={setBalance}
            showAlert={showAlert}
            haptic={haptic}
          />
        )}
        {activeSection === 'wallet' && (
          <Wallet
            balance={balance}
            showAlert={showAlert}
            haptic={haptic}
          />
        )}
        {activeSection === 'amigos' && (
          <Amigos
            user={user}
            showAlert={showAlert}
            haptic={haptic}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav active={activeSection} onNavigate={handleNavigate} />
    </div>
  );
}
