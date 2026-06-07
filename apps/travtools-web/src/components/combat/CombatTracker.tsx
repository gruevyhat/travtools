import { useEffect, useState, useCallback, useRef } from 'react';
import { GripVertical, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { fmtDM } from '../../lib/dice';
import { statDM } from '../../lib/traveller';
import { Character, CombatCombatant } from '../../types';

const STORAGE_KEY = 'travtools-combat-state';

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

export default function CombatTracker() {
  const { client } = useSupabase();
  const [characters, setCharacters] = useState<Character[]>([]);

  // Initialise from localStorage so state survives tab switches
  const saved = useRef(loadFromStorage());
  const [combatants, setCombatants] = useState<CombatCombatant[]>(saved.current?.combatants ?? []);
  const [round, setRound] = useState(saved.current?.round ?? 1);
  const [activeIndex, setActiveIndex] = useState(saved.current?.activeIndex ?? 0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [npcName, setNpcName] = useState('');
  const [npcInitiative, setNpcInitiative] = useState('');

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const loadCharacters = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client
      .from('characters')
      .select('id,name,dex,temp_mods')
      .order('name');
    if (error) { setErrorMessage(`Could not load characters: ${error.message}`); return; }
    setCharacters((data ?? []) as unknown as Character[]);
  }, [client]);

  useEffect(() => { loadCharacters(); }, [loadCharacters]);

  // Supabase broadcast for cross-client sync
  useEffect(() => {
    if (!client) return;
    const channel = client.channel('combat-tracker-sync', { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'combat_update' }, ({ payload }) => {
      if (Array.isArray(payload?.combatants)) {
        const next = { combatants: payload.combatants, round: payload.round ?? 1, activeIndex: payload.activeIndex ?? 0 };
        setCombatants(next.combatants);
        setRound(next.round);
        setActiveIndex(next.activeIndex);
        persist(next); // keep this client's localStorage in sync too
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

  // ── Drag and drop ──────────────────────────────────────────────────────────

  function handleDragStart(idx: number) {
    setDragIndex(idx);
    setDropIndex(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(idx);
  }

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
    setDragIndex(null);
    setDropIndex(null);
    updateState({ combatants: next, round, activeIndex: newActive });
  }

  function handleDragEnd() { setDragIndex(null); setDropIndex(null); }

  // ── Combatant management ───────────────────────────────────────────────────

  function addCharacter(c: Character) {
    if (combatants.some(x => x.id === c.id)) return;
    const dex = (c.temp_mods as Record<string, number> | null)?.dex ?? c.dex ?? 7;
    const dm = statDM(dex);
    const entry: CombatCombatant = { id: c.id, name: c.name, initiative: rollInitiative(dm), dexDM: dm, minorActionUsed: false, significantActionUsed: false, isNPC: false };
    const next = [...combatants, entry].sort((a, b) => b.initiative - a.initiative);
    updateState({ combatants: next, round, activeIndex });
  }

  function rollAllInitiative() {
    const rolled: CombatCombatant[] = characters
      .filter(c => !combatants.some(x => x.id === c.id))
      .map(c => {
        const dex = (c.temp_mods as Record<string, number> | null)?.dex ?? c.dex ?? 7;
        const dm = statDM(dex);
        return { id: c.id, name: c.name, initiative: rollInitiative(dm), dexDM: dm, minorActionUsed: false, significantActionUsed: false, isNPC: false };
      });
    const next = [...combatants, ...rolled].sort((a, b) => b.initiative - a.initiative);
    updateState({ combatants: next, round, activeIndex });
  }

  function addNPC() {
    const init = parseInt(npcInitiative, 10);
    if (!npcName.trim() || Number.isNaN(init)) return;
    const npc: CombatCombatant = { id: `npc-${Date.now()}`, name: npcName.trim(), initiative: init, dexDM: 0, minorActionUsed: false, significantActionUsed: false, isNPC: true };
    const next = [...combatants, npc].sort((a, b) => b.initiative - a.initiative);
    setNpcName(''); setNpcInitiative('');
    updateState({ combatants: next, round, activeIndex: Math.min(activeIndex, next.length - 1) });
  }

  function removeCombatant(id: string) {
    const next = combatants.filter(c => c.id !== id);
    updateState({ combatants: next, round, activeIndex: Math.min(activeIndex, Math.max(0, next.length - 1)) });
  }

  function toggleAction(id: string, action: 'minor' | 'significant') {
    const key = action === 'minor' ? 'minorActionUsed' : 'significantActionUsed';
    const next = combatants.map(c => c.id === id ? { ...c, [key]: !c[key] } : c);
    updateState({ combatants: next, round, activeIndex });
  }

  // ── Turn navigation ────────────────────────────────────────────────────────

  function nextTurn() {
    if (combatants.length === 0) return;
    const nextIndex = activeIndex + 1;
    if (nextIndex >= combatants.length) {
      const reset = combatants.map(c => ({ ...c, minorActionUsed: false, significantActionUsed: false }));
      updateState({ combatants: reset, round: round + 1, activeIndex: 0 });
    } else {
      updateState({ combatants, round, activeIndex: nextIndex });
    }
  }

  function prevTurn() {
    if (combatants.length === 0 || (activeIndex === 0 && round === 1)) return;
    if (activeIndex === 0) {
      updateState({ combatants, round: round - 1, activeIndex: combatants.length - 1 });
    } else {
      updateState({ combatants, round, activeIndex: activeIndex - 1 });
    }
  }

  function clearCombat() { updateState({ combatants: [], round: 1, activeIndex: 0 }); }

  const availableChars = characters.filter(c => !combatants.some(x => x.id === c.id));

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
            <button key={c.id} type="button" onClick={() => addCharacter(c)} className="btn-steel text-xs">
              + {c.name}
            </button>
          ))}
          {availableChars.length > 1 && (
            <button type="button" onClick={rollAllInitiative} className="btn-amber text-xs flex items-center gap-1">
              <RefreshCw size={11} /> ALL
            </button>
          )}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="label">NPC NAME</label>
            <input className="input text-xs" value={npcName} onChange={e => setNpcName(e.target.value)}
              placeholder="Pirate, Guard…" onKeyDown={e => e.key === 'Enter' && addNPC()} />
          </div>
          <div className="w-20 space-y-1">
            <label className="label">INIT</label>
            <input className="input text-xs" type="text" inputMode="numeric" value={npcInitiative}
              onChange={e => setNpcInitiative(e.target.value)}
              placeholder="5" onKeyDown={e => e.key === 'Enter' && addNPC()} />
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
            return (
              <div
                key={c.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`panel px-3 py-2 flex items-center gap-2 transition-all select-none ${
                  isActive ? 'border border-amber/60 bg-amber/5' : ''
                } ${isDragging ? 'opacity-40' : ''}  ${isDropTarget ? 'border-t-2 border-t-cyan-trav' : ''}`}
              >
                {/* Drag handle */}
                <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-body/30 hover:text-body/60 touch-none">
                  <GripVertical size={14} />
                </div>

                {/* Initiative score */}
                <div className={`flex-shrink-0 w-10 h-10 border-2 flex items-center justify-center font-mono font-bold text-lg ${
                  isActive ? 'border-amber text-amber' : 'border-steel text-body'
                }`}>
                  {c.initiative}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-sm font-bold truncate ${isActive ? 'text-amber' : 'text-bright'}`}>
                    {c.name}
                    {c.isNPC && <span className="text-body/50 text-xs font-normal ml-1">NPC</span>}
                    {isActive && <span className="text-amber text-xs ml-2">◀</span>}
                  </div>
                  {!c.isNPC && (
                    <div className="text-xs text-body/55 font-mono">DEX {fmtDM(c.dexDM)}</div>
                  )}
                </div>

                {/* Action boxes */}
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => toggleAction(c.id, 'minor')} title="Minor action"
                    className={`w-7 h-7 border text-xs font-mono transition-colors ${
                      c.minorActionUsed ? 'border-body/30 bg-steel/30 text-body/30 line-through' : 'border-cyan-trav text-cyan-trav hover:bg-cyan-trav/10'
                    }`}>
                    M
                  </button>
                  <button type="button" onClick={() => toggleAction(c.id, 'significant')} title="Significant action"
                    className={`w-7 h-7 border text-xs font-mono transition-colors ${
                      c.significantActionUsed ? 'border-body/30 bg-steel/30 text-body/30 line-through' : 'border-amber text-amber hover:bg-amber/10'
                    }`}>
                    S
                  </button>
                </div>

                {/* Remove */}
                <button type="button" onClick={() => removeCombatant(c.id)} className="text-body/40 hover:text-alert flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {combatants.length > 0 && (
        <div className="text-xs text-body/55 space-y-1 font-mono">
          <div><span className="text-cyan-trav">M</span> = Minor action · <span className="text-amber">S</span> = Significant action · drag <span className="text-body/40">⠿</span> to reorder</div>
          <div>NEXT advances turn; end of round resets actions and increments round counter.</div>
        </div>
      )}
    </div>
  );
}
