import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const outputDir = new URL('../test-results/e2e/', import.meta.url);
const tinyPortraitPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
const smokeCharacter = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Smoke Traveller',
  player: 'QA',
  portrait_url: null,
  str: 9,
  dex: 11,
  end_stat: 11,
  int_stat: 8,
  edu: 10,
  soc: 4,
  psi: 12,
  chr: 7,
  mor: 8,
  lck: 9,
  str_cur: null,
  dex_cur: null,
  end_cur: null,
  psi_cur: null,
  temp_mods: {},
  profile_details: { species: 'Human', age: '34', gender: 'Male', height: "6'1\"", weight: '210' },
  homeworld_details: {
    name: 'Regina',
    sector: 'Spinward Marches',
    subsector: 'Regina',
    location: '1910',
    uwp: 'A788899-C',
    bases: 'NS',
    trade_codes: 'Ri Pa Ph',
    travel_zone: 'A',
    gas_giant: 'G',
  },
  lifepath: [
    {
      term: 1,
      career: 'Scout',
      assignment: 'Detached Duty',
      survived: true,
      commissioned: false,
      advanced: true,
      rank: '1',
      notes: 'Found a patron and learned Pilot.',
    },
  ],
  armour: [{ worn: true, name: 'Cloth Armour', protection: 8, radiation: 0, required_skill: null }],
  augments: [],
  personal_equipment: [{ quantity: 1, name: 'Medkit', notes: 'Field kit', tech_level: 10, mass: 1, cost: 500 }],
  finances: { cash_on_hand: 1200, yearly_pension: 0, monthly_living_cost: 1500, total_debts: 0 },
  contacts: [{ name: 'Mora', gender_species: 'Human', type: 'Ally', description: 'Scout contact', link: null, alive: true }],
  background: { short_term_goals: 'Find the lost courier', hobbies: 'Ship maintenance' },
  career: 'Scout',
  rank: 'Detached Duty',
  homeworld: 'Regina',
  skills: [{ name: 'Pilot', level: 1 }],
  psionic_talents: [],
  weapons: [{ name: 'Unarmed', skill: 'Melee (Unarmed)', range: 'Melee', damage: '1D+STR DM', traits: '' }],
  notes: null,
  created_at: new Date(0).toISOString(),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') reject(new Error('Could not allocate port'));
        else resolve(address.port);
      });
    });
  });
}

async function waitForServer(url, server, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited early with code ${server.exitCode}:\n${output.join('')}`);
    }

    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return;
    } catch {
      // Vite is still starting.
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}\n${output.join('')}`);
}

function startServer(port) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const server = spawn(command, [
    'run',
    'dev',
    '--',
    '--host',
    host,
    '--port',
    String(port),
    '--strictPort',
  ], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = [];
  server.stdout.on('data', chunk => output.push(chunk.toString()));
  server.stderr.on('data', chunk => output.push(chunk.toString()));
  return { server, output };
}

async function installSupabaseMock(page) {
  let nextId = 2;
  const stores = {
    characters: [clone(smokeCharacter)],
    trade_deals: [],
    inventory_items: [],
    roll_log: [],
    ships: [],
  };

  function filterIds(url) {
    const id = url.searchParams.get('id');
    if (!id) return null;
    if (id.startsWith('eq.')) return [id.slice(3)];
    if (id.startsWith('in.(') && id.endsWith(')')) return id.slice(4, -1).split(',').filter(Boolean);
    return null;
  }

  function responseBody(request, value) {
    const accept = request.headers().accept ?? '';
    if (accept.includes('application/vnd.pgrst.object+json') && Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value;
  }

  function withDefaults(table, row) {
    const now = new Date(0).toISOString();
    return {
      id: `${table}-${nextId++}`,
      created_at: now,
      ...(table === 'trade_deals' ? { updated_at: now } : {}),
      ...row,
    };
  }

  await page.route('https://*/rest/v1/**', async route => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();
    const store = table ? stores[table] : undefined;
    let body = [];

    if (store) {
      if (method === 'GET') {
        body = store;
      } else if (method === 'POST') {
        const payload = JSON.parse(request.postData() || '{}');
        const rows = Array.isArray(payload) ? payload.map(row => withDefaults(table, row)) : [withDefaults(table, payload)];
        store.push(...rows);
        body = rows;
      } else if (method === 'PATCH') {
        const ids = filterIds(url);
        const payload = JSON.parse(request.postData() || '{}');
        const updated = [];
        for (let i = 0; i < store.length; i += 1) {
          if (!ids || ids.includes(store[i].id)) {
            store[i] = { ...store[i], ...payload };
            updated.push(store[i]);
          }
        }
        body = updated;
      } else if (method === 'DELETE') {
        const ids = filterIds(url);
        if (ids) {
          for (const id of ids) {
            const index = store.findIndex(row => row.id === id);
            if (index >= 0) store.splice(index, 1);
          }
        }
        body = [];
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: JSON.stringify(responseBody(request, body)),
    });
  });

  await page.route('https://*/storage/v1/object/**', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: tinyPortraitPng,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'ship-schematics/smoke-ship.png' }),
    });
  });
}

