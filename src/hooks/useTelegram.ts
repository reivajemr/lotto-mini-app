import { useEffect, useState } from 'react';
import type { TelegramUser } from '../types';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void;
        expand(): void;
        close(): void;
        initDataUnsafe?: {
          user?: TelegramUser;
          start_param?: string;
        };
        initData?: string;
        MainButton?: {
          text: string;
          show(): void;
          hide(): void;
          onClick(fn: () => void): void;
        };
        showAlert(msg: string, cb?: () => void): void;
        showConfirm(msg: string, cb: (ok: boolean) => void): void;
        colorScheme?: 'light' | 'dark';
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        HapticFeedback?: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
      };
    };
  }
}

export function useTelegram() {
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) setTgUser(user);
    } else {
      // Dev fallback
      setTgUser({ id: 999999, first_name: 'Dev', username: 'devuser' });
    }
    setIsReady(true);
  }, []);

  const showAlert = (msg: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(msg);
    } else {
      alert(msg);
    }
  };

  const haptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      if (type === 'success' || type === 'error') {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
    }
  };

  const initData = window.Telegram?.WebApp?.initData || '';

  return { tgUser, isReady, showAlert, haptic, initData };
}
