// API_BASE es relativo - en Vercel, /api/user apunta al serverless function
const API_BASE = '/api';

interface ApiUserResponse {
  success: boolean;
  user?: {
    coins: number;
    tonBalance: number;
  };
  coins?: number;
  newBalance?: number;
  message?: string;
  error?: string;
}

// 1. Cargar o crear usuario
export async function loadUserData(telegramId: string, username: string): Promise<ApiUserResponse> {
  try {
    const res = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, username }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error loading user data:', error);
    return { success: false, error: 'Error de conexión' };
  }
}

// 2. Comprar lechugas con TON
export async function purchaseLechugas(
  telegramId: string,
  username: string,
  purchaseAmount: number,
  purchasePrice: number,
  walletAddress: string,
  transactionHash: string
): Promise<ApiUserResponse> {
  try {
    const res = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId,
        username,
        action: 'purchase',
        purchaseAmount,
        purchasePrice,
        walletAddress,
        transactionHash,
      }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error purchasing:', error);
    return { success: false, error: 'Error de conexión' };
  }
}

// 3. Solicitar retiro de TON
export async function requestWithdraw(
  telegramId: string,
  username: string,
  withdrawAmount: number,
  walletAddress: string
): Promise<ApiUserResponse> {
  try {
    const res = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId,
        username,
        action: 'withdraw',
        withdrawAmount,
        walletAddress,
      }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error withdrawing:', error);
    return { success: false, error: 'Error de conexión' };
  }
}

// 4. Guardar resultado de apuesta y sincronizar balance
export async function saveBetResult(
  telegramId: string,
  username: string,
  sorteo: string,
  animalSelected: string,
  animalResult: string,
  betAmount: number,
  won: boolean,
  newBalance: number
): Promise<ApiUserResponse> {
  try {
    const res = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId,
        username,
        action: 'bet',
        sorteo,
        animalSelected,
        animalResult,
        betAmount,
        won,
        prize: won ? betAmount * 35 : 0,
        newBalance,
      }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error saving bet:', error);
    return { success: false, error: 'Error de conexión' };
  }
}
