import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Download, Minus, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { InventoryItem } from '../../types';
import { csvRow, downloadCsv, parseCsvRows } from '../../lib/csv';
import {
  categoryChipClass,
  filterInventoryItems,
  inventoryTotals,
  INVENTORY_CATEGORIES,
  sortItems,
} from '../../lib/inventory';
import {
  CORE_EQUIPMENT,
  CORE_EQUIPMENT_SECTIONS,
  CoreEquipmentSection,
  equipmentInventoryNotes,
  formatEquipmentCost,
  formatEquipmentMass,
  searchCoreEquipment,
} from '../../data/equipment';
import NumberStepper from '../shared/NumberStepper';

type ItemForm = Omit<InventoryItem, 'id' | 'created_at'>;

const EMPTY: ItemForm = {
  name: '',
  category: null,
  quantity: 1,
  weight_kg: null,
  value_cr: null,
  owner: null,
  location: null,
  notes: null,
};

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className="label block">{name}</span>
      {children}
    </label>
  );
}

export default function InventoryManager() {
  const { client } = useSupabase();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ItemForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [equipmentSection, setEquipmentSection] = useState<CoreEquipmentSection | ''>('');
  const [showEquipmentReference, setShowEquipmentReference] = useState(false);
  const csvImportRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client.from('inventory_items').select('*').order('name');
    if (error) {
      setErrorMessage('Inventory could not be loaded.');
      return;
    }
    if (data) setItems(data as InventoryItem[]);
  }, [client]);

  useEffect(() => {
    loadItems();
    if (!client) return;
    const channel = client
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, loadItems)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, loadItems]);

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setErrorMessage(null);
    if (editing) {
      const editingId = editing;
      const previous = items.find(i => i.id === editingId);
      const optimistic = {
        ...(previous ?? { id: editingId, created_at: new Date().toISOString() }),
        ...form,
      } as InventoryItem;

      setItems(prev => sortItems(prev.map(i => i.id === editingId ? optimistic : i)));
      setEditing(null);
      setForm(EMPTY);
      setShowForm(false);
      setShowEquipmentReference(false);

      const { data, error } = await client.from('inventory_items').update(form).eq('id', editingId).select().single();
      if (error) {
        setErrorMessage(`Could not update ${form.name}.`);
        if (previous) setItems(prev => sortItems(prev.map(i => i.id === editingId ? previous : i)));
        loadItems();
        return;
      }
      if (data) setItems(prev => sortItems(prev.map(i => i.id === editingId ? data as InventoryItem : i)));
      return;
    } else {
      const { data, error } = await client.from('inventory_items').insert(form).select().single();
      if (error) {
        setErrorMessage(`Could not add ${form.name}.`);
        return;
      }
      if (data) setItems(prev => sortItems([data as InventoryItem, ...prev]));
    }
    setForm(EMPTY);
    setShowForm(false);
    setShowEquipmentReference(false);
  }

  async function deleteItem(id: string) {
    if (!client || !confirm('Delete this item?')) return;
    setErrorMessage(null);
    const previous = items.find(i => i.id === id);
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    const { error } = await client.from('inventory_items').delete().eq('id', id);
    if (error) {
      setErrorMessage('Could not delete inventory item.');
      if (previous) setItems(prev => sortItems([...prev, previous]));
      loadItems();
    }
  }

  async function adjustQuantity(item: InventoryItem, delta: number) {
    if (!client) return;
    const nextQuantity = Math.max(0, item.quantity + delta);
    if (nextQuantity === item.quantity) return;
    setErrorMessage(null);
    setItems(prev => sortItems(prev.map(i => i.id === item.id ? { ...i, quantity: nextQuantity } : i)));

    const { data, error } = await client
      .from('inventory_items')
      .update({ quantity: nextQuantity })
      .eq('id', item.id)
      .select()
      .single();

    if (error) {
      setErrorMessage(`Could not update quantity for ${item.name}.`);
      setItems(prev => sortItems(prev.map(i => i.id === item.id ? item : i)));
      loadItems();
      return;
    }
    if (data) setItems(prev => sortItems(prev.map(i => i.id === item.id ? data as InventoryItem : i)));
  }

  async function deleteSelectedItems() {
    if (!client || selectedIds.length === 0 || !confirm(`Delete ${selectedIds.length} selected item${selectedIds.length !== 1 ? 's' : ''}?`)) return;
    setErrorMessage(null);
    const ids = [...selectedIds];
    const previous = items.filter(item => ids.includes(item.id));
    setItems(prev => prev.filter(item => !ids.includes(item.id)));
    setSelectedIds([]);

    const { error } = await client.from('inventory_items').delete().in('id', ids);
    if (error) {
      setErrorMessage('Could not delete selected inventory items.');
      setItems(prev => sortItems([...prev, ...previous]));
      loadItems();
    }
  }

  function startEdit(item: InventoryItem) {
    setForm({
      name: item.name, category: item.category, quantity: item.quantity,
      weight_kg: item.weight_kg, value_cr: item.value_cr, owner: item.owner,
      location: item.location, notes: item.notes,
    });
    setEditing(item.id);
    setShowEquipmentReference(false);
    setShowForm(true);
  }

  function populateItemFromEquipment(item: (typeof CORE_EQUIPMENT)[number]) {
    setForm({
      ...EMPTY,
      name: item.name,
      category: item.inventoryCategory,
      weight_kg: item.massKg,
      value_cr: item.costCr,
      notes: equipmentInventoryNotes(item),
    });
    setEditing(null);
    setShowEquipmentReference(true);
    setShowForm(true);
  }

  function exportCsv() {
    const header = csvRow(['Name', 'Category', 'Quantity', 'Weight (kg)', 'Value (Cr)', 'Owner', 'Location', 'Notes']);
    const rows = visible.map(i => csvRow([i.name, i.category, i.quantity, i.weight_kg, i.value_cr, i.owner, i.location, i.notes]));
    downloadCsv('travtools-inventory.csv', [header, ...rows].join('\n'));
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !client) return;
    const text = await file.text();
    const rows = parseCsvRows(text);
    if (rows.length < 2) return;
    const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
    const idx = (name: string) => headers.indexOf(name);
    const get = (row: string[], name: string) => row[idx(name)] ?? '';
    const newItems: Omit<InventoryItem, 'id' | 'created_at'>[] = rows.slice(1).flatMap(row => {
      const name = get(row, 'name');
      if (!name) return [];
      const qty = parseInt(get(row, 'quantity'));
      const wt = parseFloat(get(row, 'weightkg'));
      const val = parseFloat(get(row, 'valuecr'));
      return [{
        name,
        category: get(row, 'category') || null,
        quantity: isNaN(qty) ? 1 : qty,
        weight_kg: isNaN(wt) ? null : wt,
        value_cr: isNaN(val) ? null : val,
        owner: get(row, 'owner') || null,
        location: get(row, 'location') || null,
        notes: get(row, 'notes') || null,
      }];
    });
    if (newItems.length === 0) return;
    const { error } = await client.from('inventory_items').insert(newItems);
    if (error) setErrorMessage(`CSV import failed: ${error.message}`);
  }

  const owners = [...new Set(items.map(i => i.owner).filter(Boolean))] as string[];

  const visible = filterInventoryItems(items, { owner: filterOwner, category: filterCat });
  const { totalWeight, totalValue } = inventoryTotals(visible);
  const allVisibleSelected = visible.length > 0 && visible.every(item => selectedIds.includes(item.id));

  function toggleSelected(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id]);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visible.some(item => item.id === id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visible.map(item => item.id)])]);
    }
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <input ref={csvImportRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvImport} />
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'ITEMS', value: String(visible.length), color: 'text-amber' },
          { label: 'TOTAL MASS', value: `${totalWeight.toFixed(1)} kg`, color: 'text-cyan-trav' },
          { label: 'TOTAL VALUE', value: `Cr ${totalValue.toLocaleString()}`, color: 'text-safe' },
        ].map(({ label, value, color }) => (
          <div key={label} className="panel p-3">
            <div className="label mb-1">{label}</div>
            <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="select w-40 py-1 text-xs" value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
          <option value="">All owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="select w-36 py-1 text-xs" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {selectedIds.length > 0 && (
          <button onClick={deleteSelectedItems} className="btn-danger flex items-center gap-1">
            <Trash2 size={13} /> DELETE {selectedIds.length}
          </button>
        )}
        <div className="flex-1" />
        <button type="button" onClick={() => csvImportRef.current?.click()} className="btn-steel flex items-center gap-1">
          <Upload size={13} /> IMPORT CSV
        </button>
        <button type="button" onClick={exportCsv} className="btn-steel flex items-center gap-1">
          <Download size={13} /> EXPORT CSV
        </button>
        <button
          onClick={() => {
            setForm(EMPTY);
            setEditing(null);
            setShowForm(v => {
              const next = !v;
              setShowEquipmentReference(next);
              return next;
            });
          }}
          className="btn-amber flex items-center gap-1"
        >
          <Plus size={13} /> ADD ITEM
        </button>
      </div>

      {errorMessage && (
        <div role="alert" className="panel border-alert/70 text-alert px-3 py-2 text-xs font-mono flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-alert/60 hover:text-alert">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Core Rules equipment list - appears beside the form or as a collapsible reference. */}
      {(() => {
        const equipmentMatches = searchCoreEquipment(equipmentQuery, equipmentSection);
        const equipmentList = (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-body/65 pointer-events-none" />
                <input
                  className="input pl-6 text-xs"
                  placeholder="Search equipment, TL, traits..."
                  value={equipmentQuery}
                  onChange={e => setEquipmentQuery(e.target.value)}
                />
              </div>
              <select
                className="select py-1 text-xs"
                aria-label="Equipment section"
                value={equipmentSection}
                onChange={e => setEquipmentSection(e.target.value as CoreEquipmentSection | '')}
              >
                <option value="">All sections</option>
                {CORE_EQUIPMENT_SECTIONS.map(section => <option key={section} value={section}>{section}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: showForm ? '30rem' : '24rem' }}>
              {equipmentMatches.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => populateItemFromEquipment(item)}
                  className="w-full text-left border border-steel/40 rounded p-2 text-xs space-y-1 hover:border-amber/60 hover:bg-steel/20 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-[9px] font-mono border px-1 py-0.5 ${categoryChipClass(item.inventoryCategory)}`}>{item.section}</span>
                    <span className="font-mono text-bright flex-1 group-hover:text-amber">{item.name}</span>
                    <span className="text-[10px] text-body/65">p.{item.page}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] pl-1">
                    <span className="text-body/70">TL <span className="text-bright">{item.techLevel ?? '--'}</span></span>
                    <span className="text-body/70">MASS <span className="text-bright">{formatEquipmentMass(item.massKg)}</span></span>
                    <span className="text-body/70">COST <span className="text-cyan-trav">{formatEquipmentCost(item)}</span></span>
                  </div>
                  {(item.range || item.damage || item.traits || item.details?.length) && (
                    <div className="text-[10px] pl-1 space-y-0.5 text-body/60">
                      {(item.range || item.damage) && (
                        <div>
                          {item.range && <span><span className="text-body/55">RANGE </span>{item.range} </span>}
                          {item.damage && <span><span className="text-body/55">DAMAGE </span>{item.damage}</span>}
                        </div>
                      )}
                      {item.traits && <div><span className="text-body/55">TRAITS </span>{item.traits}</div>}
                      {item.details?.slice(0, 2).map(detail => <div key={detail}>{detail}</div>)}
                    </div>
                  )}
                </button>
              ))}
              {equipmentMatches.length === 0 && (
                <div className="text-body/65 text-center py-4">No matching Core Rules equipment.</div>
              )}
            </div>
          </div>
        );

        const itemForm = (
          <form onSubmit={saveItem} className="panel p-4 grid grid-cols-2 gap-3 flex-1 min-w-0">
            <div className="col-span-2 panel-header -mx-4 -mt-4 mb-1">
              {editing ? 'EDIT ITEM' : 'NEW INVENTORY ITEM'}
            </div>
            <Field name="Item Name">
              <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field name="Category">
              <select className="select" value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value || null })}>
                <option value="">-- None --</option>
                {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field name="Quantity">
              <NumberStepper ariaLabel="Quantity" min={0} value={form.quantity} onChange={value => setForm({ ...form, quantity: parseInt(value, 10) || 0 })} />
            </Field>
            <Field name="Weight (kg each)">
              <NumberStepper ariaLabel="Weight kg each" step="0.001" value={form.weight_kg ?? ''} onChange={value => setForm({ ...form, weight_kg: value ? parseFloat(value) : null })} />
            </Field>
            <Field name="Value (Cr each)">
              <NumberStepper ariaLabel="Value credits each" step="0.01" value={form.value_cr ?? ''} onChange={value => setForm({ ...form, value_cr: value ? parseFloat(value) : null })} />
            </Field>
            <Field name="Owner">
              <input className="input" value={form.owner ?? ''} onChange={e => setForm({ ...form, owner: e.target.value || null })} />
            </Field>
            <Field name="Location">
              <input className="input" value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value || null })} />
            </Field>
            <Field name="Notes">
              <input className="input" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value || null })} />
            </Field>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setShowEquipmentReference(false); }} className="btn-steel">CANCEL</button>
              <button type="submit" className="btn-amber">{editing ? 'UPDATE' : 'SAVE'}</button>
            </div>
          </form>
        );

        if (showForm) {
          return (
            <div className="flex flex-col xl:flex-row gap-4 items-start">
              {itemForm}
              {showEquipmentReference && (
                <div className="panel w-full xl:w-80 flex-shrink-0 p-3 space-y-2">
                  <div className="label">EQUIPMENT REFERENCE - CORE RULES</div>
                  {equipmentList}
                </div>
              )}
            </div>
          );
        }

        return null;
      })()}

      {/* Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-steel">
              <th className="table-header w-8">
                <input
                  type="checkbox"
                  aria-label="Select all visible inventory items"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="accent-amber"
                />
              </th>
              <th className="table-header">Item</th>
              <th className="table-header">Category</th>
              <th className="table-header text-right">Qty</th>
              <th className="table-header text-right">Mass (kg)</th>
              <th className="table-header text-right">Value (Cr)</th>
              <th className="table-header">Owner</th>
              <th className="table-header">Location</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(item => (
              <tr key={item.id} className="table-row">
                <td className="table-cell">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.name}`}
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    className="accent-amber"
                  />
                </td>
                <td className="table-cell font-bold text-bright">
                  {item.name}
                  {item.notes && <div className="text-xs text-body/70 mt-0.5">{item.notes}</div>}
                </td>
                <td className="table-cell">
                  {item.category && (
                    <span className={`text-xs border px-1.5 py-0.5 font-mono ${categoryChipClass(item.category)}`}>{item.category}</span>
                  )}
                </td>
                <td className="table-cell">
                  <div className="flex items-center justify-end gap-1 select-none">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      disabled={item.quantity <= 0}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => adjustQuantity(item, -1)}
                      className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-amber hover:text-amber disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Minus size={9} />
                    </button>
                    <span className="w-8 text-center font-mono text-amber">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => adjustQuantity(item, 1)}
                      className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-safe hover:text-safe flex items-center justify-center"
                    >
                      <Plus size={9} />
                    </button>
                  </div>
                </td>
                <td className="table-cell text-right">
                  {item.weight_kg !== null ? (item.weight_kg * item.quantity).toFixed(1) : '—'}
                </td>
                <td className="table-cell text-right">
                  {item.value_cr !== null ? (item.value_cr * item.quantity).toLocaleString() : '—'}
                </td>
                <td className="table-cell text-cyan-trav">{item.owner ?? '—'}</td>
                <td className="table-cell text-body/70">{item.location ?? '—'}</td>
                <td className="table-cell">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => startEdit(item)} className="btn-steel text-xs px-2 py-0.5">EDIT</button>
                    <button onClick={() => deleteItem(item.id)} className="text-alert/50 hover:text-alert transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-body/65 text-sm">
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
