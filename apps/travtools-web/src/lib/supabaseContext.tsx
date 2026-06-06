import React, { createContext, useContext, useState, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseContextType {
  client: SupabaseClient | null;
  isConfigured: boolean;
  configure: (url: string, key: string) => void;
  reset: () => void;
}

const SupabaseContext = createContext<SupabaseContextType>({
  client: null,
  isConfigured: false,
  configure: () => {},
  reset: () => {},
});

function buildClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  return createClient(url, key);
}

function getStoredConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('tt_sb_url') || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('tt_sb_key') || '';
  return { url, key };
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(() => {
    const { url, key } = getStoredConfig();
    return buildClient(url, key);
  });

  const configure = useCallback((url: string, key: string) => {
    localStorage.setItem('tt_sb_url', url);
    localStorage.setItem('tt_sb_key', key);
    setClient(buildClient(url, key));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem('tt_sb_url');
    localStorage.removeItem('tt_sb_key');
    setClient(null);
  }, []);

  return (
    <SupabaseContext.Provider value={{ client, isConfigured: !!client, configure, reset }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => useContext(SupabaseContext);
