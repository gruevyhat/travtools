// Modified Price Table — Traveller 2022 Core Rulebook, p.243.
// Roll 3D6 then add the Purchase DMs (when buying) or Sale DMs (when selling)
// from the matching trade good row.  Clamp the total to [3, 14] before lookup.
// purchasePct: multiply base price by this ÷ 100 to get the buy price.
// salePct:     multiply base price by this ÷ 100 to get the sale price.
// NOTE: The source scan may contain errors — verify against the physical book.

export interface ModifiedPriceRow {
  roll: number;
  purchasePct: number;
  salePct: number;
}

export const MODIFIED_PRICE: ModifiedPriceRow[] = [
  { roll: 3,  purchasePct: 40,  salePct: 140 },
  { roll: 4,  purchasePct: 50,  salePct: 130 },
  { roll: 5,  purchasePct: 60,  salePct: 120 },
  { roll: 6,  purchasePct: 70,  salePct: 110 },
  { roll: 7,  purchasePct: 80,  salePct: 100 },
  { roll: 8,  purchasePct: 90,  salePct: 90  },
  { roll: 9,  purchasePct: 80,  salePct: 100 },
  { roll: 10, purchasePct: 90,  salePct: 90  },
  { roll: 11, purchasePct: 100, salePct: 85  },
  { roll: 12, purchasePct: 105, salePct: 75  },
  { roll: 13, purchasePct: 110, salePct: 70  },
  { roll: 14, purchasePct: 120, salePct: 60  },
];

export function lookupModifiedPrice(roll3d: number): ModifiedPriceRow {
  const clamped = Math.max(3, Math.min(14, roll3d));
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
