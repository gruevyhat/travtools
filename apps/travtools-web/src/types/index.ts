export interface Annotation {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface Ship {
  id: string;
  name: string;
  ship_class: string | null;
  tonnage: number | null;
  image_url: string | null;
  schematic_type: 'canonical' | 'custom';
  canonical_id: string | null;
  annotations: Annotation[];
  notes: string | null;
  created_at: string;
}

export interface TradeDeal {
  id: string;
  item: string;
  quantity: number;
  buy_price: number | null;
  sell_price: number | null;
  status: 'active' | 'completed' | 'cancelled';
  world_bought: string | null;
  world_sold: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  weight_kg: number | null;
  value_cr: number | null;
  owner: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
}

export interface Skill {
  name: string;
  level: number;
}

export interface PsionicTalent {
  name: string;
  level: number;
}

export interface Character {
  id: string;
  name: string;
  str: number | null;
  dex: number | null;
  end_stat: number | null;
  int_stat: number | null;
  edu: number | null;
  soc: number | null;
  psi: number | null;
  career: string | null;
  rank: string | null;
  homeworld: string | null;
  skills: Skill[];
  psionic_talents: PsionicTalent[];
  notes: string | null;
  created_at: string;
}
