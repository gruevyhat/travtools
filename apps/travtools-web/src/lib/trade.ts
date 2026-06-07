import { TradeDeal } from '../types';

export type TradeStatusFilter = 'all' | TradeDeal['status'];

export interface TradeFilters {
  status?: TradeStatusFilter;
  world?: string;
}

export interface TradeSummary {
  activeCapital: number;
  realisedProfit: number;
  totalDeals: number;
}

export function formatCr(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '--';
  return `Cr ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function profit(deal: Pick<TradeDeal, 'buy_price' | 'sell_price' | 'quantity'>): number | null {
  if (deal.buy_price === null || deal.sell_price === null) return null;
  return (deal.sell_price - deal.buy_price) * deal.quantity;
}

export function sortDeals(deals: TradeDeal[]): TradeDeal[] {
  return [...deals].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function filterTradeDeals(deals: TradeDeal[], filters: TradeFilters = {}): TradeDeal[] {
  const status = filters.status ?? 'all';
  const world = filters.world?.trim().toLowerCase() ?? '';

  return deals.filter(deal => {
    if (status !== 'all' && deal.status !== status) return false;
    if (!world) return true;

    const bought = deal.world_bought?.toLowerCase() ?? '';
    const sold = deal.world_sold?.toLowerCase() ?? '';
    return bought.includes(world) || sold.includes(world);
  });
}

export function tradeSummary(deals: TradeDeal[]): TradeSummary {
  return {
    activeCapital: deals
      .filter(deal => deal.status === 'active' && deal.buy_price !== null)
      .reduce((sum, deal) => sum + (deal.buy_price! * deal.quantity), 0),
    realisedProfit: deals
      .filter(deal => deal.status === 'completed')
      .reduce((sum, deal) => sum + (profit(deal) ?? 0), 0),
    totalDeals: deals.length,
  };
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function dealsToCsv(deals: TradeDeal[]): string {
  const header = ['Item', 'Quantity', 'Buy Price', 'Sell Price', 'Profit', 'World Bought', 'World Sold', 'Status', 'Notes'];
  const rows = deals.map(deal => [
    deal.item,
    deal.quantity,
    deal.buy_price,
    deal.sell_price,
    profit(deal),
    deal.world_bought,
    deal.world_sold,
    deal.status,
    deal.notes,
  ]);

  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}
