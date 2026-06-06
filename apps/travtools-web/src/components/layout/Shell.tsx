import { NavLink, Outlet } from 'react-router-dom';
import { Ship, TrendingUp, Package, Users, Wifi, WifiOff, Settings } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';

const IMPERIAL_OFFSET = 1_000_000; // rough offset to 57th century Imperial years
function imperialDate() {
  const now = new Date();
  const doy = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return `${now.getFullYear() + IMPERIAL_OFFSET - 2820}-${String(doy).padStart(3, '0')}`;
}

const NAV_ITEMS = [
  { to: '/ships', label: 'SHIPS', Icon: Ship },
  { to: '/trade', label: 'TRADE', Icon: TrendingUp },
  { to: '/inventory', label: 'INVENTORY', Icon: Package },
  { to: '/roster', label: 'ROSTER', Icon: Users },
];

export default function Shell() {
  const { isConfigured, reset } = useSupabase();

  return (
    <div className="h-full flex flex-col bg-void scanlines">
      {/* Top nav */}
      <header className="border-b border-steel bg-panel flex-shrink-0">
        <div className="flex items-center h-14 px-4 gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2 select-none">
            <Ship size={18} className="text-amber" />
            <span className="text-amber font-display font-bold text-lg tracking-[0.2em] glow-amber">
              TRAVTOOLS
            </span>
          </div>

          {/* Module tabs */}
          <nav className="flex items-stretch h-full gap-1 flex-1">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 text-xs tracking-widest font-mono border-b-2 transition-colors ${
                    isActive
                      ? 'border-amber text-amber'
                      : 'border-transparent text-body hover:text-bright hover:border-steel'
                  }`
                }
              >
                <Icon size={13} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Status bar */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-steel tracking-widest hidden md:block">
              IMP DATE: {imperialDate()}
            </span>
            <div className="flex items-center gap-1.5">
              {isConfigured ? (
                <>
                  <Wifi size={13} className="text-safe" />
                  <span className="text-safe">ONLINE</span>
                </>
              ) : (
                <>
                  <WifiOff size={13} className="text-alert" />
                  <span className="text-alert">OFFLINE</span>
                </>
              )}
            </div>
            {isConfigured && (
              <button
                onClick={reset}
                title="Disconnect"
                className="text-body hover:text-amber transition-colors"
              >
                <Settings size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
