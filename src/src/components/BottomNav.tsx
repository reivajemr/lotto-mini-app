import type { Section } from '../types';

interface BottomNavProps {
  active: Section;
  onNavigate: (section: Section) => void;
}

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'lobby', label: 'Lobby', icon: '🎰' },
  { id: 'tareas', label: 'Tareas', icon: '📋' },
  { id: 'wallet', label: 'Wallet', icon: '💰' },
  { id: 'amigos', label: 'Amigos', icon: '👥' },
];

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[#333] bg-[#1c1c1c] safe-bottom">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
            active === item.id
              ? 'text-[#0088cc] font-bold'
              : 'text-[#888] hover:text-[#aaa]'
          }`}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="text-[11px]">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
