import { describe, expect, it, vi } from 'vitest';
import {
  contactFromNpc,
  errorMessage,
  hasContactValue,
  isMissingNpcContactColumnError,
  normalizeContact,
  npcAssociationLabel,
  syncNpcLinksForCharacter,
} from '../lib/contacts';
import type { CharacterContact, NpcRecord } from '../types';

const npc: NpcRecord = {
  id: 'npc-1',
  name: 'Vlen',
  race: 'Human',
  gender_species: 'M Human',
  type: 'Contact',
  description: 'Port fixer',
  link: 'Drinax',
  alive: true,
  contact_character_id: 'char-1',
  contact_id: 'contact-1',
  archetype: 'Fixer',
  quirk: 'Always has a better route',
  experience_level: 'Experienced',
  str: 7,
  dex: 8,
  end_stat: 7,
  int_stat: 10,
  edu: 9,
  soc: 8,
  skills: [{ name: 'Broker', level: 1 }],
  notes: 'Always has a better route',
  created_at: '2026-06-15T00:00:00Z',
};

function makeNpcSyncClient(results: Array<{ error: { message: string; code?: string } | null }> = []) {
  const updates: Array<{ table: string; patch: Record<string, unknown>; column: string; value: string }> = [];
  let resultIndex = 0;
  const update = vi.fn((patch: Record<string, unknown>) => ({
    eq: vi.fn(async (column: string, value: string) => {
      updates.push({ table: 'npcs', patch, column, value });
      return results[resultIndex++] ?? { error: null };
    }),
  }));
  const from = vi.fn((_table: string) => ({ update }));
  return { client: { from }, update, updates };
}

describe('contact helpers', () => {
  it('normalizes contacts with stable IDs and trimmed shared fields', () => {
    const contact = normalizeContact({
      id: ' contact-1 ',
      npc_id: ' npc-1 ',
      name: ' Vlen ',
      gender_species: ' M Human ',
      type: ' Contact ',
      description: ' Port fixer ',
      link: ' Drinax ',
      alive: true,
    });

    expect(contact).toMatchObject({
      id: 'contact-1',
      npc_id: 'npc-1',
      name: 'Vlen',
      gender_species: 'M Human',
      type: 'Contact',
      description: 'Port fixer',
      link: 'Drinax',
      alive: true,
    });
    expect(hasContactValue(contact)).toBe(true);
  });

  it('copies unified contact fields from an NPC record', () => {
    const contact = contactFromNpc(npc, { id: 'existing-contact' });

    expect(contact).toMatchObject({
      id: 'existing-contact',
      npc_id: 'npc-1',
      name: 'Vlen',
      gender_species: 'M Human',
      type: 'Contact',
      description: 'Port fixer',
      link: 'Drinax',
      alive: true,
    });
  });

  it('finds NPC associations from roster contacts when the NPC has no back-reference', () => {
    expect(npcAssociationLabel({ ...npc, contact_character_id: null, contact_id: null }, [
      {
        id: 'char-1',
        name: 'Ariadne Quinn',
        contacts: [{ ...contactFromNpc(npc), id: 'contact-1' }],
      },
    ])).toBe('Ariadne Quinn / Vlen (Contact)');
  });

  it('syncs linked and unlinked roster contacts back to NPC records', async () => {
    const mock = makeNpcSyncClient();
    const linkedContact: CharacterContact = {
      id: 'contact-1',
      npc_id: 'npc-1',
      name: 'Vlen',
      gender_species: 'M Human',
      type: 'Contact',
      description: 'Port fixer',
      link: 'Drinax',
      alive: true,
    };
    const removedContact: CharacterContact = {
      ...linkedContact,
      id: 'contact-2',
      npc_id: 'npc-2',
      name: 'Old Link',
    };

    const result = await syncNpcLinksForCharacter(
      mock.client as never,
      'char-1',
      [linkedContact],
      [linkedContact, removedContact],
    );

    expect(result).toEqual({ attempted: 2, usedSchemaFallback: false });
    expect(mock.updates[0]).toMatchObject({
      column: 'id',
      value: 'npc-1',
      patch: {
        name: 'Vlen',
        gender_species: 'M Human',
        type: 'Contact',
        description: 'Port fixer',
        link: 'Drinax',
        alive: true,
        contact_character_id: 'char-1',
        contact_id: 'contact-1',
      },
    });
    expect(mock.updates[1]).toMatchObject({
      column: 'id',
      value: 'npc-2',
      patch: {
        contact_character_id: null,
        contact_id: null,
      },
    });
  });

  it('treats missing NPC contact columns as a recoverable sync fallback', async () => {
    const schemaError = {
      code: 'PGRST204',
      message: "Could not find the 'alive' column of 'npcs' in the schema cache",
    };
    const mock = makeNpcSyncClient([{ error: schemaError }]);
    const contact = contactFromNpc(npc);

    await expect(syncNpcLinksForCharacter(mock.client as never, 'char-1', [contact]))
      .resolves.toEqual({ attempted: 1, usedSchemaFallback: true });
    expect(isMissingNpcContactColumnError(schemaError)).toBe(true);
  });

  it('throws real NPC link sync failures with readable Supabase messages', async () => {
    const permissionError = { code: '42501', message: 'permission denied for table npcs' };
    const mock = makeNpcSyncClient([{ error: permissionError }]);

    await expect(syncNpcLinksForCharacter(mock.client as never, 'char-1', [contactFromNpc(npc)]))
      .rejects.toMatchObject(permissionError);
    expect(errorMessage(permissionError)).toBe('permission denied for table npcs');
  });
});
