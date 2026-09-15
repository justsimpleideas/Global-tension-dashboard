import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Same cadence as the hourly GitHub Actions collector.
const COLLECT_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Keeps `npm run dev` fresh without a manual `npm run collect`: collects on
 * startup when the snapshot is stale, then hourly, and tells open tabs to
 * reload the data. Dev server only — production relies on the Actions cron.
 * Set COLLECT_ON_DEV=0 to turn it off.
 */
function autoCollect(): Plugin {
  return {
    name: 'auto-collect',
    apply: 'serve',
    configureServer(server) {
      if (process.env.COLLECT_ON_DEV === '0') return;
      const root = server.config.root;
      const newsFile = path.join(root, 'public', 'data', 'news.json');
      let running = false;

      const snapshotAge = () => {
        try {
          const { generatedAt } = JSON.parse(readFileSync(newsFile, 'utf8')) as { generatedAt: string };
          return Date.now() - Date.parse(generatedAt);
        } catch {
          return Infinity;
        }
      };

      const collect = () => {
        if (running) return;
        running = true;
        server.config.logger.info('[auto-collect] collecting news…', { timestamp: true });
        const child = spawn(
          process.execPath,
          [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'collector/collect.ts'],
          { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
        );
        child.on('exit', (code) => {
          running = false;
          if (code === 0) {
            server.config.logger.info('[auto-collect] news updated', { timestamp: true });
            server.ws.send({ type: 'custom', event: 'news:updated' });
          } else {
            server.config.logger.warn(`[auto-collect] collector exited with code ${code}`);
          }
        });
      };

      if (snapshotAge() >= COLLECT_INTERVAL_MS) collect();
      const timer = setInterval(collect, COLLECT_INTERVAL_MS);
      server.httpServer?.on('close', () => clearInterval(timer));
    },
  };
}

export default defineConfig({
  plugins: [react(), autoCollect()],
  // Relative base so the build works on GitHub Pages project sites and locally.
  base: './',
  // Fixed port: fail loudly if it's taken instead of silently moving elsewhere.
  server: { port: 5176, strictPort: true },
});
