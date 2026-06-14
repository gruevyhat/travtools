import { useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronUp, Dices, X } from 'lucide-react';
import { DiceRoller } from '@dice-roller/rpg-dice-roller';
import { useSupabase } from '../../lib/supabaseContext';
import { DIFFICULTIES, fmtDM, rollD66, rollFlux, RollMode, rollTravellerCheck, TravellerRollResult, FluxRollResult } from '../../lib/dice';
import { TRADE_GOODS, TradeGood } from '../../data/tradeGoods';
import { lookupModifiedPrice, rollTonsExpr } from '../../data/modifiedPrice';
import NumberStepper from '../shared/NumberStepper';

const diceRoller = new DiceRoller();

interface GlobalToolsDrawerProps {
  open: boolean;
  onClose: () => void;
}

function roll3D6(): number[] {
  return [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)];
}

interface TradeRollResult {
  d66: number;
  d1: number;
  d2: number;
  good: TradeGood | null;
  tons: number | null;
  purchaseRoll: number[];
  purchaseDM: number;
  purchasePct: number;
  saleRoll: number[];
  saleDM: number;
  salePct: number;
}

export default function GlobalToolsDrawer({ open, onClose }: GlobalToolsDrawerProps) {
  const { client } = useSupabase();
  const [tab, setTab] = useState<'dice' | 'reference'>('dice');

  // Notation roller
  const [notation, setNotation] = useState('');
  const [notationResult, setNotationResult] = useState<{ output: string; total: number | string; rolls: string } | null>(null);
  const [notationError, setNotationError] = useState<string | null>(null);
  const [notationLogRoll, setNotationLogRoll] = useState(false);
  const [notationSaved, setNotationSaved] = useState(false);
  const [notationHelpOpen, setNotationHelpOpen] = useState(false);

  // Standard check roller
  const [label, setLabel] = useState('Standalone');
  const [modifier, setModifier] = useState('0');
  const [difficulty, setDifficulty] = useState(8);
  const [mode, setMode] = useState<RollMode>('normal');
  const [logRoll, setLogRoll] = useState(true);
  const [result, setResult] = useState<TravellerRollResult | null>(null);
  const [saved, setSaved] = useState(false);

  // Flux roller
  const [fluxResult, setFluxResult] = useState<FluxRollResult | null>(null);

  // Trade goods roller
  const [purchaseDMInput, setPurchaseDMInput] = useState('0');
  const [saleDMInput, setSaleDMInput] = useState('0');
  const [tradeRoll, setTradeRoll] = useState<TradeRollResult | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  async function saveResult(nextResult: TravellerRollResult) {
    if (!client || !logRoll) return;
    const { error } = await client.from('roll_log').insert({
      character_name: 'Session',
      check_label: nextResult.label,
      d1: nextResult.kept[0],
      d2: nextResult.kept[1],
      char_dm: 0,
      skill_level: 0,
      bonus_dm: nextResult.modifier,
      total: nextResult.total,
      difficulty: nextResult.difficulty,
      success: nextResult.success,
      effect: nextResult.effect,
    });
    if (error) setErrorMessage(`Roll could not be logged: ${error.message}`);
    else setSaved(true);
  }

  function roll() {
    const parsedModifier = parseInt(modifier, 10);
    const nextResult = rollTravellerCheck({
      label,
      difficulty,
      modifier: Number.isNaN(parsedModifier) ? 0 : parsedModifier,
      mode,
    });
    setResult(nextResult);
    setFluxResult(null);
    setSaved(false);
    setErrorMessage(null);
    saveResult(nextResult);
  }

  function doRollFlux() {
    setFluxResult(rollFlux());
    setResult(null);
  }

  async function rollNotation() {
    const expr = notation.trim();
    if (!expr) return;
    setNotationError(null);
    setNotationResult(null);
    setNotationSaved(false);
    try {
      // DiceRoller.roll() returns DiceRoll | DiceRoll[]; we use the single-expression form
      const roll = diceRoller.roll(expr) as { total: number; output: string; rolls: { rolls?: { value: number }[]; value?: number }[] };
      const rolls = roll.rolls
        .flatMap((r: { rolls?: { value: number }[]; value?: number }) =>
          r.rolls ? r.rolls.map((d: { value: number }) => d.value) : [r.value ?? 0]
        )
        .filter((v: unknown): v is number => typeof v === 'number');
      const rollStr = rolls.length > 0 ? rolls.map((v: number) => `[${v}]`).join('') : '';
      const total = roll.total;
      setNotationResult({ output: roll.output, total, rolls: rollStr });
      if (notationLogRoll && client) {
        const { error } = await client.from('roll_log').insert({
          character_name: 'Session',
          check_label: expr,
          d1: rolls[0] ?? 0,
          d2: rolls[1] ?? 0,
          char_dm: 0,
          skill_level: 0,
          bonus_dm: 0,
          total: typeof total === 'number' ? total : 0,
          difficulty: 0,
          success: true,
          effect: typeof total === 'number' ? total : 0,
        });
        if (error) setErrorMessage(`Roll could not be logged: ${error.message}`);
        else setNotationSaved(true);
      }
    } catch {
      setNotationError(`Invalid notation: "${expr}"`);
    }
  }

  function doTradeRoll() {
    const { d1, d2, d66 } = rollD66();
    const good = TRADE_GOODS.find(g => g.d66 === d66) ?? null;

    const tons = good ? rollTonsExpr(good.tons) : null;

    const purchaseDM = parseInt(purchaseDMInput, 10) || 0;
    const saleDM = parseInt(saleDMInput, 10) || 0;

    const purchaseDice = roll3D6();
    const purchaseRawTotal = purchaseDice.reduce((s, v) => s + v, 0) + purchaseDM;
    const { purchasePct } = lookupModifiedPrice(purchaseRawTotal);

    const saleDice = roll3D6();
    const saleRawTotal = saleDice.reduce((s, v) => s + v, 0) + saleDM;
    const { salePct } = lookupModifiedPrice(saleRawTotal);

    setTradeRoll({ d66, d1, d2, good, tons, purchaseRoll: purchaseDice, purchaseDM, purchasePct, saleRoll: saleDice, saleDM, salePct });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55">
      <button type="button" aria-label="Close global tools backdrop" className="flex-1 cursor-default" onClick={onClose} />
      <aside className="h-full w-full max-w-md border-l border-steel bg-panel shadow-2xl flex flex-col">
        <div className="panel-header flex items-center justify-between border-b border-steel">
          <span>SESSION TOOLS</span>
          <button type="button" aria-label="Close session tools" onClick={onClose} className="text-body hover:text-amber">
            <X size={14} />
          </button>
        </div>

        {errorMessage && (
          <div role="alert" className="border-b border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss tools error">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex border-b border-steel">
          {[
            { id: 'dice' as const, label: 'DICE', Icon: Dices },
            { id: 'reference' as const, label: 'REFERENCE', Icon: BookOpen },
          ].map(({ id, label: tabLabel, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 px-3 py-2 text-xs font-mono tracking-widest flex items-center justify-center gap-2 ${
                tab === id ? 'text-amber border-b-2 border-amber' : 'text-body hover:text-bright'
              }`}
            >
              <Icon size={13} />
              {tabLabel}
            </button>
          ))}
        </div>

        {tab === 'dice' ? (
          <div className="p-4 space-y-5 overflow-auto">
            {/* ── 2D6 Check ─────────────────────────────── */}
            <section className="space-y-3">
              <div className="label">2D6 CHECK</div>

              <label className="block space-y-1">
                <span className="label">CHECK LABEL</span>
                <input className="input" value={label} onChange={e => setLabel(e.target.value)} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="block space-y-1">
                  <label className="label" htmlFor="standalone-modifier">MODIFIER</label>
                  <NumberStepper
                    id="standalone-modifier"
                    ariaLabel="Standalone Modifier"
                    value={modifier}
                    onChange={setModifier}
                  />
                </div>
                <label className="block space-y-1">
                  <span className="label">DIFFICULTY</span>
                  <select className="select" value={difficulty} onChange={e => setDifficulty(parseInt(e.target.value, 10))}>
                    {DIFFICULTIES.map(d => (
                      <option key={d.target} value={d.target}>{d.label} {d.target}+</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {(['normal', 'boon', 'bane'] as RollMode[]).map(nextMode => (
                  <button
                    key={nextMode}
                    type="button"
                    onClick={() => setMode(nextMode)}
                    className={`btn text-xs ${mode === nextMode ? 'btn-amber' : 'btn-steel'}`}
                  >
                    {nextMode.toUpperCase()}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-body">
                <input type="checkbox" checked={logRoll} onChange={e => setLogRoll(e.target.checked)} />
                <span>Log to Roll Log</span>
              </label>

              <button type="button" onClick={roll} className="btn-amber w-full text-center">
                ROLL {mode === 'normal' ? '2D6' : '3D6'}
              </button>

              {result && (
                <div className="panel p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-amber font-mono text-sm">{result.label}</div>
                      <div className="text-xs text-body/60">{result.mode.toUpperCase()} · {result.difficulty}+</div>
                    </div>
                    <div className={`h-14 w-14 border-2 flex items-center justify-center text-xl font-mono font-bold ${
                      result.success ? 'border-safe text-safe' : 'border-alert text-alert'
                    }`}>
                      {result.total}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-body/80">
                    [{result.kept.join(']+[')}] {fmtDM(result.modifier)} = {result.total}
                    {result.discarded !== null && <span className="text-body/70"> · discarded {result.discarded}</span>}
                  </div>
                  <div className={`text-xs font-mono tracking-wider ${result.success ? 'text-safe' : 'text-alert'}`}>
                    {result.success ? 'SUCCESS' : 'FAILURE'} · Effect {fmtDM(result.effect)}
                  </div>
                  {saved && (
                    <div className="text-xs text-safe flex items-center gap-1">
                      <Check size={12} /> Logged to Roll Log
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Flux Roll ─────────────────────────────── */}
            <section className="space-y-3 border-t border-steel/40 pt-4">
              <div className="label">FLUX ROLL (1D6 − 1D6)</div>
              <p className="text-xs text-body/65">Used for random events, NPC reactions, and animal encounter DMs. Range −5 to +5.</p>
              <button type="button" onClick={doRollFlux} className="btn-steel w-full">
                ROLL FLUX
              </button>
              {fluxResult && (
                <div className="panel p-3 flex items-center gap-4">
                  <div className="font-mono flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 border border-amber text-amber font-bold text-lg">{fluxResult.die1}</span>
                    <span className="text-body/60">−</span>
                    <span className="inline-flex items-center justify-center w-9 h-9 border border-steel text-body font-bold text-lg">{fluxResult.die2}</span>
                  </div>
                  <div>
                    <div className={`text-2xl font-mono font-bold ${fluxResult.result > 0 ? 'text-safe' : fluxResult.result < 0 ? 'text-alert' : 'text-body'}`}>
                      {fmtDM(fluxResult.result)}
                    </div>
                    <div className="text-xs text-body/60">FLUX RESULT</div>
                  </div>
                </div>
              )}
            </section>

            {/* ── Trade Goods Roller ────────────────────── */}
            <section className="space-y-3 border-t border-steel/40 pt-4">
              <div className="label">TRADE GOODS ROLLER (p.243–245)</div>
              <p className="text-xs text-body/65">Roll D66 to find available cargo. Add applicable trade code DMs, then roll 3D6 for price.</p>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="label">PURCHASE DM</span>
                  <NumberStepper ariaLabel="Purchase DM" value={purchaseDMInput} onChange={setPurchaseDMInput} inputClassName="input text-xs" />
                </label>
                <label className="block space-y-1">
                  <span className="label">SALE DM</span>
                  <NumberStepper ariaLabel="Sale DM" value={saleDMInput} onChange={setSaleDMInput} inputClassName="input text-xs" />
                </label>
              </div>

              <button type="button" onClick={doTradeRoll} className="btn-steel w-full">
                ROLL TRADE GOODS
              </button>

              {tradeRoll && (
                <div className="panel p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-12 h-12 border border-cyan-trav flex items-center justify-center font-mono font-bold text-cyan-trav text-lg">
                      {String(tradeRoll.d66).padStart(2, '0')}
                    </div>
                    <div>
                      <div className="text-bright font-mono text-sm">
                        {tradeRoll.good?.type ?? 'No match (re-roll)'}
                      </div>
                      {tradeRoll.good && (
                        <div className="text-xs text-body/65">
                          {tradeRoll.good.availability} · {tradeRoll.tons}
                          {tradeRoll.tons !== null && tradeRoll.good.tons !== 'Varies' && (
                            <span className="text-amber ml-1">→ {tradeRoll.tons} tons</span>
                          )}
                          {tradeRoll.good.basePrice !== null && (
                            <span className="text-body/55 ml-1">Base: {tradeRoll.good.basePrice.toLocaleString()} Cr</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {tradeRoll.good?.basePrice !== null && tradeRoll.good && (
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="border border-steel/50 p-2">
                        <div className="label text-[10px]">PURCHASE</div>
                        <div className="text-amber">
                          [{tradeRoll.purchaseRoll.join('+')}]{tradeRoll.purchaseDM !== 0 && ` ${fmtDM(tradeRoll.purchaseDM)}`}
                          {' '}= {tradeRoll.purchaseRoll.reduce((s, v) => s + v, 0) + tradeRoll.purchaseDM}
                        </div>
                        <div className="text-safe text-sm font-bold">{tradeRoll.purchasePct}% base</div>
                        <div className="text-body/55 text-[10px]">
                          {Math.round(tradeRoll.good.basePrice! * tradeRoll.purchasePct / 100).toLocaleString()} Cr/ton
                        </div>
                      </div>
                      <div className="border border-steel/50 p-2">
                        <div className="label text-[10px]">SALE</div>
                        <div className="text-amber">
                          [{tradeRoll.saleRoll.join('+')}]{tradeRoll.saleDM !== 0 && ` ${fmtDM(tradeRoll.saleDM)}`}
                          {' '}= {tradeRoll.saleRoll.reduce((s, v) => s + v, 0) + tradeRoll.saleDM}
                        </div>
                        <div className="text-safe text-sm font-bold">{tradeRoll.salePct}% base</div>
                        <div className="text-body/55 text-[10px]">
                          {Math.round(tradeRoll.good.basePrice! * tradeRoll.salePct / 100).toLocaleString()} Cr/ton
                        </div>
                      </div>
                    </div>
                  )}

                  {tradeRoll.good?.illegal && (
                    <div className="text-xs text-alert font-mono">⚠ ILLEGAL GOODS — broker required</div>
                  )}
                  <div className="text-[10px] text-body/40">Verify price table against Core Rulebook p.243</div>
                </div>
              )}
            </section>

            {/* ── Notation Roller ───────────────────────── */}
            <section className="space-y-3 border-t border-steel/40 pt-4">
              <div className="label">NOTATION ROLLER</div>
              <p className="text-xs text-body/65">
                Any dice expression: <span className="text-amber font-mono">3d6+2</span>, <span className="text-amber font-mono">2d20kh1</span>, <span className="text-amber font-mono">d%</span>
              </p>

              <label className="block space-y-1">
                <span className="label">EXPRESSION</span>
                <input
                  aria-label="Dice notation expression"
                  className="input font-mono"
                  placeholder="3d6+2"
                  value={notation}
                  onChange={e => { setNotation(e.target.value); setNotationError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') rollNotation(); }}
                />
              </label>

              {notationError && (
                <div role="alert" className="text-xs text-alert font-mono border border-alert/40 bg-alert/10 px-2 py-1">
                  {notationError}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-body">
                <input type="checkbox" checked={notationLogRoll} onChange={e => setNotationLogRoll(e.target.checked)} />
                <span>Log to Roll Log</span>
              </label>

              <button
                type="button"
                onClick={rollNotation}
                disabled={!notation.trim()}
                className="btn-steel w-full text-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ROLL NOTATION
              </button>

              {notationResult && (
                <div className="panel p-3 space-y-2">
                  <div className="text-amber font-mono text-sm">{notation.trim()}</div>
                  <div className="text-xs font-mono text-body/80">{notationResult.rolls || notationResult.output}</div>
                  <div className="text-2xl font-mono font-bold text-bright">{notationResult.total}</div>
                  {notationSaved && (
                    <div className="text-xs text-safe flex items-center gap-1">
                      <Check size={12} /> Logged to Roll Log
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setNotationHelpOpen(o => !o)}
                className="flex items-center gap-2 label hover:text-bright"
              >
                {notationHelpOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                SYNTAX REFERENCE
              </button>
              {notationHelpOpen && (
                <div className="space-y-1 text-xs font-mono text-body/70">
                  {[
                    ['XdY', 'Roll X dice with Y sides — e.g. 3d6, 1d20'],
                    ['XdY+Z / XdY-Z', 'Add/subtract a flat modifier'],
                    ['dF', 'Fudge/Fate dice (−1, 0, +1)'],
                    ['d%', 'Percentile roll (1–100)'],
                    ['XdYkhN / XdYklN', 'Keep highest/lowest N dice'],
                    ['XdYdh / XdYdl', 'Drop highest/lowest die'],
                    ['XdY!', 'Exploding (reroll and add on max)'],
                    ['XdY!!', 'Compounding exploding'],
                    ['XdYr=N', 'Reroll on result N'],
                    ['XdYcs>N', 'Count successes greater than N'],
                    ['{XdY, ZdW}dl1', 'Group roll with keep/drop'],
                    ['(XdY * 2) + 3', 'Arithmetic on roll results'],
                  ].map(([syntax, meaning]) => (
                    <div key={syntax} className="grid grid-cols-[7rem_1fr] gap-2 border-b border-steel/30 pb-1">
                      <span className="text-amber">{syntax}</span>
                      <span>{meaning}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="p-4 space-y-4 overflow-auto">
            <section className="panel p-3">
              <div className="label mb-2">DIFFICULTIES</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {DIFFICULTIES.map(d => (
                  <div key={d.target} className="flex justify-between border-b border-steel/50 pb-1">
                    <span className="text-body">{d.label}</span>
                    <span className="text-amber font-mono">{d.target}+</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel p-3 space-y-2 text-xs text-body/75">
              <div className="label">TASK CHAIN</div>
              <div>Previous Effect -6 or less: Mod -3</div>
              <div>Previous Effect -2 to -5: Mod -2</div>
              <div>Previous Effect -1 to +1: Mod +0</div>
              <div>Previous Effect +2 to +5: Mod +1</div>
              <div>Previous Effect +6 or more: Mod +2</div>
            </section>

            <section className="panel p-3 space-y-2 text-xs text-body/75">
              <div className="label">BOON / BANE / FLUX</div>
              <div>Boon: roll 3D6, keep the highest two dice.</div>
              <div>Bane: roll 3D6, keep the lowest two dice.</div>
              <div>Flux: 1D6 − 1D6 (range −5 to +5). Used for random events and NPC reactions.</div>
            </section>

            <section className="panel p-3 space-y-2 text-xs text-body/75">
              <div className="label">COMBAT ACTIONS</div>
              <div><span className="text-amber">Minor:</span> Aim, draw weapon, stand up, short move</div>
              <div><span className="text-amber">Significant:</span> Attack, full move, skill check, reload</div>
              <div><span className="text-amber">Reaction:</span> Dodge/parry (costs next significant action)</div>
            </section>

            <section className="panel p-3 space-y-2 text-xs text-body/75">
              <div className="label">COMMON SITUATIONAL DMs</div>
              <div>Cover (light): DM−1 to attackers</div>
              <div>Cover (full): DM−4 to attackers</div>
              <div>Darkness: DM−2 to skill checks</div>
              <div>Prone (melee): DM−2 to attack, DM−2 vs attacker</div>
              <div>Aimed shot: +1 minor action → DM+1</div>
            </section>

            <section className="panel p-3 space-y-2 text-xs text-body/75">
              <div className="label">NATURAL HEALING</div>
              <div>Each day of rest: recover 1D6 points per characteristic.</div>
              <div>Medical care (Medic 1+): double recovery rate.</div>
              <div>Unconscious at END 0; dead if all three physical stats reach 0.</div>
            </section>

            <section className="panel p-3 space-y-2 text-xs text-body/75">
              <div className="label">NPC REACTION (2D6)</div>
              <div>2 Hostile — immediate attack</div>
              <div>3–5 Unfriendly — DM−1 to social checks</div>
              <div>6–8 Neutral — normal interaction</div>
              <div>9–11 Friendly — DM+1 to social checks</div>
              <div>12 Helpful — active assistance offered</div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
