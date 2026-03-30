import type { TelegramUser } from '../types';

interface HeaderProps {
  user: TelegramUser | null;
  balance: number;
}

export default function Header({ user, balance }: HeaderProps) {
  const initial = (user?.first_name || 'U').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-white/10 bg-[rgba(45,45,45,0.85)] px-4 py-3 backdrop-blur-xl">
      {/* Avatar */}
      <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#0088cc]/50 bg-gradient-to-br from-[#0088cc] to-[#005588]">
        {user?.photo_url ? (
          <img
            src={user.photo_url}
            alt="avatar"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <span className={`text-sm font-bold text-white ${user?.photo_url ? 'hidden' : ''}`}>
          {initial}
        </span>
      </div>

      {/* User info */}
      <div className="flex flex-col">
        <span className="text-sm font-bold text-white">
          {user?.first_name || 'Cargando...'}
        </span>
        <div className="mt-0.5 flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.2)] bg-black/40 px-2.5 py-0.5">
          <span className="text-xs">🥬</span>
          <span className="text-xs font-semibold text-[#4caf50]">
            {balance.toLocaleString()}
          </span>
        </div>
      </div>
    </header>
  );
}
