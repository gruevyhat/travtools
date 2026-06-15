import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Trash2, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { RollLogEntry } from '../../types';
import { fmtDM } from '../../lib/dice';
import { rollAnalytics } from '../../lib/rollAnalytics';

const PAGE_SIZE = 100;

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function RollLog() {
  const { client, canEdit } = useSupabase();
  const [entries, setEntries] = useState<RollLogEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [charFilter, setCharFilter] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client
      .from('roll_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit + 1);
    if (error) {
      setErrorMessage(`Roll log could not be loaded: ${error.message}`);
      return;
    }
    if (data) {
      setHasMore(data.length > limit);
      setEntries(data.slice(0, limit) as RollLogEntry[]);
    }
  }, [client, limit]);

  useEffect(() => {
    load();
    if (!client) return;
    const channel = client
      .channel('roll-log-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roll_log' }, load)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, load]);

  async function clearLog() {
    if (!client || entries.length === 0) return;
    setConfirmClear(false);
    const previous = entries;
    setErrorMessage(null);
    setEntries([]);
    setLimit(PAGE_SIZE);

    const { error } = await client.from('roll_log').delete().not('id', 'is', null);
    if (error) {
      setEntries(previous);
      setErrorMessage(`Roll log could not be cleared: ${error.message}`);
      load();
    }
  }

  const characterNames = Array.from(new Set(entries.map(e => e.character_name))).sort();
  const filteredEntries = charFilter ? entries.filter(e => e.character_name === charFilter) : entries;
  const checkEntries = filteredEntries.filter(e => !e.check_label.endsWith(' Damage'));
  const analytics = rollAnalytics(checkEntries);

  return (
    <div className="p-4 h-full overflow-auto space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-body text-xs tracking-wider">
          {filteredEntries.length}{charFilter ? `/${entries.length}` : ''} ROLL{filteredEntries.length !== 1 ? 'S' : ''} RECORDED
        </div>

        {characterNames.length > 1 && (
          <div className="relative flex items-center">
            <select
              className="select text-xs pr-6"
              value={charFilter}
              onChange={e => setCharFilter(e.target.value)}
              aria-label="Filter by character"
            >
              <option value="">ALL CREW</option>
              {characterNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1.5 text-body/70" />
          </div>
        )}

        <div className="flex-1" />

        {canEdit && (confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-alert font-mono">
              Clear {entries.length} roll{entries.length !== 1 ? 's' : ''}?
            </span>
            <button type="button" onClick={clearLog} className="btn-danger text-xs">
              CONFIRM
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className="btn-steel text-xs">
              CANCEL
            </button>
          </div>
        ) : entries.length > 0 && (
          <button type="button" onClick={() => setConfirmClear(true)} className="btn-danger flex items-center gap-1">
            <Trash2 size={13} /> CLEAR LOG
          </button>
        ))}
      </div>

      {errorMessage && (
        <div role="alert" className="border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss roll log error" className="hover:text-bright">
            <X size={12} />
          </button>
        </div>
      )}

      {filteredEntries.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'SUCCESS RATE', value: `${analytics.successRate}%`, color: analytics.successRate >= 50 ? 'text-safe' : 'text-alert' },
            { label: 'AVG EFFECT', value: fmtDM(Math.round(analytics.averageEffect * 10) / 10), color: analytics.averageEffect >= 0 ? 'text-safe' : 'text-alert' },
            { label: 'BEST EFFECT', value: analytics.best ? fmtDM(analytics.best.effect) : '--', color: 'text-cyan-trav' },
            { label: 'FAILURES', value: String(analytics.failureCount), color: analytics.failureCount === 0 ? 'text-safe' : 'text-alert' },
          ].map(({ label, value, color }) => (
            <div key={label} className="panel p-3">
              <div className="label mb-1">{label}</div>
              <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {filteredEntries.length === 0 && (
        <div className="text-center py-16 text-body/65 text-sm space-y-2">
          <div className="text-4xl opacity-20">⚄</div>
          <div>{charFilter ? `No rolls recorded for ${charFilter}.` : 'No rolls yet. Make a skill or attribute check from the Roster.'}</div>
        </div>
      )}

      <div className="space-y-2">
        {filteredEntries.map(e => {
          const isDamage = e.check_label.endsWith(' Damage');
          return isDamage ? (
            <div key={e.id} className="panel px-4 py-3 flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 border-2 border-amber/60 flex items-center justify-center font-mono font-bold text-xl text-amber">
                {e.total}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-amber font-mono text-sm font-bold">{e.character_name}</span>
                  <span className="text-bright text-sm">{e.check_label}</span>
                  <span className="text-xs font-mono tracking-wider text-amber">⚔ DAMAGE</span>
                </div>

                <div className="text-xs text-body/70 mt-0.5 font-mono">
                  [{e.d1}]{e.d2 !== 0 ? `+[${e.d2}]` : ''}
                  {e.char_dm !== 0 && ` ${fmtDM(e.char_dm)} (STR)`}
                  {e.skill_level !== 0 && ` ${fmtDM(e.skill_level)} (attack effect)`}
                  {(e.bonus_dm ?? 0) !== 0 && ` ${fmtDM(e.bonus_dm ?? 0)} (bonus)`}
                  {' '}= {e.total} pts
                </div>
              </div>

              <div className="flex-shrink-0 text-xs text-body/65 font-mono">
                {relTime(e.created_at)}
              </div>
            </div>
          ) : (
            <div key={e.id} className="panel px-4 py-3 flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 border-2 flex items-center justify-center font-mono font-bold text-xl
                ${e.success ? 'border-safe text-safe' : 'border-alert text-alert'}`}>
                {e.total}
              </div>

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

              <div className="flex-shrink-0 text-xs text-body/65 font-mono">
                {relTime(e.created_at)}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && !charFilter && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setLimit(prev => prev + PAGE_SIZE)}
            className="btn-steel text-xs"
          >
            LOAD MORE
          </button>
        </div>
      )}
    </div>
  );
}
