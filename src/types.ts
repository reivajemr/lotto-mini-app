export type Tab = 'lobby' | 'wallet' | 'tasks' | 'farm';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface AppUser {
  telegramId: string;
  username: string;
  balance: number;
  completedTasks: string[];
  lastDailyBonus: string | null;
  totalBets: number;
  totalWins: number;
  walletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  _id?: string;
  telegramId: string;
  drawId: string;
  bets: BetItem[];
  totalCost: number;
  status: 'pending' | 'won' | 'lost';
  totalPrize?: number;
  createdAt?: string;
}

export interface BetItem {
  animal: string;
  number: number;
  amount: number;
  won?: boolean;
  prize?: number;
}

export interface DrawResult {
  drawId: string;
  winnerNumber: number;
  winnerAnimal: string;
  drawnAt?: string;
}

export interface Animal {
  name: string;
  emoji: string;
  number: number;
}

export interface WithdrawalRequest {
  telegramId: string;
  tonAmount: number;
  lechugas: number;
  toAddress: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}
