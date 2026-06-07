import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const outputDir = new URL('../test-results/e2e/', import.meta.url);

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
  await page.route('https://*/rest/v1/**', async route => {
    const request = route.request();
    const method = request.method();
    const body = method === 'POST' ? [{}] : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: JSON.stringify(body),
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
      await checkConfiguredRoute(browser, baseUrl, 'ships', 'SHIPS'),
      await checkConfiguredRoute(browser, baseUrl, 'roster', 'ROSTER'),
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
