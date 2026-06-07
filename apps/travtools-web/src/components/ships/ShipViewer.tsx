import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pencil, Plus, Trash2, Upload, Tag, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { Ship, ShipSpecs, Annotation } from '../../types';
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

interface ShipSpecsPanelProps {
  specs: ShipSpecs | null;
  editing: boolean;
  form: ShipSpecs;
  onFormChange: (s: ShipSpecs) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function ShipSpecsPanel({ specs, editing, form, onFormChange, onEdit, onSave, onCancel }: ShipSpecsPanelProps) {
  const hasSpecs = specs && Object.values(specs).some(v => v != null);

  if (editing) {
    return (
      <div className="panel p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="label">SHIP SPECS</div>
          <div className="flex gap-2">
            <button type="button" onClick={onSave} className="btn-amber text-xs">SAVE</button>
            <button type="button" onClick={onCancel} className="btn-steel text-xs">CANCEL</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {SPECS_FIELDS.map(({ key, label, type }) => (
            <label key={key} className="space-y-0.5 block">
              <span className="text-body/60 font-mono text-[10px] tracking-wider">{label.toUpperCase()}</span>
              <input
                className="input py-1 text-xs"
                type={type}
                step={key === 'purchase_price_mcr' ? '0.001' : '1'}
                value={(form[key] as string | number | null | undefined) ?? ''}
                onChange={e => {
                  const raw = e.target.value;
                  const val = raw === '' ? null : type === 'number' ? parseFloat(raw) : raw;
                  onFormChange({ ...form, [key]: val });
                }}
              />
            </label>
          ))}
          <div className="col-span-2">
            <label className="space-y-0.5 block">
              <span className="text-body/60 font-mono text-[10px] tracking-wider">CREW NOTES</span>
              <input className="input py-1 text-xs" type="text"
                value={form.crew_notes ?? ''}
                onChange={e => onFormChange({ ...form, crew_notes: e.target.value || null })}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="label">SHIP SPECS</div>
        <button type="button" onClick={onEdit} className="btn-steel text-xs flex items-center gap-1">
          <Pencil size={10} /> EDIT
        </button>
      </div>
      {hasSpecs ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {SPECS_FIELDS.filter(f => specs[f.key] != null).map(({ key, label }) => (
            <div key={key} className="flex justify-between border-b border-steel/20 pb-0.5">
              <span className="text-body/50">{label}</span>
              <span className="text-amber font-mono">{String(specs[key])}</span>
            </div>
          ))}
          {specs.crew_notes && (
            <div className="col-span-2 flex justify-between border-b border-steel/20 pb-0.5">
              <span className="text-body/50">Crew</span>
              <span className="text-amber font-mono">{specs.crew_notes}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-body/30 text-center py-2">No specs recorded. Click EDIT to add.</div>
      )}
    </div>
  );
}

export default function ShipViewer() {
  const { client } = useSupabase();
  const [ships, setShips] = useState<Ship[]>([]);
  const [selected, setSelected] = useState<Ship | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [addingShip, setAddingShip] = useState(false);
  const [newShipName, setNewShipName] = useState('');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingSpecs, setEditingSpecs] = useState(false);
  const [specsForm, setSpecsForm] = useState<ShipSpecs>({});
  const schematicRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }

  async function addCustomShip(imageUrl: string) {
    const name = newShipName.trim();
    if (!client || !name) return;
    const { data, error } = await client.from('ships').insert({
      name,
      schematic_type: 'custom',
      image_url: imageUrl,
      annotations: [],
      notes: null,
    }).select().single();
    if (error || !data) {
      setErrorMessage(`Custom ship could not be added: ${error?.message ?? 'No ship was returned.'}`);
      return;
    }

    const ship = data as Ship;
    setShips(current => sortShips([...current, ship]));
    setSelected(ship);
    setErrorMessage(null);
    setAddingShip(false);
    setNewShipName('');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    const ext = file.name.split('.').pop();
    const path = `${uuid()}.${ext}`;
    const bucket = client.storage.from('ship-schematics');
    const { error } = await bucket.upload(path, file);
    e.target.value = '';
    if (error) {
      setErrorMessage(`Ship image upload failed: ${error.message}`);
      return;
    }

    const { data: urlData } = bucket.getPublicUrl(path);
    await addCustomShip(urlData.publicUrl);
  }

  async function addCanonicalShip(canonicalId: string) {
    if (!client) return;
    const def = CANONICAL_SHIPS.find(s => s.id === canonicalId);
    if (!def) return;
    const { data, error } = await client.from('ships').insert({
      name: def.name,
      ship_class: def.ship_class,
      tonnage: def.tonnage,
      schematic_type: 'canonical',
      canonical_id: canonicalId,
      annotations: [],
      notes: null,
    }).select().single();
    if (error || !data) {
      setErrorMessage(`Canonical ship could not be added: ${error?.message ?? 'No ship was returned.'}`);
      return;
    }

    const ship = data as Ship;
    setShips(current => sortShips([...current, ship]));
    setSelected(ship);
    setAddingShip(false);
    setErrorMessage(null);
  }

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
    if (!annotating || !schematicRef.current) return;
    const rect = schematicRef.current.getBoundingClientRect();
    setPendingPos(annotationPosition(e.clientX, e.clientY, rect));
    setSelectedAnnotationId(null);
  }

