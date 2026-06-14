import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { RollMode, fmtDM, DIFFICULTIES } from '../../lib/dice';
import { CharStat, STAT_LABELS, statDM, toHex } from '../../lib/traveller';
import { useSupabase } from '../../lib/supabaseContext';
import NumberStepper from './NumberStepper';

export interface NpcRollTarget {
  label: string;
  skillLevel: number;
  charKey: CharStat | null;
}

interface Props {
  npcName: string;
  statValues: Partial<Record<CharStat, number | null>>;
  target: NpcRollTarget;
  onClose: () => void;
}

const CORE_STATS: CharStat[] = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'];

function parseBonus(raw: string): number {
  const v = parseInt(raw.trim(), 10);
  return isNaN(v) ? 0 : v;
}

function successChance(difficulty: number, modifier: number): number {
  const target = difficulty - modifier;
  let hits = 0;
  for (let d1 = 1; d1 <= 6; d1++)
    for (let d2 = 1; d2 <= 6; d2++)
      if (d1 + d2 >= target) hits++;
  return hits / 36;
}

interface RollResult {
  d1: number; d2: number; discarded: number | null;
  mode: RollMode; charDM: number; skillLevel: number; bonusDM: number;
  total: number;
}

export default function NpcRollModal({ npcName, statValues, target, onClose }: Props) {
  const { client } = useSupabase();
  const [charKey, setCharKey] = useState<CharStat | null>(target.charKey);
  const [difficulty, setDifficulty] = useState(8);
  const [bonusInput, setBonusInput] = useState('');
  const [mode, setMode] = useState<RollMode>('normal');
  const [result, setResult] = useState<RollResult | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function statVal(key: CharStat): number | null {
    return statValues[key] ?? null;
  }

  const availableStats = CORE_STATS.filter(k => statVal(k) !== null);
  const charDM = charKey !== null ? statDM(statVal(charKey)) : 0;
  const skillLevel = target.skillLevel;
  const bonusDM = parseBonus(bonusInput);
  const totalModifier = charDM + skillLevel + bonusDM;
  const pct = Math.round(successChance(difficulty, totalModifier) * 100);

  function roll() {
    const d6 = () => Math.ceil(Math.random() * 6);
    const raw = mode === 'normal' ? [d6(), d6()] : [d6(), d6(), d6()];
    const sorted = [...raw].sort((a, b) => a - b);
    const kept = mode === 'boon' ? sorted.slice(1) : mode === 'bane' ? sorted.slice(0, 2) : raw;
    const discarded = mode === 'normal' ? null : mode === 'boon' ? sorted[0] : sorted[2];
    const [d1, d2] = kept;
    const total = d1 + d2 + totalModifier;
    const r: RollResult = { d1, d2, discarded, mode, charDM, skillLevel, bonusDM, total };
    setResult(r);
    setSaved(false);
    if (client) {
      client.from('roll_log').insert({
        character_name: npcName,
        check_label: target.label,
        d1, d2, char_dm: charDM, skill_level: skillLevel, bonus_dm: bonusDM,
        total, difficulty,
        success: total >= difficulty,
        effect: total - difficulty,
      }).then(() => setSaved(true));
    }
  }

  const success = result !== null && result.total >= difficulty;
  const effect = result !== null ? result.total - difficulty : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 panel border border-steel/80 shadow-2xl">
        <div className="panel-header flex items-center justify-between">
          <span className="truncate">{target.label} CHECK — {npcName}</span>
          <button onClick={onClose} className="text-body/70 hover:text-body ml-4 flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {/* Characteristic */}
            <div className="space-y-1">
              <label className="label">Characteristic</label>
              <select className="select text-xs" value={charKey ?? ''}
                onChange={e => setCharKey((e.target.value as CharStat) || null)}>
                <option value="">— none —</option>
                {availableStats.map(k => (
                  <option key={k} value={k}>
                    {STAT_LABELS[k]} {toHex(statVal(k))} ({fmtDM(statDM(statVal(k)))})
                  </option>
                ))}
              </select>
            </div>

            {/* Skill level */}
            <div className="space-y-1">
              <label className="label">Skill Level</label>
              <input className="input text-xs" readOnly
                value={skillLevel === 0 && target.charKey !== null && target.label === STAT_LABELS[target.charKey]
                  ? '—'
                  : String(skillLevel)}
              />
            </div>

            {/* Bonus DM */}
            <div className="space-y-1">
              <label className="label">Modifier</label>
              <NumberStepper
                ariaLabel="modifier"
                value={bonusInput}
                onChange={setBonusInput}
                placeholder="0"
                inputClassName="input text-xs"
              />
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-1">
            <div className="label">Difficulty</div>
            <div className="flex items-center gap-1 flex-wrap">
              {DIFFICULTIES.map(d => (
                <button key={d.target} onClick={() => setDifficulty(d.target)}
                  className={`px-2 py-0.5 border text-xs font-mono transition-colors ${
                    difficulty === d.target
                      ? 'border-amber text-amber'
                      : 'border-steel text-body hover:border-amber/60 hover:text-amber/60'
                  }`}>
                  {d.label} {d.target}+
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="text-xs text-body/70 font-mono">
            Char DM: <span className="text-cyan-trav">{fmtDM(charDM)}</span>
            {skillLevel !== 0 && <>{' · '}Skill: <span className="text-cyan-trav">{fmtDM(skillLevel)}</span></>}
            {' · '}Modifier: <span className="text-cyan-trav">{fmtDM(bonusDM)}</span>
            {' · '}<span className={pct >= 50 ? 'text-safe' : 'text-alert'}>{pct}% success</span>
          </div>

          {/* Roll mode */}
          <div className="grid grid-cols-3 gap-1">
            {(['normal', 'boon', 'bane'] as RollMode[]).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`btn text-xs ${mode === m ? 'btn-amber' : 'btn-steel'}`}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Roll button */}
          <button onClick={roll} className="btn-amber w-full text-center text-sm">
            ROLL {mode === 'normal' ? '2D6' : '3D6'}
          </button>

          {/* Result */}
          {result !== null && (
            <div className="border-t border-steel/60 pt-3 space-y-2">
              <div className="flex items-center gap-2 font-mono flex-wrap">
                <span className="inline-flex items-center justify-center w-9 h-9 border border-amber text-amber font-bold text-lg">{result.d1}</span>
                <span className="text-body">+</span>
                <span className="inline-flex items-center justify-center w-9 h-9 border border-amber text-amber font-bold text-lg">{result.d2}</span>
                {result.discarded !== null && (
                  <span className="text-body/40 text-xs line-through">({result.discarded})</span>
                )}
                {result.charDM !== 0 && (
                  <><span className="text-body">+</span>
                  <span className="text-cyan-trav text-xs">{charKey && STAT_LABELS[charKey]} {fmtDM(result.charDM)}</span></>
                )}
                {result.skillLevel !== 0 && (
                  <><span className="text-body">+</span>
                  <span className="text-cyan-trav text-xs">Skill {fmtDM(result.skillLevel)}</span></>
                )}
                {result.bonusDM !== 0 && (
                  <><span className="text-body">+</span>
                  <span className="text-cyan-trav text-xs">Mod {fmtDM(result.bonusDM)}</span></>
                )}
                <span className="text-body">=</span>
                <span className={`text-2xl font-bold ${success ? 'text-safe glow-cyan' : 'text-alert'}`}>{result.total}</span>
              </div>
              <div className={`text-sm font-mono tracking-wider ${success ? 'text-safe' : 'text-alert'}`}>
                {success ? '✓ SUCCESS' : '✗ FAILURE'}
                <span className="text-body/60 text-xs ml-2">vs {difficulty}+</span>
                <span className="text-bright text-xs ml-2">Effect {fmtDM(effect)}</span>
              </div>
              {saved && <div className="text-xs text-body/65">Logged to Roll Log</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
