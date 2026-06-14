import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Dice5, Plus, RefreshCcw, ShoppingCart, Truck, Users, X } from 'lucide-react';
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
  formatCr,
  freightTraffic,
  freightWorldDm,
  passengerTraffic,
  populationQuantityDm,
  rollDice,
  rollTonsWithDm,
  supplierStarportDm,
  tradeGoodPurchaseDm,
  tradeGoodSaleDm,
  TRAVELLER_TRADE_CODES,
  type FreightLotSize,
  type ModifiedPriceResult,
  type RolledTons,
  type StarportClass,
  type TravelZone,
  type WorldProfile,
} from '../../lib/trade';
import { TRADE_GOODS, formatBasePrice, type TradeGood } from '../../data/tradeGoods';
import { lookupPassageFare, type PassengerClass } from '../../data/passageFares';
import { mailTrafficDm } from '../../data/freightTraffic';
import { lookupRandomPassenger } from '../../data/randomPassenger';
import type { Character, TradeDeal } from '../../types';
import NumberStepper from '../shared/NumberStepper';

export type TradeDealDraft = Omit<TradeDeal, 'id' | 'created_at' | 'updated_at'>;

const DEFAULT_SOURCE: WorldProfile = {
  name: 'Regina',
  tradeCodes: ['Rich', 'High Pop'],
  starport: 'A',
  population: 8,
  techLevel: 12,
  lawLevel: 6,
  zone: 'normal',
};

const DEFAULT_DESTINATION: WorldProfile = {
  name: 'Efate',
  tradeCodes: ['Industrial'],
  starport: 'B',
  population: 6,
  techLevel: 10,
  lawLevel: 5,
  zone: 'normal',
};

const PASSENGER_CLASSES: PassengerClass[] = ['low', 'basic', 'middle', 'high'];
const FREIGHT_LOTS: FreightLotSize[] = ['incidental', 'minor', 'major'];
const TRADE_CHECK_SKILLS = ['Broker', 'Streetwise', 'Admin'] as const;
const PASSENGER_CHECK_SKILLS = ['Broker', 'Carouse', 'Streetwise'] as const;
const FREIGHT_CHECK_SKILLS = ['Broker', 'Streetwise'] as const;
const CHECK_STATS: CharStat[] = ['int_stat', 'edu', 'soc', 'dex', 'str', 'end_stat'];
const TRADE_STEPS = [
  { id: 'route', label: 'ROUTE' },
  { id: 'supplier', label: 'SUPPLIER' },
  { id: 'market', label: 'LOTS' },
  { id: 'purchase', label: 'PURCHASE' },
  { id: 'buyer', label: 'BUYER' },
  { id: 'sale', label: 'SALE' },
] as const;

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

function firstCharacterId(characters: Character[]): string {
  return characters[0]?.id ?? '';
}

