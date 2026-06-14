import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
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
import { RACES, randomRace, randomName } from '../../data/npcNames';
import { toHex, statDM, skillChar, CharStat } from '../../lib/traveller';
import NpcRollModal, { NpcRollTarget } from '../shared/NpcRollModal';

const CORE_STAT_KEYS: CharStat[] = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'];
const CORE_STAT_LABELS = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'];

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

function npcStatValues(npc: SavedNPC): Partial<Record<CharStat, number | null>> {
  return {
    str: npc.str, dex: npc.dex, end_stat: npc.end_stat,
    int_stat: npc.int_stat, edu: npc.edu, soc: npc.soc,
  };
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

  // ── Roll modal ────────────────────────────────────────────────────────────
  const [rollModal, setRollModal] = useState<{
    npcName: string;
    statValues: Partial<Record<CharStat, number | null>>;
    target: NpcRollTarget;
  } | null>(null);

  // ── Saved NPCs ────────────────────────────────────────────────────────────
  const [npcs, setNpcs] = useState<SavedNPC[]>([]);

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
        (p) => setNpcs(prev => prev.filter(n => n.id !== p.old.id)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'npcs' },
        (p) => setNpcs(prev => prev.some(n => n.id === p.new.id) ? prev : [p.new as SavedNPC, ...prev]))
      .subscribe();
    return () => { client.removeChannel(sub); };
  }, [client]);

  // ── Generator actions ─────────────────────────────────────────────────────
  function rerollAll() {
    const npc = generateQuickCharacter();
    setNpcName(npc.name); setRace(npc.race); setArchetype(npc.archetype);
    setQuirk(npc.quirk); setLevel(npc.experienceLevel);
    setStats([npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc]);
    setNameError(false); setSaveError(null); setSavedMsg(null);
  }
  function rerollName() { setNpcName(randomName(race)); setSavedMsg(null); }
  function rerollRace() {
    const r = randomRace(); setRace(r); setNpcName(randomName(r)); setSavedMsg(null);
  }
  function rerollArchetype() { setArchetype(rollArchetype().archetype); setSavedMsg(null); }
  function rerollQuirk() { setQuirk(rollQuirk().quirk); setSavedMsg(null); }
  function rerollLevel() {
    const l = rollLevel(); setLevel(l); setStats(rollStats(l)); setSavedMsg(null);
  }
  function rerollStats() { setStats(rollStats(level)); setSavedMsg(null); }
  function handleLevelChange(id: string) {
    const l = EXPERIENCE_LEVELS.find(e => e.id === id) ?? level;
    setLevel(l); setStats(rollStats(l)); setSavedMsg(null);
  }

  // ── Roll helpers ──────────────────────────────────────────────────────────
  function openStatRoll(npcNameArg: string, statValues: Partial<Record<CharStat, number | null>>, statKey: CharStat, statLabel: string) {
    setRollModal({ npcName: npcNameArg, statValues, target: { label: statLabel, skillLevel: 0, charKey: statKey } });
  }

  function openSkillRoll(npcNameArg: string, statValues: Partial<Record<CharStat, number | null>>, skill: { name: string; level: number }) {
    const charKey = skillChar(skill.name) ?? 'int_stat';
    setRollModal({ npcName: npcNameArg, statValues, target: { label: skill.name, skillLevel: skill.level, charKey } });
  }

  // Generator stat values
  const genStatValues: Partial<Record<CharStat, number | null>> = {
    str: stats[0], dex: stats[1], end_stat: stats[2],
    int_stat: stats[3], edu: stats[4], soc: stats[5],
  };

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
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">

      {/* ── Left sidebar: generation controls ───────────────────────────── */}
      <div className="w-full lg:w-64 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-steel flex flex-col overflow-y-auto">
        <div className="p-3 space-y-3 flex-1">

          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="label text-amber tracking-widest text-[10px]">NPC GENERATOR</span>
            <button type="button" onClick={rerollAll}
              className="btn-steel flex items-center gap-1 text-[10px] px-2 py-1">
              <RefreshCw size={10} /> ALL
            </button>
          </div>

          {/* Profile fields */}
          <div className="space-y-1.5">
            {/* Name */}
            <div className="flex items-center gap-1.5">
              <div className="label w-20 flex-shrink-0 text-[9px]">NAME</div>
              <input
                className={`input flex-1 text-[10px] py-0.5 ${nameError ? 'border-alert' : ''}`}
                value={npcName}
                onChange={e => { setNpcName(e.target.value); setNameError(false); setSavedMsg(null); }}
                placeholder="NPC name"
              />
              <button type="button" onClick={rerollName} className="btn-steel px-1.5 py-0.5 flex-shrink-0">
                <RefreshCw size={9} />
              </button>
            </div>
            {nameError && <div className="text-[10px] text-alert font-mono">Name required</div>}

            {/* Race */}
            <div className="flex items-center gap-1.5">
              <div className="label w-20 flex-shrink-0 text-[9px]">RACE</div>
              <select className="select flex-1 text-[10px] py-0.5" value={race}
                onChange={e => { setRace(e.target.value); setNpcName(randomName(e.target.value)); setSavedMsg(null); }}>
                {RACES.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
              </select>
              <button type="button" onClick={rerollRace} className="btn-steel px-1.5 py-0.5 flex-shrink-0">
                <RefreshCw size={9} />
              </button>
            </div>

            {/* Archetype */}
            <div className="flex items-center gap-1.5">
              <div className="label w-20 flex-shrink-0 text-[9px]">ARCHETYPE</div>
              <div className="flex-1 text-[10px] font-mono text-bright truncate">{archetype}</div>
              <button type="button" onClick={rerollArchetype} className="btn-steel px-1.5 py-0.5 flex-shrink-0">
                <RefreshCw size={9} />
              </button>
            </div>

            {/* Quirk */}
            <div className="flex items-center gap-1.5">
              <div className="label w-20 flex-shrink-0 text-[9px]">QUIRK</div>
              <div className="flex-1 text-[10px] font-mono text-bright truncate">{quirk}</div>
              <button type="button" onClick={rerollQuirk} className="btn-steel px-1.5 py-0.5 flex-shrink-0">
                <RefreshCw size={9} />
              </button>
            </div>

            {/* Experience */}
            <div className="flex items-center gap-1.5">
              <div className="label w-20 flex-shrink-0 text-[9px]">EXPERIENCE</div>
              <select className="select flex-1 text-[10px] py-0.5" value={level.id}
                onChange={e => handleLevelChange(e.target.value)}>
                {EXPERIENCE_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <button type="button" onClick={rerollLevel} className="btn-steel px-1.5 py-0.5 flex-shrink-0">
                <RefreshCw size={9} />
              </button>
            </div>
          </div>

          {/* Characteristics */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="label text-[9px]">CHARACTERISTICS</div>
              <button type="button" onClick={rerollStats}
                className="btn-steel flex items-center gap-1 text-[9px] px-1.5 py-0.5">
                <RefreshCw size={9} /> REROLL
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {CORE_STAT_KEYS.map((key, i) => (
                <button key={key} type="button"
                  title={`Roll ${CORE_STAT_LABELS[i]} check`}
                  onClick={() => openStatRoll(npcName || 'NPC', genStatValues, key, CORE_STAT_LABELS[i])}
                  className="text-center border border-steel/40 py-1 hover:border-amber hover:bg-amber/5 transition-colors">
                  <div className="label text-[8px]">{CORE_STAT_LABELS[i]}</div>
                  <div className="text-amber font-mono font-bold text-sm leading-none">{toHex(stats[i] ?? 7)}</div>
                  <div className="text-body/50 text-[8px] font-mono">
                    {statDM(stats[i] ?? 7) >= 0 ? '+' : ''}{statDM(stats[i] ?? 7)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Skills */}
          {level.skills.length > 0 && (
            <div className="space-y-1.5">
              <div className="label text-[9px]">SKILLS</div>
              <div className="flex flex-wrap gap-1">
                {level.skills.map(s => (
                  <button key={s.name} type="button"
                    onClick={() => openSkillRoll(npcName || 'NPC', genStatValues, s)}
                    className="border border-steel/50 px-1.5 py-0.5 text-[10px] font-mono text-cyan-trav hover:border-amber hover:text-amber transition-colors">
                    {s.name} {s.level}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="p-3 border-t border-steel space-y-2 flex-shrink-0">
          {saveError && (
            <div role="alert" className="text-[10px] text-alert border border-alert/40 bg-alert/10 px-2 py-1 font-mono">
              {saveError}
            </div>
          )}
          {savedMsg && (
            <div className="text-[10px] text-safe border border-safe/40 bg-safe/10 px-2 py-1 font-mono">
              {savedMsg}
            </div>
          )}
          <button type="button" onClick={handleSave} disabled={saving}
            className="btn-amber w-full disabled:opacity-50 text-xs">
            {saving ? 'SAVING…' : 'SAVE NPC'}
          </button>
        </div>
      </div>

      {/* ── Main panel: saved NPCs ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="label border-b border-steel pb-2 flex items-center justify-between">
          <span>SAVED NPCS</span>
          <span className="text-body/40 font-normal normal-case tracking-normal text-[10px]">
            {npcs.length} record{npcs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {npcs.length === 0 && (
          <div className="text-xs text-body/45 font-mono py-10 text-center">
            No NPCs saved yet.
          </div>
        )}

        {npcs.length > 0 && (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[58rem]">
              <thead>
                <tr className="border-b border-steel/70 bg-void/30">
                  <th className="table-header w-40">Name</th>
                  <th className="table-header w-28">Race</th>
                  <th className="table-header w-40">Archetype</th>
                  <th className="table-header w-36">Experience</th>
                  <th className="table-header w-48">Quirk</th>
                  <th className="table-header w-48">Characteristics</th>
                  <th className="table-header min-w-56">Skills</th>
                  <th className="table-header w-12 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {npcs.map(npc => {
                  const sv = npcStatValues(npc);
                  const npcStats = CORE_STAT_KEYS.map(k => sv[k] ?? null);
                  const skills = Array.isArray(npc.skills) ? npc.skills as { name: string; level: number }[] : [];

                  return (
                    <tr key={npc.id} className="table-row align-top">
                      <td className="px-3 py-2 text-xs font-mono font-bold text-bright">
                        <div className="max-w-36 truncate" title={npc.name}>{npc.name}</div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-body/75">
                        <div className="max-w-24 whitespace-normal break-words leading-5" title={npc.race}>{npc.race}</div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-body/75">
                        <div className="max-w-36 whitespace-normal break-words leading-5" title={npc.archetype ?? undefined}>{npc.archetype ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-body/75">
                        <div className="max-w-32 whitespace-normal break-words leading-5" title={npc.experience_level ?? undefined}>{npc.experience_level ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono italic text-body/60">
                        <div className="max-w-44 whitespace-normal break-words leading-5" title={npc.quirk ?? undefined}>{npc.quirk ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-bright">
                        <div className="grid w-max grid-cols-3 gap-1">
                          {CORE_STAT_KEYS.map((key, i) => (
                            <button key={key} type="button"
                              title={`Roll ${CORE_STAT_LABELS[i]} check`}
                              onClick={() => openStatRoll(npc.name, sv, key, CORE_STAT_LABELS[i])}
                              className="min-w-[2.25rem] border border-steel/40 px-1.5 py-1 text-center transition-colors hover:border-amber hover:bg-amber/5">
                              <div className="label text-[8px] leading-none">{CORE_STAT_LABELS[i]}</div>
                              <div className="mt-0.5 text-xs font-mono font-bold leading-none text-amber">
                                {toHex(npcStats[i] ?? 7)}
                              </div>
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-bright">
                        {skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {skills.map(s => (
                              <button key={s.name} type="button"
                                onClick={() => openSkillRoll(npc.name, sv, s)}
                                className="border border-steel/40 px-2 py-0.5 text-xs font-mono text-cyan-trav transition-colors hover:border-amber hover:text-amber">
                                {s.name} {s.level}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-body/35">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-mono text-bright">
                        <button type="button" aria-label={`Delete ${npc.name}`}
                          onClick={() => deleteNpc(npc.id)}
                          className="inline-flex h-7 w-7 items-center justify-center text-body/35 transition-colors hover:text-alert">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Roll modal */}
      {rollModal && (
        <NpcRollModal
          npcName={rollModal.npcName}
          statValues={rollModal.statValues}
          target={rollModal.target}
          onClose={() => setRollModal(null)}
        />
      )}
    </div>
  );
}
