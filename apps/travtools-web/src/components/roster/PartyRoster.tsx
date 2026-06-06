import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { Character, Skill } from '../../types';

type CharForm = Omit<Character, 'id' | 'created_at'>;

const EMPTY: CharForm = {
  name: '', str: null, dex: null, end_stat: null, int_stat: null, edu: null, soc: null,
  career: null, rank: null, homeworld: null, skills: [], notes: null,
};

function toHex(n: number | null): string {
  if (n === null) return '?';
  if (n >= 10) return String.fromCharCode(55 + n); // A=10, B=11...
  return String(n);
}

function upp(char: Character): string {
  return [char.str, char.dex, char.end_stat, char.int_stat, char.edu, char.soc]
    .map(toHex).join('');
}

function parseSkillsCSV(raw: string): Skill[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const match = s.match(/^(.+?)-(\d+)$/);
    if (match) return { name: match[1].trim(), level: parseInt(match[2]) };
    return { name: s, level: 0 };
  });
}

function parseCSV(text: string): CharForm[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur); cur = ''; }
      else cur += ch;
    }
    values.push(cur);
    const get = (key: string) => values[headers.indexOf(key)]?.trim() ?? '';
    const num = (key: string) => { const v = parseInt(get(key)); return isNaN(v) ? null : v; };
    return {
      name: get('name') || 'Unknown',
      str: num('str'), dex: num('dex'), end_stat: num('end'),
      int_stat: num('int'), edu: num('edu'), soc: num('soc'),
      career: get('career') || null,
      rank: get('rank') || null,
      homeworld: get('homeworld') || null,
      skills: parseSkillsCSV(get('skills')),
      notes: get('notes') || null,
    };
  });
}

function CharCard({ char, onEdit, onDelete }: { char: Character; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="panel">
      <div
        className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-steel/20 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div>
          <div className="text-bright font-bold font-mono text-sm">{char.name}</div>
          <div className="text-xs text-body mt-0.5">
            {char.career && <span className="text-amber">{char.career}</span>}
            {char.rank && <span className="text-body/60"> · {char.rank}</span>}
            {char.homeworld && <span className="text-body/60"> · {char.homeworld}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-lg text-amber tracking-widest glow-amber">{upp(char)}</div>
          {expanded ? <ChevronUp size={14} className="text-body" /> : <ChevronDown size={14} className="text-body" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-steel px-4 py-3 space-y-3">
          {/* UPP breakdown */}
          <div className="grid grid-cols-6 gap-2">
            {[
              ['STR', char.str], ['DEX', char.dex], ['END', char.end_stat],
              ['INT', char.int_stat], ['EDU', char.edu], ['SOC', char.soc],
            ].map(([label, val]) => (
              <div key={label as string} className="text-center">
                <div className="text-xs text-body">{label as string}</div>
                <div className="text-amber font-mono text-base font-bold">{toHex(val as number | null)}</div>
                <div className="text-body/40 text-xs">({val ?? '?'})</div>
              </div>
            ))}
          </div>

          {/* Skills */}
          {char.skills.length > 0 && (
            <div>
              <div className="label mb-2">SKILLS</div>
              <div className="flex flex-wrap gap-1.5">
                {char.skills.map((sk, i) => (
                  <span key={i} className="text-xs border border-steel px-2 py-0.5 text-cyan-trav font-mono">
                    {sk.name}-{sk.level}
                  </span>
                ))}
              </div>
            </div>
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

export default function PartyRoster() {
  const { client } = useSupabase();
  const [chars, setChars] = useState<Character[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CharForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [skillsRaw, setSkillsRaw] = useState('');
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
    const payload = { ...form, skills: parseSkillsCSV(skillsRaw) };
    if (editing) {
      await client.from('characters').update(payload).eq('id', editing);
      setEditing(null);
    } else {
      await client.from('characters').insert(payload);
    }
    setForm(EMPTY);
    setSkillsRaw('');
    setShowForm(false);
  }

  async function deleteChar(id: string) {
    if (!client || !confirm('Remove this character?')) return;
    await client.from('characters').delete().eq('id', id);
  }

  function startEdit(char: Character) {
    setForm({
      name: char.name, str: char.str, dex: char.dex, end_stat: char.end_stat,
      int_stat: char.int_stat, edu: char.edu, soc: char.soc,
      career: char.career, rank: char.rank, homeworld: char.homeworld,
      skills: char.skills, notes: char.notes,
    });
    setSkillsRaw(char.skills.map(s => `${s.name}-${s.level}`).join(', '));
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

  const numInput = (key: keyof CharForm) => (
    <input
      className="input"
      type="number"
      min={0}
      max={15}
      value={(form[key] as number | null) ?? ''}
      onChange={e => setForm({ ...form, [key]: e.target.value ? parseInt(e.target.value) : null })}
    />
  );

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
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-steel flex items-center gap-1"
          >
            <Upload size={13} /> IMPORT CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSV} />
          <button
            onClick={() => { setForm(EMPTY); setSkillsRaw(''); setEditing(null); setShowForm(v => !v); }}
            className="btn-amber flex items-center gap-1"
          >
            <Plus size={13} /> ADD CHARACTER
          </button>
        </div>
      </div>

      {/* CSV format hint */}
      <div className="border border-steel/40 px-3 py-2 text-xs text-body/50">
        CSV columns: <span className="text-amber/70">Name, STR, DEX, END, INT, EDU, SOC, Career, Rank, Homeworld, Skills, Notes</span>
        &nbsp;— Skills as <span className="text-cyan-trav/70">"Pilot-2,Navigation-1,Gunnery-1"</span>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={saveChar} className="panel p-4 space-y-4">
          <div className="panel-header -mx-4 -mt-4 mb-1">
            {editing ? 'EDIT CHARACTER' : 'NEW CHARACTER'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F name="Name">
              <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </F>
            <F name="Homeworld">
              <input className="input" value={form.homeworld ?? ''} onChange={e => setForm({ ...form, homeworld: e.target.value || null })} />
            </F>
            <F name="Career">
              <input className="input" value={form.career ?? ''} onChange={e => setForm({ ...form, career: e.target.value || null })} />
            </F>
            <F name="Rank">
              <input className="input" value={form.rank ?? ''} onChange={e => setForm({ ...form, rank: e.target.value || null })} />
            </F>
          </div>

          <div>
            <div className="label mb-2">UPP (Universal Personality Profile)</div>
            <div className="grid grid-cols-6 gap-2">
              {([['STR', 'str'], ['DEX', 'dex'], ['END', 'end_stat'], ['INT', 'int_stat'], ['EDU', 'edu'], ['SOC', 'soc']] as [string, keyof CharForm][]).map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <label className="label">{label}</label>
                  {numInput(key)}
                </div>
              ))}
            </div>
          </div>

          <F name="Skills (e.g. Pilot-2, Navigation-1, Gunnery-1)">
            <input className="input" value={skillsRaw} onChange={e => setSkillsRaw(e.target.value)} placeholder="SkillName-Level, ..." />
          </F>
          <F name="Notes">
            <textarea
              className="input resize-none h-16"
              value={form.notes ?? ''}
              onChange={e => setForm({ ...form, notes: e.target.value || null })}
            />
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
          <CharCard
            key={char.id}
            char={char}
            onEdit={() => startEdit(char)}
            onDelete={() => deleteChar(char.id)}
          />
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
