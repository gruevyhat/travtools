import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Minus, Plus, Trash2, Upload, Tag, X, Settings } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { Ship, ShipSpecs, Annotation, ShipDamageTrackers, ShipAmmoTracker, ShipSoftwareEntry, ShipSystemEntry } from '../../types';
import { CANONICAL_SHIPS } from './canonicalShips';
import { annotationPosition, removeAnnotationById, sortShips } from '../../lib/ships';
import { OPTIONAL_SYSTEMS, SOFTWARE } from '../../data/shipComponents';
import NumberStepper from '../shared/NumberStepper';

function uuid() {
  return crypto.randomUUID();
}

const SPECS_FIELDS: { key: keyof ShipSpecs; label: string; type: 'number' | 'text' }[] = [
  { key: 'tech_level', label: 'Tech Level', type: 'number' },
  { key: 'hull_config', label: 'Hull Config', type: 'text' },
  { key: 'hull_rating', label: 'Hull Rating', type: 'number' },
  { key: 'm_drive', label: 'M-Drive Thrust', type: 'number' },
  { key: 'j_drive', label: 'J-Drive Rating', type: 'number' },
  { key: 'power_plant', label: 'Power Plant', type: 'number' },
  { key: 'fuel_tons', label: 'Fuel (tons)', type: 'number' },
  { key: 'bridge_tons', label: 'Bridge (tons)', type: 'number' },
  { key: 'cargo_tons', label: 'Cargo (tons)', type: 'number' },
  { key: 'staterooms', label: 'Staterooms', type: 'number' },
  { key: 'low_berths', label: 'Low Berths', type: 'number' },
  { key: 'armour_rating', label: 'Armour', type: 'number' },
  { key: 'turrets', label: 'Turrets', type: 'number' },
  { key: 'monthly_maintenance_cr', label: 'Maintenance (Cr/mo)', type: 'number' },
  { key: 'purchase_price_mcr', label: 'Purchase Price (MCr)', type: 'number' },
];

type ShipDamageNumberKey = Exclude<keyof ShipDamageTrackers, 'notes'>;

const DAMAGE_FIELDS: { key: ShipDamageNumberKey; label: string; maxSpec?: keyof ShipSpecs; max?: number }[] = [
  { key: 'hull', label: 'Hull Damage', maxSpec: 'hull_rating' },
  { key: 'armour', label: 'Armour Damage', maxSpec: 'armour_rating' },
  { key: 'critical_hits', label: 'Critical Hits' },
  { key: 'm_drive', label: 'M-Drive Damage', max: 6 },
  { key: 'j_drive', label: 'J-Drive Damage', max: 6 },
  { key: 'power_plant', label: 'Power Plant Damage', max: 6 },
  { key: 'bridge', label: 'Bridge Damage', max: 6 },
  { key: 'sensors', label: 'Sensors Damage', max: 6 },
  { key: 'weapons', label: 'Weapons Damage', max: 6 },
  { key: 'cargo', label: 'Cargo Damage', max: 6 },
];

interface ShipIdentityForm {
  name: string;
  ship_class: string;
  tonnage: string;
  schematic_type: Ship['schematic_type'];
  canonical_id: string;
  image_url: string;
}

interface ShipRecordPanelProps {
  ship: Ship;
  specs: ShipSpecs;
  editable: boolean;
  identityForm: ShipIdentityForm;
  specsForm: ShipSpecs;
  onIdentityChange: (form: ShipIdentityForm) => void;
  onSpecsChange: (s: ShipSpecs) => void;
  onCanonicalChange: (id: string) => void;
  onSchematicTypeChange: (type: Ship['schematic_type']) => void;
  onUploadImage: () => void;
  onSave: () => void;
  onReset: () => void;
}

interface ShipDamagePanelProps {
  specs: ShipSpecs;
  damage: ShipDamageTrackers;
  damageInput: string;
  onDamageInputChange: (value: string) => void;
  onApplyDamage: () => void;
  onAdjust: (key: ShipDamageNumberKey, delta: number) => void;
  onReset: () => void;
  onNotesChange: (notes: string) => void;
  onNotesBlur: (notes: string) => void;
}

interface ShipAmmoPanelProps {
  ammo: ShipAmmoTracker[];
  onReset: () => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
  onFieldChange: (id: string, patch: Partial<ShipAmmoTracker>) => void;
}

interface ShipManifestPanelProps {
  specs: ShipSpecs;
  editable: boolean;
  specsForm: ShipSpecs;
  onSpecsChange: (specs: ShipSpecs) => void;
}

function hasSpecValues(specs: ShipSpecs | null) {
  return Boolean(specs && Object.values(specs).some(v => {
    if (Array.isArray(v)) return v.length > 0;
    return v != null && v !== '';
  }));
}

function hasDamageValues(damage: ShipDamageTrackers | null | undefined) {
  if (!damage) return false;
  return DAMAGE_FIELDS.some(({ key }) => Number(damage[key] ?? 0) > 0) || Boolean(damage.notes?.trim());
}

function effectiveShipSpecs(ship: Ship | null): ShipSpecs {
  if (!ship) return {};
  const canonicalDef = ship.canonical_id
    ? CANONICAL_SHIPS.find(c => c.id === ship.canonical_id)
    : undefined;
  return normalizeShipSpecs({ ...(canonicalDef?.defaultSpecs ?? {}), ...(ship.specs ?? {}) });
}

function normalizeShipSystemEntries(entries: ShipSystemEntry[] | null | undefined): ShipSystemEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(entry => entry && typeof entry === 'object')
    .map((entry, index) => ({
      id: entry.id || `system-${index}`,
      name: entry.name ?? '',
      quantity: Math.max(1, Number(entry.quantity ?? 1)),
      notes: entry.notes ?? null,
    }));
}

function normalizeShipSoftwareEntries(entries: ShipSoftwareEntry[] | null | undefined): ShipSoftwareEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(entry => entry && typeof entry === 'object')
    .map((entry, index) => ({
      id: entry.id || `software-${index}`,
      name: entry.name ?? '',
      rating: entry.rating == null ? null : Math.max(0, Number(entry.rating)),
      notes: entry.notes ?? null,
    }));
}

function normalizeShipSpecs(specs: ShipSpecs | null | undefined): ShipSpecs {
  if (!specs) return {};
  return {
    ...specs,
    systems: normalizeShipSystemEntries(specs.systems),
    software: normalizeShipSoftwareEntries(specs.software),
  };
}

function normalizeShipDamage(damage: ShipDamageTrackers | null | undefined): ShipDamageTrackers {
  return {
    hull: damage?.hull ?? 0,
    armour: damage?.armour ?? 0,
    critical_hits: damage?.critical_hits ?? 0,
    m_drive: damage?.m_drive ?? 0,
    j_drive: damage?.j_drive ?? 0,
    power_plant: damage?.power_plant ?? 0,
    bridge: damage?.bridge ?? 0,
    sensors: damage?.sensors ?? 0,
    weapons: damage?.weapons ?? 0,
    cargo: damage?.cargo ?? 0,
    notes: damage?.notes ?? null,
  };
}