function collectPageErrors(page) {
  const errors = [];

  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const text = message.text();
    if (message.type() !== 'error') return;
    if (text.includes('WebSocket')) return;
    if (text.includes('Failed to load resource')) return;
    if (text.includes('net::ERR')) return;
    errors.push(text);
  });

  return errors;
}

async function readBody(page) {
  return page.locator('body').innerText({ timeout: 10_000 });
}

async function checkLanding(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = collectPageErrors(page);

  await installSupabaseMock(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);

  const body = await readBody(page);
  await page.screenshot({ path: new URL('landing.png', outputDir).pathname, fullPage: false });
  await context.close();

  const setup = body.includes('SETUP REQUIRED') && body.includes('CONNECT');
  const configured = body.includes('TRAVTOOLS') && (body.includes('SHIPS') || body.includes('ONLINE'));
  return { route: 'landing', ok: setup || configured, mode: setup ? 'setup' : 'configured', errors };
}

async function checkConfiguredRoute(browser, baseUrl, route, expected) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.setItem('tt_sb_url', 'https://smoke.supabase.co');
    localStorage.setItem('tt_sb_key', 'smoke-key');
  });

  const page = await context.newPage();
  const errors = collectPageErrors(page);

  await installSupabaseMock(page);
  await page.goto(`${baseUrl}#/${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_000);

  const body = await readBody(page);
  if (route === 'roster') {
    await page.screenshot({ path: new URL('roster.png', outputDir).pathname, fullPage: false });
  }
  await context.close();

  return {
    route,
    ok: body.includes('TRAVTOOLS') && body.includes('ONLINE') && body.includes(expected),
    errors,
  };
}

async function checkRosterInteractions(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.setItem('tt_sb_url', 'https://smoke.supabase.co');
    localStorage.setItem('tt_sb_key', 'smoke-key');
  });

  const page = await context.newPage();
  const errors = collectPageErrors(page);

  await installSupabaseMock(page);
  await page.goto(`${baseUrl}#/roster`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_000);

  const desktopRoster = page.locator('.hidden.lg\\:flex').filter({
    has: page.getByRole('button', { name: 'Smoke Traveller 9BB8A4-C789' }),
  });

  await desktopRoster.getByRole('button', { name: 'Smoke Traveller 9BB8A4-C789' }).click();
  await desktopRoster.getByLabel('Character actions').click();
  await page.getByText('EDIT', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await page.keyboard.press('Escape');

  const body = await readBody(page);
  const hasExpandedUpp = body.includes('9BB8A4-C789');
  const hasPortraitSlot = body.includes('PORTRAIT');
  const hasImportedDetails = body.includes('PROFILE')
    && body.includes('HOMEWORLD')
    && body.includes('LIFEPATH')
    && body.includes('Cloth Armour')
    && body.includes('Scout contact');

  await desktopRoster.getByLabel('Portrait file for Smoke Traveller').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: tinyPortraitPng,
  });
  await desktopRoster.locator('img[alt="Smoke Traveller portrait"]').waitFor({ state: 'visible', timeout: 5_000 });

  await desktopRoster.getByRole('button', { name: 'TEMP MODS' }).click();
  await desktopRoster.getByLabel('Increase DEX temporary modifier').click();
  const rosterAfterTempMod = await desktopRoster.innerText();
  if (rosterAfterTempMod.includes('base B +1')) {
    throw new Error('Temporary modifier annotation leaked into the attribute tile');
  }
  await desktopRoster.getByRole('button', { name: 'Roll DEX check' }).click();
  const dexRollText = await page.locator('.fixed .panel').innerText({ timeout: 5_000 });
  if (!dexRollText.includes('Char DM: +2')) {
    throw new Error(`Temporary DEX modifier did not affect roll DM:\n${dexRollText}`);
  }
  await page.keyboard.press('Escape');

  await desktopRoster.getByRole('button', { name: 'UNKNOWN' }).click();
  const customRollPanel = page.locator('.fixed .panel');
  await replaceByTyping(customRollPanel.getByPlaceholder('e.g. Pilot (Small Craft)'), 'Astrogation');
  await customRollPanel.getByLabel('Mod').type('+2');
  const typedValues = {
    label: await customRollPanel.getByPlaceholder('e.g. Pilot (Small Craft)').inputValue(),
    bonus: await customRollPanel.getByLabel('Mod').inputValue(),
  };
  if (typedValues.label !== 'Astrogation' || typedValues.bonus !== '+2') {
    throw new Error(`Roll tool input lost characters: ${JSON.stringify(typedValues)}`);
  }
  await customRollPanel.getByRole('button', { name: 'ROLL 2D6' }).click();
  await customRollPanel.getByText('Mod +2', { exact: false }).waitFor({ state: 'visible', timeout: 5_000 });
  await page.screenshot({ path: new URL('roster.png', outputDir).pathname, fullPage: false });
  await context.close();

  return {
    route: 'roster-interactions',
    ok: hasExpandedUpp && hasPortraitSlot && hasImportedDetails,
    errors,
  };
}

