import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:4175';
const output = '.local/lighthouse';
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { stdio: 'ignore', windowsHide: true });
let chrome;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* Wait for the local server. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Audit preview server did not start');
  const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  chrome = await launch({ chromePath: process.env.CHROME_PATH || (existsSync(installedChrome) ? installedChrome : chromium.executablePath()), chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'] });
  const results = [];
  for (const route of ['today', 'library', 'stats', 'settings']) {
    const result = await lighthouse(`${origin}/#${route}`, { port: chrome.port, output: ['json', 'html'], logLevel: 'error', onlyCategories: ['performance', 'accessibility'], formFactor: 'mobile', throttlingMethod: 'simulate' });
    if (!result) throw new Error('Lighthouse returned no report');
    const { lhr, report } = result;
    await writeFile(`${output}/${route}.json`, report[0]); await writeFile(`${output}/${route}.html`, report[1]);
    const row = { route, fetchTime: lhr.fetchTime, lighthouseVersion: lhr.lighthouseVersion, userAgent: lhr.environment.hostUserAgent,
      performance: Math.round(lhr.categories.performance.score * 100), accessibility: Math.round(lhr.categories.accessibility.score * 100),
      fcpMs: lhr.audits['first-contentful-paint'].numericValue, lcpMs: lhr.audits['largest-contentful-paint'].numericValue,
      tbtMs: lhr.audits['total-blocking-time'].numericValue, cls: lhr.audits['cumulative-layout-shift'].numericValue,
      settings: lhr.configSettings,
      failures: Object.values(lhr.audits).filter((audit) => audit.score !== null && audit.score < 1).map(({ id, score, title, details }) => ({ id, score, title, details })) };
    results.push(row); console.log(`${route}: Performance ${row.performance}, Accessibility ${row.accessibility}, LCP ${Math.round(row.lcpMs)}ms`);
  }
  await writeFile(`${output}/summary.json`, JSON.stringify({ date: new Date().toISOString(), node: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, results }, null, 2) + '\n');
  if (results.some((row) => row.performance < 90 || row.accessibility < 90)) process.exitCode = 1;
} finally {
  if (chrome) await chrome.kill(); server.kill();
}
