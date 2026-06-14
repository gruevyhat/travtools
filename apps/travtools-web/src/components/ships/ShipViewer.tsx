import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Trash2, Upload, Tag, X, Settings } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { Ship, ShipSpecs, Annotation, ShipDamageTrackers } from '../../types';
import { CANONICAL_SHIPS } from './canonicalShips';
import { annotationPosition, removeAnnotationById, sortShips } from '../../lib/ships';

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
  editable: boolean;
  form: ShipDamageTrackers;
  onFormChange: (damage: ShipDamageTrackers) => void;
  onSave: () => void;
  onReset: () => void;
}

function hasSpecValues(specs: ShipSpecs | null) {
  return Boolean(specs && Object.values(specs).some(v => v != null && v !== ''));
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
  return { ...(canonicalDef?.defaultSpecs ?? {}), ...(ship.specs ?? {}) };
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

function fleetManifestRows(ship: Ship, specs: ShipSpecs) {
  return [
    { section: 'Hull', detail: `${ship.tonnage ?? specs.hull_rating ?? '?'}t ${specs.hull_config ?? ship.ship_class ?? 'Unclassified'}`, metric: specs.hull_rating ? `${specs.hull_rating} HP` : '-' },
    { section: 'Protection', detail: specs.armour_rating ? `Armour rating ${specs.armour_rating}` : 'Unarmoured or unknown', metric: specs.armour_rating ?? '-' },
    { section: 'Drives', detail: `Jump-${specs.j_drive ?? '-'} / Thrust-${specs.m_drive ?? '-'}`, metric: specs.fuel_tons ? `${specs.fuel_tons}t fuel` : '-' },
    { section: 'Power', detail: specs.power_plant ? `Power plant ${specs.power_plant}` : 'Power plant not recorded', metric: specs.power_plant ?? '-' },
    { section: 'Bridge', detail: specs.bridge_tons ? `${specs.bridge_tons}t bridge` : 'Bridge not recorded', metric: specs.tech_level ? `TL${specs.tech_level}` : '-' },
    { section: 'Weapons', detail: specs.turrets ? `${specs.turrets} turret${specs.turrets === 1 ? '' : 's'}` : 'No turrets recorded', metric: specs.turrets ?? '-' },
    { section: 'Quarters', detail: `${specs.staterooms ?? 0} staterooms / ${specs.low_berths ?? 0} low berths`, metric: specs.crew_notes ?? '-' },
    { section: 'Cargo', detail: 'Cargo displacement recorded on fleet record', metric: specs.cargo_tons ? `${specs.cargo_tons}t` : '-' },
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
            <input
              aria-label="Ship tonnage"
              className="input py-1 text-xs"
              type="number"
              min={0}
              value={identityForm.tonnage}
              onChange={e => onIdentityChange({ ...identityForm, tonnage: e.target.value })}
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
              <input
                className="input py-1 text-xs"
                type={type}
                step={key === 'purchase_price_mcr' ? '0.001' : '1'}
                value={(specsForm[key] as string | number | null | undefined) ?? ''}
                onChange={e => {
                  const raw = e.target.value;
                  const val = raw === '' ? null : type === 'number' ? parseFloat(raw) : raw;
                  onSpecsChange({ ...specsForm, [key]: val });
                }}
              />
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
            {identityRows.map(([label, value]) => (
              <div key={label} className="border-b border-steel/20 pb-1">
                <div className="text-body/45 font-mono text-[10px] tracking-wider">{label.toUpperCase()}</div>
                <div className="text-amber font-mono truncate">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {SPECS_FIELDS.filter(({ key }) => specs?.[key] != null && specs[key] !== '').map(({ key, label }) => (
            <div key={key} className="border-b border-steel/20 pb-1">
              <div className="text-body/45 font-mono text-[10px] tracking-wider">{label.toUpperCase()}</div>
              <div className="text-amber font-mono truncate">{String(specs?.[key])}</div>
            </div>
          ))}
          {specs?.crew_notes && (
            <div className="col-span-2 border-b border-steel/20 pb-1">
              <div className="text-body/45 font-mono text-[10px] tracking-wider">CREW NOTES</div>
              <div className="text-amber font-mono">{specs.crew_notes}</div>
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="p-3 text-xs text-body/55 font-mono">Click the ship row cog to edit this record.</div>
      )}
    </div>
  );
}

function ShipDamagePanel({ specs, damage, editable, form, onFormChange, onSave, onReset }: ShipDamagePanelProps) {
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
        {editable && (
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={onReset} className="btn-steel text-xs py-1 px-2">RESET</button>
            <button type="button" onClick={onSave} className="btn-amber text-xs py-1 px-2">SAVE DAMAGE</button>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        {DAMAGE_FIELDS.map(field => {
          const max = maxForDamageField(field, specs);
          const value = Number((editable ? form[field.key] : normalized[field.key]) ?? 0);
          const tone = damageTone(value, max);
          return (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-body/65 font-mono text-[10px] tracking-wider">{field.label.toUpperCase()}</span>
                {editable ? (
                  <input
                    aria-label={field.label}
                    type="number"
                    min={0}
                    max={max}
                    className="input py-0.5 text-xs w-20 text-right"
                    value={value}
                    onChange={e => {
                      const next = Math.max(0, parseInt(e.target.value || '0', 10));
                      onFormChange({ ...form, [field.key]: Number.isFinite(next) ? next : 0 });
                    }}
                  />
                ) : (
                  <span className={`font-mono ${tone === 'alert' ? 'text-alert' : tone === 'amber' ? 'text-amber' : 'text-safe'}`}>
                    {value}{max ? ` / ${max}` : ''}
                  </span>
                )}
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
        {editable ? (
          <label className="space-y-1 block pt-2">
            <span className="text-body/60 font-mono text-[10px] tracking-wider">DAMAGE NOTES</span>
            <textarea
              aria-label="Damage Notes"
              className="input min-h-20 resize-y text-xs"
              value={form.notes ?? ''}
              onChange={e => onFormChange({ ...form, notes: e.target.value || null })}
            />
          </label>
        ) : normalized.notes ? (
          <div className="pt-2 text-xs text-body/70 leading-5 whitespace-pre-wrap">{normalized.notes}</div>
        ) : null}
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
  const [identityForm, setIdentityForm] = useState<ShipIdentityForm>(identityFormFromShip(null));
  const [editingRecord, setEditingRecord] = useState(false);
  const schematicRef = useRef<HTMLDivElement>(null);
  const replaceImageRef = useRef<HTMLInputElement>(null);

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
  }

  useEffect(() => {
    setIdentityForm(identityFormFromShip(selected));
    setSpecsForm(effectiveShipSpecs(selected));
    setDamageForm(normalizeShipDamage(selected?.damage));
  }, [selected]);

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
    const specs = hasSpecValues(specsForm) ? specsForm : null;
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

  async function saveDamage() {
    if (!editingRecord || !client || !selected) return;
    const damage = hasDamageValues(damageForm) ? damageForm : {};
    updateShipInState({ ...selected, damage });
    const { error } = await client.from('ships').update({ damage }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship damage could not be saved: ${error.message}`);
      loadShips();
    }
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
  const selectedCanonical = selected?.canonical_id ? CANONICAL_SHIPS.find(c => c.id === selected.canonical_id) : null;
  const selectedManifestRows = selected ? fleetManifestRows(selected, selectedSpecs) : [];
  const hullDamage = Number(selectedDamage.hull ?? 0);
  const hullRating = typeof selectedSpecs.hull_rating === 'number' ? selectedSpecs.hull_rating : undefined;
  const damageTotal = DAMAGE_FIELDS.reduce((sum, { key }) => sum + Number(selectedDamage[key] ?? 0), 0);

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
                  label="DISPLACEMENT"
                  value={selected.tonnage ? `${selected.tonnage}t` : '-'}
                  sub={selected.ship_class ?? selectedCanonical?.ship_class ?? 'Fleet record'}
                  tone="cyan"
                />
                <Readout
                  label="DRIVES"
                  value={`J${selectedSpecs.j_drive ?? '-'}/M${selectedSpecs.m_drive ?? '-'}`}
                  sub={selectedSpecs.fuel_tons ? `${selectedSpecs.fuel_tons}t fuel` : 'Fuel not recorded'}
                  tone="amber"
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
                  label="MAINTENANCE"
                  value={formatCr(selectedSpecs.monthly_maintenance_cr)}
                  sub="per month"
                  tone="cyan"
                />
                <Readout
                  label="PURCHASE"
                  value={formatMCr(selectedSpecs.purchase_price_mcr)}
                  sub="recorded value"
                  tone="amber"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_25rem] gap-4 max-w-7xl mx-auto">
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
                  <ShipDamagePanel
                    specs={selectedSpecs}
                    damage={selectedDamage}
                    editable={editingRecord}
                    form={damageForm}
                    onFormChange={setDamageForm}
                    onSave={saveDamage}
                    onReset={() => setDamageForm(normalizeShipDamage(selected.damage))}
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
                      <div className="p-3 min-h-36 text-xs text-body/70 leading-5 whitespace-pre-wrap">
                        {selected.notes || 'No notes recorded.'}
                      </div>
                    )}
                  </section>
                </aside>
              </div>
              <div className="max-w-7xl mx-auto mt-4 border border-steel/50 bg-panel/35">
                <div className="border-b border-steel/40 px-3 py-2 label">SYSTEMS MANIFEST</div>
                <div className="divide-y divide-steel/20">
                  {selectedManifestRows.map(row => (
                    <div key={row.section} className="grid grid-cols-1 md:grid-cols-[8rem_minmax(0,1fr)_9rem] gap-1 md:gap-3 px-3 py-2 text-xs">
                      <div className="text-amber font-mono tracking-wider">{row.section}</div>
                      <div className="text-body/75 min-w-0 break-words">{row.detail}</div>
                      <div className="text-cyan-trav font-mono md:text-right">{row.metric}</div>
                    </div>
                  ))}
                </div>
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
