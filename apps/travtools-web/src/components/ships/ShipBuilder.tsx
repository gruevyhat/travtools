import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Save, AlertTriangle, ChevronLeft, ChevronRight,
  Download, Upload, CheckCircle2, X, Anchor, Settings,
} from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { computeShipSummary, defaultDesign } from '../../lib/shipBuilder';
import {
  HULL_CONFIGS, ARMOUR_TYPES, POWER_PLANTS, COMPUTERS, SENSORS,
  TURRET_MOUNTS, WEAPONS, OPTIONAL_SYSTEMS, M_DRIVE_TABLE, J_DRIVE_TABLE,
  SOFTWARE, bridgeTons,
} from '../../data/shipComponents';
import { SHIP_PRESETS, type ShipPreset } from '../../data/shipPresets';
import type { ShipDesign, ShipDesignState, ShipDesignSummary, MountConfig, ShipSpecs } from '../../types';
import NumberStepper from '../shared/NumberStepper';
import { CANONICAL_SHIPS, type CanonicalShip } from './canonicalShips';

// ── utilities ─────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateStatBlock(d: ShipDesignState, s: ShipDesignSummary): string {
  const pad = (str: string, n: number) => str.padEnd(n);
  const rpad = (str: string, n: number) => str.padStart(n);
  const line = '═'.repeat(58);
  const div = '─'.repeat(58);

  const crewParts: string[] = [];
  if (s.crewPilot)      crewParts.push(`Pilot×${s.crewPilot}`);
  if (s.crewAstrogator) crewParts.push(`Astrogator×${s.crewAstrogator}`);
  if (s.crewEngineer)   crewParts.push(`Engineer×${s.crewEngineer}`);
  if (s.crewMedic)      crewParts.push(`Medic×${s.crewMedic}`);
  if (s.crewSteward)    crewParts.push(`Steward×${s.crewSteward}`);
  if (s.crewGunner)     crewParts.push(`Gunner×${s.crewGunner}`);

  const configLabel = HULL_CONFIGS.find(c => c.id === d.hull_config)?.name ?? d.hull_config;
  const ppLabel = POWER_PLANTS.find(p => p.id === d.pp_type)?.name ?? d.pp_type;
  const sensorLabel = SENSORS.find(s2 => s2.id === d.sensors)?.name ?? d.sensors;

  const rows: string[] = [];
  const row = (label: string, desc: string, tons: string, cost: string) =>
    `${pad(label, 12)} ${pad(desc, 26)} ${rpad(tons, 6)}  ${rpad(cost, 8)}`;

  rows.push(row('', '', 'TONS', 'MCr'));
  rows.push(row('Hull', `${d.tonnage}t ${configLabel}`, '—', (d.tonnage * 0.05 * (HULL_CONFIGS.find(c=>c.id===d.hull_config)?.costMult??1)).toFixed(3)));
  if (d.armour_type !== 'none' && d.armour_points > 0) {
    const armour = ARMOUR_TYPES.find(a => a.id === d.armour_type);
    const aTons = Math.ceil(d.tonnage * (armour?.tonsPerPointPct ?? 0) / 100 * d.armour_points);
    const aCost = (d.tonnage * (armour?.costPctPerPoint ?? 0) / 100 * d.armour_points).toFixed(3);
    rows.push(row('Armour', `${armour?.name ?? ''} ×${d.armour_points}pts`, String(aTons), aCost));
  }
  if (d.m_drive > 0) rows.push(row('M-Drive', `Thrust-${d.m_drive}`, String(Math.ceil(d.tonnage * (M_DRIVE_TABLE[d.m_drive]?.pctHull ?? 0) / 100)), '—'));
  if (d.j_drive > 0) rows.push(row('J-Drive', `Jump-${d.j_drive}`, String(Math.max(10, Math.ceil(d.tonnage * 0.025 * d.j_drive + 5))), '—'));
  rows.push(row('Power Plant', `${ppLabel}/${d.pp_power}P`, String(Math.ceil(d.pp_power / (POWER_PLANTS.find(p=>p.id===d.pp_type)?.powerPerTon ?? 15))), '—'));
  const fuelTons = s.jumpFuelTons + s.ppFuelTons;
  rows.push(row('Fuel Tanks', d.j_drive > 0 ? `J-${d.j_drive}, ${d.pp_fuel_weeks}wk` : `${d.pp_fuel_weeks}wk ops`, String(fuelTons), '—'));
  rows.push(row('Bridge', '', '—', '—'));
  rows.push(row('Computer', `Model ${d.computer_model}${d.computer_bis ? '/bis' : ''}`, '—', '—'));
  rows.push(row('Sensors', sensorLabel, String(SENSORS.find(s2=>s2.id===d.sensors)?.tons ?? 0), '—'));
  d.mounts.forEach(m => {
    const mt = TURRET_MOUNTS.find(t => t.id === m.mount_type);
    const wNames = m.weapons.map(wid => WEAPONS.find(w=>w.id===wid)?.name ?? wid).join(', ');
    rows.push(row('Weapons', `${mt?.name ?? m.mount_type}${wNames ? ': ' + wNames : ''}`, String(mt?.tons ?? 0), String(mt?.costMCr ?? 0)));
  });
  d.optional_systems.forEach(sys => {
    const opt = OPTIONAL_SYSTEMS.find(o => o.id === sys.type);
    if (!opt) return;
    rows.push(row('Systems', `${opt.name} ×${sys.quantity}`, String(opt.tonsPerUnit * sys.quantity), (opt.costMCrPerUnit * sys.quantity).toFixed(3)));
  });
  if (d.staterooms > 0) rows.push(row('Staterooms', `Standard ×${d.staterooms}`, String(d.staterooms * 4), (d.staterooms * 0.5).toFixed(3)));
  if (d.high_staterooms > 0) rows.push(row('', `High ×${d.high_staterooms}`, String(d.high_staterooms * 6), (d.high_staterooms * 0.8).toFixed(3)));
  if (d.luxury_staterooms > 0) rows.push(row('', `Luxury ×${d.luxury_staterooms}`, String(d.luxury_staterooms * 10), (d.luxury_staterooms * 1.5).toFixed(3)));
  if (d.low_berths > 0) rows.push(row('', `Low Berths ×${d.low_berths}`, String(Math.ceil(d.low_berths * 0.5)), (d.low_berths * 0.05).toFixed(3)));
  if (d.common_area_tons > 0) rows.push(row('', `Common Area`, String(d.common_area_tons), (d.common_area_tons * 0.1).toFixed(3)));
  rows.push(row('Cargo', '', String(Math.max(0, s.cargoTons)), '—'));

  const softwareParts: string[] = [];
  if (d.software_jump_control > 0) softwareParts.push(`Jump Control/${d.software_jump_control}`);
  if (d.software_fire_control > 0) softwareParts.push(`Fire Control/${d.software_fire_control}`);
  if (d.software_intellect) softwareParts.push('Intellect');

  return [
    line,
    `SHIP: ${d.name.toUpperCase()}`,
    `TL: ${d.tech_level}  HULL: ${d.tonnage}t ${configLabel}  HP: ${s.hullHP}`,
    line,
    ...rows,
    div,
    softwareParts.length ? `Software  ${softwareParts.join(', ')}` : '',
    line,
    `PURCHASE:    MCr ${s.totalCostMCr.toFixed(4)}`,
    `MAINTENANCE: Cr ${Math.round(s.maintenanceCrPerMonth).toLocaleString()}/month`,
    `POWER:       ${s.powerGenerated} generated | ${s.powerUsed} used`,
    `CREW:        ${crewParts.join(', ') || 'None required'}  (min. ${s.crewPilot + s.crewAstrogator + s.crewEngineer + s.crewMedic + s.crewSteward + s.crewGunner})`,
    `HARDPOINTS:  ${s.hardpoints}  |  FIRMPOINTS: ${s.firmpoints}`,
    s.warnings.length ? div : '',
    ...s.warnings.map(w => `⚠ ${w}`),
    line,
  ].filter(l => l !== '').join('\n');
}

