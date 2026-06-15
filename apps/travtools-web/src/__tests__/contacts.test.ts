import { describe, expect, it } from 'vitest';
import { contactFromNpc, hasContactValue, normalizeContact, npcAssociationLabel } from '../lib/contacts';
import type { NpcRecord } from '../types';

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
});
