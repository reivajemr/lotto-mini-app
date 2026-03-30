export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface UserData {
  telegramId: string;
  username: string;
  coins: number;
  tonBalance: number;
  createdAt: string;
  lastActive: string;
}

export type Section = 'lobby' | 'tareas' | 'wallet' | 'amigos';