function designToFleetSpecs(d: ShipDesignState, s: ShipDesignSummary) {
  const crewParts: string[] = [];
  if (s.crewPilot)      crewParts.push(`Pilot×${s.crewPilot}`);
  if (s.crewAstrogator) crewParts.push(`Astrogator×${s.crewAstrogator}`);
  if (s.crewEngineer)   crewParts.push(`Engineer×${s.crewEngineer}`);
  if (s.crewMedic)      crewParts.push(`Medic×${s.crewMedic}`);
  if (s.crewSteward)    crewParts.push(`Steward×${s.crewSteward}`);
  if (s.crewGunner)     crewParts.push(`Gunner×${s.crewGunner}`);
  const systems = d.optional_systems.map(system => {
    const def = OPTIONAL_SYSTEMS.find(option => option.id === system.type);
    return {
      id: system.id,
      name: def?.name ?? system.type,
      quantity: system.quantity,
      notes: def?.notes ?? null,
    };
  });
  const software: NonNullable<ShipSpecs['software']> = [];
  if (d.software_jump_control > 0) {
    software.push({
      id: 'jump-control',
      name: 'Jump Control',
      rating: d.software_jump_control,
      notes: SOFTWARE.find(program => program.id === 'jump_control')?.notes ?? null,
    });
  }
  if (d.software_fire_control > 0) {
    software.push({
      id: 'fire-control',
      name: 'Fire Control',
      rating: d.software_fire_control,
      notes: SOFTWARE.find(program => program.id === 'fire_control')?.notes ?? null,
    });
  }
  if (d.software_intellect) {
    software.push({
      id: 'intellect',
      name: 'Intellect',
      rating: null,
      notes: SOFTWARE.find(program => program.id === 'intellect')?.notes ?? null,
    });
  }
  return {
    tech_level: d.tech_level,
    hull_config: HULL_CONFIGS.find(c => c.id === d.hull_config)?.name ?? d.hull_config,
    hull_rating: s.hullHP,
    m_drive: d.m_drive || null,
    j_drive: d.j_drive || null,
    power_plant: d.pp_power,
    fuel_tons: s.jumpFuelTons + s.ppFuelTons,
    bridge_tons: bridgeTons(d.tonnage),
    cargo_tons: Math.max(0, s.cargoTons),
    staterooms: (d.staterooms + d.high_staterooms + d.luxury_staterooms) || null,
    low_berths: d.low_berths || null,
    armour_rating: d.armour_type !== 'none' ? d.armour_points : null,
    turrets: d.mounts.length || null,
    crew_notes: crewParts.join(', ') || null,
    monthly_maintenance_cr: Math.round(s.maintenanceCrPerMonth),
    purchase_price_mcr: parseFloat(s.totalCostMCr.toFixed(4)),
    systems,
    software,
  };
}

const PRESET_CANONICAL_IDS: Record<string, string> = {
  type_s: 'type-s',
  type_a: 'type-a',
  type_a2: 'type-a2',
  seeker: 'type-j',
};

function presetForCanonical(canonicalId: string) {
  return SHIP_PRESETS.find(preset => PRESET_CANONICAL_IDS[preset.id] === canonicalId) ?? null;
}

function cloneDesignState(design: ShipDesignState): ShipDesignState {
  return {
    ...design,
    mounts: design.mounts.map(mount => ({ ...mount, weapons: [...mount.weapons] })),
    optional_systems: design.optional_systems.map(system => ({ ...system })),
  };
}

function presetToDesign(preset: ShipPreset): ShipDesign {
  const design = cloneDesignState(preset.design);
  return {
    id: `preset:${preset.id}`,
    name: preset.name,
    design,
    summary: computeShipSummary(design),
    diagram_url: null,
    created_at: '',
    updated_at: '',
  };
}

type ScalarShipSpecKey = Exclude<keyof ShipSpecs, 'systems' | 'software'>;

const CANONICAL_SPEC_FIELDS: { key: ScalarShipSpecKey; label: string; format?: (value: number | string) => string }[] = [
  { key: 'tech_level', label: 'Tech Level' },
  { key: 'hull_config', label: 'Hull Config' },
  { key: 'hull_rating', label: 'Hull Rating' },
  { key: 'm_drive', label: 'M-Drive' },
  { key: 'j_drive', label: 'J-Drive' },
  { key: 'power_plant', label: 'Power Plant' },
  { key: 'fuel_tons', label: 'Fuel' },
  { key: 'bridge_tons', label: 'Bridge' },
  { key: 'cargo_tons', label: 'Cargo' },
  { key: 'staterooms', label: 'Staterooms' },
  { key: 'low_berths', label: 'Low Berths' },
  { key: 'armour_rating', label: 'Armour' },
  { key: 'turrets', label: 'Turrets' },
  { key: 'monthly_maintenance_cr', label: 'Maintenance', format: value => `Cr ${Number(value).toLocaleString()}/mo` },
  { key: 'purchase_price_mcr', label: 'Purchase', format: value => `MCr ${Number(value).toFixed(2)}` },
];

// ── common inputs ─────────────────────────────────────────────────────────────

function NumInput({ value, onChange, min = 0, max, step = 1, className = '' }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; className?: string;
}) {
  return (
    <NumberStepper
      ariaLabel="ship numeric value"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={raw => {
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
      className={`w-full ${className}`}
      inputClassName="input-base w-full"
    />
  );
}

function Stepper({ value, onChange, min = 0, max, label }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-body/60 w-32 flex-shrink-0">{label}</span>}
      <NumberStepper
        ariaLabel={label ?? 'ship stepper value'}
        value={value}
        min={min}
        max={max}
        onChange={raw => {
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n));
        }}
        className="w-24"
        inputClassName="input-base py-0.5 text-sm font-mono text-bright"
        buttonClassName="text-sm"
      />
    </div>
  );
}

// ── stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ s, tonnage }: { s: ShipDesignSummary; tonnage: number }) {
  const tonsOk = s.cargoTons >= 0;
  const powerOk = s.powerBalance >= 0;
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-2 bg-panel/80 border-b border-steel/50 text-xs font-mono">
      <span className={tonsOk ? 'text-body' : 'text-alert'}>
        TONS <span className={tonsOk ? 'text-cyan-trav' : 'text-alert'}>{s.usedTons}/{tonnage}</span>
        {' '}CARGO <span className={tonsOk ? 'text-safe' : 'text-alert'}>{Math.max(0, s.cargoTons)}t</span>
      </span>
      <span className={powerOk ? 'text-body' : 'text-amber'}>
        POWER <span className={powerOk ? 'text-cyan-trav' : 'text-amber'}>{s.powerGenerated}/{s.powerUsed}</span>
      </span>
      <span className="text-body">
        COST <span className="text-cyan-trav">MCr {s.totalCostMCr.toFixed(2)}</span>
      </span>
      <span className="text-body">
        HP <span className="text-cyan-trav">{s.hullHP}</span>
        {' '}HARDPTS <span className="text-cyan-trav">{s.hardpoints}</span>
      </span>
      <span className="text-body">
        CREW <span className="text-cyan-trav">
          {s.crewPilot + s.crewAstrogator + s.crewEngineer + s.crewMedic + s.crewSteward + s.crewGunner}
        </span>
      </span>
    </div>
  );
}

// ── step progress ─────────────────────────────────────────────────────────────

const STEPS = [
  'FOUNDATION', 'PROTECTION', 'DRIVES', 'POWER',
  'BRIDGE', 'WEAPONS', 'SYSTEMS', 'QUARTERS', 'REVIEW',
];

