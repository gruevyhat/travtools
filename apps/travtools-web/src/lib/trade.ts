import { TradeDeal } from '../types';
import type { TradeGood } from '../data/tradeGoods';
import { lookupModifiedPrice, type ModifiedPriceRow } from '../data/modifiedPrice';
import { lookupPassengerTraffic } from '../data/passengerTraffic';
import { lookupFreightTraffic } from '../data/freightTraffic';
import { lookupPassageFare, type PassengerClass } from '../data/passageFares';

export type TradeStatusFilter = 'all' | TradeDeal['status'];
export type StarportClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'X';
export type TravelZone = 'normal' | 'amber' | 'red';

export const TRAVELLER_TRADE_CODES = [
  'Agricultural',
  'Asteroid',
  'Desert',
  'Fluid Oceans',
  'Garden',
  'High Pop',
  'High Tech',
  'Ice-Capped',
  'Industrial',
  'Low Pop',
  'Non-Agricultural',
  'Non-Industrial',
  'Poor',
  'Rich',
  'Vacuum',
  'Water World',
] as const;

export interface WorldProfile {
  name: string;
  tradeCodes: string[];
  starport: StarportClass;
  population: number;
  techLevel: number;
  lawLevel: number;
  zone: TravelZone;
}

export interface TradeFilters {
  status?: TradeStatusFilter;
  world?: string;
}

export interface TradeSummary {
  activeCapital: number;
  realisedProfit: number;
  totalDeals: number;
}

export interface TradeDmEntry {
  code: string;
  dm: number;
}

export interface ModifiedPriceResult {
  rawRoll: number;
  clampedRoll: number;
  brokerSkill: number;
  favourableDm: number;
  opposingDm: number;
  counterpartyBroker: number;
  row: ModifiedPriceRow;
}

export interface PassengerTrafficInput {
  roll: number;
  passengerClass: PassengerClass;
  parsecs: number;
  source: WorldProfile;
  destination: WorldProfile;
  skillEffect?: number;
  chiefStewardDm?: number;
  stewardSkill?: number;
}

export interface PassengerTrafficResult {
  total: number;
  dice: number;
  passengers: number;
  income: number;
  fare: number;
}

export interface FreightTrafficInput {
  roll: number;
  lotSize: FreightLotSize;
  parsecs: number;
  source: WorldProfile;
  destination: WorldProfile;
  skillEffect?: number;
}

export type FreightLotSize = 'major' | 'minor' | 'incidental';

export interface FreightTrafficResult {
  total: number;
  dice: number;
  lots: number;
  tons: number;
  income: number;
  ratePerTon: number;
}

export interface RolledTons {
  dice: number[];
  diceTotal: number;
  modifier: number;
  multiplier: number;
  tons: number;
}

