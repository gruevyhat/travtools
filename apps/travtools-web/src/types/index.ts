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

export interface Weapon {
  name: string;
  skill: string;
  range: string;
  damage: string;
  traits: string;
}

export interface Character {
  id: string;
  name: string;
  player: string | null;
  str: number | null;
  dex: number | null;
  end_stat: number | null;
  int_stat: number | null;
  edu: number | null;
  soc: number | null;
  psi: number | null;
  chr: number | null;
  mor: number | null;
  lck: number | null;
  // health trackers (null = at full value)
  str_cur: number | null;
  dex_cur: number | null;
  end_cur: number | null;
  psi_cur: number | null;
  career: string | null;
  rank: string | null;
  homeworld: string | null;
  skills: Skill[];
  psionic_talents: PsionicTalent[];
  weapons: Weapon[];
  notes: string | null;
  created_at: string;
}

export interface RollLogEntry {
  id: string;
  character_name: string;
  check_label: string;
  d1: number;
  d2: number;
  char_dm: number;
  skill_level: number;
  total: number;
  difficulty: number;
  success: boolean;
  effect: number;
  created_at: string;
}
