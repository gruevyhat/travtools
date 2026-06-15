import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CircleDot,
  Package,
  Radar,
  ScrollText,
  Ship,
  Swords,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { COMBAT_MODULE_DISABLED } from '../../lib/moduleFlags';
import { formatTreasuryCr, runningBalance } from '../../lib/treasury';
import { CANONICAL_SHIPS } from '../ships/canonicalShips';

interface LandingStats {
  characters: number | null;
  ships: number | null;
  activeDeals: number | null;
  inventory: number | null;
  treasuryBalance: number | null;
  latestRoll: string | null;
}

interface ModuleLink {
  to: string;
  label: string;
  signal: string;
  Icon: LucideIcon;
  disabled?: boolean;
}

const INITIAL_STATS: LandingStats = {
  characters: null,
  ships: null,
  activeDeals: null,
  inventory: null,
  treasuryBalance: null,
  latestRoll: null,
};

const MODULES: ModuleLink[] = [
  { to: '/roster', label: 'ROSTER', signal: 'CREW', Icon: Users },
  { to: '/ships', label: 'SHIPS', signal: 'HULLS', Icon: Ship },
  { to: '/trade', label: 'TRADE', signal: 'CARGO', Icon: TrendingUp },
  { to: '/inventory', label: 'INVENTORY', signal: 'GEAR', Icon: Package },
  { to: '/log', label: 'ROLL LOG', signal: 'DICE', Icon: ScrollText },
  { to: '/combat', label: 'COMBAT', signal: COMBAT_MODULE_DISABLED ? 'OFFLINE' : 'COMBAT', Icon: Swords, disabled: COMBAT_MODULE_DISABLED },
  { to: '/journal', label: 'JOURNAL', signal: 'LOG', Icon: BookOpen },
];

function displayCount(value: number | null) {
  return value === null ? '--' : String(value).padStart(2, '0');
}