  async function saveAnnotation() {
    if (!client || !selected || !pendingPos || !newLabel.trim()) return;
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
    if (!client || !selected) return;
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
    if (!selected) return;
    updateShipInState({ ...selected, notes });
  }

  async function saveNotes() {
    if (!client || !selected) return;
    const notes = selected.notes?.trim() ? selected.notes : null;
    const { error } = await client.from('ships').update({ notes }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship notes could not be saved: ${error.message}`);
      loadShips();
    }
  }

  function startEditSpecs() {
    setSpecsForm(selected?.specs ?? {});
    setEditingSpecs(true);
  }

  async function saveSpecs() {
    if (!client || !selected) return;
    const specs = Object.values(specsForm).some(v => v != null) ? specsForm : null;
    updateShipInState({ ...selected, specs });
    setEditingSpecs(false);
    const { error } = await client.from('ships').update({ specs }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship specs could not be saved: ${error.message}`);
      loadShips();
    }
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
            {isSelected && (
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

  const canonicalAdded = new Set(ships.filter(s => s.schematic_type === 'canonical').map(s => s.canonical_id));

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 max-h-72 md:max-h-none flex-shrink-0 border-b md:border-b-0 md:border-r border-steel flex flex-col bg-panel">
        <div className="panel-header flex items-center justify-between">
          <span>SHIPS</span>
          <button
            onClick={() => setAddingShip(v => !v)}
            aria-label="Add ship"
            title="Add ship"
            className="text-amber hover:text-amber-bright transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Add ship panel */}
        {addingShip && (
          <div className="border-b border-steel p-3 space-y-2 bg-void/50">
            <div className="text-xs text-amber tracking-wider">ADD CANONICAL</div>
            {CANONICAL_SHIPS.filter(c => !canonicalAdded.has(c.id)).map(c => (
              <button
                key={c.id}
                onClick={() => addCanonicalShip(c.id)}
                className="w-full text-left text-xs text-body hover:text-amber transition-colors py-1 px-2 border border-steel/50 hover:border-amber"
              >
                {c.ship_class} — {c.name} ({c.tonnage}t)
              </button>
            ))}
            <div className="text-xs text-amber tracking-wider mt-2">ADD CUSTOM</div>
            <input
              className="input text-xs py-1"
              placeholder="Ship name"
              value={newShipName}
              onChange={e => setNewShipName(e.target.value)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!newShipName}
              className="btn-amber w-full text-center text-xs disabled:opacity-40"
            >
              <Upload size={11} className="inline mr-1" />UPLOAD IMAGE
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>
        )}

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
            <li className="px-4 py-6 text-center text-body/40 text-xs">
              No ships registered.<br />Add a canonical or custom ship.
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
            <div className="panel-header border-b border-steel flex items-center justify-between flex-shrink-0">
              <span>{selected.name.toUpperCase()}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setAnnotating(v => !v); setPendingPos(null); setSelectedAnnotationId(null); }}
                  className={`btn text-xs flex items-center gap-1 ${annotating ? 'btn-amber' : 'btn-steel'}`}
                >
                  <Tag size={11} />
                  {annotating ? 'STOP LABELLING' : 'LABEL'}
                </button>
              </div>
            </div>

