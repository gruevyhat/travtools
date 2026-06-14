// Ship construction tables — Traveller 2022 Core Rulebook pp.176–187

export const HULL_CONFIGS = [
  { id: 'standard',    name: 'Standard',            costMult: 1.0, hpMult: 1.0, notes: 'Fuel scoops cost MCr1 to install' },
  { id: 'streamlined', name: 'Streamlined',          costMult: 1.2, hpMult: 1.0, notes: 'Free fuel scoops; can enter atmosphere' },
  { id: 'dispersed',   name: 'Dispersed Structure',  costMult: 0.5, hpMult: 0.9, notes: 'Cannot mount armour; cannot enter atmosphere' },
] as const;
export type HullConfigId = typeof HULL_CONFIGS[number]['id'];

export const ARMOUR_TYPES = [
  { id: 'none',              name: 'None',              minTL: 0,  tonsPerPointPct: 0,    costPctPerPoint: 0, maxPoints: 0 },
  { id: 'crystaliron',       name: 'Crystaliron',       minTL: 10, tonsPerPointPct: 1.25, costPctPerPoint: 5, maxPoints: 13 },
  { id: 'bonded_superdense', name: 'Bonded Superdense', minTL: 14, tonsPerPointPct: 0.80, costPctPerPoint: 8, maxPoints: 999 },
] as const;
export type ArmourTypeId = typeof ARMOUR_TYPES[number]['id'];

// M-Drive: thrust rating → percent of hull tonnage consumed; cost MCr2/ton; min TL
export const M_DRIVE_TABLE: Record<number, { pctHull: number; minTL: number }> = {
  1: { pctHull: 1, minTL: 9 },
  2: { pctHull: 2, minTL: 10 },
  3: { pctHull: 3, minTL: 10 },
  4: { pctHull: 4, minTL: 11 },
  5: { pctHull: 5, minTL: 11 },
  6: { pctHull: 6, minTL: 12 },
  7: { pctHull: 7, minTL: 12 },
  8: { pctHull: 8, minTL: 13 },
  9: { pctHull: 9, minTL: 13 },
};
export const M_DRIVE_MCR_PER_TON = 2;

// J-Drive: jump rating → tons = 2.5% × rating × hull + 5, min 10t; cost MCr1.5/ton; min TL
export const J_DRIVE_TABLE: Record<number, { minTL: number }> = {
  1: { minTL: 9 },
  2: { minTL: 11 },
  3: { minTL: 12 },
  4: { minTL: 13 },
  5: { minTL: 14 },
  6: { minTL: 15 },
};
export const J_DRIVE_MCR_PER_TON = 1.5;

// Power Plants
export const POWER_PLANTS = [
  { id: 'tl8',  name: 'Fusion (TL8)',  minTL: 8,  powerPerTon: 10, costMCrPerTon: 0.5 },
  { id: 'tl12', name: 'Fusion (TL12)', minTL: 12, powerPerTon: 15, costMCrPerTon: 1.0 },
  { id: 'tl15', name: 'Fusion (TL15)', minTL: 15, powerPerTon: 20, costMCrPerTon: 2.0 },
] as const;
export type PPTypeId = typeof POWER_PLANTS[number]['id'];

// Bridge tonnage by hull size
export function bridgeTons(hullTons: number): number {
  if (hullTons <= 50)   return 3;
  if (hullTons <= 99)   return 6;
  if (hullTons <= 200)  return 10;
  if (hullTons <= 1000) return 20;
  if (hullTons <= 2000) return 40;
  return 60;
}
// Bridge cost: MCr0.5 per 100 tons of hull
export const BRIDGE_MCR_PER_100T = 0.5;

// Cockpit (only for hulls ≤50t)
export const COCKPIT = { tons: 1.5, costCr: 10_000 };
export const DUAL_COCKPIT = { tons: 2.5, costCr: 15_000 };

