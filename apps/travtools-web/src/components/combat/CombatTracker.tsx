import { useEffect, useState, useCallback, useRef } from 'react';
import { GripVertical, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { fmtDM } from '../../lib/dice';
import { statDM, toHex } from '../../lib/traveller';
import { Character, CombatCombatant, RangeBand } from '../../types';

const STORAGE_KEY = 'travtools-combat-state';

const RANGE_BANDS: RangeBand[] = ['adjacent', 'close', 'short', 'medium', 'long', 'very-long', 'distant'];
const RANGE_LABEL: Record<RangeBand, string> = {
  adjacent: 'ADJ',
  close: 'CLOSE',
  short: 'SHORT',
  medium: 'MED',
  long: 'LONG',
  'very-long': 'VLONG',
  distant: 'DIST',
};
const RANGE_COLOR: Record<RangeBand, string> = {
  adjacent: 'text-alert border-alert/60',
  close: 'text-amber border-amber/60',
  short: 'text-amber/70 border-amber/40',
  medium: 'text-body border-steel',
  long: 'text-body/70 border-steel/60',
  'very-long': 'text-body/55 border-steel/40',
  distant: 'text-body/40 border-steel/30',
};

function rollInitiative(dexDM: number): number {
  return Math.ceil(Math.random() * 6) + dexDM;
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

/** Route damage to END first, then STR, then DEX. Returns new current values (min 0). */
function routeDamage(damage: number, endCur: number, strCur: number, dexCur: number) {
  let end = endCur, str = strCur, dex = dexCur, rem = damage;
  const endHit = Math.min(rem, end); end -= endHit; rem -= endHit;
  const strHit = Math.min(rem, str); str -= strHit; rem -= strHit;
  const dexHit = Math.min(rem, dex); dex -= dexHit;
  return { endCur: end, strCur: str, dexCur: dex };
}

/** Health bar — 6 segments coloured to fraction of max. */
function StatBar({ cur, max, label }: { cur: number; max: number; label: string }) {
  const pct = max > 0 ? cur / max : 0;
  const color = pct > 0.5 ? 'bg-safe' : pct > 0.25 ? 'bg-amber' : 'bg-alert';
  return (
    <div className="flex items-center gap-1 text-[10px] font-mono">
      <span className="text-body/50 w-3">{label}</span>
      <div className="flex gap-px">
        {Array.from({ length: max }, (_, i) => (
          <div key={i} className={`w-2 h-3 ${i < cur ? color : 'bg-steel/30'}`} />
        ))}
      </div>
      <span className="text-body/70">{cur}</span>
    </div>
  );
}

export default function CombatTracker() {
  const { client } = useSupabase();
  const [chars, setChars] = useState<Character[]>([]);

  const saved = useRef(loadFromStorage());
  const [combatants, setCombatants] = useState<CombatCombatant[]>(
    (saved.current?.combatants ?? []).map(c => ({ ...c, rangeBand: c.rangeBand ?? ('close' as RangeBand), npcHitsMax: c.npcHitsMax ?? null, npcHitsCur: c.npcHitsCur ?? null }))
  );
  const [round, setRound] = useState(saved.current?.round ?? 1);
  const [activeIndex, setActiveIndex] = useState(saved.current?.activeIndex ?? 0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [npcName, setNpcName] = useState('');
  const [npcInitiative, setNpcInitiative] = useState('');
  const [npcHits, setNpcHits] = useState('');

  // Wound panel: which combatant is open + damage input
  const [woundTarget, setWoundTarget] = useState<string | null>(null);
  const [damageInput, setDamageInput] = useState('');

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Load characters (for PC health tracking)
  const loadChars = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client.from('characters').select('id,name,dex,str,end_stat,str_cur,dex_cur,end_cur,temp_mods').order('name');
    if (error) { setErrorMessage(`Could not load characters: ${error.message}`); return; }
    setChars((data ?? []) as unknown as Character[]);
  }, [client]);

  useEffect(() => {
    loadChars();
    if (!client) return;
    // Subscribe to character health changes so wounds from the roster sheet flow in
    const channel = client.channel('combat-chars')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters' }, loadChars)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, loadChars]);

  // Supabase broadcast for cross-client sync
  useEffect(() => {
    if (!client) return;
    const channel = client.channel('combat-tracker-sync', { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'combat_update' }, ({ payload }) => {
      if (Array.isArray(payload?.combatants)) {
        const next = { combatants: payload.combatants as CombatCombatant[], round: payload.round ?? 1, activeIndex: payload.activeIndex ?? 0 };
        setCombatants(next.combatants);
        setRound(next.round);
        setActiveIndex(next.activeIndex);
        persist(next);
      }
    }).subscribe();
    return () => { client.removeChannel(channel); };
  }, [client]);

  function broadcast(next: { combatants: CombatCombatant[]; round: number; activeIndex: number }) {
    client?.channel('combat-tracker-sync').send({ type: 'broadcast', event: 'combat_update', payload: next });
  }

  function updateState(next: { combatants: CombatCombatant[]; round: number; activeIndex: number }) {
    setCombatants(next.combatants);
    setRound(next.round);
    setActiveIndex(next.activeIndex);
    persist(next);
    broadcast(next);
  }

  // ── Wound application ──────────────────────────────────────────────────────

  async function applyWound(combatantId: string) {
    const pts = parseInt(damageInput, 10);
    if (Number.isNaN(pts) || pts <= 0) return;
    setDamageInput('');

    const c = combatants.find(x => x.id === combatantId);
    if (!c) return;

    if (c.isNPC) {
      const cur = c.npcHitsCur ?? c.npcHitsMax ?? 10;
      const next = combatants.map(x => x.id === combatantId ? { ...x, npcHitsCur: Math.max(0, cur - pts) } : x);
      updateState({ combatants: next, round, activeIndex });
      return;
    }

    // PC: route damage through END→STR→DEX and write to Supabase
    const char = chars.find(x => x.id === combatantId);
    if (!char || !client) return;
    const endMax = char.end_stat ?? 7;
    const strMax = char.str ?? 7;
    const dexMax = char.dex ?? 7;
    const endCur = char.end_cur ?? endMax;
    const strCur = char.str_cur ?? strMax;
    const dexCur = char.dex_cur ?? dexMax;
    const next = routeDamage(pts, endCur, strCur, dexCur);
    const { error } = await client.from('characters').update({ end_cur: next.endCur, str_cur: next.strCur, dex_cur: next.dexCur }).eq('id', combatantId);
    if (error) setErrorMessage(`Could not save wound: ${error.message}`);
    // loadChars() will be triggered by the subscription
  }

  async function healStat(charId: string, stat: 'str' | 'dex' | 'end', delta: number) {
    const char = chars.find(x => x.id === charId);
    if (!char || !client) return;
    const maxKey = stat === 'end' ? 'end_stat' : stat;
    const curKey = stat === 'end' ? 'end_cur' : `${stat}_cur` as 'str_cur' | 'dex_cur';
    const max = char[maxKey as keyof Character] as number ?? 7;
    const cur = char[curKey as keyof Character] as number | null ?? max;
    const newVal = Math.max(0, Math.min(max, cur + delta));
    const { error } = await client.from('characters').update({ [curKey]: newVal }).eq('id', charId);
    if (error) setErrorMessage(`Could not update stat: ${error.message}`);
  }

  function adjustNpcHits(id: string, delta: number) {
    const c = combatants.find(x => x.id === id);
    if (!c) return;
    const max = c.npcHitsMax ?? 10;
    const cur = c.npcHitsCur ?? max;
    const next = combatants.map(x => x.id === id ? { ...x, npcHitsCur: Math.max(0, Math.min(max, cur + delta)) } : x);
    updateState({ combatants: next, round, activeIndex });
  }

  // ── Range bands ────────────────────────────────────────────────────────────

  function cycleRange(id: string, direction: 1 | -1) {
    const c = combatants.find(x => x.id === id);
    if (!c) return;
    const idx = RANGE_BANDS.indexOf(c.rangeBand);
    const next = RANGE_BANDS[Math.max(0, Math.min(RANGE_BANDS.length - 1, idx + direction))];
    const updated = combatants.map(x => x.id === id ? { ...x, rangeBand: next } : x);
    updateState({ combatants: updated, round, activeIndex });
  }

  // ── Combatant management ───────────────────────────────────────────────────

  function makePCEntry(c: Character): CombatCombatant {
    const dex = (c.temp_mods as Record<string, number> | null)?.dex ?? c.dex ?? 7;
    const dm = statDM(dex);
    return { id: c.id, name: c.name, initiative: rollInitiative(dm), dexDM: dm, minorActionUsed: false, significantActionUsed: false, isNPC: false, rangeBand: 'close', npcHitsMax: null, npcHitsCur: null };
  }

  function addCharacter(c: Character) {
    if (combatants.some(x => x.id === c.id)) return;
    const next = [...combatants, makePCEntry(c)].sort((a, b) => b.initiative - a.initiative);
    updateState({ combatants: next, round, activeIndex });
  }

  function rollAllInitiative() {
    const rolled = chars.filter(c => !combatants.some(x => x.id === c.id)).map(makePCEntry);
    const next = [...combatants, ...rolled].sort((a, b) => b.initiative - a.initiative);
    updateState({ combatants: next, round, activeIndex });
  }

  function addNPC() {
    const init = parseInt(npcInitiative, 10);
    if (!npcName.trim() || Number.isNaN(init)) return;
    const hits = parseInt(npcHits, 10);
    const hitsMax = Number.isNaN(hits) || hits <= 0 ? null : hits;
    const npc: CombatCombatant = { id: `npc-${Date.now()}`, name: npcName.trim(), initiative: init, dexDM: 0, minorActionUsed: false, significantActionUsed: false, isNPC: true, rangeBand: 'close', npcHitsMax: hitsMax, npcHitsCur: hitsMax };
    const next = [...combatants, npc].sort((a, b) => b.initiative - a.initiative);
    setNpcName(''); setNpcInitiative(''); setNpcHits('');
    updateState({ combatants: next, round, activeIndex: Math.min(activeIndex, next.length - 1) });
  }

  function removeCombatant(id: string) {
    const next = combatants.filter(c => c.id !== id);
    if (woundTarget === id) setWoundTarget(null);
    updateState({ combatants: next, round, activeIndex: Math.min(activeIndex, Math.max(0, next.length - 1)) });
  }

  function toggleAction(id: string, action: 'minor' | 'significant') {
    const key = action === 'minor' ? 'minorActionUsed' : 'significantActionUsed';
    updateState({ combatants: combatants.map(c => c.id === id ? { ...c, [key]: !c[key] } : c), round, activeIndex });
  }

  // ── Turn navigation ────────────────────────────────────────────────────────

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

  function clearCombat() { setWoundTarget(null); updateState({ combatants: [], round: 1, activeIndex: 0 }); }

  // ── Drag and drop ──────────────────────────────────────────────────────────

  function handleDragStart(idx: number) { setDragIndex(idx); setDropIndex(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropIndex(idx); }
  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setDropIndex(null); return; }
    const next = [...combatants];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    let newActive = activeIndex;
    if (activeIndex === dragIndex) newActive = idx;
    else if (dragIndex < activeIndex && idx >= activeIndex) newActive--;
    else if (dragIndex > activeIndex && idx <= activeIndex) newActive++;
    setDragIndex(null); setDropIndex(null);
    updateState({ combatants: next, round, activeIndex: newActive });
  }
  function handleDragEnd() { setDragIndex(null); setDropIndex(null); }

  const availableChars = chars.filter(c => !combatants.some(x => x.id === c.id));

  return (
    <div className="p-4 h-full overflow-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="label">ROUND</div>
          <div className="text-amber font-mono font-bold text-2xl">{round}</div>
          <button type="button" onClick={prevTurn} className="btn-steel text-xs">◀ PREV</button>
          <button type="button" onClick={nextTurn} className="btn-amber text-xs">NEXT ▶</button>
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
          <button type="button" onClick={() => setErrorMessage(null)}><X size={12} /></button>
        </div>
      )}

      {/* Add combatants */}
      <div className="panel p-3 space-y-3">
        <div className="label">ADD TO COMBAT</div>
        <div className="flex flex-wrap gap-2">
          {availableChars.map(c => (
            <button key={c.id} type="button" onClick={() => addCharacter(c)} className="btn-steel text-xs">+ {c.name}</button>
          ))}
          {availableChars.length > 1 && (
            <button type="button" onClick={rollAllInitiative} className="btn-amber text-xs flex items-center gap-1">
              <RefreshCw size={11} /> ALL
            </button>
          )}
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[8rem] space-y-1">
            <label className="label">NPC NAME</label>
            <input className="input text-xs" value={npcName} onChange={e => setNpcName(e.target.value)}
              placeholder="Pirate, Guard…" onKeyDown={e => e.key === 'Enter' && addNPC()} />
          </div>
          <div className="w-16 space-y-1">
            <label className="label">INIT</label>
            <input className="input text-xs" type="text" inputMode="numeric" value={npcInitiative}
              onChange={e => setNpcInitiative(e.target.value)} placeholder="5" onKeyDown={e => e.key === 'Enter' && addNPC()} />
          </div>
          <div className="w-16 space-y-1">
            <label className="label">HITS</label>
            <input className="input text-xs" type="text" inputMode="numeric" value={npcHits}
              onChange={e => setNpcHits(e.target.value)} placeholder="opt" onKeyDown={e => e.key === 'Enter' && addNPC()} />
          </div>
          <button type="button" onClick={addNPC} className="btn-steel flex items-center gap-1 text-xs">
            <Plus size={12} /> NPC
          </button>
        </div>
      </div>

      {/* Initiative queue */}
      {combatants.length === 0 ? (
        <div className="text-center py-12 text-body/60 text-sm space-y-2">
          <div className="text-4xl opacity-20">⚔</div>
          <div>No combatants. Add characters or NPCs above.</div>
        </div>
      ) : (
        <div className="space-y-1">
          {combatants.map((c, idx) => {
            const isActive = idx === activeIndex;
            const isDragging = idx === dragIndex;
            const isDropTarget = idx === dropIndex && dragIndex !== null && dragIndex !== idx;
            const char = !c.isNPC ? chars.find(x => x.id === c.id) : null;

            // PC health values (live from chars)
            const strMax = char?.str ?? null;
            const dexMax = char?.dex ?? null;
            const endMax = char?.end_stat ?? null;
            const strCur = char ? (char.str_cur ?? strMax ?? 0) : null;
            const dexCur = char ? (char.dex_cur ?? dexMax ?? 0) : null;
            const endCur = char ? (char.end_cur ?? endMax ?? 0) : null;
            const isIncap = char !== null && endCur !== null && strCur !== null && dexCur !== null && endMax !== null && strMax !== null && dexMax !== null && (endCur === 0 || (strCur === 0 && dexCur === 0));
            const isDead = char !== null && strCur === 0 && dexCur === 0 && endCur === 0;

            // NPC health
            const npcDown = c.isNPC && c.npcHitsMax !== null && (c.npcHitsCur ?? c.npcHitsMax) <= 0;

            const woundOpen = woundTarget === c.id;

            return (
              <div key={c.id} className={`transition-all ${isDragging ? 'opacity-40' : ''}`}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`panel px-3 py-2 flex items-center gap-2 select-none ${
                    isActive ? 'border border-amber/60 bg-amber/5' : ''
                  } ${isDropTarget ? 'border-t-2 border-t-cyan-trav' : ''} ${
                    isDead ? 'opacity-50' : ''
                  }`}
                >
                  {/* Drag handle */}
                  <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-body/30 hover:text-body/60 touch-none">
                    <GripVertical size={14} />
                  </div>

                  {/* Initiative */}
                  <div className={`flex-shrink-0 w-9 h-9 border-2 flex items-center justify-center font-mono font-bold text-base ${
                    isActive ? 'border-amber text-amber' : 'border-steel text-body'
                  }`}>
                    {c.initiative}
                  </div>

                  {/* Name + status */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-mono text-sm font-bold truncate ${isActive ? 'text-amber' : isDead ? 'text-alert line-through' : isIncap ? 'text-alert' : 'text-bright'}`}>
                      {c.name}
                      {c.isNPC && <span className="text-body/50 text-xs font-normal ml-1">NPC</span>}
                      {isDead && <span className="text-alert text-xs ml-1">DEAD</span>}
                      {isIncap && !isDead && <span className="text-alert text-xs ml-1">DOWN</span>}
                      {npcDown && <span className="text-alert text-xs ml-1">DOWN</span>}
                      {isActive && !isDead && !isIncap && !npcDown && <span className="text-amber text-xs ml-1">◀</span>}
                    </div>
                    {!c.isNPC && char && (
                      <div className="text-xs text-body/55 font-mono">DEX {fmtDM(c.dexDM)}</div>
                    )}
                  </div>

                  {/* Range band — left-click closer, right-click further */}
                  <button
                    type="button"
                    onClick={() => cycleRange(c.id, -1)}
                    onContextMenu={e => { e.preventDefault(); cycleRange(c.id, 1); }}
                    title="Left-click: closer · Right-click: further"
                    className={`flex-shrink-0 border px-1.5 py-0.5 text-[9px] font-mono tracking-wider transition-colors ${RANGE_COLOR[c.rangeBand]}`}
                  >
                    {RANGE_LABEL[c.rangeBand]}
                  </button>

                  {/* Action boxes */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => toggleAction(c.id, 'minor')} title="Minor action"
                      className={`w-7 h-7 border text-xs font-mono transition-colors ${
                        c.minorActionUsed ? 'border-body/30 bg-steel/30 text-body/30' : 'border-cyan-trav text-cyan-trav hover:bg-cyan-trav/10'
                      }`}>M</button>
                    <button type="button" onClick={() => toggleAction(c.id, 'significant')} title="Significant action"
                      className={`w-7 h-7 border text-xs font-mono transition-colors ${
                        c.significantActionUsed ? 'border-body/30 bg-steel/30 text-body/30' : 'border-amber text-amber hover:bg-amber/10'
                      }`}>S</button>
                  </div>

                  {/* Wound toggle */}
                  <button type="button"
                    onClick={() => { setWoundTarget(woundOpen ? null : c.id); setDamageInput(''); }}
                    title="Wounds"
                    className={`flex-shrink-0 text-xs font-mono border px-1.5 py-0.5 transition-colors ${
                      woundOpen ? 'border-alert text-alert' : 'border-steel/50 text-body/50 hover:border-alert/60 hover:text-alert/70'
                    }`}>
                    ⚔
                  </button>

                  {/* Remove */}
                  <button type="button" onClick={() => removeCombatant(c.id)} className="text-body/40 hover:text-alert flex-shrink-0">
                    <X size={13} />
                  </button>
                </div>

                {/* Wound panel */}
                {woundOpen && (
                  <div className="panel border-t-0 px-3 pb-3 pt-2 space-y-2 bg-void/40">
                    {/* PC health bars */}
                    {!c.isNPC && char && strMax !== null && dexMax !== null && endMax !== null && strCur !== null && dexCur !== null && endCur !== null && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-4">
                          <StatBar cur={endCur} max={endMax} label="E" />
                          <div className="flex gap-1">
                            <button type="button" onClick={() => healStat(c.id, 'end', -1)} className="text-alert text-xs font-mono border border-alert/40 w-5 h-5 flex items-center justify-center hover:bg-alert/10">−</button>
                            <button type="button" onClick={() => healStat(c.id, 'end', 1)} className="text-safe text-xs font-mono border border-safe/40 w-5 h-5 flex items-center justify-center hover:bg-safe/10">+</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatBar cur={strCur} max={strMax} label="S" />
                          <div className="flex gap-1">
                            <button type="button" onClick={() => healStat(c.id, 'str', -1)} className="text-alert text-xs font-mono border border-alert/40 w-5 h-5 flex items-center justify-center hover:bg-alert/10">−</button>
                            <button type="button" onClick={() => healStat(c.id, 'str', 1)} className="text-safe text-xs font-mono border border-safe/40 w-5 h-5 flex items-center justify-center hover:bg-safe/10">+</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatBar cur={dexCur} max={dexMax} label="D" />
                          <div className="flex gap-1">
                            <button type="button" onClick={() => healStat(c.id, 'dex', -1)} className="text-alert text-xs font-mono border border-alert/40 w-5 h-5 flex items-center justify-center hover:bg-alert/10">−</button>
                            <button type="button" onClick={() => healStat(c.id, 'dex', 1)} className="text-safe text-xs font-mono border border-safe/40 w-5 h-5 flex items-center justify-center hover:bg-safe/10">+</button>
                          </div>
                        </div>
                        <div className="text-[10px] text-body/40 font-mono">
                          UPP: {toHex(strMax)}{toHex(dexMax)}{toHex(endMax)} · cur {toHex(strCur)}{toHex(dexCur)}{toHex(endCur)}
                        </div>
                      </div>
                    )}

                    {/* NPC hits bar */}
                    {c.isNPC && c.npcHitsMax !== null && (() => {
                      const hMax = c.npcHitsMax;
                      const hCur = c.npcHitsCur ?? hMax;
                      const frac = hCur / hMax;
                      const segments = Math.min(hMax, 20);
                      const filledCount = Math.round(hCur * segments / hMax);
                      return (
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-mono text-body/70">HITS {hCur}/{hMax}</div>
                        <div className="flex gap-px flex-1 max-w-[12rem]">
                          {Array.from({ length: segments }, (_, i) => {
                            const filled = i < filledCount;
                            return <div key={i} className={`h-3 flex-1 ${filled ? (frac > 0.5 ? 'bg-safe' : frac > 0.25 ? 'bg-amber' : 'bg-alert') : 'bg-steel/30'}`} />;
                          })}
                        </div>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => adjustNpcHits(c.id, -1)} className="text-alert text-xs font-mono border border-alert/40 w-6 h-6 flex items-center justify-center hover:bg-alert/10">−</button>
                          <button type="button" onClick={() => adjustNpcHits(c.id, 1)} className="text-safe text-xs font-mono border border-safe/40 w-6 h-6 flex items-center justify-center hover:bg-safe/10">+</button>
                        </div>
                      </div>
                      );
                    })()}
                    {c.isNPC && c.npcHitsMax === null && (
                      <div className="text-xs text-body/50 font-mono">No hits set. Add NPC with a hits value to track wounds.</div>
                    )}

                    {/* Apply damage button */}
                    <div className="flex gap-2 items-center">
                      <input
                        className="input text-xs w-20"
                        type="text"
                        inputMode="numeric"
                        placeholder="dmg pts"
                        value={damageInput}
                        onChange={e => setDamageInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyWound(c.id)}
                      />
                      <button type="button" onClick={() => applyWound(c.id)}
                        className="btn-danger text-xs">
                        APPLY DAMAGE
                      </button>
                      {!c.isNPC && (
                        <span className="text-[10px] text-body/40 font-mono">routes END→STR→DEX</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {combatants.length > 0 && (
        <div className="text-xs text-body/55 space-y-1 font-mono">
          <div><span className="text-cyan-trav">M</span> = Minor · <span className="text-amber">S</span> = Significant · <span className="text-body/50">⚔</span> = Wounds · range chip: click = closer, right-click = further</div>
          <div>NEXT advances turn; end of round resets actions. PC wounds sync to the Roster.</div>
        </div>
      )}
    </div>
  );
}