            {annotating && !pendingPos && (
              <div className="bg-amber/10 border-b border-amber/30 px-4 py-2 text-xs text-amber">
                Click anywhere on the schematic to add a label.
              </div>
            )}

            {/* Pending annotation form */}
            {pendingPos && (
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

            {/* Schematic display */}
            <div className="flex-1 overflow-auto p-4">
              {selected.schematic_type === 'canonical' && selected.canonical_id ? (
                <div className="max-w-5xl mx-auto space-y-3">
                  {(() => {
                    const def = CANONICAL_SHIPS.find(c => c.id === selected.canonical_id);
                    return def ? (
                      <div
                        ref={schematicRef}
                        className={`relative border border-steel bg-void ${annotating ? 'cursor-crosshair' : ''}`}
                        onClick={handleSchematicClick}
                      >
                        <def.Component />
                        {renderAnnotations()}
                      </div>
                    ) : null;
                  })()}
                  <div>
                    <label htmlFor="ship-notes" className="block text-xs text-amber tracking-wider mb-1">SHIP NOTES</label>
                    <textarea
                      id="ship-notes"
                      aria-label="Ship Notes"
                      className="input min-h-24 resize-y"
                      value={selected.notes ?? ''}
                      onChange={e => updateSelectedNotes(e.target.value)}
                      onBlur={saveNotes}
                    />
                  </div>
                  <ShipSpecsPanel
                    specs={selected.specs}
                    editing={editingSpecs}
                    form={specsForm}
                    onFormChange={setSpecsForm}
                    onEdit={startEditSpecs}
                    onSave={saveSpecs}
                    onCancel={() => setEditingSpecs(false)}
                  />
                </div>
              ) : selected.image_url ? (
                <div className="space-y-3">
                  <div
                    ref={schematicRef}
                    className={`relative inline-block max-w-full border border-steel bg-void ${annotating ? 'cursor-crosshair' : ''}`}
                    onClick={handleSchematicClick}
                  >
                    <img
                      src={selected.image_url}
                      alt={selected.name}
                      className="block max-w-full"
                    />
                    {renderAnnotations()}
                  </div>
                  <div>
                    <label htmlFor="ship-notes" className="block text-xs text-amber tracking-wider mb-1">SHIP NOTES</label>
                    <textarea
                      id="ship-notes"
                      aria-label="Ship Notes"
                      className="input min-h-24 resize-y"
                      value={selected.notes ?? ''}
                      onChange={e => updateSelectedNotes(e.target.value)}
                      onBlur={saveNotes}
                    />
                  </div>
                  <ShipSpecsPanel
                    specs={selected.specs}
                    editing={editingSpecs}
                    form={specsForm}
                    onFormChange={setSpecsForm}
                    onEdit={startEditSpecs}
                    onSave={saveSpecs}
                    onCancel={() => setEditingSpecs(false)}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center h-64 text-body/40 text-sm border border-steel bg-panel">
                    No schematic image available.
                  </div>
                  <div>
                    <label htmlFor="ship-notes" className="block text-xs text-amber tracking-wider mb-1">SHIP NOTES</label>
                    <textarea
                      id="ship-notes"
                      aria-label="Ship Notes"
                      className="input min-h-24 resize-y"
                      value={selected.notes ?? ''}
                      onChange={e => updateSelectedNotes(e.target.value)}
                      onBlur={saveNotes}
                    />
                  </div>
                  <ShipSpecsPanel
                    specs={selected.specs}
                    editing={editingSpecs}
                    form={specsForm}
                    onFormChange={setSpecsForm}
                    onEdit={startEditSpecs}
                    onSave={saveSpecs}
                    onCancel={() => setEditingSpecs(false)}
                  />
                </div>
              )}
                    </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-body/40 space-y-2">
              <div className="text-4xl opacity-20">◈</div>
              <div className="text-sm font-mono">Select a ship to view its schematic.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