async function checkShipInteractions(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.setItem('tt_sb_url', 'https://smoke.supabase.co');
    localStorage.setItem('tt_sb_key', 'smoke-key');
  });

  const page = await context.newPage();
  const errors = collectPageErrors(page);

  await installSupabaseMock(page);
  await page.goto(`${baseUrl}#/ships`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_000);

  await page.getByLabel('Add ship').click();
  await page.getByRole('button').filter({ hasText: 'Type-S' }).click();
  await page.getByLabel('Type-S Scout/Courier deck plan').waitFor({ state: 'visible', timeout: 5_000 });

  await page.getByRole('button', { name: 'LABEL' }).click();
  await page.getByLabel('Type-S Scout/Courier deck plan').click({ position: { x: 200, y: 120 } });
  await page.getByPlaceholder('Label text...').type('Bridge Watch');
  await page.getByRole('button', { name: 'SAVE' }).click();
  await page.getByLabel('Annotation Bridge Watch').waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByLabel('Annotation Bridge Watch').click();
  await page.getByLabel('Delete annotation Bridge Watch').click();
  await page.getByLabel('Annotation Bridge Watch').waitFor({ state: 'hidden', timeout: 5_000 });

  await page.getByLabel('Ship Notes').fill('Crew cabins assigned.');
  await page.getByLabel('Ship Notes').blur();

  await page.getByLabel('Add ship').click();
  await page.getByPlaceholder('Ship name').fill('Smoke Custom');
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'ship.png',
    mimeType: 'image/png',
    buffer: tinyPortraitPng,
  });
  await page.locator('aside').getByText('Smoke Custom', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('img[alt="Smoke Custom"]').waitFor({ state: 'visible', timeout: 5_000 });

  await page.screenshot({ path: new URL('ships.png', outputDir).pathname, fullPage: false });
  await context.close();

  return {
    route: 'ships-interactions',
    ok: true,
    errors,
  };
}

