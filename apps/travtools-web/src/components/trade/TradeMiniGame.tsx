import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Dice5, Plus, RefreshCcw, Search, ShoppingCart, Truck, Users, X } from 'lucide-react';
import { fmtDM, rollD66, rollTravellerCheck } from '../../lib/dice';
import {
  characterSkillCheckDm,
  characterSkillLevel,
  effectiveCharacterStat,
  skillChar,
  statDM,
  STAT_LABELS,
  type CharStat,
} from '../../lib/traveller';
import {
  applyPurchaseDMs,
  applySaleDMs,
  availableTradeGoods,
  calculateLotCost,
  formatTradeCodeList,
  formatCr,
  freightTraffic,
  freightWorldDm,
  passengerTraffic,
  parseWorldUwp,
  populationQuantityDm,
  rollDice,
  rollTonsWithDm,
  supplierStarportDm,
  tradeCodeDescription,
  tradeGoodPurchaseDm,
  tradeGoodSaleDm,
  TRAVELLER_TRADE_CODES,
  type FreightLotSize,
  type ModifiedPriceResult,
  type RolledTons,
  type TravelZone,
  type WorldProfile,
} from '../../lib/trade';
import { TRADE_GOODS, formatBasePrice, type TradeGood } from '../../data/tradeGoods';
import {
  TROJAN_REACH_WORLDS,
  searchTrojanReachWorlds,
  type TrojanReachWorld,
} from '../../data/trojanReachWorlds';
import { lookupPassageFare, type PassengerClass } from '../../data/passageFares';
import { mailTrafficDm } from '../../data/freightTraffic';
import { lookupRandomPassenger } from '../../data/randomPassenger';
import type { Character, TradeDeal } from '../../types';
import NumberStepper from '../shared/NumberStepper';

export type TradeDealDraft = Omit<TradeDeal, 'id' | 'created_at' | 'updated_at'>;

const DEFAULT_SOURCE: WorldProfile = {
  name: 'Drinax',
  uwp: 'A43645A-E',
  tradeCodes: ['Ni', 'Ht'],
  starport: 'A',
  size: 4,
  atmosphere: 3,
  hydrographics: 6,
  population: 4,
  government: 5,
  techLevel: 14,
  lawLevel: 10,
  zone: 'normal',
};

const DEFAULT_DESTINATION: WorldProfile = {
  name: 'Cordan',
  uwp: 'A895347-9',
  tradeCodes: ['Lo'],
  starport: 'A',
  size: 8,
  atmosphere: 9,
  hydrographics: 5,
  population: 3,
  government: 4,
  techLevel: 9,
  lawLevel: 7,
  zone: 'normal',
};

const PASSENGER_CLASSES: PassengerClass[] = ['low', 'basic', 'middle', 'high'];
const FREIGHT_LOTS: FreightLotSize[] = ['incidental', 'minor', 'major'];
const TRADE_CHECK_SKILLS = ['Broker', 'Streetwise', 'Admin'] as const;
const PASSENGER_CHECK_SKILLS = ['Broker', 'Carouse', 'Streetwise'] as const;
const FREIGHT_CHECK_SKILLS = ['Broker', 'Streetwise'] as const;
const CHECK_STATS: CharStat[] = ['int_stat', 'edu', 'soc', 'dex', 'str', 'end_stat'];
const PASSENGER_LABELS: Record<PassengerClass, string> = {
  low: 'Low',
  basic: 'Basic',
  middle: 'Middle',
  high: 'High',
};

const FREIGHT_LABELS: Record<FreightLotSize, string> = {
  incidental: 'Incidental',
  minor: 'Minor',
  major: 'Major',
};

type TradeContactMethod = 'standard' | 'blackMarket' | 'online';

interface TradeContactMethodOption {
  id: TradeContactMethod;
  label: string;
  sub: string;
  disabled?: boolean;
}

interface AvailableLot {
  id: string;
  good: TradeGood;
  purchaseDm: number;
  saleDm: number;
  roll: RolledTons | null;
  tons: number;
}

interface CartItem {
  id: string;
  good: TradeGood;
  tons: number;
  purchaseDm: number;
  saleDm: number;
  roll?: number[];
  price?: ModifiedPriceResult;
}

interface SaleQuote {
  deal: TradeDeal;
  good: TradeGood | null;
  roll: number[];
  price: ModifiedPriceResult;
  unitPrice: number;
  profit: number | null;
  commission: number;
  netProfit: number | null;
}

interface SkillCheck {
  dice: number[];
  dm: number;
  total: number;
  success: boolean;
  effect: number;
  duration: number;
  durationUnit: 'days' | 'hours';
  label: string;
  characterName: string;
  skillName: string;
  statKey: CharStat | null;
  charDm: number;
  skillLevel: number;
  contextDm: number;
  bonusDm: number;
}

interface TradeSessionPanelProps {
  deals: TradeDeal[];
  characters?: Character[];
  onCreateDeals: (payloads: TradeDealDraft[]) => Promise<void>;
  onUpdateDeal: (id: string, patch: Partial<TradeDeal>) => Promise<void>;
  busy?: boolean;
}

interface PassengersFreightPanelProps {
  characters?: Character[];
}

interface PassengerResultRow {
  passengerClass: PassengerClass;
  roll: number[];
  passengerRolls: number[];
  total: number;
  dice: number;
  passengers: number;
  fare: number;
  income: number;
}

interface FreightResultRow {
  lotSize: FreightLotSize;
  roll: number[];
  lotRolls: number[];
  total: number;
  dice: number;
  lots: number;
  tons: number;
  ratePerTon: number;
  income: number;
}

interface MailResult {
  roll: number[];
  dm: number;
  total: number;
  containers: number;
  income: number;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="label block">{label}</span>
      {children}
    </label>
  );
}

