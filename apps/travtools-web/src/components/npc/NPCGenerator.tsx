import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react';
import { useSupabase } from '../../lib/supabaseContext';
import { rollD66 } from '../../lib/dice';
import {
  applyExperienceBonuses,
  generateCharacteristics,
  generateQuickCharacter,
} from '../../lib/quickCharGen';
import {
  ALLIES_ENEMIES,
  CHARACTER_QUIRKS,
  EXPERIENCE_LEVELS,
  ExperienceLevel,
  lookupD66,
} from '../../data/quickCharacters';
import { RACES, randomRace, randomName } from '../../data/npcNames';
import { toHex, statDM, skillChar, CharStat } from '../../lib/traveller';
import NpcRollModal, { NpcRollTarget } from '../shared/NpcRollModal';
import type { CharacterContact, NpcRecord } from '../../types';
import {
  type ContactOwner,
  contactLabel,
  errorMessage,
  hasContactValue,
  isCompleteRosterContact,
  isMissingNpcContactColumnError,
  makeContactId,
  normalizeContact,
  npcAssociationLabel,
} from '../../lib/contacts';

const CORE_STAT_KEYS: CharStat[] = ['str', 'dex', 'end_stat', 'int_stat', 'edu', 'soc'];
const CORE_STAT_LABELS = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'];

interface NpcListEntry {
  key: string;
  npc: NpcRecord | null;
  contact: CharacterContact | null;
  owner: ContactOwner | null;
  name: string;
  race: string | null;
  archetype: string | null;
  quirk: string | null;
  experience_level: string | null;
  gender_species: string | null;
  type: string | null;
  description: string | null;
  link: string | null;
  alive: boolean | null;
  statValues: Partial<Record<CharStat, number | null>>;
  skills: { name: string; level: number }[];
}

function npcStatValues(npc: NpcRecord): Partial<Record<CharStat, number | null>> {
  return {
    str: npc.str, dex: npc.dex, end_stat: npc.end_stat,
    int_stat: npc.int_stat, edu: npc.edu, soc: npc.soc,
  };
}

function rollArchetype() {
  const { d66 } = rollD66();
  return lookupD66(ALLIES_ENEMIES, d66) ?? ALLIES_ENEMIES[0];
}
function rollQuirk() {
  const { d66 } = rollD66();
  return lookupD66(CHARACTER_QUIRKS, d66) ?? CHARACTER_QUIRKS[0];
}
function rollLevel(): ExperienceLevel {
  return EXPERIENCE_LEVELS[Math.floor(Math.random() * EXPERIENCE_LEVELS.length)];
}
function rollStats(level: ExperienceLevel): number[] {
  return applyExperienceBonuses(generateCharacteristics(), level.charBonuses);
}

function contactEntryKey(owner: ContactOwner, contact: CharacterContact, index: number): string {
  return `${owner.id}:${contact.id ?? `index:${index}`}`;
}

function contactAssociationLabel(owner: ContactOwner | null, contact: CharacterContact | null): string | null {
  if (!owner || !contact) return null;
  return `${owner.name} / ${contactLabel(contact)}`;
}

function hasContactDetails(entry: NpcListEntry, association: string | null): boolean {
  return Boolean(
    association ||
    entry.type ||
    entry.gender_species ||
    entry.link ||
    entry.description ||
    (entry.alive !== null && entry.alive !== undefined)
  );
}

