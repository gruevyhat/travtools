import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Download, Plus, Upload, ChevronDown, ChevronUp, X, Minus, Settings, Pencil, Trash2 } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import {
  ArmourItem,
  AttributeMods,
  Character,
  CharacterAugment,
  CharacterContact,
  LifepathTerm,
  PersonalEquipmentItem,
  Weapon,
} from '../../types';
import {
  toHex, upp, statDM, skillChar, parseSkillsCSV, parseTalentsCSV,
  STAT_LABELS, CharStat, parseDamageExpr, DEFAULT_CHARACTER_TITLE,
} from '../../lib/traveller';
import { downloadCsv } from '../../lib/csv';
import { rosterFromCsv, rosterToCsv, type RosterCsvCharacter } from '../../lib/rosterCsv';
import { CORE_EQUIPMENT } from '../../data/equipment';
import { fmtDM, DIFFICULTIES, RollMode } from '../../lib/dice';
import { spendWeaponAmmo, weaponAmmoState, weaponAmmoStateLabel, weaponClipSize, type WeaponAmmoSpendResult } from '../../lib/ammo';
import NumberStepper from '../shared/NumberStepper';

// ─── Types ──────────────────────────────────────────────────────────────────

type CharForm = Omit<Character, 'id' | 'created_at'>;

const EMPTY: CharForm = {
  status: 'active',
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
  career: null, rank: DEFAULT_CHARACTER_TITLE, homeworld: null,
  skills: [], psionic_talents: [],
  weapons: [{ name: 'Unarmed', skill: 'Melee (Unarmed)', range: 'Melee', damage: '1D+STR DM', traits: '' }],
  notes: null,
};

const CORE_STATS: CharStat[] = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'];
const EXTRA_STATS: CharStat[] = ['chr', 'mor', 'lck'];
const ALL_STATS: CharStat[] = [...CORE_STATS, 'psi', ...EXTRA_STATS];
const CORE_STAT_FIELDS: Array<keyof CharForm> = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'];
const PORTRAIT_WIDTH = 360;
const PORTRAIT_HEIGHT = 480;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIntegerInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '+' || trimmed === '-') return 0;
  const value = parseInt(trimmed, 10);
  return Number.isNaN(value) ? 0 : value;
}

function successChance(difficulty: number, modifier: number): number {
  const target = difficulty - modifier;
  let hits = 0;
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      if (d1 + d2 >= target) hits++;
    }
  }
  return hits / 36;
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
      mods[key] = Math.trunc(value);
    }
    return mods;
  }, {});
}

function parseNullableNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function parseNullableNonNegativeInteger(raw: string): number | null {
  const value = parseNullableNumber(raw);
  return value === null ? null : Math.max(0, Math.trunc(value));
}

