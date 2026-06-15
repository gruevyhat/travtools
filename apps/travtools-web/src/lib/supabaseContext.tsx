import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

interface SupabaseContextType {
  client: SupabaseClient | null;
  isConfigured: boolean;
  configure: (url: string, key: string) => void;
  reset: () => void;
  session: Session | null;
  user: User | null;
  canEdit: boolean;
  authReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType>({
  client: null,
  isConfigured: false,
  configure: () => {},
  reset: () => {},
  session: null,
  user: null,
  canEdit: false,
  authReady: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!client) {
      setSession(null);
      setUser(null);
      setCanEdit(false);
      setAuthReady(true);
      return;
    }

    let mounted = true;

    async function resolveCanEdit(activeSession: Session | null) {
      if (!activeSession) {
        if (mounted) setCanEdit(false);
        return;
      }
      const { data } = await client!.rpc('is_allowed_editor');
      if (mounted) setCanEdit(!!data);
    }

    client.auth.getSession().then(({ data: { session: initial } }) => {
      if (!mounted) return;
      setSession(initial);
      setUser(initial?.user ?? null);
      setAuthReady(true);
      resolveCanEdit(initial);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      setUser(next?.user ?? null);
      resolveCanEdit(next);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const configure = useCallback((url: string, key: string) => {
    localStorage.setItem('tt_sb_url', url);
    localStorage.setItem('tt_sb_key', key);
    setAuthReady(false);
    setClient(buildClient(url, key));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem('tt_sb_url');
    localStorage.removeItem('tt_sb_key');
    setSession(null);
    setUser(null);
    setCanEdit(false);
    setAuthReady(false);
    setClient(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!client) return;
    const redirectTo = window.location.origin + import.meta.env.BASE_URL;
    await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
  }, [client]);

  return (
    <SupabaseContext.Provider value={{
      client, isConfigured: !!client, configure, reset,
      session, user, canEdit, authReady, signInWithGoogle, signOut,
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => useContext(SupabaseContext);
