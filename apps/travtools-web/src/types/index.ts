export interface Annotation {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface ShipSpecs {
  tech_level?: number | null;
  hull_config?: string | null;
  hull_rating?: number | null;
  m_drive?: number | null;
  j_drive?: number | null;
  power_plant?: number | null;
  fuel_tons?: number | null;
  bridge_tons?: number | null;
  cargo_tons?: number | null;
  staterooms?: number | null;
  low_berths?: number | null;
  armour_rating?: number | null;
  turrets?: number | null;
  crew_notes?: string | null;
  monthly_maintenance_cr?: number | null;
  purchase_price_mcr?: number | null;
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
  specs: ShipSpecs | null;
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
  quantity?: number | null;
  mass?: number | null;
  cost?: number | null;
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
  quantity?: number | null;
  mass?: number | null;
  cost?: number | null;
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
  personality_descriptors?: string | null;
  basic_description?: string | null;
  visual_age?: string | null;
  body_build?: string | null;
  attractiveness?: string | null;
  posture?: string | null;
  distinguishing_marks?: string | null;
  eye_colour?: string | null;
  hair_colour?: string | null;
  shape_of_face?: string | null;
  hair_style?: string | null;
  skin_tone?: string | null;
  facial_hair?: string | null;
  everyday_clothes?: string | null;
  combat_ready_gear?: string | null;
  jewellery_accessories?: string | null;
  general_description?: string | null;
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
  greatest_fears?: string | null;
  most_at_ease?: string | null;
  least_at_ease?: string | null;
  background_story?: string | null;
  birthday?: string | null;
  important_childhood_memory?: string | null;
  childhood_hero?: string | null;
  childhood_enemies?: string | null;
  personality_shaping_events?: string | null;
  ever_arrested?: string | null;
  served_in_military?: string | null;
  prominent_education?: string | null;
  teachers?: string | null;
  trained_skills?: string | null;
  training_where?: string | null;
  training_when?: string | null;
  training_why?: string | null;
  training_how?: string | null;
  upbringing_worldview?: string | null;
  social_class_growing_up?: string | null;
  current_social_class?: string | null;
  soft_spots?: string | null;
  enraged_when?: string | null;
  depressed_when?: string | null;
  biggest_accomplishment?: string | null;
  biggest_regret?: string | null;
  darkest_secrets?: string | null;
  lie_you_believe?: string | null;
  favourite_colours?: string | null;
  favourite_foods?: string | null;
  favourite_music?: string | null;
  favourite_joke?: string | null;
  spending_habits?: string | null;
  most_prized_possessions?: string | null;
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

export interface SessionJournalEntry {
  id: string;
  session_name: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export type RangeBand = 'adjacent' | 'close' | 'short' | 'medium' | 'long' | 'very-long' | 'distant';

export interface CombatCombatant {
  id: string; // character id or generated id for NPCs
  name: string;
  initiative: number;
  dexDM: number;
  minorActionUsed: boolean;
  significantActionUsed: boolean;
  isNPC: boolean;
  rangeBand: RangeBand;
  // NPC-only health — PCs are read live from the characters table
  npcHitsMax: number | null;
  npcHitsCur: number | null;
}

export interface CombatState {
  combatants: CombatCombatant[];
  round: number;
  activeIndex: number;
}
