import React, { useEffect, useState, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { InventoryItem } from '../../types';

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

const CATEGORIES = ['Weapon', 'Armour', 'Equipment', 'Medicine', 'Cargo', 'Electronics', 'Survival', 'Other'];

export default function InventoryManager() {
  const { client } = useSupabase();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ItemForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const loadItems = useCallback(async () => {
    if (!client) return;
    const { data } = await client.from('inventory_items').select('*').order('name');
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
    if (editing) {
      await client.from('inventory_items').update(form).eq('id', editing);
      setEditing(null);
    } else {
      await client.from('inventory_items').insert(form);
    }
    setForm(EMPTY);
    setShowForm(false);
  }

  async function deleteItem(id: string) {
    if (!client || !confirm('Delete this item?')) return;
    await client.from('inventory_items').delete().eq('id', id);
  }

  function startEdit(item: InventoryItem) {
    setForm({
      name: item.name, category: item.category, quantity: item.quantity,
      weight_kg: item.weight_kg, value_cr: item.value_cr, owner: item.owner,
      location: item.location, notes: item.notes,
    });
    setEditing(item.id);
    setShowForm(true);
  }

  const owners = [...new Set(items.map(i => i.owner).filter(Boolean))] as string[];

  const visible = items.filter(i => {
    if (filterOwner && i.owner !== filterOwner) return false;
    if (filterCat && i.category !== filterCat) return false;
    return true;
  });

  const totalWeight = visible.reduce((s, i) => s + (i.weight_kg ?? 0) * i.quantity, 0);
  const totalValue = visible.reduce((s, i) => s + (i.value_cr ?? 0) * i.quantity, 0);

  const F = ({ name, children }: { name: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <label className="label">{name}</label>
      {children}
    </div>
  );

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
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
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(v => !v); }}
          className="btn-amber flex items-center gap-1"
        >
          <Plus size={13} /> ADD ITEM
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={saveItem} className="panel p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 panel-header -mx-4 -mt-4 mb-1">
            {editing ? 'EDIT ITEM' : 'NEW INVENTORY ITEM'}
          </div>
          <F name="Item Name">
            <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </F>
          <F name="Category">
            <select className="select" value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value || null })}>
              <option value="">— None —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </F>
          <F name="Quantity">
            <input className="input" type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
          </F>
          <F name="Weight (kg each)">
            <input className="input" type="number" step="0.001" value={form.weight_kg ?? ''} onChange={e => setForm({ ...form, weight_kg: e.target.value ? parseFloat(e.target.value) : null })} />
          </F>
          <F name="Value (Cr each)">
            <input className="input" type="number" step="0.01" value={form.value_cr ?? ''} onChange={e => setForm({ ...form, value_cr: e.target.value ? parseFloat(e.target.value) : null })} />
          </F>
          <F name="Owner">
            <input className="input" value={form.owner ?? ''} onChange={e => setForm({ ...form, owner: e.target.value || null })} />
          </F>
          <F name="Location">
            <input className="input" value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value || null })} />
          </F>
          <F name="Notes">
            <input className="input" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value || null })} />
          </F>
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="btn-steel">CANCEL</button>
            <button type="submit" className="btn-amber">{editing ? 'UPDATE' : 'SAVE'}</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-steel">
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
                <td className="table-cell font-bold text-bright">
                  {item.name}
                  {item.notes && <div className="text-xs text-body/50 mt-0.5">{item.notes}</div>}
                </td>
                <td className="table-cell">
                  {item.category && (
                    <span className="text-xs border border-steel px-1.5 py-0.5 text-body">{item.category}</span>
                  )}
                </td>
                <td className="table-cell text-right">{item.quantity}</td>
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
                <td colSpan={8} className="px-4 py-8 text-center text-body/40 text-sm">
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
