import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SupabaseProvider, useSupabase } from './lib/supabaseContext';
import SetupScreen from './components/SetupScreen';
import Shell from './components/layout/Shell';

const ShipViewer = lazy(() => import('./components/ships/ShipViewer'));
const TradeLedger = lazy(() => import('./components/trade/TradeLedger'));
const InventoryManager = lazy(() => import('./components/inventory/InventoryManager'));
const PartyRoster = lazy(() => import('./components/roster/PartyRoster'));
const RollLog = lazy(() => import('./components/log/RollLog'));

function AppRoutes() {
  const { isConfigured } = useSupabase();

  if (!isConfigured) return <SetupScreen />;

  return (
    <HashRouter>
      <Suspense fallback={<div className="p-4 text-xs text-amber tracking-widest">LOADING MODULE...</div>}>
        <Routes>
          <Route path="/" element={<Shell />}>
            <Route index element={<Navigate to="/ships" replace />} />
            <Route path="ships" element={<ShipViewer />} />
            <Route path="trade" element={<TradeLedger />} />
            <Route path="inventory" element={<InventoryManager />} />
            <Route path="roster" element={<PartyRoster />} />
            <Route path="log" element={<RollLog />} />
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