function SmallReadout({ label, value, tone = 'text-cyan-trav' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border border-steel/50 bg-panel/50 px-3 py-2 min-h-16">
      <div className="text-[10px] text-body/55 tracking-widest font-mono">{label}</div>
      <div className={`mt-1 text-sm font-mono font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function numberFromInput(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

function catalogWorldLabel(world: TrojanReachWorld): string {
  return `${world.name} ${world.hex} · ${world.uwp} · ${world.tradeCodes.length > 0 ? world.tradeCodes.join(' ') : 'No trade codes'}`;
}

function WorldCatalogPanel({
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
  onSelect: (world: TrojanReachWorld, target: 'source' | 'destination') => void;
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
            onClick={() => onSelect(world, target)}
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

function firstCharacterId(characters: Character[]): string {
  return characters[0]?.id ?? '';
}

function bestCharacterId(
  characters: Character[],
  scoreFor: (character: Character) => [number, number],
): string {
  let bestId = '';
  let bestScore: [number, number] | null = null;

  characters.forEach(character => {
    const score = scoreFor(character);
    if (
      bestScore === null
      || score[0] > bestScore[0]
      || (score[0] === bestScore[0] && score[1] > bestScore[1])
    ) {
      bestId = character.id;
      bestScore = score;
    }
  });

  return bestId;
}

function bestSkillCharacterId(characters: Character[], skillName: string, statKey?: CharStat | null): string {
  return bestCharacterId(characters, character => {
    const check = characterSkillCheckDm(character, skillName, statKey);
    return [check.skillLevel, check.totalDm];
  });
}

function bestStatCharacterId(characters: Character[], statKey: CharStat): string {
  return bestCharacterId(characters, character => {
    const value = effectiveCharacterStat(character, statKey);
    return [statDM(value), value ?? -999];
  });
}

function useSelectedCharacter(characters: Character[], preferredId = firstCharacterId(characters), preferenceKey = preferredId) {
  const validPreferredId = characters.some(character => character.id === preferredId)
    ? preferredId
    : firstCharacterId(characters);
  const [selectedId, setSelectedIdState] = useState(validPreferredId);
  const [manualOverride, setManualOverride] = useState(false);
  const [activePreferenceKey, setActivePreferenceKey] = useState(preferenceKey);

  useEffect(() => {
    if (characters.length === 0) {
      if (selectedId) setSelectedIdState('');
      if (manualOverride) setManualOverride(false);
      return;
    }

    if (preferenceKey !== activePreferenceKey) {
      setActivePreferenceKey(preferenceKey);
      setManualOverride(false);
      setSelectedIdState(validPreferredId);
      return;
    }

    if (!characters.some(character => character.id === selectedId)) {
      setSelectedIdState(validPreferredId);
      setManualOverride(false);
      return;
    }

    if (!manualOverride && selectedId !== validPreferredId) {
      setSelectedIdState(validPreferredId);
    }
  }, [activePreferenceKey, characters, manualOverride, preferenceKey, selectedId, validPreferredId]);

  function setSelectedId(id: string) {
    setManualOverride(true);
    setSelectedIdState(id);
  }

  return {
    selectedId,
    setSelectedId,
    selectedCharacter: characters.find(character => character.id === selectedId) ?? null,
  };
}

function CharacterSelect({
  label,
  characters,
  selectedId,
  onChange,
  className = 'select text-xs',
}: {
  label: string;
  characters: Character[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <select
      className={className}
      aria-label={label}
      value={selectedId}
      onChange={e => onChange(e.target.value)}
      disabled={characters.length === 0}
    >
      {characters.length === 0 && <option value="">No roster characters</option>}
      {characters.map(character => (
        <option key={character.id} value={character.id}>{character.name}</option>
      ))}
    </select>
  );
}

function CharacterCheckControl({
  label,
  buttonLabel,
  characters,
  skills,
  defaultSkill,
  contextDm = 0,
  difficulty = 8,
  showDuration = false,
  result,
  disabledReason,
  onRolled,
}: {
  label: string;
  buttonLabel: string;
  characters: Character[];
  skills: readonly string[];
  defaultSkill: string;
  contextDm?: number;
  difficulty?: number;
  showDuration?: boolean;
  result?: SkillCheck | null;
  disabledReason?: string;
  onRolled: (check: SkillCheck) => void;
}) {
  const [skillName, setSkillName] = useState(defaultSkill);
  const [statKey, setStatKey] = useState<CharStat | null>(skillChar(defaultSkill));
  const preferredCharacterId = useMemo(
    () => bestSkillCharacterId(characters, skillName, statKey),
    [characters, skillName, statKey],
  );
  const { selectedId, setSelectedId, selectedCharacter } = useSelectedCharacter(
    characters,
    preferredCharacterId,
    `${skillName}:${statKey ?? 'none'}`,
  );
  const [bonusDmInput, setBonusDmInput] = useState('0');
  const bonusDm = numberFromInput(bonusDmInput, 0);
  const checkDm = selectedCharacter ? characterSkillCheckDm(selectedCharacter, skillName, statKey) : null;
  const totalDm = (checkDm?.totalDm ?? 0) + contextDm + bonusDm;

  function changeSkill(nextSkill: string) {
    setSkillName(nextSkill);
    setStatKey(skillChar(nextSkill));
  }

  function rollCheck() {
    if (!selectedCharacter || !checkDm) return;
    const roll = rollTravellerCheck({
      label,
      difficulty,
      modifier: totalDm,
      mode: 'normal',
    });
    const durationUnit = skillName === 'Admin' ? 'hours' : 'days';
    onRolled({
      dice: roll.kept,
      dm: totalDm,
      total: roll.total,
      success: roll.success,
      effect: roll.effect,
      duration: showDuration ? (rollDice(1)[0] ?? 1) : 0,
      durationUnit,
      label,
      characterName: selectedCharacter.name,
      skillName,
      statKey,
      charDm: checkDm.charDm,
      skillLevel: checkDm.skillLevel,
      contextDm,
      bonusDm,
    });
  }

  return (
    <div className="border border-steel/50 bg-void/40 p-3 space-y-3">
      <div className="label">{label.toUpperCase()}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Character">
          <CharacterSelect
            label={`${label} Character`}
            characters={characters}
            selectedId={selectedId}
            onChange={setSelectedId}
            className="select text-xs"
          />
        </Field>
        <Field label="Skill">
          <select className="select text-xs" aria-label={`${label} Skill`} value={skillName} onChange={e => changeSkill(e.target.value)}>
            {skills.map(skill => <option key={skill} value={skill}>{skill}</option>)}
          </select>
        </Field>
        <Field label="Characteristic">
          <select
            className="select text-xs"
            aria-label={`${label} Characteristic`}
            value={statKey ?? ''}
            onChange={e => setStatKey(e.target.value ? e.target.value as CharStat : null)}
          >
            <option value="">None</option>
            {CHECK_STATS.map(stat => <option key={stat} value={stat}>{STAT_LABELS[stat]}</option>)}
          </select>
        </Field>
        <Field label="Bonus DM">
          <NumberStepper
            ariaLabel={`${label} Bonus DM`}
            value={bonusDmInput}
            onChange={setBonusDmInput}
            inputClassName="input text-xs"
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={rollCheck} disabled={!selectedCharacter || !!disabledReason} className="btn-amber text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
          <Dice5 size={13} /> {buttonLabel}
        </button>
        {disabledReason && <span className="text-[10px] font-mono text-alert/70">{disabledReason}</span>}
        {checkDm && (
          <span className="text-[11px] font-mono text-body/70">
            {checkDm.characterName} {checkDm.skillName} {checkDm.statKey ? STAT_LABELS[checkDm.statKey] : 'NO STAT'} {fmtDM(checkDm.charDm)}
            {' '}+ SKILL {fmtDM(checkDm.skillLevel)} + CTX {fmtDM(contextDm)} + BONUS {fmtDM(bonusDm)} = {fmtDM(totalDm)}
          </span>
        )}
      </div>
      {result && (
        <div className={`border px-3 py-2 text-xs font-mono ${result.success ? 'border-safe/50 text-safe' : 'border-alert/50 text-alert'}`}>
          {result.characterName} · {result.skillName}/{result.statKey ? STAT_LABELS[result.statKey] : 'NONE'} [{result.dice.join('+')}] {fmtDM(result.dm)} = {result.total}
          {' '}· EFFECT {fmtDM(result.effect)} · {result.success ? 'SUCCESS' : 'FAILURE'}
          {showDuration && ` · ${result.duration}D ${result.durationUnit}`}
        </div>
      )}
    </div>
  );
}

function CharacterSkillSetter({
  label,
  skillName,
  buttonLabel,
  characters,
  onApply,
  compact = false,
}: {
  label: string;
  skillName: string;
  buttonLabel: string;
  characters: Character[];
  onApply: (skillLevel: number) => void;
  compact?: boolean;
}) {
  const preferredCharacterId = useMemo(
    () => bestSkillCharacterId(characters, skillName),
    [characters, skillName],
  );
  const { selectedId, setSelectedId, selectedCharacter } = useSelectedCharacter(characters, preferredCharacterId, skillName);
  const skill = selectedCharacter ? characterSkillLevel(selectedCharacter, skillName) : null;

  return (
    <div className={`border border-steel/50 bg-void/40 ${compact ? 'px-2 py-1 space-y-1' : 'p-2 space-y-2'}`}>
      <div className="label">{label.toUpperCase()}</div>
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] ${compact ? 'gap-1' : 'gap-2'} items-end`}>
        <Field label="Character">
          <CharacterSelect
            label={`${label} Character`}
            characters={characters}
            selectedId={selectedId}
            onChange={setSelectedId}
            className={compact ? 'select text-xs h-7 py-0' : 'select text-xs'}
          />
        </Field>
        <button type="button" onClick={() => skill && onApply(skill.skillLevel)} disabled={!skill} className={`btn-steel text-xs ${compact ? 'h-7 px-2 py-0' : 'h-9'}`}>
          {buttonLabel}
        </button>
      </div>
      {selectedCharacter && skill && (
        <div className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-mono text-body/70 leading-tight`}>
          {selectedCharacter.name} {skillName} {fmtDM(skill.skillLevel)}
          {skill.trainedLevel === null && skill.jackOfAllTrades > 0 ? ` · JoAT +${skill.jackOfAllTrades}` : ''}
        </div>
      )}
    </div>
  );
}

function CharacterStatSetter({
  label,
  statKey,
  buttonLabel,
  characters,
  onApply,
}: {
  label: string;
  statKey: CharStat;
  buttonLabel: string;
  characters: Character[];
  onApply: (dm: number) => void;
}) {
  const preferredCharacterId = useMemo(
    () => bestStatCharacterId(characters, statKey),
    [characters, statKey],
  );
  const { selectedId, setSelectedId, selectedCharacter } = useSelectedCharacter(characters, preferredCharacterId, statKey);
  const value = selectedCharacter ? effectiveCharacterStat(selectedCharacter, statKey) : null;
  const dm = statDM(value);

  return (
    <div className="border border-steel/50 bg-void/40 p-2 space-y-2">
      <div className="label">{label.toUpperCase()}</div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
        <Field label="Character">
          <CharacterSelect label={`${label} Character`} characters={characters} selectedId={selectedId} onChange={setSelectedId} />
        </Field>
        <button type="button" onClick={() => selectedCharacter && onApply(dm)} disabled={!selectedCharacter} className="btn-steel text-xs h-9">
          {buttonLabel}
        </button>
      </div>
      {selectedCharacter && (
        <div className="text-[11px] font-mono text-body/70">
          {selectedCharacter.name} {STAT_LABELS[statKey]} {value ?? '--'} · DM {fmtDM(dm)}
        </div>
      )}
    </div>
  );
}

function WorldProfileForm({
  title,
  value,
  onChange,
}: {
  title: string;
  value: WorldProfile;
  onChange: (profile: WorldProfile) => void;
}) {
  const selectedCatalogWorld = useMemo(
    () => TROJAN_REACH_WORLDS.find(world => world.name === value.name && world.uwp === value.uwp) ?? null,
    [value.name, value.uwp],
  );

  const toggleCode = (code: string) => {
    const nextCodes = value.tradeCodes.includes(code)
      ? value.tradeCodes.filter(existing => existing !== code)
      : [...value.tradeCodes, code];
    onChange({ ...value, tradeCodes: nextCodes });
  };

  const handleUwpChange = (rawValue: string) => {
    const nextUwp = rawValue.toUpperCase().replace(/\s+/g, '');
    const parsed = parseWorldUwp(nextUwp);
    onChange(parsed
      ? {
          ...value,
          uwp: parsed.normalized,
          starport: parsed.starport,
          size: parsed.size,
          atmosphere: parsed.atmosphere,
          hydrographics: parsed.hydrographics,
          population: parsed.population,
          government: parsed.government,
          lawLevel: parsed.lawLevel,
          techLevel: parsed.techLevel,
        }
      : { ...value, uwp: nextUwp });
  };

  return (
    <section className="panel p-3 space-y-3">
      <div className="panel-header -mx-3 -mt-3 mb-1">{title.toUpperCase()} WORLD</div>
      <div className="text-[10px] font-mono text-body/50 truncate">
        {selectedCatalogWorld
          ? `CATALOG ${catalogWorldLabel(selectedCatalogWorld)} · ${selectedCatalogWorld.subsector}`
          : 'CATALOG custom/manual world'}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="col-span-2">
          <Field label={`${title} Name`}>
            <input
              className="input text-xs"
              aria-label={`${title} World Name`}
              value={value.name}
              onChange={e => onChange({ ...value, name: e.target.value })}
            />
          </Field>
        </div>
        <div className="col-span-2 md:col-span-3">
          <Field label="UWP">
            <input
              className="input text-xs font-mono uppercase"
              aria-label={`${title} UWP`}
              value={value.uwp ?? ''}
              onChange={e => handleUwpChange(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Zone">
          <select
            className="select text-xs"
            aria-label={`${title} Zone`}
            value={value.zone}
            onChange={e => onChange({ ...value, zone: e.target.value as TravelZone })}
          >
            <option value="normal">Normal</option>
            <option value="amber">Amber</option>
            <option value="red">Red</option>
          </select>
        </Field>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="label">Trade Codes</div>
          <div className="text-[10px] font-mono text-amber truncate">
            {value.tradeCodes.length > 0 ? value.tradeCodes.join(' ') : 'NONE'}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {TRAVELLER_TRADE_CODES.map(code => (
            <button
              key={code}
              type="button"
              onClick={() => toggleCode(code)}
              title={tradeCodeDescription(code)}
              aria-label={`${value.tradeCodes.includes(code) ? 'Remove' : 'Add'} ${tradeCodeDescription(code)} trade code`}
              className={`h-5 w-6 border font-mono text-[10px] font-bold leading-none transition-colors ${
                value.tradeCodes.includes(code)
                  ? 'border-amber bg-amber/20 text-amber shadow-[0_0_8px_rgba(212,160,23,0.35)]'
                  : 'border-steel/45 bg-void/60 text-body/55 hover:border-cyan-trav/70 hover:bg-cyan-trav/10 hover:text-cyan-trav'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function rollAvailableLots(source: WorldProfile, blackMarket: boolean, randomOnly = false): AvailableLot[] {
  const quantityDm = populationQuantityDm(source.population);
  const goods = randomOnly
    ? Array.from({ length: Math.max(0, source.population) }, (_, index) => {
        let good: TradeGood | undefined;
        for (let attempt = 0; attempt < 8 && !good; attempt += 1) {
          const { d2, d66 } = rollD66();
          const code = blackMarket ? 60 + d2 : d66;
          const candidate = TRADE_GOODS.find(row => row.d66 === code);
          if (!candidate) continue;
          if (!blackMarket && candidate.illegal) continue;
          good = candidate;
        }
        return good ? { good, suffix: `random-${index}` } : null;
      }).filter((entry): entry is { good: TradeGood; suffix: string } => entry !== null)
    : availableTradeGoods(TRADE_GOODS, source, blackMarket).map(good => ({ good, suffix: 'market' }));

  return goods
    .filter(({ good }) => !good.exotic && good.basePrice !== null)
    .map(({ good, suffix }, index) => {
      const roll = rollTonsWithDm(good.tons, quantityDm);
      return {
        id: `${suffix}-${good.d66}-${index}-${Date.now()}`,
        good,
        purchaseDm: tradeGoodPurchaseDm(good, source),
        saleDm: tradeGoodSaleDm(good, source),
        roll,
        tons: roll?.tons ?? 0,
      };
    });
}

function unitPrice(basePrice: number, pct: number) {
  return Math.round(basePrice * (pct / 100));
}

function BrokerSelector({
  myBrokerName,
  myBrokerSkill,
  foundBrokerSkill,
  source,
  onChange,
}: {
  myBrokerName: string;
  myBrokerSkill: number;
  foundBrokerSkill: number | null;
  source: 'my' | 'found';
  onChange: (s: 'my' | 'found') => void;
}) {
  return (
    <div className="space-y-1">
      <div className="label">NEGOTIATING BROKER</div>
      <div className="flex gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => onChange('my')}
          className={`flex flex-col items-start px-2.5 py-1.5 border text-left transition-colors ${source === 'my' ? 'border-amber bg-amber/10 text-amber' : 'border-steel/40 text-body/60 hover:text-body'}`}
        >
          <span className="text-[11px] font-mono font-bold tracking-wider">{myBrokerName}</span>
          <span className="text-[10px] text-body/40">Broker {fmtDM(myBrokerSkill)} · crew</span>
        </button>
        {foundBrokerSkill !== null ? (
          <button
            type="button"
            onClick={() => onChange('found')}
            className={`flex flex-col items-start px-2.5 py-1.5 border text-left transition-colors ${source === 'found' ? 'border-amber bg-amber/10 text-amber' : 'border-steel/40 text-body/60 hover:text-body'}`}
          >
            <span className="text-[11px] font-mono font-bold tracking-wider">FOUND BROKER</span>
            <span className="text-[10px] text-body/40">Broker {fmtDM(foundBrokerSkill)} · best effect</span>
          </button>
        ) : (
          <div className="flex flex-col items-start px-2.5 py-1.5 border border-steel/20 text-body/25 opacity-40 select-none">
            <span className="text-[11px] font-mono font-bold tracking-wider">FOUND BROKER</span>
            <span className="text-[10px]">no successful roll yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

const TRADE_STEPS = [
  { id: 'supplier', label: 'FIND SUPPLIER' },
  { id: 'goods', label: 'GOODS' },
  { id: 'purchase', label: 'PURCHASE' },
  { id: 'travel', label: 'TRAVEL' },
  { id: 'buyer', label: 'FIND BUYER' },
  { id: 'sell', label: 'SELL' },
] as const;

export function TradeSessionPanel({ deals, characters = [], onCreateDeals, onUpdateDeal, busy = false }: TradeSessionPanelProps) {
  const [source, setSource] = useState<WorldProfile>(DEFAULT_SOURCE);
  const [destination, setDestination] = useState<WorldProfile>(DEFAULT_DESTINATION);
  const [sessionRef, setSessionRef] = useState('Session Trade Run');
  const [supplierBroker, setSupplierBroker] = useState(2);
  const [buyerBroker, setBuyerBroker] = useState(2);
  const brokerPreferredId = useMemo(() => bestSkillCharacterId(characters, 'Broker'), [characters]);
  const { selectedId: brokerCharacterId, setSelectedId: setBrokerCharacterId, selectedCharacter: brokerCharacter } = useSelectedCharacter(characters, brokerPreferredId, 'Broker');
  const brokerSkillInfo = brokerCharacter ? characterSkillLevel(brokerCharacter, 'Broker') : null;
  const brokerSkill = brokerSkillInfo?.skillLevel ?? 0;
  const [supplierAttempts, setSupplierAttempts] = useState(0);
  const [buyerAttempts, setBuyerAttempts] = useState(0);
  const [supplierMethod, setSupplierMethod] = useState<TradeContactMethod>('standard');
  const [buyerMethod, setBuyerMethod] = useState<TradeContactMethod>('standard');
  const blackMarket = supplierMethod === 'blackMarket';
  const [supplierRolls, setSupplierRolls] = useState<SkillCheck[]>([]);
  const [buyerRolls, setBuyerRolls] = useState<SkillCheck[]>([]);
  const [purchaseBrokerSource, setPurchaseBrokerSource] = useState<'my' | 'found'>('my');
  const [sellBrokerSource, setSellBrokerSource] = useState<'my' | 'found'>('my');
  const [lots, setLots] = useState<AvailableLot[]>([]);
  const [parsecs, setParsecs] = useState(1);
  const [travelDice, setTravelDice] = useState<number[] | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleQuotes, setSaleQuotes] = useState<SaleQuote[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [worldCatalogQuery, setWorldCatalogQuery] = useState('');
  const [worldCatalogTarget, setWorldCatalogTarget] = useState<'source' | 'destination'>('source');
  const [tradeStep, setTradeStep] = useState(0);
  const [lotsSort, setLotsSort] = useState<{ col: 'good' | 'tons' | 'base' | 'buyDm' | 'sellDm'; dir: 'asc' | 'desc' } | null>(null);

  const activeDeals = useMemo(() => deals.filter(deal => deal.status === 'active'), [deals]);
  const supplierCheck = supplierRolls[supplierRolls.length - 1] ?? null;
  const buyerCheck = buyerRolls[buyerRolls.length - 1] ?? null;
  const foundSupplierBrokerSkill = supplierRolls.some(r => r.success)
    ? Math.max(...supplierRolls.filter(r => r.success).map(r => r.effect))
    : null;
  const foundBuyerBrokerSkill = buyerRolls.some(r => r.success)
    ? Math.max(...buyerRolls.filter(r => r.success).map(r => r.effect))
    : null;
  const effectivePurchaseBrokerSkill = purchaseBrokerSource === 'found' && foundSupplierBrokerSkill !== null ? foundSupplierBrokerSkill : brokerSkill;
  const effectiveSellBrokerSkill = sellBrokerSource === 'found' && foundBuyerBrokerSkill !== null ? foundBuyerBrokerSkill : brokerSkill;
  // DM-1 per previous attempt this month (manual pre-session + in-session rolls already made)
  const sourceSupplierDm = supplierStarportDm(source.starport) - supplierAttempts;
  const buyerFindDm = supplierStarportDm(destination.starport) - buyerAttempts;
  const cartTotal = cart.reduce((sum, item) => {
    if (!item.price || item.good.basePrice === null) return sum;
    return sum + calculateLotCost(item.good.basePrice, item.price.row.purchasePct, item.tons);
  }, 0);
  const travelWeeks = travelDice ? travelDice.reduce((s, d) => s + d, 0) : 0;
  const supplierDays = supplierRolls.reduce((s, r) => s + (r.durationUnit === 'days' ? r.duration : 0), 0);
  const buyerDays = buyerRolls.reduce((s, r) => s + (r.durationUnit === 'days' ? r.duration : 0), 0);
  const totalDays = supplierDays + travelWeeks * 7 + buyerDays;

  function handleTradeCheck(kind: 'supplier' | 'buyer', check: SkillCheck) {
    if (kind === 'supplier') {
      setSupplierRolls(current => [...current, check]);
      setSupplierAttempts(a => Math.min(3, a + 1));
    } else {
      setBuyerRolls(current => [...current, check]);
      setBuyerAttempts(a => Math.min(3, a + 1));
    }
  }

  function rollTravel() {
    setTravelDice(rollDice(parsecs));
  }

  function handleCatalogSelect(world: TrojanReachWorld, target: 'source' | 'destination') {
    const profile = profileFromCatalogWorld(world);
    if (target === 'source') setSource(profile);
    else setDestination(profile);
  }

  function addLotToCart(lot: AvailableLot) {
    if (lot.good.basePrice === null) return;
    setCart(current => [
      ...current,
      {
        id: `cart-${lot.id}-${current.length}`,
        good: lot.good,
        tons: Math.max(1, lot.tons),
        purchaseDm: lot.purchaseDm,
        saleDm: lot.saleDm,
      },
    ]);
  }

  function priceCart() {
    setCart(current => current.map(item => {
      if (item.good.basePrice === null) return item;
      const roll = rollDice(3);
      const price = applyPurchaseDMs(
        roll.reduce((sum, die) => sum + die, 0),
        effectivePurchaseBrokerSkill,
        item.purchaseDm,
        item.saleDm,
        supplierBroker,
      );
      return { ...item, roll, price };
    }));
  }

  async function purchaseCart() {
    const priced = cart.filter(item => item.price && item.good.basePrice !== null);
    if (priced.length === 0) {
      setMessage('Price the cart before purchasing.');
      return;
    }

    await onCreateDeals(priced.map(item => ({
      item: item.good.type,
      quantity: item.tons,
      buy_price: unitPrice(item.good.basePrice!, item.price!.row.purchasePct),
      sell_price: null,
      status: 'active',
      world_bought: source.name || null,
      world_sold: null,
      notes: `Trade session ${sessionRef}; purchase roll ${item.price!.rawRoll} -> ${item.price!.row.purchasePct}%`,
      session_ref: sessionRef || null,
      base_price: item.good.basePrice,
      purchase_pct: item.price!.row.purchasePct,
      sale_pct: null,
      trade_code: item.good.availability,
    })));
    setCart([]);
    setMessage('Purchased cargo was added to the Deals Ledger.');
  }

  function priceActiveDeals() {
    setSaleQuotes(activeDeals.flatMap(deal => {
      const good = TRADE_GOODS.find(row => row.type === deal.item) ?? null;
      const basePrice = deal.base_price ?? good?.basePrice ?? deal.buy_price;
      if (!basePrice) return [];
      const purchaseDm = good ? tradeGoodPurchaseDm(good, destination) : 0;
      const saleDm = good ? tradeGoodSaleDm(good, destination) : 0;
      const roll = rollDice(3);
      const price = applySaleDMs(
        roll.reduce((sum, die) => sum + die, 0),
        effectiveSellBrokerSkill,
        saleDm,
        purchaseDm,
        buyerBroker,
      );
      const sellUnit = unitPrice(basePrice, price.row.salePct);
      const grossProceeds = sellUnit * deal.quantity;
      const commissionRate = sellBrokerSource === 'found' ? (buyerMethod === 'blackMarket' ? 0.20 : 0.10) : 0;
      const commission = Math.round(grossProceeds * commissionRate);
      const rawProfit = deal.buy_price === null ? null : (sellUnit - deal.buy_price) * deal.quantity;
      return [{
        deal,
        good,
        roll,
        price,
        unitPrice: sellUnit,
        profit: rawProfit,
        commission,
        netProfit: rawProfit === null ? null : rawProfit - commission,
      }];
    }));
  }

  async function sellQuotedDeal(quote: SaleQuote) {
    await onUpdateDeal(quote.deal.id, {
      status: 'completed',
      sell_price: quote.unitPrice,
      world_sold: destination.name || null,
      sale_pct: quote.price.row.salePct,
      updated_at: new Date().toISOString(),
    });
    setSaleQuotes(current => current.filter(row => row.deal.id !== quote.deal.id));
  }

  function stepDone(i: number): boolean {
    if (i === 0) return supplierRolls.length > 0;
    if (i === 1) return lots.length > 0;
    if (i === 2) return activeDeals.length > 0;
    if (i === 3) return travelDice !== null;
    if (i === 4) return buyerRolls.length > 0;
    return false;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="w-80 flex-shrink-0 border-r border-steel/50 flex flex-col overflow-hidden bg-panel/40">
        {/* Sticky tiles — never scroll */}
        <div className="flex-shrink-0 p-3 space-y-2 border-b border-steel/30">
          {([
            { label: 'SOURCE', world: source, tone: 'text-amber' },
            { label: 'DESTINATION', world: destination, tone: 'text-cyan-trav' },
          ] as const).map(({ label, world, tone }) => (
            <div key={label} className="panel px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[10px] font-mono text-body/45 tracking-widest">{label}</span>
                {world.zone !== 'normal' && (
                  <span className={`text-[9px] font-mono border px-1 ${world.zone === 'amber' ? 'border-amber/60 text-amber' : 'border-alert/60 text-alert'}`}>{world.zone.toUpperCase()}</span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-bright truncate">{world.name || '—'}</span>
                {world.uwp && <span className="text-[11px] font-mono text-body/55">{world.uwp}</span>}
              </div>
              {world.tradeCodes.length > 0 && (
                <div className={`mt-0.5 text-[10px] font-mono ${tone}/70`}>{world.tradeCodes.join(' ')}</div>
              )}
            </div>
          ))}
          <div className="panel px-3 py-2">
            <div className="text-[10px] font-mono text-body/45 tracking-widest mb-1.5">MY BROKER</div>
            <CharacterSelect
              label="Broker Character"
              characters={characters}
              selectedId={brokerCharacterId}
              onChange={setBrokerCharacterId}
              className="select text-xs w-full"
            />
            {brokerCharacter && brokerSkillInfo && (
              <div className="mt-1 text-[10px] font-mono text-body/55">
                {brokerCharacter.name} · Broker {fmtDM(brokerSkill)}
              </div>
            )}
          </div>
        </div>

        {/* World catalog — scrollable */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-body/45 flex-1">SESSION</span>
            <input
              className="input text-xs h-6 py-0 flex-1"
              aria-label="Trade Session Reference"
              value={sessionRef}
              onChange={e => setSessionRef(e.target.value)}
            />
          </div>
          <WorldCatalogPanel
            containerClassName="space-y-3"
            query={worldCatalogQuery}
            onQueryChange={setWorldCatalogQuery}
            target={worldCatalogTarget}
            onTargetChange={setWorldCatalogTarget}
            onSelect={handleCatalogSelect}
          />
        </div>
      </aside>

      {/* MAIN WIZARD */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step Progress Bar */}
        <div className="flex items-center gap-1 px-4 py-2 bg-void/60 border-b border-steel/30 overflow-x-auto flex-shrink-0">
          {TRADE_STEPS.map((step, i) => {
            const done = stepDone(i);
            const active = i === tradeStep;
            return (
              <React.Fragment key={step.id}>
                {i > 0 && <span className="text-steel/40 text-[10px] flex-shrink-0">›</span>}
                <button
                  type="button"
                  onClick={() => setTradeStep(i)}
                  className={`flex items-center gap-1 px-1 py-0.5 transition-colors flex-shrink-0 ${active ? 'text-amber' : done ? 'text-safe/70' : 'text-body/40 hover:text-body/70'}`}
                >
                  <span className={`w-5 h-5 border rounded-full flex items-center justify-center text-[10px] font-mono flex-shrink-0 ${active ? 'border-amber' : done ? 'border-safe/60' : 'border-steel/40'}`}>
                    {done && !active ? '✓' : i + 1}
                  </span>
                  <span className="text-[10px] font-mono tracking-wider hidden sm:inline whitespace-nowrap">{step.label}</span>
                </button>
              </React.Fragment>
            );
          })}
          {totalDays > 0 && (
            <div className="ml-auto pl-4 flex items-center gap-1.5 flex-shrink-0 border border-amber/40 bg-amber/10 px-2.5 py-1 rounded">
              <Clock size={11} className="text-amber/70" />
              <span className="text-xs font-mono font-bold text-amber tracking-widest">{totalDays} DAYS</span>
            </div>
          )}
        </div>

        {/* Phase banner */}
        {tradeStep <= 2 ? (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-amber/5 border-b border-amber/20 flex-shrink-0">
            <div className="h-px flex-1 bg-amber/20" />
            <span className="text-[10px] font-mono text-amber tracking-widest">BUYING AT {source.name || 'SOURCE'}</span>
            <div className="h-px flex-1 bg-amber/20" />
          </div>
        ) : tradeStep === 3 ? (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-steel/10 border-b border-steel/30 flex-shrink-0">
            <div className="h-px flex-1 bg-steel/20" />
            <span className="text-[10px] font-mono text-body/50 tracking-widest">✦ TRANSIT ✦</span>
            <div className="h-px flex-1 bg-steel/20" />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-cyan-trav/5 border-b border-cyan-trav/20 flex-shrink-0">
            <div className="h-px flex-1 bg-cyan-trav/20" />
            <span className="text-[10px] font-mono text-cyan-trav tracking-widest">SELLING AT {destination.name || 'DESTINATION'}</span>
            <div className="h-px flex-1 bg-cyan-trav/20" />
          </div>
        )}

        {/* Message banner */}
        {message && (
          <div className="border-b border-cyan-trav/40 bg-cyan-trav/10 px-4 py-2 text-xs text-cyan-trav flex items-center justify-between gap-3 flex-shrink-0">
            <span>{message}</span>
            <button type="button" aria-label="Dismiss trade session message" onClick={() => setMessage(null)} className="hover:text-bright">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tradeStep === 0 && (
            <section className="panel p-3 space-y-3">
              <div className="panel-header -mx-3 -mt-3 mb-1">FIND SUPPLIER</div>
              {/* Method selector */}
              <div className="space-y-1">
                <div className="label">METHOD</div>
                <div className="flex gap-1 flex-wrap">
                  {([
                    { id: 'standard', label: 'BROKER', sub: 'Broker · 1D days' },
                    { id: 'blackMarket', label: '⚠ BLACK MARKET', sub: 'Streetwise · 1D days' },
                    { id: 'online', label: 'ONLINE', sub: `Admin · 1D hours${(source.techLevel ?? 0) < 8 ? ' · TL8+ only' : ''}`, disabled: (source.techLevel ?? 0) < 8 },
                  ] satisfies TradeContactMethodOption[]).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={m.disabled}
                      onClick={() => setSupplierMethod(m.id)}
                      className={`flex flex-col items-start px-2.5 py-1.5 border text-left transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${supplierMethod === m.id ? 'border-amber bg-amber/10 text-amber' : 'border-steel/40 text-body/60 hover:text-body'}`}
                    >
                      <span className="text-[11px] font-mono font-bold tracking-wider">{m.label}</span>
                      <span className="text-[10px] text-body/40">{m.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Field label="Prior Attempts (month)">
                  <NumberStepper ariaLabel="Supplier Attempts" min={0} max={3} value={supplierAttempts} onChange={value => setSupplierAttempts(numberFromInput(value, supplierAttempts))} inputClassName="input text-xs" />
                </Field>
                <Field label="Supplier Broker">
                  <NumberStepper ariaLabel="Supplier Broker Skill" value={supplierBroker} onChange={v => setSupplierBroker(numberFromInput(v, supplierBroker))} inputClassName="input text-xs" />
                </Field>
                <SmallReadout label="CONTEXT DM (next roll)" value={fmtDM(sourceSupplierDm)} />
              </div>
              {supplierRolls.length > 0 && (
                <div className="space-y-1">
                  {(() => {
                    const bestIdx = supplierRolls.reduce((best, r, i) =>
                      r.success && (best === -1 || r.effect > supplierRolls[best]!.effect) ? i : best, -1);
                    return supplierRolls.map((roll, i) => {
                      const isBest = i === bestIdx;
                      return (
                        <div key={i} className={`border px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 ${isBest ? 'border-amber bg-amber/10 text-amber' : roll.success ? 'border-safe/50 text-safe' : 'border-alert/50 text-alert'}`}>
                          <span className={`text-[10px] ${isBest ? 'text-amber/70' : 'text-body/40'}`}>#{i + 1}</span>
                          <span className="flex-1">{roll.characterName} · {roll.skillName} [{roll.dice.join('+')}] {fmtDM(roll.dm)} = {roll.total} · EFF {fmtDM(roll.effect)} · {roll.success ? 'SUCCESS' : 'FAILURE'}</span>
                          {isBest && <span className="text-[10px] tracking-widest font-bold">BEST ›</span>}
                          <span className={isBest ? 'text-amber/60' : 'text-body/50'}>{roll.duration}{roll.durationUnit === 'days' ? 'd' : 'h'}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
              <CharacterCheckControl
                key={supplierMethod}
                label="Supplier Check"
                buttonLabel="ROLL SUPPLIER"
                characters={characters}
                skills={TRADE_CHECK_SKILLS}
                defaultSkill={supplierMethod === 'blackMarket' ? 'Streetwise' : supplierMethod === 'online' ? 'Admin' : 'Broker'}
                contextDm={sourceSupplierDm}
                showDuration
                result={supplierCheck}
                disabledReason={supplierAttempts >= 3 ? 'Max 3 attempts per month reached' : undefined}
                onRolled={check => handleTradeCheck('supplier', check)}
              />
              <div className="flex justify-end pt-3 border-t border-steel/20 mt-1">
                <button type="button" onClick={() => setTradeStep(1)} className={`text-xs font-mono tracking-widest px-4 py-1.5 border transition-colors ${stepDone(0) ? 'btn-amber' : 'border-steel/30 text-body/30 hover:text-body/50'}`}>
                  NEXT ›
                </button>
              </div>
            </section>
          )}

          {tradeStep === 1 && (
            <section className="panel overflow-hidden">
              <div className="panel-header flex items-center justify-between gap-3">
                <span>GOODS AVAILABLE</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setLots(rollAvailableLots(source, blackMarket, false))} className="btn-amber text-xs flex items-center gap-1">
                    <RefreshCcw size={12} /> ROLL LOTS
                  </button>
                  <button type="button" onClick={() => setLots(current => [...current, ...rollAvailableLots(source, blackMarket, true)])} className="btn-steel text-xs">
                    RANDOM
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-steel">
                      {([
                        { col: 'good', label: 'Good' },
                        { col: 'tons', label: 'Tons' },
                        { col: 'base', label: 'Base' },
                        { col: 'buyDm', label: 'Buy DM' },
                        { col: 'sellDm', label: 'Sell DM' },
                      ] as const).map(({ col, label }) => (
                        <th key={col} className="table-header">
                          <button
                            type="button"
                            onClick={() => setLotsSort(s => s?.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })}
                            className={`flex items-center gap-1 hover:text-amber transition-colors ${lotsSort?.col === col ? 'text-amber' : ''}`}
                          >
                            {label}
                            <span className="text-[10px]">{lotsSort?.col === col ? (lotsSort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
                          </button>
                        </th>
                      ))}
                      <th className="table-header"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lotsSort ? [...lots].sort((a, b) => {
                      let d = 0;
                      if (lotsSort.col === 'good') d = a.good.type.localeCompare(b.good.type);
                      else if (lotsSort.col === 'tons') d = a.tons - b.tons;
                      else if (lotsSort.col === 'base') d = (a.good.basePrice ?? 0) - (b.good.basePrice ?? 0);
                      else if (lotsSort.col === 'buyDm') d = a.purchaseDm - b.purchaseDm;
                      else if (lotsSort.col === 'sellDm') d = a.saleDm - b.saleDm;
                      return lotsSort.dir === 'asc' ? d : -d;
                    }) : lots).map(lot => (
                      <tr key={lot.id} className="table-row">
                        <td className="table-cell">
                          <div className="font-bold text-bright">{lot.good.type}</div>
                          <div className="text-[10px] text-body/55">{formatTradeCodeList(lot.good.availability)}</div>
                        </td>
                        <td className="table-cell">
                          <div>{lot.tons}t</div>
                          {lot.roll && <div className="text-[10px] text-body/50">[{lot.roll.dice.join('+')}] {lot.roll.modifier >= 0 ? '+' : ''}{lot.roll.modifier} x{lot.roll.multiplier}</div>}
                        </td>
                        <td className="table-cell">{formatBasePrice(lot.good.basePrice)}</td>
                        <td className={`table-cell text-xs font-mono ${lot.purchaseDm > 0 ? 'text-safe' : lot.purchaseDm < 0 ? 'text-alert' : ''}`}>{fmtDM(lot.purchaseDm)}</td>
                        <td className={`table-cell text-xs font-mono ${lot.saleDm > 0 ? 'text-safe' : lot.saleDm < 0 ? 'text-alert' : ''}`}>{fmtDM(lot.saleDm)}</td>
                        <td className="table-cell text-right">
                          {cart.some(item => item.good.type === lot.good.type) ? (
                            <span className="text-[10px] font-mono text-amber flex items-center gap-1 justify-end"><Check size={11} /> IN CART</span>
                          ) : (
                            <button type="button" onClick={() => addLotToCart(lot)} className="btn-steel text-xs flex items-center gap-1 ml-auto">
                              <Plus size={12} /> CART
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {lots.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-body/60 text-xs">Roll lots to see what goods are available from {source.name || 'the source world'}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end p-3 border-t border-steel/20">
                <button type="button" onClick={() => setTradeStep(2)} className={`text-xs font-mono tracking-widest px-4 py-1.5 border transition-colors ${stepDone(1) ? 'btn-amber' : 'border-steel/30 text-body/30 hover:text-body/50'}`}>
                  NEXT ›
                </button>
              </div>
            </section>
          )}

          {tradeStep === 2 && (
            <section className="panel p-3 space-y-3">
              <div className="panel-header -mx-3 -mt-3 mb-1 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2"><ShoppingCart size={13} /> PURCHASE CART</span>
                {cartTotal > 0 && <span className="font-mono text-sm text-amber">{formatCr(cartTotal)}</span>}
              </div>
              <BrokerSelector
                myBrokerName={brokerCharacter?.name ?? 'My Broker'}
                myBrokerSkill={brokerSkill}
                foundBrokerSkill={foundSupplierBrokerSkill}
                source={purchaseBrokerSource}
                onChange={setPurchaseBrokerSource}
              />
              <div className="space-y-2">
                {cart.map(item => {
                  const basePrice = item.good.basePrice ?? 0;
                  const purchasePct = item.price?.row.purchasePct ?? null;
                  const cost = purchasePct === null ? null : calculateLotCost(basePrice, purchasePct, item.tons);
                  return (
                    <div key={item.id} className="border border-steel/50 bg-void/40 p-2 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-bright truncate">{item.good.type}</div>
                          <div className="text-[10px] text-body/55">Buy DM {fmtDM(item.purchaseDm)} · Sale DM {fmtDM(item.saleDm)} · Base {formatBasePrice(item.good.basePrice)}</div>
                        </div>
                        <button type="button" aria-label={`Remove ${item.good.type} from cart`} onClick={() => setCart(current => current.filter(row => row.id !== item.id))} className="text-alert/70 hover:text-alert">
                          <X size={12} />
                        </button>
                      </div>
                      <Field label="Tons">
                        <NumberStepper
                          ariaLabel={`${item.good.type} tons`}
                          min={1}
                          value={item.tons}
                          onChange={value => setCart(current => current.map(row => row.id === item.id ? { ...row, tons: numberFromInput(value, row.tons) } : row))}
                          inputClassName="input text-xs py-1"
                        />
                      </Field>
                      {item.price && (
                        <div className="text-xs font-mono text-body/70">
                          [{item.roll?.join('+')}] {'→'} {item.price.rawRoll} / {item.price.clampedRoll} · {item.price.row.purchasePct}% · {formatCr(cost)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {cart.length === 0 && (
                  <div className="text-center text-xs text-body/50 py-4">Go to GOODS to add items to your cart.</div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap border-t border-steel/30 pt-3">
                <button type="button" onClick={priceCart} disabled={cart.length === 0} className="btn-steel text-xs flex items-center gap-1">
                  <Dice5 size={13} /> PRICE
                </button>
                <button type="button" onClick={purchaseCart} disabled={busy || cart.length === 0} className="btn-amber text-xs flex items-center gap-1">
                  <Check size={13} /> PURCHASE ALL
                </button>
                {cart.length > 0 && <span className="text-[11px] font-mono text-body/55">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>}
                <button type="button" onClick={() => setTradeStep(3)} className={`ml-auto text-xs font-mono tracking-widest px-4 py-1.5 border transition-colors ${stepDone(2) ? 'btn-amber' : 'border-steel/30 text-body/30 hover:text-body/50'}`}>
                  NEXT ›
                </button>
              </div>
            </section>
          )}

          {tradeStep === 3 && (
            <section className="panel p-4 space-y-4">
              <div className="panel-header -mx-4 -mt-4 mb-2">TRAVEL</div>
              {/* Route visual */}
              <div className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0 text-right">
                  <div className="text-sm font-bold text-amber truncate">{source.name || '—'}</div>
                  {source.uwp && <div className="text-[10px] font-mono text-body/45">{source.uwp}</div>}
                </div>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative w-28 flex items-center">
                    <div className="h-px flex-1 bg-steel/50" />
                    <Truck size={16} className={`flex-shrink-0 mx-1 transition-colors ${travelDice ? 'text-amber' : 'text-body/30'}`} />
                    <div className="h-px flex-1 bg-steel/50" />
                  </div>
                  <span className="text-[10px] font-mono text-body/40">{parsecs} parsec{parsecs !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-cyan-trav truncate">{destination.name || '—'}</div>
                  {destination.uwp && <div className="text-[10px] font-mono text-body/45">{destination.uwp}</div>}
                </div>
              </div>
              {/* Parsecs control */}
              <div className="flex items-center gap-3 border-t border-steel/20 pt-3">
                <span className="text-[10px] font-mono text-body/50 flex-1 tracking-widest">PARSECS / JUMPS</span>
                <NumberStepper ariaLabel="Travel Parsecs" min={1} max={6} value={parsecs} onChange={v => { setParsecs(numberFromInput(v, parsecs)); setTravelDice(null); }} inputClassName="input text-xs h-7 py-0 w-14" />
              </div>
              {/* Roll transit */}
              <div className="space-y-2">
                <button type="button" onClick={rollTravel} className="btn-amber text-xs flex items-center gap-1">
                  <Dice5 size={13} /> ROLL TRANSIT
                </button>
                {travelDice && (
                  <div className="border border-steel/40 bg-void/40 px-3 py-2 text-xs font-mono space-y-1">
                    <div className="text-body/60">
                      {parsecs === 1 ? '1D weeks' : `${parsecs}×1D weeks`}: [{travelDice.join('+')}] = <span className="text-bright font-bold">{travelWeeks} week{travelWeeks !== 1 ? 's' : ''}</span> <span className="text-body/40">({travelWeeks * 7} days)</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2 border-t border-steel/20">
                <button type="button" onClick={() => setTradeStep(4)} className={`text-xs font-mono tracking-widest px-4 py-1.5 border transition-colors ${stepDone(3) ? 'btn-amber' : 'border-steel/30 text-body/30 hover:text-body/50'}`}>
                  NEXT ›
                </button>
              </div>
            </section>
          )}

          {tradeStep === 4 && (
            <section className="panel p-3 space-y-3">
              <div className="panel-header -mx-3 -mt-3 mb-1">FIND BUYER</div>
              {/* Method selector */}
              <div className="space-y-1">
                <div className="label">METHOD</div>
                <div className="flex gap-1 flex-wrap">
                  {([
                    { id: 'standard', label: 'BROKER', sub: 'Broker · 1D days' },
                    { id: 'blackMarket', label: '⚠ BLACK MARKET', sub: 'Streetwise · 1D days' },
                    { id: 'online', label: 'ONLINE', sub: `Admin · 1D hours${(destination.techLevel ?? 0) < 8 ? ' · TL8+ only' : ''}`, disabled: (destination.techLevel ?? 0) < 8 },
                  ] satisfies TradeContactMethodOption[]).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={m.disabled}
                      onClick={() => setBuyerMethod(m.id)}
                      className={`flex flex-col items-start px-2.5 py-1.5 border text-left transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${buyerMethod === m.id ? 'border-amber bg-amber/10 text-amber' : 'border-steel/40 text-body/60 hover:text-body'}`}
                    >
                      <span className="text-[11px] font-mono font-bold tracking-wider">{m.label}</span>
                      <span className="text-[10px] text-body/40">{m.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Field label="Prior Attempts (month)">
                  <NumberStepper ariaLabel="Buyer Attempts" min={0} max={3} value={buyerAttempts} onChange={value => setBuyerAttempts(numberFromInput(value, buyerAttempts))} inputClassName="input text-xs" />
                </Field>
                <Field label="Buyer Broker">
                  <NumberStepper ariaLabel="Buyer Broker Skill" value={buyerBroker} onChange={v => setBuyerBroker(numberFromInput(v, buyerBroker))} inputClassName="input text-xs" />
                </Field>
                <SmallReadout label="CONTEXT DM (next roll)" value={fmtDM(buyerFindDm)} />
                <SmallReadout label="ACTIVE DEALS" value={String(activeDeals.length)} tone="text-amber" />
              </div>
              {buyerRolls.length > 0 && (
                <div className="space-y-1">
                  {(() => {
                    const bestIdx = buyerRolls.reduce((best, r, i) =>
                      r.success && (best === -1 || r.effect > buyerRolls[best]!.effect) ? i : best, -1);
                    return buyerRolls.map((roll, i) => {
                      const isBest = i === bestIdx;
                      return (
                        <div key={i} className={`border px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 ${isBest ? 'border-amber bg-amber/10 text-amber' : roll.success ? 'border-safe/50 text-safe' : 'border-alert/50 text-alert'}`}>
                          <span className={`text-[10px] ${isBest ? 'text-amber/70' : 'text-body/40'}`}>#{i + 1}</span>
                          <span className="flex-1">{roll.characterName} · {roll.skillName} [{roll.dice.join('+')}] {fmtDM(roll.dm)} = {roll.total} · EFF {fmtDM(roll.effect)} · {roll.success ? 'SUCCESS' : 'FAILURE'}</span>
                          {isBest && <span className="text-[10px] tracking-widest font-bold">BEST ›</span>}
                          <span className={isBest ? 'text-amber/60' : 'text-body/50'}>{roll.duration}{roll.durationUnit === 'days' ? 'd' : 'h'}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
              <CharacterCheckControl
                key={buyerMethod}
                label="Buyer Check"
                buttonLabel="ROLL BUYER"
                characters={characters}
                skills={TRADE_CHECK_SKILLS}
                defaultSkill={buyerMethod === 'blackMarket' ? 'Streetwise' : buyerMethod === 'online' ? 'Admin' : 'Broker'}
                contextDm={buyerFindDm}
                showDuration
                result={buyerCheck}
                disabledReason={buyerAttempts >= 3 ? 'Max 3 attempts per month reached' : undefined}
                onRolled={check => handleTradeCheck('buyer', check)}
              />
              <div className="flex justify-end pt-3 border-t border-steel/20 mt-1">
                <button type="button" onClick={() => setTradeStep(5)} className={`text-xs font-mono tracking-widest px-4 py-1.5 border transition-colors ${stepDone(4) ? 'btn-amber' : 'border-steel/30 text-body/30 hover:text-body/50'}`}>
                  NEXT ›
                </button>
              </div>
            </section>
          )}

          {tradeStep === 5 && (
            <section className="panel overflow-hidden">
              <div className="panel-header flex items-center justify-between gap-3">
                <span>SELL CARGO</span>
                <button type="button" onClick={priceActiveDeals} className="btn-amber text-xs flex items-center gap-1">
                  <Dice5 size={13} /> PRICE ACTIVE DEALS
                </button>
              </div>
              <div className="p-3 border-b border-steel/30">
                <BrokerSelector
                  myBrokerName={brokerCharacter?.name ?? 'My Broker'}
                  myBrokerSkill={brokerSkill}
                  foundBrokerSkill={foundBuyerBrokerSkill}
                  source={sellBrokerSource}
                  onChange={setSellBrokerSource}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-steel">
                      <th className="table-header">Cargo</th>
                      <th className="table-header">Roll</th>
                      <th className="table-header">Sale</th>
                      <th className="table-header">Profit</th>
                      <th className="table-header"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleQuotes.map(quote => (
                      <tr key={quote.deal.id} className="table-row">
                        <td className="table-cell">
                          <div className="font-bold text-bright">{quote.deal.item}</div>
                          <div className="text-[10px] text-body/55">{quote.deal.quantity}t · {quote.deal.world_bought ?? 'Unknown'} {'→'} {destination.name}</div>
                        </td>
                        <td className="table-cell text-xs">[{quote.roll.join('+')}] {'→'} {quote.price.rawRoll} / {quote.price.clampedRoll}</td>
                        <td className="table-cell">{quote.price.row.salePct}% · {formatCr(quote.unitPrice)}/t</td>
                        <td className="table-cell">
                          <div className={`font-bold ${quote.profit === null ? 'text-body/60' : quote.profit >= 0 ? 'text-safe' : 'text-alert'}`}>
                            {quote.profit === null ? '--' : `${quote.profit >= 0 ? '+' : ''}${formatCr(quote.profit)}`}
                          </div>
                          {quote.commission > 0 && (
                            <div className="text-[10px] font-mono text-alert/70">−{formatCr(quote.commission)} commission</div>
                          )}
                          {quote.commission > 0 && quote.netProfit !== null && (
                            <div className={`text-[10px] font-mono font-bold ${quote.netProfit >= 0 ? 'text-safe' : 'text-alert'}`}>
                              net {quote.netProfit >= 0 ? '+' : ''}{formatCr(quote.netProfit)}
                            </div>
                          )}
                        </td>
                        <td className="table-cell text-right">
                          <button type="button" onClick={() => sellQuotedDeal(quote)} disabled={busy} className="btn-amber text-xs">SELL</button>
                        </td>
                      </tr>
                    ))}
                    {saleQuotes.length === 0 && activeDeals.length > 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-body/60 text-xs">Click PRICE ACTIVE DEALS to get sale quotes for your {activeDeals.length} active deal{activeDeals.length !== 1 ? 's' : ''}.</td></tr>
                    )}
                    {saleQuotes.length === 0 && activeDeals.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-body/60 text-xs">No active deals — purchase cargo at source first.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Time Summary Strip */}
        {(supplierDays > 0 || travelWeeks > 0 || buyerDays > 0) && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-steel/20 bg-void/60 flex-shrink-0 flex-wrap">
            <Clock size={11} className="text-body/40 flex-shrink-0" />
            {supplierDays > 0 && <span className="text-[10px] font-mono text-body/50">SOURCE <span className="text-bright">{supplierDays}d</span></span>}
            {travelWeeks > 0 && <span className="text-[10px] font-mono text-body/50">JUMP <span className="text-cyan-trav">{travelWeeks}w</span></span>}
            {buyerDays > 0 && <span className="text-[10px] font-mono text-body/50">BUYER <span className="text-bright">{buyerDays}d</span></span>}
            <span className="text-[10px] font-mono text-body/40 ml-auto">TOTAL ~<span className="text-amber">{totalDays}d</span></span>
          </div>
        )}

        {/* Nav Footer */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-steel/30 bg-void/40 flex-shrink-0">
          <button
            type="button"
            onClick={() => setTradeStep(s => Math.max(0, s - 1))}
            disabled={tradeStep === 0}
            className="btn-steel text-xs px-4 disabled:opacity-30"
          >
            BACK
          </button>
          <span className="text-[10px] font-mono text-body/40">{tradeStep + 1} / {TRADE_STEPS.length}</span>
          {tradeStep < TRADE_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setTradeStep(s => Math.min(TRADE_STEPS.length - 1, s + 1))}
              className="btn-steel text-xs px-4"
            >
              NEXT
            </button>
          ) : (
            <div className="w-[52px]" />
          )}
        </div>
      </div>
    </div>
  );
}

export function PassengersFreightPanel({ characters = [] }: PassengersFreightPanelProps) {
  const [source, setSource] = useState<WorldProfile>(DEFAULT_SOURCE);
  const [destination, setDestination] = useState<WorldProfile>(DEFAULT_DESTINATION);
  const [parsecs, setParsecs] = useState(2);
  const [passengerEffect, setPassengerEffect] = useState(0);
  const [chiefStewardDm, setChiefStewardDm] = useState(0);
  const [stewardSkill, setStewardSkill] = useState(0);
  const [freightEffect, setFreightEffect] = useState(0);
  const [shipArmed, setShipArmed] = useState(true);
  const [rankDm, setRankDm] = useState(0);
  const [socDm, setSocDm] = useState(0);
  const [passengers, setPassengers] = useState<PassengerResultRow[]>([]);
  const [freight, setFreight] = useState<FreightResultRow[]>([]);
  const [mail, setMail] = useState<MailResult | null>(null);
  const [randomPassenger, setRandomPassenger] = useState<string | null>(null);
  const [passengerCheck, setPassengerCheck] = useState<SkillCheck | null>(null);
  const [freightCheck, setFreightCheck] = useState<SkillCheck | null>(null);

  const totalPassengerIncome = passengers.reduce((sum, row) => sum + row.income, 0);
  const totalFreightIncome = freight.reduce((sum, row) => sum + row.income, 0);
  const totalMailIncome = mail?.income ?? 0;
  const fare = lookupPassageFare(parsecs);

  function applyPassengerCheck(check: SkillCheck) {
    setPassengerCheck(check);
    setPassengerEffect(check.effect);
  }

  function applyFreightCheck(check: SkillCheck) {
    setFreightCheck(check);
    setFreightEffect(check.effect);
  }

  function rollPassengers() {
    setPassengers(PASSENGER_CLASSES.map(passengerClass => {
      const trafficRoll = rollDice(2);
      const preliminary = passengerTraffic({
        roll: trafficRoll.reduce((sum, die) => sum + die, 0),
        passengerClass,
        parsecs,
        source,
        destination,
        skillEffect: passengerEffect,
        chiefStewardDm,
        stewardSkill,
      });
      const passengerRolls = rollDice(preliminary.dice);
      return {
        passengerClass,
        roll: trafficRoll,
        passengerRolls,
        ...passengerTraffic({
          roll: trafficRoll.reduce((sum, die) => sum + die, 0),
          passengerClass,
          parsecs,
          source,
          destination,
          skillEffect: passengerEffect,
          chiefStewardDm,
          stewardSkill,
        }, passengerRolls),
      };
    }));
  }

  function rollFreight() {
    setFreight(FREIGHT_LOTS.map(lotSize => {
      const trafficRoll = rollDice(2);
      const preliminary = freightTraffic({
        roll: trafficRoll.reduce((sum, die) => sum + die, 0),
        lotSize,
        parsecs,
        source,
        destination,
        skillEffect: freightEffect,
      });
      const lotRolls = rollDice(preliminary.dice);
      return {
        lotSize,
        roll: trafficRoll,
        lotRolls,
        ...freightTraffic({
          roll: trafficRoll.reduce((sum, die) => sum + die, 0),
          lotSize,
          parsecs,
          source,
          destination,
          skillEffect: freightEffect,
        }, lotRolls),
      };
    }));
  }

  function rollMail() {
    const baseFreightDm = freightWorldDm(source) + freightWorldDm(destination) - Math.max(0, parsecs - 1) + freightEffect;
    const dm = mailTrafficDm(baseFreightDm) + (shipArmed ? 2 : 0) + (source.techLevel <= 5 ? -4 : 0) + rankDm + socDm;
    const roll = rollDice(2);
    const total = roll.reduce((sum, die) => sum + die, 0) + dm;
    const containers = total >= 12 ? rollDice(1)[0] ?? 0 : 0;
    setMail({ roll, dm, total, containers, income: containers * 25_000 });
  }

  function rollPassengerHook() {
    const { d66 } = rollD66();
    const row = lookupRandomPassenger(d66);
    setRandomPassenger(row ? `${d66} · ${row.passenger}` : `${d66} · No entry`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <WorldProfileForm title="Source" value={source} onChange={setSource} />
        <WorldProfileForm title="Destination" value={destination} onChange={setDestination} />
      </div>

      <section className="panel p-3 space-y-3">
        <div className="panel-header -mx-3 -mt-3 mb-1">PASSAGE AND FREIGHT CONTROL</div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <Field label="Parsecs">
            <NumberStepper ariaLabel="Passenger Freight Parsecs" min={1} max={6} value={parsecs} onChange={value => setParsecs(numberFromInput(value, parsecs))} inputClassName="input text-xs" />
          </Field>
          <Field label="Passenger Effect">
            <NumberStepper ariaLabel="Passenger Effect" value={passengerEffect} onChange={value => setPassengerEffect(numberFromInput(value, passengerEffect))} inputClassName="input text-xs" />
          </Field>
          <Field label="Chief Steward">
            <NumberStepper ariaLabel="Chief Steward" value={chiefStewardDm} onChange={value => setChiefStewardDm(numberFromInput(value, chiefStewardDm))} inputClassName="input text-xs" />
          </Field>
          <Field label="Steward">
            <NumberStepper ariaLabel="Steward" value={stewardSkill} onChange={value => setStewardSkill(numberFromInput(value, stewardSkill))} inputClassName="input text-xs" />
          </Field>
          <Field label="Freight Effect">
            <NumberStepper ariaLabel="Freight Effect" value={freightEffect} onChange={value => setFreightEffect(numberFromInput(value, freightEffect))} inputClassName="input text-xs" />
          </Field>
          <Field label="Rank DM">
            <NumberStepper ariaLabel="Rank DM" value={rankDm} onChange={value => setRankDm(numberFromInput(value, rankDm))} inputClassName="input text-xs" />
          </Field>
          <Field label="SOC DM">
            <NumberStepper ariaLabel="SOC DM" value={socDm} onChange={value => setSocDm(numberFromInput(value, socDm))} inputClassName="input text-xs" />
          </Field>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <CharacterCheckControl
            label="Passenger Traffic Check"
            buttonLabel="ROLL CHECK"
            characters={characters}
            skills={PASSENGER_CHECK_SKILLS}
            defaultSkill="Broker"
            result={passengerCheck}
            onRolled={applyPassengerCheck}
          />
          <CharacterCheckControl
            label="Freight Traffic Check"
            buttonLabel="ROLL CHECK"
            characters={characters}
            skills={FREIGHT_CHECK_SKILLS}
            defaultSkill="Broker"
            result={freightCheck}
            onRolled={applyFreightCheck}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CharacterSkillSetter label="Ship Steward" skillName="Steward" buttonLabel="USE STEWARD" characters={characters} onApply={setStewardSkill} />
          <CharacterStatSetter label="Mail SOC" statKey="soc" buttonLabel="USE SOC DM" characters={characters} onApply={setSocDm} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={rollPassengers} className="btn-steel text-xs flex items-center gap-1">
            <Users size={13} /> ROLL PASSENGERS
          </button>
          <button type="button" onClick={rollFreight} className="btn-steel text-xs flex items-center gap-1">
            <Truck size={13} /> ROLL FREIGHT
          </button>
          <button type="button" onClick={rollMail} className="btn-steel text-xs flex items-center gap-1">
            <Dice5 size={13} /> ROLL MAIL
          </button>
          <button type="button" onClick={rollPassengerHook} className="btn-steel text-xs flex items-center gap-1">
            <Dice5 size={13} /> RANDOM PASSENGER
          </button>
          <button type="button" onClick={() => setShipArmed(value => !value)} className={`btn text-xs ${shipArmed ? 'btn-amber' : 'btn-steel'}`}>
            ARMED {shipArmed ? 'YES' : 'NO'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <SmallReadout label="HIGH FARE" value={formatCr(fare.high)} />
          <SmallReadout label="MIDDLE FARE" value={formatCr(fare.middle)} />
          <SmallReadout label="BASIC FARE" value={formatCr(fare.basic)} />
          <SmallReadout label="LOW FARE" value={formatCr(fare.low)} />
          <SmallReadout label="FREIGHT / TON" value={formatCr(fare.freightPerTon)} />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="panel overflow-hidden xl:col-span-2">
          <div className="panel-header">PASSENGERS</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-steel">
                  <th className="table-header">Class</th>
                  <th className="table-header">Traffic</th>
                  <th className="table-header">Passengers</th>
                  <th className="table-header">Income</th>
                </tr>
              </thead>
              <tbody>
                {passengers.map(row => (
                  <tr key={row.passengerClass} className="table-row">
                    <td className="table-cell font-bold text-bright">{PASSENGER_LABELS[row.passengerClass]}</td>
                    <td className="table-cell text-xs">[{row.roll.join('+')}] {'->'} {row.total} · {row.dice}D</td>
                    <td className="table-cell text-xs">{row.passengers} [{row.passengerRolls.join('+') || '-'}]</td>
                    <td className="table-cell text-amber font-bold">{formatCr(row.income)}</td>
                  </tr>
                ))}
                {passengers.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-body/60 text-xs">No passenger rolls.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel p-3 space-y-2">
          <div className="panel-header -mx-3 -mt-3 mb-1">INCOME SUMMARY</div>
          <SmallReadout label="PASSENGERS" value={formatCr(totalPassengerIncome)} tone="text-amber" />
          <SmallReadout label="FREIGHT" value={formatCr(totalFreightIncome)} tone="text-cyan-trav" />
          <SmallReadout label="MAIL" value={formatCr(totalMailIncome)} tone="text-safe" />
          <SmallReadout label="TOTAL" value={formatCr(totalPassengerIncome + totalFreightIncome + totalMailIncome)} tone="text-bright" />
          {randomPassenger && (
            <div className="border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber font-mono">{randomPassenger}</div>
          )}
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="panel-header">FREIGHT AND MAIL</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-steel">
                <th className="table-header">Lot</th>
                <th className="table-header">Traffic</th>
                <th className="table-header">Lots</th>
                <th className="table-header">Tons</th>
                <th className="table-header">Income</th>
              </tr>
            </thead>
            <tbody>
              {freight.map(row => (
                <tr key={row.lotSize} className="table-row">
                  <td className="table-cell font-bold text-bright">{FREIGHT_LABELS[row.lotSize]}</td>
                  <td className="table-cell text-xs">[{row.roll.join('+')}] {'->'} {row.total} · {row.dice}D</td>
                  <td className="table-cell text-xs">{row.lots} [{row.lotRolls.join('+') || '-'}]</td>
                  <td className="table-cell">{row.tons}t</td>
                  <td className="table-cell text-amber font-bold">{formatCr(row.income)}</td>
                </tr>
              ))}
              {mail && (
                <tr className="table-row">
                  <td className="table-cell font-bold text-bright">Mail</td>
                  <td className="table-cell text-xs">[{mail.roll.join('+')}] {mail.dm >= 0 ? '+' : ''}{mail.dm} = {mail.total}</td>
                  <td className="table-cell">{mail.containers}</td>
                  <td className="table-cell">{mail.containers * 5}t</td>
                  <td className="table-cell text-safe font-bold">{formatCr(mail.income)}</td>
                </tr>
              )}
              {freight.length === 0 && !mail && <tr><td colSpan={5} className="px-4 py-6 text-center text-body/60 text-xs">No freight rolls.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
