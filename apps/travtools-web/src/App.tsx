import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SupabaseProvider, useSupabase } from './lib/supabaseContext';
import SetupScreen from './components/SetupScreen';
import Shell from './components/layout/Shell';
import ShipViewer from './components/ships/ShipViewer';
import TradeLedger from './components/trade/TradeLedger';
import InventoryManager from './components/inventory/InventoryManager';
import PartyRoster from './components/roster/PartyRoster';

function AppRoutes() {
  const { isConfigured } = useSupabase();

  if (!isConfigured) return <SetupScreen />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<Navigate to="/ships" replace />} />
          <Route path="ships" element={<ShipViewer />} />
          <Route path="trade" element={<TradeLedger />} />
          <Route path="inventory" element={<InventoryManager />} />
          <Route path="roster" element={<PartyRoster />} />
        </Route>
      </Routes>
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