export default function LandingPage() {
  const { client } = useSupabase();
  const [stats, setStats] = useState<LandingStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    const [characters, ships, activeDeals, inventory, treasury, latestRoll] = await Promise.all([
      client.from('characters').select('*', { count: 'exact', head: true }),
      client.from('ships').select('*', { count: 'exact', head: true }),
      client.from('trade_deals').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      client.from('inventory_items').select('*', { count: 'exact', head: true }),
      client.from('party_treasury').select('amount'),
      client
        .from('roll_log')
        .select('character_name,check_label,total,created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setStats({
      characters: characters.count ?? null,
      ships: ships.count ?? null,
      activeDeals: activeDeals.count ?? null,
      inventory: inventory.count ?? null,
      treasuryBalance: treasury.data
        ? runningBalance((treasury.data as Array<{ amount: number }>).map(row => ({ amount: row.amount })))
        : null,
      latestRoll: latestRoll.data
        ? `${latestRoll.data.character_name} / ${latestRoll.data.check_label} / ${latestRoll.data.total}`
        : null,
    });
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadStats();
    if (!client) return;
    const tables = ['characters', 'ships', 'trade_deals', 'inventory_items', 'party_treasury', 'roll_log'];
    const channels = tables.map(table =>
      client
        .channel(`landing-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, loadStats)
        .subscribe()
    );
    return () => { channels.forEach(ch => client.removeChannel(ch)); };
  }, [client, loadStats]);

  const HeroShip = CANONICAL_SHIPS[1]?.Component ?? CANONICAL_SHIPS[0].Component;

  return (
    <div className="relative min-h-full overflow-hidden bg-void">
      <div className="absolute inset-0 opacity-25" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,95,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,95,0.2)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <div className="absolute right-[-28rem] top-56 w-[56rem] max-w-none opacity-20 blur-[0.5px] md:right-[-4rem] md:top-12 md:w-[58rem] md:opacity-45 lg:right-4 lg:top-10 lg:w-[62rem]" aria-hidden="true">
        <HeroShip />
      </div>

      <section className="relative min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-8 lg:px-10 flex flex-col">
        <div className="flex items-center justify-between gap-4 text-[10px] font-mono tracking-widest text-body/60">
          <div className="flex items-center gap-2">
            <Radar size={14} className="text-cyan-trav" />
            <span>JUMP OPS / ONLINE</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <CircleDot size={12} className="text-safe" />
            <span>GROUP DATABASE SYNCED</span>
          </div>
        </div>

        <div className="flex-1 grid lg:grid-cols-[minmax(0,0.95fr)_minmax(28rem,0.8fr)] gap-8 items-center pt-10 pb-6">
          <div className="max-w-3xl">
            <div className="text-cyan-trav text-xs tracking-[0.28em] font-mono mb-4">
              TRAVELLER GROUP CONSOLE
            </div>
            <h1 className="font-display text-4xl md:text-6xl text-bright font-bold tracking-wide leading-tight">
              TRAVTOOLS
            </h1>
            <p className="mt-4 max-w-2xl text-sm md:text-base text-body leading-7">
              Shared campaign operations for roster status, ship plans, trade cargo, party inventory, and table rolls.
            </p>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-3xl">
              <div className="border border-steel/70 bg-panel/80 px-3 py-3">
                <div className="text-[10px] text-body/70 tracking-widest">CREW</div>
                <div className="mt-1 text-2xl font-mono text-amber glow-amber">{displayCount(stats.characters)}</div>
              </div>
              <div className="border border-steel/70 bg-panel/80 px-3 py-3">
                <div className="text-[10px] text-body/70 tracking-widest">SHIPS</div>
                <div className="mt-1 text-2xl font-mono text-cyan-trav glow-cyan">{displayCount(stats.ships)}</div>
              </div>
              <div className="border border-steel/70 bg-panel/80 px-3 py-3">
                <div className="text-[10px] text-body/70 tracking-widest">ACTIVE TRADE</div>
                <div className="mt-1 text-2xl font-mono text-amber glow-amber">{displayCount(stats.activeDeals)}</div>
              </div>
              <div className="border border-steel/70 bg-panel/80 px-3 py-3">
                <div className="text-[10px] text-body/70 tracking-widest">GEAR</div>
                <div className="mt-1 text-2xl font-mono text-cyan-trav glow-cyan">{displayCount(stats.inventory)}</div>
              </div>
              <div className="border border-steel/70 bg-panel/80 px-3 py-3">
                <div className="text-[10px] text-body/70 tracking-widest">TREASURY</div>
                <div className={`mt-1 text-lg font-mono ${stats.treasuryBalance !== null && stats.treasuryBalance < 0 ? 'text-alert' : 'text-safe'}`}>
                  {stats.treasuryBalance === null ? 'Cr --' : formatTreasuryCr(stats.treasuryBalance)}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {MODULES.map(({ to, label, Icon, disabled }) => (
                disabled ? (
                  <button
                    key={to}
                    type="button"
                    disabled
                    className="btn-steel flex items-center gap-2 min-h-10 opacity-45 cursor-not-allowed"
                    title="Combat module disabled"
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                ) : (
                  <Link key={to} to={to} className="btn-amber flex items-center gap-2 min-h-10">
                    <Icon size={14} />
                    <span>{label}</span>
                    <ArrowRight size={13} />
                  </Link>
                )
              ))}
            </div>
          </div>

          <div className="relative min-h-[24rem] flex items-end lg:items-center">
            <div className="w-full border border-steel/70 bg-void/80 backdrop-blur-sm py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                {MODULES.map(({ to, label, signal, Icon, disabled }) => (
                  disabled ? (
                    <div
                      key={to}
                      aria-disabled="true"
                      title="Combat module disabled"
                      className="min-h-24 border-b border-steel/40 sm:border-r sm:last:border-r-0 px-4 py-4 opacity-45"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-body/60 text-xs tracking-widest">
                          <Icon size={14} />
                          <span>{signal}</span>
                        </div>
                      </div>
                      <div className="mt-5 text-xl font-display text-body/70 tracking-wide">{label}</div>
                    </div>
                  ) : (
                    <Link
                      key={to}
                      to={to}
                      className="group min-h-24 border-b border-steel/40 sm:border-r sm:last:border-r-0 px-4 py-4 hover:bg-steel/20 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-amber text-xs tracking-widest">
                          <Icon size={14} />
                          <span>{signal}</span>
                        </div>
                        <ArrowRight size={14} className="text-body/65 group-hover:text-amber transition-colors" />
                      </div>
                      <div className="mt-5 text-xl font-display text-bright tracking-wide">{label}</div>
                    </Link>
                  )
                ))}
              </div>
              <div className="px-4 pt-4 text-xs font-mono text-body/60">
                <span className="text-cyan-trav">LATEST ROLL:</span>{' '}
                {loading ? 'SCANNING...' : stats.latestRoll ?? 'NO ENTRIES'}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
