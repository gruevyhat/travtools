export interface PassengerTrafficRow {
  result: number;
  passengerDice: number;
}

export const PASSENGER_TRAFFIC: PassengerTrafficRow[] = [
  { result: 1, passengerDice: 0 },
  { result: 2, passengerDice: 1 },
  { result: 3, passengerDice: 1 },
  { result: 4, passengerDice: 2 },
  { result: 5, passengerDice: 2 },
  { result: 6, passengerDice: 2 },
  { result: 7, passengerDice: 3 },
  { result: 8, passengerDice: 3 },
  { result: 9, passengerDice: 3 },
  { result: 10, passengerDice: 3 },
  { result: 11, passengerDice: 4 },
  { result: 12, passengerDice: 4 },
  { result: 13, passengerDice: 4 },
  { result: 14, passengerDice: 5 },
  { result: 15, passengerDice: 5 },
  { result: 16, passengerDice: 6 },
  { result: 17, passengerDice: 7 },
  { result: 18, passengerDice: 8 },
  { result: 19, passengerDice: 9 },
  { result: 20, passengerDice: 10 },
];

export function lookupPassengerTraffic(result: number): PassengerTrafficRow {
  if (result <= 1) return PASSENGER_TRAFFIC[0];
  if (result >= 20) return PASSENGER_TRAFFIC[PASSENGER_TRAFFIC.length - 1];
  return PASSENGER_TRAFFIC.find(row => row.result === result) ?? PASSENGER_TRAFFIC[0];
}
