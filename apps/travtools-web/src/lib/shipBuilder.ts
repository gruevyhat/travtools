import {
  HULL_CONFIGS, ARMOUR_TYPES, M_DRIVE_TABLE, M_DRIVE_MCR_PER_TON,
  J_DRIVE_TABLE, J_DRIVE_MCR_PER_TON, POWER_PLANTS,
  bridgeTons, BRIDGE_MCR_PER_100T, COCKPIT, DUAL_COCKPIT,
  COMPUTERS, SENSORS, TURRET_MOUNTS, WEAPONS, OPTIONAL_SYSTEMS,
  COMMON_AREA_MCR_PER_TON, STATEROOM_TYPES,
} from '../data/shipComponents';
import type { ShipDesignState, ShipDesignSummary } from '../types';

export function computeShipSummary(d: ShipDesignState): ShipDesignSummary {
  const warnings: string[] = [];
  let usedTons = 0;
  let totalCostMCr = 0;
  let powerGenerated = 0;
  let powerUsed = 0;

  // ── Hull ───────────────────────────────────────────────────────────────
  const hullConfig = HULL_CONFIGS.find(c => c.id === d.hull_config) ?? HULL_CONFIGS[0];
  const hullBaseCostMCr = (d.tonnage * 50_000) / 1_000_000; // MCr = tons × Cr50000
  const hullCostMCr = hullBaseCostMCr * hullConfig.costMult;
  const hullHP = Math.floor(d.tonnage / 2.5);
  const hardpoints = d.tonnage < 100 ? 0 : Math.floor(d.tonnage / 100);
  const firmpoints = d.tonnage < 100 ? Math.floor(d.tonnage / 100) || 1 : 0;
  totalCostMCr += hullCostMCr;

  // Basic ship systems power: 20% of hull tonnage
  powerUsed += d.tonnage * 0.2;

  // Power requirement for basic life support included in basic systems above

  // ── Armour ─────────────────────────────────────────────────────────────
  if (d.armour_type !== 'none' && d.armour_points > 0) {
    if (d.hull_config === 'dispersed') {
      warnings.push('Dispersed structure hulls cannot mount armour.');
    } else {
      const armourDef = ARMOUR_TYPES.find(a => a.id === d.armour_type);
      if (armourDef && d.tech_level < armourDef.minTL) {
        warnings.push(`${armourDef.name} armour requires TL${armourDef.minTL}; hull is TL${d.tech_level}.`);
      }
      if (armourDef) {
        const armourTons = Math.ceil(d.tonnage * (armourDef.tonsPerPointPct / 100) * d.armour_points);
        const armourCostMCr = d.armour_points * (armourDef.costPctPerPoint / 100) * hullCostMCr;
        usedTons += armourTons;
        totalCostMCr += armourCostMCr;
      }
    }
  }

  // ── M-Drive ────────────────────────────────────────────────────────────
  let mDriveTons = 0;
  if (d.m_drive > 0) {
    const mData = M_DRIVE_TABLE[d.m_drive];
    if (mData) {
      if (d.tech_level < mData.minTL) {
        warnings.push(`M-Drive thrust-${d.m_drive} requires TL${mData.minTL}.`);
      }
      mDriveTons = Math.ceil(d.tonnage * mData.pctHull / 100);
      const mDriveCostMCr = mDriveTons * M_DRIVE_MCR_PER_TON;
      usedTons += mDriveTons;
      totalCostMCr += mDriveCostMCr;
      powerUsed += d.tonnage * 0.1 * d.m_drive; // 10% × hull × thrust
    }
  }

  // ── J-Drive ────────────────────────────────────────────────────────────
  let jDriveTons = 0;
  if (d.j_drive > 0) {
    const jData = J_DRIVE_TABLE[d.j_drive];
    if (jData) {
      if (d.tech_level < jData.minTL) {
        warnings.push(`J-Drive jump-${d.j_drive} requires TL${jData.minTL}.`);
      }
      jDriveTons = Math.max(10, Math.ceil(d.tonnage * 0.025 * d.j_drive + 5));
      const jDriveCostMCr = jDriveTons * J_DRIVE_MCR_PER_TON;
      usedTons += jDriveTons;
      totalCostMCr += jDriveCostMCr;
      powerUsed += d.tonnage * 0.1 * d.j_drive; // 10% × hull × jump rating
    }
  }

  // ── Power Plant ────────────────────────────────────────────────────────
  const ppDef = POWER_PLANTS.find(p => p.id === d.pp_type) ?? POWER_PLANTS[1];
  let ppTons = 0;
  if (d.pp_power > 0) {
    if (d.tech_level < ppDef.minTL) {
      warnings.push(`${ppDef.name} requires TL${ppDef.minTL}.`);
    }
    ppTons = Math.ceil(d.pp_power / ppDef.powerPerTon);
    const ppCostMCr = ppTons * ppDef.costMCrPerTon;
    usedTons += ppTons;
    totalCostMCr += ppCostMCr;
    powerGenerated += d.pp_power;
  }

  // ── Fuel ──────────────────────────────────────────────────────────────
  const jumpFuelTons = d.j_drive > 0 ? d.tonnage * 0.1 * d.j_drive : 0;
  // PP fuel: max(1, ceil(ppTons × 10%)) per 4-week period
  const ppFuelPerPeriod = ppTons > 0 ? Math.max(1, Math.ceil(ppTons * 0.1)) : 0;
  const ppFuelTons = ppFuelPerPeriod * Math.ceil(d.pp_fuel_weeks / 4);
  usedTons += jumpFuelTons + ppFuelTons;

  // ── Bridge ─────────────────────────────────────────────────────────────
  let bridgeCostMCr = 0;
  if (d.bridge_type === 'cockpit') {
    usedTons += COCKPIT.tons;
    bridgeCostMCr = COCKPIT.costCr / 1_000_000;
  } else if (d.bridge_type === 'dual_cockpit') {
    if (d.tonnage > 50) warnings.push('Cockpits are only available on hulls of 50 tons or less.');
    usedTons += DUAL_COCKPIT.tons;
    bridgeCostMCr = DUAL_COCKPIT.costCr / 1_000_000;
  } else {
    const bt = bridgeTons(d.tonnage);
    usedTons += bt;
    bridgeCostMCr = (d.tonnage / 100) * BRIDGE_MCR_PER_100T;
  }
  totalCostMCr += bridgeCostMCr;

  // ── Computer ───────────────────────────────────────────────────────────
  if (d.computer_model > 0) {
    const comp = COMPUTERS.find(c => c.model === d.computer_model);
    if (comp) {
      if (d.tech_level < comp.minTL) {
        warnings.push(`Computer/model ${d.computer_model} requires TL${comp.minTL}.`);
      }
      totalCostMCr += d.computer_bis ? comp.baseCostMCr * 1.5 : comp.baseCostMCr;
    }
  }

  // ── Sensors ────────────────────────────────────────────────────────────
  const sensorDef = SENSORS.find(s => s.id === d.sensors);
  if (sensorDef) {
    if (d.tech_level < sensorDef.minTL) {
      warnings.push(`${sensorDef.name} sensors require TL${sensorDef.minTL}.`);
    }
    usedTons += sensorDef.tons;
    totalCostMCr += sensorDef.costMCr;
    powerUsed += sensorDef.power;
  }

  // ── Weapons / Mounts ───────────────────────────────────────────────────
  const totalHardpoints = hardpoints + firmpoints;
  if (d.mounts.length > totalHardpoints) {
    warnings.push(`Design has ${d.mounts.length} mounts but hull allows ${totalHardpoints} hardpoints/firmpoints.`);
  }
  for (const mount of d.mounts) {
    const mountDef = TURRET_MOUNTS.find(t => t.id === mount.mount_type);
    if (!mountDef) continue;
    usedTons += mountDef.tons;
    totalCostMCr += mountDef.costMCr;
    powerUsed += mountDef.power;

    let slotsUsed = 0;
    for (const weapId of mount.weapons) {
      const weap = WEAPONS.find(w => w.id === weapId);
      if (!weap) continue;
      slotsUsed += weap.slotsUsed;
      totalCostMCr += weap.costMCr;
      powerUsed += weap.power;
      usedTons += weap.extraTons; // barbettes etc.
    }
    if (slotsUsed > mountDef.slots) {
      warnings.push(`A ${mountDef.name} has ${slotsUsed} weapon slots used but only supports ${mountDef.slots}.`);
    }
  }

  // ── Optional Systems ───────────────────────────────────────────────────
  for (const entry of d.optional_systems) {
    const sysDef = OPTIONAL_SYSTEMS.find(s => s.id === entry.type);
    if (!sysDef) continue;
    // Fuel scoop: free on streamlined; skip cost but not tons
    if (entry.type === 'fuel_scoop' && d.hull_config === 'streamlined') {
      // free, no tons
      continue;
    }
    const qty = entry.quantity;
    usedTons += sysDef.tonsPerUnit * qty;
    totalCostMCr += sysDef.costMCrPerUnit * qty;
    powerUsed += sysDef.powerPerUnit * qty;
  }

  // ── Staterooms ────────────────────────────────────────────────────────
  usedTons   += d.staterooms        * STATEROOM_TYPES[0].tons;
  totalCostMCr += d.staterooms        * STATEROOM_TYPES[0].costMCr;
  usedTons   += d.high_staterooms   * STATEROOM_TYPES[1].tons;
  totalCostMCr += d.high_staterooms   * STATEROOM_TYPES[1].costMCr;
  usedTons   += d.luxury_staterooms * STATEROOM_TYPES[2].tons;
  totalCostMCr += d.luxury_staterooms * STATEROOM_TYPES[2].costMCr;
  usedTons   += d.low_berths        * STATEROOM_TYPES[3].tons;
  totalCostMCr += d.low_berths        * STATEROOM_TYPES[3].costMCr;
  // Low berth power: 1P per 10 berths
  powerUsed += Math.ceil(d.low_berths / 10);

  // ── Common Areas ───────────────────────────────────────────────────────
  usedTons   += d.common_area_tons;
  totalCostMCr += d.common_area_tons * COMMON_AREA_MCR_PER_TON;

  // ── Software ──────────────────────────────────────────────────────────
  if (d.software_jump_control > 0) totalCostMCr += d.software_jump_control * 0.1;
  if (d.software_fire_control > 0) totalCostMCr += d.software_fire_control * 2.0;
  if (d.software_intellect)        totalCostMCr += 1.0;

  // ── Cargo ─────────────────────────────────────────────────────────────
  const cargoTons = Math.max(0, d.tonnage - usedTons);

  // ── Power balance ─────────────────────────────────────────────────────
  const powerBalance = powerGenerated - powerUsed;
  if (powerBalance < 0) {
    warnings.push(`Power deficit of ${Math.abs(powerBalance).toFixed(0)} — increase power plant output or remove systems.`);
  }

  // ── Maintenance & Construction ─────────────────────────────────────────
  const maintenanceCrPerMonth = Math.round((totalCostMCr * 1_000_000) / 12_000);
  const constructionDays = Math.ceil(totalCostMCr);

  // ── Crew (minimum) ─────────────────────────────────────────────────────
  const crewPilot = 1;
  const crewAstrogator = d.j_drive > 0 ? 1 : 0;
  // Engineers: 1 per 35 tons of drives + PP; minimum 1 if any drive or PP exists
  const engineTons = mDriveTons + jDriveTons + ppTons;
  const crewEngineer = engineTons > 0 ? Math.max(1, Math.floor(engineTons / 35)) : 0;
  // Medic: 1 per 100 passengers/crew (rounded up from 1)
  const totalBerths = d.staterooms + d.high_staterooms + d.luxury_staterooms;
  const crewMedic = totalBerths > 0 ? 1 : 0;
  // Steward: 1 per 10 non-crew passengers (simplified: 1 if any paying passengers)
  const crewSteward = totalBerths > 0 ? Math.ceil(totalBerths / 10) : 0;
  // Gunners: 1 per turret/barbette with weapons
  const crewGunner = d.mounts.filter(m => m.weapons.length > 0).length;

  // TL warning
  if (d.j_drive > 0 && d.software_jump_control < d.j_drive) {
    warnings.push(`Jump Control software rating (${d.software_jump_control}) is less than J-Drive rating (${d.j_drive}).`);
  }

  return {
    totalTons: d.tonnage,
    usedTons,
    cargoTons,
    powerGenerated,
    powerUsed,
    powerBalance,
    totalCostMCr,
    maintenanceCrPerMonth,
    constructionDays,
    hullHP,
    hardpoints,
    firmpoints,
    jumpFuelTons,
    ppFuelTons,
    crewPilot,
    crewAstrogator,
    crewEngineer,
    crewMedic,
    crewSteward,
    crewGunner,
    warnings,
  };
}

export function defaultDesign(): ShipDesignState {
  return {
    name: 'New Design',
    tech_level: 12,
    tonnage: 100,
    hull_config: 'standard',
    armour_type: 'none',
    armour_points: 0,
    m_drive: 1,
    j_drive: 1,
    pp_type: 'tl12',
    pp_power: 40,
    pp_fuel_weeks: 4,
    bridge_type: 'standard',
    computer_model: 5,
    computer_bis: false,
    sensors: 'civilian',
    mounts: [],
    optional_systems: [],
    staterooms: 0,
    high_staterooms: 0,
    luxury_staterooms: 0,
    low_berths: 0,
    common_area_tons: 0,
    software_jump_control: 1,
    software_fire_control: 0,
    software_intellect: false,
    notes: '',
  };
}
