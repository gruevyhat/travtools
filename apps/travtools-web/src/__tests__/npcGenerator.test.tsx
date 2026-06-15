import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NPCGenerator from '../components/npc/NPCGenerator';
import * as SupabaseContext from '../lib/supabaseContext';
import type { CharacterContact, NpcRecord } from '../types';

function makeNpcClient({
  npcs = [],
  contacts = [],
  insertResults,
}: {
  npcs?: NpcRecord[];
  contacts?: CharacterContact[];
  insertResults?: Array<{ data: NpcRecord | null; error: { message: string; code?: string } | null }>;
} = {}) {
  const npcOrder = vi.fn(async () => ({ data: npcs, error: null }));
  const characterOrder = vi.fn(async () => ({
    data: contacts.length > 0 ? [{ id: 'char-1', name: 'Ariadne Quinn', contacts }] : [],
    error: null,
  }));
  const selectNpcs = vi.fn(() => ({ order: npcOrder }));
  const selectCharacters = vi.fn(() => ({ order: characterOrder }));
  const insertedNpc: NpcRecord = {
    id: 'npc-1',
    name: 'Edited NPC',
    race: 'Human',
    gender_species: null,
    type: null,
    description: null,
    link: null,
    alive: null,
    contact_character_id: null,
    contact_id: null,
    archetype: 'Custom long-form fixer and information broker',
    quirk: 'Speaks in long, wrapped sentences that should remain readable.',
    experience_level: 'Experienced',
    str: 7,
    dex: 7,
    end_stat: 7,
    int_stat: 7,
    edu: 7,
    soc: 7,
    skills: [],
    notes: 'Speaks in long, wrapped sentences that should remain readable.',
    created_at: '2026-06-14T00:00:00Z',
  };
  let insertResultIndex = 0;
  const single = vi.fn(async () => insertResults?.[insertResultIndex++] ?? {
    data: insertedNpc,
    error: null,
  });
  const selectInserted = vi.fn(() => ({ single }));
  const insert = vi.fn((payload: Record<string, unknown>) => {
    void payload;
    return { select: selectInserted };
  });
  const deleteEq = vi.fn(async () => ({ error: null }));
  const deleteRow = vi.fn(() => ({ eq: deleteEq }));

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === 'characters') return { select: selectCharacters };
        return { select: selectNpcs, insert, delete: deleteRow };
      }),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
    insert,
    deleteRow,
    deleteEq,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NPCGenerator', () => {
  it('saves edited archetype and quirk text without making every NPC a contact', async () => {
    const mock = makeNpcClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
      session: null,
      user: null,
      canEdit: true,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(<NPCGenerator />);

    fireEvent.change(screen.getByLabelText('NPC Archetype'), {
      target: { value: 'Custom long-form fixer and information broker' },
    });
    fireEvent.change(screen.getByLabelText('NPC Quirk'), {
      target: { value: 'Speaks in long, wrapped sentences that should remain readable.' },
    });
    fireEvent.change(screen.getByPlaceholderText('NPC name'), {
      target: { value: 'Edited NPC' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'SAVE NPC' }));

    await waitFor(() => expect(mock.insert).toHaveBeenCalledTimes(1));
    const payload = mock.insert.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: 'Edited NPC',
      archetype: 'Custom long-form fixer and information broker',
      quirk: 'Speaks in long, wrapped sentences that should remain readable.',
      notes: 'Speaks in long, wrapped sentences that should remain readable.',
    });
    expect(payload).not.toHaveProperty('type');
    expect(payload).not.toHaveProperty('description');
    expect(payload).not.toHaveProperty('alive');
  });

  it('retries a core NPC save when contact columns are missing from Supabase schema cache', async () => {
    const mock = makeNpcClient({
      insertResults: [
        {
          data: null,
          error: {
            code: 'PGRST204',
            message: "Could not find the 'alive' column of 'npcs' in the schema cache",
          },
        },
        {
          data: {
            id: 'npc-1',
            name: 'Edited NPC',
            race: 'Human',
            gender_species: null,
            type: null,
            description: null,
            link: null,
            alive: null,
            contact_character_id: null,
            contact_id: null,
            archetype: 'Broker',
            quirk: 'Quiet',
            experience_level: 'Experienced',
            str: 7,
            dex: 7,
            end_stat: 7,
            int_stat: 7,
            edu: 7,
            soc: 7,
            skills: [],
            notes: 'Quiet',
            created_at: '2026-06-14T00:00:00Z',
          },
          error: null,
        },
      ],
    });
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
      session: null,
      user: null,
      canEdit: true,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(<NPCGenerator />);

    fireEvent.click(screen.getByText('CONTACT / ROSTER LINK'));
    fireEvent.change(screen.getByLabelText('Contact Description'), {
      target: { value: 'Port fixer' },
    });
    fireEvent.change(screen.getByPlaceholderText('NPC name'), {
      target: { value: 'Edited NPC' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'SAVE NPC' }));

    await waitFor(() => expect(mock.insert).toHaveBeenCalledTimes(2));
    expect(mock.insert.mock.calls[0][0]).toMatchObject({
      name: 'Edited NPC',
      description: 'Port fixer',
      alive: null,
    });
    expect(mock.insert.mock.calls[1][0]).toMatchObject({
      name: 'Edited NPC',
    });
    expect(mock.insert.mock.calls[1][0]).not.toHaveProperty('description');
    expect(mock.insert.mock.calls[1][0]).not.toHaveProperty('alive');
    expect(await screen.findByText(/Contact fields were skipped/)).toBeTruthy();
  });

  it('shows roster contacts in the saved NPC list', async () => {
    const mock = makeNpcClient({
      contacts: [{
        id: 'contact-1',
        npc_id: null,
        name: 'Vlen',
        gender_species: 'M Human',
        type: 'Contact',
        description: 'Port fixer',
        link: 'Drinax',
        alive: true,
      }, {
        id: 'contact-2',
        npc_id: null,
        name: 'Yes',
        gender_species: null,
        type: 'Mother',
        description: null,
        link: null,
        alive: true,
      }, {
        id: 'contact-3',
        npc_id: null,
        name: null,
        gender_species: null,
        type: 'Mentor',
        description: null,
        link: null,
        alive: true,
      }],
    });
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
      session: null,
      user: null,
      canEdit: true,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(<NPCGenerator />);

    expect(await screen.findByText('Vlen')).toBeTruthy();
    expect(screen.getByText('Roster Contact')).toBeTruthy();
    expect(screen.getByText('Ariadne Quinn / Vlen (Contact)')).toBeTruthy();
    const contactDescription = screen.getByText('Port fixer');
    expect(contactDescription.closest('td')?.getAttribute('colspan')).toBe('8');
    expect(within(screen.getByRole('table')).queryByRole('columnheader', { name: 'Contact' })).toBeNull();
    expect(screen.queryByText('Ariadne Quinn / Yes (Mother)')).toBeNull();
    expect(screen.queryByText('Ariadne Quinn / Unnamed Contact (Mentor)')).toBeNull();
  });

  it('requires confirmation before deleting a saved NPC', async () => {
    const mock = makeNpcClient({
      npcs: [{
        id: 'npc-delete',
        name: 'Delete Candidate',
        race: 'Human',
        gender_species: null,
        type: null,
        description: null,
        link: null,
        alive: null,
        contact_character_id: null,
        contact_id: null,
        archetype: 'Broker',
        quirk: 'Quiet',
        experience_level: 'Experienced',
        str: 7,
        dex: 7,
        end_stat: 7,
        int_stat: 7,
        edu: 7,
        soc: 7,
        skills: [],
        notes: 'Quiet',
        created_at: '2026-06-14T00:00:00Z',
      }],
    });
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
      session: null,
      user: null,
      canEdit: true,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(<NPCGenerator />);

    expect(await screen.findByText('Delete Candidate')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Delete Candidate' }));

    expect(screen.getByRole('dialog', { name: 'DELETE NPC' })).toBeTruthy();
    expect(screen.getByText('Delete Delete Candidate?')).toBeTruthy();
    expect(mock.deleteRow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    expect(screen.queryByRole('dialog', { name: 'DELETE NPC' })).toBeNull();
    expect(screen.getByText('Delete Candidate')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Delete Candidate' }));
    fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));

    await waitFor(() => expect(mock.deleteRow).toHaveBeenCalledTimes(1));
    expect(mock.deleteEq).toHaveBeenCalledWith('id', 'npc-delete');
    expect(screen.queryByText('Delete Candidate')).toBeNull();
  });
});
