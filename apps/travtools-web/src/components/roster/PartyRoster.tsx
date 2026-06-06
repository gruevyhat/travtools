import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Upload, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { Character } from '../../types';
import {
  toHex, upp, statDM, skillChar, parseSkillsCSV, parseTalentsCSV, parseCSV,
  CSV_TEMPLATE, STAT_LABELS, CharStat,
} from '../../lib/traveller';

// ─── Types ──────────────────────────────────────────────────────────────────

type CharForm = Omit<Character, 'id' | 'created_at'>;

const EMPTY: CharForm = {
  name: '', str: null, dex: null, end_stat: null, int_stat: null, edu: null, soc: null,
  psi: null, career: null, rank: null, homeworld: null, skills: [], psionic_talents: [], notes: null,
};

const CORE_STATS: CharStat[] = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'];

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

// ─── Dice Roller ─────────────────────────────────────────────────────────────

interface RollTarget {
  label: string;
  skillLevel: number;
  charKey: CharStat | null;
  isPsionic: boolean;
}

interface RollResult {
  d1: number;
  d2: number;
  charDM: number;
  skillLevel: number;
  total: number;
}

function RollPanel({
  char,
  target,
  onClose,
}: {
  char: Character;
  target: RollTarget;
  onClose: () => void;
}) {
  const [charKey, setCharKey] = useState<CharStat | null>(target.charKey);
  const [difficulty, setDifficulty] = useState<number>(8);
  const [result, setResult] = useState<RollResult | null>(null);

  const charDM = charKey !== null ? statDM(char[charKey] as number | null) : 0;

  function roll() {
    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    const total = d1 + d2 + charDM + target.skillLevel;
    setResult({ d1, d2, charDM, skillLevel: target.skillLevel, total });
  }

  const success = result !== null && result.total >= difficulty;
  const effect = result !== null ? result.total - difficulty : 0;

  return (
    <div className="border border-steel/60 bg-void/80 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-amber tracking-wider uppercase">{target.label} CHECK</span>
        <button onClick={onClose} className="text-body/50 hover:text-body text-base leading-none">×</button>
      </div>

      {/* Characteristic selector */}
      <div className="flex items-center gap-2">
        <span className="text-body">Characteristic:</span>
        <select
          className="select py-0.5 text-xs w-36"
          value={charKey ?? ''}
          onChange={e => setCharKey((e.target.value as CharStat) || null)}
        >
          <option value="">— none —</option>
          {([...CORE_STATS, 'psi'] as CharStat[]).map(k => (
            <option key={k} value={k}>
              {STAT_LABELS[k]} ({fmtDM(statDM(char[k] as number | null))})
            </option>
          ))}
        </select>
        <span className="text-body">Skill: <span className="text-bright">{fmtDM(target.skillLevel)}</span></span>
      </div>

      {/* Difficulty */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-body mr-1">Difficulty:</span>
        {DIFFICULTIES.map(d => (
          <button
            key={d.target}
            onClick={() => setDifficulty(d.target)}
            className={`px-2 py-0.5 border text-xs font-mono transition-colors ${
              difficulty === d.target
                ? 'border-amber text-amber'
                : 'border-steel text-body hover:border-amber/60 hover:text-amber/60'
            }`}
          >
            {d.target}+
          </button>
        ))}
      </div>

      {/* Roll button */}
      <button onClick={roll} className="btn-amber w-full text-center">
        ROLL 2D6
      </button>

      {/* Result */}
      {result !== null && (
        <div className="border-t border-steel/60 pt-2 space-y-1">
          <div className="flex items-center gap-2 font-mono text-base">
            <span className="inline-flex items-center justify-center w-8 h-8 border border-amber text-amber font-bold">
              {result.d1}
            </span>
            <span className="text-body">+</span>
            <span className="inline-flex items-center justify-center w-8 h-8 border border-amber text-amber font-bold">
              {result.d2}
            </span>
            {charDM !== 0 && (
              <>
                <span className="text-body">+</span>
                <span className="text-cyan-trav">{STAT_LABELS[charKey!]} {fmtDM(result.charDM)}</span>
              </>
            )}
            {target.skillLevel !== 0 && (
              <>
                <span className="text-body">+</span>
                <span className="text-cyan-trav">Skill {fmtDM(result.skillLevel)}</span>
              </>
            )}
            <span className="text-body">=</span>
            <span className={`text-lg font-bold ${success ? 'text-safe glow-cyan' : 'text-alert'}`}>
              {result.total}
            </span>
          </div>
          <div className={`text-sm font-mono tracking-wider ${success ? 'text-safe' : 'text-alert'}`}>
            {success ? '✓ SUCCESS' : '✗ FAILURE'}
            {' '}·{' '}
            <span className="text-body text-xs">{difficulty}+ ({DIFFICULTIES.find(d => d.target === difficulty)?.label})</span>
            {' '}·{' '}
            <span className="text-bright text-xs">Effect {fmtDM(effect)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Character Card ──────────────────────────────────────────────────────────

function CharCard({ char, onEdit, onDelete }: { char: Character; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rollTarget, setRollTarget] = useState<RollTarget | null>(null);

  const trainedSkills = char.skills.filter(s => s.level >= 0).sort((a, b) => a.name.localeCompare(b.name));
  const hasPsionics = char.psionic_talents.length > 0 || (char.psi !== null && char.psi > 0);

  function openSkillRoll(skillName: string, skillLevel: number) {
    const charKey = skillChar(skillName);
    setRollTarget({ label: skillName, skillLevel, charKey, isPsionic: false });
  }

  function openPsiRoll(talentName: string, talentLevel: number) {
    setRollTarget({ label: talentName, skillLevel: talentLevel, charKey: 'psi', isPsionic: true });
  }

  function openStatRoll(stat: CharStat) {
    setRollTarget({ label: STAT_LABELS[stat], skillLevel: 0, charKey: stat, isPsionic: false });
  }

  return (
    <div className="panel">
      {/* Header */}
      <div
        className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-steel/20 transition-colors"
        onClick={() => { setExpanded(v => !v); setRollTarget(null); }}
      >
        <div>
          <div className="text-bright font-bold font-mono text-sm">{char.name}</div>
          <div className="text-xs text-body mt-0.5 space-x-2">
            {char.career && <span className="text-amber">{char.career}</span>}
            {char.rank && <span className="text-body/60">· {char.rank}</span>}
            {char.homeworld && <span className="text-body/60">· {char.homeworld}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-lg text-amber tracking-widest glow-amber">{upp(char)}</div>
            <div className="text-xs text-body/50">
              {trainedSkills.length} skill{trainedSkills.length !== 1 ? 's' : ''}
              {hasPsionics && <span className="text-cyan-trav ml-1">· PSI</span>}
            </div>
          </div>
          {expanded ? <ChevronUp size={14} className="text-body" /> : <ChevronDown size={14} className="text-body" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-steel px-4 py-3 space-y-4">

          {/* Characteristics */}
          <div>
            <div className="label mb-2">CHARACTERISTICS</div>
            <div className={`grid gap-2 ${hasPsionics ? 'grid-cols-7' : 'grid-cols-6'}`}>
              {CORE_STATS.map(key => {
                const val = char[key] as number | null;
                const dm = statDM(val);
                return (
                  <button
                    key={key}
                    onClick={() => openStatRoll(key)}
                    className="text-center border border-steel/40 hover:border-amber/60 transition-colors py-1 px-0.5 group"
                    title={`Roll ${STAT_LABELS[key]} check`}
                  >
                    <div className="text-xs text-body group-hover:text-amber/70">{STAT_LABELS[key]}</div>
                    <div className="text-amber font-mono text-base font-bold">{toHex(val)}</div>
                    <div className="text-xs text-body/50">{fmtDM(dm)}</div>
                  </button>
                );
              })}
              {hasPsionics && (
                <button
                  onClick={() => openStatRoll('psi')}
                  className="text-center border border-cyan-dim/60 hover:border-cyan-trav/60 transition-colors py-1 px-0.5 group"
                  title="Roll PSI check"
                >
                  <div className="text-xs text-cyan-trav/70 group-hover:text-cyan-trav">PSI</div>
                  <div className="text-cyan-trav font-mono text-base font-bold">{toHex(char.psi)}</div>
                  <div className="text-xs text-body/50">{fmtDM(statDM(char.psi))}</div>
                </button>
              )}
            </div>
          </div>

          {/* Skills */}
          {trainedSkills.length > 0 && (
            <div>
              <div className="label mb-2">SKILLS</div>
              <div className="flex flex-wrap gap-1.5">
                {trainedSkills.map((sk, i) => (
                  <button
                    key={i}
                    onClick={() => openSkillRoll(sk.name, sk.level)}
                    className={`flex items-center gap-1 border px-2 py-0.5 text-xs font-mono transition-colors
                      ${rollTarget?.label === sk.name
                        ? 'border-amber text-amber bg-amber/10'
                        : 'border-steel text-cyan-trav hover:border-amber hover:text-amber'}`}
                  >
                    <span>{sk.name}</span>
                    <span className="text-body/60">-{sk.level}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Psionics */}
          {hasPsionics && (
            <div>
              <div className="label mb-2 text-cyan-trav">PSIONICS</div>
              <div className="flex flex-wrap gap-1.5">
                {char.psionic_talents.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => openPsiRoll(t.name, t.level)}
                    className={`flex items-center gap-1 border px-2 py-0.5 text-xs font-mono transition-colors
                      ${rollTarget?.label === t.name
                        ? 'border-cyan-trav text-cyan-trav bg-cyan-trav/10'
                        : 'border-cyan-dim text-cyan-trav hover:border-cyan-trav'}`}
                  >
                    <span>{t.name}</span>
                    <span className="text-body/60">-{t.level}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Roll panel */}
          {rollTarget && (
            <RollPanel
              char={char}
              target={rollTarget}
              onClose={() => setRollTarget(null)}
            />
          )}

          {/* Notes */}
          {char.notes && (
            <div className="text-xs text-body/70 border-t border-steel/50 pt-2">{char.notes}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onEdit} className="btn-steel text-xs">EDIT</button>
            <button onClick={onDelete} className="btn-danger text-xs">DELETE</button>
          </div>
        </div>
      )}
    </div>
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
    const payload = {
      ...form,
      skills: parseSkillsCSV(skillsRaw),
      psionic_talents: parseTalentsCSV(talentsRaw),
    };
    if (editing) {
      await client.from('characters').update(payload).eq('id', editing);
      setEditing(null);
    } else {
      await client.from('characters').insert(payload);
    }
    setForm(EMPTY);
    setSkillsRaw('');
    setTalentsRaw('');
    setShowForm(false);
  }

  async function deleteChar(id: string) {
    if (!client || !confirm('Remove this character?')) return;
    await client.from('characters').delete().eq('id', id);
  }

  function startEdit(char: Character) {
    setForm({
      name: char.name, str: char.str, dex: char.dex, end_stat: char.end_stat,
      int_stat: char.int_stat, edu: char.edu, soc: char.soc, psi: char.psi,
      career: char.career, rank: char.rank, homeworld: char.homeworld,
      skills: char.skills, psionic_talents: char.psionic_talents, notes: char.notes,
    });
    setSkillsRaw(char.skills.map(s => `${s.name}-${s.level}`).join(', '));
    setTalentsRaw(char.psionic_talents.map(t => `${t.name}-${t.level}`).join(', '));
    setEditing(char.id);
    setShowForm(true);
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length === 0) { alert('No valid characters found. Check CSV format.'); return; }
    for (const c of parsed) {
      await client.from('characters').insert(c);
    }
    e.target.value = '';
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'travtools-characters-template.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  const numInput = (key: keyof CharForm, label: string) => {
    const val = (form[key] as number | null) ?? null;
    return (
      <div key={key} className="space-y-1">
        <label className="label flex items-center justify-between">
          <span>{label}</span>
          {val !== null && <span className="text-amber font-mono">{toHex(val)}</span>}
        </label>
        <input
          className="input"
          type="number" min={0} max={15}
          value={val ?? ''}
          onChange={e => setForm({ ...form, [key]: e.target.value ? parseInt(e.target.value) : null })}
        />
      </div>
    );
  };

  const F = ({ name, children }: { name: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <label className="label">{name}</label>
      {children}
    </div>
  );

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="text-body text-xs tracking-wider">
          {chars.length} CHARACTER{chars.length !== 1 ? 'S' : ''} REGISTERED
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="btn-steel flex items-center gap-1">
            <Download size={13} /> TEMPLATE
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-steel flex items-center gap-1">
            <Upload size={13} /> IMPORT CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSV} />
          <button
            onClick={() => { setForm(EMPTY); setSkillsRaw(''); setTalentsRaw(''); setEditing(null); setShowForm(v => !v); }}
            className="btn-amber flex items-center gap-1"
          >
            <Plus size={13} /> ADD CHARACTER
          </button>
        </div>
      </div>

      {/* CSV format hint */}
      <div className="border border-steel/40 px-3 py-2 text-xs text-body/50">
        CSV: <span className="text-amber/70">Name, STR, DEX, END, INT, EDU, SOC, PSI, Career, Rank, Homeworld, Skills, PsionicTalents, Notes</span>
        &nbsp;— Skills/Talents as <span className="text-cyan-trav/70">"Medic-2,Recon-1"</span>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <form onSubmit={saveChar} className="panel p-4 space-y-4">
          <div className="panel-header -mx-4 -mt-4 mb-1">
            {editing ? 'EDIT CHARACTER' : 'NEW CHARACTER'}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <F name="Name">
              <input className="input" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </F>
            <F name="Homeworld">
              <input className="input" value={form.homeworld ?? ''}
                onChange={e => setForm({ ...form, homeworld: e.target.value || null })} />
            </F>
            <F name="Career">
              <input className="input" value={form.career ?? ''}
                onChange={e => setForm({ ...form, career: e.target.value || null })} />
            </F>
            <F name="Rank">
              <input className="input" value={form.rank ?? ''}
                onChange={e => setForm({ ...form, rank: e.target.value || null })} />
            </F>
          </div>

          <div>
            <div className="label mb-2">UPP (0–15; hex shown live)</div>
            <div className="grid grid-cols-6 gap-2">
              {([
                ['str', 'STR'], ['dex', 'DEX'], ['end_stat', 'END'],
                ['int_stat', 'INT'], ['edu', 'EDU'], ['soc', 'SOC'],
              ] as [keyof CharForm, string][]).map(([key, label]) => numInput(key, label))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {numInput('psi', 'PSI (0 if none)')}
          </div>

          <F name="Skills (e.g. Medic-2, Gun Combat (Slug)-3, Recon-1)">
            <input className="input" value={skillsRaw} onChange={e => setSkillsRaw(e.target.value)}
              placeholder="SkillName-Level, ..." />
          </F>
          <F name="Psionic Talents (e.g. Awareness-1, Telepathy-0)">
            <input className="input" value={talentsRaw} onChange={e => setTalentsRaw(e.target.value)}
              placeholder="TalentName-Level, ... (leave blank if none)" />
          </F>
          <F name="Notes">
            <textarea className="input resize-none h-16" value={form.notes ?? ''}
              onChange={e => setForm({ ...form, notes: e.target.value || null })} />
          </F>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="btn-steel">CANCEL</button>
            <button type="submit" className="btn-amber">{editing ? 'UPDATE' : 'SAVE'}</button>
          </div>
        </form>
      )}

      {/* Character cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {chars.map(char => (
          <CharCard key={char.id} char={char} onEdit={() => startEdit(char)} onDelete={() => deleteChar(char.id)} />
        ))}
      </div>

      {chars.length === 0 && !showForm && (
        <div className="text-center py-16 text-body/40 text-sm space-y-2">
          <div className="text-4xl opacity-20">◈</div>
          <div>No characters registered. Import a CSV or add manually.</div>
        </div>
      )}
    </div>
  );
}
