import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Upload, ChevronDown, ChevronUp, X, Minus, Settings, Pencil, Trash2 } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { AttributeMods, Character, Weapon } from '../../types';
import {
  toHex, upp, statDM, skillChar, parseSkillsCSV, parseTalentsCSV,
  STAT_LABELS, CharStat, parseDamageExpr,
} from '../../lib/traveller';
import { parseXLSXCharacter } from '../../lib/parseXLSX';

// ─── Types ──────────────────────────────────────────────────────────────────

type CharForm = Omit<Character, 'id' | 'created_at'>;

const EMPTY: CharForm = {
  name: '', player: null, portrait_url: null,
  str: null, dex: null, end_stat: null, int_stat: null, edu: null, soc: null,
  psi: null, chr: null, mor: null, lck: null,
  str_cur: null, dex_cur: null, end_cur: null, psi_cur: null,
  temp_mods: {},
  profile_details: {},
  homeworld_details: {},
  lifepath: [],
  armour: [],
  augments: [],
  personal_equipment: [],
  finances: {},
  contacts: [],
  background: {},
  career: null, rank: null, homeworld: null,
  skills: [], psionic_talents: [],
  weapons: [{ name: 'Unarmed', skill: 'Melee (Unarmed)', range: 'Melee', damage: '1D+STR DM', traits: '' }],
  notes: null,
};

const CORE_STATS: CharStat[] = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'];
const EXTRA_STATS: CharStat[] = ['chr', 'mor', 'lck'];
const ALL_STATS: CharStat[] = [...CORE_STATS, 'psi', ...EXTRA_STATS];
const CORE_STAT_FIELDS: Array<keyof CharForm> = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'];
const TEMP_MOD_MIN = -15;
const TEMP_MOD_MAX = 15;
const PORTRAIT_WIDTH = 360;
const PORTRAIT_HEIGHT = 480;

const DIFFICULTIES = [
  { label: 'Routine', target: 6 },
  { label: 'Average', target: 8 },
  { label: 'Difficult', target: 10 },
  { label: 'Very Difficult', target: 12 },
  { label: 'Formidable', target: 14 },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDM(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function parseIntegerInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '+' || trimmed === '-') return 0;
  const value = parseInt(trimmed, 10);
  return Number.isNaN(value) ? 0 : value;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function effectiveStatValue(base: number | null, tempMod: number): number | null {
  if (base === null) return null;
  return Math.max(0, base + tempMod);
}

function normalizeTempMods(raw: AttributeMods | null | undefined): Partial<Record<CharStat, number>> {
  if (!raw || typeof raw !== 'object') return {};
  return ALL_STATS.reduce<Partial<Record<CharStat, number>>>((mods, key) => {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
      mods[key] = clamp(Math.trunc(value), TEMP_MOD_MIN, TEMP_MOD_MAX);
    }
    return mods;
  }, {});
}

async function portraitFileToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read portrait image.'));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = PORTRAIT_WIDTH;
    canvas.height = PORTRAIT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare portrait image.');

    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = PORTRAIT_WIDTH / PORTRAIT_HEIGHT;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function Field({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 block">
      <span className="label block">{name}</span>
      {children}
    </label>
  );
}

function charDisplayName(char: Character): string {
  if (char.name && char.name !== 'Unknown') return char.name;
  return char.player ? `<<${char.player}>>` : 'Unknown';
}

function sortCharacters(characters: Character[]): Character[] {
  return [...characters].sort((a, b) => charDisplayName(a).localeCompare(charDisplayName(b)));
}

function physicalStatus(char: Character): { label: string; color: string } {
  const end = char.end_cur ?? char.end_stat ?? 0;
  const str = char.str_cur ?? char.str ?? 0;
  const dex = char.dex_cur ?? char.dex ?? 0;
  if (end <= 0 && str <= 0 && dex <= 0) return { label: 'DEAD', color: 'text-alert' };
  if (end <= 0 && (str <= 0 || dex <= 0)) return { label: 'INCAPACITATED', color: 'text-alert' };
  if (end <= 0) return { label: 'SERIOUS WOUND', color: 'text-alert' };
  const maxEnd = char.end_stat ?? 0;
  const maxStr = char.str ?? 0;
  const maxDex = char.dex ?? 0;
  if (end < maxEnd || str < maxStr || dex < maxDex) return { label: 'DAMAGED', color: 'text-amber' };
  return { label: 'HEALTHY', color: 'text-safe' };
}

function CharacterActionsMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div
      className="relative inline-flex"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
    >
      <button
        type="button"
        title="Character actions"
        aria-label="Character actions"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-6 h-6 border border-steel/50 text-body/50 hover:border-amber/70 hover:text-amber transition-colors flex items-center justify-center"
      >
        <Settings size={13} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-28 border border-steel bg-panel shadow-xl">
          <button
            type="button"
            onClick={() => runAction(onEdit)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-mono text-body hover:bg-steel/30 hover:text-amber"
          >
            <Pencil size={12} /> EDIT
          </button>
          <button
            type="button"
            onClick={() => runAction(onDelete)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-mono text-alert/80 hover:bg-alert/10 hover:text-alert"
          >
            <Trash2 size={12} /> DELETE
          </button>
        </div>
      )}
    </div>
  );
}

function CharacterPortrait({
  char,
  size = 'lg',
  editable = false,
  uploading = false,
  onUpload,
}: {
  char: Character;
  size?: 'sm' | 'lg';
  editable?: boolean;
  uploading?: boolean;
  onUpload?: (file: File) => void;
}) {
  const src = char.portrait_url?.trim() ?? '';
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const boxClass = size === 'sm' ? 'w-12 h-16' : 'w-24 h-32';
  const textClass = size === 'sm' ? 'text-[8px]' : 'text-[10px]';
  const iconSize = size === 'sm' ? 9 : 12;

  function chooseFile(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!editable || uploading) return;
    fileRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file && onUpload) onUpload(file);
    e.target.value = '';
  }

  const frame = (
    <>
      {src && !failed ? (
        <img
          src={src}
          alt={`${charDisplayName(char)} portrait`}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-steel/10">
          <span className={`${textClass} font-mono text-body/25`}>PORTRAIT</span>
        </div>
      )}
      {editable && (
        <div className="absolute right-1 bottom-1 w-5 h-5 border border-steel/70 bg-panel/90 text-amber flex items-center justify-center">
          <Upload size={iconSize} />
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-void/80 flex items-center justify-center">
          <span className={`${textClass} font-mono text-amber`}>UPLOADING</span>
        </div>
      )}
    </>
  );

  return (
    <div
      aria-label={`${charDisplayName(char)} portrait`}
      className={`${boxClass} relative flex-shrink-0 border border-steel/60 bg-void/60 overflow-hidden flex items-center justify-center`}
    >
      {editable ? (
        <>
          <button
            type="button"
            title="Upload portrait"
            aria-label={`Upload ${charDisplayName(char)} portrait`}
            aria-busy={uploading}
            onClick={chooseFile}
            className="relative w-full h-full text-left group"
          >
            {frame}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label={`Portrait file for ${charDisplayName(char)}`}
            className="hidden"
            onClick={e => e.stopPropagation()}
            onChange={handleFile}
          />
        </>
      ) : (
        frame
      )}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-steel/50 pt-3">
      <div className="label mb-2">{title}</div>
      {children}
    </div>
  );
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return false;
}

function entriesWithValues(record: object | null | undefined): Array<[string, unknown]> {
  if (!record) return [];
  return Object.entries(record as Record<string, unknown>).filter(([, value]) => hasValue(value));
}

function fmtCr(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `Cr ${value.toLocaleString()}`;
}

function boolMark(value: boolean | null | undefined): string {
  if (value === true) return 'Y';
  if (value === false) return 'N';
  return '—';
}

