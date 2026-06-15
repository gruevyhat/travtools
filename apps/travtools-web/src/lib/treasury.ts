import type { PartyTreasuryTransaction } from '../types';

export const TREASURY_TRANSACTION_TYPES = ['income', 'expense', 'loot', 'share', 'trade'] as const;

export type TreasuryTransactionType = typeof TREASURY_TRANSACTION_TYPES[number];
export type TreasuryTypeFilter = 'all' | TreasuryTransactionType;

export interface TreasuryFilters {
  type?: TreasuryTypeFilter;
  sessionRef?: string;
}

export interface LootSplit {
  total: number;
  participantCount: number;
  perShare: number;
  remainder: number;
}

export function formatTreasuryCr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Cr --';
  const sign = value < 0 ? '-' : '';
  return `${sign}Cr ${Math.abs(value).toLocaleString()}`;
}

export function runningBalance(transactions: Pick<PartyTreasuryTransaction, 'amount'>[]): number {
  return transactions.reduce((total, transaction) => total + transaction.amount, 0);
}

export function splitLoot(total: number, participantCount: number): LootSplit {
  const normalizedTotal = Math.max(0, Math.floor(total));
  const normalizedCount = Math.max(0, Math.floor(participantCount));
  if (normalizedCount === 0) {
    return {
      total: normalizedTotal,
      participantCount: 0,
      perShare: 0,
      remainder: normalizedTotal,
    };
  }

  const perShare = Math.floor(normalizedTotal / normalizedCount);
  return {
    total: normalizedTotal,
    participantCount: normalizedCount,
    perShare,
    remainder: normalizedTotal - perShare * normalizedCount,
  };
}

export function filterTreasuryTransactions<T extends PartyTreasuryTransaction>(
  transactions: T[],
  filters: TreasuryFilters,
): T[] {
  const sessionQuery = filters.sessionRef?.trim().toLowerCase() ?? '';
  return transactions.filter(transaction => {
    if (filters.type && filters.type !== 'all' && transaction.type !== filters.type) return false;
    if (sessionQuery && !(transaction.session_ref ?? '').toLowerCase().includes(sessionQuery)) return false;
    return true;
  });
}

export function sortTreasuryTransactions<T extends PartyTreasuryTransaction>(transactions: T[]): T[] {
  return [...transactions].sort((a, b) => {
    const byDate = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (byDate !== 0) return byDate;
    return a.description.localeCompare(b.description);
  });
}

export function runningBalancesById(transactions: PartyTreasuryTransaction[]): Map<string, number> {
  const balances = new Map<string, number>();
  const chronological = [...transactions].sort((a, b) => {
    const byDate = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (byDate !== 0) return byDate;
    return a.description.localeCompare(b.description);
  });
  let balance = 0;
  for (const transaction of chronological) {
    balance += transaction.amount;
    balances.set(transaction.id, balance);
  }
  return balances;
}

export function normalizeTransactionAmount(value: number, type: TreasuryTransactionType): number {
  const amount = Math.round(Math.abs(value));
  return type === 'expense' || type === 'share' ? -amount : amount;
}
