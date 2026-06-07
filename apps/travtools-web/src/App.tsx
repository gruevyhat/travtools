import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { SupabaseProvider, useSupabase } from './lib/supabaseContext';
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
            <Route path="combat" element={<CombatTracker />} />
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