// Computers: model → { minTL, baseCostMCr }; /bis adds +50%
export const COMPUTERS = [
  { model: 5,  minTL: 7,  baseCostMCr: 0.030 },
  { model: 10, minTL: 9,  baseCostMCr: 0.160 },
  { model: 15, minTL: 11, baseCostMCr: 2.0   },
  { model: 20, minTL: 12, baseCostMCr: 5.0   },
  { model: 25, minTL: 13, baseCostMCr: 10.0  },
  { model: 30, minTL: 14, baseCostMCr: 20.0  },
  { model: 35, minTL: 15, baseCostMCr: 30.0  },
] as const;

// Sensors
export const SENSORS = [
  { id: 'basic',    name: 'Basic',    minTL: 8,  dm: -4, power: 0, tons: 0, costMCr: 0     },
  { id: 'civilian', name: 'Civilian', minTL: 9,  dm: -2, power: 1, tons: 1, costMCr: 3     },
  { id: 'military', name: 'Military', minTL: 10, dm:  0, power: 2, tons: 2, costMCr: 4.1   },
  { id: 'improved', name: 'Improved', minTL: 12, dm: +1, power: 4, tons: 3, costMCr: 4.3   },
  { id: 'advanced', name: 'Advanced', minTL: 15, dm: +2, power: 6, tons: 5, costMCr: 5.3   },
] as const;
export type SensorId = typeof SENSORS[number]['id'];

// Turret mounts
export const TURRET_MOUNTS = [
  { id: 'fixed',  name: 'Fixed Mount',   minTL: 7,  power: 0, tons: 0, costMCr: 0.1, slots: 1 },
  { id: 'single', name: 'Single Turret', minTL: 7,  power: 1, tons: 1, costMCr: 0.2, slots: 1 },
  { id: 'double', name: 'Double Turret', minTL: 8,  power: 1, tons: 1, costMCr: 0.5, slots: 2 },
  { id: 'triple', name: 'Triple Turret', minTL: 9,  power: 1, tons: 1, costMCr: 1.0, slots: 3 },
] as const;
export type TurretMountId = typeof TURRET_MOUNTS[number]['id'];

// Weapons (mounted in turrets)
export const WEAPONS = [
  { id: 'beam_laser',         name: 'Beam Laser',         minTL: 10, power: 4,  damage: '1D', range: 'Medium',    costMCr: 0.5,  slotsUsed: 1, extraTons: 0 },
  { id: 'pulse_laser',        name: 'Pulse Laser',        minTL: 9,  power: 4,  damage: '2D', range: 'Long',      costMCr: 1.0,  slotsUsed: 1, extraTons: 0 },
  { id: 'missile_rack',       name: 'Missile Rack',       minTL: 7,  power: 0,  damage: '4D', range: 'Short',     costMCr: 0.75, slotsUsed: 1, extraTons: 0 },
  { id: 'sandcaster',         name: 'Sandcaster',         minTL: 9,  power: 0,  damage: '—',  range: 'Close',     costMCr: 0.25, slotsUsed: 1, extraTons: 0 },
  { id: 'particle_barbette',  name: 'Particle Barbette',  minTL: 11, power: 15, damage: '4D', range: 'Very Long', costMCr: 8.0,  slotsUsed: 3, extraTons: 5 },
] as const;
export type WeaponId = typeof WEAPONS[number]['id'];

