import { Search } from 'lucide-react';
import { useMemo } from 'react';
import {
  TROJAN_REACH_WORLDS,
  searchTrojanReachWorlds,
  type TrojanReachWorld,
} from '../../data/trojanReachWorlds';
import { parseWorldUwp, type WorldProfile } from '../../lib/trade';

function profileFromCatalogWorld(world: TrojanReachWorld): WorldProfile {
  const parsed = parseWorldUwp(world.uwp);
  return {
    name: world.name,
    uwp: world.uwp,
    tradeCodes: world.tradeCodes,
    starport: parsed?.starport ?? 'X',
    size: parsed?.size,
    atmosphere: parsed?.atmosphere,
    hydrographics: parsed?.hydrographics,
    population: parsed?.population ?? 0,
    government: parsed?.government,
    techLevel: parsed?.techLevel ?? 0,
    lawLevel: parsed?.lawLevel ?? 0,
    zone: world.zone,
  };
}

export default function WorldCatalogPanel({
  query,
  onQueryChange,
  target,
  onTargetChange,
  onSelect,
  containerClassName = 'panel p-3 space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden lg:flex lg:flex-col',
}: {
  query: string;
  onQueryChange: (query: string) => void;
  target: 'source' | 'destination';
  onTargetChange: (target: 'source' | 'destination') => void;
  onSelect: (profile: WorldProfile, target: 'source' | 'destination') => void;
  containerClassName?: string;
}) {
  const matches = useMemo(() => searchTrojanReachWorlds(query, query.trim() ? 80 : 328), [query]);

  return (
    <aside className={containerClassName}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="label">TROJAN REACH WORLDS</span>
        <span className="font-mono text-[10px] text-body/55">{matches.length} / {TROJAN_REACH_WORLDS.length}</span>
      </div>
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-body/65 pointer-events-none" />
        <input
          className="input pl-6 text-xs"
          aria-label="Trojan Reach World Catalog Search"
          placeholder="Search name, hex, UWP, trade code..."
          value={query}
          onChange={event => onQueryChange(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-1">
        {(['source', 'destination'] as const).map(option => (
          <button
            key={option}
            type="button"
            onClick={() => onTargetChange(option)}
            className={`border px-2 py-1 text-[10px] font-mono tracking-widest ${
              target === option
                ? 'border-amber bg-amber/15 text-amber'
                : 'border-steel/50 bg-void/40 text-body/60 hover:border-cyan-trav/70 hover:text-cyan-trav'
            }`}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="space-y-1.5 overflow-y-auto pr-1 lg:flex-1 max-h-96 lg:max-h-none">
        {matches.map(world => (
          <button
            key={`${world.hex}-${world.name}`}
            type="button"
            onClick={() => onSelect(profileFromCatalogWorld(world), target)}
            className="w-full text-left border border-steel/40 bg-void/50 px-2 py-1.5 text-xs space-y-1 hover:border-amber/60 hover:bg-steel/20 transition-colors group"
            aria-label={`Select ${world.name} for ${target}`}
            title={`${world.remarks || 'No remarks'} · ${world.allegianceName}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-cyan-trav w-9">{world.hex}</span>
              <span className="font-bold text-bright flex-1 truncate group-hover:text-amber">{world.name}</span>
              {world.zone !== 'normal' && <span className="text-[9px] font-mono text-alert border border-alert/50 px-1">{world.zone.toUpperCase()}</span>}
            </div>
            <div className="flex items-center gap-2 pl-11 font-mono text-[10px] text-body/60">
              <span>{world.uwp}</span>
              <span className="truncate text-body/55">{world.subsector}</span>
            </div>
            <div className="pl-11 text-[10px] text-body/65 truncate">
              {world.tradeCodes.join(' ') || 'No trade codes'} · {world.pbg} · {world.allegiance}
            </div>
          </button>
        ))}
        {matches.length === 0 && (
          <div className="border border-steel/40 bg-void/40 px-2 py-4 text-center text-[11px] text-body/55">
            No Trojan Reach worlds match that search.
          </div>
        )}
      </div>
    </aside>
  );
}
