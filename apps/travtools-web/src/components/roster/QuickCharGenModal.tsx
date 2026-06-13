import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { rollD66 } from '../../lib/dice';
import {
  applyExperienceBonuses,
  generateCharacteristics,
  generateQuickCharacter,
  GeneratedNPC,
} from '../../lib/quickCharGen';
import {
  ALLIES_ENEMIES,
  CHARACTER_QUIRKS,
  EXPERIENCE_LEVELS,
  ExperienceLevel,
  lookupD66,
} from '../../data/quickCharacters';
import { toHex, statDM } from '../../lib/traveller';

interface Props {
  onSave: (npc: GeneratedNPC & { name: string }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}

const STAT_KEYS = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'] as const;
const STAT_LABELS = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'];

function rollArchetype() {
  const { d66 } = rollD66();
  return lookupD66(ALLIES_ENEMIES, d66) ?? ALLIES_ENEMIES[0];
}

function rollQuirk() {
  const { d66 } = rollD66();
  return lookupD66(CHARACTER_QUIRKS, d66) ?? CHARACTER_QUIRKS[0];
}

function rollLevel(): ExperienceLevel {
  return EXPERIENCE_LEVELS[Math.floor(Math.random() * EXPERIENCE_LEVELS.length)];
}

function rollStats(level: ExperienceLevel): number[] {
  return applyExperienceBonuses(generateCharacteristics(), level.charBonuses);
}

export default function QuickCharGenModal({ onSave, onClose, saving, error }: Props) {
  const initial = generateQuickCharacter();
  const [archetype, setArchetype] = useState(initial.archetype);
  const [quirk, setQuirk] = useState(initial.quirk);
  const [level, setLevel] = useState<ExperienceLevel>(initial.experienceLevel);
  const [stats, setStats] = useState<number[]>([
    initial.str, initial.dex, initial.end_stat, initial.int_stat, initial.edu, initial.soc,
  ]);
  const [name, setName] = useState(initial.archetype);
  const [nameError, setNameError] = useState(false);

  function rerollAll() {
    const npc = generateQuickCharacter();
    setArchetype(npc.archetype);
    setQuirk(npc.quirk);
    setLevel(npc.experienceLevel);
    setStats([npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc]);
    setName(npc.archetype);
    setNameError(false);
  }

  function rerollArchetype() {
    const e = rollArchetype();
    setArchetype(e.archetype);
  }

  function rerollQuirk() {
    const e = rollQuirk();
    setQuirk(e.quirk);
  }

  function rerollLevel() {
    const l = rollLevel();
    setLevel(l);
    setStats(rollStats(l));
  }

  function rerollStats() {
    setStats(rollStats(level));
  }

  function handleLevelChange(id: string) {
    const l = EXPERIENCE_LEVELS.find(e => e.id === id) ?? level;
    setLevel(l);
    setStats(rollStats(l));
  }

  async function handleSave() {
    if (!name.trim()) { setNameError(true); return; }
    const [str, dex, end_stat, int_stat, edu, soc] = stats;
    await onSave({
      archetype,
      quirk,
      experienceLevel: level,
      str, dex, end_stat, int_stat, edu, soc,
      skills: level.skills,
      career: archetype,
      notes: quirk,
      name: name.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg border border-steel bg-panel shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="panel-header flex items-center justify-between border-b border-steel flex-shrink-0">
          <span>GENERATE NPC</span>
          <button type="button" aria-label="Close" onClick={onClose} className="text-body hover:text-amber">
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* ── Roll rows ─────────────────────────────── */}
          <div className="space-y-2">
            {/* Archetype */}
            <div className="flex items-center gap-3">
              <div className="label w-24 flex-shrink-0">ARCHETYPE</div>
              <div className="flex-1 text-xs font-mono text-bright truncate">{archetype}</div>
              <button type="button" onClick={rerollArchetype}
                className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
                <RefreshCw size={11} /> REROLL
              </button>
            </div>

            {/* Quirk */}
            <div className="flex items-center gap-3">
              <div className="label w-24 flex-shrink-0">QUIRK</div>
              <div className="flex-1 text-xs font-mono text-bright truncate">{quirk}</div>
              <button type="button" onClick={rerollQuirk}
                className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
                <RefreshCw size={11} /> REROLL
              </button>
            </div>

            {/* Experience Level */}
            <div className="flex items-center gap-3">
              <div className="label w-24 flex-shrink-0">EXPERIENCE</div>
              <select
                aria-label="Experience level"
                className="select flex-1 text-xs"
                value={level.id}
                onChange={e => handleLevelChange(e.target.value)}
              >
                {EXPERIENCE_LEVELS.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              <button type="button" onClick={rerollLevel}
                className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
                <RefreshCw size={11} /> REROLL
              </button>
            </div>
          </div>

          {/* ── Generated stats ───────────────────────── */}
          <div className="border-t border-steel/40 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="label">CHARACTERISTICS</div>
              <button type="button" onClick={rerollStats}
                className="btn-steel flex items-center gap-1 text-xs">
                <RefreshCw size={11} /> REROLL STATS
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {STAT_KEYS.map((key, i) => (
                <div key={key} className="text-center border border-steel/40 p-1.5">
                  <div className="label text-[9px]">{STAT_LABELS[i]}</div>
                  <div className="text-amber font-mono font-bold">{toHex(stats[i] ?? 7)}</div>
                  <div className="text-body/55 text-[9px] font-mono">{statDM(stats[i] ?? 7) >= 0 ? '+' : ''}{statDM(stats[i] ?? 7)}</div>
                </div>
              ))}
            </div>

            {/* Skills */}
            <div>
              <div className="label mb-1">SKILLS</div>
              <div className="flex flex-wrap gap-1">
                {level.skills.map(s => (
                  <span key={s.name} className="border border-steel/50 px-2 py-0.5 text-xs font-mono text-cyan-trav">
                    {s.name} {s.level}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Name ──────────────────────────────────── */}
          <div className="border-t border-steel/40 pt-3 space-y-1">
            <label className="label" htmlFor="npc-name">NAME</label>
            <input
              id="npc-name"
              className={`input ${nameError ? 'border-alert' : ''}`}
              value={name}
              onChange={e => { setName(e.target.value); setNameError(false); }}
              placeholder="Enter NPC name"
            />
            {nameError && (
              <div className="text-xs text-alert font-mono">Name is required</div>
            )}
          </div>

          {error && (
            <div role="alert" className="text-xs text-alert border border-alert/40 bg-alert/10 px-3 py-2 font-mono">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-steel flex-shrink-0">
          <button type="button" onClick={rerollAll} className="btn-steel flex items-center gap-1 text-xs">
            <RefreshCw size={12} /> REROLL ALL
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-amber flex-1 text-center disabled:opacity-50"
          >
            {saving ? 'SAVING…' : 'SAVE TO ROSTER'}
          </button>
        </div>
      </div>
    </div>
  );
}
