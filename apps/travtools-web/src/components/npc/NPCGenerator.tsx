import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { rollD66 } from '../../lib/dice';
import { rollTravellerCheck } from '../../lib/dice';
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
import { RACES, randomRace, randomName } from '../../data/npcNames';
import { toHex, statDM, skillChar } from '../../lib/traveller';

const STAT_KEYS = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'] as const;
const STAT_LABELS = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'];
const STAT_IDX: Record<string, number> = {
  str: 0, dex: 1, end_stat: 2, int_stat: 3, edu: 4, soc: 5,
};

interface SavedNPC {
  id: string;
  name: string;
  race: string;
  archetype: string | null;
  quirk: string | null;
  experience_level: string | null;
  str: number | null; dex: number | null; end_stat: number | null;
  int_stat: number | null; edu: number | null; soc: number | null;
  skills: { name: string; level: number }[];
  notes: string | null;
  created_at: string;
}

interface SkillRoll {
  skillName: string;
  d1: number;
  d2: number;
  charDM: number;
  total: number;
  success: boolean;
}

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

  // ── Generator state ───────────────────────────────────────────────────────
  const initial = generateQuickCharacter();
  const [npcName, setNpcName] = useState(initial.name);
  const [race, setRace] = useState(initial.race);
  const [archetype, setArchetype] = useState(initial.archetype);
  const [quirk, setQuirk] = useState(initial.quirk);
  const [level, setLevel] = useState<ExperienceLevel>(initial.experienceLevel);
  const [stats, setStats] = useState<number[]>([
    initial.str, initial.dex, initial.end_stat, initial.int_stat, initial.edu, initial.soc,
  ]);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // ── Skill roll state ──────────────────────────────────────────────────────
  const [lastRoll, setLastRoll] = useState<SkillRoll | null>(null);

  // ── Saved NPCs list ───────────────────────────────────────────────────────
  const [npcs, setNpcs] = useState<SavedNPC[]>([]);
  const [loadingNpcs, setLoadingNpcs] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadNpcs = useCallback(async () => {
    if (!client) return;
    const { data } = await client
      .from('npcs')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setNpcs(data as SavedNPC[]);
    setLoadingNpcs(false);
  }, [client]);

  useEffect(() => { loadNpcs(); }, [loadNpcs]);

  // Realtime subscription
  useEffect(() => {
    if (!client) return;
    const sub = client
      .channel('npcs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs' }, () => loadNpcs())
      .subscribe();
    return () => { client.removeChannel(sub); };
  }, [client, loadNpcs]);

  // ── Generator actions ─────────────────────────────────────────────────────
  function rerollAll() {
    const npc = generateQuickCharacter();
    setNpcName(npc.name);
    setRace(npc.race);
    setArchetype(npc.archetype);
    setQuirk(npc.quirk);
    setLevel(npc.experienceLevel);
    setStats([npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc]);
    setNameError(false);
    setSaveError(null);
    setSavedMsg(null);
    setLastRoll(null);
  }

  function rerollName() {
    setNpcName(randomName(race));
    setSavedMsg(null);
  }

  function rerollRace() {
    const r = randomRace();
    setRace(r);
    setNpcName(randomName(r));
    setSavedMsg(null);
  }

  function rerollArchetype() {
    setArchetype(rollArchetype().archetype);
    setSavedMsg(null);
  }

  function rerollQuirk() {
    setQuirk(rollQuirk().quirk);
    setSavedMsg(null);
  }

  function rerollLevel() {
    const l = rollLevel();
    setLevel(l);
    setStats(rollStats(l));
    setSavedMsg(null);
    setLastRoll(null);
  }

  function rerollStats() {
    setStats(rollStats(level));
    setSavedMsg(null);
    setLastRoll(null);
  }

  function handleLevelChange(id: string) {
    const l = EXPERIENCE_LEVELS.find(e => e.id === id) ?? level;
    setLevel(l);
    setStats(rollStats(l));
    setSavedMsg(null);
    setLastRoll(null);
  }

  // ── Skill roll ────────────────────────────────────────────────────────────
  async function rollSkill(skill: { name: string; level: number }) {
    const charKey = skillChar(skill.name) ?? 'int_stat';
    const charDM = statDM(stats[STAT_IDX[charKey]] ?? 7);
    const result = rollTravellerCheck({
      label: skill.name,
      difficulty: 8,
      modifier: charDM + skill.level,
      mode: 'normal',
    });
    setLastRoll({
      skillName: skill.name,
      d1: result.rolls[0],
      d2: result.rolls[1],
      charDM,
      total: result.total,
      success: result.success,
    });
    if (client) {
      await client.from('roll_log').insert({
        character_name: npcName || 'NPC',
        check_label: skill.name,
        d1: result.rolls[0],
        d2: result.rolls[1],
        char_dm: charDM,
        skill_level: skill.level,
        bonus_dm: 0,
        total: result.total,
        difficulty: 8,
        success: result.success,
        effect: result.effect,
      });
    }
  }

  // ── Save NPC ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!npcName.trim()) { setNameError(true); return; }
    if (!client) return;
    setSaving(true);
    setSaveError(null);
    setSavedMsg(null);
    const { error } = await client.from('npcs').insert({
      name: npcName.trim(),
      race,
      archetype,
      quirk,
      experience_level: level.label,
      str: stats[0], dex: stats[1], end_stat: stats[2],
      int_stat: stats[3], edu: stats[4], soc: stats[5],
      skills: level.skills,
      notes: quirk,
    });
    setSaving(false);
    if (error) { setSaveError(`Could not save: ${error.message}`); return; }
    setSavedMsg(`${npcName.trim()} saved.`);
  }

  // ── Delete NPC ────────────────────────────────────────────────────────────
  async function deleteNpc(id: string) {
    if (!client) return;
    await client.from('npcs').delete().eq('id', id);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Page header */}
        <div className="flex items-center justify-between border-b border-steel pb-3">
          <span className="label text-amber tracking-widest">QUICK CHARACTER GENERATOR</span>
          <button type="button" onClick={rerollAll}
            className="btn-steel flex items-center gap-1 text-xs">
            <RefreshCw size={12} /> REROLL ALL
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Left: generator ─────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Profile panel */}
            <div className="panel p-4 space-y-2.5">
              <div className="label mb-1">NPC PROFILE</div>

              {/* Name */}
              <div className="flex items-center gap-3">
                <div className="label w-28 flex-shrink-0">NAME</div>
                <input
                  className={`input flex-1 text-xs ${nameError ? 'border-alert' : ''}`}
                  value={npcName}
                  onChange={e => { setNpcName(e.target.value); setNameError(false); setSavedMsg(null); }}
                  placeholder="NPC name"
                />
                <button type="button" onClick={rerollName}
                  className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
                  <RefreshCw size={11} /> REROLL
                </button>
              </div>
              {nameError && <div className="text-xs text-alert font-mono pl-31">Name is required</div>}

              {/* Race */}
              <div className="flex items-center gap-3">
                <div className="label w-28 flex-shrink-0">RACE</div>
                <select
                  aria-label="Race"
                  className="select flex-1 text-xs"
                  value={race}
                  onChange={e => { setRace(e.target.value); setNpcName(randomName(e.target.value)); setSavedMsg(null); }}
                >
                  {RACES.map(r => (
                    <option key={r.label} value={r.label}>{r.label}</option>
                  ))}
                </select>
                <button type="button" onClick={rerollRace}
                  className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
                  <RefreshCw size={11} /> REROLL
                </button>
              </div>

              {/* Archetype */}
              <div className="flex items-center gap-3">
                <div className="label w-28 flex-shrink-0">ARCHETYPE</div>
                <div className="flex-1 text-xs font-mono text-bright truncate">{archetype}</div>
                <button type="button" onClick={rerollArchetype}
                  className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
                  <RefreshCw size={11} /> REROLL
                </button>
              </div>

              {/* Quirk */}
              <div className="flex items-center gap-3">
                <div className="label w-28 flex-shrink-0">QUIRK</div>
                <div className="flex-1 text-xs font-mono text-bright truncate">{quirk}</div>
                <button type="button" onClick={rerollQuirk}
                  className="btn-steel flex items-center gap-1 text-xs flex-shrink-0">
                  <RefreshCw size={11} /> REROLL
                </button>
              </div>

              {/* Experience */}
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

            {/* Characteristics + skills panel */}
            <div className="panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="label">CHARACTERISTICS</div>
                <button type="button" onClick={rerollStats}
                  className="btn-steel flex items-center gap-1 text-xs">
                  <RefreshCw size={11} /> REROLL STATS
                </button>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {STAT_KEYS.map((key, i) => (
                  <div key={key} className="text-center border border-steel/40 p-1.5">
                    <div className="label text-[9px]">{STAT_LABELS[i]}</div>
                    <div className="text-amber font-mono font-bold text-base">{toHex(stats[i] ?? 7)}</div>
                    <div className="text-body/55 text-[9px] font-mono">
                      {statDM(stats[i] ?? 7) >= 0 ? '+' : ''}{statDM(stats[i] ?? 7)}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="label mb-1.5">SKILLS <span className="text-body/40 font-normal normal-case tracking-normal">— click to roll</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {level.skills.map(s => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => rollSkill(s)}
                      className="border border-steel/50 px-2 py-0.5 text-xs font-mono text-cyan-trav hover:border-amber hover:text-amber transition-colors cursor-pointer"
                    >
                      {s.name} {s.level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill roll result */}
              {lastRoll && (
                <div className={`border px-3 py-2 text-xs font-mono flex items-center gap-3 ${
                  lastRoll.success
                    ? 'border-safe/40 bg-safe/10 text-safe'
                    : 'border-alert/40 bg-alert/10 text-alert'
                }`}>
                  <span className="text-body/60">{lastRoll.skillName}</span>
                  <span>[{lastRoll.d1}+{lastRoll.d2}]</span>
                  {lastRoll.charDM !== 0 && (
                    <span className="text-body/60">{lastRoll.charDM > 0 ? '+' : ''}{lastRoll.charDM} char</span>
                  )}
                  <span className="font-bold">=&nbsp;{lastRoll.total}</span>
                  <span className="ml-auto">{lastRoll.success ? 'SUCCESS' : 'FAILURE'}</span>
                </div>
              )}
            </div>

            {/* Save */}
            <div className="space-y-2">
              {saveError && (
                <div role="alert" className="text-xs text-alert border border-alert/40 bg-alert/10 px-3 py-2 font-mono">
                  {saveError}
                </div>
              )}
              {savedMsg && (
                <div className="text-xs text-safe border border-safe/40 bg-safe/10 px-3 py-2 font-mono">
                  {savedMsg}
                </div>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-amber w-full disabled:opacity-50"
              >
                {saving ? 'SAVING…' : 'SAVE NPC'}
              </button>
            </div>
          </div>

          {/* ── Right: saved NPCs ────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="label border-b border-steel pb-2">
              SAVED NPCS
              {!loadingNpcs && (
                <span className="text-body/40 font-normal normal-case tracking-normal ml-2">
                  {npcs.length} record{npcs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loadingNpcs && (
              <div className="text-xs text-body/55 font-mono py-4 text-center">LOADING...</div>
            )}

            {!loadingNpcs && npcs.length === 0 && (
              <div className="text-xs text-body/45 font-mono py-8 text-center">
                No NPCs saved yet.
              </div>
            )}

            <div className="space-y-2">
              {npcs.map(npc => {
                const expanded = expandedId === npc.id;
                const npcStats = [
                  npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc,
                ];
                const skills = Array.isArray(npc.skills) ? npc.skills as { name: string; level: number }[] : [];
                return (
                  <div key={npc.id} className="panel border border-steel/60">
                    {/* Summary row */}
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-steel/10 transition-colors"
                      onClick={() => setExpandedId(expanded ? null : npc.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-bright text-xs font-bold truncate">{npc.name}</div>
                        <div className="text-body/55 text-[10px] font-mono truncate">
                          {npc.race} · {npc.archetype} · {npc.experience_level}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-body/40 text-xs font-mono">{expanded ? '▲' : '▼'}</span>
                        <button
                          type="button"
                          aria-label={`Delete ${npc.name}`}
                          onClick={e => { e.stopPropagation(); deleteNpc(npc.id); }}
                          className="text-body/40 hover:text-alert transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="border-t border-steel/40 p-3 space-y-3">
                        {/* Stats */}
                        <div className="grid grid-cols-6 gap-1">
                          {STAT_KEYS.map((key, i) => (
                            <div key={key} className="text-center border border-steel/30 p-1">
                              <div className="label text-[8px]">{STAT_LABELS[i]}</div>
                              <div className="text-amber font-mono font-bold text-sm">
                                {toHex(npcStats[i] ?? 7)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Skills — rollable */}
                        {skills.length > 0 && (
                          <div>
                            <div className="label text-[9px] mb-1">SKILLS <span className="text-body/40 font-normal normal-case tracking-normal">— click to roll</span></div>
                            <div className="flex flex-wrap gap-1">
                              {skills.map(s => (
                                <button
                                  key={s.name}
                                  type="button"
                                  onClick={async () => {
                                    const charKey = skillChar(s.name) ?? 'int_stat';
                                    const charDM = statDM(npcStats[STAT_IDX[charKey]] ?? 7);
                                    const result = rollTravellerCheck({
                                      label: s.name,
                                      difficulty: 8,
                                      modifier: charDM + s.level,
                                      mode: 'normal',
                                    });
                                    if (client) {
                                      await client.from('roll_log').insert({
                                        character_name: npc.name,
                                        check_label: s.name,
                                        d1: result.rolls[0],
                                        d2: result.rolls[1],
                                        char_dm: charDM,
                                        skill_level: s.level,
                                        bonus_dm: 0,
                                        total: result.total,
                                        difficulty: 8,
                                        success: result.success,
                                        effect: result.effect,
                                      });
                                    }
                                    setLastRoll({
                                      skillName: `${npc.name} / ${s.name}`,
                                      d1: result.rolls[0],
                                      d2: result.rolls[1],
                                      charDM,
                                      total: result.total,
                                      success: result.success,
                                    });
                                    setExpandedId(npc.id);
                                  }}
                                  className="border border-steel/50 px-2 py-0.5 text-[10px] font-mono text-cyan-trav hover:border-amber hover:text-amber transition-colors"
                                >
                                  {s.name} {s.level}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Quirk */}
                        {npc.quirk && (
                          <div className="text-[10px] font-mono text-body/55 italic">{npc.quirk}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
