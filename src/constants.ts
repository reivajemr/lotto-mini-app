// 1 TON = 10,000 lechugas
export const LECHUGAS_PER_TON = 10_000;
// 1 TON = 1,000,000,000 nanoTON
export const NANO_TON = 1_000_000_000;

// Minimum deposit/withdrawal in TON
export const MIN_DEPOSIT_TON = 0.1;
export const MIN_WITHDRAW_TON = 0.5;

// Admin TON wallet (testnet) - the address where users send TON
export const ADMIN_TON_WALLET =
  import.meta.env.VITE_ADMIN_TON_WALLET ||
  'EQBbq1FyJb8Dk1XY-6rBxdAaFZIXDIBH1QMFm5g9b6Vh_testnet';

// TON testnet network
export const TON_NETWORK = 'testnet';

// Ticket prices in lechugas
export const TICKET_PRICE = 100; // 100 lechugas = 0.01 TON

// Draw times (24h format)
export const DRAW_TIMES = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00',
];

// Animals list
export const ANIMALS = [
  { name: 'Venado',    emoji: '🦌', number: 1 },
  { name: 'Toro',      emoji: '🐂', number: 2 },
  { name: 'Caballo',   emoji: '🐴', number: 3 },
  { name: 'Mono',      emoji: '🐒', number: 4 },
  { name: 'Pavo',      emoji: '🦃', number: 5 },
  { name: 'Burro',     emoji: '🐴', number: 6 },
  { name: 'Pez',       emoji: '🐟', number: 7 },
  { name: 'Gallo',     emoji: '🐓', number: 8 },
  { name: 'Buey',      emoji: '🐃', number: 9 },
  { name: 'Rana',      emoji: '🐸', number: 10 },
  { name: 'Puerco',    emoji: '🐷', number: 11 },
  { name: 'Paloma',    emoji: '🕊️', number: 12 },
  { name: 'Gato',      emoji: '🐱', number: 13 },
  { name: 'Aguila',    emoji: '🦅', number: 14 },
  { name: 'Zorro',     emoji: '🦊', number: 15 },
  { name: 'Oso',       emoji: '🐻', number: 16 },
  { name: 'Pato',      emoji: '🦆', number: 17 },
  { name: 'Perro',     emoji: '🐶', number: 18 },
  { name: 'Camaron',   emoji: '🦐', number: 19 },
  { name: 'Tortuga',   emoji: '🐢', number: 20 },
  { name: 'Iguana',    emoji: '🦎', number: 21 },
  { name: 'Culebra',   emoji: '🐍', number: 22 },
  { name: 'Loro',      emoji: '🦜', number: 23 },
  { name: 'Leon',      emoji: '🦁', number: 24 },
  { name: 'Jabali',    emoji: '🐗', number: 25 },
];

export const API_BASE = '/api';
