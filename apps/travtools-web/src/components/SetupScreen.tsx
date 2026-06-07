import React, { useState } from 'react';
import { useSupabase } from '../lib/supabaseContext';
import FanNotice from './legal/FanNotice';

export default function SetupScreen() {
  const { configure } = useSupabase();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.startsWith('https://') || !key) {
      setError('Enter a valid Supabase project URL and anon key.');
      return;
    }
    configure(url.trim(), key.trim());
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6 scanlines">
      <div className="w-full max-w-lg panel">
        <div className="panel-header">◈ TRAVTOOLS — INITIAL CONFIGURATION</div>
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="text-amber text-2xl font-display font-bold tracking-widest glow-amber">
              TRAVTOOLS
            </div>
            <div className="text-body text-xs tracking-wider">
              TRAVELLER RPG COMPANION — THIRD IMPERIUM EDITION
            </div>
          </div>

          <div className="border border-steel/50 p-4 text-xs space-y-2 text-body">
            <div className="text-amber tracking-wider mb-2">SETUP REQUIRED</div>
            <p>
              This app requires a Supabase project for shared group sync. Create a free project at{' '}
              <span className="text-cyan-trav">supabase.com</span>, then run the schema from{' '}
              <span className="text-amber font-mono">supabase/schema.sql</span> in the SQL editor.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="label">Supabase Project URL</label>
              <input
                className="input"
                type="url"
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="label">Anon / Public Key</label>
              <input
                className="input"
                type="text"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={e => setKey(e.target.value)}
                required
              />
              <div className="text-body/70 text-xs mt-1">
                Found in Project Settings → API → Project API keys
              </div>
            </div>

            {error && (
              <div className="text-alert text-xs border border-alert/30 px-3 py-2">{error}</div>
            )}

            <button type="submit" className="btn-amber w-full py-2 text-center">
              CONNECT ▸
            </button>
          </form>

          <div className="text-body/65 text-xs text-center">
            Credentials stored in browser localStorage. Not sent to any third party.
          </div>

          <div className="border-t border-steel/40 pt-3 text-center">
            <FanNotice compact />
          </div>
        </div>
      </div>
    </div>
  );
}
