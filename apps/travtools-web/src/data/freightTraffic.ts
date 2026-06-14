export interface FreightTrafficRow {
  result: number;
  lotDice: number;
}

export const FREIGHT_TRAFFIC: FreightTrafficRow[] = [
  { result: 1, lotDice: 0 },
  { result: 2, lotDice: 1 },
  { result: 3, lotDice: 1 },
  { result: 4, lotDice: 2 },
  { result: 5, lotDice: 2 },
  { result: 6, lotDice: 3 },
  { result: 7, lotDice: 3 },
  { result: 8, lotDice: 3 },
  { result: 9, lotDice: 4 },
  { result: 10, lotDice: 4 },
  { result: 11, lotDice: 4 },
  { result: 12, lotDice: 5 },
  { result: 13, lotDice: 5 },
  { result: 14, lotDice: 5 },
  { result: 15, lotDice: 6 },
  { result: 16, lotDice: 6 },
  { result: 17, lotDice: 7 },
  { result: 18, lotDice: 8 },
  { result: 19, lotDice: 9 },
  { result: 20, lotDice: 10 },
];

export function lookupFreightTraffic(result: number): FreightTrafficRow {
  if (result <= 1) return FREIGHT_TRAFFIC[0];
  if (result >= 20) return FREIGHT_TRAFFIC[FREIGHT_TRAFFIC.length - 1];
  return FREIGHT_TRAFFIC.find(row => row.result === result) ?? FREIGHT_TRAFFIC[0];
}

export function mailTrafficDm(freightTrafficDm: number): number {
  if (freightTrafficDm <= -10) return -2;
  if (freightTrafficDm <= -5) return -1;
  if (freightTrafficDm <= 4) return 0;
  if (freightTrafficDm <= 9) return 1;
  return 2;
}
