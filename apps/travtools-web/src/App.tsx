import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { SupabaseProvider, useSupabase } from './lib/supabaseContext';
import { COMBAT_MODULE_DISABLED } from './lib/moduleFlags';
import SetupScreen from './components/SetupScreen';
import Shell from './components/layout/Shell';

const LandingPage = lazy(() => import('./components/home/LandingPage'));
const ShipViewer = lazy(() => import('./components/ships/ShipViewer'));
const TradeLedger = lazy(() => import('./components/trade/TradeLedger'));
const InventoryManager = lazy(() => import('./components/inventory/InventoryManager'));
const PartyRoster = lazy(() => import('./components/roster/PartyRoster'));
const RollLog = lazy(() => import('./components/log/RollLog'));
const CombatTracker = lazy(() => import('./components/combat/CombatTracker'));
const SessionJournal = lazy(() => import('./components/journal/SessionJournal'));

function CombatDisabled() {
  return (
    <div className="p-4 h-full overflow-auto">
      <div className="panel max-w-2xl p-5 space-y-3">
        <div className="label text-alert">COMBAT MODULE OFFLINE</div>
        <div className="font-display text-2xl text-bright tracking-wide">Combat disabled</div>
        <p className="text-sm text-body/75 leading-6">
          The combat tracker is temporarily unavailable. Roster, inventory, roll log, and global tools remain online.
        </p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isConfigured } = useSupabase();

  if (!isConfigured) return <SetupScreen />;

  return (
    <HashRouter>
      <Suspense fallback={<div className="p-4 text-xs text-amber tracking-widest">LOADING MODULE...</div>}>
        <Routes>
          <Route path="/" element={<Shell />}>
            <Route index element={<LandingPage />} />
            <Route path="ships" element={<ShipViewer />} />
            <Route path="trade" element={<TradeLedger />} />
            <Route path="inventory" element={<InventoryManager />} />
            <Route path="roster" element={<PartyRoster />} />
            <Route path="log" element={<RollLog />} />
            <Route path="combat" element={COMBAT_MODULE_DISABLED ? <CombatDisabled /> : <CombatTracker />} />
            <Route path="journal" element={<SessionJournal />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default function App() {
  return (
    <SupabaseProvider>
      <AppRoutes />
    </SupabaseProvider>
  );
}