async function checkGlobalTools(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.setItem('tt_sb_url', 'https://smoke.supabase.co');
    localStorage.setItem('tt_sb_key', 'smoke-key');
  });

  const page = await context.newPage();
  const errors = collectPageErrors(page);

  await installSupabaseMock(page);
  await page.goto(`${baseUrl}#/ships`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TOOLS' }).click();
  await replaceByTyping(page.getByLabel('CHECK LABEL'), 'Standalone Astrogation');
  await replaceByTyping(page.getByLabel('Standalone Modifier'), '+2');
  await page.getByRole('button', { name: 'ROLL 2D6' }).click();
  await page.getByText('Logged to Roll Log').waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByLabel('Close session tools').click();

  await page.goto(`${baseUrl}#/log`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Standalone Astrogation CHECK').waitFor({ state: 'visible', timeout: 5_000 });

  await context.close();

  return {
    route: 'global-tools',
    ok: true,
    errors,
  };
}

async function replaceByTyping(locator, value) {
  await locator.press('ControlOrMeta+A');
  await locator.type(value);
  const actual = await locator.inputValue();
  if (actual !== value) {
    throw new Error(`Input lost characters: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`);
  }
}

async function checkFormTyping(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.setItem('tt_sb_url', 'https://smoke.supabase.co');
    localStorage.setItem('tt_sb_key', 'smoke-key');
  });

  const page = await context.newPage();
  const errors = collectPageErrors(page);

  await installSupabaseMock(page);

  await page.goto(`${baseUrl}#/roster`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_000);
  const desktopRoster = page.locator('.hidden.lg\\:flex').filter({
    has: page.getByRole('button', { name: 'Smoke Traveller 9BB8A4-C789' }),
  });
  await desktopRoster.getByRole('button', { name: 'Smoke Traveller 9BB8A4-C789' }).click();
  await desktopRoster.getByLabel('Character actions').click();
  await page.getByRole('button', { name: 'EDIT' }).click();
  await replaceByTyping(desktopRoster.getByLabel('Character Name'), 'Smoke Traveller Prime');
  await replaceByTyping(desktopRoster.locator('#character-str'), '12');
  await replaceByTyping(desktopRoster.getByLabel('Skills (e.g. Medic-2, Gun Combat (Slug)-3, Recon-1)'), 'Pilot-2, Astrogation-1');
  await desktopRoster.getByRole('button', { name: 'UPDATE' }).click();
  const updatedRoster = page.locator('.hidden.lg\\:flex').filter({
    has: page.getByRole('button', { name: 'Smoke Traveller Prime CBB8A4-C789' }),
  });
  await updatedRoster.getByRole('button', { name: 'Smoke Traveller Prime CBB8A4-C789' }).waitFor({ state: 'visible', timeout: 5_000 });
  const rosterBody = await updatedRoster.innerText();
  if (!rosterBody.includes('Smoke Traveller Prime') || !rosterBody.includes('CBB8A4-C789')) {
    throw new Error('Edited character did not refresh in the roster display');
  }

  await page.goto(`${baseUrl}#/trade`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'NEW DEAL' }).click();
  await replaceByTyping(page.getByLabel('Item / Cargo'), 'Advanced Electronics');
  await replaceByTyping(page.getByLabel('Buy Price (Cr/unit)'), '1000');
  await replaceByTyping(page.getByLabel('World Bought'), 'Regina');
  await replaceByTyping(page.getByLabel('Notes'), 'Multi parsec arbitrage');
  await page.getByRole('button', { name: 'SAVE' }).click();
  await page.getByText('Advanced Electronics').waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByLabel('World Filter').fill('Regina');
  await page.getByText('Advanced Electronics').waitFor({ state: 'visible', timeout: 5_000 });
  const tradeRow = page.locator('tr', { hasText: 'Advanced Electronics' });
  await tradeRow.getByRole('button', { name: 'SELL' }).click();
  await tradeRow.getByPlaceholder('Sell price').type('1500');
  await tradeRow.getByPlaceholder('Sell price').press('Enter');
  await tradeRow.getByText('+Cr 500').waitFor({ state: 'visible', timeout: 5_000 });

  await page.goto(`${baseUrl}#/inventory`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'ADD ITEM' }).click();
  await replaceByTyping(page.getByLabel('Item Name'), 'Advanced Medkit');
  await replaceByTyping(page.getByLabel('Owner'), 'Captain Reyes');
  await replaceByTyping(page.getByLabel('Location'), 'Ship Locker');
  await page.getByRole('button', { name: 'SAVE' }).click();
  await page.getByText('Advanced Medkit').waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByLabel('Increase Advanced Medkit quantity').click();
  await page.getByLabel('Select Advanced Medkit').check();
  await page.getByRole('button', { name: 'DELETE 1' }).waitFor({ state: 'visible', timeout: 5_000 });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'DELETE 1' }).click();
  await page.getByText('Advanced Medkit').waitFor({ state: 'hidden', timeout: 5_000 });

  await context.close();

  return {
    route: 'form-typing',
    ok: true,
    errors,
  };
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const port = await getFreePort();
  const baseUrl = `http://${host}:${port}/travtools/`;
  const { server, output } = startServer(port);
  let browser;

  try {
    await waitForServer(baseUrl, server, output);

    browser = await chromium.launch({ headless: true });
    const results = [
      await checkLanding(browser, baseUrl),
      await checkShipInteractions(browser, baseUrl),
      await checkGlobalTools(browser, baseUrl),
      await checkRosterInteractions(browser, baseUrl),
      await checkFormTyping(browser, baseUrl),
      await checkConfiguredRoute(browser, baseUrl, 'log', 'ROLL LOG'),
    ];

    console.log(JSON.stringify(results, null, 2));

    const failed = results.filter(result => !result.ok || result.errors.length > 0);
    if (failed.length > 0) {
      throw new Error(`Smoke test failed for: ${failed.map(result => result.route).join(', ')}`);
    }
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
