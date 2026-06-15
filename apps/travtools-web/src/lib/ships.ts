import { Ship } from '../types';

export function sortShips(ships: Ship[]): Ship[] {
  return [...ships].sort((a, b) => a.name.localeCompare(b.name));
}
