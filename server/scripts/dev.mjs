import { execSync, spawn } from 'node:child_process';

process.env.NODE_ENV = 'development';
process.env.COOKIE_SECURE = 'false';

console.log('[dev] initial build...');
execSync('node scripts/build.mjs', { stdio: 'inherit' });

const children = new Set();
const stop = () => { children.forEach((c) => { try { c.kill(); } catch {} }); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Restart only after a successful compilation, once all emitted files are ready.
const tsc = spawn('npx', ['tsc', '-w', '-p', 'tsconfig.build.json', '--preserveWatchOutput'], {
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: true,
});
children.add(tsc);

let nodeProc = null;
let outputBuffer = '';
let restartQueue = Promise.resolve();

function restartBackend() {
  restartQueue = restartQueue.then(async () => {
    if (nodeProc && nodeProc.exitCode === null && nodeProc.signalCode === null) {
      await new Promise((resolve) => {
        nodeProc.once('exit', resolve);
        nodeProc.kill('SIGTERM');
      });
    }
    nodeProc = spawn(process.execPath, ['--require', 'tsconfig-paths/register', 'dist/index.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development', COOKIE_SECURE: 'false' },
    });
    nodeProc.on('exit', (code) => {
      children.delete(nodeProc);
      if (code !== 0 && code !== null) console.error('[dev] Backend exited. Check the server error above.');
    });
    children.add(nodeProc);
  }).catch((err) => {
    console.error('[dev] Could not restart backend:', err);
    stop();
  });
}

tsc.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  outputBuffer += chunk.toString();
  const lines = outputBuffer.split(/\r?\n/);
  outputBuffer = lines.pop() || '';
  for (const line of lines) {
    if (line.includes('Found 0 errors. Watching for file changes')) restartBackend();
  }
});
