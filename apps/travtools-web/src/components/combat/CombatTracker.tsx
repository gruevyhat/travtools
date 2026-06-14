import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, Crosshair, GripVertical, HeartPulse, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { fmtDM } from '../../lib/dice';
import { parseDamageExpr, statDM, toHex } from '../../lib/traveller';
import { Character, CombatCombatant, RangeBand, Weapon, ArmourItem } from '../../types';
import { CORE_NPC_ARCHETYPES, CoreNpcArchetype } from '../../data/npcArchetypes';
import NumberStepper from '../shared/NumberStepper';

const STORAGE_KEY = 'travtools-combat-state';

const RANGE_BANDS: RangeBand[] = ['adjacent', 'close', 'short', 'medium', 'long', 'very-long', 'distant'];
const RANGE_LABEL: Record<RangeBand, string> = {
  adjacent: 'Adjacent',
  close: 'Close',
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
  'very-long': 'Very Long',
  distant: 'Distant',
};
const ACTION_READY = 'border-steel/80 bg-panel/80 text-body hover:border-amber/80 hover:text-amber hover:bg-amber/10';
const ACTION_USED = 'border-body/40 bg-steel/40 text-body/55';
const ACTION_DISABLED = 'border-steel/40 bg-steel/20 text-body/35 cursor-not-allowed';
const COMBAT_SKILL_PATTERN = /^(Gun Combat|Melee|Heavy Weapons|Athletics|Recon|Stealth|Tactics|Explosives|Vacc Suit|Battle Dress)/i;

interface DamageReport {
  attacker: string;
  target: string;
  weapon: string;
  rolls: number[];
  constant: number;
  strDM: number;
  rawDamage: number;
  armour: number;
  appliedDamage: number;
}

function rollInit(dexDM: number) {
  return Math.ceil(Math.random() * 6) + dexDM;
}

function routeDamage(dmg: number, endCur: number, strCur: number, dexCur: number) {
  let e = endCur, s = strCur, d = dexCur, rem = dmg;
  const eHit = Math.min(rem, e); e -= eHit; rem -= eHit;
  const sHit = Math.min(rem, s); s -= sHit; rem -= sHit;
  const dHit = Math.min(rem, d); d -= dHit;
  return { endCur: e, strCur: s, dexCur: d };
}

function loadFromStorage(): { combatants: CombatCombatant[]; round: number; activeIndex: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.combatants)) return parsed;
  } catch { /* ignore */ }
  return null;
}

