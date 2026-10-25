import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from '@playwright/test';

function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true, ...options });
    child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Command exited ${code}: ${args.join(' ')}`)));
  });
}
const base = '/blind75-recall/';
const directory = '.local/pages-dist';
await run(['node_modules/vite/bin/vite.js', 'build', '--outDir', directory], { env: { ...process.env, BASE_PATH: base } });
await run(['scripts/check-bundle.mjs', directory]);
const origin = 'http://127.0.0.1:4177';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', directory, '--base', base, '--host', '127.0.0.1', '--port', '4177', '--strictPort'], { stdio: 'ignore', windowsHide: true });
const results = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin + base)).ok) { ready = true; break; } } catch { /* Wait for the server. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Subpath preview did not start');
  for (const [name, browserType] of Object.entries({ chromium, webkit })) {
    const browser = await browserType.launch();
    try {
      const context = await browser.newContext(); const page = await context.newPage(); const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}${base}#library`);
      const tick = page.getByRole('checkbox', { name: 'Completed: Contains Duplicate', exact: true }); await tick.waitFor(); await tick.check();
      await page.getByRole('button', { name: 'Undo', exact: true }).waitFor();
      const manifest = await page.evaluate(async () => {
        const href = document.querySelector('link[rel=manifest]').href;
        return (await fetch(href)).json();
      });
      if (manifest.start_url !== base || manifest.scope !== base || manifest.id !== base || manifest.display !== 'standalone' || manifest.orientation !== 'any') throw new Error('Subpath manifest mismatch');
      for (const icon of manifest.icons) if (!(await page.request.get(origin + icon.src)).ok()) throw new Error(`Missing icon: ${icon.src}`);
      const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
      if (scope !== origin + base) throw new Error(`Unexpected worker scope: ${scope}`);
      await page.reload(); await tick.waitFor();
      let installability = null;
      if (name === 'chromium') {
        const cdp = await context.newCDPSession(page); await cdp.send('Page.enable');
        installability = await cdp.send('Page.getInstallabilityErrors');
        if (installability.installabilityErrors.length) throw new Error(JSON.stringify(installability));
      }
      await context.setOffline(true); await page.reload(); await tick.waitFor();
      if (!await tick.isChecked()) throw new Error('Offline subpath membership was not preserved');
      for (const route of ['Today', 'Stats']) { await page.getByRole('link', { name: route, exact: true }).click(); await page.getByRole('heading', { name: route, exact: true }).waitFor(); }
      await page.getByRole('link', { name: 'Today', exact: true }).click(); await page.getByRole('link', { name: 'Settings', exact: true }).click(); await page.getByLabel('Daily goal', { exact: true }).waitFor();
      if (errors.length) throw new Error(errors.join('\n'));
      results.push({ browser: name, version: browser.version(), scope, manifest: 'PASS', offlineReloadAndRoutes: 'PASS', installability });
      console.log(`${name}: subpath assets, manifest, worker, persisted deck and offline navigation passed`);
    } finally { await browser.close(); }
  }
  await mkdir('.local', { recursive: true }); await writeFile('.local/deploy-verification.json', JSON.stringify({ date: new Date().toISOString(), base, results }, null, 2) + '\n');
} finally { server.kill(); }
