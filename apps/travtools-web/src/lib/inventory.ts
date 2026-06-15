import { CORE_EQUIPMENT } from '../data/equipment';
import { Character, InventoryItem } from '../types';

export const INVENTORY_CATEGORIES = ['Weapon', 'Armour', 'Equipment', 'Medicine', 'Cargo', 'Electronics', 'Survival', 'Other'];
export const PARTY_OWNER_LABEL = 'Party';
export const OTHER_OWNER_LABEL = 'Other';

export type InventoryOwnerType = 'party' | 'character' | 'other';

export type InventoryCharacter = Pick<Character,
  'id' | 'name' | 'player' | 'created_at' | 'weapons' | 'armour' | 'personal_equipment' | 'augments'
>;

export interface InventoryListItem extends InventoryItem {
  source: 'inventory' | 'roster';
  source_label: string;
  readOnly: boolean;
  owner_type: InventoryOwnerType | null;
}

export interface InventoryFilters {
  owner?: string;
  category?: string;
}

export function sortItems<T extends { name: string; owner?: string | null; source?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterInventoryItems<T extends InventoryItem>(items: T[], filters: InventoryFilters): T[] {
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

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function characterInventoryOwner(char: Pick<Character, 'name' | 'player'>): string {
  if (char.name && char.name !== 'Unknown') return char.name;
  return char.player ? `<<${char.player}>>` : 'Unknown';
}

export function characterOwnerOptions(characters: InventoryCharacter[]): Array<{ id: string; label: string }> {
  return characters
    .map(character => ({ id: character.id, label: characterInventoryOwner(character) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeLookupName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\(x\s*\d+\)/g, '')
    .replace(/\btl\s*\d+\b/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function equipmentLookupName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\(x\s*\d+\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inferredQuantityFromName(name: string | null | undefined): number | null {
  const match = (name ?? '').match(/\(x\s*(\d+)\)/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function quantityFor(item: { quantity?: number | null; name?: string | null }): number {
  return item.quantity ?? inferredQuantityFromName(item.name) ?? 1;
}

function explicitMass(item: { mass?: number | null; mass_kg?: number | null; weight_kg?: number | null }): number | null {
  if (typeof item.mass === 'number') return item.mass;
  if (typeof item.mass_kg === 'number') return item.mass_kg;
  if (typeof item.weight_kg === 'number') return item.weight_kg;
  return null;
}

function explicitCost(item: { cost?: number | null; value_cr?: number | null }): number | null {
  if (typeof item.cost === 'number') return item.cost;
  if (typeof item.value_cr === 'number') return item.value_cr;
  return null;
}

function coreEquipmentFor(name: string | null | undefined, categories: string[]) {
  const exactKey = equipmentLookupName(name);
  const exactMatch = CORE_EQUIPMENT.find(item =>
    categories.includes(item.inventoryCategory) &&
    equipmentLookupName(item.name) === exactKey
  );
  if (exactMatch) return exactMatch;

  const key = normalizeLookupName(name);
  if (!key) return null;
  return CORE_EQUIPMENT.find(item =>
    categories.includes(item.inventoryCategory) &&
    normalizeLookupName(item.name) === key
  ) ?? null;
}

function massFor(item: { name?: string | null; mass?: number | null; mass_kg?: number | null; weight_kg?: number | null }, categories: string[]): number | null {
  return explicitMass(item) ?? coreEquipmentFor(item.name, categories)?.massKg ?? null;
}

function valueFor(item: { name?: string | null; cost?: number | null; value_cr?: number | null }, categories: string[]): number | null {
  return explicitCost(item) ?? coreEquipmentFor(item.name, categories)?.costCr ?? null;
}

function categoryFor(name: string | null | undefined, categories: string[], fallback: string): string {
  return coreEquipmentFor(name, categories)?.inventoryCategory ?? fallback;
}

function joinedNotes(parts: Array<string | null | undefined | false>): string | null {
  const note = parts.filter(hasText).join(' | ');
  return note || null;
}

function rosterBaseItem(
  char: InventoryCharacter,
  index: number,
  kind: string,
  name: string,
): Pick<InventoryListItem, 'id' | 'name' | 'owner' | 'location' | 'created_at' | 'source' | 'source_label' | 'readOnly' | 'owner_type'> {
  return {
    id: `character:${char.id}:${kind}:${index}`,
    name,
    owner: characterInventoryOwner(char),
    location: 'Roster',
    created_at: char.created_at,
    source: 'roster',
    source_label: `Roster ${kind}`,
    readOnly: true,
    owner_type: 'character',
  };
}

export function inventoryItemsFromCharacters(characters: InventoryCharacter[]): InventoryListItem[] {
  const rows: InventoryListItem[] = [];

  for (const char of characters) {
    (char.weapons ?? []).forEach((weapon, index) => {
      if (!hasText(weapon.name) || weapon.name.trim().toLowerCase() === 'unarmed') return;
      rows.push({
        ...rosterBaseItem(char, index, 'weapon', weapon.name.trim()),
        category: 'Weapon',
        quantity: quantityFor(weapon),
        weight_kg: massFor(weapon, ['Weapon']),
        value_cr: valueFor(weapon, ['Weapon']),
        notes: joinedNotes([
          hasText(weapon.damage) && `Damage ${weapon.damage}`,
          hasText(weapon.range) && `Range ${weapon.range}`,
          hasText(weapon.traits) && weapon.traits,
        ]),
      });
    });

    (char.armour ?? []).forEach((armour, index) => {
      if (!hasText(armour.name)) return;
      rows.push({
        ...rosterBaseItem(char, index, 'armour', armour.name.trim()),
        category: 'Armour',
        quantity: quantityFor(armour),
        weight_kg: massFor(armour, ['Armour']),
        value_cr: valueFor(armour, ['Armour']),
        notes: joinedNotes([
          armour.worn === true ? 'Worn' : armour.worn === false ? 'Stowed' : null,
          armour.protection !== null ? `Protection ${armour.protection}` : null,
          armour.radiation !== null ? `Rad ${armour.radiation}` : null,
          hasText(armour.required_skill) && `Req ${armour.required_skill}`,
        ]),
      });
    });

    (char.personal_equipment ?? []).forEach((item, index) => {
      if (!hasText(item.name)) return;
      rows.push({
        ...rosterBaseItem(char, index, 'item', item.name.trim()),
        category: categoryFor(item.name, ['Equipment', 'Medicine', 'Electronics', 'Survival', 'Other'], 'Equipment'),
        quantity: quantityFor(item),
        weight_kg: massFor(item, ['Equipment', 'Medicine', 'Electronics', 'Survival', 'Other']),
        value_cr: valueFor(item, ['Equipment', 'Medicine', 'Electronics', 'Survival', 'Other']),
        notes: joinedNotes([
          item.tech_level !== null ? `TL ${item.tech_level}` : null,
          item.notes,
        ]),
      });
    });

    (char.augments ?? []).forEach((augment, index) => {
      if (!hasText(augment.name)) return;
      rows.push({
        ...rosterBaseItem(char, index, 'augment', augment.name.trim()),
        category: categoryFor(augment.name, ['Equipment', 'Medicine', 'Electronics', 'Armour', 'Other'], 'Equipment'),
        quantity: 1,
        weight_kg: massFor(augment, ['Equipment', 'Medicine', 'Electronics', 'Armour', 'Other']),
        value_cr: valueFor(augment, ['Equipment', 'Medicine', 'Electronics', 'Armour', 'Other']),
        notes: joinedNotes([
          augment.tech_level !== null ? `TL ${augment.tech_level}` : null,
          augment.notes,
        ]),
      });
    });
  }

  return sortItems(rows);
}

export function inventoryListItems(items: InventoryItem[], characters: InventoryCharacter[]): InventoryListItem[] {
  const savedItems: InventoryListItem[] = items.map(item => ({
    ...item,
    source: 'inventory',
    source_label: 'Inventory',
    readOnly: false,
    owner_type: classifyInventoryOwner(item.owner, characters),
  }));
  return sortItems([...savedItems, ...inventoryItemsFromCharacters(characters)]);
}

export function classifyInventoryOwner(owner: string | null | undefined, characters: InventoryCharacter[]): InventoryOwnerType | null {
  if (!hasText(owner)) return null;
  if (owner.trim().toLowerCase() === PARTY_OWNER_LABEL.toLowerCase()) return 'party';
  const characterOwners = characterOwnerOptions(characters).map(character => character.label.toLowerCase());
  return characterOwners.includes(owner.trim().toLowerCase()) ? 'character' : 'other';
}

export function ownerTypeLabel(ownerType: InventoryOwnerType | null): string {
  switch (ownerType) {
    case 'party': return 'PARTY';
    case 'character': return 'CHARACTER';
    case 'other': return 'OTHER';
    default: return 'UNASSIGNED';
  }
}

export function sortedInventoryOwners(items: InventoryListItem[], characters: InventoryCharacter[]): string[] {
  const unique = [...new Set(items.map(item => item.owner).filter(hasText))];
  const characterNames = new Set(characterOwnerOptions(characters).map(character => character.label));
  return unique.sort((a, b) => {
    if (a === PARTY_OWNER_LABEL) return -1;
    if (b === PARTY_OWNER_LABEL) return 1;
    const aIsCharacter = characterNames.has(a);
    const bIsCharacter = characterNames.has(b);
    if (aIsCharacter && !bIsCharacter) return -1;
    if (!aIsCharacter && bIsCharacter) return 1;
    return a.localeCompare(b);
  });
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
