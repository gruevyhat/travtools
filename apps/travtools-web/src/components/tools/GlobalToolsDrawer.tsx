import { useState } from 'react';
import { BookOpen, Check, Dices, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { DIFFICULTIES, fmtDM, RollMode, rollTravellerCheck, TravellerRollResult } from '../../lib/dice';

interface GlobalToolsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalToolsDrawer({ open, onClose }: GlobalToolsDrawerProps) {
  const { client } = useSupabase();
  const [tab, setTab] = useState<'dice' | 'reference'>('dice');
  const [label, setLabel] = useState('Standalone');
  const [modifier, setModifier] = useState('0');
  const [difficulty, setDifficulty] = useState(8);
  const [mode, setMode] = useState<RollMode>('normal');
  const [logRoll, setLogRoll] = useState(true);
  const [result, setResult] = useState<TravellerRollResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  async function saveResult(nextResult: TravellerRollResult) {
    if (!client || !logRoll) return;
    const { error } = await client.from('roll_log').insert({
      character_name: 'Session',
      check_label: nextResult.label,
      d1: nextResult.kept[0],
      d2: nextResult.kept[1],
      char_dm: 0,
      skill_level: 0,
      bonus_dm: nextResult.modifier,
      total: nextResult.total,
      difficulty: nextResult.difficulty,
      success: nextResult.success,
      effect: nextResult.effect,
    });
    if (error) setErrorMessage(`Roll could not be logged: ${error.message}`);
    else setSaved(true);
  }

  function roll() {
    const parsedModifier = parseInt(modifier, 10);
    const nextResult = rollTravellerCheck({
      label,
      difficulty,
      modifier: Number.isNaN(parsedModifier) ? 0 : parsedModifier,
      mode,
    });
    setResult(nextResult);
    setSaved(false);
    setErrorMessage(null);
    saveResult(nextResult);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55">
      <button type="button" aria-label="Close global tools backdrop" className="flex-1 cursor-default" onClick={onClose} />
      <aside className="h-full w-full max-w-md border-l border-steel bg-panel shadow-2xl flex flex-col">
        <div className="panel-header flex items-center justify-between border-b border-steel">
          <span>SESSION TOOLS</span>
          <button type="button" aria-label="Close session tools" onClick={onClose} className="text-body hover:text-amber">
            <X size={14} />
          </button>
        </div>

        {errorMessage && (
          <div role="alert" className="border-b border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss tools error">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex border-b border-steel">
          {[
            { id: 'dice' as const, label: 'DICE', Icon: Dices },
            { id: 'reference' as const, label: 'REFERENCE', Icon: BookOpen },
          ].map(({ id, label: tabLabel, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 px-3 py-2 text-xs font-mono tracking-widest flex items-center justify-center gap-2 ${
                tab === id ? 'text-amber border-b-2 border-amber' : 'text-body hover:text-bright'
              }`}
            >
              <Icon size={13} />
              {tabLabel}
            </button>
          ))}
        </div>

        {tab === 'dice' ? (
          <div className="p-4 space-y-4 overflow-auto">
            <label className="block space-y-1">
              <span className="label">CHECK LABEL</span>
              <input className="input" value={label} onChange={e => setLabel(e.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="label">MODIFIER</span>
                <input
                  aria-label="Standalone Modifier"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={modifier}
                  onChange={e => setModifier(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="label">DIFFICULTY</span>
                <select className="select" value={difficulty} onChange={e => setDifficulty(parseInt(e.target.value, 10))}>
                  {DIFFICULTIES.map(d => (
                    <option key={d.target} value={d.target}>{d.label} {d.target}+</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {(['normal', 'boon', 'bane'] as RollMode[]).map(nextMode => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => setMode(nextMode)}
                  className={`btn text-xs ${mode === nextMode ? 'btn-amber' : 'btn-steel'}`}
                >
                  {nextMode.toUpperCase()}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-body">
              <input type="checkbox" checked={logRoll} onChange={e => setLogRoll(e.target.checked)} />
              <span>Log to Roll Log</span>
            </label>

            <button type="button" onClick={roll} className="btn-amber w-full text-center">
              ROLL 2D6
            </button>

            {result && (
              <div className="panel p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-amber font-mono text-sm">{result.label}</div>
                    <div className="text-xs text-body/60">{result.mode.toUpperCase()} · {result.difficulty}+</div>
                  </div>
                  <div className={`h-14 w-14 border-2 flex items-center justify-center text-xl font-mono font-bold ${
                    result.success ? 'border-safe text-safe' : 'border-alert text-alert'
                  }`}>
                    {result.total}
                  </div>
                </div>
                <div className="text-xs font-mono text-body/80">
                  [{result.kept.join(']+[')}] {fmtDM(result.modifier)} = {result.total}
                  {result.discarded !== null && <span className="text-body/45"> · discarded {result.discarded}</span>}
                </div>
                <div className={`text-xs font-mono tracking-wider ${result.success ? 'text-safe' : 'text-alert'}`}>
                  {result.success ? 'SUCCESS' : 'FAILURE'} · Effect {fmtDM(result.effect)}
                </div>
                {saved && (
                  <div className="text-xs text-safe flex items-center gap-1">
                    <Check size={12} /> Logged to Roll Log
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4 overflow-auto">
            <section className="panel p-3">
              <div className="label mb-2">DIFFICULTIES</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {DIFFICULTIES.map(d => (
                  <div key={d.target} className="flex justify-between border-b border-steel/50 pb-1">
                    <span className="text-body">{d.label}</span>
                    <span className="text-amber font-mono">{d.target}+</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel p-3 space-y-2 text-xs text-body/75">
              <div className="label">TASK CHAIN</div>
              <div>Previous Effect -6 or less: DM-3</div>
              <div>Previous Effect -2 to -5: DM-2</div>
              <div>Previous Effect -1 to +1: DM+0</div>
              <div>Previous Effect +2 to +5: DM+1</div>
              <div>Previous Effect +6 or more: DM+2</div>
            </section>

            <section className="panel p-3 space-y-2 text-xs text-body/75">
              <div className="label">BOON / BANE</div>
              <div>Boon: roll 3D6 and keep the best two dice.</div>
              <div>Bane: roll 3D6 and keep the worst two dice.</div>
            </section>

          </div>
        )}
      </aside>
    </div>
  );
}
