import { useEffect, useState } from 'react';
import type { TelegramUser } from '../types';

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        expand: () => void;
        ready: () => void;
        close: () => void;
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback: (ok: boolean) => void) => void;
        initDataUnsafe: {
          user?: TelegramUser;
          query_id?: string;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        colorScheme: 'dark' | 'light';
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isProgressVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const tgUser = tg.initDataUnsafe?.user;
      if (tgUser) {
        setUser(tgUser);
      }
      setIsReady(true);
    } else {
      // For testing outside Telegram
      setUser({
        id: 123456789,
        first_name: 'Test',
        username: 'testuser',
      });
      setIsReady(true);
    }
  }, []);

  const showAlert = (message: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(message);
    } else {
      alert(message);
    }
  };

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const tg = window.Telegram?.WebApp;
      if (tg?.showConfirm) {
        tg.showConfirm(message, resolve);
      } else {
        resolve(confirm(message));
      }
    });
  };

  const haptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
    } catch (_) { /* silent */ }
  };

  return { user, isReady, showAlert, showConfirm, haptic };
}
