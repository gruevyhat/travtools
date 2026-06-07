import { useEffect, useState, useCallback } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { SessionJournalEntry } from '../../types';

function relDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SessionJournal() {
  const { client } = useSupabase();
  const [entries, setEntries] = useState<SessionJournalEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client
      .from('session_journal')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { setErrorMessage(`Could not load journal: ${error.message}`); return; }
    setEntries((data ?? []) as SessionJournalEntry[]);
  }, [client]);

  useEffect(() => {
    load();
    if (!client) return;
    const channel = client
      .channel('session-journal-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_journal' }, load)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, load]);

  function openEntry(entry: SessionJournalEntry) {
    setExpanded(entry.id);
    setEditContent(entry.content);
    setEditName(entry.session_name);
    setErrorMessage(null);
  }

  function closeEntry() {
    setExpanded(null);
    setEditContent('');
    setEditName('');
  }

  async function createSession() {
    if (!client) return;
    const name = `Session ${entries.length + 1}`;
    const { data, error } = await client
      .from('session_journal')
      .insert({ session_name: name, content: '', author: 'GM' })
      .select()
      .single();
    if (error) { setErrorMessage(`Could not create session: ${error.message}`); return; }
    if (data) {
      const newEntry = data as SessionJournalEntry;
      setEntries(prev => [newEntry, ...prev]);
      openEntry(newEntry);
    }
  }

  async function saveEntry() {
    if (!client || !expanded) return;
    setSaving(true);
    const { error } = await client
      .from('session_journal')
      .update({ content: editContent, session_name: editName.trim() || 'Untitled', updated_at: new Date().toISOString() })
      .eq('id', expanded);
    setSaving(false);
    if (error) { setErrorMessage(`Could not save: ${error.message}`); return; }
    setEntries(prev => prev.map(e =>
      e.id === expanded
        ? { ...e, content: editContent, session_name: editName.trim() || 'Untitled', updated_at: new Date().toISOString() }
        : e
    ));
  }

  async function deleteEntry(id: string) {
    if (!client) return;
    setConfirmDelete(null);
    const { error } = await client.from('session_journal').delete().eq('id', id);
    if (error) { setErrorMessage(`Could not delete: ${error.message}`); return; }
    setEntries(prev => prev.filter(e => e.id !== id));
    if (expanded === id) closeEntry();
  }

  return (
    <div className="p-4 h-full overflow-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-body text-xs tracking-wider">
          {entries.length} SESSION{entries.length !== 1 ? 'S' : ''} RECORDED
        </div>
        <div className="flex-1" />
        <button type="button" onClick={createSession} className="btn-amber flex items-center gap-1 text-xs">
          <Plus size={12} /> NEW SESSION
        </button>
      </div>

      {errorMessage && (
        <div role="alert" className="border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss error"><X size={12} /></button>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-16 text-body/65 text-sm space-y-2">
          <div className="text-4xl opacity-20">📓</div>
          <div>No sessions recorded yet. Create a new session to start taking notes.</div>
        </div>
      )}

      <div className="space-y-2">
        {entries.map(entry => {
          const isOpen = expanded === entry.id;
          return (
            <div key={entry.id} className={`panel border ${isOpen ? 'border-amber/40' : 'border-steel/30'}`}>
              {/* Header row */}
              <button
                type="button"
                onClick={() => isOpen ? closeEntry() : openEntry(entry)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-sm font-bold ${isOpen ? 'text-amber' : 'text-bright'}`}>
                    {entry.session_name}
                  </div>
                  <div className="text-xs text-body/55">{relDate(entry.created_at)}</div>
                </div>
                {entry.content && (
                  <div className="text-xs text-body/50 truncate max-w-[8rem] hidden sm:block">
                    {entry.content.split('\n')[0].slice(0, 60)}
                  </div>
                )}
                {isOpen ? <ChevronUp size={13} className="text-body/50 flex-shrink-0" /> : <ChevronDown size={13} className="text-body/50 flex-shrink-0" />}
              </button>

              {/* Expanded edit area */}
              {isOpen && (
                <div className="border-t border-steel/40 px-4 py-3 space-y-3">
                  <div className="space-y-1">
                    <label className="label">SESSION NAME</label>
                    <input className="input text-sm" value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={saveEntry} />
                  </div>

                  <div className="space-y-1">
                    <label className="label">NOTES</label>
                    <textarea
                      className="input min-h-[240px] resize-y text-sm font-mono leading-relaxed"
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onBlur={saveEntry}
                      placeholder="Session notes, plot hooks, NPC names, loot found…"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button type="button" onClick={saveEntry} disabled={saving}
                      className="btn-amber text-xs flex items-center gap-1">
                      <Check size={12} />
                      {saving ? 'SAVING…' : 'SAVE'}
                    </button>

                    {confirmDelete === entry.id ? (
                      <>
                        <span className="text-xs text-alert font-mono">Delete this session?</span>
                        <button type="button" onClick={() => deleteEntry(entry.id)}
                          className="btn-danger text-xs">CONFIRM</button>
                        <button type="button" onClick={() => setConfirmDelete(null)}
                          className="btn-steel text-xs">CANCEL</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(entry.id)}
                        className="btn-danger flex items-center gap-1 text-xs ml-auto">
                        <Trash2 size={12} /> DELETE
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
