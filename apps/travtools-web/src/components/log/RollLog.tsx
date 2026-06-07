import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '../../lib/supabaseContext';
import { RollLogEntry } from '../../types';

function fmtDM(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function RollLog() {
  const { client } = useSupabase();
  const [entries, setEntries] = useState<RollLogEntry[]>([]);

  const load = useCallback(async () => {
    if (!client) return;
    const { data } = await client
      .from('roll_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setEntries(data as RollLogEntry[]);
  }, [client]);

  useEffect(() => {
    load();
    if (!client) return;
    const channel = client
      .channel('roll-log-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roll_log' }, load)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, load]);

  return (
    <div className="p-4 h-full overflow-auto space-y-3">
      <div className="text-body text-xs tracking-wider">
        {entries.length} ROLL{entries.length !== 1 ? 'S' : ''} RECORDED
      </div>

      {entries.length === 0 && (
        <div className="text-center py-16 text-body/40 text-sm space-y-2">
          <div className="text-4xl opacity-20">⚄</div>
          <div>No rolls yet. Make a skill or attribute check from the Roster.</div>
        </div>
      )}

      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="panel px-4 py-3 flex items-start gap-4">
            {/* Total */}
            <div className={`flex-shrink-0 w-12 h-12 border-2 flex items-center justify-center font-mono font-bold text-xl
              ${e.success ? 'border-safe text-safe' : 'border-alert text-alert'}`}>
              {e.total}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-amber font-mono text-sm font-bold">{e.character_name}</span>
                <span className="text-bright text-sm">{e.check_label} CHECK</span>
                <span className={`text-xs font-mono tracking-wider ${e.success ? 'text-safe' : 'text-alert'}`}>
                  {e.success ? '✓ SUCCESS' : '✗ FAILURE'}
                </span>
              </div>

              <div className="text-xs text-body/70 mt-0.5 font-mono">
                [{e.d1}]+[{e.d2}]
                {e.char_dm !== 0 && ` ${fmtDM(e.char_dm)} (char)`}
                {e.skill_level !== 0 && ` ${fmtDM(e.skill_level)} (skill)`}
                {(e.bonus_dm ?? 0) !== 0 && ` ${fmtDM(e.bonus_dm ?? 0)} (ad hoc)`}
                {' '}= {e.total} vs {e.difficulty}+
                {' '}· Effect {fmtDM(e.effect)}
              </div>
            </div>

            {/* Time */}
            <div className="flex-shrink-0 text-xs text-body/40 font-mono">
              {relTime(e.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
