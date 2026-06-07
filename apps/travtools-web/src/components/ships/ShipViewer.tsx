import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, Trash2, Upload, Tag, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { Ship, Annotation } from '../../types';
import { CANONICAL_SHIPS } from './canonicalShips';

function uuid() {
  return crypto.randomUUID();
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
  const imageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadShips = useCallback(async () => {
    if (!client) return;
    const { data } = await client.from('ships').select('*').order('created_at');
    if (data) setShips(data as Ship[]);
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

  async function addCustomShip(imageUrl: string) {
    if (!client || !newShipName) return;
    const { data } = await client.from('ships').insert({
      name: newShipName,
      schematic_type: 'custom',
      image_url: imageUrl,
      annotations: [],
    }).select().single();
    if (data) setSelected(data as Ship);
    setAddingShip(false);
    setNewShipName('');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    const ext = file.name.split('.').pop();
    const path = `${uuid()}.${ext}`;
    const { error } = await client.storage.from('ship-schematics').upload(path, file);
    if (error) { alert('Upload failed: ' + error.message); return; }

    const { data: urlData } = client.storage.from('ship-schematics').getPublicUrl(path);
    await addCustomShip(urlData.publicUrl);
  }

  async function addCanonicalShip(canonicalId: string) {
    if (!client) return;
    const def = CANONICAL_SHIPS.find(s => s.id === canonicalId);
    if (!def) return;
    const { data } = await client.from('ships').insert({
      name: def.name,
      ship_class: def.ship_class,
      tonnage: def.tonnage,
      schematic_type: 'canonical',
      canonical_id: canonicalId,
      annotations: [],
    }).select().single();
    if (data) setSelected(data as Ship);
  }

  async function deleteShip(id: string) {
    if (!client || !confirm('Delete this ship entry?')) return;
    await client.from('ships').delete().eq('id', id);
    if (selected?.id === id) setSelected(null);
  }

  function handleImageClick(e: React.MouseEvent) {
    if (!annotating || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPos({ x, y });
  }

  async function saveAnnotation() {
    if (!client || !selected || !pendingPos || !newLabel.trim()) return;
    const annotation: Annotation = { id: uuid(), x: pendingPos.x, y: pendingPos.y, label: newLabel.trim() };
    const updated = [...(selected.annotations || []), annotation];
    await client.from('ships').update({ annotations: updated }).eq('id', selected.id);
    setSelected({ ...selected, annotations: updated });
    setShips(ships.map(s => s.id === selected.id ? { ...s, annotations: updated } : s));
    setPendingPos(null);
    setNewLabel('');
  }

  async function removeAnnotation(annotationId: string) {
    if (!client || !selected) return;
    const updated = selected.annotations.filter(a => a.id !== annotationId);
    await client.from('ships').update({ annotations: updated }).eq('id', selected.id);
    setSelected({ ...selected, annotations: updated });
    setShips(ships.map(s => s.id === selected.id ? { ...s, annotations: updated } : s));
  }

  const canonicalAdded = new Set(ships.filter(s => s.schematic_type === 'canonical').map(s => s.canonical_id));

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-steel flex flex-col bg-panel">
        <div className="panel-header flex items-center justify-between">
          <span>SHIPS</span>
          <button
            onClick={() => setAddingShip(v => !v)}
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
                  onClick={() => { setSelected(ship); setAnnotating(false); setPendingPos(null); }}
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
        {selected ? (
          <>
            <div className="panel-header border-b border-steel flex items-center justify-between flex-shrink-0">
              <span>{selected.name.toUpperCase()}</span>
              <div className="flex items-center gap-3">
                {selected.schematic_type === 'custom' && (
                  <button
                    onClick={() => { setAnnotating(v => !v); setPendingPos(null); }}
                    className={`btn text-xs flex items-center gap-1 ${annotating ? 'btn-amber' : 'btn-steel'}`}
                  >
                    <Tag size={11} />
                    {annotating ? 'STOP LABELLING' : 'LABEL'}
                  </button>
                )}
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
                <div className="max-w-4xl mx-auto">
                  {(() => {
                    const def = CANONICAL_SHIPS.find(c => c.id === selected.canonical_id);
                    return def ? <def.Component /> : null;
                  })()}
                </div>
              ) : selected.image_url ? (
                <div
                  ref={imageRef}
                  className={`relative inline-block max-w-full ${annotating ? 'cursor-crosshair' : ''}`}
                  onClick={handleImageClick}
                >
                  <img
                    src={selected.image_url}
                    alt={selected.name}
                    className="max-w-full border border-steel"
                  />
                  {/* Annotations */}
                  {(selected.annotations || []).map(ann => (
                    <div
                      key={ann.id}
                      className="absolute group"
                      style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <div className="bg-amber/90 text-void text-xs px-1.5 py-0.5 font-mono whitespace-nowrap flex items-center gap-1">
                        {ann.label}
                        <button
                          onClick={e => { e.stopPropagation(); removeAnnotation(ann.id); }}
                          className="opacity-0 group-hover:opacity-100 ml-1 text-void/70 hover:text-void"
                        >
                          <X size={9} />
                        </button>
                      </div>
                      <div className="w-1.5 h-1.5 bg-amber rounded-full mx-auto mt-0.5" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-body/40 text-sm">
                  No schematic image available.
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
