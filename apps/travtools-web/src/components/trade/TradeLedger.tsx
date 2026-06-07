import React, { useEffect, useState, useCallback } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { TradeDeal } from '../../types';

type Status = 'all' | 'active' | 'completed' | 'cancelled';
type DealForm = Omit<TradeDeal, 'id' | 'created_at' | 'updated_at'>;

const EMPTY: DealForm = {
  item: '',
  quantity: 1,
  buy_price: null,
  sell_price: null,
  status: 'active',
  world_bought: null,
  world_sold: null,
  notes: null,
};

function formatCr(n: number | null) {
  if (n === null) return '—';
  return `Cr ${n.toLocaleString()}`;
}

function profit(deal: TradeDeal): number | null {
  if (deal.buy_price === null || deal.sell_price === null) return null;
  return (deal.sell_price - deal.buy_price) * deal.quantity;
}

function sortDeals(deals: TradeDeal[]): TradeDeal[] {
  return [...deals].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className="label block">{name}</span>
      {children}
    </label>
  );
}

export default function TradeLedger() {
  const { client } = useSupabase();
  const [deals, setDeals] = useState<TradeDeal[]>([]);
  const [filter, setFilter] = useState<Status>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DealForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState('');

  const loadDeals = useCallback(async () => {
    if (!client) return;
    const { data } = await client.from('trade_deals').select('*').order('created_at', { ascending: false });
    if (data) setDeals(data as TradeDeal[]);
  }, [client]);

  useEffect(() => {
    loadDeals();
    if (!client) return;
    const channel = client
      .channel('trade-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_deals' }, loadDeals)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, loadDeals]);

  async function saveDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    if (editing) {
      const editingId = editing;
      const previous = deals.find(d => d.id === editingId);
      const updated_at = new Date().toISOString();
      const payload = { ...form, updated_at };
      const optimistic = {
        ...(previous ?? { id: editingId, created_at: updated_at }),
        ...payload,
      } as TradeDeal;

      setDeals(prev => sortDeals(prev.map(d => d.id === editingId ? optimistic : d)));
      setEditing(null);
      setForm(EMPTY);
      setShowForm(false);

      const { data, error } = await client.from('trade_deals').update(payload).eq('id', editingId).select().single();
      if (error) {
        console.error('Trade deal update failed:', error);
        if (previous) setDeals(prev => sortDeals(prev.map(d => d.id === editingId ? previous : d)));
        loadDeals();
        return;
      }
      if (data) setDeals(prev => sortDeals(prev.map(d => d.id === editingId ? data as TradeDeal : d)));
      return;
    } else {
      const { data, error } = await client.from('trade_deals').insert(form).select().single();
      if (error) {
        console.error('Trade deal insert failed:', error);
        return;
      }
      if (data) setDeals(prev => sortDeals([data as TradeDeal, ...prev]));
    }
    setForm(EMPTY);
    setShowForm(false);
  }

  async function deleteDeal(id: string) {
    if (!client || !confirm('Delete this deal?')) return;
    const previous = deals.find(d => d.id === id);
    setDeals(prev => prev.filter(d => d.id !== id));
    const { error } = await client.from('trade_deals').delete().eq('id', id);
    if (error) {
      console.error('Trade deal delete failed:', error);
      if (previous) setDeals(prev => sortDeals([...prev, previous]));
      loadDeals();
    }
  }

  async function completeDeal(id: string) {
    if (!client || !sellPrice) return;
    const previous = deals.find(d => d.id === id);
    const updated_at = new Date().toISOString();
    const patch = {
      status: 'completed',
      sell_price: parseFloat(sellPrice),
      updated_at,
    } satisfies Partial<TradeDeal>;

    setDeals(prev => sortDeals(prev.map(d => d.id === id ? { ...d, ...patch } : d)));
    setCompletingId(null);
    setSellPrice('');

    const { data, error } = await client.from('trade_deals').update(patch).eq('id', id).select().single();
    if (error) {
      console.error('Trade deal completion failed:', error);
      if (previous) setDeals(prev => sortDeals(prev.map(d => d.id === id ? previous : d)));
      loadDeals();
      return;
    }
    if (data) setDeals(prev => sortDeals(prev.map(d => d.id === id ? data as TradeDeal : d)));
  }

  async function cancelDeal(id: string) {
    if (!client) return;
    const previous = deals.find(d => d.id === id);
    const patch = { status: 'cancelled', updated_at: new Date().toISOString() } satisfies Partial<TradeDeal>;

    setDeals(prev => sortDeals(prev.map(d => d.id === id ? { ...d, ...patch } : d)));
    const { data, error } = await client.from('trade_deals').update(patch).eq('id', id).select().single();
    if (error) {
      console.error('Trade deal cancellation failed:', error);
      if (previous) setDeals(prev => sortDeals(prev.map(d => d.id === id ? previous : d)));
      loadDeals();
      return;
    }
    if (data) setDeals(prev => sortDeals(prev.map(d => d.id === id ? data as TradeDeal : d)));
  }

  function startEdit(deal: TradeDeal) {
    setForm({
      item: deal.item, quantity: deal.quantity, buy_price: deal.buy_price,
      sell_price: deal.sell_price, status: deal.status, world_bought: deal.world_bought,
      world_sold: deal.world_sold, notes: deal.notes,
    });
    setEditing(deal.id);
    setShowForm(true);
  }

  const visible = filter === 'all' ? deals : deals.filter(d => d.status === filter);
  const totalProfit = deals
    .filter(d => d.status === 'completed')
    .reduce((sum, d) => sum + (profit(d) ?? 0), 0);
  const activeValue = deals
    .filter(d => d.status === 'active' && d.buy_price !== null)
    .reduce((sum, d) => sum + (d.buy_price! * d.quantity), 0);

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'ACTIVE CAPITAL', value: `Cr ${activeValue.toLocaleString()}`, color: 'text-amber' },
          { label: 'REALISED PROFIT', value: `Cr ${totalProfit.toLocaleString()}`, color: totalProfit >= 0 ? 'text-safe' : 'text-alert' },
          { label: 'TOTAL DEALS', value: String(deals.length), color: 'text-cyan-trav' },
        ].map(({ label, value, color }) => (
          <div key={label} className="panel p-3">
            <div className="label mb-1">{label}</div>
            <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['all', 'active', 'completed', 'cancelled'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn text-xs ${filter === s ? 'btn-amber' : 'btn-steel'}`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(v => !v); }}
          className="btn-amber flex items-center gap-1"
        >
          <Plus size={13} /> NEW DEAL
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={saveDeal} className="panel p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 panel-header -mx-4 -mt-4 mb-1">
            {editing ? 'EDIT DEAL' : 'NEW TRADE DEAL'}
          </div>
          <Field name="Item / Cargo">
            <input className="input" required value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} />
          </Field>
          <Field name="Quantity">
            <input className="input" type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
          </Field>
          <Field name="Buy Price (Cr/unit)">
            <input className="input" type="number" step="0.01" value={form.buy_price ?? ''} onChange={e => setForm({ ...form, buy_price: e.target.value ? parseFloat(e.target.value) : null })} />
          </Field>
          <Field name="Sell Price (Cr/unit)">
            <input className="input" type="number" step="0.01" value={form.sell_price ?? ''} onChange={e => setForm({ ...form, sell_price: e.target.value ? parseFloat(e.target.value) : null })} />
          </Field>
          <Field name="World Bought">
            <input className="input" value={form.world_bought ?? ''} onChange={e => setForm({ ...form, world_bought: e.target.value || null })} />
          </Field>
          <Field name="World Sold">
            <input className="input" value={form.world_sold ?? ''} onChange={e => setForm({ ...form, world_sold: e.target.value || null })} />
          </Field>
          <Field name="Status">
            <select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TradeDeal['status'] })}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field name="Notes">
            <input className="input" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value || null })} />
          </Field>
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
              <th className="table-header">Qty</th>
              <th className="table-header">Buy</th>
              <th className="table-header">Sell</th>
              <th className="table-header">Profit</th>
              <th className="table-header">Worlds</th>
              <th className="table-header">Status</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(deal => {
              const p = profit(deal);
              return (
                <tr key={deal.id} className="table-row">
                  <td className="table-cell font-bold text-bright">
                    {deal.item}
                    {deal.notes && <div className="text-xs text-body/50 mt-0.5">{deal.notes}</div>}
                  </td>
                  <td className="table-cell">{deal.quantity}</td>
                  <td className="table-cell">{formatCr(deal.buy_price)}</td>
                  <td className="table-cell">{formatCr(deal.sell_price)}</td>
                  <td className={`table-cell font-bold ${p === null ? 'text-body' : p >= 0 ? 'text-safe' : 'text-alert'}`}>
                    {p === null ? '—' : `${p >= 0 ? '+' : ''}Cr ${p.toLocaleString()}`}
                  </td>
                  <td className="table-cell text-xs">
                    {deal.world_bought && <div className="text-body">{deal.world_bought}</div>}
                    {deal.world_sold && <div className="text-cyan-trav">{deal.world_sold}</div>}
                  </td>
                  <td className="table-cell">
                    <span className={`status-tag ${
                      deal.status === 'active' ? 'tag-active' :
                      deal.status === 'completed' ? 'tag-completed' : 'tag-cancelled'
                    }`}>
                      {deal.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1 justify-end">
                      {deal.status === 'active' && (
                        completingId === deal.id ? (
                          <div className="flex gap-1 items-center">
                            <input
                              autoFocus
                              className="input w-24 text-xs py-0.5"
                              placeholder="Sell price"
                              value={sellPrice}
                              onChange={e => setSellPrice(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') completeDeal(deal.id); if (e.key === 'Escape') setCompletingId(null); }}
                            />
                            <button onClick={() => completeDeal(deal.id)} className="text-safe hover:text-safe"><Check size={13} /></button>
                            <button onClick={() => setCompletingId(null)} className="text-body hover:text-amber"><X size={13} /></button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => setCompletingId(deal.id)} className="btn-steel text-xs px-2 py-0.5">SELL</button>
                            <button onClick={() => cancelDeal(deal.id)} className="btn-danger text-xs px-2 py-0.5">✕</button>
                          </>
                        )
                      )}
                      <button onClick={() => startEdit(deal)} className="btn-steel text-xs px-2 py-0.5">EDIT</button>
                      <button onClick={() => deleteDeal(deal.id)} className="text-alert/50 hover:text-alert transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-body/40 text-sm">
                  No deals found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
