import React, { useEffect, useState, useCallback } from 'react';
import { Download, Plus, X, Check } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { TradeDeal } from '../../types';
import {
  dealsToCsv,
  filterTradeDeals,
  formatCr,
  profit,
  sortDeals,
  tradeSummary,
} from '../../lib/trade';

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
  const [worldFilter, setWorldFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DealForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDeals = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client.from('trade_deals').select('*').order('created_at', { ascending: false });
    if (error) {
      setErrorMessage(`Trade deals could not be loaded: ${error.message}`);
      return;
    }
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
        setErrorMessage(`Trade deal could not be updated: ${error.message}`);
        if (previous) setDeals(prev => sortDeals(prev.map(d => d.id === editingId ? previous : d)));
        loadDeals();
        return;
      }
      if (data) setDeals(prev => sortDeals(prev.map(d => d.id === editingId ? data as TradeDeal : d)));
      return;
    } else {
      const { data, error } = await client.from('trade_deals').insert(form).select().single();
      if (error) {
        setErrorMessage(`Trade deal could not be added: ${error.message}`);
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
      setErrorMessage(`Trade deal could not be deleted: ${error.message}`);
      if (previous) setDeals(prev => sortDeals([...prev, previous]));
      loadDeals();
    }
  }

  async function completeDeal(id: string) {
    if (!client || !sellPrice) return;
    const parsedSellPrice = parseFloat(sellPrice);
    if (Number.isNaN(parsedSellPrice)) {
      setErrorMessage('Enter a valid sell price.');
      return;
    }

    const previous = deals.find(d => d.id === id);
    const updated_at = new Date().toISOString();
    const patch = {
      status: 'completed',
      sell_price: parsedSellPrice,
      updated_at,
    } satisfies Partial<TradeDeal>;

    setDeals(prev => sortDeals(prev.map(d => d.id === id ? { ...d, ...patch } : d)));
    setCompletingId(null);
    setSellPrice('');

    const { data, error } = await client.from('trade_deals').update(patch).eq('id', id).select().single();
    if (error) {
      setErrorMessage(`Trade deal could not be completed: ${error.message}`);
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
      setErrorMessage(`Trade deal could not be cancelled: ${error.message}`);
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

  function exportCsv() {
    const csv = dealsToCsv(visible);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'travtools-trade-ledger.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const visible = filterTradeDeals(deals, { status: filter, world: worldFilter });
  const summary = tradeSummary(deals);

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {errorMessage && (
        <div role="alert" className="border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss trade error" className="hover:text-bright">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'ACTIVE CAPITAL', value: formatCr(summary.activeCapital), color: 'text-amber' },
          { label: 'REALISED PROFIT', value: formatCr(summary.realisedProfit), color: summary.realisedProfit >= 0 ? 'text-safe' : 'text-alert' },
          { label: 'TOTAL DEALS', value: String(summary.totalDeals), color: 'text-cyan-trav' },
        ].map(({ label, value, color }) => (
          <div key={label} className="panel p-3">
            <div className="label mb-1">{label}</div>
            <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'active', 'completed', 'cancelled'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn text-xs ${filter === s ? 'btn-amber' : 'btn-steel'}`}
            >
              {s.toUpperCase()}
            </button>
          ))}
          <label className="flex items-center gap-2">
            <span className="label">WORLD</span>
            <input
              aria-label="World Filter"
              className="input w-44 py-1 text-xs"
              value={worldFilter}
              onChange={e => setWorldFilter(e.target.value)}
              placeholder="Bought or sold"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="btn-steel flex items-center gap-1"
          >
            <Download size={13} /> EXPORT CSV
          </button>
          <button
            onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(v => !v); }}
            className="btn-amber flex items-center gap-1"
          >
            <Plus size={13} /> NEW DEAL
          </button>
        </div>
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
            <input className="input" type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: Math.max(0, parseInt(e.target.value) || 0) })} />
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
                    {p === null ? '--' : `${p >= 0 ? '+' : ''}${formatCr(p)}`}
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
                            <button type="button" aria-label={`Complete sale for ${deal.item}`} onClick={() => completeDeal(deal.id)} className="text-safe hover:text-safe"><Check size={13} /></button>
                            <button type="button" aria-label={`Cancel sale for ${deal.item}`} onClick={() => setCompletingId(null)} className="text-body hover:text-amber"><X size={13} /></button>
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