function persist(state: { combatants: CombatCombatant[]; round: number; activeIndex: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function defaultCombatant(c: CombatCombatant): CombatCombatant {
  return {
    ...c,
    side: c.side ?? 'ally',
    targetId: c.targetId ?? null,
    rangeBand: c.rangeBand ?? 'close',
    npcHitsMax: c.npcHitsMax ?? null,
    npcHitsCur: c.npcHitsCur ?? null,
    npcRole: c.npcRole ?? null,
    npcSource: c.npcSource ?? null,
    npcSkills: c.npcSkills ?? [],
    npcWeapons: c.npcWeapons ?? [],
    npcArmour: c.npcArmour ?? [],
  };
}

function relevantCombatSkills(skills: Character['skills']) {
  return skills
    .filter(skill => skill.level >= 0 && COMBAT_SKILL_PATTERN.test(skill.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 6);
}

function combatSkills(char: Character | null) {
  return relevantCombatSkills(char?.skills ?? []);
}

function combatWeaponsFromList(list: Weapon[]) {
  const weapons = list.filter(weapon => weapon.name.trim());
  const nonUnarmed = weapons.filter(weapon => weapon.name.toLowerCase() !== 'unarmed');
  return (nonUnarmed.length > 0 ? nonUnarmed : weapons).slice(0, 4);
}

function combatWeapons(char: Character | null) {
  return combatWeaponsFromList(char?.weapons ?? []);
}

function combatSkillLabel(skill: Character['skills'][number]) {
  const name = skill.name
    .replace(/^Gun Combat/i, 'Gun')
    .replace(/^Heavy Weapons/i, 'Heavy Wpn')
    .replace(/^Battle Dress/i, 'B.Dress')
    .replace(/^Vacc Suit/i, 'Vacc')
    .replace(/^Athletics/i, 'Athl')
    .replace(/\s+/g, ' ')
    .trim();
  return `${name}-${skill.level}`;
}

function combatSkillFullLabel(skill: Character['skills'][number]) {
  return `${skill.name}-${skill.level}`;
}

function weaponLabel(weapon: Character['weapons'][number]) {
  return [weapon.name, weapon.damage].map(part => part.trim()).filter(Boolean).join(' ');
}

function weaponFullLabel(weapon: Character['weapons'][number]) {
  return [weapon.name, weapon.damage, weapon.range, weapon.skill, weapon.traits]
    .map(part => part.trim())
    .filter(Boolean)
    .join(' · ');
}

function armourProtectionFromItems(items: ArmourItem[]) {
  return items
    .filter(item => item.worn === true)
    .reduce((sum, item) => sum + Math.max(0, item.protection ?? 0), 0);
}

function armourProtection(char: Character | null) {
  return armourProtectionFromItems(char?.armour ?? []);
}

function npcArmourProtection(c: CombatCombatant) {
  return armourProtectionFromItems(c.npcArmour ?? []);
}

function armourLabel(items: ArmourItem[]) {
  const protection = armourProtectionFromItems(items);
  if (protection <= 0) return 'Armor 0';
  const names = items.filter(item => item.worn === true && item.protection !== null && item.protection > 0).map(item => item.name);
  return `Armor ${protection}${names.length > 0 ? ` (${names.join(', ')})` : ''}`;
}

function effectiveStr(char: Character | null) {
  if (!char) return null;
  const base = char.str_cur ?? char.str;
  if (base === null) return null;
  const mod = char.temp_mods?.str ?? 0;
  return Math.max(0, base + mod);
}

function needsStrDM(weapon: Weapon) {
  return weapon.range.toLowerCase() === 'melee' || /str dm/i.test(weapon.damage);
}

function statSummary(char: Character | null) {
  if (!char) return null;
  const str = char.str ?? 0;
  const dex = char.dex ?? 0;
  const end = char.end_stat ?? 0;
  const intVal = char.int_stat ?? 0;
  const edu = char.edu ?? 0;
  const soc = char.soc ?? 0;
  const endCur = char.end_cur ?? end;
  const strCur = char.str_cur ?? str;
  const dexCur = char.dex_cur ?? dex;
  return {
    upp: `${toHex(str)}${toHex(dex)}${toHex(end)}${toHex(intVal)}${toHex(edu)}${toHex(soc)}`,
    current: `E${endCur}/S${strCur}/D${dexCur}`,
  };
}

function StatBar({ cur, max, label }: { cur: number; max: number; label: string }) {
  const pct = max > 0 ? cur / max : 0;
  const color = pct > 0.5 ? 'bg-safe' : pct > 0.25 ? 'bg-amber' : 'bg-alert';
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs font-mono">
      <span className="text-body/75">{label}</span>
      <div className="flex gap-px min-w-0">
        {Array.from({ length: Math.max(1, max) }, (_, i) => (
          <div key={i} className={`h-3 flex-1 min-w-[3px] ${i < cur ? color : 'bg-steel/35'}`} />
        ))}
      </div>
      <span className="text-body text-right">{cur}/{max}</span>
    </div>
  );
}

export default function CombatTracker() {
  const { client } = useSupabase();
  const [chars, setChars] = useState<Character[]>([]);
  const syncChannel = useRef<{
    send: (args: { type: 'broadcast'; event: string; payload: { combatants: CombatCombatant[]; round: number; activeIndex: number } }) => Promise<unknown>;
  } | null>(null);

  const saved = useRef(loadFromStorage());
  const [combatants, setCombatants] = useState<CombatCombatant[]>(
    (saved.current?.combatants ?? []).map(defaultCombatant)
  );
  const [round, setRound] = useState(saved.current?.round ?? 1);
  const [activeIndex, setActiveIndex] = useState(saved.current?.activeIndex ?? 0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [npcName, setNpcName] = useState('');
  const [npcInitiative, setNpcInitiative] = useState('');
  const [npcHits, setNpcHits] = useState('');
  const [npcSide, setNpcSide] = useState<'ally' | 'enemy'>('enemy');
  const [npcArchetypeId, setNpcArchetypeId] = useState(CORE_NPC_ARCHETYPES[0]?.id ?? '');
  const [damageInputs, setDamageInputs] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [damageReport, setDamageReport] = useState<DamageReport | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [invalidDropId, setInvalidDropId] = useState<string | null>(null);

  const loadChars = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client
      .from('characters')
      .select('id,name,str,dex,end_stat,int_stat,edu,soc,str_cur,dex_cur,end_cur,temp_mods,skills,weapons,armour')
      .order('name');
    if (error) { setErrorMessage(`Could not load characters: ${error.message}`); return; }
    setChars((data ?? []) as unknown as Character[]);
  }, [client]);

  useEffect(() => {
    loadChars();
    if (!client) return;
    const ch = client.channel('combat-chars')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters' }, loadChars)
      .subscribe();
    return () => { client.removeChannel(ch); };
  }, [client, loadChars]);

  useEffect(() => {
    if (!client) return;
    const ch = client.channel('combat-tracker-sync', { config: { broadcast: { self: false } } });
    syncChannel.current = ch;
    ch.on('broadcast', { event: 'combat_update' }, ({ payload }) => {
      if (Array.isArray(payload?.combatants)) {
        const next = {
          combatants: (payload.combatants as CombatCombatant[]).map(defaultCombatant),
          round: payload.round ?? 1,
          activeIndex: payload.activeIndex ?? 0,
        };
        setCombatants(next.combatants);
        setRound(next.round);
        setActiveIndex(next.activeIndex);
        persist(next);
      }
    }).subscribe();
    return () => {
      if (syncChannel.current === ch) syncChannel.current = null;
      client.removeChannel(ch);
    };
  }, [client]);

  function broadcast(next: { combatants: CombatCombatant[]; round: number; activeIndex: number }) {
    try {
      const send = syncChannel.current?.send({ type: 'broadcast', event: 'combat_update', payload: next });
      if (send) {
        void send.catch((err) => {
          setErrorMessage(`Could not broadcast combat update: ${err instanceof Error ? err.message : 'unknown error'}`);
        });
      }
    } catch (err) {
      setErrorMessage(`Could not broadcast combat update: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  function updateState(next: { combatants: CombatCombatant[]; round: number; activeIndex: number }) {
    setCombatants(next.combatants);
    setRound(next.round);
    setActiveIndex(next.activeIndex);
    persist(next);
    broadcast(next);
  }

  function patchCharHealth(charId: string, patch: Partial<Pick<Character, 'str_cur' | 'dex_cur' | 'end_cur'>>) {
    setChars(prev => prev.map(c => c.id === charId ? { ...c, ...patch } : c));
  }

  async function applyDamageAmount(combatantId: string, pts: number) {
    if (pts <= 0) return true;

    const combatant = combatants.find(x => x.id === combatantId);
    if (!combatant) return false;

    if (combatant.isNPC) {
      const max = combatant.npcHitsMax ?? 10;
      const cur = combatant.npcHitsCur ?? max;
      updateState({
        combatants: combatants.map(x => x.id === combatantId
          ? { ...x, npcHitsMax: max, npcHitsCur: Math.max(0, cur - pts) }
          : x
        ),
        round,
        activeIndex,
      });
      return true;
    }

    const char = chars.find(x => x.id === combatantId);
    if (!char || !client) return false;
    const endMax = char.end_stat ?? 7, strMax = char.str ?? 7, dexMax = char.dex ?? 7;
    const endCur = char.end_cur ?? endMax, strCur = char.str_cur ?? strMax, dexCur = char.dex_cur ?? dexMax;
    const next = routeDamage(pts, endCur, strCur, dexCur);
    patchCharHealth(combatantId, { end_cur: next.endCur, str_cur: next.strCur, dex_cur: next.dexCur });
    const { error } = await client.from('characters').update({ end_cur: next.endCur, str_cur: next.strCur, dex_cur: next.dexCur }).eq('id', combatantId);
    if (error) { setErrorMessage(`Could not save wound: ${error.message}`); loadChars(); return false; }
    return true;
  }

  async function applyWound(combatantId: string) {
    const pts = parseInt(damageInputs[combatantId] ?? '', 10);
    if (Number.isNaN(pts) || pts <= 0) return;
    setDamageInputs(prev => ({ ...prev, [combatantId]: '' }));
    await applyDamageAmount(combatantId, pts);
  }

  async function adjustStat(charId: string, stat: 'str' | 'dex' | 'end', delta: number) {
    const char = chars.find(x => x.id === charId);
    if (!char || !client) return;
    const maxKey = stat === 'end' ? 'end_stat' : stat as 'str' | 'dex';
    const curKey = stat === 'end' ? 'end_cur' : `${stat}_cur` as 'str_cur' | 'dex_cur';
    const max = char[maxKey as keyof Character] as number ?? 7;
    const cur = char[curKey as keyof Character] as number | null ?? max;
    const val = Math.max(0, Math.min(max, cur + delta));
    patchCharHealth(charId, { [curKey]: val } as Partial<Pick<Character, 'str_cur' | 'dex_cur' | 'end_cur'>>);
    const { error } = await client.from('characters').update({ [curKey]: val }).eq('id', charId);
    if (error) { setErrorMessage(`Could not update stat: ${error.message}`); loadChars(); }
  }

  function adjustNpcHits(id: string, delta: number) {
    const combatant = combatants.find(x => x.id === id);
    if (!combatant) return;
    const max = combatant.npcHitsMax ?? 10, cur = combatant.npcHitsCur ?? max;
    updateState({ combatants: combatants.map(x => x.id === id ? { ...x, npcHitsCur: Math.max(0, Math.min(max, cur + delta)) } : x), round, activeIndex });
  }

  function updateNpcHitsMax(id: string, raw: string) {
    const combatant = combatants.find(x => x.id === id);
    if (!combatant) return;
    if (raw.trim() === '') {
      updateState({ combatants: combatants.map(x => x.id === id ? { ...x, npcHitsMax: null, npcHitsCur: null } : x), round, activeIndex });
      return;
    }
    const nextMax = parseInt(raw, 10);
    if (Number.isNaN(nextMax) || nextMax <= 0) return;
    const cur = combatant.npcHitsCur ?? combatant.npcHitsMax ?? nextMax;
    updateState({ combatants: combatants.map(x => x.id === id ? { ...x, npcHitsMax: nextMax, npcHitsCur: Math.min(cur, nextMax) } : x), round, activeIndex });
  }

  function updateRange(id: string, rangeBand: RangeBand) {
    updateState({ combatants: combatants.map(c => c.id === id ? { ...c, rangeBand } : c), round, activeIndex });
  }

  function updateTarget(id: string, targetId: string) {
    updateState({ combatants: combatants.map(c => c.id === id ? { ...c, targetId: targetId && targetId !== id ? targetId : null } : c), round, activeIndex });
  }

  async function rollWeaponDamage(attacker: CombatCombatant, weapon: Weapon) {
    if (combatants[activeIndex]?.id !== attacker.id) {
      setErrorMessage(`${attacker.name} is not the active combatant.`);
      return;
    }
    if (!attacker.targetId) {
      setErrorMessage(`Select a target for ${attacker.name} before using ${weapon.name}.`);
      return;
    }
    const target = combatants.find(c => c.id === attacker.targetId);
    if (!target) {
      setErrorMessage(`Target for ${attacker.name} is no longer in combat.`);
      return;
    }

    const attackerChar = attacker.isNPC ? null : chars.find(c => c.id === attacker.id) ?? null;
    const targetChar = target.isNPC ? null : chars.find(c => c.id === target.id) ?? null;
    const { dice, constant } = parseDamageExpr(weapon.damage);
    const rolls = Array.from({ length: Math.max(1, dice) }, () => Math.ceil(Math.random() * 6));
    const strDMVal = needsStrDM(weapon) && !attacker.isNPC ? statDM(effectiveStr(attackerChar)) : 0;
    const rawDamage = Math.max(0, rolls.reduce((sum, roll) => sum + roll, 0) + constant + strDMVal);
    const armour = target.isNPC ? npcArmourProtection(target) : armourProtection(targetChar);
    const appliedDamage = Math.max(0, rawDamage - armour);
    const applied = await applyDamageAmount(target.id, appliedDamage);

    if (applied) {
      setDamageReport({
        attacker: attacker.name,
        target: target.name,
        weapon: weapon.name,
        rolls,
        constant,
        strDM: strDMVal,
        rawDamage,
        armour,
        appliedDamage,
      });
      setErrorMessage(null);
    }
  }

  function switchSide(id: string) {
    updateState({ combatants: combatants.map(c => c.id === id ? { ...c, side: c.side === 'ally' ? 'enemy' : 'ally', targetId: null } : c), round, activeIndex });
  }

  function makePCEntry(c: Character, side: 'ally' | 'enemy' = 'ally'): CombatCombatant {
    const dex = (c.temp_mods as Record<string, number> | null)?.dex ?? c.dex ?? 7;
    const dm = statDM(dex);
    return { id: c.id, name: c.name, initiative: rollInit(dm), dexDM: dm, minorActionUsed: false, significantActionUsed: false, isNPC: false, side, rangeBand: 'close', targetId: null, npcHitsMax: null, npcHitsCur: null };
  }

  function makeNPCEntry(config: {
    id: string;
    name: string;
    initiative: number;
    dexDM?: number;
    side: 'ally' | 'enemy';
    rangeBand?: RangeBand;
    hitsMax: number | null;
    role?: string | null;
    source?: string | null;
    skills?: Character['skills'];
    weapons?: Weapon[];
    armour?: ArmourItem[];
  }): CombatCombatant {
    return {
      id: config.id,
      name: config.name,
      initiative: config.initiative,
      dexDM: config.dexDM ?? 0,
      minorActionUsed: false,
      significantActionUsed: false,
      isNPC: true,
      side: config.side,
      rangeBand: config.rangeBand ?? 'close',
      targetId: null,
      npcHitsMax: config.hitsMax,
      npcHitsCur: config.hitsMax,
      npcRole: config.role ?? null,
      npcSource: config.source ?? null,
      npcSkills: config.skills ?? [],
      npcWeapons: config.weapons ?? [],
      npcArmour: config.armour ?? [],
    };
  }

  function insertSorted(list: CombatCombatant[], entry: CombatCombatant): CombatCombatant[] {
    const idx = list.findIndex(c => c.initiative < entry.initiative);
    if (idx === -1) return [...list, entry];
    const next = [...list];
    next.splice(idx, 0, entry);
    return next;
  }

  function addCharacter(c: Character) {
    if (combatants.some(x => x.id === c.id)) return;
    updateState({ combatants: insertSorted(combatants, makePCEntry(c)), round, activeIndex });
  }

  function rollAllInitiative() {
    const existing = new Set(combatants.map(x => x.id));
    let next = [...combatants];
    chars.filter(c => !existing.has(c.id)).forEach(c => { next = insertSorted(next, makePCEntry(c)); });
    updateState({ combatants: next, round, activeIndex });
  }

  function addNPC() {
    if (!npcName.trim()) return;
    const parsedInit = parseInt(npcInitiative, 10);
    const init = Number.isNaN(parsedInit) ? Math.ceil(Math.random() * 6) : parsedInit;
    const hits = parseInt(npcHits, 10);
    const hitsMax = Number.isNaN(hits) || hits <= 0 ? null : hits;
    const npc = makeNPCEntry({
      id: `npc-${Date.now()}`,
      name: npcName.trim(),
      initiative: init,
      side: npcSide,
      hitsMax,
    });
    setNpcName('');
    setNpcInitiative('');
    setNpcHits('');
    updateState({ combatants: insertSorted(combatants, npc), round, activeIndex: Math.min(activeIndex, combatants.length) });
  }

  function addNpcArchetype(archetype: CoreNpcArchetype) {
    const init = Math.ceil(Math.random() * 6) + archetype.initiativeDM;
    const npc = makeNPCEntry({
      id: `npc-${archetype.id}-${Date.now()}`,
      name: archetype.name,
      initiative: init,
      dexDM: archetype.initiativeDM,
      side: npcSide,
      rangeBand: archetype.rangeBand,
      hitsMax: archetype.hits,
      role: archetype.role,
      source: archetype.source,
      skills: archetype.skills,
      weapons: archetype.weapons,
      armour: archetype.armour,
    });
    updateState({ combatants: insertSorted(combatants, npc), round, activeIndex: Math.min(activeIndex, combatants.length) });
  }

  function removeCombatant(id: string) {
    const removed = combatants.find(c => c.id === id);
    const next = combatants.filter(c => c.id !== id).map(c => c.targetId === id ? { ...c, targetId: null } : c);
    setDamageInputs(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setExpandedIds(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (removed) {
      setDamageReport(prev => prev && (prev.attacker === removed.name || prev.target === removed.name) ? null : prev);
    }
    updateState({ combatants: next, round, activeIndex: Math.min(activeIndex, Math.max(0, next.length - 1)) });
  }

  function toggleAction(id: string, action: 'minor' | 'significant') {
    const key = action === 'minor' ? 'minorActionUsed' : 'significantActionUsed';
    updateState({ combatants: combatants.map(c => c.id === id ? { ...c, [key]: !c[key] } : c), round, activeIndex });
  }

  function nextTurn() {
    if (combatants.length === 0) return;
    if (activeIndex + 1 >= combatants.length) {
      updateState({ combatants: combatants.map(c => ({ ...c, minorActionUsed: false, significantActionUsed: false })), round: round + 1, activeIndex: 0 });
    } else {
      updateState({ combatants, round, activeIndex: activeIndex + 1 });
    }
  }

  function prevTurn() {
    if (combatants.length === 0 || (activeIndex === 0 && round === 1)) return;
    if (activeIndex === 0) updateState({ combatants, round: round - 1, activeIndex: combatants.length - 1 });
    else updateState({ combatants, round, activeIndex: activeIndex - 1 });
  }

  function clearCombat() {
    setDamageInputs({});
    setExpandedIds({});
    setDamageReport(null);
    updateState({ combatants: [], round: 1, activeIndex: 0 });
  }

  function toggleExpanded(id: string) {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function handleDrop(fromId: string, toId: string) {
    if (fromId === toId) { setDragId(null); setDropId(null); setInvalidDropId(null); return; }
    const fromIdx = combatants.findIndex(c => c.id === fromId);
    const toIdx = combatants.findIndex(c => c.id === toId);
    if (fromIdx === -1 || toIdx === -1 || combatants[fromIdx].side !== combatants[toIdx].side) { setDragId(null); setDropId(null); setInvalidDropId(null); return; }
    const next = [...combatants];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const newActive = next.findIndex(c => c.id === combatants[activeIndex]?.id);
    setDragId(null); setDropId(null); setInvalidDropId(null);
    updateState({ combatants: next, round, activeIndex: Math.max(0, newActive) });
  }

  const activeCombatant = combatants[activeIndex] ?? null;
  const availableChars = chars.filter(c => !combatants.some(x => x.id === c.id));
  const allies = combatants.filter(c => c.side === 'ally');
  const enemies = combatants.filter(c => c.side === 'enemy');
  const selectedNpcArchetype = CORE_NPC_ARCHETYPES.find(archetype => archetype.id === npcArchetypeId) ?? CORE_NPC_ARCHETYPES[0];

  function renderHealth(c: CombatCombatant, char: Character | null) {
    const damageValue = damageInputs[c.id] ?? '';
    const fieldId = `damage-${c.id}`;

    if (c.isNPC) {
      const hMax = c.npcHitsMax;
      const hCur = hMax === null ? null : c.npcHitsCur ?? hMax;
      const frac = hMax && hCur !== null ? hCur / hMax : 1;
      const segs = hMax ? Math.min(hMax, 20) : 10;
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-[8.5rem_1fr] items-end gap-3">
            <label className="space-y-1">
              <span className="label text-[10px]">Max Hits</span>
              <NumberStepper
                ariaLabel={`${c.name} max hits`}
                value={hMax ?? ''}
                onChange={value => updateNpcHitsMax(c.id, value)}
                placeholder="none"
                inputClassName="input text-xs"
              />
            </label>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs font-mono">
                <span className="text-body/75">Hits</span>
                <span className={hCur !== null && hCur <= 0 ? 'text-alert' : 'text-body'}>{hCur === null || hMax === null ? 'not tracked' : `${hCur}/${hMax}`}</span>
              </div>
              <div className="mt-1 flex gap-px">
                {Array.from({ length: segs }, (_, i) => {
                  const filled = hMax !== null && hCur !== null && i < Math.round(hCur * segs / hMax);
                  return <div key={i} className={`h-3 flex-1 ${filled ? (frac > 0.5 ? 'bg-safe' : frac > 0.25 ? 'bg-amber' : 'bg-alert') : 'bg-steel/35'}`} />;
                })}
              </div>
            </div>
          </div>
          {hMax === null && <div className="text-xs text-body/70 font-mono">No hits tracked. Enter max hits to enable the wound bar.</div>}
          <div className="grid grid-cols-[8.5rem_auto_auto_auto] gap-1.5 items-end">
            <label htmlFor={fieldId} className="space-y-1 min-w-0">
              <span className="label text-[10px]">Dmg</span>
              <NumberStepper
                id={fieldId}
                ariaLabel={`${c.name} damage`}
                min={0}
                placeholder="damage"
                value={damageValue}
                onChange={value => setDamageInputs(prev => ({ ...prev, [c.id]: value }))}
                onKeyDown={e => e.key === 'Enter' && applyWound(c.id)}
                inputClassName="input text-xs h-8"
              />
            </label>
            <button type="button" onClick={() => applyWound(c.id)} className="btn-danger text-[10px] h-8 px-2">DAMAGE</button>
            <button type="button" onClick={() => adjustNpcHits(c.id, -1)} className="h-8 w-7 border border-alert/70 bg-alert/5 text-alert font-mono hover:bg-alert/15">-</button>
            <button type="button" onClick={() => adjustNpcHits(c.id, 1)} className="h-8 w-7 border border-safe/70 bg-safe/5 text-safe font-mono hover:bg-safe/15">+</button>
          </div>
        </div>
      );
    }

    const strMax = char?.str ?? null, dexMax = char?.dex ?? null, endMax = char?.end_stat ?? null;
    const strCur = char ? (char.str_cur ?? strMax ?? 0) : null;
    const dexCur = char ? (char.dex_cur ?? dexMax ?? 0) : null;
    const endCur = char ? (char.end_cur ?? endMax ?? 0) : null;
    if (!char || strMax === null || dexMax === null || endMax === null || strCur === null || dexCur === null || endCur === null) {
      return <div className="text-xs text-body/70 font-mono">Character health unavailable.</div>;
    }

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {([['end', 'END', endCur, endMax], ['str', 'STR', strCur, strMax], ['dex', 'DEX', dexCur, dexMax]] as ['end' | 'str' | 'dex', string, number, number][]).map(([stat, label, cur, max]) => (
            <div key={stat} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center">
              <StatBar cur={cur} max={max} label={label} />
              <button type="button" onClick={() => adjustStat(c.id, stat, -1)} className="w-7 h-7 border border-alert/70 bg-alert/5 text-alert font-mono hover:bg-alert/15">-</button>
              <button type="button" onClick={() => adjustStat(c.id, stat, 1)} className="w-7 h-7 border border-safe/70 bg-safe/5 text-safe font-mono hover:bg-safe/15">+</button>
            </div>
          ))}
          <div className="text-[10px] text-body/65 font-mono">UPP {toHex(strMax)}{toHex(dexMax)}{toHex(endMax)} {'->'} current {toHex(strCur)}{toHex(dexCur)}{toHex(endCur)}</div>
        </div>
        <div className="grid grid-cols-[8.5rem_auto] gap-1.5 items-end">
          <label htmlFor={fieldId} className="space-y-1 min-w-0">
            <span className="label text-[10px]">Dmg</span>
            <NumberStepper
              id={fieldId}
              ariaLabel={`${c.name} damage`}
              min={0}
              placeholder="damage"
              value={damageValue}
              onChange={value => setDamageInputs(prev => ({ ...prev, [c.id]: value }))}
              onKeyDown={e => e.key === 'Enter' && applyWound(c.id)}
              inputClassName="input text-xs h-8"
            />
          </label>
          <button type="button" onClick={() => applyWound(c.id)} className="btn-danger text-[10px] h-8 px-2">DAMAGE</button>
        </div>
        <div className="text-[10px] text-body/65 font-mono">Damage routes END {'->'} STR {'->'} DEX.</div>
      </div>
    );
  }

  function renderCard(c: CombatCombatant, globalIdx: number) {
    const isActive = globalIdx === activeIndex;
    const isDragging = c.id === dragId;
    const isDropTarget = c.id === dropId && dragId !== null && dragId !== c.id;
    const isInvalidDropTarget = c.id === invalidDropId;
    const char = !c.isNPC ? chars.find(x => x.id === c.id) ?? null : null;
    const strCur = char ? (char.str_cur ?? char.str ?? 0) : null;
    const dexCur = char ? (char.dex_cur ?? char.dex ?? 0) : null;
    const endCur = char ? (char.end_cur ?? char.end_stat ?? 0) : null;
    const isDead = char ? strCur === 0 && dexCur === 0 && endCur === 0 : false;
    const isDown = char ? endCur === 0 || (strCur === 0 && dexCur === 0) : c.npcHitsMax !== null && (c.npcHitsCur ?? c.npcHitsMax) <= 0;
    const targetName = c.targetId ? combatants.find(x => x.id === c.targetId)?.name : null;
    const sideAccent = c.side === 'ally' ? 'bg-safe' : 'bg-alert';
    const sideBorder = c.side === 'ally' ? 'border-safe/50' : 'border-alert/50';
    const sideTint = c.side === 'ally' ? 'bg-safe/[0.025]' : 'bg-alert/[0.025]';
    const isExpanded = expandedIds[c.id] === true;
    const pcStats = statSummary(char);
    const npcArmour = c.isNPC ? npcArmourProtection(c) : 0;
    const skills = c.isNPC ? relevantCombatSkills(c.npcSkills ?? []) : combatSkills(char);
    const weapons = c.isNPC ? combatWeaponsFromList(c.npcWeapons ?? []) : combatWeapons(char);
    const npcHits = c.npcHitsMax === null ? 'hits not tracked' : `hits ${c.npcHitsCur ?? c.npcHitsMax}/${c.npcHitsMax}`;
    const statsLabel = pcStats
      ? `UPP ${pcStats.upp} · ${pcStats.current}`
      : ['NPC', c.npcRole, npcHits, npcArmour > 0 ? armourLabel(c.npcArmour ?? []) : null].filter(Boolean).join(' · ');
    const healthLabel = pcStats ? pcStats.current : c.npcHitsMax === null ? 'Hits --' : `Hits ${c.npcHitsCur ?? c.npcHitsMax}/${c.npcHitsMax}`;
    const actionsLabel = `Minor ${c.minorActionUsed ? 'used' : 'ready'} / Significant ${c.significantActionUsed ? 'used' : 'ready'}`;
    const skillsLabel = skills.length > 0 ? skills.map(combatSkillLabel).join(' · ') : 'none listed';
    const skillsTitle = skills.length > 0 ? skills.map(combatSkillFullLabel).join(' · ') : skillsLabel;
    const weaponsLabel = weapons.length > 0 ? weapons.map(weaponLabel).join(' · ') : 'none listed';
    const weaponsTitle = weapons.length > 0 ? weapons.map(weaponFullLabel).join(' · ') : weaponsLabel;
    const targetLabel = targetName ?? 'No target';
    const targetTitle = targetName ? `Target ${targetName}` : 'No target selected';
    const canAct = isActive && !isDead && !isDown;
    const actionsTitle = canAct ? actionsLabel : `${actionsLabel} · inactive`;

    return (
      <article
        key={c.id}
        draggable
        aria-label={`${c.name} combatant card`}
        onDragStart={() => { setDragId(c.id); setDropId(c.id); setInvalidDropId(null); }}
        onDragOver={e => {
          e.preventDefault();
          const dragged = combatants.find(x => x.id === dragId);
          if (!dragged) return;
          if (dragged.side === c.side) { setDropId(c.id); setInvalidDropId(null); }
          else { setDropId(null); setInvalidDropId(c.id); }
        }}
        onDragLeave={() => { if (invalidDropId === c.id) setInvalidDropId(null); }}
        onDrop={e => { e.preventDefault(); if (dragId) handleDrop(dragId, c.id); }}
        onDragEnd={() => { setDragId(null); setDropId(null); setInvalidDropId(null); }}
        className={[
          'panel relative overflow-hidden transition-colors',
          isExpanded ? 'p-3' : 'p-2.5',
          sideTint,
          isActive ? 'border-amber/80 shadow-[0_0_0_1px_rgba(212,160,23,0.35)]' : sideBorder,
          !isActive ? 'bg-steel/[0.055]' : '',
          isDropTarget ? 'border-t-4 border-t-cyan-trav' : '',
          isInvalidDropTarget ? 'cursor-not-allowed border-alert bg-alert/10' : '',
          isDragging ? 'opacity-45' : '',
          isDead ? 'opacity-60' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className={`absolute left-0 top-0 h-full w-1 ${sideAccent}`} />
        <div className="flex items-start gap-2.5 pl-1">
          <div className="pt-2 cursor-grab text-body/60 hover:text-body touch-none">
            <GripVertical size={14} />
          </div>
          <button
            type="button"
            onClick={() => updateState({ combatants, round, activeIndex: globalIdx })}
            className={`${isExpanded ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg'} flex-shrink-0 border-2 font-mono font-bold transition-colors ${isActive ? 'border-amber text-amber bg-amber/10' : 'border-steel text-body hover:border-amber/70 hover:text-amber'}`}
            title="Set active turn"
          >
            {c.initiative}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-mono font-bold text-base truncate ${isActive ? 'text-amber' : isDead ? 'text-alert line-through' : isDown ? 'text-alert' : 'text-bright'}`}>{c.name}</h3>
              <span className="status-tag border-steel/60 bg-steel/20 text-body/80">{c.isNPC ? 'NPC' : 'PC'}</span>
              {isActive && <span className="status-tag border-amber/70 bg-amber/10 text-amber">ACTIVE TURN</span>}
              {isDown && !isDead && <span className="status-tag border-alert/70 bg-alert/10 text-alert">DOWN</span>}
              {isDead && <span className="status-tag border-alert/70 bg-alert/10 text-alert">DEAD</span>}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {!isActive && (
              <button type="button" onClick={() => updateState({ combatants, round, activeIndex: globalIdx })} className="btn-steel text-[10px] h-8 px-2 whitespace-nowrap">
                SET ACTIVE
              </button>
            )}
            <button type="button" onClick={() => toggleExpanded(c.id)} className="btn-steel text-[10px] h-8 px-2 flex items-center justify-center gap-1 whitespace-nowrap" aria-expanded={isExpanded}>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {isExpanded ? 'COLLAPSE' : 'DETAILS'}
            </button>
            <button type="button" onClick={() => removeCombatant(c.id)} className="btn-danger h-8 w-8 p-0 flex items-center justify-center" aria-label={`Remove ${c.name}`}>
              <X size={12} />
            </button>
          </div>
        </div>

        <div className="mt-2 pl-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-tight font-mono">
          <span className="border border-steel/60 bg-void/35 px-1.5 py-1 text-body/75">{c.side === 'ally' ? 'ALLY' : 'ADV'}</span>
          <span className="border border-steel/60 bg-void/35 px-1.5 py-1 text-body/75">RANGE <span className="text-body">{RANGE_LABEL[c.rangeBand]}</span></span>
          <span className="min-w-0 max-w-full border border-steel/60 bg-void/35 px-1.5 py-1" title={targetTitle}>
            <span className="text-body/55">TARGET </span>
            <span className={`${targetName ? 'text-alert' : 'text-body/45'} inline-block max-w-[12rem] align-bottom truncate`}>{targetLabel}</span>
          </span>
          <span className="border border-steel/60 bg-void/35 px-1.5 py-1" title={actionsTitle}>
            <span className={!canAct ? 'text-body/35' : c.minorActionUsed ? 'text-body/55' : 'text-cyan-trav'}>M {c.minorActionUsed ? 'used' : 'ready'}</span>
            <span className="text-body/35"> / </span>
            <span className={!canAct ? 'text-body/35' : c.significantActionUsed ? 'text-body/55' : 'text-amber'}>S {c.significantActionUsed ? 'used' : 'ready'}</span>
          </span>
          <span className={`border px-1.5 py-1 ${isDead || isDown ? 'border-alert/60 bg-alert/10 text-alert' : 'border-steel/60 bg-void/35 text-body/75'}`} title={statsLabel}>
            {healthLabel}
          </span>
        </div>

        {isExpanded && (
          <div className="mt-3 grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.95fr)] gap-3 pl-1">
            <div className="space-y-3">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(8rem,0.75fr)_minmax(10rem,1fr)_minmax(12rem,1.15fr)] gap-2 text-xs font-mono">
                <div className="border border-steel/70 bg-void/30 px-2 py-1.5 min-w-0" title={statsLabel}>
                  <div className="text-body/60 text-[10px]">Stats</div>
                  <div className="text-body truncate">{statsLabel}</div>
                </div>
                <div className="border border-steel/70 bg-void/30 px-2 py-1.5 min-w-0" title={skillsTitle}>
                  <div className="text-body/60 text-[10px]">Skills</div>
                  <div className="text-body truncate">{skillsLabel}</div>
                </div>
                <div className="border border-steel/70 bg-void/30 px-2 py-1.5 min-w-0" title={weaponsTitle}>
                  <div className="text-body/60 text-[10px]">Weapons</div>
                  {weapons.length > 0 ? (
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {weapons.map((weapon, index) => {
                        const label = weaponLabel(weapon);
                        return (
                          <button
                            key={`${weapon.name}-${index}`}
                            type="button"
                            onClick={() => rollWeaponDamage(c, weapon)}
                            disabled={!canAct}
                            className={`text-left truncate max-w-full ${canAct ? 'text-amber hover:text-bright hover:underline underline-offset-2' : 'text-body/35 cursor-not-allowed'}`}
                            title={!canAct ? 'Only the active combatant can use weapons' : `${weaponFullLabel(weapon)}${targetName ? ` -> ${targetName}` : ' -> select target'}`}
                            aria-label={`Roll ${label} damage${targetName ? ` at ${targetName}` : ''}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-body truncate">{weaponsLabel}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => toggleAction(c.id, 'minor')}
                  disabled={!canAct}
                  title={!canAct ? 'Only the active combatant can take actions' : 'Toggle minor action'}
                  className={`border px-2 py-2 text-left font-mono text-xs transition-colors ${!canAct ? ACTION_DISABLED : c.minorActionUsed ? ACTION_USED : ACTION_READY}`}
                >
                  <span className={`block ${canAct ? 'text-body/65' : 'text-body/40'}`}>Minor</span>
                  <span className={!canAct ? 'text-body/35' : c.minorActionUsed ? 'text-body/60' : 'text-cyan-trav'}>{c.minorActionUsed ? 'USED' : 'READY'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleAction(c.id, 'significant')}
                  disabled={!canAct}
                  title={!canAct ? 'Only the active combatant can take actions' : 'Toggle significant action'}
                  className={`border px-2 py-2 text-left font-mono text-xs transition-colors ${!canAct ? ACTION_DISABLED : c.significantActionUsed ? ACTION_USED : ACTION_READY}`}
                >
                  <span className={`block ${canAct ? 'text-body/65' : 'text-body/40'}`}>Significant</span>
                  <span className={!canAct ? 'text-body/35' : c.significantActionUsed ? 'text-body/60' : 'text-amber'}>{c.significantActionUsed ? 'USED' : 'READY'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchSide(c.id)}
                  className="border border-steel/80 bg-panel/80 px-2 py-2 text-left font-mono text-xs text-body transition-colors hover:border-amber/80 hover:text-amber"
                >
                  <span className="flex items-center gap-1 text-body/65"><ArrowLeftRight size={12} /> Side</span>
                  <span>{c.side === 'ally' ? 'ALLY' : 'ADVERSARY'}</span>
                </button>
                <div className="border border-steel/80 bg-panel/80 px-2 py-2 font-mono text-xs">
                  <span className="flex items-center gap-1 text-body/65"><HeartPulse size={12} /> Status</span>
                  <span className={isDead || isDown ? 'text-alert' : 'text-safe'}>{isDead ? 'DEAD' : isDown ? 'DOWN' : 'OPERABLE'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label htmlFor={`range-${c.id}`} className="space-y-1">
                  <span className="label flex items-center gap-1"><Crosshair size={12} /> Range</span>
                  <select
                    id={`range-${c.id}`}
                    className="select text-xs"
                    value={c.rangeBand}
                    onChange={e => updateRange(c.id, e.target.value as RangeBand)}
                  >
                    {RANGE_BANDS.map(band => <option key={band} value={band}>{RANGE_LABEL[band]}</option>)}
                  </select>
                </label>
                <label htmlFor={`target-${c.id}`} className="space-y-1">
                  <span className="label flex items-center gap-1"><Crosshair size={12} /> Target</span>
                  <select
                    id={`target-${c.id}`}
                    className="select text-xs"
                    value={c.targetId ?? ''}
                    onChange={e => updateTarget(c.id, e.target.value)}
                  >
                    <option value="">No target</option>
                    {combatants.filter(other => other.id !== c.id).map(other => (
                      <option key={other.id} value={other.id}>{other.name} ({other.side === 'ally' ? 'Ally' : 'Adv'})</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <section className="border border-steel/60 bg-void/35 p-3 space-y-2">
              <div className="label flex items-center gap-1"><HeartPulse size={12} /> Wounds</div>
              {renderHealth(c, char)}
            </section>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="p-4 h-full overflow-auto space-y-4">
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        <div className="label">ROUND</div>
        <div className="text-amber font-mono font-bold text-3xl leading-none">{round}</div>
        <button type="button" onClick={prevTurn} className="btn-steel text-xs">PREV</button>
        <button type="button" onClick={nextTurn} className="btn-amber text-xs">NEXT TURN</button>
        <div className="text-xs font-mono text-body/70">
          {activeCombatant ? <span>ACTIVE: <span className="text-amber">{activeCombatant.name}</span></span> : 'NO ACTIVE COMBATANT'}
        </div>
        <div className="flex-1" />
        {combatants.length > 0 && (
          <button type="button" onClick={clearCombat} className="btn-danger text-xs flex items-center gap-1">
            <Trash2 size={12} /> CLEAR
          </button>
        )}
      </div>

      {errorMessage && (
        <div role="alert" className="border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss combat error"><X size={12} /></button>
        </div>
      )}

      {damageReport && (
        <div className="border border-amber/45 bg-amber/10 px-1.5 py-1 text-[9px] leading-none font-mono text-body flex items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
            <span className="text-body/55">DMG</span>
            <span>
              <span className="text-amber">{damageReport.attacker}</span>
              {' -> '}
              <span className="text-alert">{damageReport.target}</span>
            </span>
            <span className="text-bright truncate max-w-[12rem]">{damageReport.weapon}</span>
            <span>
              roll <span className="text-amber">{damageReport.rolls.join('+')}</span>
              {damageReport.constant !== 0 && <span> {fmtDM(damageReport.constant)}</span>}
              {damageReport.strDM !== 0 && <span> STR {fmtDM(damageReport.strDM)}</span>}
              {' = '}
              <span className="text-amber">{damageReport.rawDamage}</span>
            </span>
            {damageReport.armour > 0 && <span>, armor {damageReport.armour}</span>}
            <span className={damageReport.appliedDamage > 0 ? 'text-alert' : 'text-safe'}>{damageReport.appliedDamage} applied</span>
          </span>
          <button type="button" onClick={() => setDamageReport(null)} aria-label="Dismiss damage report" className="text-body/70 hover:text-body flex-shrink-0 p-0.5"><X size={9} /></button>
        </div>
      )}

      <div className="panel p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="label">ADD TO COMBAT</div>
          <div className="text-[10px] text-body/60 font-mono">{availableChars.length} PC{availableChars.length === 1 ? '' : 's'} available</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableChars.map(c => (
            <button key={c.id} type="button" onClick={() => addCharacter(c)} className="btn-steel text-xs">+ {c.name}</button>
          ))}
          {availableChars.length > 1 && (
            <button type="button" onClick={rollAllInitiative} className="btn-amber text-xs flex items-center gap-1">
              <RefreshCw size={11} /> ADD ALL PCS
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto_auto] gap-2 items-end">
          <label className="space-y-1">
            <span className="label">NPC Name</span>
            <input className="input text-xs" value={npcName} onChange={e => setNpcName(e.target.value)}
              placeholder="Pirate, Guard..." onKeyDown={e => e.key === 'Enter' && addNPC()} />
          </label>
          <label className="space-y-1">
            <span className="label">Init</span>
            <NumberStepper
              ariaLabel="NPC initiative"
              value={npcInitiative}
              onChange={setNpcInitiative}
              placeholder="auto"
              onKeyDown={e => e.key === 'Enter' && addNPC()}
              inputClassName="input text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="label">Hits</span>
            <NumberStepper
              ariaLabel="NPC hits"
              min={0}
              value={npcHits}
              onChange={setNpcHits}
              placeholder="opt"
              onKeyDown={e => e.key === 'Enter' && addNPC()}
              inputClassName="input text-xs"
            />
          </label>
          <div className="space-y-1">
            <div className="label">Side</div>
            <div className="flex gap-1">
              <button
                type="button"
                aria-pressed={npcSide === 'ally'}
                onClick={() => setNpcSide('ally')}
                className={`text-xs border px-3 py-1.5 font-mono transition-colors ${npcSide === 'ally' ? 'border-safe text-safe bg-safe/10 ring-1 ring-safe/40' : 'border-steel/80 bg-panel/70 text-body hover:border-safe/70 hover:text-safe'}`}
              >ALLY</button>
              <button
                type="button"
                aria-pressed={npcSide === 'enemy'}
                onClick={() => setNpcSide('enemy')}
                className={`text-xs border px-3 py-1.5 font-mono transition-colors ${npcSide === 'enemy' ? 'border-alert text-alert bg-alert/10 ring-1 ring-alert/40' : 'border-steel/80 bg-panel/70 text-body hover:border-alert/70 hover:text-alert'}`}
              >ENEMY</button>
            </div>
          </div>
          <button type="button" onClick={addNPC} className="btn-steel flex items-center justify-center gap-1 text-xs h-[2.15rem]">
            <Plus size={12} /> ADD NPC
          </button>
        </div>
        <div className="border-t border-steel/55 pt-3 grid grid-cols-1 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)_auto] gap-2 items-end">
          <label htmlFor="npc-archetype" className="space-y-1 min-w-0">
            <span className="label">Core NPC Archetype</span>
            <select
              id="npc-archetype"
              className="select text-xs"
              value={npcArchetypeId}
              onChange={e => setNpcArchetypeId(e.target.value)}
            >
              {CORE_NPC_ARCHETYPES.map(archetype => (
                <option key={archetype.id} value={archetype.id}>{archetype.name}</option>
              ))}
            </select>
          </label>
          {selectedNpcArchetype && (
            <div className="border border-steel/70 bg-void/35 px-2 py-1.5 min-w-0 font-mono text-[10px]" title={selectedNpcArchetype.source}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-bright font-bold">{selectedNpcArchetype.role}</span>
                <span className="text-body/60">SIDE {npcSide === 'ally' ? 'ALLY' : 'ENEMY'}</span>
                <span className="text-body/75">Hits {selectedNpcArchetype.hits}</span>
                <span className="text-body/75">Init {fmtDM(selectedNpcArchetype.initiativeDM)}</span>
                <span className="text-body/75">{armourLabel(selectedNpcArchetype.armour)}</span>
              </div>
              <div className="mt-1 text-body/75 truncate">{selectedNpcArchetype.weapons.map(weaponLabel).join(' / ')}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => selectedNpcArchetype && addNpcArchetype(selectedNpcArchetype)}
            className="btn-amber flex items-center justify-center gap-1 text-xs h-[2.15rem]"
          >
            <Plus size={12} /> ADD ARCHETYPE
          </button>
        </div>
      </div>

      {combatants.length === 0 ? (
        <div className="text-center py-12 text-body/60 text-sm space-y-2">
          <div className="text-4xl opacity-20">COMBAT</div>
          <div>No combatants yet.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="space-y-2" aria-label="Allied combatants">
            <div className="flex items-center gap-2">
              <div className="label text-safe">ALLIES</div>
              <div className="text-[10px] text-body/65 font-mono">{allies.length} combatant{allies.length !== 1 ? 's' : ''}</div>
            </div>
            {allies.length === 0 && <div className="text-body/60 text-xs py-6 text-center border border-dashed border-steel/55">None</div>}
            {allies.map(c => renderCard(c, combatants.indexOf(c)))}
          </section>

          <section className="space-y-2" aria-label="Adversary combatants">
            <div className="flex items-center gap-2">
              <div className="label text-alert">ADVERSARIES</div>
              <div className="text-[10px] text-body/65 font-mono">{enemies.length} combatant{enemies.length !== 1 ? 's' : ''}</div>
            </div>
            {enemies.length === 0 && <div className="text-body/60 text-xs py-6 text-center border border-dashed border-steel/55">None</div>}
            {enemies.map(c => renderCard(c, combatants.indexOf(c)))}
          </section>
        </div>
      )}
    </div>
  );
}