// Optional systems
export const OPTIONAL_SYSTEMS = [
  { id: 'fuel_scoop',       name: 'Fuel Scoop',            unit: 'fixed',  tonsPerUnit: 0, costMCrPerUnit: 1.0,  powerPerUnit: 0, minTL: 7,  notes: 'Free on streamlined hulls' },
  { id: 'fuel_processor',   name: 'Fuel Processors',       unit: 'ton',    tonsPerUnit: 1, costMCrPerUnit: 0.05, powerPerUnit: 1, minTL: 7,  notes: '1t processes 20t raw fuel/day' },
  { id: 'docking_space',    name: 'Docking Space',         unit: 'ton',    tonsPerUnit: 1, costMCrPerUnit: 0.25, powerPerUnit: 0, minTL: 7,  notes: 'ceil(craft tons × 1.1) = space needed' },
  { id: 'workshop',         name: 'Workshop',              unit: 'ton',    tonsPerUnit: 1, costMCrPerUnit: 0.15, powerPerUnit: 0, minTL: 7,  notes: '6t: 2 Travellers use Mechanic with DM+2' },
  { id: 'sensor_station',   name: 'Sensor Station',        unit: 'station',tonsPerUnit: 1, costMCrPerUnit: 0.5,  powerPerUnit: 1, minTL: 7,  notes: 'Each adds one sensor operator' },
  { id: 'medical_bay',      name: 'Medical Bay',           unit: 'bay',    tonsPerUnit: 4, costMCrPerUnit: 2.0,  powerPerUnit: 1, minTL: 7,  notes: '4t per bay, 1 medic per bay' },
  { id: 'probe_drones',     name: 'Probe Drones (per 5)', unit: 'set',    tonsPerUnit: 1, costMCrPerUnit: 0.5,  powerPerUnit: 0, minTL: 8,  notes: '1t and MCr0.5 per set of 5 drones' },
  { id: 'mining_drones',    name: 'Mining Drones (per 5)',unit: 'set',    tonsPerUnit: 10,costMCrPerUnit: 1.0,  powerPerUnit: 0, minTL: 8,  notes: '10t and MCr1 per set of 5 drones' },
  { id: 'repair_drones',    name: 'Repair Drones',         unit: 'ton',    tonsPerUnit: 1, costMCrPerUnit: 0.2,  powerPerUnit: 0, minTL: 9,  notes: '1% of hull tonnage minimum 1t' },
  { id: 'laboratory',       name: 'Laboratory',            unit: 'ton',    tonsPerUnit: 1, costMCrPerUnit: 0.25, powerPerUnit: 0, minTL: 7,  notes: '1 scientist per 4t with DM+2' },
  { id: 'library',          name: 'Library',               unit: 'fixed',  tonsPerUnit: 4, costMCrPerUnit: 4.0,  powerPerUnit: 0, minTL: 8,  notes: '4t, MCr4' },
  { id: 'multi_env_space',  name: 'Multi-Environment Space', unit: 'ton', tonsPerUnit: 1, costMCrPerUnit: 0.0625,powerPerUnit:0, minTL: 10, notes: 'MCr0.0625/ton for exotic environments' },
] as const;
export type OptionalSystemId = typeof OPTIONAL_SYSTEMS[number]['id'];

// Software
export const SOFTWARE = [
  { id: 'jump_control',   name: 'Jump Control/N',  costMCrPerRating: 0.1, notes: 'Rating must be ≥ jump drive rating' },
  { id: 'fire_control',   name: 'Fire Control/N',  costMCrPerRating: 2.0, notes: 'DM+N to attacks; N = 1–6' },
  { id: 'library',        name: 'Library',          costMCr: 0,            notes: 'Free' },
  { id: 'manoeuvre',      name: 'Manoeuvre',        costMCr: 0,            notes: 'Free' },
  { id: 'intellect',      name: 'Intellect',        costMCr: 1,  minTL: 12, notes: 'Autonomous operations' },
] as const;

// Stateroom types
export const STATEROOM_TYPES = [
  { id: 'standard', name: 'Standard Stateroom', tons: 4,  costMCr: 0.5,  power: 0 },
  { id: 'high',     name: 'High Stateroom',      tons: 6,  costMCr: 0.8,  power: 0 },
  { id: 'luxury',   name: 'Luxury Stateroom',    tons: 10, costMCr: 1.5,  power: 0 },
  { id: 'low_berth',name: 'Low Berth',            tons: 0.5,costMCr: 0.05, power: 0.1 },
] as const;

export const COMMON_AREA_MCR_PER_TON = 0.1;

// Crew minimums (one engineer per 35 tons of drive/PP; steward per 10 passengers)
// These are computed in shipBuilder.ts, not stored as tables.
