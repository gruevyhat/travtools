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

export interface AttributeMods {
  str?: number;
  dex?: number;
  end_stat?: number;
  int_stat?: number;
  edu?: number;
  soc?: number;
  psi?: number;
  chr?: number;
  mor?: number;
  lck?: number;
}

export interface CharacterProfileDetails {
  species?: string | null;
  age?: string | null;
  gender?: string | null;
  height?: string | null;
  weight?: string | null;
  appearance?: string | null;
}

export interface HomeworldDetails {
  name?: string | null;
  sector?: string | null;
  subsector?: string | null;
  location?: string | null;
  uwp?: string | null;
  bases?: string | null;
  trade_codes?: string | null;
  travel_zone?: string | null;
  gas_giant?: string | null;
}

export interface LifepathTerm {
  term: number | null;
  career: string | null;
  assignment: string | null;
  survived: boolean | null;
  commissioned: boolean | null;
  advanced: boolean | null;
  rank: string | null;
  notes: string | null;
}

export interface ArmourItem {
  worn: boolean | null;
  name: string;
  protection: number | null;
  radiation: number | null;
  required_skill: string | null;
}

export interface CharacterAugment {
  name: string;
  notes: string | null;
  tech_level: number | null;
  cost: number | null;
}

export interface PersonalEquipmentItem {
  quantity: number | null;
  name: string;
  notes: string | null;
  tech_level: number | null;
  mass: number | null;
  cost: number | null;
}

export interface CharacterFinances {
  cash_on_hand?: number | null;
  yearly_pension?: number | null;
  monthly_salary?: number | null;
  ship_operating_costs?: number | null;
  monthly_debt_payments?: number | null;
  monthly_living_cost?: number | null;
  total_debts?: number | null;
}

export interface CharacterContact {
  name: string | null;
  gender_species: string | null;
  type: string | null;
  description: string | null;
  link: string | null;
  alive: boolean | null;
}

export interface CharacterBackground {
  short_term_goals?: string | null;
  long_term_goals?: string | null;
  good_traits?: string | null;
  bad_traits?: string | null;
  greatest_strength?: string | null;
  greatest_weakness?: string | null;
  mannerisms?: string | null;
  speech_quirks?: string | null;
  typical_mood?: string | null;
  sense_of_humour?: string | null;
  greatest_joys?: string | null;
  background_story?: string | null;
  soft_spots?: string | null;
  enraged_when?: string | null;
  depressed_when?: string | null;
  darkest_secrets?: string | null;
  favourite_joke?: string | null;
  hobbies?: string | null;
}

export interface Character {
  id: string;
  name: string;
  player: string | null;
  portrait_url: string | null;
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
  temp_mods: AttributeMods | null;
  profile_details: CharacterProfileDetails | null;
  homeworld_details: HomeworldDetails | null;
  lifepath: LifepathTerm[];
  armour: ArmourItem[];
  augments: CharacterAugment[];
  personal_equipment: PersonalEquipmentItem[];
  finances: CharacterFinances | null;
  contacts: CharacterContact[];
  background: CharacterBackground | null;
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
  bonus_dm: number | null;
  total: number;
  difficulty: number;
  success: boolean;
  effect: number;
  created_at: string;
}
