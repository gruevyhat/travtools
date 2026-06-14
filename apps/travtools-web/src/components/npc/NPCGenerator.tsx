import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { rollD66, rollTravellerCheck } from '../../lib/dice';
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

interface RollResult {
  label: string;
  d1: number; d2: number;
  modifier: number;
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

async function execRoll(
  client: ReturnType<typeof useSupabase>['client'],
  charName: string,
  label: string,
  modifier: number,
  charDM: number,
  skillLevel: number,
): Promise<RollResult> {
  const result = rollTravellerCheck({ label, difficulty: 8, modifier, mode: 'normal' });
  if (client) {
    await client.from('roll_log').insert({
      character_name: charName,
      check_label: label,
      d1: result.rolls[0], d2: result.rolls[1],
      char_dm: charDM, skill_level: skillLevel, bonus_dm: 0,
      total: result.total, difficulty: 8,
      success: result.success, effect: result.effect,
    });
  }
  return {
    label,
    d1: result.rolls[0], d2: result.rolls[1],
    modifier,
    total: result.total,
    success: result.success,
  };
}

function RollBanner({ roll }: { roll: RollResult }) {
  const dm = roll.modifier;
  return (
    <div className={`flex items-center gap-2 px-2 py-0.5 text-[10px] font-mono border ${
      roll.success
        ? 'border-safe/40 bg-safe/10 text-safe'
        : 'border-alert/40 bg-alert/10 text-alert'
    }`}>
      <span className="text-body/50">{roll.label}</span>
      <span>[{roll.d1}+{roll.d2}]</span>
      {dm !== 0 && <span className="text-body/50">{dm > 0 ? '+' : ''}{dm}</span>}
      <span className="font-bold">= {roll.total}</span>
      <span className="ml-auto tracking-widest">{roll.success ? 'SUCCESS' : 'FAILURE'}</span>
    </div>
  );
}

// Compact stat cell — clickable to roll characteristic check
function StatCell({
  label, value, onClick,
}: { label: string; value: number; onClick: () => void }) {
  const dm = statDM(value);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Roll ${label} check`}
      className="text-center border border-steel/40 px-1.5 py-1 hover:border-amber hover:bg-amber/5 transition-colors min-w-[2.5rem]"
    >
      <div className="label text-[8px]">{label}</div>
      <div className="text-amber font-mono font-bold text-sm leading-none mt-0.5">{toHex(value)}</div>
      <div className="text-body/50 text-[8px] font-mono mt-0.5">{dm >= 0 ? '+' : ''}{dm}</div>
    </button>
  );
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
  const [genRoll, setGenRoll] = useState<RollResult | null>(null);

  // ── Saved NPCs ────────────────────────────────────────────────────────────
  const [npcs, setNpcs] = useState<SavedNPC[]>([]);
  const [npcRolls, setNpcRolls] = useState<Record<string, RollResult>>({});

  const loadNpcs = useCallback(async () => {
    if (!client) return;
    const { data } = await client
      .from('npcs').select('*').order('created_at', { ascending: false });
    if (data) setNpcs(data as SavedNPC[]);
  }, [client]);

  useEffect(() => { loadNpcs(); }, [loadNpcs]);

  useEffect(() => {
    if (!client) return;
    const sub = client
      .channel('npcs-realtime')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'npcs' },
        (payload) => setNpcs(prev => prev.filter(n => n.id !== payload.old.id)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'npcs' },
        (payload) => setNpcs(prev =>
          prev.some(n => n.id === payload.new.id) ? prev : [payload.new as SavedNPC, ...prev]))
      .subscribe();
    return () => { client.removeChannel(sub); };
  }, [client]);

  // ── Generator actions ─────────────────────────────────────────────────────
  function rerollAll() {
    const npc = generateQuickCharacter();
    setNpcName(npc.name); setRace(npc.race); setArchetype(npc.archetype);
    setQuirk(npc.quirk); setLevel(npc.experienceLevel);
    setStats([npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc]);
    setNameError(false); setSaveError(null); setSavedMsg(null); setGenRoll(null);
  }
  function rerollName() { setNpcName(randomName(race)); setSavedMsg(null); }
  function rerollRace() {
    const r = randomRace(); setRace(r); setNpcName(randomName(r)); setSavedMsg(null);
  }
  function rerollArchetype() { setArchetype(rollArchetype().archetype); setSavedMsg(null); }
  function rerollQuirk() { setQuirk(rollQuirk().quirk); setSavedMsg(null); }
  function rerollLevel() {
    const l = rollLevel(); setLevel(l); setStats(rollStats(l)); setSavedMsg(null); setGenRoll(null);
  }
  function rerollStats() { setStats(rollStats(level)); setSavedMsg(null); setGenRoll(null); }
  function handleLevelChange(id: string) {
    const l = EXPERIENCE_LEVELS.find(e => e.id === id) ?? level;
    setLevel(l); setStats(rollStats(l)); setSavedMsg(null); setGenRoll(null);
  }

  async function rollGenStat(i: number) {
    const dm = statDM(stats[i] ?? 7);
    const roll = await execRoll(client, npcName || 'NPC', `${STAT_LABELS[i]} Check`, dm, dm, 0);
    setGenRoll(roll);
  }

  async function rollGenSkill(s: { name: string; level: number }) {
    const charKey = skillChar(s.name) ?? 'int_stat';
    const dm = statDM(stats[STAT_IDX[charKey]] ?? 7);
    const roll = await execRoll(client, npcName || 'NPC', s.name, dm + s.level, dm, s.level);
    setGenRoll(roll);
  }

  // ── Save / Delete ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!npcName.trim()) { setNameError(true); return; }
    if (!client) return;
    setSaving(true); setSaveError(null); setSavedMsg(null);
    const { data, error } = await client.from('npcs').insert({
      name: npcName.trim(), race, archetype, quirk,
      experience_level: level.label,
      str: stats[0], dex: stats[1], end_stat: stats[2],
      int_stat: stats[3], edu: stats[4], soc: stats[5],
      skills: level.skills, notes: quirk,
    }).select().single();
    setSaving(false);
    if (error) { setSaveError(`Could not save: ${error.message}`); return; }
    if (data) setNpcs(prev => [data as SavedNPC, ...prev]);
    setSavedMsg(`${npcName.trim()} saved.`);
  }

  async function deleteNpc(id: string) {
    if (!client) return;
    setNpcs(prev => prev.filter(n => n.id !== id));
    await client.from('npcs').delete().eq('id', id);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-steel pb-3">
          <span className="label text-amber tracking-widest">QUICK CHARACTER GENERATOR</span>
          <button type="button" onClick={rerollAll}
            className="btn-steel flex items-center gap-1 text-xs">
            <RefreshCw size={12} /> REROLL ALL
          </button>
        </div>

        {/* Profile + Characteristics side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Profile */}
          <div className="panel p-4 space-y-2.5">
            <div className="label mb-1">NPC PROFILE</div>

            <div className="flex items-center gap-2">
              <div className="label w-24 flex-shrink-0">NAME</div>
              <input
                className={`input flex-1 text-xs ${nameError ? 'border-alert' : ''}`}
                value={npcName}
                onChange={e => { setNpcName(e.target.value); setNameError(false); setSavedMsg(null); }}
                placeholder="NPC name"
              />
              <button type="button" onClick={rerollName} className="btn-steel text-xs flex-shrink-0 px-2">
                <RefreshCw size={11} />
              </button>
            </div>
            {nameError && <div className="text-xs text-alert font-mono">Name is required</div>}

            <div className="flex items-center gap-2">
              <div className="label w-24 flex-shrink-0">RACE</div>
              <select aria-label="Race" className="select flex-1 text-xs" value={race}
                onChange={e => { setRace(e.target.value); setNpcName(randomName(e.target.value)); setSavedMsg(null); }}>
                {RACES.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
              </select>
              <button type="button" onClick={rerollRace} className="btn-steel text-xs flex-shrink-0 px-2">
                <RefreshCw size={11} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="label w-24 flex-shrink-0">ARCHETYPE</div>
              <div className="flex-1 text-xs font-mono text-bright truncate">{archetype}</div>
              <button type="button" onClick={rerollArchetype} className="btn-steel text-xs flex-shrink-0 px-2">
                <RefreshCw size={11} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="label w-24 flex-shrink-0">QUIRK</div>
              <div className="flex-1 text-xs font-mono text-bright truncate">{quirk}</div>
              <button type="button" onClick={rerollQuirk} className="btn-steel text-xs flex-shrink-0 px-2">
                <RefreshCw size={11} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="label w-24 flex-shrink-0">EXPERIENCE</div>
              <select aria-label="Experience level" className="select flex-1 text-xs" value={level.id}
                onChange={e => handleLevelChange(e.target.value)}>
                {EXPERIENCE_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <button type="button" onClick={rerollLevel} className="btn-steel text-xs flex-shrink-0 px-2">
                <RefreshCw size={11} />
              </button>
            </div>

            <div className="pt-2 space-y-2">
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
              <button type="button" onClick={handleSave} disabled={saving}
                className="btn-amber w-full disabled:opacity-50 text-xs">
                {saving ? 'SAVING…' : 'SAVE NPC'}
              </button>
            </div>
          </div>

          {/* Characteristics + Skills */}
          <div className="panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="label">CHARACTERISTICS <span className="text-body/40 font-normal normal-case tracking-normal">— click to roll</span></div>
              <button type="button" onClick={rerollStats} className="btn-steel flex items-center gap-1 text-xs">
                <RefreshCw size={11} /> REROLL
              </button>
            </div>

            <div className="flex gap-1.5">
              {STAT_KEYS.map((key, i) => (
                <StatCell
                  key={key}
                  label={STAT_LABELS[i]}
                  value={stats[i] ?? 7}
                  onClick={() => rollGenStat(i)}
                />
              ))}
            </div>

            <div>
              <div className="label mb-1.5 text-[10px]">
                SKILLS <span className="text-body/40 font-normal normal-case tracking-normal">— click to roll</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {level.skills.map(s => (
                  <button key={s.name} type="button" onClick={() => rollGenSkill(s)}
                    className="border border-steel/50 px-2 py-0.5 text-xs font-mono text-cyan-trav hover:border-amber hover:text-amber transition-colors">
                    {s.name} {s.level}
                  </button>
                ))}
              </div>
            </div>

            {genRoll && <RollBanner roll={genRoll} />}
          </div>
        </div>

        {/* Saved NPCs */}
        <div className="space-y-2">
          <div className="label border-b border-steel pb-2">
            SAVED NPCS
            <span className="text-body/40 font-normal normal-case tracking-normal ml-2">
              {npcs.length} record{npcs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {npcs.length === 0 && (
            <div className="text-xs text-body/45 font-mono py-6 text-center">No NPCs saved yet.</div>
          )}

          {npcs.map(npc => {
            const npcStats = [npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc];
            const skills = Array.isArray(npc.skills) ? npc.skills as { name: string; level: number }[] : [];
            const roll = npcRolls[npc.id];

            return (
              <div key={npc.id} className="border border-steel/40 bg-panel">
                {/* Single ribbon row */}
                <div className="flex items-center gap-3 px-3 py-1.5 flex-wrap">

                  {/* Name + meta */}
                  <div className="flex-shrink-0 min-w-[10rem]">
                    <div className="font-mono text-bright font-bold text-xs leading-tight">{npc.name}</div>
                    <div className="text-body/45 text-[9px] font-mono leading-tight">
                      {npc.race}{npc.archetype ? ` · ${npc.archetype}` : ''}{npc.experience_level ? ` · ${npc.experience_level}` : ''}
                    </div>
                  </div>

                  {/* Stats — clickable */}
                  <div className="flex gap-1 flex-shrink-0">
                    {STAT_KEYS.map((key, i) => (
                      <button
                        key={key} type="button"
                        title={`Roll ${STAT_LABELS[i]} check`}
                        onClick={async () => {
                          const dm = statDM(npcStats[i] ?? 7);
                          const r = await execRoll(client, npc.name, `${STAT_LABELS[i]} Check`, dm, dm, 0);
                          setNpcRolls(prev => ({ ...prev, [npc.id]: r }));
                        }}
                        className="text-center border border-steel/30 px-1 py-0.5 hover:border-amber hover:bg-amber/5 transition-colors min-w-[1.75rem]"
                      >
                        <div className="label text-[7px] leading-none">{STAT_LABELS[i]}</div>
                        <div className="text-amber font-mono font-bold text-[11px] leading-none mt-0.5">{toHex(npcStats[i] ?? 7)}</div>
                      </button>
                    ))}
                  </div>

                  {/* Skills */}
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 flex-1">
                      {skills.map(s => (
                        <button key={s.name} type="button"
                          onClick={async () => {
                            const charKey = skillChar(s.name) ?? 'int_stat';
                            const dm = statDM(npcStats[STAT_IDX[charKey]] ?? 7);
                            const r = await execRoll(client, npc.name, s.name, dm + s.level, dm, s.level);
                            setNpcRolls(prev => ({ ...prev, [npc.id]: r }));
                          }}
                          className="border border-steel/40 px-1.5 py-0.5 text-[10px] font-mono text-cyan-trav hover:border-amber hover:text-amber transition-colors">
                          {s.name} {s.level}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quirk */}
                  {npc.quirk && (
                    <div className="text-[9px] font-mono text-body/40 italic flex-1 min-w-[6rem] truncate hidden md:block">
                      {npc.quirk}
                    </div>
                  )}

                  {/* Delete */}
                  <button type="button" aria-label={`Delete ${npc.name}`}
                    onClick={() => deleteNpc(npc.id)}
                    className="text-body/30 hover:text-alert transition-colors flex-shrink-0 ml-auto">
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Roll result — thin strip below ribbon */}
                {roll && (
                  <div className="border-t border-steel/30 px-3 py-0.5">
                    <RollBanner roll={roll} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