export function formatCr(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '--';
  return `Cr ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function profit(deal: Pick<TradeDeal, 'buy_price' | 'sell_price' | 'quantity'>): number | null {
  if (deal.buy_price === null || deal.sell_price === null) return null;
  return (deal.sell_price - deal.buy_price) * deal.quantity;
}

export function clampModifiedPriceRoll(roll: number): number {
  return Math.max(-3, Math.min(25, roll));
}

export function calculateLotCost(basePrice: number, purchasePct: number, tons: number): number {
  return Math.round(basePrice * (purchasePct / 100) * tons);
}

export function calculateProfit(basePrice: number, purchasePct: number, salePct: number, tons: number): number {
  return calculateLotCost(basePrice, salePct, tons) - calculateLotCost(basePrice, purchasePct, tons);
}

export function applyPurchaseDMs(
  roll: number,
  brokerSkill: number,
  purchaseDMs: number,
  saleDMs: number,
  supplierBroker: number,
): ModifiedPriceResult {
  const rawRoll = roll + brokerSkill + purchaseDMs - saleDMs - supplierBroker;
  const clampedRoll = clampModifiedPriceRoll(rawRoll);
  return {
    rawRoll,
    clampedRoll,
    brokerSkill,
    favourableDm: purchaseDMs,
    opposingDm: saleDMs,
    counterpartyBroker: supplierBroker,
    row: lookupModifiedPrice(clampedRoll),
  };
}

export function applySaleDMs(
  roll: number,
  brokerSkill: number,
  saleDMs: number,
  purchaseDMs: number,
  buyerBroker: number,
): ModifiedPriceResult {
  const rawRoll = roll + brokerSkill + saleDMs - purchaseDMs - buyerBroker;
  const clampedRoll = clampModifiedPriceRoll(rawRoll);
  return {
    rawRoll,
    clampedRoll,
    brokerSkill,
    favourableDm: saleDMs,
    opposingDm: purchaseDMs,
    counterpartyBroker: buyerBroker,
    row: lookupModifiedPrice(clampedRoll),
  };
}

function normaliseTradeCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseTradeDmString(value: string): TradeDmEntry[] {
  const normalised = value.replace(/[−–]/g, '-');
  return normalised
    .split(',')
    .map(part => part.trim())
    .flatMap(part => {
      const match = part.match(/^(.+?)([+-]\d+)$/);
      if (!match) return [];
      return [{ code: match[1].trim(), dm: parseInt(match[2], 10) }];
    });
}

export function worldTradeCodeLabels(profile: WorldProfile): string[] {
  return [
    ...profile.tradeCodes,
    ...(profile.zone === 'amber' ? ['Amber Zone'] : []),
    ...(profile.zone === 'red' ? ['Red Zone'] : []),
  ];
}

export function bestTradeDm(dmText: string, profile: WorldProfile): number {
  const worldCodes = new Set(worldTradeCodeLabels(profile).map(normaliseTradeCode));
  const matches = parseTradeDmString(dmText).filter(entry => worldCodes.has(normaliseTradeCode(entry.code)));
  if (matches.length === 0) return 0;
  return Math.max(...matches.map(entry => entry.dm));
}

function availabilityMatches(availability: string, profile: WorldProfile): boolean {
  if (availability.toLowerCase() === 'all') return true;
  const worldCodes = new Set(profile.tradeCodes.map(normaliseTradeCode));
  return availability
    .split(',')
    .map(code => normaliseTradeCode(code.trim()))
    .some(code => worldCodes.has(code));
}

export function availableTradeGoods(goods: TradeGood[], profile: WorldProfile, blackMarket = false): TradeGood[] {
  return goods.filter(good => {
    if (good.exotic) return blackMarket;
    if (!blackMarket && good.illegal) return false;
    if (blackMarket && good.illegal) return availabilityMatches(good.availability, profile);
    return availabilityMatches(good.availability, profile);
  });
}

export function tradeGoodPurchaseDm(good: TradeGood, profile: WorldProfile): number {
  return bestTradeDm(good.purchaseDM, profile);
}

export function tradeGoodSaleDm(good: TradeGood, profile: WorldProfile): number {
  return bestTradeDm(good.saleDM, profile);
}

export function populationQuantityDm(populationCode: number): number {
  if (populationCode <= 3) return -3;
  if (populationCode >= 9) return 3;
  return 0;
}

export function rollDice(count: number, sides = 6, roller: () => number = Math.random): number[] {
  return Array.from({ length: Math.max(0, count) }, () => Math.floor(roller() * sides) + 1);
}

export function rollTonsWithDm(expr: string, modifier = 0, roller: () => number = Math.random): RolledTons | null {
  if (expr === 'Varies') return null;
  const match = expr.match(/^(\d+)D(?:×(\d+))?$/);
  if (!match) return null;
  const dice = rollDice(parseInt(match[1], 10), 6, roller);
  const multiplier = match[2] ? parseInt(match[2], 10) : 1;
  const diceTotal = dice.reduce((sum, value) => sum + value, 0);
  return {
    dice,
    diceTotal,
    modifier,
    multiplier,
    tons: Math.max(0, diceTotal + modifier) * multiplier,
  };
}

export function supplierStarportDm(starport: StarportClass): number {
  if (starport === 'A') return 6;
  if (starport === 'B') return 4;
  if (starport === 'C') return 2;
  return 0;
}

function starportTrafficDm(starport: StarportClass): number {
  if (starport === 'A') return 2;
  if (starport === 'B') return 1;
  if (starport === 'E') return -1;
  if (starport === 'X') return -3;
  return 0;
}

function passengerPopulationDm(population: number): number {
  if (population <= 1) return -4;
  if (population >= 8) return 3;
  if (population >= 6) return 1;
  return 0;
}

function freightPopulationDm(population: number): number {
  if (population <= 1) return -4;
  if (population >= 8) return 4;
  if (population >= 6) return 2;
  return 0;
}

function passengerZoneDm(zone: TravelZone): number {
  if (zone === 'amber') return 1;
  if (zone === 'red') return -4;
  return 0;
}

function freightZoneDm(zone: TravelZone): number {
  if (zone === 'amber') return -2;
  if (zone === 'red') return -6;
  return 0;
}

export function passengerWorldDm(profile: WorldProfile): number {
  return passengerPopulationDm(profile.population) + starportTrafficDm(profile.starport) + passengerZoneDm(profile.zone);
}

export function freightWorldDm(profile: WorldProfile): number {
  const techDm = profile.techLevel <= 6 ? -1 : profile.techLevel >= 9 ? 2 : 0;
  return freightPopulationDm(profile.population) + starportTrafficDm(profile.starport) + freightZoneDm(profile.zone) + techDm;
}

export function passengerClassDm(passengerClass: PassengerClass): number {
  if (passengerClass === 'high') return -4;
  if (passengerClass === 'low') return 1;
  return 0;
}

export function freightLotDm(lotSize: FreightLotSize): number {
  if (lotSize === 'major') return -4;
  if (lotSize === 'incidental') return 2;
  return 0;
}

export function passengerTraffic(input: PassengerTrafficInput, passengerRolls: number[] = []): PassengerTrafficResult {
  const parsecDm = -Math.max(0, input.parsecs - 1);
  const total = input.roll
    + passengerClassDm(input.passengerClass)
    + passengerWorldDm(input.source)
    + passengerWorldDm(input.destination)
    + parsecDm
    + (input.skillEffect ?? 0)
    + (input.chiefStewardDm ?? 0)
    + (input.stewardSkill ?? 0);
  const dice = lookupPassengerTraffic(total).passengerDice;
  const passengers = passengerRolls.length > 0
    ? passengerRolls.reduce((sum, value) => sum + value, 0)
    : 0;
  const fare = lookupPassageFare(input.parsecs)[input.passengerClass];
  return { total, dice, passengers, fare, income: passengers * fare };
}

export function freightTraffic(input: FreightTrafficInput, lotRolls: number[] = []): FreightTrafficResult {
  const parsecDm = -Math.max(0, input.parsecs - 1);
  const total = input.roll
    + freightLotDm(input.lotSize)
    + freightWorldDm(input.source)
    + freightWorldDm(input.destination)
    + parsecDm
    + (input.skillEffect ?? 0);
  const dice = lookupFreightTraffic(total).lotDice;
  const lots = lotRolls.length > 0 ? lotRolls.reduce((sum, value) => sum + value, 0) : 0;
  const tonsPerLotMultiplier = input.lotSize === 'major' ? 10 : input.lotSize === 'minor' ? 5 : 1;
  const tons = lots * tonsPerLotMultiplier;
  const ratePerTon = lookupPassageFare(input.parsecs).freightPerTon;
  return { total, dice, lots, tons, ratePerTon, income: tons * ratePerTon };
}

export function splitPassengerIncome(counts: Record<PassengerClass, number>, parsecs: number): number {
  const fares = lookupPassageFare(parsecs);
  return counts.high * fares.high
    + counts.middle * fares.middle
    + counts.basic * fares.basic
    + counts.low * fares.low;
}

export function sortDeals(deals: TradeDeal[]): TradeDeal[] {
  return [...deals].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function filterTradeDeals(deals: TradeDeal[], filters: TradeFilters = {}): TradeDeal[] {
  const status = filters.status ?? 'all';
  const world = filters.world?.trim().toLowerCase() ?? '';

  return deals.filter(deal => {
    if (status !== 'all' && deal.status !== status) return false;
    if (!world) return true;

    const bought = deal.world_bought?.toLowerCase() ?? '';
    const sold = deal.world_sold?.toLowerCase() ?? '';
    return bought.includes(world) || sold.includes(world);
  });
}

export function tradeSummary(deals: TradeDeal[]): TradeSummary {
  return {
    activeCapital: deals
      .filter(deal => deal.status === 'active' && deal.buy_price !== null)
      .reduce((sum, deal) => sum + (deal.buy_price! * deal.quantity), 0),
    realisedProfit: deals
      .filter(deal => deal.status === 'completed')
      .reduce((sum, deal) => sum + (profit(deal) ?? 0), 0),
    totalDeals: deals.length,
  };
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function dealsToCsv(deals: TradeDeal[]): string {
  const header = ['Item', 'Quantity', 'Buy Price', 'Sell Price', 'Profit', 'World Bought', 'World Sold', 'Status', 'Notes'];
  const rows = deals.map(deal => [
    deal.item,
    deal.quantity,
    deal.buy_price,
    deal.sell_price,
    profit(deal),
    deal.world_bought,
    deal.world_sold,
    deal.status,
    deal.notes,
  ]);

  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}