function StepProgress({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-void/60 border-b border-steel/30 overflow-x-auto">
      {STEPS.map((label, i) => (
        <button key={i} type="button" onClick={() => onJump(i)}
          className={`flex items-center gap-1 text-[10px] tracking-widest font-mono whitespace-nowrap transition-colors ${
            i === step ? 'text-amber' : i < step ? 'text-safe/70 hover:text-safe' : 'text-body/40 hover:text-body/70'
          }`}
        >
          <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] flex-shrink-0 ${
            i === step ? 'border-amber text-amber' : i < step ? 'border-safe/60 text-safe/60' : 'border-steel/40'
          }`}>{i + 1}</span>
          <span className="hidden sm:inline">{label}</span>
          {i < STEPS.length - 1 && <span className="text-steel/30 mx-0.5">›</span>}
        </button>
      ))}
    </div>
  );
}

// ── hint box ─────────────────────────────────────────────────────────────────

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-steel/40 rounded bg-panel/40 p-3 text-xs text-body/70 leading-5">
      {children}
    </div>
  );
}

// ── selection card ────────────────────────────────────────────────────────────

function ChoiceCard({ label, desc, active, onClick }: {
  label: string; desc?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left p-3 border rounded transition-colors ${
        active ? 'border-amber bg-amber/10 text-amber' : 'border-steel/50 hover:border-steel text-body hover:text-bright'
      }`}
    >
      <div className="text-xs font-mono tracking-wider font-bold">{label}</div>
      {desc && <div className="text-[10px] mt-0.5 opacity-70">{desc}</div>}
    </button>
  );
}

// ── stat block display ─────────────────────────────────────────────────────────

function StatBlockDisplay({ d, s }: { d: ShipDesignState; s: ShipDesignSummary }) {
  return (
    <pre className="text-[10px] font-mono leading-[1.4] text-body/80 whitespace-pre-wrap break-all">
      {generateStatBlock(d, s)}
    </pre>
  );
}

function formatCr(value: number) {
  return `Cr ${Math.round(value).toLocaleString()}`;
}

function formatMCr(value: number) {
  return `MCr ${value.toFixed(2)}`;
}

function crewTotal(s: ShipDesignSummary) {
  return s.crewPilot + s.crewAstrogator + s.crewEngineer + s.crewMedic + s.crewSteward + s.crewGunner;
}

function Readout({ label, value, sub, tone = 'cyan' }: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'cyan' | 'amber' | 'safe' | 'alert';
}) {
  const toneClass = {
    cyan: 'text-cyan-trav',
    amber: 'text-amber',
    safe: 'text-safe',
    alert: 'text-alert',
  }[tone];

  return (
    <div className="border border-steel/50 bg-void/70 px-3 py-2 min-h-20 flex flex-col justify-between">
      <div className="text-[10px] text-body/50 tracking-widest font-mono">{label}</div>
      <div className={`text-lg font-mono font-bold ${toneClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-body/45 font-mono">{sub}</div>}
    </div>
  );
}

function crewManifest(s: ShipDesignSummary) {
  return [
    ['Pilot', s.crewPilot],
    ['Astrogator', s.crewAstrogator],
    ['Engineer', s.crewEngineer],
    ['Medic', s.crewMedic],
    ['Steward', s.crewSteward],
    ['Gunner', s.crewGunner],
  ].filter(([, count]) => Number(count) > 0);
}

function designManifestRows(d: ShipDesignState, s: ShipDesignSummary) {
  const hull = HULL_CONFIGS.find(c => c.id === d.hull_config);
  const armour = ARMOUR_TYPES.find(a => a.id === d.armour_type);
  const pp = POWER_PLANTS.find(p => p.id === d.pp_type);
  const sensors = SENSORS.find(sensor => sensor.id === d.sensors);
  const bridgeLabel = d.bridge_type === 'standard'
    ? `${bridgeTons(d.tonnage)}t standard bridge`
    : d.bridge_type === 'cockpit'
      ? 'Single cockpit'
      : 'Dual cockpit';
  const mountLabels = d.mounts.map(mount => {
    const mountDef = TURRET_MOUNTS.find(t => t.id === mount.mount_type);
    const weaponNames = mount.weapons
      .map(id => WEAPONS.find(w => w.id === id)?.name ?? id)
      .join(', ');
    return weaponNames ? `${mountDef?.name ?? mount.mount_type}: ${weaponNames}` : mountDef?.name ?? mount.mount_type;
  });
  const systems = d.optional_systems.map(entry => {
    const system = OPTIONAL_SYSTEMS.find(opt => opt.id === entry.type);
    return system ? `${system.name}${system.unit !== 'fixed' ? ` x${entry.quantity}` : ''}` : entry.type;
  });

  return [
    { section: 'Hull', detail: `${d.tonnage}t ${hull?.name ?? d.hull_config}`, metric: `${s.hullHP} HP` },
    { section: 'Protection', detail: d.armour_type === 'none' ? 'Unarmoured' : `${armour?.name ?? d.armour_type} x${d.armour_points}`, metric: d.armour_type === 'none' ? '-' : `${d.armour_points} pts` },
    { section: 'Drives', detail: `Jump-${d.j_drive} / Thrust-${d.m_drive}`, metric: `${s.jumpFuelTons}t jump fuel` },
    { section: 'Power', detail: `${pp?.name ?? d.pp_type} plant`, metric: `${s.powerGenerated - s.powerUsed >= 0 ? '+' : ''}${s.powerGenerated - s.powerUsed}P` },
    { section: 'Bridge', detail: bridgeLabel, metric: `Model ${d.computer_model}${d.computer_bis ? '/bis' : ''}` },
    { section: 'Sensors', detail: sensors?.name ?? d.sensors, metric: sensors ? `DM${sensors.dm >= 0 ? '+' : ''}${sensors.dm}` : '-' },
    { section: 'Weapons', detail: mountLabels.length ? mountLabels.join(' | ') : 'No mounts installed', metric: `${d.mounts.length}/${s.hardpoints + s.firmpoints} mounts` },
    { section: 'Systems', detail: systems.length ? systems.join(' | ') : 'No optional systems installed', metric: `${d.optional_systems.length} entries` },
    { section: 'Quarters', detail: `${d.staterooms} std / ${d.high_staterooms} high / ${d.luxury_staterooms} lux / ${d.low_berths} low`, metric: `${d.common_area_tons}t common` },
    { section: 'Cargo', detail: 'Residual displacement after installed systems', metric: `${Math.max(0, s.cargoTons)}t` },
  ];
}

// ── canonical ship detail view ───────────────────────────────────────────────

function CanonicalShipDetail({
  ship, preset, onAddToFleet, addingToFleet, addedToFleet,
}: {
  ship: CanonicalShip;
  preset: ShipPreset | null;
  onAddToFleet: () => void;
  addingToFleet: boolean;
  addedToFleet: boolean;
}) {
  const specs = ship.defaultSpecs ?? {};
  const Component = ship.Component;
  const presetDesign = preset ? presetToDesign(preset) : null;
  const specRows = CANONICAL_SPEC_FIELDS
    .map(({ key, label, format }) => {
      const value = specs[key];
      if (value == null || value === '') return null;
      return { key, label, value: format ? format(value) : String(value) };
    })
    .filter((row): row is { key: ScalarShipSpecKey; label: string; value: string } => row !== null);

  return (
    <div className="flex flex-col h-full bg-void/40">
      <div className="flex items-start gap-3 px-4 py-3 border-b border-steel/50 flex-shrink-0 bg-panel/70">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-cyan-trav tracking-[0.25em] font-mono">CANONICAL SHIP</div>
          <div className="text-bright font-display text-xl tracking-wide truncate">{ship.name}</div>
          <div className="text-xs text-body/60 font-mono mt-0.5">
            {ship.ship_class} · {ship.tonnage}t
            {specs.j_drive ? ` · J${specs.j_drive}` : ''}{specs.m_drive ? `/M${specs.m_drive}` : ''}
            {specs.purchase_price_mcr ? ` · MCr ${Number(specs.purchase_price_mcr).toFixed(2)}` : ''}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          <button onClick={onAddToFleet} disabled={addingToFleet}
            className="btn-amber flex items-center gap-1 text-xs py-1 px-2">
            {addedToFleet
              ? <><CheckCircle2 size={12} /> IN FLEET</>
              : addingToFleet
                ? 'ADDING...'
                : <><Anchor size={12} /> ADD TO FLEET</>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <Readout label="DISPLACEMENT" value={`${ship.tonnage}t`} sub={ship.ship_class} tone="cyan" />
          <Readout label="TECH LEVEL" value={specs.tech_level ?? '-'} sub={String(specs.hull_config ?? 'Canonical hull')} tone="amber" />
          <Readout label="DRIVES" value={`J${specs.j_drive ?? '-'}/M${specs.m_drive ?? '-'}`} sub={`${specs.fuel_tons ?? '?'}t fuel`} tone="cyan" />
          <Readout label="CARGO" value={`${specs.cargo_tons ?? '?'}t`} sub={`${specs.staterooms ?? '?'} staterooms`} tone="cyan" />
          <Readout label="MAINTENANCE" value={specs.monthly_maintenance_cr ? formatCr(specs.monthly_maintenance_cr) : '-'} sub="per month" tone="cyan" />
          <Readout label="PURCHASE" value={specs.purchase_price_mcr ? formatMCr(specs.purchase_price_mcr) : '-'} sub="new build" tone="amber" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem] gap-4">
          <section className="border border-cyan-trav/25 bg-panel/30 min-h-[24rem] flex flex-col">
            <div className="border-b border-cyan-trav/20 px-3 py-2">
              <div className="label text-cyan-trav">CANONICAL DECK PLAN</div>
              <div className="text-[10px] text-body/45 font-mono">{ship.ship_class.toUpperCase()} · {ship.name.toUpperCase()}</div>
            </div>
            <div className="flex-1 min-h-80 overflow-auto p-4 flex items-start justify-center">
              <div className="w-full max-w-5xl border border-steel bg-void">
                <Component />
              </div>
            </div>
          </section>

          <aside className="space-y-3">
            <section className="border border-steel/50 bg-panel/40">
              <div className="border-b border-steel/40 px-3 py-2 label">SHIP RECORD</div>
              <div className="divide-y divide-steel/20">
                {specRows.map(row => (
                  <div key={row.key} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-3 py-2 text-xs">
                    <div className="text-body/45 font-mono tracking-wider">{row.label.toUpperCase()}</div>
                    <div className="text-amber font-mono min-w-0 break-words">{row.value}</div>
                  </div>
                ))}
                {specs.crew_notes && (
                  <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-3 py-2 text-xs">
                    <div className="text-body/45 font-mono tracking-wider">CREW</div>
                    <div className="text-amber font-mono min-w-0 break-words">{specs.crew_notes}</div>
                  </div>
                )}
              </div>
            </section>

            <section className="border border-steel/50 bg-panel/40">
              <div className="border-b border-steel/40 px-3 py-2 label">SHIPYARD NOTES</div>
              <div className="p-3 text-xs text-body/70 leading-5 whitespace-pre-wrap">
                {preset?.description ?? 'Canonical deck plan available for direct fleet registration.'}
              </div>
            </section>
          </aside>
        </div>

        {presetDesign && (
          <section className="border border-steel/50 bg-panel/40">
            <div className="border-b border-steel/40 px-3 py-2 label">SYSTEMS MANIFEST</div>
            <div className="divide-y divide-steel/20">
              {designManifestRows(presetDesign.design, presetDesign.summary).map(row => (
                <div key={row.section} className="grid grid-cols-1 md:grid-cols-[9rem_minmax(0,1fr)_9rem] gap-1 md:gap-3 px-3 py-2 text-xs">
                  <div className="text-amber font-mono tracking-wider">{row.section}</div>
                  <div className="text-body/75 min-w-0 break-words">{row.detail}</div>
                  <div className="text-cyan-trav font-mono md:text-right">{row.metric}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── design detail view ────────────────────────────────────────────────────────

function DesignDetail({
  design, onDelete, onUploadDiagram, uploadingDiagram, uploadError, onAddToFleet, addingToFleet, addedToFleet,
}: {
  design: ShipDesign;
  onDelete: () => void;
  onUploadDiagram: (file: File) => void;
  uploadingDiagram: boolean;
  uploadError: string | null;
  onAddToFleet: () => void;
  addingToFleet: boolean;
  addedToFleet: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const s = design.summary;
  const d = design.design;
  const hullConfig = HULL_CONFIGS.find(c => c.id === d.hull_config)?.name ?? d.hull_config;
  const powerBalance = s.powerGenerated - s.powerUsed;
  const manifestRows = designManifestRows(d, s);
  const crewRows = crewManifest(s);

  return (
    <div className="flex flex-col h-full bg-void/40">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-steel/50 flex-shrink-0 bg-panel/70">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-cyan-trav tracking-[0.25em] font-mono">COMPLETED DESIGN</div>
          <div className="text-bright font-display text-xl tracking-wide truncate">{d.name}</div>
          <div className="text-xs text-body/60 font-mono mt-0.5">
            TL{d.tech_level} · {d.tonnage}t {hullConfig}
            {d.j_drive > 0 ? ` · J${d.j_drive}` : ''}{d.m_drive > 0 ? `/M${d.m_drive}` : ''}
            {' · '}{formatMCr(s.totalCostMCr)}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          <button onClick={onAddToFleet} disabled={addingToFleet}
            className="btn-amber flex items-center gap-1 text-xs py-1 px-2">
            {addedToFleet
              ? <><CheckCircle2 size={12} /> IN FLEET</>
              : addingToFleet
                ? 'ADDING...'
                : <><Anchor size={12} /> ADD TO FLEET</>}
          </button>
          <button onClick={() => downloadJson(`${(d.name || 'ship-design').replace(/\s+/g,'-').toLowerCase()}.json`, { design: d, summary: s })}
            className="btn-steel flex items-center gap-1 text-xs py-1">
            <Download size={12} /> JSON
          </button>
          <button onClick={onDelete} className="btn-steel flex items-center gap-1 text-xs py-1 text-alert/80 hover:text-alert">
            <Trash2 size={12} /> DEL
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Warnings */}
        {s.warnings.length > 0 && (
          <div className="border border-amber/40 bg-amber/5 px-3 py-2 space-y-1">
            {s.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                {w}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <Readout label="DISPLACEMENT" value={`${s.usedTons}/${d.tonnage}t`} sub={`${Math.max(0, s.cargoTons)}t cargo`} tone={s.cargoTons < 0 ? 'alert' : 'cyan'} />
          <Readout label="POWER BALANCE" value={`${powerBalance >= 0 ? '+' : ''}${powerBalance}P`} sub={`${s.powerGenerated} gen / ${s.powerUsed} use`} tone={powerBalance < 0 ? 'alert' : 'safe'} />
          <Readout label="PURCHASE" value={formatMCr(s.totalCostMCr)} sub={`${s.constructionDays} days build`} tone="amber" />
          <Readout label="MAINTENANCE" value={formatCr(s.maintenanceCrPerMonth)} sub="per month" tone="cyan" />
          <Readout label="HARDPOINTS" value={`${s.hardpoints}/${s.firmpoints}`} sub="hard / firm" tone="cyan" />
          <Readout label="CREW MIN" value={crewTotal(s)} sub={crewRows.map(([role]) => role).join(', ') || 'None'} tone="cyan" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_25rem] gap-4">
          <section className="border border-cyan-trav/25 bg-panel/30 min-h-[24rem] flex flex-col">
            <div className="border-b border-cyan-trav/20 px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <div className="label text-cyan-trav">TECHNICAL SCHEMATIC</div>
                <div className="text-[10px] text-body/45 font-mono">{d.name.toUpperCase()} · {hullConfig.toUpperCase()}</div>
              </div>
              <button onClick={() => fileRef.current?.click()}
                disabled={uploadingDiagram}
                className="btn-steel flex items-center gap-1 text-xs py-1">
                <Upload size={12} /> {design.diagram_url ? (uploadingDiagram ? 'UPLOADING...' : 'REPLACE DIAGRAM') : (uploadingDiagram ? 'UPLOADING...' : 'UPLOAD DIAGRAM')}
              </button>
            </div>
            <div className="flex-1 min-h-80 flex items-center justify-center p-4">
              {design.diagram_url ? (
                <img src={design.diagram_url} alt={`${d.name} diagram`} className="max-h-[32rem] max-w-full border border-steel/50 bg-void object-contain" />
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  disabled={uploadingDiagram}
                  className="w-full max-w-lg min-h-72 border-2 border-dashed border-steel/50 bg-void/50 text-xs text-body/55 hover:border-cyan-trav hover:text-cyan-trav transition-colors flex flex-col items-center justify-center gap-2">
                  <Upload size={24} />
                  {uploadingDiagram ? 'UPLOADING...' : 'DROP IN A SHIP DIAGRAM'}
                  <span className="text-[10px]">PNG, JPG, SVG, WEBP</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onUploadDiagram(f); e.target.value = ''; }} />
            {uploadError && <div className="border-t border-alert/30 px-3 py-2 text-alert text-xs">{uploadError}</div>}
          </section>

          <aside className="space-y-3">
            <section className="border border-steel/50 bg-panel/40">
              <div className="border-b border-steel/40 px-3 py-2 label">CREW REQUIREMENT</div>
              <div className="p-3 space-y-1">
                {crewRows.map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between border-b border-steel/20 pb-1 text-xs">
                    <span className="text-body/70">{role}</span>
                    <span className="text-amber font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-steel/50 bg-panel/40">
              <div className="border-b border-steel/40 px-3 py-2 label">SHIPYARD NOTES</div>
              <div className="p-3 text-xs text-body/70 leading-5 whitespace-pre-wrap">
                {d.notes || 'No design notes recorded.'}
              </div>
            </section>

            <section className="border border-steel/50 bg-panel/40">
              <div className="border-b border-steel/40 px-3 py-2 label">STAT BLOCK</div>
              <div className="p-3 max-h-80 overflow-auto">
                <StatBlockDisplay d={d} s={s} />
              </div>
            </section>
          </aside>
        </div>

        <section className="border border-steel/50 bg-panel/40">
          <div className="border-b border-steel/40 px-3 py-2 label">SYSTEMS MANIFEST</div>
          <div className="divide-y divide-steel/20">
            {manifestRows.map(row => (
              <div key={row.section} className="grid grid-cols-1 md:grid-cols-[9rem_minmax(0,1fr)_9rem] gap-1 md:gap-3 px-3 py-2 text-xs">
                <div className="text-amber font-mono tracking-wider">{row.section}</div>
                <div className="text-body/75 min-w-0 break-words">{row.detail}</div>
                <div className="text-cyan-trav font-mono md:text-right">{row.metric}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── wizard steps ─────────────────────────────────────────────────────────────

function StepFoundation({ draft, set, onPreset }: {
  draft: ShipDesignState;
  set: <K extends keyof ShipDesignState>(k: K, v: ShipDesignState[K]) => void;
  onPreset: (d: ShipDesignState) => void;
}) {
  const SIZES = [50, 100, 200, 400, 800, 1000];
  return (
    <div className="space-y-6">
      <div>
        <div className="label mb-1">SHIP NAME</div>
        <input value={draft.name} onChange={e => set('name', e.target.value)}
          className="input-base w-full max-w-sm" placeholder="Enter ship name..." />
      </div>

      <div>
        <div className="label mb-2">TECH LEVEL</div>
        <div className="flex items-center gap-3">
          <Stepper value={draft.tech_level} onChange={v => set('tech_level', v)} min={8} max={15} />
          <span className="text-xs text-body/50">TL8 = early fusion · TL12 = standard · TL15 = peak</span>
        </div>
      </div>

      <div>
        <div className="label mb-2">HULL TONNAGE</div>
        <div className="flex items-center gap-3 flex-wrap">
          <NumInput value={draft.tonnage} onChange={v => set('tonnage', v)} min={10} max={50000} step={10} className="w-24" />
          <div className="flex gap-1 flex-wrap">
            {SIZES.map(s => (
              <button key={s} type="button" onClick={() => set('tonnage', s)}
                className={`btn-steel text-xs py-0.5 px-2 ${draft.tonnage === s ? 'border-amber text-amber' : ''}`}>{s}t</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="label mb-2">HULL CONFIGURATION</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {HULL_CONFIGS.map(c => (
            <ChoiceCard key={c.id} label={c.name}
              desc={c.notes}
              active={draft.hull_config === c.id}
              onClick={() => set('hull_config', c.id as ShipDesignState['hull_config'])} />
          ))}
        </div>
        <Hint>
          <strong>Standard</strong> hulls are most common. <strong>Streamlined</strong> hulls can enter atmospheres and skim gas giants for free fuel.
          <strong> Dispersed</strong> hulls are cheap but cannot mount armour or enter atmosphere.
        </Hint>
      </div>

      <div className="border-t border-steel/30 pt-4">
        <div className="label mb-3">── OR START FROM A PRESET ──</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SHIP_PRESETS.map(p => (
            <button key={p.id} type="button" onClick={() => onPreset(p.design)}
              className="text-left p-3 border border-steel/50 rounded hover:border-amber hover:bg-amber/5 transition-colors">
              <div className="text-xs font-mono text-amber tracking-wider">{p.name}</div>
              <div className="text-[10px] text-body/60 mt-0.5">{p.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepProtection({ draft, set }: {
  draft: ShipDesignState;
  set: <K extends keyof ShipDesignState>(k: K, v: ShipDesignState[K]) => void;
}) {
  const armourDef = ARMOUR_TYPES.find(a => a.id === draft.armour_type);
  const aTons = draft.armour_type !== 'none'
    ? Math.ceil(draft.tonnage * (armourDef?.tonsPerPointPct ?? 0) / 100 * draft.armour_points)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="label mb-2">ARMOUR TYPE</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ARMOUR_TYPES.map(a => (
            <ChoiceCard key={a.id} label={a.name}
              desc={a.id === 'none' ? 'No armour installed' : `TL${a.minTL}+ · ${a.tonsPerPointPct}%/pt · ${a.costPctPerPoint}% cost/pt`}
              active={draft.armour_type === a.id}
              onClick={() => set('armour_type', a.id as ShipDesignState['armour_type'])} />
          ))}
        </div>
      </div>

      {draft.armour_type !== 'none' && (
        <div>
          <div className="label mb-2">ARMOUR POINTS</div>
          <Stepper value={draft.armour_points} onChange={v => set('armour_points', v)} min={0} max={armourDef?.maxPoints ?? 13} />
          <div className="mt-2 text-xs text-body/60 font-mono">
            {aTons}t consumed · MCr {(draft.tonnage * (armourDef?.costPctPerPoint ?? 0) / 100 * draft.armour_points).toFixed(3)}
          </div>
        </div>
      )}

      <Hint>
        Armour reduces damage from weapons. Each point of <strong>Crystaliron</strong> costs 1.25% of hull tonnage and 5% hull cost.
        <strong> Bonded Superdense</strong> (TL14) is denser, using only 0.8% per point.
        Dispersed hull ships cannot mount armour.
      </Hint>
    </div>
  );
}

function StepDrives({ draft, set }: {
  draft: ShipDesignState;
  set: <K extends keyof ShipDesignState>(k: K, v: ShipDesignState[K]) => void;
}) {
  const mTons = draft.m_drive > 0 ? Math.ceil(draft.tonnage * (M_DRIVE_TABLE[draft.m_drive]?.pctHull ?? 0) / 100) : 0;
  const jTons = draft.j_drive > 0 ? Math.max(10, Math.ceil(draft.tonnage * 0.025 * draft.j_drive + 5)) : 0;
  const mPower = draft.m_drive > 0 ? Math.ceil(draft.tonnage * draft.m_drive / 10) : 0;
  const jPower = draft.j_drive > 0 ? Math.ceil(draft.tonnage * draft.j_drive / 10) : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="label mb-2">MANOEUVRE DRIVE — Thrust Rating</div>
        <div className="flex items-center gap-4">
          <Stepper value={draft.m_drive} onChange={v => set('m_drive', v)} min={0} max={9} />
          <span className="text-xs text-body/60 font-mono">
            {draft.m_drive > 0 ? `${mTons}t · ${mPower}P · TL${M_DRIVE_TABLE[draft.m_drive]?.minTL ?? 9}` : 'No M-Drive'}
          </span>
        </div>
        <Hint>Thrust-1 = minimal manoeuvre. Thrust-6+ is combat-capable. Higher thrust costs more tonnage.</Hint>
      </div>

      <div>
        <div className="label mb-2">JUMP DRIVE — Jump Rating</div>
        <div className="flex items-center gap-4">
          <Stepper value={draft.j_drive} onChange={v => set('j_drive', v)} min={0} max={6} />
          <span className="text-xs text-body/60 font-mono">
            {draft.j_drive > 0 ? `${jTons}t · ${jPower}P · TL${J_DRIVE_TABLE[draft.j_drive]?.minTL ?? 9}` : 'No J-Drive (system craft only)'}
          </span>
        </div>
        <Hint>Jump-1 crosses one parsec per week. Jump-2 is the most common in free traders. No J-Drive means the ship cannot travel between star systems.</Hint>
      </div>

      {(mTons + jTons) > 0 && (
        <div className="border border-steel/40 rounded p-3 font-mono text-xs space-y-1">
          <div className="label text-[10px]">DRIVE SUMMARY</div>
          {draft.m_drive > 0 && <div className="text-body/70">M-Drive: {mTons}t · MCr {(mTons * 2).toFixed(1)} · {mPower}P</div>}
          {draft.j_drive > 0 && <div className="text-body/70">J-Drive: {jTons}t · MCr {(jTons * 1.5).toFixed(1)} · {jPower}P</div>}
          <div className="text-bright">Total drives: {mTons + jTons}t · {mPower + jPower}P required</div>
        </div>
      )}
    </div>
  );
}

function StepPower({ draft, set, summary }: {
  draft: ShipDesignState;
  set: <K extends keyof ShipDesignState>(k: K, v: ShipDesignState[K]) => void;
  summary: ShipDesignSummary;
}) {
  const pp = POWER_PLANTS.find(p => p.id === draft.pp_type);
  const ppTons = Math.ceil(draft.pp_power / (pp?.powerPerTon ?? 15));
  const basicPower = Math.ceil(draft.tonnage / 5);
  const mPower = draft.m_drive > 0 ? Math.ceil(draft.tonnage * draft.m_drive / 10) : 0;
  const jPower = draft.j_drive > 0 ? Math.ceil(draft.tonnage * draft.j_drive / 10) : 0;
  const minPower = basicPower + mPower + jPower;
  const balance = summary.powerBalance;
  const WEEKS = [4, 8, 12, 16];

  return (
    <div className="space-y-6">
      <div>
        <div className="label mb-2">POWER PLANT TYPE</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {POWER_PLANTS.map(p => (
            <ChoiceCard key={p.id} label={p.name}
              desc={`TL${p.minTL} · ${p.powerPerTon}P/ton · MCr${p.costMCrPerTon}/ton`}
              active={draft.pp_type === p.id}
              onClick={() => set('pp_type', p.id as ShipDesignState['pp_type'])} />
          ))}
        </div>
      </div>

      <div>
        <div className="label mb-2">POWER OUTPUT</div>
        <div className="flex items-center gap-3 flex-wrap">
          <Stepper value={draft.pp_power} onChange={v => set('pp_power', v)} min={1} max={9999} />
          <div className="text-xs font-mono">
            <div className="text-body/60">{ppTons}t consumed · MCr {(ppTons * (pp?.costMCrPerTon ?? 1)).toFixed(2)}</div>
            <div className="text-body/50">Recommended minimum: {minPower}P (basic {basicPower} + M {mPower} + J {jPower})</div>
          </div>
        </div>
        <div className={`mt-2 text-xs font-mono font-bold ${balance >= 0 ? 'text-safe' : 'text-amber'}`}>
          Power balance: {balance >= 0 ? '+' : ''}{balance}P {balance < 0 ? '⚠ deficit' : '✓'}
        </div>
      </div>

      <div>
        <div className="label mb-2">FUEL DURATION</div>
        <div className="flex gap-2">
          {WEEKS.map(w => (
            <button key={w} type="button" onClick={() => set('pp_fuel_weeks', w)}
              className={`btn-steel text-xs py-0.5 px-3 ${draft.pp_fuel_weeks === w ? 'border-amber text-amber' : ''}`}>{w} weeks</button>
          ))}
        </div>
        <div className="mt-2 text-xs text-body/60 font-mono">
          PP fuel: {summary.ppFuelTons}t · Jump fuel: {summary.jumpFuelTons}t · Total: {summary.ppFuelTons + summary.jumpFuelTons}t
        </div>
      </div>

      <Hint>
        The power plant must cover <strong>basic systems</strong> (hull tons ÷ 5), your M-Drive (hull ÷ 10 × thrust), and J-Drive (hull ÷ 10 × rating) simultaneously.
        TL12 plants output 15P/ton; TL15 output 20P/ton. More fuel extends patrol range between refuelling stops.
      </Hint>
    </div>
  );
}

function StepBridge({ draft, set }: {
  draft: ShipDesignState;
  set: <K extends keyof ShipDesignState>(k: K, v: ShipDesignState[K]) => void;
}) {
  const computer = COMPUTERS.find(c => c.model === draft.computer_model) ?? COMPUTERS[0];
  const computerCost = computer.baseCostMCr * (draft.computer_bis ? 1.5 : 1);

  return (
    <div className="space-y-6">
      <div>
        <div className="label mb-2">BRIDGE</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ChoiceCard label="Standard Bridge" desc="Full bridge — all hull sizes" active={draft.bridge_type === 'standard'} onClick={() => set('bridge_type', 'standard')} />
          <ChoiceCard label="Cockpit" desc="1.5t · ≤50t hulls only" active={draft.bridge_type === 'cockpit'} onClick={() => set('bridge_type', 'cockpit')} />
          <ChoiceCard label="Dual Cockpit" desc="2.5t · ≤50t hulls only" active={draft.bridge_type === 'dual_cockpit'} onClick={() => set('bridge_type', 'dual_cockpit')} />
        </div>
      </div>

      <div>
        <div className="label mb-2">COMPUTER</div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={draft.computer_model} onChange={e => set('computer_model', Number(e.target.value))} className="input-base">
            {COMPUTERS.map(c => <option key={c.model} value={c.model}>Model {c.model} (TL{c.minTL})</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-body/70 cursor-pointer">
            <input type="checkbox" checked={draft.computer_bis} onChange={e => set('computer_bis', e.target.checked)} className="accent-amber" />
            /bis (+50% cost, radiation-hardened)
          </label>
          <span className="text-xs text-body/60 font-mono">MCr {computerCost.toFixed(3)}</span>
        </div>
        <Hint>
          Computer model must be ≥ Jump Control rating. Model 5 handles Jump-1 to Jump-2. Model 15 for Jump-3.
          /bis models are radiation-shielded and required for Navy vessels.
        </Hint>
      </div>

      <div>
        <div className="label mb-2">SENSORS</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {SENSORS.map(s => (
            <ChoiceCard key={s.id} label={s.name}
              desc={`TL${s.minTL} · DM${s.dm >= 0 ? '+' : ''}${s.dm} · ${s.tons}t · MCr${s.costMCr}`}
              active={draft.sensors === s.id}
              onClick={() => set('sensors', s.id as ShipDesignState['sensors'])} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepWeapons({ draft, set, summary }: {
  draft: ShipDesignState;
  set: <K extends keyof ShipDesignState>(k: K, v: ShipDesignState[K]) => void;
  summary: ShipDesignSummary;
}) {
  function addMount() {
    set('mounts', [...draft.mounts, { id: uid(), mount_type: 'single', weapons: [] }]);
  }
  function updateMount(id: string, patch: Partial<MountConfig>) {
    set('mounts', draft.mounts.map(m => m.id === id ? { ...m, ...patch } : m));
  }
  function removeMount(id: string) {
    set('mounts', draft.mounts.filter(m => m.id !== id));
  }
  function toggleWeapon(mountId: string, weapId: string) {
    set('mounts', draft.mounts.map(m => {
      if (m.id !== mountId) return m;
      const has = m.weapons.includes(weapId);
      return { ...m, weapons: has ? m.weapons.filter(w => w !== weapId) : [...m.weapons, weapId] };
    }));
  }

  const availableHardpoints = summary.hardpoints;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="border border-steel/50 rounded p-3 text-center">
          <div className="text-2xl font-mono text-cyan-trav">{availableHardpoints}</div>
          <div className="text-[10px] text-body/50 tracking-wider">HARDPOINTS</div>
        </div>
        <div className="border border-steel/50 rounded p-3 text-center">
          <div className="text-2xl font-mono text-cyan-trav">{draft.mounts.length}</div>
          <div className="text-[10px] text-body/50 tracking-wider">INSTALLED</div>
        </div>
        {draft.mounts.length > availableHardpoints && (
          <div className="flex items-center gap-1 text-xs text-alert">
            <AlertTriangle size={12} /> Exceeds hardpoints
          </div>
        )}
      </div>

      <div className="space-y-3">
        {draft.mounts.map((mount, i) => {
          const mt = TURRET_MOUNTS.find(t => t.id === mount.mount_type);
          return (
            <div key={mount.id} className="border border-steel/50 rounded p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-body/50 font-mono">#{i + 1}</span>
                <select value={mount.mount_type}
                  onChange={e => updateMount(mount.id, { mount_type: e.target.value as MountConfig['mount_type'] })}
                  className="input-base flex-1">
                  {TURRET_MOUNTS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <span className="text-xs text-body/50 font-mono">{mt?.tons}t · {mt?.slots} slot{mt?.slots !== 1 ? 's' : ''}</span>
                <button type="button" onClick={() => removeMount(mount.id)} className="text-alert/60 hover:text-alert p-1">
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEAPONS.map(w => (
                  <label key={w.id} className="flex items-center gap-1.5 text-xs text-body/70 cursor-pointer hover:text-body">
                    <input type="checkbox" checked={mount.weapons.includes(w.id)}
                      onChange={() => toggleWeapon(mount.id, w.id)} className="accent-amber" />
                    {w.name}
                    <span className="text-body/40">{w.power > 0 ? `${w.power}P` : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={addMount}
        className="btn-steel flex items-center gap-1 text-xs">
        <Plus size={13} /> ADD MOUNT
      </button>

      <Hint>
        One hardpoint per 100 tons of hull. Hulls under 100t have firmpoints only.
        Each turret uses 1 hardpoint and 1 ton. Particle barbettes use 3 slots plus 5 extra tons.
      </Hint>
    </div>
  );
}

function StepSystems({ draft, set }: {
  draft: ShipDesignState;
  set: <K extends keyof ShipDesignState>(k: K, v: ShipDesignState[K]) => void;
}) {
  function addSystem(type: string) {
    if (draft.optional_systems.some(s => s.type === type)) return;
    set('optional_systems', [...draft.optional_systems, { id: uid(), type, quantity: 1 }]);
  }
  function updateQty(id: string, qty: number) {
    set('optional_systems', draft.optional_systems.map(s => s.id === id ? { ...s, quantity: Math.max(1, qty) } : s));
  }
  function removeSystem(id: string) {
    set('optional_systems', draft.optional_systems.filter(s => s.id !== id));
  }

  const installed = new Set(draft.optional_systems.map(s => s.type));

  return (
    <div className="space-y-6">
      {/* Available to add */}
      <div>
        <div className="label mb-2">AVAILABLE SYSTEMS</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {OPTIONAL_SYSTEMS.map(opt => (
            <button key={opt.id} type="button"
              disabled={installed.has(opt.id)}
              onClick={() => addSystem(opt.id)}
              className={`text-left px-3 py-2 border rounded text-xs transition-colors ${
                installed.has(opt.id)
                  ? 'border-steel/20 text-body/30 cursor-not-allowed'
                  : 'border-steel/50 hover:border-amber hover:text-bright text-body/70'
              }`}
            >
              <span className="font-mono">{opt.name}</span>
              <span className="text-body/40 ml-2">{opt.tonsPerUnit > 0 ? `${opt.tonsPerUnit}t/${opt.unit}` : 'fixed'} · MCr{opt.costMCrPerUnit}/{opt.unit}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Installed */}
      {draft.optional_systems.length > 0 && (
        <div>
          <div className="label mb-2">INSTALLED</div>
          <div className="space-y-2">
            {draft.optional_systems.map(sys => {
              const opt = OPTIONAL_SYSTEMS.find(o => o.id === sys.type);
              if (!opt) return null;
              return (
                <div key={sys.id} className="flex items-center gap-3 border border-steel/40 rounded px-3 py-2">
                  <span className="flex-1 text-xs text-body/80 font-mono">{opt.name}</span>
                  {opt.unit !== 'fixed' && (
                    <Stepper value={sys.quantity} onChange={q => updateQty(sys.id, q)} min={1} />
                  )}
                  <span className="text-xs text-body/50 font-mono w-28 text-right">
                    {opt.tonsPerUnit * sys.quantity}t · MCr {(opt.costMCrPerUnit * sys.quantity).toFixed(2)}
                  </span>
                  <button type="button" onClick={() => removeSystem(sys.id)} className="text-alert/60 hover:text-alert p-1">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Hint>
        Fuel scoops are free on streamlined hulls. Fuel processors refine one day of raw fuel per ton.
        Docking space needs 110% of the craft's tonnage.
      </Hint>
    </div>
  );
}

function StepQuarters({ draft, set }: {
  draft: ShipDesignState;
  set: <K extends keyof ShipDesignState>(k: K, v: ShipDesignState[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="label mb-3">ACCOMMODATIONS</div>
        <div className="space-y-3">
          <Stepper label="Standard Staterooms (4t each)" value={draft.staterooms} onChange={v => set('staterooms', v)} min={0} />
          <Stepper label="High Staterooms (6t each)" value={draft.high_staterooms} onChange={v => set('high_staterooms', v)} min={0} />
          <Stepper label="Luxury Staterooms (10t each)" value={draft.luxury_staterooms} onChange={v => set('luxury_staterooms', v)} min={0} />
          <Stepper label="Low Berths (0.5t each)" value={draft.low_berths} onChange={v => set('low_berths', v)} min={0} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-body/60 w-32 flex-shrink-0">Common Area (tons)</span>
            <NumInput value={draft.common_area_tons} onChange={v => set('common_area_tons', v)} min={0} className="w-24" />
          </div>
        </div>
      </div>

      <div>
        <div className="label mb-3">SOFTWARE</div>
        <div className="space-y-3">
          <Stepper label="Jump Control / N" value={draft.software_jump_control} onChange={v => set('software_jump_control', v)} min={0} max={6} />
          <Stepper label="Fire Control / N" value={draft.software_fire_control} onChange={v => set('software_fire_control', v)} min={0} max={6} />
          <label className="flex items-center gap-2 text-xs text-body/70 cursor-pointer">
            <input type="checkbox" checked={draft.software_intellect} onChange={e => set('software_intellect', e.target.checked)} className="accent-amber" />
            Intellect (MCr1, TL12+, autonomous operations)
          </label>
        </div>
      </div>

      <Hint>
        One crew member per stateroom — crew and passengers share the same pool.
        Jump Control rating must match or exceed the J-Drive rating.
        Low berth passengers arrive sedated and spend the voyage frozen.
      </Hint>
    </div>
  );
}

function StepReview({ draft, summary, activeId, onSave, saving, saved, saveError, onUploadDiagram, uploadingDiagram, designRecord }: {
  draft: ShipDesignState;
  summary: ShipDesignSummary;
  activeId: string | null;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
  onUploadDiagram: (f: File) => void;
  uploadingDiagram: boolean;
  designRecord: ShipDesign | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {summary.warnings.length > 0 && (
        <div className="border border-amber/40 rounded p-3 space-y-1 bg-amber/5">
          <div className="label text-amber text-[10px] mb-2">DESIGN WARNINGS</div>
          {summary.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'CARGO', value: `${Math.max(0, summary.cargoTons)}t`, warn: summary.cargoTons < 0 },
          { label: 'PURCHASE', value: `MCr ${summary.totalCostMCr.toFixed(2)}`, warn: false },
          { label: 'MAINT', value: `Cr ${Math.round(summary.maintenanceCrPerMonth).toLocaleString()}/mo`, warn: false },
          { label: 'POWER', value: `${summary.powerGenerated}/${summary.powerUsed}`, warn: summary.powerBalance < 0 },
        ].map(stat => (
          <div key={stat.label} className="border border-steel/40 rounded p-3 text-center">
            <div className={`text-base font-mono font-bold ${stat.warn ? 'text-alert' : 'text-cyan-trav'}`}>{stat.value}</div>
            <div className="text-[10px] text-body/50 tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Stat block */}
      <div className="border border-steel/40 rounded p-3 bg-panel/40">
        <StatBlockDisplay d={draft} s={summary} />
      </div>

      {/* Diagram upload (only after save) */}
      <div>
        <div className="label mb-2">SHIP DIAGRAM</div>
        {!activeId ? (
          <div className="text-xs text-body/50 font-mono border border-steel/30 rounded p-3">
            Save this design first, then upload a diagram.
          </div>
        ) : designRecord?.diagram_url ? (
          <div className="space-y-2">
            <img src={designRecord.diagram_url} alt="Ship diagram" className="max-w-xs rounded border border-steel/40" />
            <button onClick={() => fileRef.current?.click()} disabled={uploadingDiagram}
              className="btn-steel flex items-center gap-1 text-xs py-1">
              <Upload size={12} /> {uploadingDiagram ? 'UPLOADING...' : 'REPLACE'}
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploadingDiagram}
            className="w-full sm:w-72 border-2 border-dashed border-steel/40 rounded p-4 text-xs text-body/50 hover:border-steel hover:text-body/70 transition-colors flex flex-col items-center gap-2">
            <Upload size={18} />
            {uploadingDiagram ? 'UPLOADING...' : 'CLICK TO UPLOAD DIAGRAM'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUploadDiagram(f); e.target.value = ''; }} />
      </div>

      {/* Save + Export */}
      {saveError && (
        <div className="flex items-center gap-2 text-xs text-alert border border-alert/30 rounded p-2 bg-alert/5">
          <AlertTriangle size={13} className="flex-shrink-0" /> {saveError}
        </div>
      )}
      <div className="flex gap-3 flex-wrap">
        <button onClick={onSave} disabled={saving}
          className="btn-amber flex items-center gap-2 py-2 px-4">
          {saved ? <><CheckCircle2 size={14} /> SAVED!</> : saving ? <><Save size={14} /> SAVING...</> : <><Save size={14} /> {activeId ? 'UPDATE DESIGN' : 'SAVE DESIGN'}</>}
        </button>
        <button onClick={() => downloadJson(`${(draft.name || 'ship-design').replace(/\s+/g,'-').toLowerCase()}.json`, { design: draft, summary })}
          className="btn-steel flex items-center gap-2 py-2 px-4">
          <Download size={14} /> EXPORT JSON
        </button>
      </div>
    </div>
  );
}

// ── main ShipBuilder component ────────────────────────────────────────────────

type Mode = 'browse' | 'detail' | 'wizard';

export default function ShipBuilder() {
  const { client } = useSupabase();
  const [designs, setDesigns] = useState<ShipDesign[]>([]);
  const [mode, setMode] = useState<Mode>('browse');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCanonicalId, setActiveCanonicalId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShipDesignState>(defaultDesign());
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingDiagram, setUploadingDiagram] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [addingToFleet, setAddingToFleet] = useState(false);
  const [addedToFleet, setAddedToFleet] = useState(false);

  const summary = computeShipSummary(draft);
  const activeDesign = designs.find(d => d.id === activeId) ?? null;
  const activeCanonicalShip = CANONICAL_SHIPS.find(ship => ship.id === activeCanonicalId) ?? null;
  const activeCanonicalPreset = activeCanonicalShip ? presetForCanonical(activeCanonicalShip.id) : null;

  // ── data loading ───────────────────────────────────────────────────────────

  const loadDesigns = useCallback(async () => {
    if (!client) return;
    const { data } = await client.from('ship_designs').select('*').order('updated_at', { ascending: false });
    if (data) setDesigns(data as ShipDesign[]);
  }, [client]);

  useEffect(() => {
    loadDesigns();
    if (!client) return;
    const sub = client.channel('ship_designs_builder')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ship_designs' }, loadDesigns)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [client, loadDesigns]);

  // ── actions ────────────────────────────────────────────────────────────────

  function startNew() {
    setActiveId(null);
    setActiveCanonicalId(null);
    setDraft(defaultDesign());
    setStep(0);
    setMode('wizard');
  }

  function startEdit(design: ShipDesign) {
    setActiveId(design.id);
    setActiveCanonicalId(null);
    setDraft(cloneDesignState(design.design));
    setStep(0);
    setMode('wizard');
  }

  function viewDesign(design: ShipDesign) {
    setActiveId(design.id);
    setActiveCanonicalId(null);
    setMode('detail');
    setAddedToFleet(false);
  }

  function viewCanonicalShip(ship: CanonicalShip) {
    setActiveId(null);
    setActiveCanonicalId(ship.id);
    setMode('detail');
    setAddedToFleet(false);
  }

  function customizeCanonical(ship: CanonicalShip) {
    const preset = presetForCanonical(ship.id);
    if (!preset) return;
    setActiveId(null);
    setActiveCanonicalId(null);
    setDraft(cloneDesignState(preset.design));
    setStep(0);
    setMode('wizard');
  }

  async function save() {
    if (!client) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      name: draft.name || 'Unnamed Design',
      design: draft,
      summary: computeShipSummary(draft),
      updated_at: new Date().toISOString(),
    };
    try {
      if (activeId) {
        const { error } = await client.from('ship_designs').update(payload).eq('id', activeId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await client.from('ship_designs').insert(payload).select().single();
        if (error) throw new Error(error.message);
        if (data) {
          const newId = (data as ShipDesign).id;
          setActiveId(newId);
          await loadDesigns();
          setMode('detail');
          setSaving(false);
          return;
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      loadDesigns();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDesign(id: string) {
    if (!client) return;
    if (!confirm('Delete this design? This cannot be undone.')) return;
    await client.from('ship_designs').delete().eq('id', id);
    if (activeId === id) { setActiveId(null); setMode('browse'); }
    loadDesigns();
  }

  async function addToFleet() {
    if (!client || (!activeDesign && !activeCanonicalShip)) return;
    setAddingToFleet(true);
    if (activeCanonicalShip) {
      await client.from('ships').insert({
        name: activeCanonicalShip.name,
        ship_class: activeCanonicalShip.ship_class,
        tonnage: activeCanonicalShip.tonnage,
        schematic_type: 'canonical',
        canonical_id: activeCanonicalShip.id,
        annotations: [],
        notes: null,
        damage: {},
      });
    } else if (activeDesign) {
      const d = activeDesign.design;
      const s = activeDesign.summary;
      await client.from('ships').insert({
        name: d.name || 'Unnamed Design',
        tonnage: d.tonnage,
        schematic_type: 'custom',
        image_url: activeDesign.diagram_url ?? null,
        annotations: [],
        notes: null,
        damage: {},
        specs: designToFleetSpecs(d, s),
      });
    }
    setAddingToFleet(false);
    setAddedToFleet(true);
    setTimeout(() => setAddedToFleet(false), 3000);
  }

  async function uploadDiagram(file: File) {
    if (!client || !activeId) return;
    setUploadingDiagram(true);
    setUploadError(null);
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `designs/${activeId}/diagram.${ext}`;
    const { error } = await client.storage.from('ship-schematics').upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploadError(`Upload failed: ${error.message}`);
    } else {
      const { data: { publicUrl } } = client.storage.from('ship-schematics').getPublicUrl(path);
      await client.from('ship_designs').update({ diagram_url: publicUrl }).eq('id', activeId);
      loadDesigns();
    }
    setUploadingDiagram(false);
  }

  // ── draft helpers ─────────────────────────────────────────────────────────

  function set<K extends keyof ShipDesignState>(key: K, value: ShipDesignState[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  function loadPreset(design: ShipDesignState) {
    setActiveCanonicalId(null);
    setDraft(cloneDesignState(design));
    setStep(1);
  }

  // ── render ────────────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 0: return <StepFoundation draft={draft} set={set} onPreset={loadPreset} />;
      case 1: return <StepProtection draft={draft} set={set} />;
      case 2: return <StepDrives draft={draft} set={set} />;
      case 3: return <StepPower draft={draft} set={set} summary={summary} />;
      case 4: return <StepBridge draft={draft} set={set} />;
      case 5: return <StepWeapons draft={draft} set={set} summary={summary} />;
      case 6: return <StepSystems draft={draft} set={set} />;
      case 7: return <StepQuarters draft={draft} set={set} />;
      case 8: return (
        <StepReview
          draft={draft} summary={summary} activeId={activeId}
          onSave={save} saving={saving} saved={saved} saveError={saveError}
          onUploadDiagram={uploadDiagram} uploadingDiagram={uploadingDiagram}
          designRecord={activeDesign}
        />
      );
      default: return null;
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — design list */}
      <aside className="w-56 flex-shrink-0 border-r border-steel/50 flex flex-col bg-panel/40">
        <div className="p-3 border-b border-steel/30">
          <button onClick={startNew} className="btn-amber w-full flex items-center justify-center gap-1 text-xs py-1.5">
            <Plus size={13} /> NEW DESIGN
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="px-3 pt-3 pb-1 text-[10px] text-cyan-trav tracking-[0.2em] font-mono">CANONICAL</div>
          {CANONICAL_SHIPS.map(ship => {
            const preset = presetForCanonical(ship.id);
            return (
              <div key={ship.id}
                className={`border-b border-steel/20 transition-colors text-xs font-mono flex items-stretch ${
                  activeCanonicalId === ship.id
                    ? 'bg-amber/10 text-amber border-l-2 border-l-amber'
                    : 'text-body/70 hover:bg-steel/20 hover:text-bright'
                }`}
              >
                <button type="button"
                  onClick={() => viewCanonicalShip(ship)}
                  className="min-w-0 flex-1 text-left px-3 py-2.5"
                >
                  <div className="truncate font-bold">{ship.name}</div>
                  <div className="text-body/40 text-[10px] mt-0.5">
                    {ship.ship_class} · {ship.tonnage}t
                  </div>
                </button>
                {preset && (
                  <button type="button"
                    onClick={() => customizeCanonical(ship)}
                    aria-label={`Customize ${ship.name} canonical design`}
                    title="Customize canonical design"
                    className="w-10 flex-shrink-0 flex items-center justify-center text-body/45 hover:text-amber focus:text-amber transition-colors"
                  >
                    <Settings size={13} />
                  </button>
                )}
              </div>
            );
          })}

          <div className="px-3 pt-4 pb-1 text-[10px] text-cyan-trav tracking-[0.2em] font-mono">SAVED DESIGNS</div>
          {designs.length === 0 ? (
            <div className="px-4 py-3 text-xs text-body/40 text-center font-mono">No saved designs.</div>
          ) : (
            designs.map(d => (
              <div key={d.id}
                className={`border-b border-steel/20 transition-colors text-xs font-mono flex items-stretch ${
                  activeId === d.id && !activeCanonicalId
                    ? 'bg-amber/10 text-amber border-l-2 border-l-amber'
                    : 'text-body/70 hover:bg-steel/20 hover:text-bright'
                }`}
              >
                <button type="button"
                  onClick={() => viewDesign(d)}
                  className="min-w-0 flex-1 text-left px-3 py-2.5"
                >
                  <div className="truncate font-bold">{d.name || 'Unnamed'}</div>
                  <div className="text-body/40 text-[10px] mt-0.5">
                    {d.design.tonnage}t · J{d.design.j_drive}/M{d.design.m_drive}
                  </div>
                </button>
                <button type="button"
                  onClick={() => startEdit(d)}
                  aria-label={`Edit ${d.name || 'Unnamed'} design`}
                  title="Edit design"
                  className="w-10 flex-shrink-0 flex items-center justify-center text-body/45 hover:text-amber focus:text-amber transition-colors"
                >
                  <Settings size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {mode === 'browse' && (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div className="space-y-3">
              <div className="text-4xl font-mono text-body/20">⬡</div>
              <div className="text-sm text-body/50 font-mono">Select a canonical ship or saved design<br />or click NEW DESIGN to begin.</div>
            </div>
          </div>
        )}

        {mode === 'detail' && activeCanonicalShip && (
          <CanonicalShipDetail
            ship={activeCanonicalShip}
            preset={activeCanonicalPreset}
            onAddToFleet={addToFleet}
            addingToFleet={addingToFleet}
            addedToFleet={addedToFleet}
          />
        )}

        {mode === 'detail' && !activeCanonicalShip && activeDesign && (
          <DesignDetail
            design={activeDesign}
            onDelete={() => deleteDesign(activeDesign.id)}
            onUploadDiagram={uploadDiagram}
            uploadingDiagram={uploadingDiagram}
            uploadError={uploadError}
            onAddToFleet={addToFleet}
            addingToFleet={addingToFleet}
            addedToFleet={addedToFleet}
          />
        )}

        {mode === 'wizard' && (
          <>
            {/* Wizard header */}
            <div className="border-b border-steel/50 px-4 py-2 flex items-center gap-3 flex-shrink-0 bg-panel/60">
              <span className="text-xs font-mono text-body/60">
                {activeId ? `EDITING: ${draft.name || 'Unnamed'}` : 'NEW DESIGN'}
              </span>
              {saveError && (
                <span className="text-xs text-alert font-mono flex items-center gap-1">
                  <AlertTriangle size={11} /> {saveError}
                </span>
              )}
              {activeId && activeDesign ? (
                <button onClick={() => viewDesign(activeDesign)} className="ml-auto text-xs text-body/50 hover:text-body flex items-center gap-1">
                  <X size={12} /> CANCEL EDIT
                </button>
              ) : !activeId ? (
                <button onClick={() => setMode('browse')} className="ml-auto text-xs text-body/50 hover:text-body flex items-center gap-1">
                  <X size={12} /> DISCARD
                </button>
              ) : null}
            </div>

            <StatsBar s={summary} tonnage={draft.tonnage} />
            <StepProgress step={step} onJump={setStep} />

            {/* Step content */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
              <div className="max-w-2xl">
                <div className="text-base font-mono text-amber tracking-widest mb-4">
                  {step + 1}. {STEPS[step]}
                </div>
                {renderStep()}
              </div>
            </div>

            {/* Nav buttons */}
            <div className="border-t border-steel/30 px-4 py-3 flex items-center justify-between flex-shrink-0 bg-panel/40">
              <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                className="btn-steel flex items-center gap-1 text-xs py-1 disabled:opacity-30">
                <ChevronLeft size={13} /> BACK
              </button>
              <span className="text-xs text-body/40 font-mono">{step + 1} / {STEPS.length}</span>
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(s => s + 1)}
                  className="btn-steel flex items-center gap-1 text-xs py-1">
                  NEXT <ChevronRight size={13} />
                </button>
              ) : (
                <button onClick={save} disabled={saving}
                  className="btn-amber flex items-center gap-1 text-xs py-1 px-4">
                  {saved ? <><CheckCircle2 size={13} /> SAVED</> : saving ? 'SAVING...' : <><Save size={13} /> {activeId ? 'UPDATE' : 'SAVE'}</>}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
