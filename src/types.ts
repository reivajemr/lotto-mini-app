export type Tab = 'lobby' | 'wallet' | 'tasks';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface AppUser {
  telegramId: number;
  name: string;
  username?: string;
  balance: number; // lechugas
  tonWallet?: string;
  pendingWithdrawals?: PendingWithdrawal[];
}

export interface Ticket {
  _id: string;
  userId: number;
  animal: string;
  emoji: string;
  drawTime: string;
  amount: number;
  status: 'pending' | 'won' | 'lost';
  prize?: number;
  createdAt: string;
}

export interface DrawResult {
  drawTime: string;
  winnerAnimal: string;
  winnerEmoji: string;
  drawnAt?: string;
}

export interface TonTransaction {
  hash: string;
  amount: number; // nanoTON
  from: string;
  to: string;
  comment?: string;
  timestamp: number;
}

export interface PendingWithdrawal {
  id: string;
  amount: number; // lechugas
  tonAmount: number;
  toAddress: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Animal {
  name: string;
  emoji: string;
  number: number;
}
