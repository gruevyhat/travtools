import { InventoryItem } from '../types';

export const INVENTORY_CATEGORIES = ['Weapon', 'Armour', 'Equipment', 'Medicine', 'Cargo', 'Electronics', 'Survival', 'Other'];

export interface InventoryFilters {
  owner?: string;
  category?: string;
}

export function sortItems(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterInventoryItems(items: InventoryItem[], filters: InventoryFilters): InventoryItem[] {
  return items.filter(item => {
    if (filters.owner && item.owner !== filters.owner) return false;
    if (filters.category && item.category !== filters.category) return false;
    return true;
  });
}

export function inventoryTotals(items: InventoryItem[]): { totalWeight: number; totalValue: number } {
  return items.reduce((totals, item) => ({
    totalWeight: totals.totalWeight + (item.weight_kg ?? 0) * item.quantity,
    totalValue: totals.totalValue + (item.value_cr ?? 0) * item.quantity,
  }), { totalWeight: 0, totalValue: 0 });
}

export function categoryChipClass(category: string | null): string {
  switch (category) {
    case 'Weapon': return 'border-alert/70 text-alert bg-alert/5';
    case 'Armour': return 'border-cyan-dim text-cyan-trav bg-cyan-dim/10';
    case 'Medicine': return 'border-safe/70 text-safe bg-safe/5';
    case 'Cargo': return 'border-amber/70 text-amber bg-amber/5';
    case 'Electronics': return 'border-cyan-trav/60 text-cyan-trav bg-cyan-trav/5';
    case 'Survival': return 'border-steel text-body bg-steel/15';
    case 'Equipment': return 'border-body/40 text-body bg-body/5';
    default: return 'border-steel/70 text-body/70 bg-steel/10';
  }
}
