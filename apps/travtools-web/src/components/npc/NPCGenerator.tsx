import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { rollD66 } from '../../lib/dice';
import {
  applyExperienceBonuses,
  generateCharacteristics,
  generateQuickCharacter,
} from '../../lib/quickCharGen';
import {
  ALLIES_ENEMIES,
  CHARACTER_QUIRKS,
  EXPERIENCE_LEVELS,
  ExperienceLevel,
  lookupD66,
} from '../../data/quickCharacters';
import { toHex, statDM } from '../../lib/traveller';

const STAT_KEYS = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'] as const;
const STAT_LABELS = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'];

const DEFAULT_WEAPONS = [
  { name: 'Unarmed', skill: 'Melee (Unarmed)', range: 'Melee', damage: '1D+STR DM', traits: '' },
];

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

export default function NPCGenerator() {
  const { client } = useSupabase();

  const initial = generateQuickCharacter();
  const [archetype, setArchetype] = useState(initial.archetype);
  const [quirk, setQuirk] = useState(initial.quirk);
  const [level, setLevel] = useState<ExperienceLevel>(initial.experienceLevel);
  const [stats, setStats] = useState<number[]>([
    initial.str, initial.dex, initial.end_stat, initial.int_stat, initial.edu, initial.soc,
  ]);
  const [name, setName] = useState(initial.archetype);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  function rerollAll() {
    const npc = generateQuickCharacter();
    setArchetype(npc.archetype);
    setQuirk(npc.quirk);
    setLevel(npc.experienceLevel);
    setStats([npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc]);
    setName(npc.archetype);
    setNameError(false);
    setSaveError(null);
    setSavedName(null);
  }

  function rerollArchetype() {
    const e = rollArchetype();
    setArchetype(e.archetype);
    setSavedName(null);
  }

  function rerollQuirk() {
    const e = rollQuirk();
    setQuirk(e.quirk);
    setSavedName(null);
  }

  function rerollLevel() {
    const l = rollLevel();
    setLevel(l);
    setStats(rollStats(l));
    setSavedName(null);
  }

  function rerollStats() {
    setStats(rollStats(level));
    setSavedName(null);
  }

  function handleLevelChange(id: string) {
    const l = EXPERIENCE_LEVELS.find(e => e.id === id) ?? level;
    setLevel(l);
    setStats(rollStats(l));
    setSavedName(null);
  }

  async function handleSave() {
    if (!name.trim()) { setNameError(true); return; }
    if (!client) return;
    setSaving(true);
    setSaveError(null);
    setSavedName(null);
    const [str, dex, end_stat, int_stat, edu, soc] = stats;
    const payload = {
      name: name.trim(),
      career: archetype,
      rank: level.label,
      notes: quirk,
      str, dex, end_stat, int_stat, edu, soc,
      skills: level.skills,
      weapons: DEFAULT_WEAPONS,
      psionic_talents: [],
      lifepath: [],
      armour: [],
      augments: [],
      personal_equipment: [],
      contacts: [],
      temp_mods: {},
      profile_details: {},
      homeworld_details: {},
      finances: {},
      background: {},
    };
    const { error } = await client.from('characters').insert(payload);
    setSaving(false);
    if (error) { setSaveError(`Could not save NPC: ${error.message}`); return; }
    setSavedName(name.trim());
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-steel pb-3">
          <span className="panel-header">QUICK CHARACTER GENERATOR</span>
          <button type="button" onClick={rerollAll}
            className="btn-steel flex items-center gap-1 text-xs">
            <RefreshCw size={12} /> REROLL ALL
          </button>
        </div>

        {/* Roll rows */}
        <div className="panel p-4 space-y-3">
          <div className="label mb-1">NPC PROFILE</div>

          <div className="flex items-center gap-3">
            <div className="label w-28 flex-shrink-0">ARCHETYPE</div>
            <div className="flex-1 text-xs font-mono text-bright truncate">{archetype}</div>
            <button type="button" onClick={rerollArchetype}
              className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
              <RefreshCw size={11} /> REROLL
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="label w-28 flex-shrink-0">QUIRK</div>
            <div className="flex-1 text-xs font-mono text-bright truncate">{quirk}</div>
            <button type="button" onClick={rerollQuirk}
              className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
              <RefreshCw size={11} /> REROLL
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="label w-28 flex-shrink-0">EXPERIENCE</div>
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

        {/* Characteristics */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="label">CHARACTERISTICS</div>
            <button type="button" onClick={rerollStats}
              className="btn-steel flex items-center gap-1 text-xs">
              <RefreshCw size={11} /> REROLL STATS
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {STAT_KEYS.map((key, i) => (
              <div key={key} className="text-center border border-steel/40 p-2">
                <div className="label text-[9px]">{STAT_LABELS[i]}</div>
                <div className="text-amber font-mono font-bold text-lg">{toHex(stats[i] ?? 7)}</div>
                <div className="text-body/55 text-[9px] font-mono">
                  {statDM(stats[i] ?? 7) >= 0 ? '+' : ''}{statDM(stats[i] ?? 7)}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="label mb-1.5">SKILLS</div>
            <div className="flex flex-wrap gap-1.5">
              {level.skills.map(s => (
                <span key={s.name}
                  className="border border-steel/50 px-2 py-0.5 text-xs font-mono text-cyan-trav">
                  {s.name} {s.level}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="panel p-4 space-y-3">
          <div className="label">SAVE TO ROSTER</div>
          <div className="space-y-1">
            <label className="label text-xs" htmlFor="npc-name">NAME</label>
            <input
              id="npc-name"
              className={`input ${nameError ? 'border-alert' : ''}`}
              value={name}
              onChange={e => { setName(e.target.value); setNameError(false); setSavedName(null); }}
              placeholder="Enter NPC name"
            />
            {nameError && (
              <div className="text-xs text-alert font-mono">Name is required</div>
            )}
          </div>

          {saveError && (
            <div role="alert" className="text-xs text-alert border border-alert/40 bg-alert/10 px-3 py-2 font-mono">
              {saveError}
            </div>
          )}
          {savedName && (
            <div className="text-xs text-safe border border-safe/40 bg-safe/10 px-3 py-2 font-mono">
              {savedName} saved to roster.
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-amber w-full disabled:opacity-50"
          >
            {saving ? 'SAVING…' : 'SAVE TO ROSTER'}
          </button>
        </div>

      </div>
    </div>
  );
}
