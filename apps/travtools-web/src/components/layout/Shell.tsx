import { Suspense, lazy, useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { BookOpen, Dices, Ship, Swords, TrendingUp, Package, Users, ScrollText, UserPlus, Wifi, WifiOff, Settings } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { COMBAT_MODULE_DISABLED } from '../../lib/moduleFlags';
import FanNotice from '../legal/FanNotice';

const GlobalToolsDrawer = lazy(() => import('../tools/GlobalToolsDrawer'));

const IMPERIAL_OFFSET = 1_000_000; // rough offset to 57th century Imperial years
function imperialDate() {
  const now = new Date();
  const doy = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return `${now.getFullYear() + IMPERIAL_OFFSET - 2820}-${String(doy).padStart(3, '0')}`;
}

const NAV_ITEMS = [
  { to: '/roster', label: 'ROSTER', Icon: Users },
  { to: '/npc', label: 'NPCS', Icon: UserPlus },
  { to: '/ships', label: 'SHIPS', Icon: Ship },
  { to: '/trade', label: 'TRADE', Icon: TrendingUp },
  { to: '/inventory', label: 'INVENTORY', Icon: Package },
  { to: '/log', label: 'ROLL LOG', Icon: ScrollText },
  { to: '/combat', label: 'COMBAT', Icon: Swords, disabled: COMBAT_MODULE_DISABLED },
  { to: '/journal', label: 'JOURNAL', Icon: BookOpen },
];

export default function Shell() {
  const { isConfigured, reset } = useSupabase();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-void scanlines">
      {/* Top nav */}
      <header className="border-b border-steel bg-panel flex-shrink-0">
        <div className="flex flex-wrap items-center min-h-14 px-3 md:px-4 py-2 md:py-0 gap-3 md:gap-6">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 select-none group">
            <Ship size={18} className="text-amber" />
            <span className="text-amber font-display font-bold text-base md:text-lg tracking-[0.2em] glow-amber">
              TRAVTOOLS
            </span>
          </Link>

          {/* Module tabs */}
          <nav className="order-3 md:order-none flex items-stretch h-10 md:h-14 gap-1 flex-1 w-full md:w-auto overflow-x-auto">
            {NAV_ITEMS.map(({ to, label, Icon, disabled }) => (
              disabled ? (
                <span
                  key={to}
                  aria-disabled="true"
                  title="Combat module disabled"
                  className="flex items-center gap-2 px-3 md:px-4 text-xs tracking-widest font-mono border-b-2 border-transparent text-body/35 whitespace-nowrap cursor-not-allowed"
                >
                  <Icon size={13} />
                  {label}
                </span>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 md:px-4 text-xs tracking-widest font-mono border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-amber text-amber'
                        : 'border-transparent text-body hover:text-bright hover:border-steel'
                    }`
                  }
                >
                  <Icon size={13} />
                  {label}
                </NavLink>
              )
            ))}
          </nav>

          {/* Status bar */}
          <div className="ml-auto flex items-center gap-2 md:gap-4 text-xs font-mono">
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className="btn-steel flex items-center gap-1 text-xs py-1"
            >
              <Dices size={13} />
              TOOLS
            </button>
            <span className="text-steel tracking-widest hidden md:block">
              IMP DATE: {imperialDate()}
            </span>
            <div className="flex items-center gap-1.5">
              {!online ? (
                <>
                  <WifiOff size={13} className="text-amber" />
                  <span className="text-amber">RECONNECTING</span>
                </>
              ) : isConfigured ? (
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

      <footer className="border-t border-steel/40 bg-panel/70 flex-shrink-0">
        <FanNotice />
      </footer>

      {toolsOpen && (
        <Suspense fallback={<div className="fixed right-4 bottom-4 z-50 border border-amber/50 bg-panel px-3 py-2 text-xs font-mono tracking-widest text-amber">LOADING TOOLS...</div>}>
          <GlobalToolsDrawer open={toolsOpen} onClose={() => setToolsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