export default function NPCGenerator() {
  const { client, canEdit } = useSupabase();

  // ── Generator state ───────────────────────────────────────────────────────
  const initial = generateQuickCharacter();
  const [npcName, setNpcName] = useState(initial.name);
  const [race, setRace] = useState(initial.race);
  const [genderSpecies, setGenderSpecies] = useState('');
  const [contactType, setContactType] = useState('');
  const [contactLink, setContactLink] = useState('');
  const [alive, setAlive] = useState<boolean | null>(null);
  const [description, setDescription] = useState('');
  const [contactCharacterId, setContactCharacterId] = useState('');
  const [contactId, setContactId] = useState('');
  const [archetype, setArchetype] = useState(initial.archetype);
  const [quirk, setQuirk] = useState(initial.quirk);
  const [level, setLevel] = useState<ExperienceLevel>(initial.experienceLevel);
  const [stats, setStats] = useState<number[]>([
    initial.str, initial.dex, initial.end_stat, initial.int_stat, initial.edu, initial.soc,
  ]);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<NpcRecord | null>(null);
  const [deletingNpcId, setDeletingNpcId] = useState<string | null>(null);

  // ── Roll modal ────────────────────────────────────────────────────────────
  const [rollModal, setRollModal] = useState<{
    npcName: string;
    statValues: Partial<Record<CharStat, number | null>>;
    target: NpcRollTarget;
  } | null>(null);

  // ── Saved NPCs / roster contacts ─────────────────────────────────────────
  const [npcs, setNpcs] = useState<NpcRecord[]>([]);
  const [characters, setCharacters] = useState<ContactOwner[]>([]);

  const loadNpcs = useCallback(async () => {
    if (!client) return;
    const { data } = await client
      .from('npcs').select('*').order('created_at', { ascending: false });
    if (data) setNpcs(data as NpcRecord[]);
  }, [client]);

  const loadCharacters = useCallback(async () => {
    if (!client) return;
    const { data } = await client
      .from('characters').select('id,name,contacts').order('name');
    if (data) setCharacters(data as ContactOwner[]);
  }, [client]);

  useEffect(() => { loadNpcs(); loadCharacters(); }, [loadNpcs, loadCharacters]);

  useEffect(() => {
    if (!client) return;
    const sub = client
      .channel('npcs-realtime')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'npcs' },
        (p) => setNpcs(prev => prev.filter(n => n.id !== p.old.id)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'npcs' },
        (p) => setNpcs(prev => prev.some(n => n.id === p.new.id) ? prev : [p.new as NpcRecord, ...prev]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'npcs' },
        (p) => setNpcs(prev => prev.map(n => n.id === p.new.id ? p.new as NpcRecord : n)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, loadCharacters)
      .subscribe();
    return () => { client.removeChannel(sub); };
  }, [client, loadCharacters]);

  const selectedCharacter = useMemo(
    () => characters.find(character => character.id === contactCharacterId) ?? null,
    [characters, contactCharacterId],
  );
  const contactOptions = useMemo(
    () => (selectedCharacter?.contacts ?? [])
      .map((contact, index) => ({
        contact,
        index,
        value: contact.id ?? `index:${index}`,
      }))
      .filter(option => hasContactValue(option.contact)),
    [selectedCharacter],
  );
  const selectedContactOption = contactOptions.find(option => option.value === contactId) ?? null;
  const savedEntries = useMemo<NpcListEntry[]>(() => {
    const usedContactKeys = new Set<string>();
    const contactRecords = characters.flatMap(owner =>
      (owner.contacts ?? [])
        .map((contact, index) => ({ owner, contact, index, key: contactEntryKey(owner, contact, index) }))
        .filter(record => isCompleteRosterContact(record.contact))
    );

    const entries: NpcListEntry[] = npcs.map(npc => {
      const linkedContact = contactRecords.find(record =>
        (npc.contact_character_id && record.owner.id === npc.contact_character_id && record.contact.id === npc.contact_id) ||
        record.contact.npc_id === npc.id
      ) ?? null;
      if (linkedContact) usedContactKeys.add(linkedContact.key);
      const contact = linkedContact?.contact ?? null;
      return {
        key: `npc:${npc.id}`,
        npc,
        contact,
        owner: linkedContact?.owner ?? null,
        name: npc.name || contact?.name || 'Unnamed NPC',
        race: npc.race ?? null,
        archetype: npc.archetype,
        quirk: npc.quirk,
        experience_level: npc.experience_level,
        gender_species: contact?.gender_species ?? npc.gender_species,
        type: contact?.type ?? npc.type,
        description: contact?.description ?? npc.description,
        link: contact?.link ?? npc.link,
        alive: contact?.alive ?? npc.alive,
        statValues: npcStatValues(npc),
        skills: Array.isArray(npc.skills) ? npc.skills as { name: string; level: number }[] : [],
      };
    });

    const contactEntries: NpcListEntry[] = contactRecords
      .filter(record => !usedContactKeys.has(record.key))
      .map(record => ({
        key: `contact:${record.key}`,
        npc: null,
        contact: record.contact,
        owner: record.owner,
        name: record.contact.name ?? 'Unnamed Contact',
        race: null,
        archetype: null,
        quirk: null,
        experience_level: null,
        gender_species: record.contact.gender_species,
        type: record.contact.type,
        description: record.contact.description,
        link: record.contact.link,
        alive: record.contact.alive,
        statValues: {},
        skills: [],
      }));

    return [...entries, ...contactEntries];
  }, [characters, npcs]);

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

  function applyContactFields(contact: Partial<CharacterContact>) {
    setNpcName(contact.name ?? npcName);
    setGenderSpecies(contact.gender_species ?? '');
    setContactType(contact.type ?? '');
    setDescription(contact.description ?? '');
    setContactLink(contact.link ?? '');
    setAlive(contact.alive ?? null);
  }

  function handleContactCharacterChange(id: string) {
    setContactCharacterId(id);
    setContactId('');
    setSavedMsg(null);
  }

  function handleContactSelect(value: string) {
    setContactId(value);
    setSavedMsg(null);
    const option = contactOptions.find(item => item.value === value);
    if (option) applyContactFields(option.contact);
  }

  function resetContactState() {
    setGenderSpecies('');
    setContactType('');
    setContactLink('');
    setAlive(null);
    setDescription('');
    setContactCharacterId('');
    setContactId('');
  }

  // ── Generator actions ─────────────────────────────────────────────────────
  function rerollAll() {
    const npc = generateQuickCharacter();
    setNpcName(npc.name); setRace(npc.race); setArchetype(npc.archetype);
    setQuirk(npc.quirk); setLevel(npc.experienceLevel);
    resetContactState();
    setStats([npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc]);
    setNameError(false); setSaveError(null); setSavedMsg(null);
  }
  function rerollName() { setNpcName(randomName(race)); setSavedMsg(null); }
  function rerollRace() {
    const r = randomRace(); setRace(r); setNpcName(randomName(r)); setSavedMsg(null);
  }
  function rerollArchetype() { setArchetype(rollArchetype().archetype); setSavedMsg(null); }
  function rerollQuirk() {
    const nextQuirk = rollQuirk().quirk;
    setQuirk(nextQuirk); setSavedMsg(null);
  }
  function rerollLevel() {
    const l = rollLevel(); setLevel(l); setStats(rollStats(l)); setSavedMsg(null);
  }
  function rerollStats() { setStats(rollStats(level)); setSavedMsg(null); }
  function handleLevelChange(id: string) {
    const l = EXPERIENCE_LEVELS.find(e => e.id === id) ?? level;
    setLevel(l); setStats(rollStats(l)); setSavedMsg(null);
  }

  // ── Roll helpers ──────────────────────────────────────────────────────────
  function openStatRoll(npcNameArg: string, statValues: Partial<Record<CharStat, number | null>>, statKey: CharStat, statLabel: string) {
    setRollModal({ npcName: npcNameArg, statValues, target: { label: statLabel, skillLevel: 0, charKey: statKey } });
  }

  function openSkillRoll(npcNameArg: string, statValues: Partial<Record<CharStat, number | null>>, skill: { name: string; level: number }) {
    const charKey = skillChar(skill.name) ?? 'int_stat';
    setRollModal({ npcName: npcNameArg, statValues, target: { label: skill.name, skillLevel: skill.level, charKey } });
  }

  // Generator stat values
  const genStatValues: Partial<Record<CharStat, number | null>> = {
    str: stats[0], dex: stats[1], end_stat: stats[2],
    int_stat: stats[3], edu: stats[4], soc: stats[5],
  };

  // ── Save / Delete ─────────────────────────────────────────────────────────
  function contactPayloadFor(npcId: string | null, nextContactId: string | null): CharacterContact {
    return normalizeContact({
      ...selectedContactOption?.contact,
      id: nextContactId ?? selectedContactOption?.contact.id ?? undefined,
      npc_id: npcId,
      name: npcName.trim(),
      gender_species: genderSpecies || null,
      type: contactType || null,
      description: description || null,
      link: contactLink || null,
      alive,
    });
  }

  async function syncRosterContact(npc: NpcRecord, nextContactId: string) {
    if (!client || !selectedCharacter) return;
    const contact = contactPayloadFor(npc.id, nextContactId);
    const contacts = selectedCharacter.contacts ?? [];
    const nextContacts = contactId
      ? contacts.map((item, index) => index === selectedContactOption?.index ? contact : item)
      : [...contacts, contact];

    const { data, error } = await client
      .from('characters')
      .update({ contacts: nextContacts })
      .eq('id', selectedCharacter.id)
      .select('id,name,contacts')
      .single();
    if (error) throw error;
    if (data) {
      setCharacters(prev => prev.map(character => character.id === selectedCharacter.id ? data as ContactOwner : character));
    }
  }

  async function clearNpcContactLink(npc: NpcRecord) {
    if (!client) return;
    const owner = characters.find(character => character.id === npc.contact_character_id)
      ?? characters.find(character => (character.contacts ?? []).some(contact => contact.npc_id === npc.id));
    if (!owner) return;
    const nextContacts = (owner.contacts ?? []).map(contact =>
      contact.npc_id === npc.id ? { ...contact, npc_id: null } : contact
    );
    await client.from('characters').update({ contacts: nextContacts }).eq('id', owner.id);
    setCharacters(prev => prev.map(character => character.id === owner.id ? { ...character, contacts: nextContacts } : character));
  }

  async function handleSave() {
    if (!npcName.trim()) { setNameError(true); return; }
    if (!client) return;
    setSaving(true); setSaveError(null); setSavedMsg(null);
    const nextContactId = contactCharacterId ? selectedContactOption?.contact.id ?? makeContactId() : null;
    const contact = contactPayloadFor(null, nextContactId);
    const coreNpcPayload = {
      name: npcName.trim(), race,
      archetype, quirk,
      experience_level: level.label,
      str: stats[0], dex: stats[1], end_stat: stats[2],
      int_stat: stats[3], edu: stats[4], soc: stats[5],
      skills: level.skills, notes: quirk,
    };
    const contactNpcPayload = {
      gender_species: contact.gender_species,
      type: contact.type,
      description: contact.description,
      link: contact.link,
      alive: contact.alive,
      contact_character_id: contactCharacterId || null,
      contact_id: nextContactId,
    };
    const shouldPersistNpcContactFields = Boolean(
      contactNpcPayload.gender_species ||
      contactNpcPayload.type ||
      contactNpcPayload.description ||
      contactNpcPayload.link ||
      contactNpcPayload.alive !== null ||
      contactNpcPayload.contact_character_id ||
      contactNpcPayload.contact_id
    );

    let usedContactSchemaFallback = false;
    let saveResult = await client.from('npcs')
      .insert(shouldPersistNpcContactFields ? { ...coreNpcPayload, ...contactNpcPayload } : coreNpcPayload)
      .select()
      .single();
    if (saveResult.error && shouldPersistNpcContactFields && isMissingNpcContactColumnError(saveResult.error)) {
      usedContactSchemaFallback = true;
      saveResult = await client.from('npcs').insert(coreNpcPayload).select().single();
    }
    const { data, error } = saveResult;
    setSaving(false);
    if (error) { setSaveError(`Could not save: ${error.message}`); return; }
    if (data) {
      const savedNpc = data as NpcRecord;
      setNpcs(prev => [savedNpc, ...prev]);
      if (nextContactId) {
        try {
          await syncRosterContact(savedNpc, nextContactId);
        } catch (syncError) {
          setSaveError(`${savedNpc.name} saved, but roster contact sync failed: ${errorMessage(syncError)}`);
          return;
        }
      }
    }
    const schemaFallbackNote = usedContactSchemaFallback
      ? selectedCharacter
        ? ' NPC contact columns are not applied yet; roster link was stored on the character sheet.'
        : ' Contact fields were skipped because the NPC contact columns are not applied yet.'
      : '';
    setSavedMsg(`${npcName.trim()} saved${selectedCharacter ? ` and linked to ${selectedCharacter.name}` : ''}.${schemaFallbackNote}`);
  }

  async function deleteNpc(npc: NpcRecord) {
    if (!client) return;
    setNpcs(prev => prev.filter(n => n.id !== npc.id));
    await clearNpcContactLink(npc);
    await client.from('npcs').delete().eq('id', npc.id);
  }

  async function confirmDeleteNpc() {
    if (!deleteCandidate) return;
    setDeletingNpcId(deleteCandidate.id);
    setSaveError(null);
    setSavedMsg(null);
    try {
      await deleteNpc(deleteCandidate);
      setDeleteCandidate(null);
    } catch (error) {
      setSaveError(`Could not delete ${deleteCandidate.name}: ${errorMessage(error)}`);
    } finally {
      setDeletingNpcId(null);
    }
  }

  const contactLinkSection = (
    <details className="group border border-steel/35 bg-void/25 p-2">
      <summary className="label cursor-pointer list-none flex items-center justify-between gap-2 text-[9px] text-cyan-trav/80 hover:text-amber">
        <span>CONTACT / ROSTER LINK</span>
        <span className="ml-auto max-w-24 truncate text-[8px] text-body/45 normal-case tracking-normal">
          {selectedCharacter ? selectedCharacter.name : 'optional'}
        </span>
        <ChevronDown size={11} className="group-open:hidden" />
        <ChevronUp size={11} className="hidden group-open:block" />
      </summary>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="label w-20 flex-shrink-0 text-[9px]">ROSTER</div>
          <select
            aria-label="Roster Character"
            className="select flex-1 text-[10px] py-0.5"
            value={contactCharacterId}
            onChange={e => handleContactCharacterChange(e.target.value)}
          >
            <option value="">—</option>
            {characters.map(character => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="label w-20 flex-shrink-0 text-[9px]">CONTACT</div>
          <select
            aria-label="Roster Contact"
            className="select flex-1 text-[10px] py-0.5"
            value={contactId}
            disabled={!contactCharacterId}
            onChange={e => handleContactSelect(e.target.value)}
          >
            <option value="">{contactCharacterId ? 'New Contact' : '—'}</option>
            {contactOptions.map(option => (
              <option key={`${option.value}-${option.index}`} value={option.value}>
                {contactLabel(option.contact, `Contact ${option.index + 1}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="label w-20 flex-shrink-0 text-[9px]">GENDER/SP.</div>
          <input
            className="input flex-1 text-[10px] py-0.5"
            value={genderSpecies}
            onChange={e => { setGenderSpecies(e.target.value); setSavedMsg(null); }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="label w-20 flex-shrink-0 text-[9px]">TYPE</div>
          <input
            className="input flex-1 text-[10px] py-0.5"
            value={contactType}
            onChange={e => { setContactType(e.target.value); setSavedMsg(null); }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="label w-20 flex-shrink-0 text-[9px]">LINK</div>
          <input
            className="input flex-1 text-[10px] py-0.5"
            value={contactLink}
            onChange={e => { setContactLink(e.target.value); setSavedMsg(null); }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="label w-20 flex-shrink-0 text-[9px]">ALIVE</div>
          <select
            className="select flex-1 text-[10px] py-0.5"
            value={boolSelectValue(alive)}
            onChange={e => { setAlive(boolFromSelect(e.target.value)); setSavedMsg(null); }}
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div className="space-y-1">
          <div className="label text-[9px]">DESCRIPTION</div>
          <textarea
            aria-label="Contact Description"
            className="input min-h-14 resize-y whitespace-pre-wrap break-words px-2 py-1 text-[10px] leading-4"
            rows={2}
            value={description}
            onChange={e => { setDescription(e.target.value); setSavedMsg(null); }}
          />
        </div>
      </div>
    </details>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">

      {/* ── Left sidebar: generation controls ───────────────────────────── */}
      <div className="w-full lg:w-64 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-steel flex flex-col overflow-y-auto">
        <div className="p-3 space-y-3 flex-1">

          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="label text-amber tracking-widest text-[10px]">NPC GENERATOR</span>
            <button type="button" onClick={rerollAll}
              className="btn-steel flex items-center gap-1 text-[10px] px-2 py-1">
              <RefreshCw size={10} /> ALL
            </button>
          </div>

          {/* Profile fields */}
          <div className="space-y-1.5">
            {contactLinkSection}

            {/* Name */}
            <div className="flex items-center gap-1.5">
              <div className="label w-20 flex-shrink-0 text-[9px]">NAME</div>
              <input
                className={`input flex-1 text-[10px] py-0.5 ${nameError ? 'border-alert' : ''}`}
                value={npcName}
                onChange={e => { setNpcName(e.target.value); setNameError(false); setSavedMsg(null); }}
                placeholder="NPC name"
              />
              <button type="button" onClick={rerollName} className="btn-steel px-1.5 py-0.5 flex-shrink-0">
                <RefreshCw size={9} />
              </button>
            </div>
            {nameError && <div className="text-[10px] text-alert font-mono">Name required</div>}

            {/* Race */}
            <div className="flex items-center gap-1.5">
              <div className="label w-20 flex-shrink-0 text-[9px]">RACE</div>
              <select className="select flex-1 text-[10px] py-0.5" value={race}
                onChange={e => { setRace(e.target.value); setNpcName(randomName(e.target.value)); setSavedMsg(null); }}>
                {RACES.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
              </select>
              <button type="button" onClick={rerollRace} className="btn-steel px-1.5 py-0.5 flex-shrink-0">
                <RefreshCw size={9} />
              </button>
            </div>

            {/* Archetype */}
            <div className="flex items-start gap-1.5">
              <div className="label w-20 flex-shrink-0 pt-1.5 text-[9px]">ARCHETYPE</div>
              <textarea
                aria-label="NPC Archetype"
                className="input min-h-12 flex-1 resize-y whitespace-pre-wrap break-words px-2 py-1 text-[10px] leading-4"
                rows={2}
                value={archetype}
                onChange={e => { setArchetype(e.target.value); setSavedMsg(null); }}
              />
              <button type="button" onClick={rerollArchetype} className="btn-steel flex-shrink-0 px-1.5 py-0.5">
                <RefreshCw size={9} />
              </button>
            </div>

            {/* Quirk */}
            <div className="flex items-start gap-1.5">
              <div className="label w-20 flex-shrink-0 pt-1.5 text-[9px]">QUIRK</div>
              <textarea
                aria-label="NPC Quirk"
                className="input min-h-16 flex-1 resize-y whitespace-pre-wrap break-words px-2 py-1 text-[10px] leading-4"
                rows={3}
                value={quirk}
                onChange={e => { setQuirk(e.target.value); setSavedMsg(null); }}
              />
              <button type="button" onClick={rerollQuirk} className="btn-steel flex-shrink-0 px-1.5 py-0.5">
                <RefreshCw size={9} />
              </button>
            </div>

            {/* Experience */}
            <div className="flex items-center gap-1.5">
              <div className="label w-20 flex-shrink-0 text-[9px]">EXPERIENCE</div>
              <select className="select flex-1 text-[10px] py-0.5" value={level.id}
                onChange={e => handleLevelChange(e.target.value)}>
                {EXPERIENCE_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <button type="button" onClick={rerollLevel} className="btn-steel px-1.5 py-0.5 flex-shrink-0">
                <RefreshCw size={9} />
              </button>
            </div>
          </div>

          {/* Characteristics */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="label text-[9px]">CHARACTERISTICS</div>
              <button type="button" onClick={rerollStats}
                className="btn-steel flex items-center gap-1 text-[9px] px-1.5 py-0.5">
                <RefreshCw size={9} /> REROLL
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {CORE_STAT_KEYS.map((key, i) => (
                <button key={key} type="button"
                  title={`Roll ${CORE_STAT_LABELS[i]} check`}
                  onClick={() => openStatRoll(npcName || 'NPC', genStatValues, key, CORE_STAT_LABELS[i])}
                  className="text-center border border-steel/40 py-1 hover:border-amber hover:bg-amber/5 transition-colors">
                  <div className="label text-[8px]">{CORE_STAT_LABELS[i]}</div>
                  <div className="text-amber font-mono font-bold text-sm leading-none">{toHex(stats[i] ?? 7)}</div>
                  <div className="text-body/50 text-[8px] font-mono">
                    {statDM(stats[i] ?? 7) >= 0 ? '+' : ''}{statDM(stats[i] ?? 7)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Skills */}
          {level.skills.length > 0 && (
            <div className="space-y-1.5">
              <div className="label text-[9px]">SKILLS</div>
              <div className="flex flex-wrap gap-1">
                {level.skills.map(s => (
                  <button key={s.name} type="button"
                    onClick={() => openSkillRoll(npcName || 'NPC', genStatValues, s)}
                    className="border border-steel/50 px-1.5 py-0.5 text-[10px] font-mono text-cyan-trav hover:border-amber hover:text-amber transition-colors">
                    {s.name} {s.level}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="p-3 border-t border-steel space-y-2 flex-shrink-0">
          {saveError && (
            <div role="alert" className="text-[10px] text-alert border border-alert/40 bg-alert/10 px-2 py-1 font-mono">
              {saveError}
            </div>
          )}
          {savedMsg && (
            <div className="text-[10px] text-safe border border-safe/40 bg-safe/10 px-2 py-1 font-mono">
              {savedMsg}
            </div>
          )}
          {canEdit && (
            <button type="button" onClick={handleSave} disabled={saving}
              className="btn-amber w-full disabled:opacity-50 text-xs">
              {saving ? 'SAVING…' : 'SAVE NPC'}
            </button>
          )}
        </div>
      </div>

      {/* ── Main panel: saved NPCs ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="label border-b border-steel pb-2 flex items-center justify-between">
          <span>SAVED NPCS</span>
          <span className="text-body/40 font-normal normal-case tracking-normal text-[10px]">
            {savedEntries.length} record{savedEntries.length !== 1 ? 's' : ''}
          </span>
        </div>

        {savedEntries.length === 0 && (
          <div className="text-xs text-body/45 font-mono py-10 text-center">
            No saved NPCs or roster contacts yet.
          </div>
        )}

        {savedEntries.length > 0 && (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[68rem]">
              <thead>
                <tr className="border-b border-steel/70 bg-void/30">
                  <th className="table-header w-40">Name</th>
                  <th className="table-header w-28">Race</th>
                  <th className="table-header w-40">Archetype</th>
                  <th className="table-header w-36">Experience</th>
                  <th className="table-header w-48">Quirk</th>
                  <th className="table-header w-48">Characteristics</th>
                  <th className="table-header min-w-56">Skills</th>
                  <th className="table-header w-12 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {savedEntries.map(entry => {
                  const sv = entry.statValues;
                  const npcStats = CORE_STAT_KEYS.map(k => sv[k] ?? null);
                  const skills = entry.skills;
                  const association = entry.npc
                    ? npcAssociationLabel(entry.npc, characters)
                    : contactAssociationLabel(entry.owner, entry.contact);
                  const showContactDetails = hasContactDetails(entry, association);

                  return (
                    <Fragment key={entry.key}>
                      <tr className="table-row align-top">
                        <td className="px-3 py-2 text-xs font-mono font-bold text-bright">
                          <div className="max-w-36 truncate" title={entry.name}>{entry.name}</div>
                          <div className="mt-1 text-[9px] font-normal uppercase tracking-wider text-body/35">
                            {entry.npc ? (showContactDetails ? 'Saved NPC / Contact' : 'Saved NPC') : 'Roster Contact'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-body/75">
                          <div className="max-w-24 whitespace-normal break-words leading-5" title={entry.race ?? undefined}>
                            {entry.race ?? '—'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-body/75">
                          <div className="max-w-36 whitespace-normal break-words leading-5" title={entry.archetype ?? undefined}>{entry.archetype ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-body/75">
                          <div className="max-w-32 whitespace-normal break-words leading-5" title={entry.experience_level ?? undefined}>{entry.experience_level ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono italic text-body/60">
                          <div className="max-w-44 whitespace-normal break-words leading-5" title={entry.quirk ?? undefined}>{entry.quirk ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-bright">
                          <div className="grid w-max grid-cols-3 gap-1">
                            {CORE_STAT_KEYS.map((key, i) => {
                              const value = npcStats[i];
                              return value === null ? (
                                <div key={key} className="min-w-[2.25rem] border border-steel/20 px-1.5 py-1 text-center text-body/30">
                                  <div className="label text-[8px] leading-none">{CORE_STAT_LABELS[i]}</div>
                                  <div className="mt-0.5 text-xs font-mono font-bold leading-none">—</div>
                                </div>
                              ) : (
                                <button key={key} type="button"
                                  title={`Roll ${CORE_STAT_LABELS[i]} check`}
                                  onClick={() => openStatRoll(entry.name, sv, key, CORE_STAT_LABELS[i])}
                                  className="min-w-[2.25rem] border border-steel/40 px-1.5 py-1 text-center transition-colors hover:border-amber hover:bg-amber/5">
                                  <div className="label text-[8px] leading-none">{CORE_STAT_LABELS[i]}</div>
                                  <div className="mt-0.5 text-xs font-mono font-bold leading-none text-amber">
                                    {toHex(value)}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-bright">
                          {skills.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {skills.map(s => (
                                <button key={s.name} type="button"
                                  onClick={() => openSkillRoll(entry.name, sv, s)}
                                  className="border border-steel/40 px-2 py-0.5 text-xs font-mono text-cyan-trav transition-colors hover:border-amber hover:text-amber">
                                  {s.name} {s.level}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-body/35">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-mono text-bright">
                          {canEdit && entry.npc ? (
                            <button type="button" aria-label={`Delete ${entry.name}`}
                              onClick={() => setDeleteCandidate(entry.npc)}
                              className="inline-flex h-7 w-7 items-center justify-center text-body/35 transition-colors hover:text-alert">
                              <Trash2 size={12} />
                            </button>
                          ) : (
                            <span className="text-body/25">—</span>
                          )}
                        </td>
                      </tr>
                      {showContactDetails && (
                        <tr className="border-b border-steel/40 bg-steel/5">
                          <td colSpan={8} className="px-3 pb-3 pt-0">
                            <div className="border-l-2 border-cyan-dim/70 bg-void/40 px-3 py-2 text-xs font-mono">
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <span className="label text-[9px] text-cyan-trav/80">CONTACT</span>
                                {association && (
                                  <span>
                                    <span className="text-body/55">Roster</span>
                                    <span className="ml-1 text-cyan-trav/80">{association}</span>
                                  </span>
                                )}
                                {entry.type && (
                                  <span>
                                    <span className="text-body/55">Type</span>
                                    <span className="ml-1 text-amber">{entry.type}</span>
                                  </span>
                                )}
                                {entry.gender_species && (
                                  <span>
                                    <span className="text-body/55">Gender/Species</span>
                                    <span className="ml-1 text-body/80">{entry.gender_species}</span>
                                  </span>
                                )}
                                {entry.alive !== null && entry.alive !== undefined && (
                                  <span className={entry.alive ? 'text-safe' : 'text-alert'}>
                                    {entry.alive ? 'ALIVE' : 'DEAD'}
                                  </span>
                                )}
                                {entry.link && (
                                  <span>
                                    <span className="text-body/55">Link</span>
                                    <span className="ml-1 text-body/75">{entry.link}</span>
                                  </span>
                                )}
                              </div>
                              {entry.description && (
                                <div className="mt-1 whitespace-pre-wrap text-body/65">{entry.description}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Roll modal */}
      {rollModal && (
        <NpcRollModal
          npcName={rollModal.npcName}
          statValues={rollModal.statValues}
          target={rollModal.target}
          onClose={() => setRollModal(null)}
        />
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-npc-title"
            className="w-full max-w-sm border border-alert/50 bg-void p-4 shadow-xl shadow-black/60"
          >
            <div id="delete-npc-title" className="label text-alert">DELETE NPC</div>
            <div className="mt-3 text-sm font-mono text-bright">
              Delete {deleteCandidate.name}?
            </div>
            <div className="mt-2 text-xs font-mono leading-5 text-body/65">
              This removes the saved NPC and clears any roster contact link. Roster-only contacts are not deleted.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-steel text-xs"
                disabled={deletingNpcId === deleteCandidate.id}
                onClick={() => setDeleteCandidate(null)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="btn-danger text-xs disabled:opacity-50"
                disabled={deletingNpcId === deleteCandidate.id}
                onClick={confirmDeleteNpc}
              >
                {deletingNpcId === deleteCandidate.id ? 'DELETING...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
