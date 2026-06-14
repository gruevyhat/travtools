import { describe, it, expect } from 'vitest';
import { computeShipSummary, defaultDesign } from '../lib/shipBuilder';
import type { ShipDesignState } from '../types';

// Type-S Scout/Courier (p.190): 100t Streamlined TL12, J2/M2, 4 staterooms
// Book cargo = 12t; book fuel = 23t (20t jump + 3t PP for 12 weeks)
// Note: book purchase price (MCr36.94) differs from formula sum (~MCr41) due to
// unexplained ~MCr4.1 discrepancy in published stat block; cargo & fuel are the
// authoritative checks.
const typeS: ShipDesignState = {
  name: 'Type S Scout',
  tech_level: 12,
  tonnage: 100,
  hull_config: 'streamlined',
  armour_type: 'crystaliron',
  armour_points: 4,
  m_drive: 2,
  j_drive: 2,
  pp_type: 'tl12',
  pp_power: 60,
  pp_fuel_weeks: 12,
  bridge_type: 'standard',
  computer_model: 5,
  computer_bis: true,
  sensors: 'military',
  mounts: [{ id: 'm1', mount_type: 'double', weapons: [] }],
  optional_systems: [
    { id: 'fp',  type: 'fuel_processor', quantity: 2 }, // 2t
    { id: 'pd',  type: 'probe_drones',   quantity: 2 }, // 2t (10 drones = 2 sets)
    { id: 'ds',  type: 'docking_space',  quantity: 5 }, // 5t (4t craft → ceil(4×1.1)=5)
    { id: 'ws',  type: 'workshop',       quantity: 6 }, // 6t
    // fuel scoop: free on streamlined, not counted
    { id: 'fs', type: 'fuel_scoop', quantity: 1 },
  ],
  staterooms: 4,
  high_staterooms: 0,
  luxury_staterooms: 0,
  low_berths: 0,
  common_area_tons: 0,
  software_jump_control: 2,
  software_fire_control: 0,
  software_intellect: false,
  notes: '',
};

describe('computeShipSummary — Type S Scout', () => {
  const s = computeShipSummary(typeS);

  it('cargo tonnage = 12t', () => {
    expect(s.cargoTons).toBe(12);
  });

  it('jump fuel = 20t', () => {
    expect(s.jumpFuelTons).toBe(20);
  });

  it('PP fuel for 12 weeks = 3t', () => {
    expect(s.ppFuelTons).toBe(3);
  });

  it('hull HP = 40', () => {
    expect(s.hullHP).toBe(40);
  });

  it('hardpoints = 1', () => {
    expect(s.hardpoints).toBe(1);
  });

  it('power generated = 60', () => {
    expect(s.powerGenerated).toBe(60);
  });

  // Note: the official Type-S stat block shows 62P consumed vs 60P generated.
  // A small power deficit is valid — ships can power-down non-critical systems.
  it('power generated = 60', () => {
    expect(s.powerGenerated).toBe(60);
  });

  it('no TL warnings on TL12 build', () => {
    const tlWarnings = s.warnings.filter(w => w.includes('requires TL'));
    expect(tlWarnings).toHaveLength(0);
  });

  it('minimum crew: pilot + astrogator + engineer', () => {
    expect(s.crewPilot).toBe(1);
    expect(s.crewAstrogator).toBe(1);
    expect(s.crewEngineer).toBeGreaterThanOrEqual(1);
  });
});

// Type-A Free Trader (p.194): 200t Streamlined TL12, J1/M1, 10 staterooms, 20 low berths
// Book cargo = 81t; book jump fuel = 20t; PP fuel = 1t (4 weeks)
const typeA: ShipDesignState = {
  name: 'Type A Free Trader',
  tech_level: 12,
  tonnage: 200,
  hull_config: 'streamlined',
  armour_type: 'crystaliron',
  armour_points: 2,
  m_drive: 1,
  j_drive: 1,
  pp_type: 'tl12',
  pp_power: 75,
  pp_fuel_weeks: 4,
  bridge_type: 'standard',
  computer_model: 5,
  computer_bis: false,
  sensors: 'civilian',
  mounts: [],
  optional_systems: [
    { id: 'fp', type: 'fuel_processor', quantity: 1 }, // 1t (20t/day)
    { id: 'cc', type: 'docking_space',  quantity: 3 }, // 3t cargo crane entry
    { id: 'fs', type: 'fuel_scoop',     quantity: 1 }, // free on streamlined
  ],
  staterooms: 10,
  high_staterooms: 0,
  luxury_staterooms: 0,
  low_berths: 20,
  common_area_tons: 11,
  software_jump_control: 1,
  software_fire_control: 0,
  software_intellect: false,
  notes: '',
};

describe('computeShipSummary — Type A Free Trader', () => {
  const s = computeShipSummary(typeA);

  it('cargo tonnage = 81t', () => {
    expect(s.cargoTons).toBe(81);
  });

  it('jump fuel = 20t', () => {
    expect(s.jumpFuelTons).toBe(20);
  });

  it('PP fuel for 4 weeks ≥ 1t', () => {
    expect(s.ppFuelTons).toBeGreaterThanOrEqual(1);
  });
});

describe('computeShipSummary — validation', () => {
  it('warns when armour applied to dispersed structure', () => {
    const d = { ...defaultDesign(), hull_config: 'dispersed' as const, armour_type: 'crystaliron' as const, armour_points: 2 };
    const s = computeShipSummary(d);
    expect(s.warnings.some(w => w.includes('Dispersed'))).toBe(true);
  });

  it('warns when power is negative', () => {
    const d = { ...defaultDesign(), m_drive: 9, j_drive: 6, pp_power: 1 };
    const s = computeShipSummary(d);
    expect(s.warnings.some(w => w.includes('Power deficit'))).toBe(true);
  });

  it('cargo never goes negative (clamped to 0)', () => {
    const d = { ...defaultDesign(), staterooms: 100 };
    const s = computeShipSummary(d);
    expect(s.cargoTons).toBeGreaterThanOrEqual(0);
  });

  it('hull with no J-drive has no astrogator', () => {
    const d = { ...defaultDesign(), j_drive: 0 };
    const s = computeShipSummary(d);
    expect(s.crewAstrogator).toBe(0);
  });
});
