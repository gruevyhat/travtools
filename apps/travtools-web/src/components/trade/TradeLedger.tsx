import React, { Suspense, lazy, useEffect, useRef, useState, useCallback } from 'react';
import { Download, Plus, Search, Upload, X, Check } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { Character, TradeDeal } from '../../types';
import {
  dealsToCsv,
  filterTradeDeals,
  formatTradeCodeList,
  formatTradeDmString,
  formatCr,
  profit,
  sortDeals,
  tradeSummary,
} from '../../lib/trade';
import { downloadCsv, parseCsvRows } from '../../lib/csv';
import { TRADE_GOODS, searchTradeGoods, formatBasePrice } from '../../data/tradeGoods';
import type { TradeDealDraft } from './TradeMiniGame';
import NumberStepper from '../shared/NumberStepper';

const TradeSessionPanel = lazy(() => import('./TradeMiniGame').then(module => ({ default: module.TradeSessionPanel })));
const PassengersFreightPanel = lazy(() => import('./TradeMiniGame').then(module => ({ default: module.PassengersFreightPanel })));

type Status = 'all' | 'active' | 'completed' | 'cancelled';
type TradeTab = 'deals' | 'session' | 'traffic';
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
  const [characters, setCharacters] = useState<Character[]>([]);
  const [filter, setFilter] = useState<Status>('all');
  const [worldFilter, setWorldFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DealForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tradeQuery, setTradeQuery] = useState('');
  const [showTradeGoods, setShowTradeGoods] = useState(false);
  const [activeTab, setActiveTab] = useState<TradeTab>('deals');
  const [sessionBusy, setSessionBusy] = useState(false);
  const csvImportRef = useRef<HTMLInputElement>(null);

  const loadDeals = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client.from('trade_deals').select('*').order('created_at', { ascending: false });
    if (error) {
      setErrorMessage(`Trade deals could not be loaded: ${error.message}`);
      return;
    }
    if (data) setDeals(data as TradeDeal[]);
  }, [client]);

  const loadCharacters = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client.from('characters').select('*').order('name', { ascending: true });
    if (error) {
      setErrorMessage(`Roster could not be loaded for trade checks: ${error.message}`);
      return;
    }
    if (data) setCharacters(data as Character[]);
  }, [client]);

  useEffect(() => {
    loadDeals();
    if (!client) return;
    const tradeChannel = client
      .channel('trade-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_deals' }, loadDeals)
      .subscribe();
    return () => {
      client.removeChannel(tradeChannel);
    };
  }, [client, loadDeals]);

  useEffect(() => {
    if (activeTab === 'deals') return;
    loadCharacters();
    if (!client) return;
    const characterChannel = client
      .channel('trade-roster-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, loadCharacters)
      .subscribe();
    return () => {
      client.removeChannel(characterChannel);
    };
  }, [activeTab, client, loadCharacters]);

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

  async function createSessionDeals(payloads: TradeDealDraft[]) {
    if (!client || payloads.length === 0) return;
    setSessionBusy(true);
    const inserted: TradeDeal[] = [];
    for (const payload of payloads) {
      const { data, error } = await client.from('trade_deals').insert(payload).select().single();
      if (error) {
        setErrorMessage(`Trade session deal could not be added: ${error.message}`);
        setSessionBusy(false);
        if (inserted.length > 0) setDeals(prev => sortDeals([...inserted, ...prev]));
        return;
      }
      if (data) inserted.push(data as TradeDeal);
    }
    setDeals(prev => sortDeals([...inserted, ...prev]));
    setSessionBusy(false);
  }

  async function updateSessionDeal(id: string, patch: Partial<TradeDeal>) {
    if (!client) return;
    const previous = deals.find(d => d.id === id);
    const payload = { ...patch, updated_at: patch.updated_at ?? new Date().toISOString() };
    setSessionBusy(true);
    setDeals(prev => sortDeals(prev.map(d => d.id === id ? { ...d, ...payload } : d)));
    const { data, error } = await client.from('trade_deals').update(payload).eq('id', id).select().single();
    setSessionBusy(false);
    if (error) {
      setErrorMessage(`Trade session deal could not be updated: ${error.message}`);
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
    downloadCsv('travtools-trade-ledger.csv', dealsToCsv(visible));
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
    const newDeals: Omit<TradeDeal, 'id' | 'created_at' | 'updated_at'>[] = rows.slice(1).flatMap(row => {
      const item = get(row, 'item');
      if (!item) return [];
      const qty = parseInt(get(row, 'quantity'));
      const buyRaw = get(row, 'buyprice');
      const sellRaw = get(row, 'sellprice');
      const statusRaw = get(row, 'status');
      const validStatus = ['active', 'completed', 'cancelled'];
      return [{
        item,
        quantity: isNaN(qty) ? 1 : qty,
        buy_price: buyRaw ? parseFloat(buyRaw) : null,
        sell_price: sellRaw ? parseFloat(sellRaw) : null,
        status: (validStatus.includes(statusRaw) ? statusRaw : 'active') as TradeDeal['status'],
        world_bought: get(row, 'worldbought') || null,
        world_sold: get(row, 'worldsold') || null,
        notes: get(row, 'notes') || null,
      }];
    });
    if (newDeals.length === 0) return;
    const { error } = await client.from('trade_deals').insert(newDeals);
    if (error) setErrorMessage(`CSV import failed: ${error.message}`);
  }

  function populateDealFromTradeGood(type: string, basePrice: number | null) {
    setForm({ ...EMPTY, item: type, buy_price: basePrice });
    setEditing(null);
    setShowForm(true);
  }

  const visible = filterTradeDeals(deals, { status: filter, world: worldFilter });
  const summary = tradeSummary(deals);

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <input ref={csvImportRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvImport} />
      {errorMessage && (
        <div role="alert" className="border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss trade error" className="hover:text-bright">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-steel/50 pb-3">
        {([
          ['deals', 'DEALS LEDGER'],
          ['session', 'TRADE SESSION'],
          ['traffic', 'PASSENGERS & FREIGHT'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`btn text-xs ${activeTab === tab ? 'btn-amber' : 'btn-steel'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'deals' && (
        <>

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
          <button type="button" onClick={() => csvImportRef.current?.click()} className="btn-steel flex items-center gap-1">
            <Upload size={13} /> IMPORT CSV
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="btn-steel flex items-center gap-1"
          >
            <Download size={13} /> EXPORT CSV
          </button>
          <button
            type="button"
            onClick={() => setShowTradeGoods(v => !v)}
            className={`btn-steel flex items-center gap-1 ${showTradeGoods && !showForm ? 'btn-amber' : ''}`}
          >
            TRADE GOODS
          </button>
          <button
            onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(v => !v); }}
            className="btn-amber flex items-center gap-1"
          >
            <Plus size={13} /> NEW DEAL
          </button>
        </div>
      </div>

      {/* Trade goods list — extracted so it can appear in two positions */}
      {(() => {
        const goodsList = (
          <div className="space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-body/65 pointer-events-none" />
              <input
                className="input pl-6 text-xs"
                placeholder="Search type, trade code, d66…"
                value={tradeQuery}
                onChange={e => setTradeQuery(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: showForm ? '28rem' : '24rem' }}>
              {searchTradeGoods(tradeQuery).map(g => (
                <button
                  key={g.d66}
                  type="button"
                  onClick={() => populateDealFromTradeGood(g.type, g.basePrice)}
                  className="w-full text-left border border-steel/40 rounded p-2 text-xs space-y-1 hover:border-amber/60 hover:bg-steel/20 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-body/70 w-6">{g.d66}</span>
                    <span className="font-mono text-bright flex-1 group-hover:text-amber">{g.type}</span>
                    {g.illegal && <span className="text-[9px] font-mono text-alert border border-alert/50 px-1">ILLEGAL</span>}
                    {g.exotic && <span className="text-[9px] font-mono text-cyan-trav border border-cyan-trav/50 px-1">EXOTIC</span>}
                  </div>
                  <div className="flex gap-4 text-[10px] pl-8">
                    <span className="text-body/65">{formatTradeCodeList(g.availability)}</span>
                    {!g.exotic && (
                      <>
                        <span className="text-body/70">TONS <span className="text-bright">{g.tons}</span></span>
                        <span className="text-body/70">BASE <span className="text-cyan-trav">{formatBasePrice(g.basePrice)}</span></span>
                      </>
                    )}
                  </div>
                  {!g.exotic && (
                    <div className="text-[10px] pl-8 space-y-0.5">
                      <div><span className="text-body/55">BUY </span><span className="text-body/60">{formatTradeDmString(g.purchaseDM)}</span></div>
                      <div><span className="text-body/55">SELL </span><span className="text-body/60">{formatTradeDmString(g.saleDM)}</span></div>
                    </div>
                  )}
                </button>
              ))}
              {searchTradeGoods(tradeQuery).length === 0 && (
                <div className="text-body/65 text-center py-4">No matching trade goods.</div>
              )}
            </div>
          </div>
        );

        if (showForm) {
          return (
            <div className="flex gap-4 items-start">
              {/* Deal form */}
              <form onSubmit={saveDeal} className="panel p-4 grid grid-cols-2 gap-3 flex-1 min-w-0">
                <div className="col-span-2 panel-header -mx-4 -mt-4 mb-1">
                  {editing ? 'EDIT DEAL' : 'NEW TRADE DEAL'}
                </div>
                <Field name="Item / Cargo">
                  <input className="input" required value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} />
                </Field>
                <Field name="Quantity">
                  <NumberStepper ariaLabel="Quantity" min={0} value={form.quantity} onChange={value => setForm({ ...form, quantity: Math.max(0, parseInt(value, 10) || 0) })} />
                </Field>
                <Field name="Buy Price (Cr/unit)">
                  <NumberStepper ariaLabel="Buy Price (Cr/unit)" step="0.01" value={form.buy_price ?? ''} onChange={value => setForm({ ...form, buy_price: value ? parseFloat(value) : null })} />
                </Field>
                <Field name="Sell Price (Cr/unit)">
                  <NumberStepper ariaLabel="Sell Price (Cr/unit)" step="0.01" value={form.sell_price ?? ''} onChange={value => setForm({ ...form, sell_price: value ? parseFloat(value) : null })} />
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

              {/* Trade goods side panel */}
              <div className="panel w-72 flex-shrink-0 p-3 space-y-2">
                <div className="label">TRADE GOODS · p.244–245</div>
                {goodsList}
              </div>
            </div>
          );
        }

        if (!showTradeGoods) return null;
        return (
          <div className="panel p-3 space-y-2">
            <div className="label">TRADE GOODS REFERENCE — {TRADE_GOODS.length} ENTRIES · p.244–245</div>
            {goodsList}
          </div>
        );
      })()}

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
                    {deal.notes && <div className="text-xs text-body/70 mt-0.5">{deal.notes}</div>}
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
                <td colSpan={8} className="px-4 py-8 text-center text-body/65 text-sm">
                  No deals found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {activeTab !== 'deals' && (
        <Suspense fallback={<div className="panel p-4 text-xs font-mono tracking-widest text-amber">LOADING TRADE TOOLS...</div>}>
          {activeTab === 'session' && (
            <TradeSessionPanel
              deals={deals}
              characters={characters}
              onCreateDeals={createSessionDeals}
              onUpdateDeal={updateSessionDeal}
              busy={sessionBusy}
            />
          )}

          {activeTab === 'traffic' && <PassengersFreightPanel characters={characters} />}
        </Suspense>
      )}
    </div>
  );
}
