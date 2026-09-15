// Entry point for the scheduled task: runs the collector and appends its output
// to logs/collect.log (a windowless task has nowhere else to print).
import { spawn } from 'node:child_process';
import { appendFileSync, createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logDir = path.join(root, 'logs');
const logFile = path.join(logDir, 'collect.log');
mkdirSync(logDir, { recursive: true });
appendFileSync(logFile, `\n=== ${new Date().toISOString()} scheduled collect ===\n`);

const log = createWriteStream(logFile, { flags: 'a' });
const child = spawn(
  process.execPath,
  [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'collector/collect.ts'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
child.on('exit', (code) => {
  log.end(`=== exit ${code} ===\n`, () => process.exit(code ?? 1));
});