// ─── Roll Modal ───────────────────────────────────────────────────────────────

interface RollTarget {
  label: string;
  skillLevel: number;
  charKey: CharStat | null;
  isPsionic: boolean;
  weapon?: Weapon;
}

interface AttackResult {
  d1: number; d2: number;
  charDM: number; skillLevel: number; bonusDM: number;
  total: number; effect: number;
}

interface DamageResult {
  rolls: number[];
  constant: number;
  strDM: number;
  effect: number;
  total: number;
}

function RollModal({
  char,
  target: initialTarget,
  statValues,
  onClose,
  onSave,
}: {
  char: Character;
  target: RollTarget;
  statValues: Partial<Record<CharStat, number | null>>;
  onClose: () => void;
  onSave: (result: { d1: number; d2: number; charDM: number; skillLevel: number; bonusDM: number; total: number }, difficulty: number, label: string) => void;
}) {
  const isWeapon = !!initialTarget.weapon;
  const isMelee = isWeapon && initialTarget.weapon!.range === 'Melee';

  const defaultCharKey = initialTarget.charKey ?? (isMelee ? 'str' : null);

  const [charKey, setCharKey] = useState<CharStat | null>(defaultCharKey);
  const [difficulty, setDifficulty] = useState<number>(8);
  const [label, setLabel] = useState(initialTarget.label);
  const [skillLevelInput, setSkillLevelInput] = useState(String(initialTarget.skillLevel));
  const [bonusDMInput, setBonusDMInput] = useState('');
  const [attackResult, setAttackResult] = useState<AttackResult | null>(null);
  const [damageResult, setDamageResult] = useState<DamageResult | null>(null);
  const [saved, setSaved] = useState(false);
  const isCustom = initialTarget.label === '';

  function statValue(key: CharStat): number | null {
    if (Object.prototype.hasOwnProperty.call(statValues, key)) return statValues[key] ?? null;
    return char[key] as number | null;
  }

  const charDM = charKey !== null ? statDM(statValue(charKey)) : 0;
  const skillLevel = parseIntegerInput(skillLevelInput);
  const bonusDM = parseIntegerInput(bonusDMInput);
  const availableStats = ALL_STATS.filter(k => statValue(k) !== null);
  const attackHit = attackResult !== null && attackResult.total >= difficulty;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function rollAttack() {
    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    const total = d1 + d2 + charDM + skillLevel + bonusDM;
    const effect = total - difficulty;
    const r: AttackResult = { d1, d2, charDM, skillLevel, bonusDM, total, effect };
    setAttackResult(r);
    setDamageResult(null);
    setSaved(false);
    onSave({ d1, d2, charDM, skillLevel, bonusDM, total }, difficulty, label || 'Custom');
    setSaved(true);
  }

  function rollDamage() {
    if (!attackResult || !attackHit || !initialTarget.weapon) return;
    const { dice, constant } = parseDamageExpr(initialTarget.weapon.damage);
    const strDMVal = isMelee ? statDM(statValue('str')) : 0;
    const effect = attackResult.effect;
    const rolls = Array.from({ length: Math.max(1, dice) }, () => Math.ceil(Math.random() * 6));
    const base = rolls.reduce((s, r) => s + r, 0);
    const total = Math.max(0, base + constant + strDMVal + effect);
    setDamageResult({ rolls, constant, strDM: strDMVal, effect, total });
  }

  const success = attackResult !== null && attackResult.total >= difficulty;
  const effect = attackResult !== null ? attackResult.total - difficulty : 0;
  const modalTitle = isWeapon
    ? `${initialTarget.weapon!.name} ATTACK — ${charDisplayName(char)}`
    : isCustom ? `CUSTOM CHECK — ${charDisplayName(char)}`
    : `${label} CHECK — ${charDisplayName(char)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 panel border border-steel/80 shadow-2xl">
        <div className="panel-header flex items-center justify-between">
          <span className="truncate">{modalTitle}</span>
          <button onClick={onClose} className="text-body/50 hover:text-body ml-4 flex-shrink-0"><X size={14} /></button>
        </div>

        <div className="p-4 space-y-3">
          {isWeapon && (
            <div className="flex items-center gap-4 text-xs font-mono border border-steel/40 px-3 py-2">
              <span className="text-body/50">{initialTarget.weapon!.range}</span>
              <span className="text-amber">{initialTarget.weapon!.damage}</span>
              <span className="text-body/40 text-[10px]">{initialTarget.weapon!.skill}</span>
              {initialTarget.weapon!.traits && <span className="text-body/30 text-[10px] ml-auto">{initialTarget.weapon!.traits}</span>}
            </div>
          )}

          {isCustom && (
            <div className="space-y-1">
              <label className="label">Check Label</label>
              <input className="input text-xs" value={label} placeholder="e.g. Pilot (Small Craft)"
                onChange={e => setLabel(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="label">{isWeapon ? 'Attack Characteristic' : 'Characteristic'}</label>
              <select className="select text-xs" value={charKey ?? ''}
                onChange={e => setCharKey((e.target.value as CharStat) || null)}>
                <option value="">— none —</option>
                {availableStats.map(k => (
                  <option key={k} value={k}>
                    {STAT_LABELS[k]} {toHex(statValue(k))} ({fmtDM(statDM(statValue(k)))})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Skill Level</label>
              <input className="input text-xs" type="text" inputMode="numeric" pattern="[+-]?[0-9]*"
                value={skillLevelInput}
                readOnly={!isCustom}
                onChange={e => setSkillLevelInput(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="label" htmlFor="roll-bonus-dm">+DM</label>
              <input id="roll-bonus-dm" className="input text-xs" type="text" inputMode="numeric" pattern="[+-]?[0-9]*"
                placeholder="0"
                value={bonusDMInput}
                onChange={e => setBonusDMInput(e.target.value)} />
            </div>
          </div>

          {isCustom && (
            <div className="text-xs text-body/40 font-mono">
              Unskilled penalty is DM-3 · Skill 0 = competent, no bonus
            </div>
          )}

          <div className="space-y-1">
            <div className="label">Difficulty</div>
            <div className="flex items-center gap-1 flex-wrap">
              {DIFFICULTIES.map(d => (
                <button key={d.target} onClick={() => setDifficulty(d.target)}
                  className={`px-2 py-0.5 border text-xs font-mono transition-colors ${
                    difficulty === d.target
                      ? 'border-amber text-amber'
                      : 'border-steel text-body hover:border-amber/60 hover:text-amber/60'
                  }`}>
                  {d.label} {d.target}+
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-body/50 font-mono">
            Char DM: <span className="text-cyan-trav">{fmtDM(charDM)}</span>
            {' · '}Skill: <span className="text-cyan-trav">{fmtDM(skillLevel)}</span>
            {' · '}+DM: <span className="text-cyan-trav">{fmtDM(bonusDM)}</span>
            {' · '}Expected: <span className="text-body/40">{7 + charDM + skillLevel + bonusDM}+</span>
          </div>

          <button onClick={rollAttack} className="btn-amber w-full text-center text-sm">
            {isWeapon ? 'ROLL ATTACK 2D6' : 'ROLL 2D6'}
          </button>

          {attackResult !== null && (
            <div className="border-t border-steel/60 pt-3 space-y-2">
              <div className="flex items-center gap-2 font-mono flex-wrap">
                <span className="inline-flex items-center justify-center w-9 h-9 border border-amber text-amber font-bold text-lg">{attackResult.d1}</span>
                <span className="text-body">+</span>
                <span className="inline-flex items-center justify-center w-9 h-9 border border-amber text-amber font-bold text-lg">{attackResult.d2}</span>
                {attackResult.charDM !== 0 && <><span className="text-body">+</span><span className="text-cyan-trav text-xs">{charKey && STAT_LABELS[charKey]} {fmtDM(attackResult.charDM)}</span></>}
                {skillLevel !== 0 && <><span className="text-body">+</span><span className="text-cyan-trav text-xs">Skill {fmtDM(attackResult.skillLevel)}</span></>}
                {attackResult.bonusDM !== 0 && <><span className="text-body">+</span><span className="text-cyan-trav text-xs">+DM {fmtDM(attackResult.bonusDM)}</span></>}
                <span className="text-body">=</span>
                <span className={`text-2xl font-bold ${success ? 'text-safe glow-cyan' : 'text-alert'}`}>{attackResult.total}</span>
              </div>
              <div className={`text-sm font-mono tracking-wider ${success ? 'text-safe' : 'text-alert'}`}>
                {success ? (isWeapon ? '✓ HIT' : '✓ SUCCESS') : (isWeapon ? '✗ MISS' : '✗ FAILURE')}
                <span className="text-body/60 text-xs ml-2">vs {difficulty}+</span>
                <span className="text-bright text-xs ml-2">Effect {fmtDM(effect)}</span>
              </div>
              {saved && !isWeapon && <div className="text-xs text-body/40">Logged to Roll Log</div>}

              {isWeapon && attackHit && (
                <div className="border-t border-steel/40 pt-2 space-y-2">
                  <div className="text-xs text-body/60 font-mono">
                    Damage: <span className="text-amber">{initialTarget.weapon!.damage}</span>
                    {' + Effect'} {fmtDM(effect)}
                    {isMelee && <span className="text-body/50"> + STR DM {fmtDM(statDM(statValue('str')))}</span>}
                  </div>
                  <button onClick={rollDamage} className="btn-steel w-full text-center text-xs">
                    ROLL DAMAGE
                  </button>

                  {damageResult && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-mono flex-wrap">
                        {damageResult.rolls.map((r, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-body">+</span>}
                            <span className="inline-flex items-center justify-center w-7 h-7 border border-steel text-bright font-bold text-sm">{r}</span>
                          </React.Fragment>
                        ))}
                        {damageResult.constant !== 0 && (
                          <><span className="text-body">{damageResult.constant > 0 ? '+' : ''}</span>
                          <span className="text-body/60 text-xs">{damageResult.constant}</span></>
                        )}
                        {damageResult.effect !== 0 && (
                          <><span className="text-body">+</span>
                          <span className="text-body/60 text-xs">Effect {fmtDM(damageResult.effect)}</span></>
                        )}
                        {damageResult.strDM !== 0 && (
                          <><span className="text-body">+</span>
                          <span className="text-body/60 text-xs">STR {fmtDM(damageResult.strDM)}</span></>
                        )}
                        <span className="text-body">=</span>
                        <span className="text-alert font-bold text-2xl">{damageResult.total}</span>
                        <span className="text-body/50 text-xs">damage</span>
                      </div>
                      <div className="text-xs text-body/40 font-mono">
                        Damage goes to END first, then STR or DEX (target's choice)
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Character Detail Content ─────────────────────────────────────────────────
// Shared by the mobile accordion card and the desktop detail panel.

const PHYS_FIELDS = [
  { key: 'end_stat' as CharStat, cur: 'end_cur' as keyof Character, label: 'END' },
  { key: 'str'      as CharStat, cur: 'str_cur' as keyof Character, label: 'STR' },
  { key: 'dex'      as CharStat, cur: 'dex_cur' as keyof Character, label: 'DEX' },
];

function CharDetailContent({
  char, onRollSave, onStatAdjust,
}: {
  char: Character;
  onRollSave: (charName: string, result: { d1: number; d2: number; charDM: number; skillLevel: number; bonusDM: number; total: number }, checkLabel: string, difficulty: number) => void;
  onStatAdjust: (id: string, patch: Partial<Character>) => void;
}) {
  const [rollTarget, setRollTarget] = useState<RollTarget | null>(null);
  const [damageInput, setDamageInput] = useState('');
  const [psiInput, setPsiInput] = useState('');
  const [pendingOverflow, setPendingOverflow] = useState<number | null>(null);

  const endMax = char.end_stat ?? 0;
  const strMax = char.str ?? 0;
  const dexMax = char.dex ?? 0;
  const psiMax = char.psi ?? 0;
  const endCur = char.end_cur ?? endMax;
  const strCur = char.str_cur ?? strMax;
  const dexCur = char.dex_cur ?? dexMax;
  const psiCur = char.psi_cur ?? psiMax;

  const isDamaged = endCur < endMax || strCur < strMax || dexCur < dexMax;
  const isPsiSpent = char.psi !== null && char.psi > 0 && psiCur < psiMax;

  const tempMods = normalizeTempMods(char.temp_mods);
  const hasTempMods = Object.keys(tempMods).length > 0;

  const [trackingHealth, setTrackingHealth] = useState(() => isDamaged);
  const [trackingPsi, setTrackingPsi] = useState(() => isPsiSpent);
  const [trackingTempMods, setTrackingTempMods] = useState(() => hasTempMods);

  const displayName = charDisplayName(char);
  const trainedSkills = char.skills
    .filter(s => s.level > 0 || (s.level === 0 && !s.name.includes('(')))
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasPsionics = char.psionic_talents.length > 0 || (char.psi !== null && char.psi > 0);
  const extraStats = EXTRA_STATS.filter(k => char[k] !== null);
  const allDisplayStats: CharStat[] = [...CORE_STATS, ...(char.psi !== null ? ['psi' as CharStat] : []), ...extraStats];
  const status = physicalStatus(char);
  const profileDetails = char.profile_details ?? {};
  const homeworldDetails = char.homeworld_details ?? {};
  const lifepath = char.lifepath ?? [];
  const armour = char.armour ?? [];
  const augments = char.augments ?? [];
  const personalEquipment = char.personal_equipment ?? [];
  const finances = char.finances ?? {};
  const contacts = char.contacts ?? [];
  const background = char.background ?? {};
  const profileRows = [
    ['SPECIES', profileDetails.species],
    ['AGE', profileDetails.age],
    ['GENDER', profileDetails.gender],
    ['HEIGHT', profileDetails.height],
    ['WEIGHT', profileDetails.weight],
    ['APPEARANCE', profileDetails.appearance],
  ].filter(([, value]) => hasValue(value));
  const homeworldRows = [
    ['WORLD', homeworldDetails.name ?? char.homeworld],
    ['SECTOR', homeworldDetails.sector],
    ['SUBSECTOR', homeworldDetails.subsector],
    ['HEX', homeworldDetails.location],
    ['UWP', homeworldDetails.uwp],
    ['BASES', homeworldDetails.bases],
    ['TRADE', homeworldDetails.trade_codes],
    ['TRAVEL', homeworldDetails.travel_zone],
    ['GAS GIANT', homeworldDetails.gas_giant],
  ].filter(([, value]) => hasValue(value));
  const financeRows = [
    ['CASH', finances.cash_on_hand],
    ['PENSION/YR', finances.yearly_pension],
    ['SALARY/MO', finances.monthly_salary],
    ['SHIP OPS/MO', finances.ship_operating_costs],
    ['DEBT PMT/MO', finances.monthly_debt_payments],
    ['LIVING/MO', finances.monthly_living_cost],
    ['TOTAL DEBT', finances.total_debts],
  ].filter(([, value]) => hasValue(value));
  const backgroundRows: Array<[string, string]> = entriesWithValues(background).map(([key, value]) => [
    String(key).replace(/_/g, ' ').toUpperCase(),
    String(value),
  ]);

  function curVal(key: CharStat): number | null {
    if (trackingHealth) {
      if (key === 'end_stat') return endCur;
      if (key === 'str') return strCur;
      if (key === 'dex') return dexCur;
    }
    if (trackingPsi && key === 'psi') return psiCur;
    return char[key] as number | null;
  }

  function tempMod(key: CharStat): number {
    return tempMods[key] ?? 0;
  }

  function effectiveVal(key: CharStat): number | null {
    return effectiveStatValue(curVal(key), tempMod(key));
  }

  const effectiveStatValues = ALL_STATS.reduce<Partial<Record<CharStat, number | null>>>((values, key) => {
    values[key] = effectiveVal(key);
    return values;
  }, {});

  function openSkillRoll(skillName: string, skillLvl: number) {
    setRollTarget({ label: skillName, skillLevel: skillLvl, charKey: skillChar(skillName), isPsionic: false });
  }
  function openPsiRoll(talentName: string, talentLevel: number) {
    setRollTarget({ label: talentName, skillLevel: talentLevel, charKey: 'psi', isPsionic: true });
  }
  function openStatRoll(stat: CharStat) {
    setRollTarget({ label: STAT_LABELS[stat], skillLevel: 0, charKey: stat, isPsionic: false });
  }
  function openWeaponRoll(weapon: Weapon) {
    const isMelee = weapon.range === 'Melee';
    const wSkillChar = skillChar(weapon.skill);
    const defaultChar = wSkillChar ?? (isMelee ? 'str' : 'dex');
    const skillLvl = char.skills.find(s => s.name === weapon.skill)?.level ?? 0;
    setRollTarget({ label: weapon.name, skillLevel: skillLvl, charKey: defaultChar, isPsionic: false, weapon });
  }
  function openCustomRoll() {
    setRollTarget({ label: '', skillLevel: 0, charKey: null, isPsionic: false });
  }

  function handleRollSave(result: { d1: number; d2: number; charDM: number; skillLevel: number; bonusDM: number; total: number }, difficulty: number, label: string) {
    onRollSave(displayName, result, label, difficulty);
  }

  function adjustStat(field: keyof Character, max: number, delta: number) {
    const cur = (char[field] as number | null) ?? max;
    const next = Math.max(0, Math.min(max, cur + delta));
    onStatAdjust(char.id, { [field]: next });
  }

  function adjustTempMod(key: CharStat, delta: number) {
    if (curVal(key) === null) return;
    const nextMods = { ...tempMods };
    const next = clamp((nextMods[key] ?? 0) + delta, TEMP_MOD_MIN, TEMP_MOD_MAX);
    if (next === 0) delete nextMods[key];
    else nextMods[key] = next;
    onStatAdjust(char.id, { temp_mods: nextMods });
  }

  function resetTempMods() {
    onStatAdjust(char.id, { temp_mods: {} });
  }

  function toggleHealth() {
    if (trackingHealth) {
      onStatAdjust(char.id, { end_cur: endMax, str_cur: strMax, dex_cur: dexMax });
      setPendingOverflow(null);
      setTrackingHealth(false);
    } else {
      setTrackingHealth(true);
    }
  }

  function togglePsi() {
    if (trackingPsi) {
      onStatAdjust(char.id, { psi_cur: psiMax });
      setTrackingPsi(false);
    } else {
      setTrackingPsi(true);
    }
  }

  function applyDamage() {
    const dmg = parseInt(damageInput);
    if (!dmg || dmg <= 0) { setDamageInput(''); return; }
    if (dmg <= endCur) {
      onStatAdjust(char.id, { end_cur: endCur - dmg });
    } else {
      const overflow = dmg - endCur;
      onStatAdjust(char.id, { end_cur: 0 });
      if (overflow > 0) setPendingOverflow(overflow);
    }
    setDamageInput('');
  }

  function applyOverflow(to: 'str_cur' | 'dex_cur') {
    if (!pendingOverflow) return;
    const max = to === 'str_cur' ? strMax : dexMax;
    const cur = (char[to] as number | null) ?? max;
    onStatAdjust(char.id, { [to]: Math.max(0, cur - pendingOverflow) });
    setPendingOverflow(null);
  }

  function applyPsiCost() {
    const cost = parseInt(psiInput);
    if (!cost || cost <= 0) { setPsiInput(''); return; }
    onStatAdjust(char.id, { psi_cur: Math.max(0, psiCur - cost) });
    setPsiInput('');
  }

  return (
    <>
      {rollTarget && (
        <RollModal
          char={char}
          target={rollTarget}
          statValues={effectiveStatValues}
          onClose={() => setRollTarget(null)}
          onSave={handleRollSave}
        />
      )}

      <div className="space-y-4">
        {/* Characteristics + track toggles */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="label">CHARACTERISTICS</div>
            <div className="flex gap-1.5">
              <button onClick={() => setTrackingTempMods(v => !v)}
                className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
                  trackingTempMods
                    ? 'border-safe/60 text-safe hover:border-steel hover:text-body/60'
                    : 'border-steel/40 text-body/40 hover:border-safe/50 hover:text-safe/70'
                }`}>
                {trackingTempMods ? 'HIDE MODS' : 'TEMP MODS'}
              </button>
              {hasPsionics && psiMax > 0 && (
                <button onClick={togglePsi}
                  className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
                    trackingPsi
                      ? 'border-cyan-dim text-cyan-trav hover:border-steel hover:text-body/60'
                      : 'border-steel/40 text-body/40 hover:border-cyan-dim hover:text-cyan-trav'
                  }`}>
                  {trackingPsi ? 'RESET PSI' : 'TRACK PSI'}
                </button>
              )}
              <button onClick={toggleHealth}
                className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
                  trackingHealth
                    ? 'border-alert/60 text-alert hover:border-steel hover:text-body/60'
                    : 'border-steel/40 text-body/40 hover:border-amber/50 hover:text-amber/70'
                }`}>
                {trackingHealth ? 'RESET HEALTH' : 'TRACK HEALTH'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {allDisplayStats.map(key => {
              const baseVal = char[key] as number | null;
              const cv = curVal(key);
              const ev = effectiveVal(key);
              const mod = tempMod(key);
              const isPhys = key === 'str' || key === 'dex' || key === 'end_stat';
              const isPsiStat = key === 'psi';
              const isExtra = EXTRA_STATS.includes(key);
              const isTracked = (isPhys && trackingHealth) || (isPsiStat && trackingPsi);
              const isReduced = (isTracked && cv !== null && baseVal !== null && cv < baseVal) || mod < 0;
              const isBoosted = mod > 0 && !isReduced;
              const isZero = ev === 0;
              const dm = statDM(ev);

              const borderClass = isZero
                ? 'border-alert'
                : isReduced
                  ? 'border-amber'
                  : isBoosted ? 'border-safe/60 hover:border-safe'
                  : isPsiStat ? 'border-cyan-dim/60 hover:border-cyan-trav/60'
                  : isExtra ? 'border-steel/30 hover:border-amber/50'
                  : 'border-steel/40 hover:border-amber/60';

              const labelClass = isZero ? 'text-alert' : isReduced ? 'text-amber' :
                isBoosted ? 'text-safe' :
                isPsiStat ? 'text-cyan-trav/70' : isExtra ? 'text-body/50' : 'text-body';

              const valClass = isZero ? 'text-alert' : isReduced ? 'text-amber' :
                isBoosted ? 'text-safe' :
                isPsiStat ? 'text-cyan-trav' : isExtra ? 'text-amber/70' : 'text-amber';

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openStatRoll(key)}
                  aria-label={`Roll ${STAT_LABELS[key]} check`}
                  title={`Roll ${STAT_LABELS[key]} check`}
                  className={`text-center border transition-colors py-1.5 px-2.5 group min-w-[4rem] ${borderClass}`}
                >
                  <div className={`text-xs ${labelClass} group-hover:text-amber/80`}>{STAT_LABELS[key]}</div>
                  <div className={`font-mono text-base font-bold ${valClass}`}>
                    {toHex(ev)}
                  </div>
                  {isTracked && (
                    <div className="text-[10px] text-body/35 font-mono leading-tight">
                      {toHex(cv)}/{toHex(baseVal)}
                    </div>
                  )}
                  <div className="text-xs text-body/40">{fmtDM(dm)}</div>
                </button>
              );
            })}
          </div>

          {/* Temporary modifier controls */}
          {trackingTempMods && (
            <div className="mt-3 space-y-2 border-t border-steel/40 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="label text-safe/80">TEMP MODIFIERS</div>
                {hasTempMods && (
                  <button onClick={resetTempMods}
                    className="text-[10px] font-mono px-2 py-0.5 border border-steel/40 text-body/40 hover:border-amber/60 hover:text-amber transition-colors">
                    RESET
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allDisplayStats.map(key => {
                  const mod = tempMod(key);
                  return (
                    <div key={key} className="flex items-center border border-steel/40 font-mono text-[10px]">
                      <span className="w-9 px-1.5 py-1 text-body/50 text-center">{STAT_LABELS[key]}</span>
                      <button
                        type="button"
                        aria-label={`Decrease ${STAT_LABELS[key]} temporary modifier`}
                        disabled={curVal(key) === null || mod <= TEMP_MOD_MIN}
                        onClick={() => adjustTempMod(key, -1)}
                        className="w-6 h-6 border-l border-steel/30 flex items-center justify-center text-body/40 hover:text-amber hover:bg-steel/20 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Minus size={8} />
                      </button>
                      <span className={`w-8 text-center ${mod > 0 ? 'text-safe' : mod < 0 ? 'text-amber' : 'text-body/30'}`}>
                        {fmtDM(mod)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${STAT_LABELS[key]} temporary modifier`}
                        disabled={curVal(key) === null || mod >= TEMP_MOD_MAX}
                        onClick={() => adjustTempMod(key, 1)}
                        className="w-6 h-6 border-l border-steel/30 flex items-center justify-center text-body/40 hover:text-safe hover:bg-steel/20 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Plus size={8} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Health tracking controls */}
          {trackingHealth && (
            <div className="mt-3 space-y-2 border-t border-steel/40 pt-3">
              {pendingOverflow !== null ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-alert font-mono">Overflow {pendingOverflow} dmg →</span>
                  <button onClick={() => applyOverflow('str_cur')}
                    className="px-3 py-1 border border-alert text-alert hover:bg-alert/10 font-mono transition-colors">
                    STR
                  </button>
                  <button onClick={() => applyOverflow('dex_cur')}
                    className="px-3 py-1 border border-alert text-alert hover:bg-alert/10 font-mono transition-colors">
                    DEX
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} placeholder="Damage…"
                    value={damageInput}
                    onChange={e => setDamageInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') applyDamage(); }}
                    className="input text-xs w-28 py-1" />
                  <button onClick={applyDamage} className="btn-danger text-xs py-1">APPLY</button>
                  <span className="text-body/30 text-[10px] font-mono ml-1">END first, then STR or DEX</span>
                </div>
              )}
              <div className="flex items-center gap-4">
                {PHYS_FIELDS.map(({ key: fk, cur: ck, label: fl }) => {
                  const max = char[fk] as number ?? 0;
                  const cv2 = (char[ck] as number | null) ?? max;
                  return (
                    <div key={fl} className="flex items-center gap-1 text-xs font-mono">
                      <span className="text-body/50 w-6">{fl}</span>
                      <button onClick={() => adjustStat(ck, max, -1)} disabled={cv2 <= 0}
                        className="w-5 h-5 border border-steel/60 text-body/50 hover:border-alert hover:text-alert disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center">
                        <Minus size={8} />
                      </button>
                      <span className="text-amber w-8 text-center">{cv2}/{max}</span>
                      <button onClick={() => adjustStat(ck, max, 1)} disabled={cv2 >= max}
                        className="w-5 h-5 border border-steel/60 text-body/50 hover:border-safe hover:text-safe disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center">
                        <Plus size={8} />
                      </button>
                    </div>
                  );
                })}
                <span className={`text-xs font-mono ml-auto ${status.color}`}>{status.label}</span>
              </div>
              <div className="text-[10px] text-body/30 font-mono">
                Natural healing: 1D+END DM hp/day (rest) · Unconscious when 2 stats at 0 · Dead when all 3 at 0
              </div>
            </div>
          )}

          {/* PSI tracking controls */}
          {trackingPsi && hasPsionics && psiMax > 0 && (
            <div className="mt-3 space-y-2 border-t border-steel/40 pt-3">
              <div className="flex items-center gap-2">
                <input type="number" min={1} placeholder="PSI cost…"
                  value={psiInput}
                  onChange={e => setPsiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyPsiCost(); }}
                  className="input text-xs w-28 py-1" />
                <button onClick={applyPsiCost} className="btn-steel text-xs py-1">SPEND</button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-xs font-mono">
                  <span className="text-cyan-trav/70 w-6">PSI</span>
                  <button onClick={() => adjustStat('psi_cur', psiMax, -1)} disabled={psiCur <= 0}
                    className="w-5 h-5 border border-steel/60 text-body/50 hover:border-alert hover:text-alert disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center">
                    <Minus size={8} />
                  </button>
                  <span className="text-cyan-trav w-8 text-center">{psiCur}/{psiMax}</span>
                  <button onClick={() => adjustStat('psi_cur', psiMax, 1)} disabled={psiCur >= psiMax}
                    className="w-5 h-5 border border-steel/60 text-body/50 hover:border-safe hover:text-safe disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center">
                    <Plus size={8} />
                  </button>
                </div>
                {psiCur === 0 && <span className="text-alert text-xs font-mono">EXHAUSTED</span>}
              </div>
              <div className="text-[10px] text-body/30 font-mono">Recovers with rest · cost = talent level + power cost</div>
            </div>
          )}
        </div>

        {profileRows.length > 0 && (
          <DetailSection title="PROFILE">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs font-mono">
              {profileRows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <span className="text-body/35">{label}</span>
                  <span className="text-body/70 ml-2 break-words">{String(value)}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {homeworldRows.length > 0 && (
          <DetailSection title="HOMEWORLD">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs font-mono">
              {homeworldRows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <span className="text-body/35">{label}</span>
                  <span className="text-cyan-trav/80 ml-2 break-words">{String(value)}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {lifepath.length > 0 && (
          <DetailSection title="LIFEPATH">
            <div className="space-y-1.5">
              {lifepath.map((term, i) => (
                <div key={`${term.term ?? i}-${term.career ?? i}`} className="text-xs font-mono border border-steel/35 px-2 py-1.5">
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    <span className="text-amber">TERM {term.term ?? i + 1}</span>
                    {term.career && <span className="text-bright">{term.career}</span>}
                    {term.assignment && <span className="text-body/55">{term.assignment}</span>}
                    {term.rank && <span className="text-cyan-trav/80">RANK {term.rank}</span>}
                    <span className="text-body/35">
                      SURV {boolMark(term.survived)} / COM {boolMark(term.commissioned)} / ADV {boolMark(term.advanced)}
                    </span>
                  </div>
                  {term.notes && <div className="text-body/65 mt-1 whitespace-pre-wrap">{term.notes}</div>}
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {armour.length > 0 && (
          <DetailSection title="ARMOUR">
            <div className="space-y-1">
              {armour.map((item, i) => (
                <div key={`${item.name}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono border border-steel/35 px-2 py-1">
                  <span className={item.worn ? 'text-safe' : 'text-body/35'}>{item.worn ? 'WORN' : 'STOWED'}</span>
                  <span className="text-bright">{item.name}</span>
                  {item.protection !== null && <span className="text-amber">PROT {item.protection}</span>}
                  {item.radiation !== null && <span className="text-cyan-trav/70">RAD {item.radiation}</span>}
                  {item.required_skill && <span className="text-body/45">REQ {item.required_skill}</span>}
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {augments.length > 0 && (
          <DetailSection title="AUGMENTS">
            <div className="space-y-1">
              {augments.map((augment, i) => (
                <div key={`${augment.name}-${i}`} className="text-xs font-mono border border-steel/35 px-2 py-1">
                  <span className="text-bright">{augment.name}</span>
                  {augment.tech_level !== null && <span className="text-body/45 ml-2">TL {augment.tech_level}</span>}
                  {augment.cost !== null && <span className="text-amber/80 ml-2">{fmtCr(augment.cost)}</span>}
                  {augment.notes && <div className="text-body/60 mt-0.5">{augment.notes}</div>}
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {personalEquipment.length > 0 && (
          <DetailSection title="EQUIPMENT">
            <div className="space-y-1">
              {personalEquipment.map((item, i) => (
                <div key={`${item.name}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono border border-steel/35 px-2 py-1">
                  <span className="text-bright">{item.name}</span>
                  {item.quantity !== null && <span className="text-body/45">x{item.quantity}</span>}
                  {item.tech_level !== null && <span className="text-body/45">TL {item.tech_level}</span>}
                  {item.mass !== null && <span className="text-cyan-trav/70">{item.mass} kg</span>}
                  {item.cost !== null && <span className="text-amber/80">{fmtCr(item.cost)}</span>}
                  {item.notes && <span className="text-body/55">{item.notes}</span>}
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {financeRows.length > 0 && (
          <DetailSection title="FINANCES">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs font-mono">
              {financeRows.map(([label, value]) => (
                <div key={label}>
                  <span className="text-body/35">{label}</span>
                  <span className="text-amber/80 ml-2">{fmtCr(value as number)}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {contacts.some(c => hasValue(c.name) || hasValue(c.type) || hasValue(c.description) || hasValue(c.link)) && (
          <DetailSection title="CONTACTS">
            <div className="space-y-1">
              {contacts
                .filter(c => hasValue(c.name) || hasValue(c.type) || hasValue(c.description) || hasValue(c.link))
                .map((contact, i) => (
                  <div key={`${contact.name ?? contact.type ?? i}-${i}`} className="text-xs font-mono border border-steel/35 px-2 py-1">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {contact.name && <span className="text-bright">{contact.name}</span>}
                      {contact.type && <span className="text-amber">{contact.type}</span>}
                      {contact.gender_species && <span className="text-body/45">{contact.gender_species}</span>}
                      {contact.alive !== null && <span className={contact.alive ? 'text-safe' : 'text-alert'}>{contact.alive ? 'ALIVE' : 'DEAD'}</span>}
                    </div>
                    {contact.description && <div className="text-body/60 mt-0.5">{contact.description}</div>}
                  </div>
                ))}
            </div>
          </DetailSection>
        )}

        {backgroundRows.length > 0 && (
          <DetailSection title="BACKGROUND">
            <div className="space-y-1.5 text-xs font-mono">
              {backgroundRows.map(([label, value]) => (
                <div key={label} className="border border-steel/35 px-2 py-1">
                  <div className="text-body/35">{label}</div>
                  <div className="text-body/70 whitespace-pre-wrap">{String(value)}</div>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {/* Skills */}
        <div>
          <div className="label mb-2">
            SKILLS
            <span className="text-body/30 font-normal ml-2 text-[10px]">click to roll</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trainedSkills.map((sk, i) => (
              <button key={i} onClick={() => openSkillRoll(sk.name, sk.level)}
                title={sk.level === 0 ? 'Skill 0: competent, no DM bonus, avoids DM-3 unskilled penalty' : `Skill ${sk.level}: trained, DM+${sk.level}`}
                className={`flex items-center gap-1.5 border px-2 py-0.5 text-xs font-mono transition-colors ${
                  sk.level === 0
                    ? 'border-steel/60 text-body/70 hover:border-amber/60 hover:text-amber/70'
                    : 'border-steel text-cyan-trav hover:border-amber hover:text-amber'
                }`}>
                <span>{sk.name}</span>
                <span className="opacity-60 text-[10px]">{sk.level}</span>
              </button>
            ))}
            <button onClick={openCustomRoll}
              title="Roll any skill check. Skill 0 = no DM bonus. Unskilled = DM-3."
              className="flex items-center gap-1 border border-dashed border-steel/50 text-body/40 hover:border-amber/50 hover:text-amber/50 px-2 py-0.5 text-xs font-mono transition-colors">
              <Plus size={9} /> CUSTOM
            </button>
          </div>
        </div>

        {/* Psionics */}
        {hasPsionics && char.psionic_talents.length > 0 && (
          <div>
            <div className="label mb-2 text-cyan-trav">PSIONICS</div>
            <div className="flex flex-wrap gap-1.5">
              {char.psionic_talents.map((t, i) => (
                <button key={i} onClick={() => openPsiRoll(t.name, t.level)}
                  className="flex items-center gap-1.5 border border-cyan-dim text-cyan-trav hover:border-cyan-trav px-2 py-0.5 text-xs font-mono transition-colors">
                  <span>{t.name}</span>
                  <span className="opacity-60 text-[10px]">{t.level}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Weapons */}
        <div>
          <div className="label mb-2">WEAPONS</div>
          <div className="space-y-1">
            {(char.weapons ?? []).map((w, i) => (
              <button key={i} onClick={() => openWeaponRoll(w)}
                className="w-full flex items-center gap-3 border border-steel/40 hover:border-amber/60 px-3 py-2 text-xs font-mono transition-colors text-left group">
                <span className="text-bright group-hover:text-amber min-w-[7rem]">{w.name}</span>
                <span className="text-body/40 min-w-[3rem]">{w.range}</span>
                <span className="text-amber/80 font-bold">{w.damage}</span>
                <span className="text-body/30 text-[10px] hidden sm:block">{w.skill}</span>
                {w.traits && <span className="text-body/30 text-[10px] ml-auto hidden md:block">{w.traits}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        {char.notes && (
          <div className="text-xs text-body/70 border-t border-steel/50 pt-2">{char.notes}</div>
        )}

      </div>
    </>
  );
}

// ─── Mobile Card (accordion) ──────────────────────────────────────────────────

function CharCard({
  char, onEdit, onDelete, onRollSave, onStatAdjust, onPortraitUpload, uploadingPortrait,
}: {
  char: Character;
  onEdit: () => void;
  onDelete: () => void;
  onRollSave: (charName: string, result: { d1: number; d2: number; charDM: number; skillLevel: number; bonusDM: number; total: number }, checkLabel: string, difficulty: number) => void;
  onStatAdjust: (id: string, patch: Partial<Character>) => void;
  onPortraitUpload: (char: Character, file: File) => void;
  uploadingPortrait: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayName = charDisplayName(char);
  const status = physicalStatus(char);

  return (
    <div className="panel">
      <div
        className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-steel/20 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <CharacterPortrait
            char={char}
            size="sm"
            editable
            uploading={uploadingPortrait}
            onUpload={file => onPortraitUpload(char, file)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-bright font-bold font-mono text-sm truncate">{displayName}</div>
              <CharacterActionsMenu onEdit={onEdit} onDelete={onDelete} />
            </div>
            <div className="text-xs text-body/50 mt-0.5 space-x-2">
              {char.rank && <span className="text-amber">{char.rank}</span>}
              {char.career && <span className="text-body/50">· {char.career}</span>}
              {char.homeworld && <span className="text-body/40">· {char.homeworld}</span>}
              {char.player && <span className="text-steel ml-2">[{char.player}]</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-lg text-amber tracking-widest glow-amber">{upp(char)}</div>
            <div className={`text-xs font-mono ${status.color}`}>{status.label}</div>
          </div>
          {expanded ? <ChevronUp size={14} className="text-body" /> : <ChevronDown size={14} className="text-body" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-steel px-4 py-3">
          <CharDetailContent
            char={char}
            onRollSave={onRollSave}
            onStatAdjust={onStatAdjust}
          />
        </div>
      )}
    </div>
  );
}

// ─── Desktop Sidebar Row ──────────────────────────────────────────────────────

function CharSidebarRow({
  char, selected, onSelect,
}: {
  char: Character;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const displayName = charDisplayName(char);
  const status = physicalStatus(char);

  return (
    <button
      className={`w-full text-left px-3 py-3 border-b border-steel/30 transition-colors ${
        selected
          ? 'bg-steel/20 border-l-2 border-l-amber'
          : 'hover:bg-steel/10'
      }`}
      onClick={() => onSelect(char.id)}
    >
      <div className="font-mono text-sm text-bright truncate">{displayName}</div>
      <div className="flex items-center justify-between mt-0.5">
        <div className="font-mono text-xs text-amber tracking-wider">{upp(char)}</div>
        <div className={`text-[10px] font-mono ${status.color}`}>{status.label}</div>
      </div>
      {char.rank && (
        <div className="text-[10px] text-body/40 mt-0.5 truncate">{char.rank}</div>
      )}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PartyRoster() {
  const { client } = useSupabase();
  const [chars, setChars] = useState<Character[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CharForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [skillsRaw, setSkillsRaw] = useState('');
  const [talentsRaw, setTalentsRaw] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadingPortraitId, setUploadingPortraitId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadChars = useCallback(async () => {
    if (!client) return;
    const { data } = await client.from('characters').select('*').order('name');
    if (data) setChars(data as Character[]);
  }, [client]);

  useEffect(() => {
    loadChars();
    if (!client) return;
    const channel = client
      .channel('roster-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, loadChars)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, loadChars]);

  async function saveChar(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    const payload: CharForm = {
      ...form,
      skills: parseSkillsCSV(skillsRaw),
      psionic_talents: parseTalentsCSV(talentsRaw),
    };
    if (editing) {
      const editingId = editing;
      const previous = chars.find(c => c.id === editingId);
      const optimistic = {
        ...(previous ?? { id: editingId, created_at: new Date().toISOString() }),
        ...payload,
      } as Character;

      setChars(prev => sortCharacters(prev.map(c => c.id === editingId ? optimistic : c)));
      setSelectedId(editingId);
      setEditing(null);
      setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setShowForm(false);

      const { data, error } = await client.from('characters').update(payload).eq('id', editingId).select().single();
      if (error) {
        console.error('Character update failed:', error);
        if (previous) {
          setChars(prev => sortCharacters(prev.map(c => c.id === editingId ? previous : c)));
        }
        loadChars();
        return;
      }
      if (data) {
        setChars(prev => sortCharacters(prev.map(c => c.id === editingId ? data as Character : c)));
      }
      return;
    } else {
      const { data, error } = await client.from('characters').insert(payload).select().single();
      if (error) {
        console.error('Character insert failed:', error);
        return;
      }
      if (data) {
        const inserted = data as Character;
        setChars(prev => sortCharacters([...prev, inserted]));
        setSelectedId(inserted.id);
      }
    }
    setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setShowForm(false);
  }

  async function deleteChar(id: string) {
    if (!client || !confirm('Remove this character?')) return;
    const previous = chars.find(c => c.id === id);
    setChars(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    const { error } = await client.from('characters').delete().eq('id', id);
    if (error) {
      console.error('Character delete failed:', error);
      if (previous) setChars(prev => sortCharacters([...prev, previous]));
      loadChars();
    }
  }

  function startEdit(char: Character) {
    setForm({
      name: char.name, player: char.player, portrait_url: char.portrait_url,
      str: char.str, dex: char.dex, end_stat: char.end_stat,
      int_stat: char.int_stat, edu: char.edu, soc: char.soc, psi: char.psi,
      chr: char.chr, mor: char.mor, lck: char.lck,
      str_cur: char.str_cur, dex_cur: char.dex_cur, end_cur: char.end_cur, psi_cur: char.psi_cur,
      temp_mods: normalizeTempMods(char.temp_mods),
      profile_details: char.profile_details ?? {},
      homeworld_details: char.homeworld_details ?? {},
      lifepath: char.lifepath ?? [],
      armour: char.armour ?? [],
      augments: char.augments ?? [],
      personal_equipment: char.personal_equipment ?? [],
      finances: char.finances ?? {},
      contacts: char.contacts ?? [],
      background: char.background ?? {},
      career: char.career, rank: char.rank, homeworld: char.homeworld,
      skills: char.skills, psionic_talents: char.psionic_talents,
      weapons: char.weapons ?? [],
      notes: char.notes,
    });
    setSkillsRaw(char.skills.map(s => `${s.name}-${s.level}`).join(', '));
    setTalentsRaw(char.psionic_talents.map(t => `${t.name}-${t.level}`).join(', '));
    setEditing(char.id);
    setShowForm(true);
  }

  async function saveRoll(
    charName: string,
    result: { d1: number; d2: number; charDM: number; skillLevel: number; bonusDM: number; total: number },
    checkLabel: string,
    difficulty: number,
  ) {
    if (!client) return;
    await client.from('roll_log').insert({
      character_name: charName,
      check_label: checkLabel,
      d1: result.d1, d2: result.d2,
      char_dm: result.charDM, skill_level: result.skillLevel,
      bonus_dm: result.bonusDM,
      total: result.total, difficulty,
      success: result.total >= difficulty,
      effect: result.total - difficulty,
    });
  }

  async function handleStatAdjust(id: string, patch: Partial<Character>) {
    if (!client) return;
    setChars(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    const { error } = await client.from('characters').update(patch).eq('id', id);
    if (error) {
      console.error('Stat update failed:', error);
      const isTempModOnly = Object.keys(patch).length === 1 && Object.prototype.hasOwnProperty.call(patch, 'temp_mods');
      if (!isTempModOnly) loadChars();
    }
  }

  async function uploadPortrait(char: Character, file: File) {
    if (!client || uploadingPortraitId) return;
    if (!file.type.startsWith('image/')) {
      alert('Choose an image file for the portrait.');
      return;
    }

    setUploadingPortraitId(char.id);
    try {
      const portrait_url = await portraitFileToDataUrl(file);
      setChars(prev => prev.map(c => c.id === char.id ? { ...c, portrait_url } : c));

      const { error: updateError } = await client.from('characters').update({ portrait_url }).eq('id', char.id);
      if (updateError) {
        console.error('Portrait update failed:', updateError);
        alert('Portrait could not be saved: ' + updateError.message);
        loadChars();
      }
    } catch (error) {
      console.error('Portrait upload failed:', error);
      alert(error instanceof Error ? error.message : 'Portrait upload failed.');
    } finally {
      setUploadingPortraitId(null);
    }
  }

  async function handleXLSX(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    const buffer = await file.arrayBuffer();
    const playerName = file.name.replace(/\.[^.]+$/, '');
    const parsed = parseXLSXCharacter(buffer, playerName);
    if (!parsed) { alert('Could not parse character sheet. Check the file format.'); return; }
    const { data, error } = await client.from('characters').insert(parsed).select().single();
    if (error) {
      console.error('Character import failed:', error);
      return;
    }
    if (data) {
      const inserted = data as Character;
      setChars(prev => sortCharacters([...prev, inserted]));
      setSelectedId(inserted.id);
    }
    e.target.value = '';
  }

  const selectedChar = chars.find(c => c.id === selectedId) ?? null;

  const numInput = (key: keyof CharForm, label: string) => {
    const val = (form[key] as number | null) ?? null;
    const inputId = `character-${String(key)}`;
    return (
      <div key={key} className="space-y-1">
        <label htmlFor={inputId} className="label flex items-center justify-between">
          <span>{label}</span>
          {val !== null && <span className="text-amber font-mono">{toHex(val)}</span>}
        </label>
        <input id={inputId} className="input" type="number" min={0} max={15} value={val ?? ''}
          onChange={e => setForm({ ...form, [key]: e.target.value ? parseInt(e.target.value) : null })} />
      </div>
    );
  };

  const charForm = (
    <form onSubmit={saveChar} className="panel p-4 space-y-4">
      <div className="panel-header -mx-4 -mt-4 mb-1">
        {editing ? 'EDIT CHARACTER' : 'NEW CHARACTER'}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field name="Character Name">
          <input className="input" required value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field name="Player">
          <input className="input" value={form.player ?? ''} placeholder="Graham, Jesse, ..."
            onChange={e => setForm({ ...form, player: e.target.value || null })} />
        </Field>
        <Field name="Rank / Title">
          <input className="input" value={form.rank ?? ''} placeholder="Lance Corporal, fmr. Knight"
            onChange={e => setForm({ ...form, rank: e.target.value || null })} />
        </Field>
        <Field name="Career">
          <input className="input" value={form.career ?? ''}
            onChange={e => setForm({ ...form, career: e.target.value || null })} />
        </Field>
        <Field name="Homeworld">
          <input className="input" value={form.homeworld ?? ''}
            onChange={e => setForm({ ...form, homeworld: e.target.value || null })} />
        </Field>
      </div>
      <Field name="Portrait URL">
        <input className="input" value={form.portrait_url ?? ''} placeholder="https://..."
          onChange={e => setForm({ ...form, portrait_url: e.target.value || null })} />
      </Field>
      <div>
        <div className="label mb-2">UPP (0–15; hex shown live)</div>
        <div className="grid grid-cols-6 gap-2">
          {CORE_STAT_FIELDS.map(k =>
            numInput(k, STAT_LABELS[k as CharStat] ?? String(k))
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {numInput('psi', 'PSI')}
        {numInput('chr', 'CHR')}
        {numInput('mor', 'MOR')}
        {numInput('lck', 'LCK')}
      </div>
      <Field name="Skills (e.g. Medic-2, Gun Combat (Slug)-3, Recon-1)">
        <input className="input" value={skillsRaw} onChange={e => setSkillsRaw(e.target.value)}
          placeholder="SkillName-Level, ..." />
      </Field>
      <Field name="Psionic Talents (e.g. Awareness-1, Telepathy-0)">
        <input className="input" value={talentsRaw} onChange={e => setTalentsRaw(e.target.value)}
          placeholder="TalentName-Level, ..." />
      </Field>
      <Field name="Notes">
        <textarea className="input resize-none h-16" value={form.notes ?? ''}
          onChange={e => setForm({ ...form, notes: e.target.value || null })} />
      </Field>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setShowForm(false)} className="btn-steel">CANCEL</button>
        <button type="submit" className="btn-amber">{editing ? 'UPDATE' : 'SAVE'}</button>
      </div>
    </form>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Hidden file input — lives outside both layouts so it's always in the DOM */}
      <input ref={fileRef} type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden" onChange={handleXLSX} />

      {/* ── Mobile layout (< lg) ────────────────────────────────────────────── */}
      <div className="lg:hidden flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-body text-xs tracking-wider">
            {chars.length} CHARACTER{chars.length !== 1 ? 'S' : ''} REGISTERED
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="btn-steel flex items-center gap-1">
              <Upload size={13} /> IMPORT XLSX
            </button>
            <button
              onClick={() => { setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setEditing(null); setShowForm(v => !v); }}
              className="btn-amber flex items-center gap-1">
              <Plus size={13} /> ADD CHARACTER
            </button>
          </div>
        </div>

        {showForm && charForm}

        <div className="space-y-3">
          {chars.map(char => (
            <CharCard key={char.id} char={char}
              onEdit={() => startEdit(char)}
              onDelete={() => deleteChar(char.id)}
              onRollSave={saveRoll}
              onStatAdjust={handleStatAdjust}
              onPortraitUpload={uploadPortrait}
              uploadingPortrait={uploadingPortraitId === char.id}
            />
          ))}
        </div>

        {chars.length === 0 && !showForm && (
          <div className="text-center py-16 text-body/40 text-sm space-y-2">
            <div className="text-4xl opacity-20">◈</div>
            <div>No characters registered. Import an XLSX sheet or add manually.</div>
          </div>
        )}
      </div>

      {/* ── Desktop layout (≥ lg) ────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-steel flex flex-col overflow-hidden">
          <div className="p-2 border-b border-steel space-y-1.5 flex-shrink-0">
            <button onClick={() => fileRef.current?.click()}
              className="btn-steel w-full flex items-center justify-center gap-1 text-xs">
              <Upload size={12} /> IMPORT XLSX
            </button>
            <button
              onClick={() => { setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setEditing(null); setShowForm(true); setSelectedId(null); }}
              className="btn-amber w-full flex items-center justify-center gap-1 text-xs">
              <Plus size={12} /> ADD CHARACTER
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {chars.map(char => (
              <CharSidebarRow key={char.id} char={char}
                selected={selectedId === char.id && !showForm}
                onSelect={id => { setSelectedId(id); setShowForm(false); }}
              />
            ))}
            {chars.length === 0 && (
              <div className="text-xs text-body/30 p-4 text-center">No characters</div>
            )}
          </div>

          <div className="border-t border-steel/50 px-3 py-2 text-[10px] text-body/30 flex-shrink-0">
            {chars.length} CHARACTER{chars.length !== 1 ? 'S' : ''}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto">
          {showForm ? (
            <div className="p-4 max-w-2xl">{charForm}</div>
          ) : selectedChar ? (
            <div className="p-5">
              <div className="flex items-start gap-5">
                <div className="min-w-0 flex-1">
                  {/* Character header */}
                  <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-steel/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-bright font-bold font-mono text-xl truncate">{charDisplayName(selectedChar)}</div>
                        <CharacterActionsMenu
                          onEdit={() => startEdit(selectedChar)}
                          onDelete={() => deleteChar(selectedChar.id)}
                        />
                      </div>
                      <div className="text-xs text-body/50 mt-1 flex flex-wrap gap-x-2">
                        {selectedChar.rank && <span className="text-amber">{selectedChar.rank}</span>}
                        {selectedChar.career && <span>· {selectedChar.career}</span>}
                        {selectedChar.homeworld && <span>· {selectedChar.homeworld}</span>}
                        {selectedChar.player && <span className="text-steel">· [{selectedChar.player}]</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-2xl text-amber tracking-widest glow-amber">{upp(selectedChar)}</div>
                      <div className={`text-xs font-mono mt-0.5 ${physicalStatus(selectedChar).color}`}>
                        {physicalStatus(selectedChar).label}
                      </div>
                    </div>
                  </div>

                  {/* key resets all local state (tracking, damage input, etc.) when switching characters */}
                  <CharDetailContent
                    key={selectedChar.id}
                    char={selectedChar}
                    onRollSave={saveRoll}
                    onStatAdjust={handleStatAdjust}
                  />
                </div>
                <aside className="w-32 flex-shrink-0 border-l border-steel/50 pl-4">
                  <CharacterPortrait
                    char={selectedChar}
                    editable
                    uploading={uploadingPortraitId === selectedChar.id}
                    onUpload={file => uploadPortrait(selectedChar, file)}
                  />
                </aside>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-body/30">
              <div className="text-center space-y-2">
                <div className="text-5xl opacity-20">◈</div>
                <div className="text-sm">Select a character from the roster</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
