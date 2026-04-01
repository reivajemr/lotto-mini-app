// 1 TON = 10,000 lechugas
export const LECHUGAS_PER_TON = 10_000;
// 1 TON = 1,000,000,000 nanoTON
export const NANO_TON = 1_000_000_000;

// Minimum deposit/withdrawal in TON
export const MIN_DEPOSIT_TON = 0.1;
export const MIN_WITHDRAW_TON = 0.5;

// TON testnet network
export const TON_NETWORK: 'testnet' | 'mainnet' = 'testnet';

// Ticket prices in lechugas
export const TICKET_PRICE = 100; // 100 lechugas = 0.01 TON

// BET CONFIG
export const BET_CONFIG = {
  minBet: 50,
  maxBetPerUser: 1000,
  multiplier: 30,
};

// Draw times (Venezuela time, 24h)
export const DRAW_TIMES = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00',
];

// 37 Animalitos list (Animalito Lotto Venezuela)
export const ANIMALS: { name: string; emoji: string; number: number }[] = [
  { name: 'Carnero',     emoji: '🐏', number: 1  },
  { name: 'Toro',        emoji: '🐂', number: 2  },
  { name: 'Ciempiés',    emoji: '🐛', number: 3  },
  { name: 'Alacrán',     emoji: '🦂', number: 4  },
  { name: 'León',        emoji: '🦁', number: 5  },
  { name: 'Rana',        emoji: '🐸', number: 6  },
  { name: 'Perico',      emoji: '🦜', number: 7  },
  { name: 'Ratón',       emoji: '🐭', number: 8  },
  { name: 'Águila',      emoji: '🦅', number: 9  },
  { name: 'Tigre',       emoji: '🐯', number: 10 },
  { name: 'Gato',        emoji: '🐱', number: 11 },
  { name: 'Caballo',     emoji: '🐴', number: 12 },
  { name: 'Mono',        emoji: '🐒', number: 13 },
  { name: 'Paloma',      emoji: '🕊️', number: 14 },
  { name: 'Zorro',       emoji: '🦊', number: 15 },
  { name: 'Oso',         emoji: '🐻', number: 16 },
  { name: 'Pavo',        emoji: '🦃', number: 17 },
  { name: 'Burro',       emoji: '🫏', number: 18 },
  { name: 'Chivo',       emoji: '🐐', number: 19 },
  { name: 'Cochino',     emoji: '🐷', number: 20 },
  { name: 'Gallo',       emoji: '🐓', number: 21 },
  { name: 'Camello',     emoji: '🐪', number: 22 },
  { name: 'Zebra',       emoji: '🦓', number: 23 },
  { name: 'Iguana',      emoji: '🦎', number: 24 },
  { name: 'Gavilán',     emoji: '🦆', number: 25 },
  { name: 'Murciélago',  emoji: '🦇', number: 26 },
  { name: 'Perro',       emoji: '🐶', number: 27 },
  { name: 'Venado',      emoji: '🦌', number: 28 },
  { name: 'Morrocoy',    emoji: '🐢', number: 29 },
  { name: 'Caimán',      emoji: '🐊', number: 30 },
  { name: 'Anteater',    emoji: '🦔', number: 31 },
  { name: 'Serpiente',   emoji: '🐍', number: 32 },
  { name: 'Lechuza',     emoji: '🦉', number: 33 },
  { name: 'Loro',        emoji: '🦜', number: 34 },
  { name: 'Jirafa',      emoji: '🦒', number: 35 },
  { name: 'Culebra',     emoji: '🐍', number: 36 },
  { name: 'Ballena',     emoji: '🐋', number: 0  },
];

export const API_BASE = '/api';

// TonConnect Manifest URL
export const TONCONNECT_MANIFEST_URL = 'https://lotto-mini-app-git-main-reivajemrs-projects.vercel.app/tonconnect-manifest.json';
