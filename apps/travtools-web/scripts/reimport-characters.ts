import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parseXLSXCharacter } from '../src/lib/parseXLSX';
import type { Character } from '../src/types';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '../..');
const charactersDir = path.join(repoRoot, 'docs/characters');

async function loadLocalEnv() {
  const envPath = path.join(appRoot, '.env.local');
  try {
    const text = await readFile(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim();
    }
  } catch {
    // Environment variables may already be provided by CI or the caller.
  }
}

function playerFromFilename(filename: string) {
  const base = path.basename(filename, path.extname(filename));
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : undefined;
}

function normalise(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function findExisting(parsed: { name: string; player: string | null }, existing: Character[]) {
  const byName = existing.find(char => normalise(char.name) === normalise(parsed.name));
  if (byName) return byName;

  const playerMatches = existing.filter(char => normalise(char.player) === normalise(parsed.player));
  return playerMatches.length === 1 ? playerMatches[0] : null;
}

await loadLocalEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
}

const client = createClient(url, key);
const { data: currentRows, error: loadError } = await client.from('characters').select('*');
if (loadError) throw new Error(`Could not load current roster: ${loadError.message}`);

const existing = (currentRows ?? []) as Character[];
const files = (await readdir(charactersDir)).filter(file => file.toLowerCase().endsWith('.xlsx')).sort();
const results: string[] = [];

for (const file of files) {
  const fullPath = path.join(charactersDir, file);
  const raw = await readFile(fullPath);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const parsed = parseXLSXCharacter(buffer, playerFromFilename(file));
  const match = findExisting(parsed, existing);
  const payload = {
    ...parsed,
    portrait_url: match?.portrait_url ?? parsed.portrait_url,
  };

  if (match) {
    const { data, error } = await client
      .from('characters')
      .update(payload)
      .eq('id', match.id)
      .select('id,name,player')
      .single();
    if (error) throw new Error(`Could not update ${file}: ${error.message}`);
    results.push(`updated ${data.name} [${data.player ?? 'no player'}] from ${file}`);
  } else {
    const { data, error } = await client
      .from('characters')
      .insert(payload)
      .select('id,name,player')
      .single();
    if (error) throw new Error(`Could not insert ${file}: ${error.message}`);
    results.push(`inserted ${data.name} [${data.player ?? 'no player'}] from ${file}`);
  }
}

console.log(results.join('\n'));
