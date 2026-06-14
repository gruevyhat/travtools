// Modified Price Table - Traveller 2022 Core Rulebook, p.243.
// Roll 3D6 then add the Purchase DMs (when buying) or Sale DMs (when selling)
// from the matching trade good row. Clamp the total to [-3, 25] before lookup.
// purchasePct: multiply base price by this ÷ 100 to get the buy price.
// salePct:     multiply base price by this ÷ 100 to get the sale price.
// Verified against the p.243 table during M11 implementation.

export interface ModifiedPriceRow {
  roll: number;
  purchasePct: number;
  salePct: number;
}

export const MODIFIED_PRICE: ModifiedPriceRow[] = [
  { roll: -3, purchasePct: 300, salePct: 10 },
  { roll: -2, purchasePct: 250, salePct: 20 },
  { roll: -1, purchasePct: 200, salePct: 30 },
  { roll: 0, purchasePct: 175, salePct: 40 },
  { roll: 1, purchasePct: 150, salePct: 45 },
  { roll: 2, purchasePct: 135, salePct: 50 },
  { roll: 3, purchasePct: 125, salePct: 55 },
  { roll: 4, purchasePct: 120, salePct: 60 },
  { roll: 5, purchasePct: 115, salePct: 65 },
  { roll: 6, purchasePct: 110, salePct: 70 },
  { roll: 7, purchasePct: 105, salePct: 75 },
  { roll: 8, purchasePct: 100, salePct: 80 },
  { roll: 9, purchasePct: 95, salePct: 85 },
  { roll: 10, purchasePct: 90, salePct: 90 },
  { roll: 11, purchasePct: 85, salePct: 100 },
  { roll: 12, purchasePct: 80, salePct: 105 },
  { roll: 13, purchasePct: 75, salePct: 110 },
  { roll: 14, purchasePct: 70, salePct: 115 },
  { roll: 15, purchasePct: 65, salePct: 120 },
  { roll: 16, purchasePct: 60, salePct: 125 },
  { roll: 17, purchasePct: 55, salePct: 130 },
  { roll: 18, purchasePct: 50, salePct: 140 },
  { roll: 19, purchasePct: 45, salePct: 150 },
  { roll: 20, purchasePct: 40, salePct: 160 },
  { roll: 21, purchasePct: 35, salePct: 175 },
  { roll: 22, purchasePct: 30, salePct: 200 },
  { roll: 23, purchasePct: 25, salePct: 250 },
  { roll: 24, purchasePct: 20, salePct: 300 },
  { roll: 25, purchasePct: 15, salePct: 400 },
];

export function lookupModifiedPrice(roll3d: number): ModifiedPriceRow {
  const clamped = Math.max(-3, Math.min(25, roll3d));
  return MODIFIED_PRICE.find(r => r.roll === clamped) ?? MODIFIED_PRICE[MODIFIED_PRICE.length - 1];
}

/** Evaluate a tons expression like "2D×10", "1D×5", "1D" and return the rolled value. */
export function rollTonsExpr(expr: string): number | null {
  if (expr === 'Varies') return null;
  const m = expr.match(/^(\d+)D(?:×(\d+))?$/);
  if (!m) return null;
  const numDice = parseInt(m[1], 10);
  const multiplier = m[2] ? parseInt(m[2], 10) : 1;
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.ceil(Math.random() * 6);
  }
  return total * multiplier;
}
