import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { fmtDM } from '../../lib/dice';
import { statDM } from '../../lib/traveller';
import { Character, CombatCombatant } from '../../types';

function rollInitiative(dexDM: number): number {
  const d6 = Math.ceil(Math.random() * 6);
  return d6 + dexDM;
}

export default function CombatTracker() {
  const { client } = useSupabase();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [combatants, setCombatants] = useState<CombatCombatant[]>([]);
  const [round, setRound] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // NPC quick-add
  const [npcName, setNpcName] = useState('');
  const [npcInitiative, setNpcInitiative] = useState('');

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

  // Persist combat state via Supabase broadcast so all clients stay in sync
  useEffect(() => {
    if (!client) return;
    const channel = client.channel('combat-tracker-sync', { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'combat_update' }, ({ payload }) => {
      if (payload.combatants) setCombatants(payload.combatants);
      if (payload.round !== undefined) setRound(payload.round);
      if (payload.activeIndex !== undefined) setActiveIndex(payload.activeIndex);
    }).subscribe();
    return () => { client.removeChannel(channel); };
  }, [client]);

  function broadcast(next: { combatants: CombatCombatant[]; round: number; activeIndex: number }) {
    if (!client) return;
    client.channel('combat-tracker-sync').send({
      type: 'broadcast',
      event: 'combat_update',
      payload: next,
    });
  }

  function updateState(next: { combatants: CombatCombatant[]; round: number; activeIndex: number }) {
    setCombatants(next.combatants);
    setRound(next.round);
    setActiveIndex(next.activeIndex);
    broadcast(next);
  }

  function rollAllInitiative() {
    const rolled: CombatCombatant[] = characters
      .filter(c => !combatants.some(x => x.id === c.id))
      .map(c => {
        const dex = (c.temp_mods as Record<string, number> | null)?.dex ?? c.dex ?? 7;
        const dm = statDM(dex);
        return {
          id: c.id,
          name: c.name,
          initiative: rollInitiative(dm),
          dexDM: dm,
          minorActionUsed: false,
          significantActionUsed: false,
          isNPC: false,
        };
      });
    const next = [...combatants, ...rolled].sort((a, b) => b.initiative - a.initiative);
    updateState({ combatants: next, round, activeIndex });
  }

  function addNPC() {
    const init = parseInt(npcInitiative, 10);
    if (!npcName.trim() || Number.isNaN(init)) return;
    const npc: CombatCombatant = {
      id: `npc-${Date.now()}`,
      name: npcName.trim(),
      initiative: init,
      dexDM: 0,
      minorActionUsed: false,
      significantActionUsed: false,
      isNPC: true,
    };
    const next = [...combatants, npc].sort((a, b) => b.initiative - a.initiative);
    setNpcName('');
    setNpcInitiative('');
    updateState({ combatants: next, round, activeIndex: Math.min(activeIndex, next.length - 1) });
  }

  function removeCombatant(id: string) {
    const next = combatants.filter(c => c.id !== id);
    const nextActive = Math.min(activeIndex, Math.max(0, next.length - 1));
    updateState({ combatants: next, round, activeIndex: nextActive });
  }

  function toggleAction(id: string, action: 'minor' | 'significant') {
    const next = combatants.map(c =>
      c.id === id
        ? { ...c, [action === 'minor' ? 'minorActionUsed' : 'significantActionUsed']: !c[action === 'minor' ? 'minorActionUsed' : 'significantActionUsed'] }
        : c
    );
    updateState({ combatants: next, round, activeIndex });
  }

  function nextTurn() {
    if (combatants.length === 0) return;
    let nextIndex = activeIndex + 1;
    let nextRound = round;
    if (nextIndex >= combatants.length) {
      nextIndex = 0;
      nextRound = round + 1;
      // Reset actions for new round
      const reset = combatants.map(c => ({ ...c, minorActionUsed: false, significantActionUsed: false }));
      updateState({ combatants: reset, round: nextRound, activeIndex: 0 });
      return;
    }
    updateState({ combatants, round: nextRound, activeIndex: nextIndex });
  }

  function prevTurn() {
    if (combatants.length === 0 || (activeIndex === 0 && round === 1)) return;
    if (activeIndex === 0) {
      updateState({ combatants, round: round - 1, activeIndex: combatants.length - 1 });
    } else {
      updateState({ combatants, round, activeIndex: activeIndex - 1 });
    }
  }

  function clearCombat() {
    updateState({ combatants: [], round: 1, activeIndex: 0 });
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...combatants];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    const newActive = activeIndex === index ? index - 1 : activeIndex === index - 1 ? index : activeIndex;
    updateState({ combatants: next, round, activeIndex: newActive });
  }

  function moveDown(index: number) {
    if (index >= combatants.length - 1) return;
    const next = [...combatants];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    const newActive = activeIndex === index ? index + 1 : activeIndex === index + 1 ? index : activeIndex;
    updateState({ combatants: next, round, activeIndex: newActive });
  }

  function addCharacter(c: Character) {
    if (combatants.some(x => x.id === c.id)) return;
    const dex = (c.temp_mods as Record<string, number> | null)?.dex ?? c.dex ?? 7;
    const dm = statDM(dex);
    const newCombatant: CombatCombatant = {
      id: c.id,
      name: c.name,
      initiative: rollInitiative(dm),
      dexDM: dm,
      minorActionUsed: false,
      significantActionUsed: false,
      isNPC: false,
    };
    const next = [...combatants, newCombatant].sort((a, b) => b.initiative - a.initiative);
    updateState({ combatants: next, round, activeIndex });
  }

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
            <button key={c.id} type="button"
              onClick={() => addCharacter(c)}
              className="btn-steel text-xs">
              + {c.name}
            </button>
          ))}
          {availableChars.length > 1 && (
            <button type="button" onClick={rollAllInitiative} className="btn-amber text-xs flex items-center gap-1">
              <RefreshCw size={11} /> ALL
            </button>
          )}
        </div>

        {/* NPC quick-add */}
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
        <div className="space-y-2">
          {combatants.map((c, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div key={c.id}
                className={`panel px-3 py-2 flex items-center gap-3 transition-colors ${
                  isActive ? 'border border-amber/60 bg-amber/5' : ''
                }`}>
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
                    {isActive && <span className="text-amber text-xs ml-2">◀ ACTIVE</span>}
                  </div>
                  {!c.isNPC && (
                    <div className="text-xs text-body/55 font-mono">DEX {fmtDM(c.dexDM)}</div>
                  )}
                </div>

                {/* Action boxes */}
                <div className="flex items-center gap-1">
                  <button type="button"
                    onClick={() => toggleAction(c.id, 'minor')}
                    title="Minor action"
                    className={`w-6 h-6 border text-xs font-mono transition-colors ${
                      c.minorActionUsed ? 'border-body/40 bg-steel/30 text-body/40' : 'border-cyan-trav text-cyan-trav hover:bg-cyan-trav/10'
                    }`}>
                    M
                  </button>
                  <button type="button"
                    onClick={() => toggleAction(c.id, 'significant')}
                    title="Significant action"
                    className={`w-6 h-6 border text-xs font-mono transition-colors ${
                      c.significantActionUsed ? 'border-body/40 bg-steel/30 text-body/40' : 'border-amber text-amber hover:bg-amber/10'
                    }`}>
                    S
                  </button>
                </div>

                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
                    className="text-body/50 hover:text-body disabled:opacity-20">
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" onClick={() => moveDown(idx)} disabled={idx === combatants.length - 1}
                    className="text-body/50 hover:text-body disabled:opacity-20">
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Remove */}
                <button type="button" onClick={() => removeCombatant(c.id)}
                  className="text-body/40 hover:text-alert">
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {combatants.length > 0 && (
        <div className="text-xs text-body/55 space-y-1 font-mono">
          <div><span className="text-cyan-trav">M</span> = Minor action (aim, draw, move)</div>
          <div><span className="text-amber">S</span> = Significant action (attack, skill check)</div>
          <div>NEXT advances to next combatant; end of round resets actions.</div>
        </div>
      )}
    </div>
  );
}