function normalizeShipAmmo(ammo: ShipAmmoTracker[] | null | undefined): ShipAmmoTracker[] {
  if (!Array.isArray(ammo)) return [];
  return ammo
    .filter(entry => entry && typeof entry === 'object')
    .map((entry, index) => {
      const rawMax = entry.max == null ? null : Number(entry.max);
      const max = rawMax == null || !Number.isFinite(rawMax) ? null : Math.max(0, rawMax);
      const rawCurrent = Number(entry.current ?? max ?? 0);
      const current = Math.max(0, Number.isFinite(rawCurrent) ? rawCurrent : max ?? 0);
      return {
        id: entry.id || `ammo-${index}`,
        name: entry.name?.trim() || 'Ammunition',
        current: max == null ? current : Math.min(current, max),
        max,
        notes: entry.notes ?? null,
      };
    });
}

function identityFormFromShip(ship: Ship | null): ShipIdentityForm {
  return {
    name: ship?.name ?? '',
    ship_class: ship?.ship_class ?? '',
    tonnage: ship?.tonnage == null ? '' : String(ship.tonnage),
    schematic_type: ship?.schematic_type ?? 'custom',
    canonical_id: ship?.canonical_id ?? '',
    image_url: ship?.image_url ?? '',
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCr(value: number | null | undefined) {
  return value == null ? '-' : `Cr ${Math.round(value).toLocaleString()}`;
}

function formatMCr(value: number | null | undefined) {
  return value == null ? '-' : `MCr ${Number(value).toFixed(2)}`;
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

function maxForDamageField(field: { maxSpec?: keyof ShipSpecs; max?: number }, specs: ShipSpecs) {
  if (field.maxSpec) {
    const value = specs[field.maxSpec];
    return typeof value === 'number' && value > 0 ? value : undefined;
  }
  return field.max;
}

function damageTone(value: number, max?: number) {
  if (value <= 0) return 'safe';
  if (max && value >= max) return 'alert';
  return 'amber';
}

function damagePercent(value: number, max?: number) {
  if (!max || max <= 0) return Math.min(100, value > 0 ? 100 : 0);
  return Math.min(100, Math.max(0, (value / max) * 100));
}

function clampDamageValue(value: number, max?: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const upper = max && max > 0 ? max : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(upper, safeValue));
}

function fleetManifestRows(specs: ShipSpecs) {
  return [
    { section: 'Drives', detail: `Jump-${specs.j_drive ?? '-'} / Thrust-${specs.m_drive ?? '-'}`, metric: specs.fuel_tons ? `${specs.fuel_tons}t fuel` : '-' },
    { section: 'Power', detail: specs.power_plant ? `Plant output ${specs.power_plant}` : 'Power plant not recorded', metric: specs.tech_level ? `TL${specs.tech_level}` : '-' },
    { section: 'Bridge', detail: specs.bridge_tons ? `${specs.bridge_tons}t bridge and ship controls` : 'Bridge not recorded', metric: specs.hull_config ?? '-' },
    { section: 'Protection', detail: specs.armour_rating ? `Armour rating ${specs.armour_rating}` : 'Unarmoured or unknown', metric: specs.hull_rating ? `${specs.hull_rating} HP` : '-' },
    { section: 'Weapons', detail: specs.turrets ? `${specs.turrets} turret${specs.turrets === 1 ? '' : 's'} or mount entries` : 'No mounts recorded', metric: specs.turrets ?? '-' },
    { section: 'Crew', detail: specs.crew_notes || 'Crew requirements not recorded', metric: specs.staterooms ? `${specs.staterooms} rooms` : '-' },
    { section: 'Berths', detail: `${specs.low_berths ?? 0} low berths`, metric: specs.cargo_tons ? `${specs.cargo_tons}t cargo` : '-' },
  ];
}

function ShipRecordPanel({
  ship, specs, editable, identityForm, specsForm, onIdentityChange, onSpecsChange,
  onCanonicalChange, onSchematicTypeChange, onUploadImage, onSave, onReset,
}: ShipRecordPanelProps) {
  const hasSpecs = hasSpecValues(specs);
  const identityRows = [
    ['Name', ship.name],
    ['Class', ship.ship_class ?? '-'],
    ['Tonnage', ship.tonnage == null ? '-' : `${ship.tonnage}t`],
    ['Schematic', ship.schematic_type === 'canonical'
      ? CANONICAL_SHIPS.find(c => c.id === ship.canonical_id)?.name ?? ship.canonical_id ?? 'Canonical'
      : ship.image_url ? 'Custom image' : 'Custom record'],
  ];
  const adminRows = [
    ['Maintenance', formatCr(specs.monthly_maintenance_cr)],
    ['Purchase', formatMCr(specs.purchase_price_mcr)],
  ];

  return (
    <div className="border border-steel/50 bg-panel/45">
      <div className="border-b border-steel/40 px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <div className="label">SHIP RECORD</div>
          <div className="text-[10px] text-body/45 font-mono">
            {editable ? 'Editing fleet identity and technical traits' : hasSpecs ? 'Fleet identity and traits' : 'No specs recorded yet'}
          </div>
        </div>
        {editable && (
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={onReset} className="btn-steel text-xs py-1 px-2">RESET</button>
            <button type="button" onClick={onSave} className="btn-amber text-xs py-1 px-2">SAVE SHIP RECORD</button>
          </div>
        )}
      </div>
      {editable ? (
        <div className="grid grid-cols-2 gap-2 p-3 text-xs">
          <label className="space-y-0.5 block col-span-2">
            <span className="text-body/60 font-mono text-[10px] tracking-wider">SHIP NAME</span>
            <input
              aria-label="Ship name"
              className="input py-1 text-xs"
              value={identityForm.name}
              onChange={e => onIdentityChange({ ...identityForm, name: e.target.value })}
            />
          </label>
          <label className="space-y-0.5 block">
            <span className="text-body/60 font-mono text-[10px] tracking-wider">SHIP CLASS</span>
            <input
              aria-label="Ship class"
              className="input py-1 text-xs"
              value={identityForm.ship_class}
              onChange={e => onIdentityChange({ ...identityForm, ship_class: e.target.value })}
            />
          </label>
          <label className="space-y-0.5 block">
            <span className="text-body/60 font-mono text-[10px] tracking-wider">TONNAGE</span>
            <NumberStepper
              ariaLabel="Ship tonnage"
              inputClassName="input py-1 text-xs"
              min={0}
              value={identityForm.tonnage}
              onChange={value => onIdentityChange({ ...identityForm, tonnage: value })}
            />
          </label>
          <label className="space-y-0.5 block">
            <span className="text-body/60 font-mono text-[10px] tracking-wider">SCHEMATIC TYPE</span>
            <select
              aria-label="Schematic type"
              className="input py-1 text-xs"
              value={identityForm.schematic_type}
              onChange={e => onSchematicTypeChange(e.target.value as Ship['schematic_type'])}
            >
              <option value="canonical">Canonical deck</option>
              <option value="custom">Custom image</option>
            </select>
          </label>
          {identityForm.schematic_type === 'canonical' ? (
            <label className="space-y-0.5 block">
              <span className="text-body/60 font-mono text-[10px] tracking-wider">CANONICAL DECK</span>
              <select
                aria-label="Canonical deck"
                className="input py-1 text-xs"
                value={identityForm.canonical_id}
                onChange={e => onCanonicalChange(e.target.value)}
              >
                <option value="">Unassigned</option>
                {CANONICAL_SHIPS.map(shipDef => (
                  <option key={shipDef.id} value={shipDef.id}>{shipDef.ship_class} - {shipDef.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-0.5 block">
              <span className="text-body/60 font-mono text-[10px] tracking-wider">IMAGE URL</span>
              <div className="flex gap-2">
                <input
                  aria-label="Image URL"
                  className="input py-1 text-xs min-w-0"
                  value={identityForm.image_url}
                  onChange={e => onIdentityChange({ ...identityForm, image_url: e.target.value })}
                />
                <button type="button" onClick={onUploadImage} className="btn-steel text-xs py-1 px-2 flex-shrink-0">
                  IMG
                </button>
              </div>
            </label>
          )}
          <div className="col-span-2 border-t border-steel/30 pt-2 mt-1 label">TECHNICAL TRAITS</div>
          {SPECS_FIELDS.map(({ key, label, type }) => (
            <label key={key} className="space-y-0.5 block">
              <span className="text-body/60 font-mono text-[10px] tracking-wider">{label.toUpperCase()}</span>
              {type === 'number' ? (
                <NumberStepper
                  ariaLabel={label}
                  inputClassName="input py-1 text-xs"
                  step={key === 'purchase_price_mcr' ? '0.001' : '1'}
                  value={(specsForm[key] as string | number | null | undefined) ?? ''}
                  onChange={raw => {
                    const val = raw === '' ? null : parseFloat(raw);
                    onSpecsChange({ ...specsForm, [key]: val });
                  }}
                />
              ) : (
                <input
                  className="input py-1 text-xs"
                  type={type}
                  value={(specsForm[key] as string | number | null | undefined) ?? ''}
                  onChange={e => onSpecsChange({ ...specsForm, [key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <label className="space-y-0.5 block col-span-2">
            <span className="text-body/60 font-mono text-[10px] tracking-wider">CREW NOTES</span>
            <input className="input py-1 text-xs" type="text"
              value={specsForm.crew_notes ?? ''}
              onChange={e => onSpecsChange({ ...specsForm, crew_notes: e.target.value || null })}
            />
          </label>
        </div>
      ) : hasSpecs ? (
        <div className="p-3 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {identityRows.map(([label, value]) => (
              <div key={label} className="border-b border-steel/20 pb-1">
                <div className="text-body/45 font-mono text-[10px] tracking-wider">{label.toUpperCase()}</div>
                <div className="text-amber font-mono truncate">{value}</div>
              </div>
            ))}
            {adminRows.map(([label, value]) => (
              <div key={label} className="border-b border-steel/20 pb-1">
                <div className="text-body/45 font-mono text-[10px] tracking-wider">{label.toUpperCase()}</div>
                <div className="text-amber font-mono truncate">{value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 text-xs text-body/55 font-mono">Click the ship row cog to edit this record.</div>
      )}
    </div>
  );
}

function ShipDamagePanel({
  specs, damage, damageInput, onDamageInputChange, onApplyDamage, onAdjust, onReset,
  onNotesChange, onNotesBlur,
}: ShipDamagePanelProps) {
  const normalized = normalizeShipDamage(damage);
  const totalDamage = DAMAGE_FIELDS.reduce((sum, { key }) => sum + Number(normalized[key] ?? 0), 0);

  return (
    <section className="border border-steel/50 bg-panel/45">
      <div className="border-b border-steel/40 px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <div className="label">DAMAGE TRACKERS</div>
          <div className="text-[10px] text-body/45 font-mono">
            {totalDamage > 0 ? `${totalDamage} tracked damage marker${totalDamage === 1 ? '' : 's'}` : 'No damage recorded'}
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] font-mono px-2 py-0.5 border border-alert/60 text-alert hover:border-steel hover:text-body/60 transition-colors flex-shrink-0"
        >
          RESET DAMAGE
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <NumberStepper
            ariaLabel="Hull Damage Input"
            min={1}
            placeholder="Hull damage..."
            value={damageInput}
            onChange={onDamageInputChange}
            onKeyDown={e => { if (e.key === 'Enter') onApplyDamage(); }}
            className="w-36"
            inputClassName="input text-xs py-1"
          />
          <button type="button" onClick={onApplyDamage} className="btn-danger text-xs py-1">APPLY</button>
          <span className="text-body/55 text-[10px] font-mono min-w-40 flex-1">Apply to hull, or adjust systems below</span>
        </div>

        <div className="space-y-2">
          {DAMAGE_FIELDS.map(field => {
            const max = maxForDamageField(field, specs);
            const value = Number(normalized[field.key] ?? 0);
            const tone = damageTone(value, max);
            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono select-none">
                  <span className="text-body/70 flex-1 min-w-0 truncate">{field.label.replace(' Damage', '').toUpperCase()}</span>
                  <button
                    type="button"
                    aria-label={`Decrease ${field.label}`}
                    disabled={value <= 0}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => onAdjust(field.key, -1)}
                    className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-alert hover:text-alert disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <Minus size={8} />
                  </button>
                  <span className={`w-14 text-center ${tone === 'alert' ? 'text-alert' : tone === 'amber' ? 'text-amber' : 'text-safe'}`}>
                    {value}{max ? `/${max}` : ''}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${field.label}`}
                    disabled={max !== undefined && value >= max}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => onAdjust(field.key, 1)}
                    className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-safe hover:text-safe disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <Plus size={8} />
                  </button>
                </div>
                <div className="h-1.5 bg-steel/30 overflow-hidden">
                  <div
                    className={`h-full ${tone === 'alert' ? 'bg-alert' : tone === 'amber' ? 'bg-amber' : 'bg-safe/70'}`}
                    style={{ width: `${damagePercent(value, max)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <label className="space-y-1 block pt-2">
          <span className="text-body/60 font-mono text-[10px] tracking-wider">DAMAGE NOTES</span>
          <textarea
            aria-label="Damage Notes"
            className="input min-h-20 resize-y text-xs"
            value={normalized.notes ?? ''}
            onChange={e => onNotesChange(e.target.value)}
            onBlur={e => onNotesBlur(e.target.value)}
          />
        </label>
        <div className="text-[10px] text-body/55 font-mono">
          Reset clears all tracked ship damage and damage notes.
        </div>
      </div>
    </section>
  );
}

function ShipAmmoPanel({
  ammo, onReset, onAdd, onRemove, onAdjust, onFieldChange,
}: ShipAmmoPanelProps) {
  const totalCurrent = ammo.reduce((sum, entry) => sum + entry.current, 0);
  const totalMax = ammo.reduce((sum, entry) => sum + Number(entry.max ?? 0), 0);

  return (
    <section className="border border-steel/50 bg-panel/45">
      <div className="border-b border-steel/40 px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <div className="label">AMMUNITION</div>
          <div className="text-[10px] text-body/45 font-mono">
            {ammo.length > 0 ? `${totalCurrent}${totalMax > 0 ? `/${totalMax}` : ''} rounds across ${ammo.length} tracker${ammo.length === 1 ? '' : 's'}` : 'No ammunition tracked'}
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] font-mono px-2 py-0.5 border border-cyan-dim text-cyan-trav hover:border-steel hover:text-body/60 transition-colors flex-shrink-0"
        >
          RESET AMMO
        </button>
      </div>
      <div className="p-3 space-y-3">
        <button type="button" onClick={onAdd} className="btn-steel text-xs py-1 px-2 inline-flex items-center gap-1">
          <Plus size={10} /> ADD AMMO
        </button>
        {ammo.length > 0 ? (
          <div className="space-y-2">
            {ammo.map((entry, index) => {
              const max = entry.max == null ? undefined : entry.max;
              const spent = max == null ? false : entry.current <= Math.max(0, Math.floor(max / 4));
              return (
                <div key={entry.id} className="border border-steel/40 bg-void/50 p-2 space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_1.5rem] gap-2">
                    <input
                      aria-label={`Ammo name ${index + 1}`}
                      className="input py-1 text-xs"
                      value={entry.name}
                      onChange={e => onFieldChange(entry.id, { name: e.target.value })}
                    />
                    <NumberStepper
                      ariaLabel={`Ammo current ${index + 1}`}
                      inputClassName="input py-1 text-xs"
                      min={0}
                      max={max}
                      value={entry.current}
                      onChange={value => {
                        if (value === '') return;
                        onFieldChange(entry.id, { current: Math.max(0, parseInt(value, 10)) });
                      }}
                    />
                    <NumberStepper
                      ariaLabel={`Ammo maximum ${index + 1}`}
                      inputClassName="input py-1 text-xs"
                      min={0}
                      value={entry.max ?? ''}
                      onChange={value => onFieldChange(entry.id, { max: value === '' ? null : Math.max(0, parseInt(value, 10)) })}
                    />
                    <button
                      type="button"
                      aria-label={`Remove ammo ${entry.name || index + 1}`}
                      onClick={() => onRemove(entry.id)}
                      className="border border-steel/50 text-body/60 hover:border-alert hover:text-alert flex items-center justify-center"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono select-none">
                    <button
                      type="button"
                      aria-label={`Decrease ${entry.name} ammunition`}
                      disabled={entry.current <= 0}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => onAdjust(entry.id, -1)}
                      className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-alert hover:text-alert disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Minus size={8} />
                    </button>
                    <span className={`w-16 text-center ${spent ? 'text-amber' : 'text-cyan-trav'}`}>
                      {entry.current}{max == null ? '' : `/${max}`}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${entry.name} ammunition`}
                      disabled={max !== undefined && entry.current >= max}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => onAdjust(entry.id, 1)}
                      className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-safe hover:text-safe disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Plus size={8} />
                    </button>
                    <input
                      aria-label={`Ammo notes ${index + 1}`}
                      className="input py-1 text-xs flex-1"
                      placeholder="Magazine, rack, bay..."
                      value={entry.notes ?? ''}
                      onChange={e => onFieldChange(entry.id, { notes: e.target.value || null })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-body/55 font-mono border border-dashed border-steel/30 p-3">
            Add a magazine, missile rack, sandcaster bin, or other expendable store.
          </div>
        )}
      </div>
    </section>
  );
}

function ShipManifestPanel({ specs, editable, specsForm, onSpecsChange }: ShipManifestPanelProps) {
  const activeSpecs = editable ? normalizeShipSpecs(specsForm) : normalizeShipSpecs(specs);
  const systems = normalizeShipSystemEntries(activeSpecs.systems);
  const software = normalizeShipSoftwareEntries(activeSpecs.software);
  const manifestRows = fleetManifestRows(activeSpecs);

  function updateSystems(nextSystems: ShipSystemEntry[]) {
    onSpecsChange({ ...activeSpecs, systems: nextSystems });
  }

  function updateSoftware(nextSoftware: ShipSoftwareEntry[]) {
    onSpecsChange({ ...activeSpecs, software: nextSoftware });
  }

  function addSystem() {
    const preset = OPTIONAL_SYSTEMS.find(system => !systems.some(entry => entry.name === system.name)) ?? OPTIONAL_SYSTEMS[0];
    updateSystems([...systems, {
      id: uuid(),
      name: preset?.name ?? 'New System',
      quantity: 1,
      notes: preset?.notes ?? null,
    }]);
  }

  function addSoftware() {
    const preset = SOFTWARE.find(program => !software.some(entry => entry.name === program.name.replace('/N', ''))) ?? SOFTWARE[0];
    updateSoftware([...software, {
      id: uuid(),
      name: preset?.name.replace('/N', '') ?? 'New Software',
      rating: preset?.name.includes('/N') ? 1 : null,
      notes: preset?.notes ?? null,
    }]);
  }

  return (
    <section className="border border-steel/50 bg-panel/35">
      <div className="border-b border-steel/40 px-3 py-2 flex items-center justify-between gap-3">
        <div>
          <div className="label">SYSTEMS MANIFEST</div>
          <div className="text-[10px] text-body/45 font-mono">
            Core capabilities, installed systems, and software loadout
          </div>
        </div>
        {editable && (
          <div className="flex gap-2">
            <button type="button" onClick={addSystem} className="btn-steel text-xs py-1 px-2 inline-flex items-center gap-1">
              <Plus size={10} /> ADD SYSTEM
            </button>
            <button type="button" onClick={addSoftware} className="btn-steel text-xs py-1 px-2 inline-flex items-center gap-1">
              <Plus size={10} /> ADD SOFTWARE
            </button>
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {manifestRows.map(row => (
            <div key={row.section} className="border border-steel/30 bg-void/45 px-3 py-2 text-xs min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div className="text-amber font-mono tracking-wider">{row.section}</div>
                <div className="text-cyan-trav font-mono text-right">{row.metric}</div>
              </div>
              <div className="text-body/70 min-w-0 break-words mt-1 leading-5">{row.detail}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="border border-steel/30 bg-void/35">
            <div className="border-b border-steel/25 px-3 py-2 label text-cyan-trav/80">ADDITIONAL SYSTEMS</div>
            {editable ? (
              <div className="p-3 space-y-2">
                <datalist id="ship-system-presets">
                  {OPTIONAL_SYSTEMS.map(system => <option key={system.id} value={system.name} />)}
                </datalist>
                {systems.length > 0 ? systems.map((entry, index) => (
                  <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_7.5rem_1.5rem] gap-2">
                    <input
                      aria-label={`System name ${index + 1}`}
                      className="input py-1 text-xs"
                      list="ship-system-presets"
                      value={entry.name}
                      onChange={e => updateSystems(systems.map(system => system.id === entry.id ? { ...system, name: e.target.value } : system))}
                    />
                    <NumberStepper
                      ariaLabel={`System quantity ${index + 1}`}
                      inputClassName="input py-1 text-xs"
                      min={1}
                      value={entry.quantity ?? 1}
                      onChange={value => updateSystems(systems.map(system => system.id === entry.id ? { ...system, quantity: Math.max(1, parseInt(value || '1', 10)) } : system))}
                    />
                    <button
                      type="button"
                      aria-label={`Remove system ${entry.name || index + 1}`}
                      onClick={() => updateSystems(systems.filter(system => system.id !== entry.id))}
                      className="border border-steel/50 text-body/60 hover:border-alert hover:text-alert flex items-center justify-center"
                    >
                      <Trash2 size={10} />
                    </button>
                    <input
                      aria-label={`System notes ${index + 1}`}
                      className="input py-1 text-xs col-span-3"
                      placeholder="Notes..."
                      value={entry.notes ?? ''}
                      onChange={e => updateSystems(systems.map(system => system.id === entry.id ? { ...system, notes: e.target.value || null } : system))}
                    />
                  </div>
                )) : (
                  <div className="text-xs text-body/55 font-mono border border-dashed border-steel/30 p-3">No additional systems recorded.</div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-steel/20">
                {systems.length > 0 ? systems.map(entry => (
                  <div key={entry.id} className="px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-amber font-mono">{entry.name}</span>
                      <span className="text-cyan-trav font-mono">x{entry.quantity ?? 1}</span>
                    </div>
                    {entry.notes && <div className="text-body/60 mt-1 leading-5">{entry.notes}</div>}
                  </div>
                )) : (
                  <div className="p-3 text-xs text-body/55 font-mono">No additional systems recorded.</div>
                )}
              </div>
            )}
          </div>

          <div className="border border-steel/30 bg-void/35">
            <div className="border-b border-steel/25 px-3 py-2 label text-cyan-trav/80">SOFTWARE</div>
            {editable ? (
              <div className="p-3 space-y-2">
                <datalist id="ship-software-presets">
                  {SOFTWARE.map(program => <option key={program.id} value={program.name.replace('/N', '')} />)}
                </datalist>
                {software.length > 0 ? software.map((entry, index) => (
                  <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_7.5rem_1.5rem] gap-2">
                    <input
                      aria-label={`Software name ${index + 1}`}
                      className="input py-1 text-xs"
                      list="ship-software-presets"
                      value={entry.name}
                      onChange={e => updateSoftware(software.map(program => program.id === entry.id ? { ...program, name: e.target.value } : program))}
                    />
                    <NumberStepper
                      ariaLabel={`Software rating ${index + 1}`}
                      inputClassName="input py-1 text-xs"
                      min={0}
                      value={entry.rating ?? ''}
                      onChange={value => updateSoftware(software.map(program => program.id === entry.id ? { ...program, rating: value === '' ? null : Math.max(0, parseInt(value, 10)) } : program))}
                    />
                    <button
                      type="button"
                      aria-label={`Remove software ${entry.name || index + 1}`}
                      onClick={() => updateSoftware(software.filter(program => program.id !== entry.id))}
                      className="border border-steel/50 text-body/60 hover:border-alert hover:text-alert flex items-center justify-center"
                    >
                      <Trash2 size={10} />
                    </button>
                    <input
                      aria-label={`Software notes ${index + 1}`}
                      className="input py-1 text-xs col-span-3"
                      placeholder="Notes..."
                      value={entry.notes ?? ''}
                      onChange={e => updateSoftware(software.map(program => program.id === entry.id ? { ...program, notes: e.target.value || null } : program))}
                    />
                  </div>
                )) : (
                  <div className="text-xs text-body/55 font-mono border border-dashed border-steel/30 p-3">No software recorded.</div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-steel/20">
                {software.length > 0 ? software.map(entry => (
                  <div key={entry.id} className="px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-amber font-mono">{entry.name}{entry.rating == null ? '' : `/${entry.rating}`}</span>
                      <span className="text-cyan-trav font-mono">ACTIVE</span>
                    </div>
                    {entry.notes && <div className="text-body/60 mt-1 leading-5">{entry.notes}</div>}
                  </div>
                )) : (
                  <div className="p-3 text-xs text-body/55 font-mono">No software recorded.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ShipViewer() {
  const { client } = useSupabase();
  const [ships, setShips] = useState<Ship[]>([]);
  const [selected, setSelected] = useState<Ship | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [specsForm, setSpecsForm] = useState<ShipSpecs>({});
  const [damageForm, setDamageForm] = useState<ShipDamageTrackers>(normalizeShipDamage(null));
  const [damageInput, setDamageInput] = useState('');
  const [ammoForm, setAmmoForm] = useState<ShipAmmoTracker[]>([]);
  const [identityForm, setIdentityForm] = useState<ShipIdentityForm>(identityFormFromShip(null));
  const [editingRecord, setEditingRecord] = useState(false);
  const schematicRef = useRef<HTMLDivElement>(null);
  const replaceImageRef = useRef<HTMLInputElement>(null);
  const ammoFormRef = useRef<ShipAmmoTracker[]>([]);
  const selectedShipId = selected?.id ?? null;
  const selectedShipDamage = selected?.damage;
  const selectedShipAmmo = selected?.ammo;

  const loadShips = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client.from('ships').select('*').order('created_at');
    if (error) {
      setErrorMessage(`Ships could not be loaded: ${error.message}`);
      return;
    }

    const loaded = sortShips((data ?? []) as Ship[]);
    setShips(loaded);
    setSelected(current => {
      const currentShip = current ? loaded.find(ship => ship.id === current.id) : null;
      return currentShip ?? loaded[0] ?? null;
    });
  }, [client]);

  useEffect(() => {
    loadShips();
    if (!client) return;
    const channel = client
      .channel('ships-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ships' }, loadShips)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, loadShips]);

  function updateShipInState(updatedShip: Ship) {
    setShips(current => sortShips(current.map(ship => ship.id === updatedShip.id ? updatedShip : ship)));
    setSelected(current => current?.id === updatedShip.id ? updatedShip : current);
  }

  function selectShip(ship: Ship) {
    setSelected(ship);
    setAnnotating(false);
    setPendingPos(null);
    setSelectedAnnotationId(null);
    setEditingRecord(false);
    setDamageInput('');
  }

  function startEditShip(ship: Ship) {
    setSelected(ship);
    setAnnotating(false);
    setPendingPos(null);
    setSelectedAnnotationId(null);
    setEditingRecord(true);
    setIdentityForm(identityFormFromShip(ship));
    setSpecsForm(effectiveShipSpecs(ship));
    setDamageForm(normalizeShipDamage(ship.damage));
    setDamageInput('');
  }

  useEffect(() => {
    if (!editingRecord) {
      setIdentityForm(identityFormFromShip(selected));
      setSpecsForm(effectiveShipSpecs(selected));
    }
  }, [selected, editingRecord]);

  useEffect(() => {
    const normalized = normalizeShipDamage(selectedShipDamage);
    setDamageForm(normalized);
    setDamageInput('');
  }, [selectedShipId, selectedShipDamage]);

  useEffect(() => {
    const normalized = normalizeShipAmmo(selectedShipAmmo);
    ammoFormRef.current = normalized;
    setAmmoForm(normalized);
  }, [selectedShipId, selectedShipAmmo]);

  async function deleteShip(id: string) {
    if (!client || !confirm('Delete this ship entry?')) return;
    const previousShips = ships;
    const previousSelected = selected;
    const nextShips = ships.filter(ship => ship.id !== id);
    setShips(nextShips);
    if (selected?.id === id) setSelected(nextShips[0] ?? null);

    const { error } = await client.from('ships').delete().eq('id', id);
    if (error) {
      setShips(previousShips);
      setSelected(previousSelected);
      setErrorMessage(`Ship could not be deleted: ${error.message}`);
    }
  }

  function handleSchematicClick(e: React.MouseEvent) {
    if (!editingRecord || !annotating || !schematicRef.current) return;
    const rect = schematicRef.current.getBoundingClientRect();
    setPendingPos(annotationPosition(e.clientX, e.clientY, rect));
    setSelectedAnnotationId(null);
  }

  async function saveAnnotation() {
    if (!editingRecord || !client || !selected || !pendingPos || !newLabel.trim()) return;
    const annotation: Annotation = { id: uuid(), x: pendingPos.x, y: pendingPos.y, label: newLabel.trim() };
    const updated = [...(selected.annotations || []), annotation];
    const updatedShip = { ...selected, annotations: updated };
    updateShipInState(updatedShip);
    setPendingPos(null);
    setNewLabel('');

    const { error } = await client.from('ships').update({ annotations: updated }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Annotation could not be saved: ${error.message}`);
      loadShips();
    }
  }

  async function removeAnnotation(annotationId: string) {
    if (!editingRecord || !client || !selected) return;
    const updated = removeAnnotationById(selected.annotations || [], annotationId);
    const updatedShip = { ...selected, annotations: updated };
    updateShipInState(updatedShip);
    setSelectedAnnotationId(null);

    const { error } = await client.from('ships').update({ annotations: updated }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Annotation could not be removed: ${error.message}`);
      loadShips();
    }
  }

  function updateSelectedNotes(notes: string) {
    if (!editingRecord || !selected) return;
    updateShipInState({ ...selected, notes });
  }

  async function saveNotes() {
    if (!editingRecord || !client || !selected) return;
    const notes = selected.notes?.trim() ? selected.notes : null;
    const { error } = await client.from('ships').update({ notes }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship notes could not be saved: ${error.message}`);
      loadShips();
    }
  }

  function handleSchematicTypeChange(type: Ship['schematic_type']) {
    if (type === 'canonical') {
      const canonicalId = identityForm.canonical_id || CANONICAL_SHIPS[0]?.id || '';
      const def = CANONICAL_SHIPS.find(c => c.id === canonicalId);
      setIdentityForm({
        ...identityForm,
        schematic_type: 'canonical',
        canonical_id: canonicalId,
        image_url: '',
        ship_class: def?.ship_class ?? identityForm.ship_class,
        tonnage: def ? String(def.tonnage) : identityForm.tonnage,
      });
      if (def?.defaultSpecs) setSpecsForm({ ...def.defaultSpecs });
      return;
    }

    setIdentityForm({
      ...identityForm,
      schematic_type: 'custom',
      canonical_id: '',
    });
  }

  function handleCanonicalChange(canonicalId: string) {
    const def = CANONICAL_SHIPS.find(c => c.id === canonicalId);
    setIdentityForm({
      ...identityForm,
      canonical_id: canonicalId,
      ship_class: def?.ship_class ?? identityForm.ship_class,
      tonnage: def ? String(def.tonnage) : identityForm.tonnage,
    });
    if (def?.defaultSpecs) setSpecsForm({ ...def.defaultSpecs });
  }

  async function saveShipRecord() {
    if (!editingRecord || !client || !selected) return;
    const name = identityForm.name.trim();
    if (!name) {
      setErrorMessage('Ship name is required.');
      return;
    }

    const schematicType = identityForm.schematic_type;
    const normalizedSpecs = normalizeShipSpecs(specsForm);
    const specs = hasSpecValues(normalizedSpecs) ? normalizedSpecs : null;
    const payload = {
      name,
      ship_class: identityForm.ship_class.trim() || null,
      tonnage: parseOptionalNumber(identityForm.tonnage),
      schematic_type: schematicType,
      canonical_id: schematicType === 'canonical' ? identityForm.canonical_id || null : null,
      image_url: schematicType === 'custom' ? identityForm.image_url.trim() || null : null,
      specs,
    };

    updateShipInState({ ...selected, ...payload });
    const { error } = await client.from('ships').update(payload).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship record could not be saved: ${error.message}`);
      loadShips();
      return;
    }

    setErrorMessage(null);
  }

  async function persistDamage(nextDamage: ShipDamageTrackers) {
    if (!client || !selected) return;
    const normalized = normalizeShipDamage(nextDamage);
    const damage = hasDamageValues(normalized) ? normalized : {};
    setDamageForm(normalized);
    updateShipInState({ ...selected, damage });
    const { error } = await client.from('ships').update({ damage }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship damage could not be saved: ${error.message}`);
      loadShips();
    }
  }

  function resetDamageTracker() {
    setDamageInput('');
    persistDamage(normalizeShipDamage(null));
  }

  function adjustDamageField(key: ShipDamageNumberKey, delta: number) {
    const field = DAMAGE_FIELDS.find(candidate => candidate.key === key);
    const max = field ? maxForDamageField(field, effectiveShipSpecs(selected)) : undefined;
    const current = Number(damageForm[key] ?? 0);
    persistDamage({
      ...damageForm,
      [key]: clampDamageValue(current + delta, max),
    });
  }

  function applyHullDamage() {
    const amount = parseInt(damageInput, 10);
    if (!amount || amount <= 0) {
      setDamageInput('');
      return;
    }

    const hullField = DAMAGE_FIELDS.find(field => field.key === 'hull');
    const max = hullField ? maxForDamageField(hullField, effectiveShipSpecs(selected)) : undefined;
    const current = Number(damageForm.hull ?? 0);
    persistDamage({
      ...damageForm,
      hull: clampDamageValue(current + amount, max),
    });
    setDamageInput('');
  }

  function updateDamageNotes(notes: string) {
    setDamageForm(current => ({ ...current, notes: notes || null }));
  }

  function saveDamageNotes(notes: string) {
    persistDamage({ ...damageForm, notes: notes.trim() ? notes : null });
  }

  async function persistAmmo(nextAmmo: ShipAmmoTracker[]) {
    if (!client || !selected) return;
    const ammo = normalizeShipAmmo(nextAmmo);
    ammoFormRef.current = ammo;
    setAmmoForm(ammo);
    updateShipInState({ ...selected, ammo });
    const { error } = await client.from('ships').update({ ammo }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship ammunition could not be saved: ${error.message}`);
      loadShips();
    }
  }

  function resetAmmoTracker() {
    persistAmmo([]);
  }

  function addAmmoTracker() {
    persistAmmo([...ammoFormRef.current, { id: uuid(), name: 'Missiles', current: 12, max: 12, notes: null }]);
  }

  function removeAmmoTracker(id: string) {
    persistAmmo(ammoFormRef.current.filter(entry => entry.id !== id));
  }

  function updateAmmoField(id: string, patch: Partial<ShipAmmoTracker>) {
    const nextAmmo = normalizeShipAmmo(ammoFormRef.current.map(entry => {
      if (entry.id !== id) return entry;
      const next = { ...entry, ...patch };
      const rawMax = next.max == null ? null : Number(next.max);
      const max = rawMax == null || !Number.isFinite(rawMax) ? null : Math.max(0, rawMax);
      const rawCurrent = Number(next.current ?? 0);
      const currentValue = Math.max(0, Number.isFinite(rawCurrent) ? rawCurrent : 0);
      return {
        ...next,
        max,
        current: max == null ? currentValue : Math.min(currentValue, max),
      };
    }));
    persistAmmo(nextAmmo);
  }

  function adjustAmmoTracker(id: string, delta: number) {
    const nextAmmo = ammoFormRef.current.map(entry => {
      if (entry.id !== id) return entry;
      const max = entry.max == null ? undefined : entry.max;
      return {
        ...entry,
        current: clampDamageValue(entry.current + delta, max),
      };
    });
    persistAmmo(nextAmmo);
  }

  async function handleReplaceImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!editingRecord || !file || !client || !selected) return;
    e.target.value = '';
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const bucket = client.storage.from('ship-schematics');
    const { error } = await bucket.upload(path, file, { contentType: file.type });
    if (error) {
      setErrorMessage(`Image upload failed: ${error.message}`);
      return;
    }
    const { data: urlData } = bucket.getPublicUrl(path);
    const { error: updateError } = await client.from('ships').update({ image_url: urlData.publicUrl }).eq('id', selected.id);
    if (updateError) {
      setErrorMessage(`Image update failed: ${updateError.message}`);
      return;
    }
    updateShipInState({ ...selected, image_url: urlData.publicUrl });
    setIdentityForm(current => ({ ...current, image_url: urlData.publicUrl, schematic_type: 'custom' }));
    setErrorMessage(null);
  }

  function renderAnnotations() {
    return (selected?.annotations || []).map(ann => {
      const isSelected = selectedAnnotationId === ann.id;

      return (
        <div
          key={ann.id}
          className="absolute group z-10"
          style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          <button
            type="button"
            aria-label={`Annotation ${ann.label}`}
            title={ann.label}
            onClick={e => {
              e.stopPropagation();
              setSelectedAnnotationId(current => current === ann.id ? null : ann.id);
            }}
            className={`block h-3 w-3 rounded-full border border-void shadow shadow-black/40 transition-colors ${
              isSelected ? 'bg-cyan-trav ring-2 ring-cyan-trav/40' : 'bg-amber hover:bg-amber-bright'
            }`}
          />
          <div
            className={`absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap border bg-void/95 px-2 py-1 text-xs font-mono shadow-lg transition-opacity ${
              isSelected
                ? 'border-cyan-trav text-cyan-trav opacity-100'
                : 'border-amber/70 text-amber opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
            }`}
          >
            <span>{ann.label}</span>
            {editingRecord && isSelected && (
              <button
                type="button"
                aria-label={`Delete annotation ${ann.label}`}
                onClick={e => {
                  e.stopPropagation();
                  removeAnnotation(ann.id);
                }}
                className="ml-2 align-middle text-alert/80 hover:text-alert"
              >
                <X size={9} />
              </button>
            )}
          </div>
        </div>
      );
    });
  }

  const selectedSpecs = effectiveShipSpecs(selected);
  const selectedDamage = normalizeShipDamage(selected?.damage);
  const selectedAmmo = normalizeShipAmmo(selected?.ammo);
  const selectedCanonical = selected?.canonical_id ? CANONICAL_SHIPS.find(c => c.id === selected.canonical_id) : null;
  const hullDamage = Number(selectedDamage.hull ?? 0);
  const hullRating = typeof selectedSpecs.hull_rating === 'number' ? selectedSpecs.hull_rating : undefined;
  const damageTotal = DAMAGE_FIELDS.reduce((sum, { key }) => sum + Number(selectedDamage[key] ?? 0), 0);
  const displayedAmmo = ammoForm.length > 0 ? ammoForm : selectedAmmo;
  const ammoCurrent = displayedAmmo.reduce((sum, entry) => sum + entry.current, 0);
  const ammoMax = displayedAmmo.reduce((sum, entry) => sum + Number(entry.max ?? 0), 0);

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 max-h-72 md:max-h-none flex-shrink-0 border-b md:border-b-0 md:border-r border-steel flex flex-col bg-panel">
        <div className="panel-header flex items-center justify-between">
          <span>SHIPS</span>
        </div>

        {/* Ship list */}
        <ul className="flex-1 overflow-y-auto">
          {ships.map(ship => (
            <li key={ship.id}>
              <div
                className={`w-full text-left px-3 py-2.5 border-b border-steel/30 flex items-center justify-between group transition-colors ${
                  selected?.id === ship.id ? 'bg-steel/30 text-amber' : 'text-body hover:bg-steel/20 hover:text-bright'
                }`}
              >
                <button
                  onClick={() => selectShip(ship)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="text-xs font-mono">{ship.name}</div>
                  <div className="text-[10px] text-body/60 mt-0.5">
                    {ship.schematic_type === 'canonical' ? `${ship.ship_class} · ${ship.tonnage}t` : 'Custom'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => startEditShip(ship)}
                  className="text-body/45 hover:text-amber focus:text-amber transition-all pl-3"
                  aria-label={`Edit ${ship.name} ship`}
                  title="Edit ship"
                >
                  <Settings size={12} />
                </button>
                <button
                  onClick={() => deleteShip(ship.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-alert/60 hover:text-alert transition-all pl-3"
                  aria-label={`Delete ${ship.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
          {ships.length === 0 && (
            <li className="px-4 py-6 text-center text-body/65 text-xs">
              No ships in the fleet.<br />Add ships from the Shipyard.
            </li>
          )}
        </ul>
      </aside>

      {/* Main schematic area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {errorMessage && (
          <div role="alert" className="border-b border-alert/40 bg-alert/10 px-4 py-2 text-xs text-alert flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss ship error" className="hover:text-bright">
              <X size={12} />
            </button>
          </div>
        )}

        {selected ? (
          <>
            <div className="flex items-start gap-3 px-4 py-3 border-b border-steel/50 flex-shrink-0 bg-panel/70">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-cyan-trav tracking-[0.25em] font-mono">
                  FLEET SHIP <span className={editingRecord ? 'text-amber' : 'text-body/45'}>{editingRecord ? 'EDITING' : 'LOCKED'}</span>
                </div>
                <div className="text-bright font-display text-xl tracking-wide truncate">{selected.name}</div>
                <div className="text-xs text-body/60 font-mono mt-0.5">
                  {selected.ship_class ?? selectedCanonical?.ship_class ?? (selected.schematic_type === 'canonical' ? 'Canonical' : 'Custom')}
                  {' · '}{selected.tonnage ?? '?'}t
                  {selectedSpecs.j_drive ? ` · J${selectedSpecs.j_drive}` : ''}{selectedSpecs.m_drive ? `/M${selectedSpecs.m_drive}` : ''}
                  {selectedSpecs.purchase_price_mcr ? ` · ${formatMCr(selectedSpecs.purchase_price_mcr)}` : ''}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 flex-wrap">
                {editingRecord && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRecord(false);
                      setAnnotating(false);
                      setPendingPos(null);
                      setSelectedAnnotationId(null);
                    }}
                    className="btn-amber text-xs flex items-center gap-1"
                  >
                    DONE
                  </button>
                )}
                {editingRecord && selected.schematic_type === 'custom' && (
                  <>
                    <button
                      onClick={() => replaceImageRef.current?.click()}
                      className="btn-steel text-xs flex items-center gap-1"
                      title="Replace schematic image"
                    >
                      <Upload size={11} /> IMAGE
                    </button>
                  </>
                )}
                {editingRecord && (
                  <button
                    onClick={() => { setAnnotating(v => !v); setPendingPos(null); setSelectedAnnotationId(null); }}
                    className={`btn text-xs flex items-center gap-1 ${annotating ? 'btn-amber' : 'btn-steel'}`}
                  >
                    <Tag size={11} />
                    {annotating ? 'STOP LABELLING' : 'LABEL'}
                  </button>
                )}
              </div>
            </div>

            {editingRecord && annotating && !pendingPos && (
              <div className="bg-amber/10 border-b border-amber/30 px-4 py-2 text-xs text-amber">
                Click anywhere on the schematic to add a label.
              </div>
            )}

            {/* Pending annotation form */}
            {editingRecord && pendingPos && (
              <div className="bg-panel border-b border-steel px-4 py-2 flex items-center gap-3">
                <input
                  autoFocus
                  className="input text-xs py-1 flex-1"
                  placeholder="Label text..."
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveAnnotation(); if (e.key === 'Escape') setPendingPos(null); }}
                />
                <button onClick={saveAnnotation} className="btn-amber text-xs">SAVE</button>
                <button onClick={() => setPendingPos(null)} className="btn-steel text-xs">CANCEL</button>
              </div>
            )}

            {/* Ship record + schematic */}
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 max-w-7xl mx-auto mb-4">
                <Readout
                  label="HULL"
                  value={selected.tonnage ? `${selected.tonnage}t` : '-'}
                  sub={`${selectedSpecs.hull_config ?? 'Hull'}${hullRating ? `, ${hullRating} HP` : ''}`}
                  tone="cyan"
                />
                <Readout
                  label="DRIVES"
                  value={`J${selectedSpecs.j_drive ?? '-'}/M${selectedSpecs.m_drive ?? '-'}`}
                  sub={selected.ship_class ?? selectedCanonical?.ship_class ?? 'Fleet record'}
                  tone="amber"
                />
                <Readout
                  label="FUEL"
                  value={selectedSpecs.fuel_tons ? `${selectedSpecs.fuel_tons}t` : '-'}
                  sub={selectedSpecs.power_plant ? `Power ${selectedSpecs.power_plant}` : 'Power not recorded'}
                  tone="cyan"
                />
                <Readout
                  label="CARGO"
                  value={selectedSpecs.cargo_tons ? `${selectedSpecs.cargo_tons}t` : '-'}
                  sub={selectedSpecs.staterooms ? `${selectedSpecs.staterooms} staterooms` : 'Quarters not recorded'}
                  tone="cyan"
                />
                <Readout
                  label="HULL DAMAGE"
                  value={hullRating ? `${hullDamage}/${hullRating}` : String(hullDamage)}
                  sub={`${damageTotal} total markers`}
                  tone={damageTotal > 0 ? 'amber' : 'safe'}
                />
                <Readout
                  label="AMMO"
                  value={ammoMax > 0 ? `${ammoCurrent}/${ammoMax}` : ammoCurrent || '-'}
                  sub={displayedAmmo.length > 0 ? `${displayedAmmo.length} tracker${displayedAmmo.length === 1 ? '' : 's'}` : 'No bins'}
                  tone={ammoCurrent > 0 ? 'cyan' : 'amber'}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_27rem] gap-4 max-w-7xl mx-auto">
                <div className="space-y-4 min-w-0">
                  <section className="border border-cyan-trav/25 bg-panel/30 min-h-[24rem] flex flex-col">
                    <div className="border-b border-cyan-trav/20 px-3 py-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="label text-cyan-trav">ANNOTATABLE SCHEMATIC</div>
                        <div className="text-[10px] text-body/45 font-mono">
                          {selected.schematic_type === 'canonical'
                            ? `${selected.ship_class ?? selectedCanonical?.ship_class ?? 'Canonical'} · ${(selectedCanonical?.name ?? selected.canonical_id ?? 'Unassigned').toUpperCase()}`
                            : 'CUSTOM SHIP RECORD'}
                        </div>
                      </div>
                      <div className="text-[10px] text-body/45 font-mono">
                        {(selected.annotations ?? []).length} label{(selected.annotations ?? []).length === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div className="flex-1 min-h-80 overflow-auto p-4 flex items-start justify-center">
                      {selected.schematic_type === 'canonical' && selectedCanonical ? (
                        <div
                          ref={schematicRef}
                          className={`relative w-full max-w-5xl border border-steel bg-void ${editingRecord && annotating ? 'cursor-crosshair' : ''}`}
                          onClick={handleSchematicClick}
                        >
                          <selectedCanonical.Component />
                          {renderAnnotations()}
                        </div>
                      ) : selected.image_url ? (
                        <div
                          ref={schematicRef}
                          className={`relative inline-block max-w-full border border-steel bg-void ${editingRecord && annotating ? 'cursor-crosshair' : ''}`}
                          onClick={handleSchematicClick}
                        >
                          <img
                            src={selected.image_url}
                            alt={selected.name}
                            className="block max-w-full"
                          />
                          {renderAnnotations()}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-72 w-full text-body/65 text-sm border border-steel bg-void">
                          No schematic image available.
                        </div>
                      )}
                    </div>
                  </section>

                  <ShipManifestPanel
                    specs={selectedSpecs}
                    editable={editingRecord}
                    specsForm={specsForm}
                    onSpecsChange={setSpecsForm}
                  />
                  <section className="border border-steel/50 bg-panel/45">
                    <div className="border-b border-steel/40 px-3 py-2 label">SHIP NOTES</div>
                    {editingRecord ? (
                      <div className="p-3">
                        <textarea
                          id="ship-notes"
                          aria-label="Ship Notes"
                          className="input min-h-36 resize-y"
                          value={selected.notes ?? ''}
                          onChange={e => updateSelectedNotes(e.target.value)}
                          onBlur={saveNotes}
                        />
                      </div>
                    ) : (
                      <div className="p-3 min-h-28 text-xs text-body/70 leading-5 whitespace-pre-wrap">
                        {selected.notes || 'No notes recorded.'}
                      </div>
                    )}
                  </section>
                </div>

                <aside className="space-y-3">
                  <ShipRecordPanel
                    ship={selected}
                    specs={selectedSpecs}
                    editable={editingRecord}
                    identityForm={identityForm}
                    specsForm={specsForm}
                    onIdentityChange={setIdentityForm}
                    onSpecsChange={setSpecsForm}
                    onCanonicalChange={handleCanonicalChange}
                    onSchematicTypeChange={handleSchematicTypeChange}
                    onUploadImage={() => replaceImageRef.current?.click()}
                    onSave={saveShipRecord}
                    onReset={() => {
                      setIdentityForm(identityFormFromShip(selected));
                      setSpecsForm(effectiveShipSpecs(selected));
                    }}
                  />
                  <ShipAmmoPanel
                    ammo={ammoForm}
                    onReset={resetAmmoTracker}
                    onAdd={addAmmoTracker}
                    onRemove={removeAmmoTracker}
                    onAdjust={adjustAmmoTracker}
                    onFieldChange={updateAmmoField}
                  />
                  <ShipDamagePanel
                    specs={selectedSpecs}
                    damage={damageForm}
                    damageInput={damageInput}
                    onDamageInputChange={setDamageInput}
                    onApplyDamage={applyHullDamage}
                    onAdjust={adjustDamageField}
                    onReset={resetDamageTracker}
                    onNotesChange={updateDamageNotes}
                    onNotesBlur={saveDamageNotes}
                  />
                </aside>
              </div>
              <input ref={replaceImageRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceImage} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-body/65 space-y-2">
              <div className="text-4xl opacity-20">◈</div>
              <div className="text-sm font-mono">Select a ship to view its schematic.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