function normaliseLookupName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\(x\s*\d+\)/g, '')
    .replace(/\btl\s*\d+\b/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function equipmentLookupName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\(x\s*\d+\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inferredQuantityFromName(name: string | null | undefined): number | null {
  const match = (name ?? '').match(/\(x\s*(\d+)\)/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function quantityFor(item: { quantity?: number | null; name?: string | null }): number {
  return item.quantity ?? inferredQuantityFromName(item.name) ?? 1;
}

function explicitMass(item: { mass?: number | null; mass_kg?: number | null; weight_kg?: number | null }): number | null {
  if (typeof item.mass === 'number') return item.mass;
  if (typeof item.mass_kg === 'number') return item.mass_kg;
  if (typeof item.weight_kg === 'number') return item.weight_kg;
  return null;
}

function coreMassFor(name: string | null | undefined, categories: string[]): number | null {
  const exactKey = equipmentLookupName(name);
  const exactMatch = CORE_EQUIPMENT.find(item =>
    categories.includes(item.inventoryCategory) &&
    item.massKg !== null &&
    equipmentLookupName(item.name) === exactKey
  );
  if (exactMatch) return exactMatch.massKg;

  const key = normaliseLookupName(name);
  if (!key) return null;
  const match = CORE_EQUIPMENT.find(item =>
    categories.includes(item.inventoryCategory) &&
    item.massKg !== null &&
    normaliseLookupName(item.name) === key
  );
  return match?.massKg ?? null;
}

function massFor(item: { name?: string | null; mass?: number | null; mass_kg?: number | null; weight_kg?: number | null }, categories: string[]): number | null {
  return explicitMass(item) ?? coreMassFor(item.name, categories);
}

function kg(value: number): string {
  const raw = value.toFixed(value >= 10 ? 1 : 2);
  return `${raw.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')} kg`;
}

function carriedMass(char: Character): number {
  const weaponMass = (char.weapons ?? []).reduce((sum, item) => {
    const mass = massFor(item, ['Weapon']);
    return mass === null ? sum : sum + mass * quantityFor(item);
  }, 0);

  const armourMass = (char.armour ?? []).reduce((sum, item) => {
    const mass = massFor(item, ['Armour']);
    if (mass === null) return sum;
    const wornMultiplier = item.worn ? 0.25 : 1;
    return sum + mass * quantityFor(item) * wornMultiplier;
  }, 0);

  const equipmentMass = (char.personal_equipment ?? []).reduce((sum, item) => {
    const mass = massFor(item, ['Equipment', 'Medicine', 'Electronics', 'Survival', 'Other']);
    return mass === null ? sum : sum + mass * quantityFor(item);
  }, 0);

  return weaponMass + armourMass + equipmentMass;
}

function knownSkillLevel(char: Character, names: string[]): number | null {
  const wanted = names.map(normaliseLookupName);
  let best: number | null = null;
  for (const skill of char.skills ?? []) {
    const skillName = normaliseLookupName(skill.name);
    const matches = wanted.some(name => skillName === name || skillName.startsWith(`${name} `));
    if (matches) best = Math.max(best ?? skill.level, skill.level);
  }
  return best;
}

function athleticsLoadBonus(char: Character): number {
  return (char.skills ?? []).reduce((bonus, skill) => {
    const name = normaliseLookupName(skill.name);
    if (name === 'athletics' || name === 'athletics strength' || name === 'athletics endurance') {
      return bonus + Math.max(0, skill.level);
    }
    return bonus;
  }, 0);
}

function encumbranceStatus(totalKg: number, capacityKg: number): { label: string; color: string; physicalMod: number | null } {
  if (capacityKg <= 0) return { label: 'UNKNOWN', color: 'text-body/70', physicalMod: null };
  if (totalKg <= capacityKg) return { label: 'CLEAR', color: 'text-safe', physicalMod: 0 };
  if (totalKg <= capacityKg * 2) return { label: 'ENCUMBERED', color: 'text-amber', physicalMod: -2 };
  return { label: 'OVERLOADED', color: 'text-alert', physicalMod: -2 };
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

function isCharacterDeceased(char: Character): boolean {
  return char.status === 'deceased';
}

function physicalStatus(char: Character): { label: string; color: string } {
  if (isCharacterDeceased(char)) return { label: 'DECEASED', color: 'text-alert' };
  const tempMods = normalizeTempMods(char.temp_mods);
  const maxEnd = effectiveStatValue(char.end_stat, tempMods.end_stat ?? 0) ?? 0;
  const maxStr = effectiveStatValue(char.str, tempMods.str ?? 0) ?? 0;
  const maxDex = effectiveStatValue(char.dex, tempMods.dex ?? 0) ?? 0;
  const end = effectiveStatValue(char.end_cur ?? char.end_stat, tempMods.end_stat ?? 0) ?? 0;
  const str = effectiveStatValue(char.str_cur ?? char.str, tempMods.str ?? 0) ?? 0;
  const dex = effectiveStatValue(char.dex_cur ?? char.dex, tempMods.dex ?? 0) ?? 0;
  if (end <= 0 && str <= 0 && dex <= 0) return { label: 'DEAD', color: 'text-alert' };
  if (end <= 0 && (str <= 0 || dex <= 0)) return { label: 'INCAPACITATED', color: 'text-alert' };
  if (end <= 0) return { label: 'SERIOUS WOUND', color: 'text-alert' };
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
        className="w-6 h-6 border border-steel/50 text-body/70 hover:border-amber/70 hover:text-amber transition-colors flex items-center justify-center"
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

  const boxClass = size === 'sm' ? 'w-12 h-16' : 'w-48 h-64';
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
          <span className={`${textClass} font-mono text-body/70`}>PORTRAIT</span>
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
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-steel/50 pt-3 ${className}`}>
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
  skillLevel: number | null;
  charKey: CharStat | null;
  isPsionic: boolean;
  isCustom?: boolean;
  kind?: 'check' | 'initiative';
  applyJackOfAllTrades?: boolean;
  weapon?: Weapon;
  weaponIndex?: number;
}

interface AttackResult {
  d1: number; d2: number;
  discarded: number | null;
  rollMode: RollMode;
  charDM: number; skillLevel: number; bonusDM: number;
  total: number; effect: number;
}

interface DamageResult {
  rolls: number[];
  constant: number;
  strDM: number;
  effect: number;
  damageModifier: number;
  total: number;
}

const WEAPON_ROSTER_GRID = 'md:grid-cols-[minmax(5.5rem,8rem)_2.5rem_3.5rem_4.75rem_4.5rem_minmax(8rem,1fr)]';
const AMMO_BAR_LIMIT = 120;

function ammoRoundBars(rounds: number): string {
  const count = Math.max(0, Math.trunc(rounds));
  if (count <= 0) return '-';
  const visible = '|'.repeat(Math.min(count, AMMO_BAR_LIMIT));
  return count > AMMO_BAR_LIMIT ? `${visible}+${count - AMMO_BAR_LIMIT}` : visible;
}

function RollModal({
  char,
  target: initialTarget,
  statValues,
  psiCurrent,
  psiMax,
  onClose,
  onSave,
  onSaveDamage,
  onSpendPsi,
  onSpendAmmo,
}: {
  char: Character;
  target: RollTarget;
  statValues: Partial<Record<CharStat, number | null>>;
  psiCurrent: number;
  psiMax: number;
  onClose: () => void;
  onSave: (result: { d1: number; d2: number; charDM: number; skillLevel: number; bonusDM: number; total: number }, difficulty: number, label: string) => void;
  onSaveDamage?: (weaponName: string, rolls: number[], constant: number, strDM: number, effect: number, total: number) => void;
  onSpendPsi?: (cost: number) => void;
  onSpendAmmo?: (amount: number) => WeaponAmmoSpendResult | null;
}) {
  const isWeapon = !!initialTarget.weapon;
  const currentWeapon = isWeapon
    ? initialTarget.weaponIndex !== undefined
      ? char.weapons?.[initialTarget.weaponIndex] ?? initialTarget.weapon!
      : initialTarget.weapon!
    : null;
  const isMelee = currentWeapon?.range === 'Melee';
  const isInitiative = initialTarget.kind === 'initiative';
  const isPsionic = initialTarget.isPsionic;

  const defaultCharKey = initialTarget.charKey ?? (isMelee ? 'str' : null);

  const [charKey, setCharKey] = useState<CharStat | null>(defaultCharKey);
  const [difficulty, setDifficulty] = useState<number>(8);
  const [label, setLabel] = useState(initialTarget.label);
  const [skillLevelInput] = useState(initialTarget.skillLevel === null ? 'None' : String(initialTarget.skillLevel));
  const [bonusDMInput, setBonusDMInput] = useState('');
  const [psiCostInput, setPsiCostInput] = useState('');
  const [ammoUseInput, setAmmoUseInput] = useState(isWeapon ? '1' : '');
  const [damageModifierInput, setDamageModifierInput] = useState('');
  const [rollMode, setRollMode] = useState<RollMode>('normal');
  const [attackResult, setAttackResult] = useState<AttackResult | null>(null);
  const [damageResult, setDamageResult] = useState<DamageResult | null>(null);
  const [lastPsiCostSpent, setLastPsiCostSpent] = useState<number | null>(null);
  const [lastAmmoSpend, setLastAmmoSpend] = useState<WeaponAmmoSpendResult | null>(null);
  const [saved, setSaved] = useState(false);
  const isCustom = initialTarget.isCustom === true;

  function statValue(key: CharStat): number | null {
    if (Object.prototype.hasOwnProperty.call(statValues, key)) return statValues[key] ?? null;
    return char[key] as number | null;
  }

  const charDM = charKey !== null ? statDM(statValue(charKey)) : 0;
  const skillLevelIsNone = skillLevelInput === 'None';
  const joatLevel = skillLevelIsNone && initialTarget.applyJackOfAllTrades ? knownSkillLevel(char, ['Jack-of-all-Trades', 'Jack of All Trades']) ?? 0 : 0;
  const skillLevel = isInitiative ? 0 : skillLevelIsNone ? -3 + joatLevel : parseIntegerInput(skillLevelInput);
  const bonusDM = parseIntegerInput(bonusDMInput);
  const psiCost = Math.max(0, parseIntegerInput(psiCostInput));
  const ammoUse = Math.max(0, parseIntegerInput(ammoUseInput));
  const damageModifier = parseIntegerInput(damageModifierInput);
  const hasPsiPool = psiMax > 0;
  const psiAfterCost = hasPsiPool ? Math.max(0, psiCurrent - psiCost) : 0;
  const ammoState = currentWeapon ? weaponAmmoState(currentWeapon) : null;
  const tracksAmmo = ammoState?.tracked === true;
  const ammoPreview = currentWeapon && tracksAmmo && ammoUse > 0 ? spendWeaponAmmo(currentWeapon, ammoUse) : null;
  const availableStats = ALL_STATS.filter(k => statValue(k) !== null);
  const attackHit = attackResult !== null && attackResult.total >= difficulty;
  const skillSummary = skillLevelIsNone
    ? `None (${fmtDM(skillLevel)}${joatLevel > 0 ? ` incl. JoAT +${joatLevel}` : ''})`
    : fmtDM(skillLevel);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function rollAttack() {
    const spentPsiCost = isPsionic ? psiCost : 0;
    const d6 = () => Math.ceil(Math.random() * 6);
    const rawDice = rollMode === 'normal' ? [d6(), d6()] : [d6(), d6(), d6()];
    const sorted = [...rawDice].sort((a, b) => a - b);
    const kept = rollMode === 'boon' ? sorted.slice(1) : rollMode === 'bane' ? sorted.slice(0, 2) : rawDice;
    const discarded = rollMode === 'normal' ? null : rollMode === 'boon' ? sorted[0] : sorted[2];
    const [d1, d2] = kept;
    const total = d1 + d2 + charDM + skillLevel + bonusDM;
    const effect = total - difficulty;
    const r: AttackResult = { d1, d2, discarded, rollMode, charDM, skillLevel, bonusDM, total, effect };
    setAttackResult(r);
    setDamageResult(null);
    setSaved(false);
    onSave({ d1, d2, charDM, skillLevel, bonusDM, total }, difficulty, label || 'Unknown');
    if (spentPsiCost > 0 && onSpendPsi) {
      onSpendPsi(spentPsiCost);
      setLastPsiCostSpent(spentPsiCost);
      setPsiCostInput('');
    } else {
      setLastPsiCostSpent(null);
    }
    if (isWeapon && tracksAmmo && ammoUse > 0 && onSpendAmmo) {
      setLastAmmoSpend(onSpendAmmo(ammoUse));
    } else {
      setLastAmmoSpend(null);
    }
    setSaved(true);
  }

  function rollDamage() {
    if (!attackResult || !attackHit || !currentWeapon) return;
    const { dice, constant } = parseDamageExpr(currentWeapon.damage);
    const strDMVal = isMelee ? statDM(statValue('str')) : 0;
    const effect = attackResult.effect;
    const rolls = Array.from({ length: Math.max(1, dice) }, () => Math.ceil(Math.random() * 6));
    const base = rolls.reduce((s, r) => s + r, 0);
    const total = Math.max(0, base + constant + strDMVal + effect + damageModifier);
    setDamageResult({ rolls, constant, strDM: strDMVal, effect, damageModifier, total });
    onSaveDamage?.(currentWeapon.name, rolls, constant + damageModifier, strDMVal, effect, total);
  }

  const success = attackResult !== null && attackResult.total >= difficulty;
  const effect = attackResult !== null ? attackResult.total - difficulty : 0;
  const modalTitle = isWeapon
    ? `${currentWeapon?.name ?? initialTarget.label} ATTACK — ${charDisplayName(char)}`
    : isInitiative ? `INITIATIVE — ${charDisplayName(char)}`
    : isCustom ? `UNKNOWN CHECK — ${charDisplayName(char)}`
    : `${label} CHECK — ${charDisplayName(char)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 panel border border-steel/80 shadow-2xl">
        <div className="panel-header flex items-center justify-between">
          <span className="truncate">{modalTitle}</span>
          <button onClick={onClose} className="text-body/70 hover:text-body ml-4 flex-shrink-0"><X size={14} /></button>
        </div>

        <div className="p-4 space-y-3">
          {isWeapon && currentWeapon && (
            <div className="flex items-center gap-4 text-xs font-mono border border-steel/40 px-3 py-2">
              <span className="text-body/70">{currentWeapon.range}</span>
              <span className="text-amber">{currentWeapon.damage}</span>
              <span className="text-body/65 text-[10px]">{currentWeapon.skill}</span>
              {currentWeapon.traits && <span className="text-body/55 text-[10px] ml-auto">{currentWeapon.traits}</span>}
            </div>
          )}

          {isWeapon && currentWeapon && tracksAmmo && ammoState && (
            <div className="flex items-center gap-2 flex-wrap border border-amber/35 px-2 py-1 text-xs font-mono">
              <label className="text-[10px] uppercase tracking-wider text-amber" htmlFor="roll-ammo-used">Ammo Used</label>
              <NumberStepper
                id="roll-ammo-used"
                ariaLabel="Ammo Used"
                className="w-20"
                inputClassName="input text-xs h-7 py-0 px-2"
                min={0}
                step={1}
                value={ammoUseInput}
                onChange={setAmmoUseInput}
              />
              <span className={ammoState.totalRounds === 0 ? 'text-alert' : 'text-cyan-trav'}>
                {weaponAmmoStateLabel(ammoState)}
              </span>
              {ammoPreview && (
                <span className={ammoPreview.insufficient ? 'text-alert' : 'text-body/55'}>
                  after {weaponAmmoStateLabel(ammoPreview.after)}
                  {ammoPreview.insufficient ? ` · only ${ammoPreview.spent} available` : ''}
                </span>
              )}
            </div>
          )}

          {isCustom && (
            <div className="space-y-1">
              <label className="label">Check Label</label>
              <input className="input text-xs" value={label} placeholder="e.g. Pilot (Small Craft)"
                onChange={e => setLabel(e.target.value)} />
            </div>
          )}

          <div className={`grid gap-2 ${isInitiative ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <div className="space-y-1">
              <label className="label">Characteristic</label>
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
            {!isInitiative && (
              <div className="space-y-1">
                <label className="label">Skill Level</label>
                <input className="input text-xs" type="text" value={skillLevelInput} readOnly />
              </div>
            )}
            <div className="space-y-1">
              <label className="label" htmlFor="roll-bonus-dm">Modifier</label>
              <NumberStepper
                id="roll-bonus-dm"
                ariaLabel="roll modifier"
                value={bonusDMInput}
                onChange={setBonusDMInput}
                placeholder="0"
                inputClassName="input text-xs"
              />
            </div>
          </div>

          {isCustom && (
            <div className="text-xs text-body/65 font-mono">
              Unknown skills use None: DM-3, plus Jack of All Trades if present.
            </div>
          )}

          {isPsionic && (
            <div className="flex items-center gap-2 flex-wrap border border-cyan-dim/40 px-2 py-1 text-xs font-mono">
              <label className="text-[10px] uppercase tracking-wider text-cyan-trav" htmlFor="roll-psi-cost">PSI Cost</label>
              <NumberStepper
                id="roll-psi-cost"
                ariaLabel="PSI Cost"
                className="w-20"
                inputClassName="input text-xs h-7 py-0 px-2"
                min={0}
                step={1}
                placeholder="0"
                disabled={!hasPsiPool}
                value={psiCostInput}
                onChange={setPsiCostInput}
              />
              <span className="text-body/60">PSI</span>
              <span className="text-cyan-trav">{hasPsiPool ? `${psiCurrent}/${psiMax}` : '--'}</span>
              {hasPsiPool && psiCost > 0 && (
                <span className={psiCost > psiCurrent ? 'text-alert' : 'text-body/55'}>
                  after {psiAfterCost}/{psiMax}
                </span>
              )}
              {!hasPsiPool && <span className="text-alert text-[10px]">No PSI score</span>}
            </div>
          )}

          {isInitiative ? (
            <div className="text-xs text-body/65 font-mono">
              Initiative is the Effect of an Average 8+ DEX or INT check.
            </div>
          ) : (
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
          )}

          <div className="text-xs text-body/70 font-mono">
            Char DM: <span className="text-cyan-trav">{fmtDM(charDM)}</span>
            {!isInitiative && <>{' · '}Skill: <span className="text-cyan-trav">{skillSummary}</span></>}
            {' · '}Modifier: <span className="text-cyan-trav">{fmtDM(bonusDM)}</span>
            {' · '}
            {isInitiative ? (
              <span className="text-body/70">Effect becomes Initiative</span>
            ) : (() => {
              const pct = Math.round(successChance(difficulty, charDM + skillLevel + bonusDM) * 100);
              return <span className={pct >= 50 ? 'text-safe' : 'text-alert'}>{pct}% success</span>;
            })()}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {(['normal', 'boon', 'bane'] as RollMode[]).map(m => (
              <button key={m} type="button" onClick={() => setRollMode(m)}
                className={`btn text-xs ${rollMode === m ? 'btn-amber' : 'btn-steel'}`}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <button onClick={rollAttack} className="btn-amber w-full text-center text-sm">
            {isWeapon ? 'ROLL ATTACK' : isInitiative ? 'ROLL INITIATIVE' : 'ROLL'}
            {' '}{rollMode === 'boon' || rollMode === 'bane' ? '3D6' : '2D6'}
          </button>

          {attackResult !== null && (
            <div className="border-t border-steel/60 pt-3 space-y-2">
              <div className="flex items-center gap-2 font-mono flex-wrap">
                <span className="inline-flex items-center justify-center w-9 h-9 border border-amber text-amber font-bold text-lg">{attackResult.d1}</span>
                <span className="text-body">+</span>
                <span className="inline-flex items-center justify-center w-9 h-9 border border-amber text-amber font-bold text-lg">{attackResult.d2}</span>
                {attackResult.discarded !== null && (
                  <span className="text-body/40 text-xs font-mono line-through">({attackResult.discarded})</span>
                )}
                {attackResult.charDM !== 0 && <><span className="text-body">+</span><span className="text-cyan-trav text-xs">{charKey && STAT_LABELS[charKey]} {fmtDM(attackResult.charDM)}</span></>}
                {!isInitiative && attackResult.skillLevel !== 0 && <><span className="text-body">+</span><span className="text-cyan-trav text-xs">Skill {skillLevelIsNone ? `None ${fmtDM(attackResult.skillLevel)}` : fmtDM(attackResult.skillLevel)}</span></>}
                {attackResult.bonusDM !== 0 && <><span className="text-body">+</span><span className="text-cyan-trav text-xs">Modifier {fmtDM(attackResult.bonusDM)}</span></>}
                <span className="text-body">=</span>
                <span className={`text-2xl font-bold ${isInitiative || success ? 'text-safe glow-cyan' : 'text-alert'}`}>{attackResult.total}</span>
              </div>
              {isInitiative ? (
                <div className="text-sm font-mono tracking-wider text-safe">
                  INITIATIVE {fmtDM(effect)}
                  <span className="text-body/60 text-xs ml-2">Effect of Average 8+ check</span>
                </div>
              ) : (
                <div className={`text-sm font-mono tracking-wider ${success ? 'text-safe' : 'text-alert'}`}>
                  {success ? (isWeapon ? '✓ HIT' : '✓ SUCCESS') : (isWeapon ? '✗ MISS' : '✗ FAILURE')}
                  <span className="text-body/60 text-xs ml-2">vs {difficulty}+</span>
                  <span className="text-bright text-xs ml-2">Effect {fmtDM(effect)}</span>
                </div>
              )}
              {saved && !isWeapon && (
                <div className="text-xs text-body/65">
                  Logged to Roll Log
                  {lastPsiCostSpent !== null && (
                    <span className="text-cyan-trav ml-2">PSI cost {lastPsiCostSpent} spent</span>
                  )}
                </div>
              )}

              {isWeapon && attackHit && (
                <div className="border-t border-steel/40 pt-2 space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2 items-end">
                    <div className="text-xs text-body/60 font-mono">
                      Damage: <span className="text-amber">{currentWeapon?.damage}</span>
                      {' + Effect'} {fmtDM(effect)}
                      {isMelee && <span className="text-body/70"> + STR DM {fmtDM(statDM(statValue('str')))}</span>}
                    </div>
                    <div className="space-y-1">
                      <label className="label" htmlFor="roll-damage-modifier">Damage Modifier</label>
                      <NumberStepper
                        id="roll-damage-modifier"
                        ariaLabel="Damage Modifier"
                        value={damageModifierInput}
                        onChange={setDamageModifierInput}
                        placeholder="0"
                        inputClassName="input text-xs"
                      />
                    </div>
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
                        {damageResult.damageModifier !== 0 && (
                          <><span className="text-body">+</span>
                          <span className="text-body/60 text-xs">Damage Mod {fmtDM(damageResult.damageModifier)}</span></>
                        )}
                        <span className="text-body">=</span>
                        <span className="text-alert font-bold text-2xl">{damageResult.total}</span>
                        <span className="text-body/70 text-xs">damage</span>
                      </div>
                      <div className="text-xs text-body/65 font-mono">
                        Damage goes to END first, then STR or DEX (target's choice)
                      </div>
                    </div>
                  )}
                </div>
              )}

              {saved && isWeapon && lastAmmoSpend && (
                <div className="text-xs text-body/65">
                  Ammo used {lastAmmoSpend.spent}
                  {lastAmmoSpend.insufficient && (
                    <span className="text-alert ml-2">requested {lastAmmoSpend.requested}; ammo empty</span>
                  )}
                  <span className="text-cyan-trav ml-2">{weaponAmmoStateLabel(lastAmmoSpend.after)}</span>
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
  char, onRollSave, onStatAdjust, indentTopRows = false,
}: {
  char: Character;
  onRollSave: (charName: string, result: { d1: number; d2: number; charDM: number; skillLevel: number; bonusDM: number; total: number }, checkLabel: string, difficulty: number) => void;
  onStatAdjust: (id: string, patch: Partial<Character>) => void;
  indentTopRows?: boolean;
}) {
  const [rollTarget, setRollTarget] = useState<RollTarget | null>(null);
  const [damageInput, setDamageInput] = useState('');
  const [psiInput, setPsiInput] = useState('');
  const [pendingOverflow, setPendingOverflow] = useState<number | null>(null);

  const tempMods = normalizeTempMods(char.temp_mods);
  const hasTempMods = Object.keys(tempMods).length > 0;

  function tempMod(key: CharStat): number {
    return tempMods[key] ?? 0;
  }

  function maxVal(key: CharStat): number | null {
    return effectiveStatValue(char[key] as number | null, tempMod(key));
  }

  function rawCurVal(key: CharStat): number | null {
    if (key === 'end_stat') return char.end_cur ?? char.end_stat;
    if (key === 'str') return char.str_cur ?? char.str;
    if (key === 'dex') return char.dex_cur ?? char.dex;
    if (key === 'psi') return char.psi_cur ?? char.psi;
    return char[key] as number | null;
  }

  function rawCurFloor(key: CharStat): number {
    return -tempMod(key);
  }

  function rawCurFromEffective(key: CharStat, value: number): number {
    return Math.trunc(value) - tempMod(key);
  }

  const endMax = maxVal('end_stat') ?? 0;
  const strMax = maxVal('str') ?? 0;
  const dexMax = maxVal('dex') ?? 0;
  const psiMax = maxVal('psi') ?? 0;
  const endCurRaw = rawCurVal('end_stat') ?? 0;
  const strCurRaw = rawCurVal('str') ?? 0;
  const dexCurRaw = rawCurVal('dex') ?? 0;
  const psiCurRaw = rawCurVal('psi') ?? 0;
  const endCur = effectiveStatValue(endCurRaw, tempMod('end_stat')) ?? 0;
  const strCur = effectiveStatValue(strCurRaw, tempMod('str')) ?? 0;
  const dexCur = effectiveStatValue(dexCurRaw, tempMod('dex')) ?? 0;
  const psiCur = effectiveStatValue(psiCurRaw, tempMod('psi')) ?? 0;

  const isDamaged = endCur < endMax || strCur < strMax || dexCur < dexMax;
  const isPsiSpent = char.psi !== null && psiMax > 0 && psiCur < psiMax;

  const [trackingHealth, setTrackingHealth] = useState(() => isDamaged);
  const [trackingPsi, setTrackingPsi] = useState(() => isPsiSpent);
  const [trackingTempMods, setTrackingTempMods] = useState(() => hasTempMods);

  useEffect(() => { if (isDamaged) setTrackingHealth(true); }, [isDamaged]);
  useEffect(() => { if (isPsiSpent) setTrackingPsi(true); }, [isPsiSpent]);

  const displayName = charDisplayName(char);
  const trainedSkills = char.skills
    .filter(s => s.level > 0 || (s.level === 0 && !s.name.includes('(')))
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasPsionics = char.psionic_talents.length > 0 || (char.psi !== null && psiMax > 0);
  const hasPsiAttribute = char.psi !== null && psiMax > 0;
  const extraStats = EXTRA_STATS.filter(k => char[k] !== null);
  const allDisplayStats: CharStat[] = [...CORE_STATS, ...(hasPsiAttribute ? ['psi' as CharStat] : []), ...extraStats];
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
      if (key === 'end_stat') return endCurRaw;
      if (key === 'str') return strCurRaw;
      if (key === 'dex') return dexCurRaw;
    }
    if (trackingPsi && key === 'psi') return psiCurRaw;
    return char[key] as number | null;
  }

  function effectiveVal(key: CharStat): number | null {
    return effectiveStatValue(curVal(key), tempMod(key));
  }

  const effectiveStatValues = ALL_STATS.reduce<Partial<Record<CharStat, number | null>>>((values, key) => {
    values[key] = effectiveVal(key);
    return values;
  }, {});
  const carriedMassKg = carriedMass(char);
  const encumbranceBonus = athleticsLoadBonus(char);
  const encumbranceCapacity = Math.max(0, (effectiveVal('str') ?? 0) + (effectiveVal('end_stat') ?? 0) + encumbranceBonus);
  const encumbrance = encumbranceStatus(carriedMassKg, encumbranceCapacity);
  const initiativeDM = Math.max(statDM(effectiveVal('dex')), statDM(effectiveVal('int_stat')));
  const tacticsSkillLevel = knownSkillLevel(char, ['Tactics']);
  const tacticsDM = statDM(effectiveVal('int_stat')) + (tacticsSkillLevel ?? -3);
  const leadershipSkillLevel = knownSkillLevel(char, ['Leadership']);
  const leadershipDM = Math.max(
    statDM(effectiveVal('int_stat')),
    statDM(effectiveVal('edu')),
    statDM(effectiveVal('soc')),
  ) + (leadershipSkillLevel ?? -3);
  const dodgeAthleticsLevel = knownSkillLevel(char, ['Athletics (Dexterity)']);
  const dodgePenalty = Math.max(0, statDM(effectiveVal('dex')), dodgeAthleticsLevel ?? 0);

  function openSkillRoll(skillName: string, skillLvl: number) {
    setRollTarget({ label: skillName, skillLevel: skillLvl, charKey: skillChar(skillName), isPsionic: false });
  }
  function openPsiRoll(talentName: string, talentLevel: number) {
    setRollTarget({ label: talentName, skillLevel: talentLevel, charKey: 'psi', isPsionic: true });
  }
  function openStatRoll(stat: CharStat) {
    setRollTarget({ label: STAT_LABELS[stat], skillLevel: 0, charKey: stat, isPsionic: false });
  }
  function openWeaponRoll(weapon: Weapon, weaponIndex: number) {
    const isMelee = weapon.range === 'Melee';
    const wSkillChar = skillChar(weapon.skill);
    const defaultChar = wSkillChar ?? (isMelee ? 'str' : 'dex');
    const skillLvl = char.skills.find(s => s.name === weapon.skill)?.level ?? 0;
    setRollTarget({ label: weapon.name, skillLevel: skillLvl, charKey: defaultChar, isPsionic: false, weapon, weaponIndex });
  }
  function openInitiativeRoll() {
    const dexDM = statDM(effectiveVal('dex'));
    const intDM = statDM(effectiveVal('int_stat'));
    setRollTarget({ label: 'Initiative', skillLevel: 0, charKey: dexDM >= intDM ? 'dex' : 'int_stat', isPsionic: false, kind: 'initiative' });
  }
  function openTacticsRoll() {
    setRollTarget({ label: 'Tactics', skillLevel: tacticsSkillLevel, charKey: 'int_stat', isPsionic: false });
  }
  function openLeadershipRoll() {
    const candidates: CharStat[] = ['int_stat', 'edu', 'soc'];
    const charKey = candidates.reduce((best, key) => statDM(effectiveVal(key)) > statDM(effectiveVal(best)) ? key : best, candidates[0]);
    setRollTarget({ label: 'Leadership', skillLevel: leadershipSkillLevel, charKey, isPsionic: false });
  }
  function openDodgeRoll() {
    setRollTarget({ label: 'Dodge Reaction', skillLevel: dodgeAthleticsLevel ?? 0, charKey: 'dex', isPsionic: false });
  }
  function openCustomRoll() {
    setRollTarget({ label: 'Unknown', skillLevel: null, charKey: null, isPsionic: false, isCustom: true, applyJackOfAllTrades: true });
  }

  function handleRollSave(result: { d1: number; d2: number; charDM: number; skillLevel: number; bonusDM: number; total: number }, difficulty: number, label: string) {
    onRollSave(displayName, result, label, difficulty);
  }

  function handleDamageSave(weaponName: string, rolls: number[], constant: number, strDM: number, effect: number, total: number) {
    onRollSave(displayName, {
      d1: rolls[0] ?? 0,
      d2: rolls[1] ?? 0,
      charDM: strDM,
      skillLevel: effect,
      bonusDM: constant,
      total,
    }, `${weaponName} Damage`, 0);
  }

  function adjustTrackedStat(field: keyof Character, key: CharStat, delta: number) {
    const cur = rawCurVal(key) ?? 0;
    const next = Math.max(rawCurFloor(key), cur + delta);
    onStatAdjust(char.id, { [field]: next });
  }

  function adjustTempMod(key: CharStat, delta: number) {
    if (curVal(key) === null) return;
    const nextMods = { ...tempMods };
    const next = (nextMods[key] ?? 0) + delta;
    if (next === 0) delete nextMods[key];
    else nextMods[key] = next;
    onStatAdjust(char.id, { temp_mods: nextMods });
  }

  function resetTempMods() {
    onStatAdjust(char.id, { temp_mods: {} });
  }

  function toggleHealth() {
    if (trackingHealth) {
      onStatAdjust(char.id, { end_cur: char.end_stat ?? 0, str_cur: char.str ?? 0, dex_cur: char.dex ?? 0 });
      setPendingOverflow(null);
      setTrackingHealth(false);
    } else {
      setTrackingHealth(true);
    }
  }

  function togglePsi() {
    if (trackingPsi) {
      onStatAdjust(char.id, { psi_cur: char.psi ?? 0 });
      setTrackingPsi(false);
    } else {
      setTrackingPsi(true);
    }
  }

  function applyDamage() {
    const dmg = parseInt(damageInput);
    if (!dmg || dmg <= 0) { setDamageInput(''); return; }
    if (dmg <= endCur) {
      onStatAdjust(char.id, { end_cur: rawCurFromEffective('end_stat', endCur - dmg) });
    } else {
      const overflow = dmg - endCur;
      onStatAdjust(char.id, { end_cur: rawCurFromEffective('end_stat', 0) });
      if (overflow > 0) setPendingOverflow(overflow);
    }
    setDamageInput('');
  }

  function applyOverflow(to: 'str_cur' | 'dex_cur') {
    if (!pendingOverflow) return;
    const key = to === 'str_cur' ? 'str' : 'dex';
    const cur = key === 'str' ? strCur : dexCur;
    onStatAdjust(char.id, { [to]: rawCurFromEffective(key, Math.max(0, cur - pendingOverflow)) });
    setPendingOverflow(null);
  }

  function applyPsiCost() {
    const cost = parseInt(psiInput);
    if (!cost || cost <= 0) { setPsiInput(''); return; }
    onStatAdjust(char.id, { psi_cur: rawCurFromEffective('psi', Math.max(0, psiCur - cost)) });
    setPsiInput('');
  }

  function spendPsiCost(cost: number) {
    const normalizedCost = Math.max(0, Math.trunc(cost));
    if (normalizedCost <= 0 || psiMax <= 0) return;
    setTrackingPsi(true);
    onStatAdjust(char.id, { psi_cur: rawCurFromEffective('psi', Math.max(0, psiCur - normalizedCost)) });
  }

  function spendCharacterWeaponAmmo(weaponIndex: number | undefined, amount: number): WeaponAmmoSpendResult | null {
    if (weaponIndex === undefined) return null;
    const weapon = char.weapons?.[weaponIndex];
    if (!weapon) return null;
    const result = spendWeaponAmmo(weapon, amount);
    if (!result) return null;
    const weapons = (char.weapons ?? []).map((item, i) => i === weaponIndex ? result.weapon : item);
    onStatAdjust(char.id, { weapons });
    return result;
  }

  const profileSection = profileRows.length > 0 ? (
    <DetailSection title="PROFILE" className="order-1">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs font-mono">
        {profileRows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <span className="text-body/60">{label}</span>
            <span className="text-body/70 ml-2 break-words">{String(value)}</span>
          </div>
        ))}
      </div>
    </DetailSection>
  ) : null;

  const characteristicsSection = (
    <div className="order-2">
      <div className="flex items-center justify-between mb-2">
        <div className="label">CHARACTERISTICS</div>
        <div className="flex gap-1.5">
          <button onClick={() => setTrackingTempMods(v => !v)}
            className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
              trackingTempMods
                ? 'border-safe/60 text-safe hover:border-steel hover:text-body/60'
                : 'border-steel/40 text-body/65 hover:border-safe/50 hover:text-safe/70'
            }`}>
            {trackingTempMods ? 'HIDE MODS' : 'TEMP MODS'}
          </button>
          {hasPsionics && psiMax > 0 && (
            <button onClick={togglePsi}
              className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
                trackingPsi
                  ? 'border-cyan-dim text-cyan-trav hover:border-steel hover:text-body/60'
                  : 'border-steel/40 text-body/65 hover:border-cyan-dim hover:text-cyan-trav'
              }`}>
              {trackingPsi ? 'RESET PSI' : 'TRACK PSI'}
            </button>
          )}
          <button onClick={toggleHealth}
            className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
              trackingHealth
                ? 'border-alert/60 text-alert hover:border-steel hover:text-body/60'
                : 'border-steel/40 text-body/65 hover:border-amber/50 hover:text-amber/70'
            }`}>
            {trackingHealth ? 'RESET HEALTH' : 'TRACK HEALTH'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {allDisplayStats.map(key => {
          const ev = effectiveVal(key);
          const mv = maxVal(key);
          const mod = tempMod(key);
          const isPhys = key === 'str' || key === 'dex' || key === 'end_stat';
          const isPsiStat = key === 'psi';
          const isExtra = EXTRA_STATS.includes(key);
          const isTracked = (isPhys && trackingHealth) || (isPsiStat && trackingPsi);
          const isReduced = (isTracked && ev !== null && mv !== null && ev < mv) || mod < 0;
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
            isPsiStat ? 'text-cyan-trav/70' : isExtra ? 'text-body/70' : 'text-body';

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
                <div className="text-[10px] text-body/60 font-mono leading-tight">
                  {toHex(ev)}/{toHex(mv)}
                </div>
              )}
              <div className="text-xs text-body/65">{fmtDM(dm)}</div>
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
                className="text-[10px] font-mono px-2 py-0.5 border border-steel/40 text-body/65 hover:border-amber/60 hover:text-amber transition-colors">
                RESET
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 select-none">
            {allDisplayStats.map(key => {
              const mod = tempMod(key);
              return (
                <div key={key} className="flex items-center border border-steel/40 font-mono text-[10px]">
                  <span className="w-9 px-1.5 py-1 text-body/70 text-center">{STAT_LABELS[key]}</span>
                  <button
                    type="button"
                    aria-label={`Decrease ${STAT_LABELS[key]} temporary modifier`}
                    disabled={curVal(key) === null}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => adjustTempMod(key, -1)}
                    className="w-6 h-6 select-none border-l border-steel/30 flex items-center justify-center text-body/65 hover:text-amber hover:bg-steel/20 disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <Minus size={8} />
                  </button>
                  <span className={`w-8 text-center ${mod > 0 ? 'text-safe' : mod < 0 ? 'text-amber' : 'text-body/55'}`}>
                    {fmtDM(mod)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${STAT_LABELS[key]} temporary modifier`}
                    disabled={curVal(key) === null}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => adjustTempMod(key, 1)}
                    className="w-6 h-6 select-none border-l border-steel/30 flex items-center justify-center text-body/65 hover:text-safe hover:bg-steel/20 disabled:opacity-20 disabled:cursor-not-allowed"
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
              <NumberStepper
                ariaLabel="Damage"
                min={1}
                placeholder="Damage..."
                value={damageInput}
                onChange={setDamageInput}
                onKeyDown={e => { if (e.key === 'Enter') applyDamage(); }}
                className="w-32"
                inputClassName="input text-xs py-1"
              />
              <button onClick={applyDamage} className="btn-danger text-xs py-1">APPLY</button>
              <span className="text-body/55 text-[10px] font-mono ml-1">END first, then STR or DEX</span>
            </div>
          )}
          <div className="flex items-center gap-4 select-none">
            {PHYS_FIELDS.map(({ key: fk, cur: ck, label: fl }) => {
              const max = maxVal(fk) ?? 0;
              const cv2 = effectiveStatValue(rawCurVal(fk), tempMod(fk)) ?? 0;
              return (
                <div key={fl} className="flex items-center gap-1 text-xs font-mono">
                  <span className="text-body/70 w-6">{fl}</span>
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => adjustTrackedStat(ck, fk, -1)} disabled={cv2 <= 0}
                    className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-alert hover:text-alert disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center">
                    <Minus size={8} />
                  </button>
                  <span className="text-amber w-8 text-center">{cv2}/{max}</span>
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => adjustTrackedStat(ck, fk, 1)}
                    className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-safe hover:text-safe disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center">
                    <Plus size={8} />
                  </button>
                </div>
              );
            })}
            <span className={`text-xs font-mono ml-auto ${status.color}`}>{status.label}</span>
          </div>
          <div className="text-[10px] text-body/55 font-mono">
            Natural healing: 1D+END DM hp/day (rest) · Unconscious when 2 stats at 0 · Dead when all 3 at 0
          </div>
        </div>
      )}

      {/* PSI tracking controls */}
      {trackingPsi && hasPsionics && psiMax > 0 && (
        <div className="mt-3 space-y-2 border-t border-steel/40 pt-3">
          <div className="flex items-center gap-2">
            <NumberStepper
              ariaLabel="PSI cost"
              min={1}
              placeholder="PSI cost..."
              value={psiInput}
              onChange={setPsiInput}
              onKeyDown={e => { if (e.key === 'Enter') applyPsiCost(); }}
              className="w-32"
              inputClassName="input text-xs py-1"
            />
            <button onClick={applyPsiCost} className="btn-steel text-xs py-1">SPEND</button>
          </div>
          <div className="flex items-center gap-4 select-none">
            <div className="flex items-center gap-1 text-xs font-mono">
              <span className="text-cyan-trav/70 w-6">PSI</span>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => adjustTrackedStat('psi_cur', 'psi', -1)} disabled={psiCur <= 0}
                className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-alert hover:text-alert disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center">
                <Minus size={8} />
              </button>
              <span className="text-cyan-trav w-8 text-center">{psiCur}/{psiMax}</span>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => adjustTrackedStat('psi_cur', 'psi', 1)}
                className="w-5 h-5 select-none border border-steel/60 text-body/70 hover:border-safe hover:text-safe disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center">
                <Plus size={8} />
              </button>
            </div>
            {psiCur === 0 && <span className="text-alert text-xs font-mono">EXHAUSTED</span>}
          </div>
          <div className="text-[10px] text-body/55 font-mono">Spend listed PSI cost · adjust recovery manually</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {rollTarget && (
        <RollModal
          char={char}
          target={rollTarget}
          statValues={effectiveStatValues}
          psiCurrent={psiCur}
          psiMax={psiMax}
          onClose={() => setRollTarget(null)}
          onSave={handleRollSave}
          onSaveDamage={handleDamageSave}
          onSpendPsi={spendPsiCost}
          onSpendAmmo={amount => spendCharacterWeaponAmmo(rollTarget.weaponIndex, amount)}
        />
      )}

      <div className="flex flex-col gap-4">
        {indentTopRows ? (
          <div className="order-1">
            <div className="flex flex-col gap-4 lg:pr-56">
              {profileSection}
              {characteristicsSection}
            </div>
          </div>
        ) : (
          <>
            {profileSection}
            {characteristicsSection}
          </>
        )}

        {homeworldRows.length > 0 && (
          <DetailSection title="HOMEWORLD" className="order-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs font-mono">
              {homeworldRows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <span className="text-body/60">{label}</span>
                  <span className="text-cyan-trav/80 ml-2 break-words">{String(value)}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {lifepath.length > 0 && (
          <DetailSection title="LIFEPATH" className="order-9">
            <div className="space-y-1.5">
              {lifepath.map((term, i) => (
                <div key={`${term.term ?? i}-${term.career ?? i}`} className="text-xs font-mono border border-steel/35 px-2 py-1.5">
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    <span className="text-amber">TERM {term.term ?? i + 1}</span>
                    {term.career && <span className="text-bright">{term.career}</span>}
                    {term.assignment && <span className="text-body/55">{term.assignment}</span>}
                    {term.rank && <span className="text-cyan-trav/80">RANK {term.rank}</span>}
                    <span className="text-body/60">
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
          <DetailSection title="ARMOR" className="order-5">
            <div className="space-y-1">
              {armour.map((item, i) => {
                const armourMass = massFor(item, ['Armour']);
                return (
                  <div key={`${item.name}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono border border-steel/35 px-2 py-1">
                    <span className={item.worn ? 'text-safe' : 'text-body/60'}>{item.worn ? 'WORN' : 'STOWED'}</span>
                    <span className="text-bright">{item.name}</span>
                    {quantityFor(item) !== 1 && <span className="text-body/70">x{quantityFor(item)}</span>}
                    {item.protection !== null && <span className="text-amber">PROT {item.protection}</span>}
                    {item.radiation !== null && <span className="text-cyan-trav/70">RAD {item.radiation}</span>}
                    {armourMass !== null && <span className="text-cyan-trav/60">{kg(armourMass * quantityFor(item) * (item.worn ? 0.25 : 1))}</span>}
                    {item.required_skill && <span className="text-body/70">REQ {item.required_skill}</span>}
                  </div>
                );
              })}
            </div>
          </DetailSection>
        )}

        {augments.length > 0 && (
          <DetailSection title="AUGMENTS" className="order-10">
            <div className="space-y-1">
              {augments.map((augment, i) => (
                <div key={`${augment.name}-${i}`} className="text-xs font-mono border border-steel/35 px-2 py-1">
                  <span className="text-bright">{augment.name}</span>
                  {augment.tech_level !== null && <span className="text-body/70 ml-2">TL {augment.tech_level}</span>}
                  {augment.cost !== null && <span className="text-amber/80 ml-2">{fmtCr(augment.cost)}</span>}
                  {augment.notes && <div className="text-body/60 mt-0.5">{augment.notes}</div>}
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {(personalEquipment.length > 0 || carriedMassKg > 0) && (
          <DetailSection title="EQUIPMENT" className="order-11">
            <div className="mb-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="border border-steel/35 px-2 py-1">
                <div className="text-body/60">CARRIED MASS</div>
                <div className="text-cyan-trav">{kg(carriedMassKg)}</div>
              </div>
              <div className="border border-steel/35 px-2 py-1">
                <div className="text-body/60">NO PENALTY</div>
                <div className="text-body/80">{kg(encumbranceCapacity)}</div>
              </div>
              <div className="border border-steel/35 px-2 py-1">
                <div className="text-body/60">MAX LOAD</div>
                <div className="text-body/80">{kg(encumbranceCapacity * 2)}</div>
              </div>
              <div className="border border-steel/35 px-2 py-1">
                <div className="text-body/60">ENCUMBRANCE</div>
                <div className={encumbrance.color}>
                  {encumbrance.label}
                  {encumbrance.physicalMod !== null && encumbrance.physicalMod !== 0 && (
                    <span className="text-body/70 ml-1">{fmtDM(encumbrance.physicalMod)} physical</span>
                  )}
                </div>
              </div>
              {encumbranceBonus > 0 && (
                <div className="col-span-2 sm:col-span-4 text-[10px] text-body/60">
                  Includes Athletics load bonus +{encumbranceBonus}. Worn armour counts as 25% mass.
                </div>
              )}
            </div>
            <div className="space-y-1">
              {personalEquipment.map((item, i) => (
                <div key={`${item.name}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono border border-steel/35 px-2 py-1">
                  <span className="text-bright">{item.name}</span>
                  {item.quantity !== null && <span className="text-body/70">x{item.quantity}</span>}
                  {item.tech_level !== null && <span className="text-body/70">TL {item.tech_level}</span>}
                  {item.mass !== null && <span className="text-cyan-trav/70">{item.mass} kg</span>}
                  {item.cost !== null && <span className="text-amber/80">{fmtCr(item.cost)}</span>}
                  {item.notes && <span className="text-body/55">{item.notes}</span>}
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {financeRows.length > 0 && (
          <DetailSection title="FINANCES" className="order-7">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs font-mono">
              {financeRows.map(([label, value]) => (
                <div key={label}>
                  <span className="text-body/60">{label}</span>
                  <span className="text-amber/80 ml-2">{fmtCr(value as number)}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {contacts.some(c => hasValue(c.name) || hasValue(c.type) || hasValue(c.description) || hasValue(c.link)) && (
          <DetailSection title="CONTACTS" className="order-8">
            <div className="space-y-1">
              {contacts
                .filter(c => hasValue(c.name) || hasValue(c.type) || hasValue(c.description) || hasValue(c.link))
                .map((contact, i) => (
                  <div key={`${contact.name ?? contact.type ?? i}-${i}`} className="text-xs font-mono border border-steel/35 px-2 py-1">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {contact.name && <span className="text-bright">{contact.name}</span>}
                      {contact.type && <span className="text-amber">{contact.type}</span>}
                      {contact.gender_species && <span className="text-body/70">{contact.gender_species}</span>}
                      {contact.alive !== null && <span className={contact.alive ? 'text-safe' : 'text-alert'}>{contact.alive ? 'ALIVE' : 'DEAD'}</span>}
                    </div>
                    {contact.description && <div className="text-body/60 mt-0.5">{contact.description}</div>}
                  </div>
                ))}
            </div>
          </DetailSection>
        )}

        {backgroundRows.length > 0 && (
          <DetailSection title="BACKGROUND" className="order-12">
            <div className="space-y-1.5 text-xs font-mono">
              {backgroundRows.map(([label, value]) => (
                <div key={label} className="border border-steel/35 px-2 py-1">
                  <div className="text-body/60">{label}</div>
                  <div className="text-body/70 whitespace-pre-wrap">{String(value)}</div>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {/* Skills */}
        <div className="order-3">
          <div className="label mb-2">
            SKILLS
            <span className="text-body/55 font-normal ml-2 text-[10px]">click to roll</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trainedSkills.map((sk, i) => (
              <button key={i} onClick={() => openSkillRoll(sk.name, sk.level)}
                title={sk.level === 0 ? 'Skill 0: competent, no Mod bonus, avoids DM-3 unskilled penalty' : `Skill ${sk.level}: trained, Mod +${sk.level}`}
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
              title="Roll any skill check. Skill 0 = no Mod bonus. Unskilled = DM-3."
              className="flex items-center gap-1 border border-dashed border-steel/50 text-body/65 hover:border-amber/50 hover:text-amber/50 px-2 py-0.5 text-xs font-mono transition-colors">
              UNKNOWN
            </button>
          </div>
        </div>

        {/* Psionics */}
        {hasPsionics && char.psionic_talents.length > 0 && (
          <div className="order-3">
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

        {/* Combat */}
        <div className="order-4">
          <div className="label mb-2">COMBAT</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 text-xs font-mono">
            <button type="button" onClick={openInitiativeRoll}
              className="border border-steel/35 hover:border-amber/60 px-2 py-1 text-left transition-colors">
              <div className="text-body/60">INITIATIVE DM</div>
              <div className="text-amber">{fmtDM(initiativeDM)}</div>
            </button>
            <button type="button" onClick={openTacticsRoll}
              className="border border-steel/35 hover:border-amber/60 px-2 py-1 text-left transition-colors">
              <div className="text-body/60">TACTICS DM</div>
              <div className="text-amber">{fmtDM(tacticsDM)}</div>
            </button>
            <button type="button" onClick={openLeadershipRoll}
              className="border border-steel/35 hover:border-amber/60 px-2 py-1 text-left transition-colors">
              <div className="text-body/60">LEADERSHIP DM</div>
              <div className="text-amber">{fmtDM(leadershipDM)}</div>
            </button>
            <button type="button" onClick={openDodgeRoll}
              className="border border-steel/35 hover:border-amber/60 px-2 py-1 text-left transition-colors">
              <div className="text-body/60">OPP. DODGE PENALTY</div>
              <div className="text-alert">{dodgePenalty > 0 ? `-${dodgePenalty}` : '0'}</div>
            </button>
          </div>
          <div className="space-y-1">
            <div className={`hidden md:grid ${WEAPON_ROSTER_GRID} gap-2 px-3 text-[10px] font-mono text-body/60`}>
              <span>WEAPON</span>
              <span>QTY</span>
              <span>RANGE</span>
              <span>DAMAGE</span>
              <span>MASS</span>
              <span>SKILL / TRAITS</span>
            </div>
            {(char.weapons ?? []).map((w, i) => {
              const weaponMass = massFor(w, ['Weapon']);
              const ammoState = weaponAmmoState(w);
              const showAmmo = w.range !== 'Melee' && ammoState.tracked;
              const roundsLabel = ammoState.clipSize === null
                ? `${ammoState.rounds} rounds`
                : `${ammoState.rounds}/${ammoState.clipSize} rounds`;
              const canReload = ammoState.clipSize !== null && ammoState.clips > 0 && ammoState.rounds < ammoState.clipSize;
              return (
                <div key={i} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => openWeaponRoll(w, i)}
                    className={`w-full grid grid-cols-[minmax(6rem,1fr)_4rem_5rem] ${WEAPON_ROSTER_GRID} gap-2 border border-steel/40 hover:border-amber/60 px-3 py-2 text-xs font-mono text-left transition-colors group items-center`}
                    aria-label={`Roll ${w.name} attack`}
                    title={`Roll ${w.name} attack`}
                  >
                    <span className="min-w-0 text-bright group-hover:text-amber transition-colors truncate">
                      {w.name}
                    </span>
                    <span className="text-body/65 hidden md:block">{quantityFor(w) !== 1 ? `x${quantityFor(w)}` : ''}</span>
                    <span className="text-body/65 truncate">{w.range}</span>
                    <span className="text-amber/80 font-bold">{w.damage}</span>
                    <span className="text-cyan-trav/60 text-[10px] hidden md:block">{weaponMass !== null ? kg(weaponMass * quantityFor(w)) : ''}</span>
                    <span className="text-body/55 text-[10px] hidden md:block truncate">
                      {w.skill}
                      {w.traits ? ` · ${w.traits}` : ''}
                    </span>
                  </button>
                  {showAmmo && (
                    <div className="flex items-center gap-x-3 gap-y-0.5 border-x border-b border-steel/30 px-3 py-0.5 text-[9px] leading-none font-mono text-body/55">
                      <div className="flex items-center gap-1">
                        <span>Clips:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const weapons = (char.weapons ?? []).map((item, index) =>
                              index === i ? { ...item, ammo_clips: ammoState.clips + 1 } : item
                            );
                            onStatAdjust(char.id, { weapons });
                          }}
                          className="h-4 w-4 border border-steel/40 text-cyan-trav hover:border-cyan-dim hover:text-cyan-bright leading-none"
                          aria-label={`Increase ${w.name} clips`}
                          title={`Increase ${w.name} clips`}
                        >
                          +
                        </button>
                        <span className="min-w-4 text-center text-amber">{ammoState.clips}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const weapons = (char.weapons ?? []).map((item, index) =>
                              index === i ? { ...item, ammo_clips: Math.max(0, ammoState.clips - 1) } : item
                            );
                            onStatAdjust(char.id, { weapons });
                          }}
                          disabled={ammoState.clips <= 0}
                          className="h-4 w-4 border border-steel/40 text-cyan-trav hover:border-cyan-dim hover:text-cyan-bright disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                          aria-label={`Decrease ${w.name} clips`}
                          title={`Decrease ${w.name} clips`}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canReload || ammoState.clipSize === null) return;
                            const weapons = (char.weapons ?? []).map((item, index) =>
                              index === i
                                ? { ...item, ammo_rounds: ammoState.clipSize, ammo_clips: Math.max(0, ammoState.clips - 1) }
                                : item
                            );
                            onStatAdjust(char.id, { weapons });
                          }}
                          disabled={!canReload}
                          className="h-4 border border-steel/40 px-1 text-[8px] text-amber hover:border-amber hover:bg-steel/20 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                          aria-label={`Reload ${w.name}`}
                          title={`Reload ${w.name}`}
                        >
                          RLD
                        </button>
                      </div>
                      <div className="min-w-0 flex flex-1 items-center gap-1">
                        <span className="shrink-0">Rounds:</span>
                        <span className="min-w-0 truncate text-amber" title={roundsLabel}>
                          {ammoRoundBars(ammoState.rounds)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        {char.notes && (
          <div className="order-last text-xs text-body/70 border-t border-steel/50 pt-2">{char.notes}</div>
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
            <div className="text-xs text-body/70 mt-0.5 space-x-2">
              {char.rank && <span className="text-amber">{char.rank}</span>}
              {char.career && <span className="text-body/70">· {char.career}</span>}
              {char.homeworld && <span className="text-body/65">· {char.homeworld}</span>}
              {char.player && <span className="text-steel ml-2">[{char.player}]</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-lg text-amber tracking-widest glow-amber">{upp(char)}</div>
            <div className={`text-xs font-mono ${status.color}`}>{status.label}</div>
            <div className="text-[10px] font-mono text-body/65">
              {char.skills.filter(s => s.level >= 0).length} SKILLS
            </div>
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
        <div className="text-[10px] text-body/65 mt-0.5 truncate">{char.rank}</div>
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
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem('travtools-roster-selected-id'); } catch { return null; }
  });
  function selectChar(id: string | null) {
    setSelectedId(id);
    try {
      if (id) localStorage.setItem('travtools-roster-selected-id', id);
      else localStorage.removeItem('travtools-roster-selected-id');
    } catch { /* ignore */ }
  }

  const [uploadingPortraitId, setUploadingPortraitId] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
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

  // Clear stale selectedId after first successful char load
  useEffect(() => {
    if (chars.length > 0 && selectedId && !chars.find(c => c.id === selectedId)) {
      selectChar(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chars]);

  async function saveChar(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    const payload: CharForm = {
      ...form,
      status: form.status ?? 'active',
      rank: form.rank || DEFAULT_CHARACTER_TITLE,
      skills: parseSkillsCSV(skillsRaw),
      psionic_talents: parseTalentsCSV(talentsRaw),
      weapons: form.weapons.filter(item => hasValue(item.name) || hasValue(item.damage) || hasValue(item.traits)),
      armour: form.armour.filter(item => hasValue(item.name) || hasValue(item.protection) || hasValue(item.radiation)),
      personal_equipment: form.personal_equipment.filter(item => hasValue(item.name) || hasValue(item.notes)),
      augments: form.augments.filter(item => hasValue(item.name) || hasValue(item.notes)),
      contacts: form.contacts.filter(item => hasValue(item.name) || hasValue(item.type) || hasValue(item.description) || hasValue(item.link)),
      lifepath: form.lifepath.filter(item => hasValue(item.term) || hasValue(item.career) || hasValue(item.assignment) || hasValue(item.notes)),
    };
    if (editing) {
      const editingId = editing;
      const previous = chars.find(c => c.id === editingId);
      const optimistic = {
        ...(previous ?? { id: editingId, created_at: new Date().toISOString() }),
        ...payload,
      } as Character;

      setChars(prev => sortCharacters(prev.map(c => c.id === editingId ? optimistic : c)));
      selectChar(editingId);
      setEditing(null);
      setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setShowForm(false);

      const { data, error } = await client.from('characters').update(payload).eq('id', editingId).select().single();
      if (error) {
        setRosterError(`Character update failed: ${error.message}`);
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
        setRosterError(`Character could not be saved: ${error.message}`);
        return;
      }
      if (data) {
        const inserted = data as Character;
        setChars(prev => sortCharacters([...prev, inserted]));
        selectChar(inserted.id);
      }
    }
    setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setShowForm(false);
  }

  async function deleteChar(id: string) {
    if (!client || !confirm('Remove this character?')) return;
    const previous = chars.find(c => c.id === id);
    setChars(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) selectChar(null);
    const { error } = await client.from('characters').delete().eq('id', id);
    if (error) {
      setRosterError(`Character could not be deleted: ${error.message}`);
      if (previous) setChars(prev => sortCharacters([...prev, previous]));
      loadChars();
    }
  }

  function startEdit(char: Character) {
    setForm({
      status: char.status ?? 'active',
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
      setRosterError(`Stat update failed: ${error.message}`);
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
        setRosterError(`Portrait could not be saved: ${updateError.message}`);
        loadChars();
      }
    } catch (error) {
      setRosterError(error instanceof Error ? error.message : 'Portrait upload failed.');
    } finally {
      setUploadingPortraitId(null);
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    e.target.value = '';
    setRosterError(null);
    let imported: RosterCsvCharacter[];
    try {
      imported = rosterFromCsv(await file.text());
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Could not parse roster CSV.');
      return;
    }
    if (imported.length === 0) {
      setRosterError('Roster CSV did not contain any character rows.');
      return;
    }

    const withIds = imported.filter(character => character.id);
    const withoutIds = imported.filter(character => !character.id).map(character => {
      const copy = { ...character };
      delete copy.id;
      delete copy.created_at;
      return copy;
    });
    const saved: Character[] = [];

    if (withIds.length > 0) {
      const { data, error } = await client.from('characters').upsert(withIds, { onConflict: 'id' }).select();
      if (error) {
        setRosterError(`Roster CSV import failed: ${error.message}`);
        return;
      }
      if (data) saved.push(...data as Character[]);
    }
    if (withoutIds.length > 0) {
      const { data, error } = await client.from('characters').insert(withoutIds).select();
      if (error) {
        setRosterError(`Roster CSV import failed: ${error.message}`);
        return;
      }
      if (data) saved.push(...data as Character[]);
    }

    if (saved.length > 0) {
      setChars(prev => {
        const byId = new Map(prev.map(character => [character.id, character]));
        for (const character of saved) byId.set(character.id, character);
        return sortCharacters([...byId.values()]);
      });
      selectChar(saved[0].id);
    }
    loadChars();
  }

  function exportCsv() {
    downloadCsv('travtools-roster.csv', rosterToCsv(chars));
  }

  const selectedChar = chars.find(c => c.id === selectedId) ?? null;
  const activeChars = chars.filter(char => !isCharacterDeceased(char));
  const deceasedChars = chars.filter(isCharacterDeceased);

  const numInput = (key: keyof CharForm, label: string) => {
    const val = (form[key] as number | null) ?? null;
    const inputId = `character-${String(key)}`;
    return (
      <div key={key} className="space-y-1">
        <label htmlFor={inputId} className="label flex items-center justify-between">
          <span>{label}</span>
          {val !== null && <span className="text-amber font-mono">{toHex(val)}</span>}
        </label>
        <NumberStepper
          id={inputId}
          ariaLabel={label}
          min={0}
          value={val ?? ''}
          onChange={value => setForm({ ...form, [key]: value ? parseInt(value, 10) : null })}
        />
      </div>
    );
  };

  function boolSelectValue(value: boolean | null | undefined): string {
    if (value === true) return 'true';
    if (value === false) return 'false';
    return '';
  }

  function boolFromSelect(value: string): boolean | null {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  }

  function updateWeapon(index: number, patch: Partial<Weapon>) {
    setForm(prev => ({
      ...prev,
      weapons: prev.weapons.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  }

  function addWeapon() {
    setForm(prev => ({
      ...prev,
      weapons: [...prev.weapons, {
        name: '',
        skill: '',
        range: '',
        damage: '',
        traits: '',
        quantity: 1,
        mass: null,
        cost: null,
        ammo_clips: null,
        ammo_rounds: null,
        ammo_clip_size: null,
      }],
    }));
  }

  function removeWeapon(index: number) {
    setForm(prev => ({ ...prev, weapons: prev.weapons.filter((_, i) => i !== index) }));
  }

  function updateArmour(index: number, patch: Partial<ArmourItem>) {
    setForm(prev => ({
      ...prev,
      armour: prev.armour.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  }

  function addArmour() {
    setForm(prev => ({
      ...prev,
      armour: [...prev.armour, { worn: false, name: '', protection: null, radiation: null, required_skill: null, quantity: 1, mass: null, cost: null }],
    }));
  }

  function removeArmour(index: number) {
    setForm(prev => ({ ...prev, armour: prev.armour.filter((_, i) => i !== index) }));
  }

  function updateEquipment(index: number, patch: Partial<PersonalEquipmentItem>) {
    setForm(prev => ({
      ...prev,
      personal_equipment: prev.personal_equipment.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  }

  function addEquipment() {
    setForm(prev => ({
      ...prev,
      personal_equipment: [...prev.personal_equipment, { quantity: 1, name: '', notes: null, tech_level: null, mass: null, cost: null }],
    }));
  }

  function removeEquipment(index: number) {
    setForm(prev => ({ ...prev, personal_equipment: prev.personal_equipment.filter((_, i) => i !== index) }));
  }

  function updateAugment(index: number, patch: Partial<CharacterAugment>) {
    setForm(prev => ({
      ...prev,
      augments: prev.augments.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  }

  function addAugment() {
    setForm(prev => ({
      ...prev,
      augments: [...prev.augments, { name: '', notes: null, tech_level: null, cost: null }],
    }));
  }

  function removeAugment(index: number) {
    setForm(prev => ({ ...prev, augments: prev.augments.filter((_, i) => i !== index) }));
  }

  function updateContact(index: number, patch: Partial<CharacterContact>) {
    setForm(prev => ({
      ...prev,
      contacts: prev.contacts.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  }

  function addContact() {
    setForm(prev => ({
      ...prev,
      contacts: [...prev.contacts, { name: null, gender_species: null, type: null, description: null, link: null, alive: null }],
    }));
  }

  function removeContact(index: number) {
    setForm(prev => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== index) }));
  }

  function updateLifepath(index: number, patch: Partial<LifepathTerm>) {
    setForm(prev => ({
      ...prev,
      lifepath: prev.lifepath.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  }

  function addLifepathTerm() {
    setForm(prev => ({
      ...prev,
      lifepath: [...prev.lifepath, { term: prev.lifepath.length + 1, career: null, assignment: null, survived: null, commissioned: null, advanced: null, rank: null, notes: null }],
    }));
  }

  function removeLifepathTerm(index: number) {
    setForm(prev => ({ ...prev, lifepath: prev.lifepath.filter((_, i) => i !== index) }));
  }

  function updateTempMod(key: CharStat, value: number | null) {
    setForm(prev => {
      const next = normalizeTempMods(prev.temp_mods);
      if (value === null || value === 0) delete next[key];
      else next[key] = Math.trunc(value);
      return { ...prev, temp_mods: next };
    });
  }

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
        <Field name="Traveller Status">
          <select
            className="select"
            value={form.status ?? 'active'}
            onChange={e => setForm({ ...form, status: e.target.value as Character['status'] })}
          >
            <option value="active">Active</option>
            <option value="deceased">Deceased</option>
          </select>
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
      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>TRACKING / MODIFIERS</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 space-y-3">
          <div>
            <div className="label mb-2 text-body/70">CURRENT VALUES</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'str_cur', label: 'STR Cur' },
                { key: 'dex_cur', label: 'DEX Cur' },
                { key: 'end_cur', label: 'END Cur' },
                { key: 'psi_cur', label: 'PSI Cur' },
              ].map(({ key, label }) => (
                <Field key={key} name={label}>
                  <NumberStepper
                    ariaLabel={label}
                    min={0}
                    value={(form[key as keyof CharForm] as number | null) ?? ''}
                    onChange={value => setForm({ ...form, [key]: parseNullableNumber(value) })}
                  />
                </Field>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2 text-body/70">TEMP MODS</div>
            <div className="grid grid-cols-5 gap-2">
              {ALL_STATS.map(key => (
                <Field key={key} name={STAT_LABELS[key]}>
                  <NumberStepper
                    ariaLabel={`${STAT_LABELS[key]} temporary modifier`}
                    value={normalizeTempMods(form.temp_mods)[key] ?? ''}
                    onChange={value => updateTempMod(key, parseNullableNumber(value))}
                  />
                </Field>
              ))}
            </div>
          </div>
        </div>
      </details>
      <Field name="Notes">
        <textarea className="input resize-none h-16" value={form.notes ?? ''}
          onChange={e => setForm({ ...form, notes: e.target.value || null })} />
      </Field>

      {/* ── Profile Details ──────────────────────────────────────────────── */}
      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>PROFILE DETAILS</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Field name="Species">
            <input className="input" value={form.profile_details?.species ?? ''}
              onChange={e => setForm({ ...form, profile_details: { ...form.profile_details, species: e.target.value || null } })} />
          </Field>
          <Field name="Age">
            <input className="input" value={form.profile_details?.age ?? ''}
              onChange={e => setForm({ ...form, profile_details: { ...form.profile_details, age: e.target.value || null } })} />
          </Field>
          <Field name="Gender">
            <input className="input" value={form.profile_details?.gender ?? ''}
              onChange={e => setForm({ ...form, profile_details: { ...form.profile_details, gender: e.target.value || null } })} />
          </Field>
          <Field name="Height">
            <input className="input" value={form.profile_details?.height ?? ''}
              onChange={e => setForm({ ...form, profile_details: { ...form.profile_details, height: e.target.value || null } })} />
          </Field>
          <Field name="Weight">
            <input className="input" value={form.profile_details?.weight ?? ''}
              onChange={e => setForm({ ...form, profile_details: { ...form.profile_details, weight: e.target.value || null } })} />
          </Field>
          <div className="col-span-2">
            <Field name="Appearance">
              <textarea className="input resize-none h-16" value={form.profile_details?.appearance ?? ''}
                onChange={e => setForm({ ...form, profile_details: { ...form.profile_details, appearance: e.target.value || null } })} />
            </Field>
          </div>
        </div>
      </details>

      {/* ── Homeworld Details ─────────────────────────────────────────────── */}
      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>HOMEWORLD DETAILS</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Field name="World">
            <input className="input" value={form.homeworld_details?.name ?? form.homeworld ?? ''}
              onChange={e => setForm({
                ...form,
                homeworld: e.target.value || null,
                homeworld_details: { ...form.homeworld_details, name: e.target.value || null },
              })} />
          </Field>
          <Field name="Sector">
            <input className="input" value={form.homeworld_details?.sector ?? ''}
              onChange={e => setForm({ ...form, homeworld_details: { ...form.homeworld_details, sector: e.target.value || null } })} />
          </Field>
          <Field name="Subsector">
            <input className="input" value={form.homeworld_details?.subsector ?? ''}
              onChange={e => setForm({ ...form, homeworld_details: { ...form.homeworld_details, subsector: e.target.value || null } })} />
          </Field>
          <Field name="UWP">
            <input className="input font-mono" value={form.homeworld_details?.uwp ?? ''}
              onChange={e => setForm({ ...form, homeworld_details: { ...form.homeworld_details, uwp: e.target.value || null } })} />
          </Field>
          <Field name="Hex">
            <input className="input font-mono" value={form.homeworld_details?.location ?? ''}
              onChange={e => setForm({ ...form, homeworld_details: { ...form.homeworld_details, location: e.target.value || null } })} />
          </Field>
          <Field name="Trade Codes">
            <input className="input" value={form.homeworld_details?.trade_codes ?? ''}
              onChange={e => setForm({ ...form, homeworld_details: { ...form.homeworld_details, trade_codes: e.target.value || null } })} />
          </Field>
          <Field name="Bases">
            <input className="input" value={form.homeworld_details?.bases ?? ''}
              onChange={e => setForm({ ...form, homeworld_details: { ...form.homeworld_details, bases: e.target.value || null } })} />
          </Field>
          <Field name="Travel Zone">
            <input className="input" value={form.homeworld_details?.travel_zone ?? ''}
              onChange={e => setForm({ ...form, homeworld_details: { ...form.homeworld_details, travel_zone: e.target.value || null } })} />
          </Field>
          <Field name="Gas Giant">
            <input className="input" value={form.homeworld_details?.gas_giant ?? ''}
              onChange={e => setForm({ ...form, homeworld_details: { ...form.homeworld_details, gas_giant: e.target.value || null } })} />
          </Field>
        </div>
      </details>

      {/* ── Finances ─────────────────────────────────────────────────────── */}
      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>FINANCES</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {[
            { key: 'cash_on_hand', label: 'Cash on Hand (Cr)' },
            { key: 'yearly_pension', label: 'Yearly Pension (Cr)' },
            { key: 'monthly_salary', label: 'Monthly Salary (Cr)' },
            { key: 'ship_operating_costs', label: 'Ship Operating Costs (Cr/mo)' },
            { key: 'monthly_debt_payments', label: 'Debt Payments (Cr/mo)' },
            { key: 'monthly_living_cost', label: 'Living Cost (Cr/mo)' },
            { key: 'total_debts', label: 'Total Debts (Cr)' },
          ].map(({ key, label }) => (
            <Field key={key} name={label}>
              <NumberStepper
                ariaLabel={label}
                step={1}
                value={(form.finances as Record<string, number | null | undefined>)?.[key] ?? ''}
                onChange={value => setForm({ ...form, finances: { ...form.finances, [key]: value ? parseFloat(value) : null } })}
              />
            </Field>
          ))}
        </div>
      </details>

      {/* ── Weapons / Armour / Items ───────────────────────────────────────── */}
      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>WEAPONS</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 space-y-2">
          {form.weapons.map((weapon, i) => (
            <div key={i} className="border border-steel/35 p-2 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <Field name="Name">
                  <input className="input" value={weapon.name}
                    onChange={e => updateWeapon(i, { name: e.target.value })} />
                </Field>
                <Field name="Skill">
                  <input className="input" value={weapon.skill}
                    onChange={e => updateWeapon(i, { skill: e.target.value })} />
                </Field>
                <Field name="Range">
                  <input className="input" value={weapon.range}
                    onChange={e => updateWeapon(i, { range: e.target.value })} />
                </Field>
                <Field name="Damage">
                  <input className="input" value={weapon.damage}
                    onChange={e => updateWeapon(i, { damage: e.target.value })} />
                </Field>
                <Field name="Qty">
                  <NumberStepper
                    ariaLabel="Weapon quantity"
                    min={0}
                    step={1}
                    value={weapon.quantity ?? ''}
                    onChange={value => updateWeapon(i, { quantity: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Mass kg">
                  <NumberStepper
                    ariaLabel="Weapon mass"
                    min={0}
                    step="0.001"
                    value={weapon.mass ?? ''}
                    placeholder={String(coreMassFor(weapon.name, ['Weapon']) ?? '')}
                    onChange={value => updateWeapon(i, { mass: parseNullableNumber(value) })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem_auto] gap-2 items-end">
                <Field name="Traits">
                  <input className="input" value={weapon.traits}
                    onChange={e => updateWeapon(i, { traits: e.target.value })} />
                </Field>
                <Field name="Cost Cr">
                  <NumberStepper
                    ariaLabel="Weapon cost"
                    min={0}
                    step={1}
                    value={weapon.cost ?? ''}
                    onChange={value => updateWeapon(i, { cost: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Clips">
                  <NumberStepper
                    ariaLabel="Weapon clips"
                    min={0}
                    step={1}
                    value={weapon.ammo_clips ?? ''}
                    onChange={value => updateWeapon(i, { ammo_clips: parseNullableNonNegativeInteger(value) })}
                  />
                </Field>
                <Field name="Rounds">
                  <NumberStepper
                    ariaLabel="Weapon rounds"
                    min={0}
                    step={1}
                    value={weapon.ammo_rounds ?? ''}
                    placeholder={String(weaponClipSize(weapon) ?? '')}
                    onChange={value => updateWeapon(i, { ammo_rounds: parseNullableNonNegativeInteger(value) })}
                  />
                </Field>
                <Field name="Rounds/clip">
                  <NumberStepper
                    ariaLabel="Weapon rounds per clip"
                    min={0}
                    step={1}
                    value={weapon.ammo_clip_size ?? ''}
                    placeholder={String(weaponClipSize(weapon) ?? '')}
                    onChange={value => updateWeapon(i, { ammo_clip_size: parseNullableNonNegativeInteger(value) })}
                  />
                </Field>
                <button type="button" onClick={() => removeWeapon(i)} className="btn-steel text-alert hover:border-alert">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addWeapon} className="btn-steel flex items-center gap-1 text-xs">
            <Plus size={12} /> ADD WEAPON
          </button>
        </div>
      </details>

      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>ARMOR</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 space-y-2">
          {form.armour.map((item, i) => (
            <div key={i} className="border border-steel/35 p-2 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                <Field name="Worn">
                  <select className="select" value={boolSelectValue(item.worn)}
                    onChange={e => updateArmour(i, { worn: boolFromSelect(e.target.value) })}>
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </Field>
                <Field name="Name">
                  <input className="input" value={item.name}
                    onChange={e => updateArmour(i, { name: e.target.value })} />
                </Field>
                <Field name="Prot">
                  <NumberStepper
                    ariaLabel="Armour protection"
                    value={item.protection ?? ''}
                    onChange={value => updateArmour(i, { protection: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Rad">
                  <NumberStepper
                    ariaLabel="Armour radiation"
                    value={item.radiation ?? ''}
                    onChange={value => updateArmour(i, { radiation: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Qty">
                  <NumberStepper
                    ariaLabel="Armour quantity"
                    min={0}
                    step={1}
                    value={item.quantity ?? ''}
                    onChange={value => updateArmour(i, { quantity: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Mass kg">
                  <NumberStepper
                    ariaLabel="Armour mass"
                    min={0}
                    step="0.001"
                    value={item.mass ?? ''}
                    placeholder={String(coreMassFor(item.name, ['Armour']) ?? '')}
                    onChange={value => updateArmour(i, { mass: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Cost Cr">
                  <NumberStepper
                    ariaLabel="Armour cost"
                    min={0}
                    step={1}
                    value={item.cost ?? ''}
                    onChange={value => updateArmour(i, { cost: parseNullableNumber(value) })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                <Field name="Required Skill">
                  <input className="input" value={item.required_skill ?? ''}
                    onChange={e => updateArmour(i, { required_skill: e.target.value || null })} />
                </Field>
                <button type="button" onClick={() => removeArmour(i)} className="btn-steel text-alert hover:border-alert">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addArmour} className="btn-steel flex items-center gap-1 text-xs">
            <Plus size={12} /> ADD ARMOR
          </button>
        </div>
      </details>

      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>CHARACTER ITEMS</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 space-y-2">
          {form.personal_equipment.map((item, i) => (
            <div key={i} className="border border-steel/35 p-2 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <Field name="Qty">
                  <NumberStepper
                    ariaLabel="Equipment quantity"
                    min={0}
                    step={1}
                    value={item.quantity ?? ''}
                    onChange={value => updateEquipment(i, { quantity: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Name">
                  <input className="input" value={item.name}
                    onChange={e => updateEquipment(i, { name: e.target.value })} />
                </Field>
                <Field name="TL">
                  <NumberStepper
                    ariaLabel="Equipment tech level"
                    min={0}
                    value={item.tech_level ?? ''}
                    onChange={value => updateEquipment(i, { tech_level: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Mass kg">
                  <NumberStepper
                    ariaLabel="Equipment mass"
                    min={0}
                    step="0.001"
                    value={item.mass ?? ''}
                    onChange={value => updateEquipment(i, { mass: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Cost Cr">
                  <NumberStepper
                    ariaLabel="Equipment cost"
                    min={0}
                    step={1}
                    value={item.cost ?? ''}
                    onChange={value => updateEquipment(i, { cost: parseNullableNumber(value) })}
                  />
                </Field>
                <button type="button" onClick={() => removeEquipment(i)} className="btn-steel text-alert hover:border-alert self-end">
                  <Trash2 size={12} />
                </button>
              </div>
              <Field name="Notes">
                <input className="input" value={item.notes ?? ''}
                  onChange={e => updateEquipment(i, { notes: e.target.value || null })} />
              </Field>
            </div>
          ))}
          <button type="button" onClick={addEquipment} className="btn-steel flex items-center gap-1 text-xs">
            <Plus size={12} /> ADD ITEM
          </button>
        </div>
      </details>

      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>AUGMENTS</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 space-y-2">
          {form.augments.map((augment, i) => (
            <div key={i} className="border border-steel/35 p-2 grid grid-cols-2 md:grid-cols-[1fr_6rem_8rem_auto] gap-2 items-end">
              <Field name="Name">
                <input className="input" value={augment.name}
                  onChange={e => updateAugment(i, { name: e.target.value })} />
              </Field>
              <Field name="TL">
                <NumberStepper
                  ariaLabel="Augment tech level"
                  min={0}
                  value={augment.tech_level ?? ''}
                  onChange={value => updateAugment(i, { tech_level: parseNullableNumber(value) })}
                />
              </Field>
              <Field name="Cost Cr">
                <NumberStepper
                  ariaLabel="Augment cost"
                  min={0}
                  step={1}
                  value={augment.cost ?? ''}
                  onChange={value => updateAugment(i, { cost: parseNullableNumber(value) })}
                />
              </Field>
              <button type="button" onClick={() => removeAugment(i)} className="btn-steel text-alert hover:border-alert">
                <Trash2 size={12} />
              </button>
              <div className="col-span-2 md:col-span-4">
                <Field name="Notes">
                  <input className="input" value={augment.notes ?? ''}
                    onChange={e => updateAugment(i, { notes: e.target.value || null })} />
                </Field>
              </div>
            </div>
          ))}
          <button type="button" onClick={addAugment} className="btn-steel flex items-center gap-1 text-xs">
            <Plus size={12} /> ADD AUGMENT
          </button>
        </div>
      </details>

      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>CONTACTS</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 space-y-2">
          {form.contacts.map((contact, i) => (
            <div key={i} className="border border-steel/35 p-2 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_7rem_auto] gap-2 items-end">
                <Field name="Name">
                  <input className="input" value={contact.name ?? ''}
                    onChange={e => updateContact(i, { name: e.target.value || null })} />
                </Field>
                <Field name="Gender / Species">
                  <input className="input" value={contact.gender_species ?? ''}
                    onChange={e => updateContact(i, { gender_species: e.target.value || null })} />
                </Field>
                <Field name="Type">
                  <input className="input" value={contact.type ?? ''}
                    onChange={e => updateContact(i, { type: e.target.value || null })} />
                </Field>
                <Field name="Alive">
                  <select className="select" value={boolSelectValue(contact.alive)}
                    onChange={e => updateContact(i, { alive: boolFromSelect(e.target.value) })}>
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </Field>
                <button type="button" onClick={() => removeContact(i)} className="btn-steel text-alert hover:border-alert">
                  <Trash2 size={12} />
                </button>
              </div>
              <Field name="Link">
                <input className="input" value={contact.link ?? ''}
                  onChange={e => updateContact(i, { link: e.target.value || null })} />
              </Field>
              <Field name="Description">
                <textarea className="input resize-none h-14" value={contact.description ?? ''}
                  onChange={e => updateContact(i, { description: e.target.value || null })} />
              </Field>
            </div>
          ))}
          <button type="button" onClick={addContact} className="btn-steel flex items-center gap-1 text-xs">
            <Plus size={12} /> ADD CONTACT
          </button>
        </div>
      </details>

      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>LIFEPATH</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 space-y-2">
          {form.lifepath.map((term, i) => (
            <div key={i} className="border border-steel/35 p-2 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-[5rem_1fr_1fr_1fr_auto] gap-2 items-end">
                <Field name="Term">
                  <NumberStepper
                    ariaLabel="Lifepath term"
                    min={0}
                    value={term.term ?? ''}
                    onChange={value => updateLifepath(i, { term: parseNullableNumber(value) })}
                  />
                </Field>
                <Field name="Career">
                  <input className="input" value={term.career ?? ''}
                    onChange={e => updateLifepath(i, { career: e.target.value || null })} />
                </Field>
                <Field name="Assignment">
                  <input className="input" value={term.assignment ?? ''}
                    onChange={e => updateLifepath(i, { assignment: e.target.value || null })} />
                </Field>
                <Field name="Rank">
                  <input className="input" value={term.rank ?? ''}
                    onChange={e => updateLifepath(i, { rank: e.target.value || null })} />
                </Field>
                <button type="button" onClick={() => removeLifepathTerm(i)} className="btn-steel text-alert hover:border-alert">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'survived', label: 'Survived' },
                  { key: 'commissioned', label: 'Commissioned' },
                  { key: 'advanced', label: 'Advanced' },
                ].map(({ key, label }) => (
                  <Field key={key} name={label}>
                    <select className="select" value={boolSelectValue(term[key as keyof LifepathTerm] as boolean | null)}
                      onChange={e => updateLifepath(i, { [key]: boolFromSelect(e.target.value) })}>
                      <option value="">—</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                ))}
              </div>
              <Field name="Notes">
                <textarea className="input resize-none h-14" value={term.notes ?? ''}
                  onChange={e => updateLifepath(i, { notes: e.target.value || null })} />
              </Field>
            </div>
          ))}
          <button type="button" onClick={addLifepathTerm} className="btn-steel flex items-center gap-1 text-xs">
            <Plus size={12} /> ADD TERM
          </button>
        </div>
      </details>

      {/* ── Background ───────────────────────────────────────────────────── */}
      <details className="group">
        <summary className="label cursor-pointer hover:text-amber list-none flex items-center justify-between">
          <span>BACKGROUND</span>
          <ChevronDown size={12} className="group-open:hidden" />
          <ChevronUp size={12} className="hidden group-open:block" />
        </summary>
        <div className="mt-2 space-y-3">
          {[
            { key: 'personality_descriptors', label: 'Personality Descriptors' },
            { key: 'basic_description', label: 'Basic Description' },
            { key: 'visual_age', label: 'Visual Age' },
            { key: 'body_build', label: 'Body Build' },
            { key: 'attractiveness', label: 'Attractiveness' },
            { key: 'posture', label: 'Posture' },
            { key: 'distinguishing_marks', label: 'Distinguishing Marks' },
            { key: 'eye_colour', label: 'Eye Colour' },
            { key: 'hair_colour', label: 'Hair Colour' },
            { key: 'shape_of_face', label: 'Shape of Face' },
            { key: 'hair_style', label: 'Hair Style' },
            { key: 'skin_tone', label: 'Skin Tone' },
            { key: 'facial_hair', label: 'Facial Hair' },
            { key: 'everyday_clothes', label: 'Everyday Clothes' },
            { key: 'combat_ready_gear', label: 'Combat-Ready Gear' },
            { key: 'jewellery_accessories', label: 'Jewellery & Accessories' },
            { key: 'general_description', label: 'General Description' },
            { key: 'short_term_goals', label: 'Short-Term Goals' },
            { key: 'long_term_goals', label: 'Long-Term Goals' },
            { key: 'good_traits', label: 'Good Traits' },
            { key: 'bad_traits', label: 'Bad Traits' },
            { key: 'greatest_strength', label: 'Greatest Strength' },
            { key: 'greatest_weakness', label: 'Greatest Weakness' },
            { key: 'mannerisms', label: 'Mannerisms' },
            { key: 'speech_quirks', label: 'Speech Quirks' },
            { key: 'typical_mood', label: 'Typical Mood' },
            { key: 'sense_of_humour', label: 'Sense of Humour' },
            { key: 'greatest_joys', label: 'Greatest Joys' },
            { key: 'greatest_fears', label: 'Greatest Fears' },
            { key: 'most_at_ease', label: 'Most at Ease' },
            { key: 'least_at_ease', label: 'Least at Ease' },
            { key: 'background_story', label: 'Background Story' },
            { key: 'birthday', label: 'Birthday' },
            { key: 'important_childhood_memory', label: 'Important Childhood Memory' },
            { key: 'childhood_hero', label: 'Childhood Hero' },
            { key: 'childhood_enemies', label: 'Childhood Enemies' },
            { key: 'personality_shaping_events', label: 'Personality-Shaping Events' },
            { key: 'ever_arrested', label: 'Ever Arrested?' },
            { key: 'served_in_military', label: 'Served in the Military?' },
            { key: 'prominent_education', label: 'Prominent Education' },
            { key: 'teachers', label: 'Teachers' },
            { key: 'trained_skills', label: 'Trained Skills' },
            { key: 'training_where', label: 'Training: Where' },
            { key: 'training_when', label: 'Training: When' },
            { key: 'training_why', label: 'Training: Why' },
            { key: 'training_how', label: 'Training: How' },
            { key: 'upbringing_worldview', label: 'Upbringing World View' },
            { key: 'social_class_growing_up', label: 'Social Class Growing Up' },
            { key: 'current_social_class', label: 'Current Social Class' },
            { key: 'soft_spots', label: 'Soft Spots' },
            { key: 'enraged_when', label: 'Enraged When' },
            { key: 'depressed_when', label: 'Depressed When' },
            { key: 'biggest_accomplishment', label: 'Biggest Accomplishment' },
            { key: 'biggest_regret', label: 'Biggest Regret' },
            { key: 'darkest_secrets', label: 'Darkest Secrets' },
            { key: 'lie_you_believe', label: 'The Lie You Believe' },
            { key: 'favourite_colours', label: 'Favourite Colours' },
            { key: 'favourite_foods', label: 'Favourite Foods' },
            { key: 'favourite_music', label: 'Favourite Music' },
            { key: 'favourite_joke', label: 'Favourite Joke' },
            { key: 'spending_habits', label: 'Spending Habits' },
            { key: 'most_prized_possessions', label: 'Most Prized Possessions' },
            { key: 'hobbies', label: 'Hobbies' },
          ].map(({ key, label }) => (
            <Field key={key} name={label}>
              <textarea className="input resize-none h-16"
                value={(form.background as Record<string, string | null | undefined>)?.[key] ?? ''}
                onChange={e => setForm({ ...form, background: { ...form.background, [key]: e.target.value || null } })} />
            </Field>
          ))}
        </div>
      </details>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setShowForm(false)} className="btn-steel">CANCEL</button>
        <button type="submit" className="btn-amber">{editing ? 'UPDATE' : 'SAVE'}</button>
      </div>
    </form>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {rosterError && (
        <div role="alert" className="border-b border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert flex items-center justify-between gap-3 flex-shrink-0">
          <span>{rosterError}</span>
          <button type="button" onClick={() => setRosterError(null)} aria-label="Dismiss roster error"><X size={12} /></button>
        </div>
      )}

      {/* Hidden file input — lives outside both layouts so it is always in the DOM */}
      <input ref={fileRef} type="file"
        accept=".csv,text/csv"
        className="hidden" onChange={handleCsvUpload} />

      {/* ── Mobile layout (< lg) ────────────────────────────────────────────── */}
      <div className="lg:hidden flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="label text-amber">ACTIVE TRAVELLERS</div>
            <div className="text-body text-xs tracking-wider">
              {activeChars.length} ACTIVE / {chars.length} TOTAL
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} title="Import roster CSV" aria-label="Import roster CSV" className="btn-steel w-8 h-8 flex items-center justify-center p-0">
              <Upload size={14} />
            </button>
            <button type="button" onClick={exportCsv} title="Export roster CSV" aria-label="Export roster CSV" className="btn-steel w-8 h-8 flex items-center justify-center p-0">
              <Download size={14} />
            </button>
            <button
              onClick={() => { setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setEditing(null); setShowForm(v => !v); }}
              title="Add Traveller"
              aria-label="Add Traveller"
              className="btn-amber w-8 h-8 flex items-center justify-center p-0">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {showForm && charForm}

        <div className="space-y-3">
          {activeChars.map(char => (
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

        {activeChars.length === 0 && !showForm && (
          <div className="text-center py-16 text-body/65 text-sm space-y-2">
            <div className="text-4xl opacity-20">◈</div>
            <div>No active Travellers registered. Import a roster CSV or add manually.</div>
          </div>
        )}

        <div className="pt-2 border-t border-steel/40 space-y-3">
          <div className="label text-alert">DECEASED TRAVELLERS</div>
          {deceasedChars.length > 0 ? deceasedChars.map(char => (
            <CharCard key={char.id} char={char}
              onEdit={() => startEdit(char)}
              onDelete={() => deleteChar(char.id)}
              onRollSave={saveRoll}
              onStatAdjust={handleStatAdjust}
              onPortraitUpload={uploadPortrait}
              uploadingPortrait={uploadingPortraitId === char.id}
            />
          )) : (
            <div className="text-xs text-body/55 border border-steel/30 px-3 py-4 text-center">No deceased Travellers</div>
          )}
        </div>
      </div>

      {/* ── Desktop layout (≥ lg) ────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-steel flex flex-col overflow-hidden">
          <div className="p-3 border-b border-steel flex items-center justify-between gap-2 flex-shrink-0">
            <div>
              <div className="label text-amber">ACTIVE TRAVELLERS</div>
              <div className="text-[10px] text-body/55 font-mono">{activeChars.length} ACTIVE</div>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => fileRef.current?.click()}
                title="Import roster CSV"
                aria-label="Import roster CSV"
                className="btn-steel w-7 h-7 flex items-center justify-center p-0">
                <Upload size={12} />
              </button>
              <button type="button" onClick={exportCsv}
                title="Export roster CSV"
                aria-label="Export roster CSV"
                className="btn-steel w-7 h-7 flex items-center justify-center p-0">
                <Download size={12} />
              </button>
            </div>
          </div>
          <div className="p-2 border-b border-steel/50 flex-shrink-0">
            <button
              onClick={() => { setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setEditing(null); setShowForm(true); selectChar(null); }}
              className="btn-amber w-full flex items-center justify-center gap-1 text-xs">
              <Plus size={12} /> ADD CHARACTER
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeChars.map(char => (
              <CharSidebarRow key={char.id} char={char}
                selected={selectedId === char.id && !showForm}
                onSelect={id => { selectChar(id); setShowForm(false); }}
              />
            ))}
            {activeChars.length === 0 && (
              <div className="text-xs text-body/55 p-4 text-center">No active Travellers</div>
            )}
            <div className="mt-4 border-t border-steel/50">
              <div className="px-3 py-2 label text-alert">DECEASED TRAVELLERS</div>
              {deceasedChars.length > 0 ? deceasedChars.map(char => (
                <CharSidebarRow key={char.id} char={char}
                  selected={selectedId === char.id && !showForm}
                  onSelect={id => { selectChar(id); setShowForm(false); }}
                />
              )) : (
                <div className="text-xs text-body/45 px-3 pb-4">None logged</div>
              )}
            </div>
          </div>

          <div className="border-t border-steel/50 px-3 py-2 text-[10px] text-body/55 flex-shrink-0">
            {chars.length} TRAVELLER{chars.length !== 1 ? 'S' : ''}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto">
          {showForm ? (
            <div className="p-4 max-w-5xl">{charForm}</div>
          ) : selectedChar ? (
            <div className="p-5">
              <div className="relative min-w-0">
                <div className="absolute right-0 top-0 hidden lg:block">
                  <CharacterPortrait
                    char={selectedChar}
                    editable
                    uploading={uploadingPortraitId === selectedChar.id}
                    onUpload={file => uploadPortrait(selectedChar, file)}
                  />
                </div>

                {/* Character header */}
                <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-steel/50 lg:pr-56">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-bright font-bold font-mono text-xl truncate">{charDisplayName(selectedChar)}</div>
                      <CharacterActionsMenu
                        onEdit={() => startEdit(selectedChar)}
                        onDelete={() => deleteChar(selectedChar.id)}
                      />
                    </div>
                    <div className="text-xs text-body/70 mt-1 flex flex-wrap gap-x-2">
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
                  indentTopRows
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-body/55">
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
