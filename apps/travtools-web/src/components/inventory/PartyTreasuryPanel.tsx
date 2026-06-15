import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Plus, Users, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import {
  characterOwnerOptions,
  type InventoryCharacter,
} from '../../lib/inventory';
import {
  filterTreasuryTransactions,
  formatTreasuryCr,
  normalizeTransactionAmount,
  runningBalance,
  runningBalancesById,
  sortTreasuryTransactions,
  splitLoot,
  TREASURY_TRANSACTION_TYPES,
  type TreasuryTransactionType,
  type TreasuryTypeFilter,
} from '../../lib/treasury';
import type { PartyTreasuryTransaction } from '../../types';

interface PartyTreasuryPanelProps {
  characters: InventoryCharacter[];
}

interface TransactionForm {
  amount: string;
  type: TreasuryTransactionType;
  description: string;
  character_id: string;
  session_ref: string;
}

interface SplitForm {
  total: string;
  description: string;
  session_ref: string;
  selectedIds: string[];
}

const EMPTY_TRANSACTION_FORM: TransactionForm = {
  amount: '',
  type: 'income',
  description: '',
  character_id: '',
  session_ref: '',
};

const EMPTY_SPLIT_FORM: SplitForm = {
  total: '',
  description: '',
  session_ref: '',
  selectedIds: [],
};

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className="label block">{name}</span>
      {children}
    </label>
  );
}

function typeLabel(type: TreasuryTransactionType): string {
  switch (type) {
    case 'income': return 'Income';
    case 'expense': return 'Expense';
    case 'loot': return 'Loot';
    case 'share': return 'Share';
    case 'trade': return 'Trade';
  }
}

function typeChipClass(type: TreasuryTransactionType): string {
  switch (type) {
    case 'income': return 'border-safe/60 text-safe bg-safe/10';
    case 'expense': return 'border-alert/60 text-alert bg-alert/10';
    case 'loot': return 'border-amber/70 text-amber bg-amber/10';
    case 'share': return 'border-cyan-trav/50 text-cyan-trav bg-cyan-trav/10';
    case 'trade': return 'border-steel text-bright bg-steel/20';
  }
}

function compactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PartyTreasuryPanel({ characters }: PartyTreasuryPanelProps) {
  const { client, canEdit } = useSupabase();
  const [transactions, setTransactions] = useState<PartyTreasuryTransaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [form, setForm] = useState<TransactionForm>(EMPTY_TRANSACTION_FORM);
  const [splitForm, setSplitForm] = useState<SplitForm>(EMPTY_SPLIT_FORM);
  const [typeFilter, setTypeFilter] = useState<TreasuryTypeFilter>('all');
  const [sessionFilter, setSessionFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client
      .from('party_treasury')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setErrorMessage(`Party treasury could not be loaded: ${error.message}`);
      return;
    }
    if (data) setTransactions(sortTreasuryTransactions(data as PartyTreasuryTransaction[]));
  }, [client]);

  useEffect(() => {
    loadTransactions();
    if (!client) return;
    const channel = client
      .channel('party-treasury-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_treasury' }, loadTransactions)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, loadTransactions]);

  const characterOptions = useMemo(() => characterOwnerOptions(characters), [characters]);
  const activeCharacterOptions = useMemo(
    () => characterOwnerOptions(characters.filter(character => character.status !== 'deceased')),
    [characters],
  );
  const characterNameById = useMemo(
    () => new Map(characterOptions.map(option => [option.id, option.label])),
    [characterOptions],
  );
  const filteredTransactions = useMemo(
    () => filterTreasuryTransactions(transactions, { type: typeFilter, sessionRef: sessionFilter }),
    [sessionFilter, transactions, typeFilter],
  );
  const runningBalances = useMemo(() => runningBalancesById(transactions), [transactions]);
  const balance = runningBalance(transactions);
  const latestTransaction = transactions[0] ?? null;
  const split = splitLoot(parseInt(splitForm.total, 10) || 0, splitForm.selectedIds.length);

  function openSplit() {
    setShowForm(false);
    setShowSplit(value => {
      const next = !value;
      if (next) {
        setSplitForm({
          ...EMPTY_SPLIT_FORM,
          selectedIds: activeCharacterOptions.map(option => option.id),
        });
      }
      return next;
    });
  }

  function resetForms() {
    setForm(EMPTY_TRANSACTION_FORM);
    setSplitForm(EMPTY_SPLIT_FORM);
    setShowForm(false);
    setShowSplit(false);
  }

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!client || busy) return;
    const parsedAmount = parseFloat(form.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Enter a positive transaction amount.');
      return;
    }
    const description = form.description.trim();
    if (!description) {
      setErrorMessage('Enter a transaction description.');
      return;
    }

    const payload = {
      amount: normalizeTransactionAmount(parsedAmount, form.type),
      type: form.type,
      description,
      character_id: form.character_id || null,
      session_ref: form.session_ref.trim() || null,
    };

    setBusy(true);
    setErrorMessage(null);
    const { data, error } = await client.from('party_treasury').insert(payload).select().single();
    setBusy(false);
    if (error) {
      setErrorMessage(`Transaction could not be added: ${error.message}`);
      return;
    }
    if (data) setTransactions(prev => sortTreasuryTransactions([data as PartyTreasuryTransaction, ...prev]));
    resetForms();
  }

  async function submitSplit(e: React.FormEvent) {
    e.preventDefault();
    if (!client || busy) return;
    const total = parseInt(splitForm.total, 10);
    if (!Number.isFinite(total) || total <= 0) {
      setErrorMessage('Enter a positive loot total.');
      return;
    }
    if (splitForm.selectedIds.length === 0) {
      setErrorMessage('Select at least one character for the loot split.');
      return;
    }

    const description = splitForm.description.trim() || 'Loot split';
    const session_ref = splitForm.session_ref.trim() || null;
    const result = splitLoot(total, splitForm.selectedIds.length);
    const payloads = [
      {
        amount: result.total,
        type: 'loot' as const,
        description,
        character_id: null,
        session_ref,
      },
      ...splitForm.selectedIds.map(characterId => ({
        amount: -result.perShare,
        type: 'share' as const,
        description: `${description} share`,
        character_id: characterId,
        session_ref,
      })),
    ];

    setBusy(true);
    setErrorMessage(null);
    const { data, error } = await client.from('party_treasury').insert(payloads).select();
    setBusy(false);
    if (error) {
      setErrorMessage(`Loot split could not be recorded: ${error.message}`);
      return;
    }
    if (data) setTransactions(prev => sortTreasuryTransactions([...(data as PartyTreasuryTransaction[]), ...prev]));
    resetForms();
  }

  function toggleSplitParticipant(id: string) {
    setSplitForm(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter(existing => existing !== id)
        : [...prev.selectedIds, id],
    }));
  }

  return (
    <section className="panel p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="label mb-1">PARTY TREASURY</div>
          <div className={`text-2xl font-mono font-bold ${balance >= 0 ? 'text-safe' : 'text-alert'}`}>
            {formatTreasuryCr(balance)}
          </div>
          <div className="text-[10px] text-body/60 font-mono mt-1">
            {latestTransaction
              ? `LAST ${typeLabel(latestTransaction.type).toUpperCase()} ${compactDate(latestTransaction.created_at)}`
              : 'NO TRANSACTIONS RECORDED'}
          </div>
        </div>
        {canEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[9rem_9rem] gap-2">
            <button
              type="button"
              onClick={() => {
                setShowSplit(false);
                setShowForm(value => !value);
              }}
              className="btn-amber flex items-center justify-center gap-1"
            >
              <Plus size={13} /> TRANSACTION
            </button>
            <button
              type="button"
              onClick={openSplit}
              className="btn-steel flex items-center justify-center gap-1"
            >
              <Users size={13} /> SPLIT LOOT
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div role="alert" className="border border-alert/70 text-alert px-3 py-2 text-xs font-mono flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-alert/60 hover:text-alert">
            <X size={13} />
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={addTransaction} className="border border-steel/60 p-3 grid grid-cols-1 md:grid-cols-5 gap-3">
          <Field name="Amount">
            <input
              className="input"
              inputMode="numeric"
              required
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="25000"
            />
          </Field>
          <Field name="Type">
            <select
              className="select"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as TreasuryTransactionType })}
            >
              {TREASURY_TRANSACTION_TYPES.map(type => (
                <option key={type} value={type}>{typeLabel(type)}</option>
              ))}
            </select>
          </Field>
          <Field name="Description">
            <input
              className="input"
              required
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Freight payout"
            />
          </Field>
          <Field name="Character">
            <select
              className="select"
              value={form.character_id}
              onChange={e => setForm({ ...form, character_id: e.target.value })}
            >
              <option value="">Party-wide</option>
              {characterOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </Field>
          <Field name="Session">
            <input
              className="input"
              value={form.session_ref}
              onChange={e => setForm({ ...form, session_ref: e.target.value })}
              placeholder="Session 12"
            />
          </Field>
          <div className="md:col-span-5 flex justify-end gap-2">
            <button type="button" onClick={resetForms} className="btn-steel">CANCEL</button>
            <button type="submit" disabled={busy} className="btn-amber flex items-center gap-1">
              <Check size={13} /> {busy ? 'SAVING...' : 'SAVE'}
            </button>
          </div>
        </form>
      )}

      {showSplit && (
        <form onSubmit={submitSplit} className="border border-amber/40 p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field name="Loot Total">
              <input
                className="input"
                inputMode="numeric"
                required
                value={splitForm.total}
                onChange={e => setSplitForm({ ...splitForm, total: e.target.value })}
                placeholder="10000"
              />
            </Field>
            <Field name="Description">
              <input
                className="input"
                value={splitForm.description}
                onChange={e => setSplitForm({ ...splitForm, description: e.target.value })}
                placeholder="Recovered cargo"
              />
            </Field>
            <Field name="Session">
              <input
                className="input"
                value={splitForm.session_ref}
                onChange={e => setSplitForm({ ...splitForm, session_ref: e.target.value })}
                placeholder="Session 12"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_16rem] gap-3">
            <div>
              <div className="label mb-2">PARTICIPANTS</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                {activeCharacterOptions.map(option => (
                  <label key={option.id} className="border border-steel/50 px-2 py-1.5 text-xs font-mono text-bright flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-amber"
                      checked={splitForm.selectedIds.includes(option.id)}
                      onChange={() => toggleSplitParticipant(option.id)}
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                ))}
                {activeCharacterOptions.length === 0 && (
                  <div className="text-xs text-body/60 font-mono border border-steel/50 px-2 py-3">
                    No active roster characters.
                  </div>
                )}
              </div>
            </div>
            <div className="border border-steel/50 p-3 font-mono text-xs space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-body/65">PARTICIPANTS</span>
                <span className="text-bright">{split.participantCount}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-body/65">PER SHARE</span>
                <span className="text-cyan-trav">{formatTreasuryCr(split.perShare)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-body/65">REMAINDER</span>
                <span className="text-amber">{formatTreasuryCr(split.remainder)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForms} className="btn-steel">CANCEL</button>
            <button type="submit" disabled={busy || split.participantCount === 0} className="btn-amber flex items-center gap-1">
              <Check size={13} /> {busy ? 'POSTING...' : 'POST SPLIT'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-2">
        <select
          className="select md:w-44 py-1 text-xs"
          aria-label="Treasury type filter"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TreasuryTypeFilter)}
        >
          <option value="all">All treasury types</option>
          {TREASURY_TRANSACTION_TYPES.map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}
        </select>
        <input
          className="input md:w-52 py-1 text-xs"
          aria-label="Treasury session filter"
          value={sessionFilter}
          onChange={e => setSessionFilter(e.target.value)}
          placeholder="Filter session"
        />
        <div className="flex-1" />
        <div className="text-[10px] font-mono text-body/60 self-center">
          {filteredTransactions.length} / {transactions.length} ENTRIES
        </div>
      </div>

      <div className="overflow-x-auto border border-steel/60">
        <table className="w-full">
          <thead>
            <tr className="border-b border-steel">
              <th className="table-header">Date</th>
              <th className="table-header">Type</th>
              <th className="table-header">Description</th>
              <th className="table-header">Character</th>
              <th className="table-header text-right">Amount</th>
              <th className="table-header text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(transaction => (
              <tr key={transaction.id} className="table-row">
                <td className="table-cell text-body/75 whitespace-nowrap">{compactDate(transaction.created_at)}</td>
                <td className="table-cell">
                  <span className={`status-tag ${typeChipClass(transaction.type)}`}>
                    {typeLabel(transaction.type).toUpperCase()}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="text-bright">{transaction.description}</div>
                  {transaction.session_ref && (
                    <div className="text-[10px] text-body/55 mt-0.5">{transaction.session_ref}</div>
                  )}
                </td>
                <td className="table-cell text-cyan-trav">
                  {transaction.character_id ? characterNameById.get(transaction.character_id) ?? 'Unknown' : 'Party'}
                </td>
                <td className={`table-cell text-right ${transaction.amount < 0 ? 'text-alert' : 'text-safe'}`}>
                  {formatTreasuryCr(transaction.amount)}
                </td>
                <td className="table-cell text-right text-amber">
                  {formatTreasuryCr(runningBalances.get(transaction.id) ?? null)}
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-body/65 text-sm">
                  No treasury entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
