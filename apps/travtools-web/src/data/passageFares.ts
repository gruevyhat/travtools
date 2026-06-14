export type PassengerClass = 'high' | 'middle' | 'basic' | 'low';

export interface PassageFareRow {
  parsecs: number;
  high: number;
  middle: number;
  basic: number;
  low: number;
  freightPerTon: number;
}

export const PASSAGE_FARES: PassageFareRow[] = [
  { parsecs: 1, high: 9000, middle: 6500, basic: 2000, low: 700, freightPerTon: 1000 },
  { parsecs: 2, high: 14000, middle: 10000, basic: 3000, low: 1300, freightPerTon: 1600 },
  { parsecs: 3, high: 21000, middle: 14000, basic: 5000, low: 2200, freightPerTon: 2600 },
  { parsecs: 4, high: 34000, middle: 23000, basic: 8000, low: 3900, freightPerTon: 4400 },
  { parsecs: 5, high: 60000, middle: 40000, basic: 14000, low: 7200, freightPerTon: 8500 },
  { parsecs: 6, high: 210000, middle: 130000, basic: 55000, low: 27000, freightPerTon: 32000 },
];

export function lookupPassageFare(parsecs: number): PassageFareRow {
  const clamped = Math.max(1, Math.min(6, Math.round(parsecs)));
  return PASSAGE_FARES.find(row => row.parsecs === clamped) ?? PASSAGE_FARES[0];
}
