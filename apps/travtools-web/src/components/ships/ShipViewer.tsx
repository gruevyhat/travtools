import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, Trash2, Upload, Tag, X, Settings } from 'lucide-react';
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
  editable: boolean;
  form: ShipSpecs;
  onFormChange: (s: ShipSpecs) => void;
  onSave: () => void;
  onReset: () => void;
}

function hasSpecValues(specs: ShipSpecs | null) {
  return Boolean(specs && Object.values(specs).some(v => v != null && v !== ''));
}

function effectiveShipSpecs(ship: Ship | null): ShipSpecs {
  if (!ship) return {};
  const canonicalDef = ship.canonical_id
    ? CANONICAL_SHIPS.find(c => c.id === ship.canonical_id)
    : undefined;
  return { ...(canonicalDef?.defaultSpecs ?? {}), ...(ship.specs ?? {}) };
}

function ShipSpecsPanel({ specs, editable, form, onFormChange, onSave, onReset }: ShipSpecsPanelProps) {
  const hasSpecs = hasSpecValues(specs);

  return (
    <div className="border border-steel/50 bg-panel/45">
      <div className="border-b border-steel/40 px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <div className="label">SHIP RECORD</div>
          <div className="text-[10px] text-body/45 font-mono">
            {editable ? 'Editing technical specifications' : hasSpecs ? 'Technical specifications' : 'No specs recorded yet'}
          </div>
        </div>
        {editable && (
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={onReset} className="btn-steel text-xs py-1 px-2">RESET</button>
            <button type="button" onClick={onSave} className="btn-amber text-xs py-1 px-2">SAVE SPECS</button>
          </div>
        )}
      </div>
      {editable ? (
        <div className="grid grid-cols-2 gap-2 p-3 text-xs">
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
          <label className="space-y-0.5 block col-span-2">
            <span className="text-body/60 font-mono text-[10px] tracking-wider">CREW NOTES</span>
            <input className="input py-1 text-xs" type="text"
              value={form.crew_notes ?? ''}
              onChange={e => onFormChange({ ...form, crew_notes: e.target.value || null })}
            />
          </label>
        </div>
      ) : hasSpecs ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-3 text-xs">
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
      ) : (
        <div className="p-3 text-xs text-body/55 font-mono">Click the ship row cog to edit this record.</div>
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
  const [specsForm, setSpecsForm] = useState<ShipSpecs>({});
  const [editingName, setEditingName] = useState(false);
  const [nameForm, setNameForm] = useState('');
  const [nameRequired, setNameRequired] = useState(false);
  const schematicRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    setEditingName(false);
  }

  function startEditShip(ship: Ship) {
    selectShip(ship);
    setNameForm(ship.name);
    setEditingName(true);
  }

  useEffect(() => {
    setSpecsForm(effectiveShipSpecs(selected));
  }, [selected]);

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
    const { error } = await bucket.upload(path, file, { contentType: file.type });
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

  async function saveSpecs() {
    if (!client || !selected) return;
    const specs = hasSpecValues(specsForm) ? specsForm : null;
    updateShipInState({ ...selected, specs });
    const { error } = await client.from('ships').update({ specs }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship specs could not be saved: ${error.message}`);
      loadShips();
    }
  }

  async function saveName() {
    if (!client || !selected || !nameForm.trim()) return;
    const name = nameForm.trim();
    updateShipInState({ ...selected, name });
    setEditingName(false);
    const { error } = await client.from('ships').update({ name }).eq('id', selected.id);
    if (error) {
      setErrorMessage(`Ship name could not be saved: ${error.message}`);
      loadShips();
    }
  }

  async function handleReplaceImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client || !selected) return;
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
              placeholder="Ship name (required)"
              value={newShipName}
              onChange={e => { setNewShipName(e.target.value); setNameRequired(false); }}
            />
            {nameRequired && (
              <div className="text-[10px] text-alert font-mono">Enter a ship name first.</div>
            )}
            <button
              onClick={() => {
                if (!newShipName.trim()) { setNameRequired(true); return; }
                setNameRequired(false);
                fileInputRef.current?.click();
              }}
              className="btn-amber w-full text-center text-xs"
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
            <div className="panel-header border-b border-steel flex items-center justify-between flex-shrink-0 gap-3">
              {editingName ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    autoFocus
                    aria-label="Ship name"
                    className="input text-xs py-0.5 flex-1 min-w-0"
                    value={nameForm}
                    onChange={e => setNameForm(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  />
                  <button onClick={saveName} aria-label="Save ship name" className="btn-amber text-xs py-0.5 px-2 flex-shrink-0">SAVE</button>
                  <button onClick={() => setEditingName(false)} className="btn-steel text-xs py-0.5 px-2 flex-shrink-0">✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setNameForm(selected.name); setEditingName(true); }}
                  className="flex items-center gap-1.5 text-xs font-mono tracking-widest text-left hover:text-amber transition-colors group"
                  title="Click to rename"
                >
                  {selected.name.toUpperCase()}
                  <Pencil size={10} className="opacity-30 group-hover:opacity-80 transition-opacity flex-shrink-0" />
                </button>
              )}
              <div className="flex items-center gap-2 flex-shrink-0">
                {selected.schematic_type === 'custom' && (
                  <>
                    <button
                      onClick={() => replaceImageRef.current?.click()}
                      className="btn-steel text-xs flex items-center gap-1"
                      title="Replace schematic image"
                    >
                      <Upload size={11} /> IMAGE
                    </button>
                    <input ref={replaceImageRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceImage} />
                  </>
                )}
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

            {/* Ship record + schematic */}
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 xl:grid-cols-[22rem_minmax(0,1fr)] gap-4 max-w-7xl mx-auto">
                <aside className="space-y-3">
                  <ShipSpecsPanel
                    specs={effectiveShipSpecs(selected)}
                    form={specsForm}
                    onFormChange={setSpecsForm}
                    onSave={saveSpecs}
                    onReset={() => setSpecsForm(effectiveShipSpecs(selected))}
                  />
                  <section className="border border-steel/50 bg-panel/45">
                    <div className="border-b border-steel/40 px-3 py-2 label">SHIP NOTES</div>
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
                  </section>
                </aside>

                <section className="border border-steel/50 bg-panel/30 min-h-[30rem] flex flex-col">
                  <div className="border-b border-steel/40 px-3 py-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="label">ANNOTATABLE SCHEMATIC</div>
                      <div className="text-[10px] text-body/45 font-mono">
                        {selected.schematic_type === 'canonical'
                          ? `${selected.ship_class ?? 'Canonical'} · ${selected.tonnage ?? '?'}t`
                          : 'Custom ship record'}
                      </div>
                    </div>
                    <div className="text-[10px] text-body/45 font-mono">
                      {(selected.annotations ?? []).length} label{(selected.annotations ?? []).length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
                    {selected.schematic_type === 'canonical' && selected.canonical_id ? (
                      (() => {
                        const def = CANONICAL_SHIPS.find(c => c.id === selected.canonical_id);
                        return def ? (
                          <div
                            ref={schematicRef}
                            className={`relative w-full max-w-5xl border border-steel bg-void ${annotating ? 'cursor-crosshair' : ''}`}
                            onClick={handleSchematicClick}
                          >
                            <def.Component />
                            {renderAnnotations()}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-72 w-full text-body/65 text-sm border border-steel bg-void">
                            Canonical schematic unavailable.
                          </div>
                        );
                      })()
                    ) : selected.image_url ? (
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
                    ) : (
                      <div className="flex items-center justify-center h-72 w-full text-body/65 text-sm border border-steel bg-void">
                        No schematic image available.
                      </div>
                    )}
                  </div>
                </section>
              </div>
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
