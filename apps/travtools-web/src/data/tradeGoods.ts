// Trade goods table — Traveller 2022 Core Rulebook, pp.244–245.
// D66 roll: first die = tens digit, second die = units digit.
// Tons: roll specified dice and multiply (e.g. "2D×10" = 2d6 × 10).
// BasePrice in Credits. null = Exotics (price set by roleplay).
// Modified Price lives in modifiedPrice.ts. It uses the p.243 range from -3 to 25+.

import { formatTradeCodeList, formatTradeDmString } from '../lib/trade';

export interface TradeGood {
  d66: number;
  type: string;
  availability: string;
  tons: string;
  basePrice: number | null;
  purchaseDM: string;
  saleDM: string;
  examples: string;
  illegal?: boolean;
  exotic?: boolean;
}

export const TRADE_GOODS: TradeGood[] = [
  // ── Common (D66 11–16) ──────────────────────────────────────────────────────
  {
    d66: 11,
    type: 'Common Electronics',
    availability: 'All',
    tons: '2D×10',
    basePrice: 20000,
    purchaseDM: 'Industrial+2, High Tech+3, Rich+1',
    saleDM: 'Non-Industrial+2, Low Tech+1, Poor+1',
    examples: 'Simple electronics, basic computers up to TL10',
  },
  {
    d66: 12,
    type: 'Common Industrial Goods',
    availability: 'All',
    tons: '2D×10',
    basePrice: 10000,
    purchaseDM: 'Non-Agricultural+2, Industrial+5',
    saleDM: 'Non-Industrial+3, Agricultural+2',
    examples: 'Machine components, spare parts for common machinery',
  },
  {
    d66: 13,
    type: 'Common Manufactured Goods',
    availability: 'All',
    tons: '2D×10',
    basePrice: 20000,
    purchaseDM: 'Non-Agricultural+2, High Pop+3, Industrial+2',
    saleDM: 'Non-Industrial+2, Poor+2, Agricultural+2',
    examples: 'Clothing, textiles, basic consumer goods',
  },
  {
    d66: 14,
    type: 'Common Raw Materials',
    availability: 'All',
    tons: '2D×20',
    basePrice: 5000,
    purchaseDM: 'Agricultural+3, Garden+2',
    saleDM: 'Industrial+2, Poor+2',
    examples: 'Agricultural products, seafood, foodstuffs',
  },
  {
    d66: 15,
    type: 'Common Consumables',
    availability: 'All',
    tons: '2D×20',
    basePrice: 500,
    purchaseDM: 'Agricultural+3, Water World+2, Garden+1, Ice-Capped+1',
    saleDM: 'Asteroid+1, Fluid Oceans+1, Ice-Capped+1, High Pop+1',
    examples: 'Food, alcohol, medicines, hygiene products',
  },
  {
    d66: 16,
    type: 'Common Ore',
    availability: 'All',
    tons: '2D×20',
    basePrice: 1000,
    purchaseDM: 'Asteroid+4',
    saleDM: 'Industrial+3, Non-Industrial+1',
    examples: 'Low-grade ore, common metals',
  },
  // ── Advanced (D66 21–26) ────────────────────────────────────────────────────
  {
    d66: 21,
    type: 'Advanced Electronics',
    availability: 'Industrial, High Tech',
    tons: '1D×5',
    basePrice: 100000,
    purchaseDM: 'Industrial+2, High Tech+3',
    saleDM: 'Non-Industrial+1, Rich+1, Asteroid+3',
    examples: 'Computers, sensors, scanners, medical equipment, avionics',
  },
  {
    d66: 22,
    type: 'Advanced Machine Parts',
    availability: 'Industrial, High Tech',
    tons: '1D×5',
    basePrice: 75000,
    purchaseDM: 'Industrial+2, High Tech+2',
    saleDM: 'Asteroid+2, Non-Industrial+1',
    examples: 'Cutting-edge industrial machinery, vehicle components',
  },
  {
    d66: 23,
    type: 'Advanced Manufactured Goods',
    availability: 'Industrial, High Tech',
    tons: '1D×5',
    basePrice: 100000,
    purchaseDM: 'Industrial+1',
    saleDM: 'High Pop+1, Rich+1',
    examples: 'High-tech consumer goods, electronic gadgets',
  },
  {
    d66: 24,
    type: 'Advanced Weapons',
    availability: 'Industrial, High Tech',
    tons: '1D×5',
    basePrice: 150000,
    purchaseDM: 'High Tech+2',
    saleDM: 'Poor+1, Amber Zone+2, Red Zone+4',
    examples: 'Guns, explosives, military equipment',
  },
  {
    d66: 25,
    type: 'Advanced Vehicles',
    availability: 'Industrial, High Tech',
    tons: '1D×5',
    basePrice: 180000,
    purchaseDM: 'High Tech+2',
    saleDM: 'Asteroid+2, Rich+2',
    examples: 'Air/raft, submersibles, AFVs',
  },
  {
    d66: 26,
    type: 'Biochemicals',
    availability: 'Agricultural, Water World',
    tons: '1D×5',
    basePrice: 50000,
    purchaseDM: 'Agricultural+1, Water World+2',
    saleDM: 'Industrial+2',
    examples: 'Biofuels, organic chemicals, pharmaceutical crops',
  },
  // ── Speciality (D66 31–36) ──────────────────────────────────────────────────
  {
    d66: 31,
    type: 'Crystals & Gems',
    availability: 'Asteroid, Desert, Ice-Capped',
    tons: '1D×5',
    basePrice: 20000,
    purchaseDM: 'Asteroid+2, Desert+1, Ice-Capped+1',
    saleDM: 'Industrial+3, Rich+2',
    examples: 'Diamonds, industrial crystals, rare elements',
  },
  {
    d66: 32,
    type: 'Cybernetics',
    availability: 'High Tech',
    tons: '1D',
    basePrice: 250000,
    purchaseDM: 'High Tech+1',
    saleDM: 'Asteroid+1, Ice-Capped+1, Rich+2',
    examples: 'Artificial body parts, interface technology',
  },
  {
    d66: 33,
    type: 'Live Animals',
    availability: 'Agricultural, Garden',
    tons: '1D×10',
    basePrice: 10000,
    purchaseDM: 'Agricultural+2',
    saleDM: 'Low Pop+3',
    examples: 'Livestock, pets, exotic fauna',
  },
  {
    d66: 34,
    type: 'Luxury Consumables',
    availability: 'Agricultural, Garden, Water World',
    tons: '1D×10',
    basePrice: 20000,
    purchaseDM: 'Agricultural+2, Water World+1',
    saleDM: 'Rich+2, High Pop+2',
    examples: 'Rare foods and beverages, organic delicacies',
  },
  {
    d66: 35,
    type: 'Luxury Goods',
    availability: 'High Pop',
    tons: '1D',
    basePrice: 200000,
    purchaseDM: 'High Pop+1',
    saleDM: 'Rich+4',
    examples: 'Fine clothing, jewellery, art',
  },
  {
    d66: 36,
    type: 'Medical Supplies',
    availability: 'High Tech, High Pop',
    tons: '1D×5',
    basePrice: 50000,
    purchaseDM: 'High Tech+2',
    saleDM: 'Industrial+2, Poor+1, Rich+1',
    examples: 'Drugs, vaccines, cloning technology',
  },
  // ── Rare (D66 41–46) ────────────────────────────────────────────────────────
  {
    d66: 41,
    type: 'Petrochemicals',
    availability: 'Desert, Fluid Oceans, Ice-Capped, Water World',
    tons: '1D×10',
    basePrice: 10000,
    purchaseDM: 'Desert+2',
    saleDM: 'Industrial+2, Agricultural+1, Low Tech+1',
    examples: 'Oil, liquid fuels',
  },
  {
    d66: 42,
    type: 'Pharmaceuticals',
    availability: 'Asteroid, Desert, High Pop, Water World',
    tons: '1D',
    basePrice: 100000,
    purchaseDM: 'Asteroid+2, High Pop+1',
    saleDM: 'Rich+2, Low Tech+1',
    examples: 'Drugs, medical supplies, anagathics, fast/slow drugs',
  },
  {
    d66: 43,
    type: 'Polymers',
    availability: 'Industrial',
    tons: '1D×10',
    basePrice: 7000,
    purchaseDM: 'Industrial+1',
    saleDM: 'Rich+2, Non-Industrial+1',
    examples: 'Plastics and other synthetics',
  },
  {
    d66: 44,
    type: 'Precious Metals',
    availability: 'Asteroid, Desert, Ice-Capped, Fluid Oceans',
    tons: '1D',
    basePrice: 50000,
    purchaseDM: 'Asteroid+3, Desert+2, Ice-Capped+1',
    saleDM: 'Rich+3, Industrial+2, High Tech+1',
    examples: 'Gold, silver, platinum, rare elements',
  },
  {
    d66: 45,
    type: 'Radioactives',
    availability: 'Asteroid, Desert, Low Pop',
    tons: '1D',
    basePrice: 1000000,
    purchaseDM: 'Asteroid+2, Low Pop+2',
    saleDM: 'Industrial+3, High Tech+2, Non-Industrial−2, Agricultural−3',
    examples: 'Uranium, plutonium, unobtanium, rare elements',
  },
  {
    d66: 46,
    type: 'Robots',
    availability: 'Industrial',
    tons: '1D×5',
    basePrice: 400000,
    purchaseDM: 'Industrial+1',
    saleDM: 'Agricultural+2, High Pop+3',
    examples: 'Industrial and personal robots and drones',
  },
  // ── Bulk (D66 51–56) ────────────────────────────────────────────────────────
  {
    d66: 51,
    type: 'Spices',
    availability: 'Garden, Desert, Water World',
    tons: '1D×10',
    basePrice: 6000,
    purchaseDM: 'Desert+2',
    saleDM: 'Rich+2, High Pop+2',
    examples: 'Preservatives, luxury food additives, natural drugs',
  },
  {
    d66: 52,
    type: 'Textiles',
    availability: 'Agricultural, Non-Industrial',
    tons: '1D×20',
    basePrice: 3000,
    purchaseDM: 'Agricultural+7',
    saleDM: 'High Pop+3, Non-Agricultural+2',
    examples: 'Clothing and fabrics',
  },
  {
    d66: 53,
    type: 'Uncommon Ore',
    availability: 'Asteroid, Ice-Capped',
    tons: '1D×20',
    basePrice: 5000,
    purchaseDM: 'Asteroid+4',
    saleDM: 'Industrial+3, Non-Industrial+1',
    examples: 'Ore and metals extracted in small quantities',
  },
  {
    d66: 54,
    type: 'Uncommon Raw Materials',
    availability: 'Agricultural, Desert, Water World',
    tons: '1D×10',
    basePrice: 20000,
    purchaseDM: 'Agricultural+2, Water World+1',
    saleDM: 'Industrial+2, High Tech+1',
    examples: 'Unusual biological or geological products',
  },
  {
    d66: 55,
    type: 'Wood',
    availability: 'Agricultural, Garden',
    tons: '1D×20',
    basePrice: 1000,
    purchaseDM: 'Agricultural+6',
    saleDM: 'Rich+2, Industrial+1',
    examples: 'Timber and forest products',
  },
  {
    d66: 56,
    type: 'Vehicles',
    availability: 'Industrial, High Tech',
    tons: '1D×10',
    basePrice: 15000,
    purchaseDM: 'Industrial+2, High Tech+1',
    saleDM: 'Non-Industrial+2, High Pop+1',
    examples: 'Personal vehicles, wheeled and tracked',
  },
  // ── Illegal (D66 61–65) — restricted goods, legal risk at most ports ─────────
  {
    d66: 61,
    type: 'Illegal Biochemicals',
    availability: 'Agricultural, Water World',
    tons: '1D×5',
    basePrice: 50000,
    purchaseDM: 'Water World+2',
    saleDM: 'Industrial+6',
    examples: 'Dangerous chemicals, extracts from endangered species',
    illegal: true,
  },
  {
    d66: 62,
    type: 'Cybernetics, Illegal',
    availability: 'High Tech',
    tons: '1D',
    basePrice: 250000,
    purchaseDM: 'High Tech+1',
    saleDM: 'Asteroid+4, Rich+8, Amber Zone+8, Red Zone+6',
    examples: 'Illegal cybernetic enhancements, restricted augments',
    illegal: true,
  },
  {
    d66: 63,
    type: 'Drugs, Illegal',
    availability: 'Asteroid, Desert, High Pop, Water World',
    tons: '1D',
    basePrice: 100000,
    purchaseDM: 'Asteroid+1, Desert+1, Garden+1, Water World+1',
    saleDM: 'Rich+6, High Pop+6',
    examples: 'Controlled substances, recreational drugs',
    illegal: true,
  },
  {
    d66: 64,
    type: 'Luxuries, Illegal',
    availability: 'Agricultural, Garden, Water World',
    tons: '1D',
    basePrice: 50000,
    purchaseDM: 'Agricultural+2, Water World+1',
    saleDM: 'Rich+6, High Pop+4',
    examples: 'Forbidden imports, restricted exotic goods',
    illegal: true,
  },
  {
    d66: 65,
    type: 'Weapons, Illegal',
    availability: 'Industrial, High Tech',
    tons: '1D×5',
    basePrice: 150000,
    purchaseDM: 'High Tech+2',
    saleDM: 'Poor+6, Amber Zone+8, Red Zone+10',
    examples: 'Weapons banned or controlled by local authority',
    illegal: true,
  },
  // ── Exotics (D66 66) — outside normal trade rules ───────────────────────────
  {
    d66: 66,
    type: 'Exotics',
    availability: 'Varies',
    tons: 'Varies',
    basePrice: null,
    purchaseDM: '—',
    saleDM: '—',
    examples: 'Alien relics, prototype technology, unique plant/animal life, priceless treasures',
    exotic: true,
  },
];

export function searchTradeGoods(query: string): TradeGood[] {
  if (!query.trim()) return TRADE_GOODS;
  const q = query.trim().toLowerCase();
  return TRADE_GOODS.filter(
    g =>
      g.type.toLowerCase().includes(q) ||
      g.availability.toLowerCase().includes(q) ||
      formatTradeCodeList(g.availability).toLowerCase().includes(q) ||
      formatTradeDmString(g.purchaseDM).toLowerCase().includes(q) ||
      formatTradeDmString(g.saleDM).toLowerCase().includes(q) ||
      g.examples.toLowerCase().includes(q) ||
      String(g.d66).includes(q),
  );
}

export function formatBasePrice(price: number | null): string {
  if (price === null) return '—';
  if (price >= 1000000) return `MCr${price / 1000000}`;
  if (price >= 1000) return `Cr${(price / 1000).toLocaleString()}k`;
  return `Cr${price}`;
}