function useSelectedCharacter(characters: Character[]) {
  const [selectedId, setSelectedId] = useState(firstCharacterId(characters));

  useEffect(() => {
    if (characters.length === 0) {
      if (selectedId) setSelectedId('');
      return;
    }
    if (!characters.some(character => character.id === selectedId)) {
      setSelectedId(characters[0].id);
    }
  }, [characters, selectedId]);

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
}: {
  label: string;
  characters: Character[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      className="select text-xs"
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
  onRolled: (check: SkillCheck) => void;
}) {
  const { selectedId, setSelectedId, selectedCharacter } = useSelectedCharacter(characters);
  const [skillName, setSkillName] = useState(defaultSkill);
  const [statKey, setStatKey] = useState<CharStat | null>(skillChar(defaultSkill));
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Field label="Character">
          <CharacterSelect label={`${label} Character`} characters={characters} selectedId={selectedId} onChange={setSelectedId} />
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
        <Field label="Context DM">
          <input className="input text-xs" aria-label={`${label} Context DM`} value={fmtDM(contextDm)} readOnly />
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
        <button type="button" onClick={rollCheck} disabled={!selectedCharacter} className="btn-steel text-xs flex items-center gap-1">
          <Dice5 size={13} /> {buttonLabel}
        </button>
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
}: {
  label: string;
  skillName: string;
  buttonLabel: string;
  characters: Character[];
  onApply: (skillLevel: number) => void;
}) {
  const { selectedId, setSelectedId, selectedCharacter } = useSelectedCharacter(characters);
  const skill = selectedCharacter ? characterSkillLevel(selectedCharacter, skillName) : null;

  return (
    <div className="border border-steel/50 bg-void/40 p-2 space-y-2">
      <div className="label">{label.toUpperCase()}</div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
        <Field label="Character">
          <CharacterSelect label={`${label} Character`} characters={characters} selectedId={selectedId} onChange={setSelectedId} />
        </Field>
        <button type="button" onClick={() => skill && onApply(skill.skillLevel)} disabled={!skill} className="btn-steel text-xs h-9">
          {buttonLabel}
        </button>
      </div>
      {selectedCharacter && skill && (
        <div className="text-[11px] font-mono text-body/70">
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
  const { selectedId, setSelectedId, selectedCharacter } = useSelectedCharacter(characters);
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
  const toggleCode = (code: string) => {
    const nextCodes = value.tradeCodes.includes(code)
      ? value.tradeCodes.filter(existing => existing !== code)
      : [...value.tradeCodes, code];
    onChange({ ...value, tradeCodes: nextCodes });
  };

  return (
    <section className="panel p-3 space-y-3">
      <div className="panel-header -mx-3 -mt-3 mb-1">{title.toUpperCase()} WORLD</div>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
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
        <Field label="Starport">
          <select
            className="select text-xs"
            aria-label={`${title} Starport`}
            value={value.starport}
            onChange={e => onChange({ ...value, starport: e.target.value as StarportClass })}
          >
            {(['A', 'B', 'C', 'D', 'E', 'X'] as StarportClass[]).map(starport => (
              <option key={starport} value={starport}>{starport}</option>
            ))}
          </select>
        </Field>
        <Field label="Pop">
          <NumberStepper
            ariaLabel={`${title} Population`}
            min={0}
            max={12}
            value={value.population}
            onChange={raw => onChange({ ...value, population: numberFromInput(raw, value.population) })}
            inputClassName="input text-xs"
          />
        </Field>
        <Field label="TL">
          <NumberStepper
            ariaLabel={`${title} Tech Level`}
            min={0}
            max={20}
            value={value.techLevel}
            onChange={raw => onChange({ ...value, techLevel: numberFromInput(raw, value.techLevel) })}
            inputClassName="input text-xs"
          />
        </Field>
        <Field label="Law">
          <NumberStepper
            ariaLabel={`${title} Law Level`}
            min={0}
            max={20}
            value={value.lawLevel}
            onChange={raw => onChange({ ...value, lawLevel: numberFromInput(raw, value.lawLevel) })}
            inputClassName="input text-xs"
          />
        </Field>
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

      <div className="flex flex-wrap gap-1.5">
        {TRAVELLER_TRADE_CODES.map(code => (
          <button
            key={code}
            type="button"
            onClick={() => toggleCode(code)}
            className={`px-2 py-1 border text-[10px] font-mono transition-colors ${
              value.tradeCodes.includes(code)
                ? 'border-amber bg-amber/10 text-amber'
                : 'border-steel/50 text-body/60 hover:text-bright hover:border-cyan-trav/60'
            }`}
          >
            {code}
          </button>
        ))}
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

export function TradeSessionPanel({ deals, characters = [], onCreateDeals, onUpdateDeal, busy = false }: TradeSessionPanelProps) {
  const [source, setSource] = useState<WorldProfile>(DEFAULT_SOURCE);
  const [destination, setDestination] = useState<WorldProfile>(DEFAULT_DESTINATION);
  const [stepIndex, setStepIndex] = useState(0);
  const [sessionRef, setSessionRef] = useState('Session Trade Run');
  const [parsecs, setParsecs] = useState(2);
  const [brokerSkill, setBrokerSkill] = useState(2);
  const [supplierBroker, setSupplierBroker] = useState(2);
  const [buyerBroker, setBuyerBroker] = useState(2);
  const [supplierAttempts, setSupplierAttempts] = useState(0);
  const [blackMarket, setBlackMarket] = useState(false);
  const [supplierCheck, setSupplierCheck] = useState<SkillCheck | null>(null);
  const [buyerCheck, setBuyerCheck] = useState<SkillCheck | null>(null);
  const [lots, setLots] = useState<AvailableLot[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleQuotes, setSaleQuotes] = useState<SaleQuote[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const activeDeals = useMemo(() => deals.filter(deal => deal.status === 'active'), [deals]);
  const activeStep = TRADE_STEPS[stepIndex];
  const sourceSupplierDm = supplierStarportDm(source.starport) - supplierAttempts;
  const buyerFindDm = supplierStarportDm(destination.starport);
  const cartTotal = cart.reduce((sum, item) => {
    if (!item.price || item.good.basePrice === null) return sum;
    return sum + calculateLotCost(item.good.basePrice, item.price.row.purchasePct, item.tons);
  }, 0);

  function handleTradeCheck(kind: 'supplier' | 'buyer', check: SkillCheck) {
    if (kind === 'supplier') setSupplierCheck(check);
    else setBuyerCheck(check);
    if (check.skillName === 'Broker') setBrokerSkill(check.skillLevel);
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
        brokerSkill,
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
        brokerSkill,
        saleDm,
        purchaseDm,
        buyerBroker,
      );
      const sellUnit = unitPrice(basePrice, price.row.salePct);
      return [{
        deal,
        good,
        roll,
        price,
        unitPrice: sellUnit,
        profit: deal.buy_price === null ? null : (sellUnit - deal.buy_price) * deal.quantity,
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

  return (
    <div className="space-y-4">
      {message && (
        <div className="border border-cyan-trav/40 bg-cyan-trav/10 px-3 py-2 text-xs text-cyan-trav flex items-center justify-between gap-3">
          <span>{message}</span>
          <button type="button" aria-label="Dismiss trade session message" onClick={() => setMessage(null)} className="hover:text-bright">
            <X size={12} />
          </button>
        </div>
      )}

      <section className="panel p-3 space-y-3">
        <div className="panel-header -mx-3 -mt-3 mb-1 flex items-center justify-between gap-3">
          <span>TRADE SESSION · {activeStep.label}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStepIndex(index => Math.max(0, index - 1))} disabled={stepIndex === 0} className="btn-steel text-xs flex items-center gap-1">
              <ChevronLeft size={13} /> BACK
            </button>
            <button type="button" onClick={() => setStepIndex(index => Math.min(TRADE_STEPS.length - 1, index + 1))} disabled={stepIndex === TRADE_STEPS.length - 1} className="btn-amber text-xs flex items-center gap-1">
              NEXT <ChevronRight size={13} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
          {TRADE_STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setStepIndex(index)}
              className={`border px-2 py-2 text-[10px] font-mono ${index === stepIndex ? 'border-amber bg-amber/10 text-amber' : 'border-steel/50 text-body/65 hover:border-cyan-trav/60 hover:text-bright'}`}
            >
              {index + 1} {step.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <SmallReadout label="ROUTE" value={`${source.name || '--'} -> ${destination.name || '--'}`} />
          <SmallReadout label="BROKER SKILL" value={fmtDM(brokerSkill)} />
          <SmallReadout label="LOTS" value={String(lots.length)} />
          <SmallReadout label="ACTIVE DEALS" value={String(activeDeals.length)} tone="text-amber" />
          <SmallReadout label="CART VALUE" value={formatCr(cartTotal)} tone={cartTotal > 0 ? 'text-amber' : 'text-body/60'} />
        </div>
      </section>

      {activeStep.id === 'route' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <WorldProfileForm title="Source" value={source} onChange={setSource} />
            <WorldProfileForm title="Destination" value={destination} onChange={setDestination} />
          </div>

          <section className="panel p-3 space-y-3">
            <div className="panel-header -mx-3 -mt-3 mb-1">ROUTE AND PRICING</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Field label="Session">
                <input className="input text-xs" aria-label="Trade Session Reference" value={sessionRef} onChange={e => setSessionRef(e.target.value)} />
              </Field>
              <Field label="Parsecs">
                <NumberStepper ariaLabel="Trade Session Parsecs" min={1} max={6} value={parsecs} onChange={value => setParsecs(numberFromInput(value, parsecs))} inputClassName="input text-xs" />
              </Field>
              <Field label="Broker">
                <NumberStepper ariaLabel="Trade Session Broker Skill" value={brokerSkill} onChange={value => setBrokerSkill(numberFromInput(value, brokerSkill))} inputClassName="input text-xs" />
              </Field>
              <Field label="Supplier Broker">
                <NumberStepper ariaLabel="Supplier Broker Skill" value={supplierBroker} onChange={value => setSupplierBroker(numberFromInput(value, supplierBroker))} inputClassName="input text-xs" />
              </Field>
              <Field label="Buyer Broker">
                <NumberStepper ariaLabel="Buyer Broker Skill" value={buyerBroker} onChange={value => setBuyerBroker(numberFromInput(value, buyerBroker))} inputClassName="input text-xs" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CharacterSkillSetter label="Price Broker" skillName="Broker" buttonLabel="USE BROKER" characters={characters} onApply={setBrokerSkill} />
              <CharacterSkillSetter label="Supplier Counterparty" skillName="Broker" buttonLabel="USE SKILL" characters={characters} onApply={setSupplierBroker} />
              <CharacterSkillSetter label="Buyer Counterparty" skillName="Broker" buttonLabel="USE SKILL" characters={characters} onApply={setBuyerBroker} />
            </div>
          </section>
        </>
      )}

      {activeStep.id === 'supplier' && (
        <section className="panel p-3 space-y-3">
          <div className="panel-header -mx-3 -mt-3 mb-1">FIND SUPPLIER</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Field label="Attempts">
              <NumberStepper ariaLabel="Supplier Attempts" min={0} value={supplierAttempts} onChange={value => setSupplierAttempts(numberFromInput(value, supplierAttempts))} inputClassName="input text-xs" />
            </Field>
            <Field label="Supplier Broker">
              <NumberStepper ariaLabel="Supplier Broker Skill" value={supplierBroker} onChange={value => setSupplierBroker(numberFromInput(value, supplierBroker))} inputClassName="input text-xs" />
            </Field>
            <div className="flex items-end">
              <button type="button" onClick={() => setBlackMarket(value => !value)} className={`btn text-xs h-9 ${blackMarket ? 'btn-amber' : 'btn-steel'}`}>
                BLACK MARKET {blackMarket ? 'ON' : 'OFF'}
              </button>
            </div>
            <SmallReadout label="SUPPLIER CONTEXT" value={fmtDM(sourceSupplierDm)} />
          </div>
          <CharacterCheckControl
            label="Supplier Check"
            buttonLabel="ROLL SUPPLIER"
            characters={characters}
            skills={TRADE_CHECK_SKILLS}
            defaultSkill="Broker"
            contextDm={sourceSupplierDm}
            showDuration
            result={supplierCheck}
            onRolled={check => handleTradeCheck('supplier', check)}
          />
        </section>
      )}

      {(activeStep.id === 'market' || activeStep.id === 'purchase') && (
      <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_26rem] gap-4">
        <div className="panel overflow-hidden">
          <div className="panel-header flex items-center justify-between gap-3">
            <span>GOODS AVAILABLE</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLots(rollAvailableLots(source, blackMarket, false))} className="btn-steel text-xs flex items-center gap-1">
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
                  <th className="table-header">Good</th>
                  <th className="table-header">Tons</th>
                  <th className="table-header">Base</th>
                  <th className="table-header">DMs</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => (
                  <tr key={lot.id} className="table-row">
                    <td className="table-cell">
                      <div className="font-bold text-bright">{lot.good.type}</div>
                      <div className="text-[10px] text-body/55">{lot.good.availability}</div>
                    </td>
                    <td className="table-cell">
                      <div>{lot.tons}t</div>
                      {lot.roll && <div className="text-[10px] text-body/50">[{lot.roll.dice.join('+')}] {lot.roll.modifier >= 0 ? '+' : ''}{lot.roll.modifier} x{lot.roll.multiplier}</div>}
                    </td>
                    <td className="table-cell">{formatBasePrice(lot.good.basePrice)}</td>
                    <td className="table-cell text-xs">
                      <div>Buy {lot.purchaseDm >= 0 ? '+' : ''}{lot.purchaseDm}</div>
                      <div>Sell {lot.saleDm >= 0 ? '+' : ''}{lot.saleDm}</div>
                    </td>
                    <td className="table-cell text-right">
                      <button type="button" onClick={() => addLotToCart(lot)} className="btn-steel text-xs flex items-center gap-1 ml-auto">
                        <Plus size={12} /> CART
                      </button>
                    </td>
                  </tr>
                ))}
                {lots.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-body/60 text-xs">No lots rolled.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="panel p-3 space-y-3">
          <div className="panel-header -mx-3 -mt-3 mb-1 flex items-center gap-2">
            <ShoppingCart size={13} /> PURCHASE CART
          </div>
          <div className="space-y-2 max-h-96 overflow-auto pr-1">
            {cart.map(item => {
              const basePrice = item.good.basePrice ?? 0;
              const purchasePct = item.price?.row.purchasePct ?? null;
              const cost = purchasePct === null ? null : calculateLotCost(basePrice, purchasePct, item.tons);
              return (
                <div key={item.id} className="border border-steel/50 bg-void/40 p-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-bright truncate">{item.good.type}</div>
                      <div className="text-[10px] text-body/55">Buy DM {item.purchaseDm >= 0 ? '+' : ''}{item.purchaseDm} · Sale DM {item.saleDm >= 0 ? '+' : ''}{item.saleDm}</div>
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
                      [{item.roll?.join('+')}] {'->'} {item.price.rawRoll} / {item.price.clampedRoll} · {item.price.row.purchasePct}% · {formatCr(cost)}
                    </div>
                  )}
                </div>
              );
            })}
            {cart.length === 0 && <div className="text-center text-xs text-body/55 py-6">Cart empty.</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={priceCart} disabled={cart.length === 0} className="btn-steel text-xs flex items-center justify-center gap-1">
              <Dice5 size={13} /> PRICE
            </button>
            <button type="button" onClick={purchaseCart} disabled={busy || cart.length === 0} className="btn-amber text-xs flex items-center justify-center gap-1">
              <Check size={13} /> PURCHASE ALL
            </button>
          </div>
        </aside>
      </section>
      )}

      {activeStep.id === 'buyer' && (
        <section className="panel p-3 space-y-3">
          <div className="panel-header -mx-3 -mt-3 mb-1">FIND BUYER</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Field label="Buyer Broker">
              <NumberStepper ariaLabel="Buyer Broker Skill" value={buyerBroker} onChange={value => setBuyerBroker(numberFromInput(value, buyerBroker))} inputClassName="input text-xs" />
            </Field>
            <SmallReadout label="BUYER CONTEXT" value={fmtDM(buyerFindDm)} />
            <SmallReadout label="ACTIVE DEALS" value={String(activeDeals.length)} tone="text-amber" />
            <SmallReadout label="DESTINATION" value={destination.name || '--'} />
          </div>
          <CharacterCheckControl
            label="Buyer Check"
            buttonLabel="ROLL BUYER"
            characters={characters}
            skills={TRADE_CHECK_SKILLS}
            defaultSkill="Broker"
            contextDm={buyerFindDm}
            showDuration
            result={buyerCheck}
            onRolled={check => handleTradeCheck('buyer', check)}
          />
        </section>
      )}

      {activeStep.id === 'sale' && (
      <section className="panel overflow-hidden">
        <div className="panel-header flex items-center justify-between gap-3">
          <span>SALE PRICE</span>
          <button type="button" onClick={priceActiveDeals} className="btn-steel text-xs flex items-center gap-1">
            <Dice5 size={13} /> PRICE ACTIVE DEALS
          </button>
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
                      <div className="text-[10px] text-body/55">{quote.deal.quantity}t · {quote.deal.world_bought ?? 'Unknown'} {'->'} {destination.name}</div>
                  </td>
                    <td className="table-cell text-xs">[{quote.roll.join('+')}] {'->'} {quote.price.rawRoll} / {quote.price.clampedRoll}</td>
                  <td className="table-cell">{quote.price.row.salePct}% · {formatCr(quote.unitPrice)}/t</td>
                  <td className={`table-cell font-bold ${quote.profit === null ? 'text-body/60' : quote.profit >= 0 ? 'text-safe' : 'text-alert'}`}>
                    {quote.profit === null ? '--' : `${quote.profit >= 0 ? '+' : ''}${formatCr(quote.profit)}`}
                  </td>
                  <td className="table-cell text-right">
                    <button type="button" onClick={() => sellQuotedDeal(quote)} disabled={busy} className="btn-amber text-xs">SELL</button>
                  </td>
                </tr>
              ))}
              {saleQuotes.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-body/60 text-xs">No sale quotes rolled.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
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
