import type { SupabaseClient } from '@supabase/supabase-js';
import type { Character, CharacterContact, NpcRecord } from '../types';

export type ContactOwner = Pick<Character, 'id' | 'name' | 'contacts'>;
type NpcContactSyncError = { message?: string; code?: string } | null | undefined;

export interface NpcContactSyncResult {
  attempted: number;
  usedSchemaFallback: boolean;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export function makeContactId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyCharacterContact(): CharacterContact {
  return {
    id: makeContactId(),
    npc_id: null,
    name: null,
    gender_species: null,
    type: null,
    description: null,
    link: null,
    alive: null,
  };
}

export function normalizeContact(contact: Partial<CharacterContact>): CharacterContact {
  return {
    id: cleanText(contact.id) ?? makeContactId(),
    npc_id: cleanText(contact.npc_id),
    name: cleanText(contact.name),
    gender_species: cleanText(contact.gender_species),
    type: cleanText(contact.type),
    description: cleanText(contact.description),
    link: cleanText(contact.link),
    alive: contact.alive ?? null,
  };
}

export function hasContactValue(contact: Partial<CharacterContact> | null | undefined): boolean {
  if (!contact) return false;
  return Boolean(
    cleanText(contact.name) ||
    cleanText(contact.gender_species) ||
    cleanText(contact.type) ||
    cleanText(contact.description) ||
    cleanText(contact.link) ||
    cleanText(contact.npc_id) ||
    (contact.alive !== null && contact.alive !== undefined)
  );
}

export function isCompleteRosterContact(contact: Partial<CharacterContact> | null | undefined): boolean {
  const name = cleanText(contact?.name);
  if (!name) return false;
  return name.toLowerCase() !== 'yes';
}

export function contactFromNpc(npc: NpcRecord, existing: Partial<CharacterContact> = {}): CharacterContact {
  return normalizeContact({
    ...existing,
    npc_id: npc.id,
    name: npc.name,
    gender_species: npc.gender_species ?? npc.race ?? existing.gender_species ?? null,
    type: npc.type ?? existing.type ?? null,
    description: npc.description ?? npc.notes ?? npc.quirk ?? existing.description ?? null,
    link: npc.link ?? existing.link ?? null,
    alive: npc.alive ?? existing.alive ?? null,
  });
}

export function contactLabel(contact: Partial<CharacterContact>, fallback = 'Unnamed Contact'): string {
  const name = cleanText(contact.name) ?? fallback;
  const type = cleanText(contact.type);
  return type ? `${name} (${type})` : name;
}

export function findContactById(owner: ContactOwner | null | undefined, contactId: string | null | undefined): CharacterContact | null {
  if (!owner || !contactId) return null;
  return (owner.contacts ?? []).find(contact => contact.id === contactId) ?? null;
}

export function npcAssociationLabel(npc: NpcRecord, owners: ContactOwner[]): string | null {
  const owner = owners.find(character => character.id === npc.contact_character_id);
  if (owner) {
    const contact = findContactById(owner, npc.contact_id);
    return contact ? `${owner.name} / ${contactLabel(contact)}` : owner.name;
  }
  for (const candidate of owners) {
    const contact = (candidate.contacts ?? []).find(item => item.npc_id === npc.id);
    if (contact) return `${candidate.name} / ${contactLabel(contact)}`;
  }
  return null;
}

export function isMissingNpcContactColumnError(error: NpcContactSyncError): boolean {
  const message = error?.message ?? '';
  return error?.code === 'PGRST204' || /schema cache|could not find .* column/i.test(message);
}

export function errorMessage(error: unknown, fallback = 'unknown error'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; details?: unknown; code?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message.trim();
    if (typeof candidate.details === 'string' && candidate.details.trim()) return candidate.details.trim();
    if (typeof candidate.code === 'string' && candidate.code.trim()) return candidate.code.trim();
  }
  return fallback;
}

function contactNpcId(contact: CharacterContact): string | null {
  return cleanText(contact.npc_id);
}

export async function syncNpcLinksForCharacter(
  client: Pick<SupabaseClient, 'from'>,
  characterId: string,
  contacts: CharacterContact[],
  previousContacts: CharacterContact[] = [],
): Promise<NpcContactSyncResult> {
  const linkedContacts = contacts
    .map(contact => ({ contact, npcId: contactNpcId(contact) }))
    .filter((entry): entry is { contact: CharacterContact; npcId: string } => Boolean(entry.npcId));
  const linkedNpcIds = new Set(linkedContacts.map(entry => entry.npcId));
  const unlinkedContacts = previousContacts
    .map(contact => ({ contact, npcId: contactNpcId(contact) }))
    .filter((entry): entry is { contact: CharacterContact; npcId: string } => {
      if (!entry.npcId) return false;
      return !linkedNpcIds.has(entry.npcId);
    });

  if (linkedContacts.length === 0 && unlinkedContacts.length === 0) {
    return { attempted: 0, usedSchemaFallback: false };
  }

  const results = await Promise.all([
    ...linkedContacts.map(({ contact, npcId }) => {
      const patch: Record<string, unknown> = {
        gender_species: contact.gender_species,
        type: contact.type,
        description: contact.description,
        link: contact.link,
        alive: contact.alive,
        contact_character_id: characterId,
        contact_id: contact.id ?? null,
      };
      if (contact.name) patch.name = contact.name;
      return client.from('npcs').update(patch).eq('id', npcId);
    }),
    ...unlinkedContacts.map(({ npcId }) =>
      client.from('npcs').update({ contact_character_id: null, contact_id: null }).eq('id', npcId)
    ),
  ]);

  let usedSchemaFallback = false;
  for (const result of results) {
    if (!result.error) continue;
    if (isMissingNpcContactColumnError(result.error)) {
      usedSchemaFallback = true;
      continue;
    }
    throw result.error;
  }

  return { attempted: results.length, usedSchemaFallback };
}
