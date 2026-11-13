import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('development backend restarts', () => {
  it('waits for complete successful builds before starting or restarting the backend', async () => {
    const children: any[] = [];
    const spawn = vi.fn((command, args) => {
      const child: any = new EventEmitter();
      Object.assign(child, { command, args, stdout: new EventEmitter(), exitCode: null, signalCode: null });
      child.kill = vi.fn(() => { child.exitCode = 0; child.emit('exit', 0); });
      children.push(child);
      return child;
    });
    const source = readFileSync(new URL('../../../scripts/dev.mjs', import.meta.url), 'utf8')
      .replace("import { execSync, spawn } from 'node:child_process';", '');
    runInNewContext(source, {
      execSync: vi.fn(), spawn, console,
      process: { env: {}, execPath: 'node', on: vi.fn(), exit: vi.fn(), stdout: { write: vi.fn() } },
    });
    const compiler = children[0];
    compiler.stdout.emit('data', Buffer.from('Found 0 errors. Watching for file '));
    expect(spawn).toHaveBeenCalledTimes(1);
    compiler.stdout.emit('data', Buffer.from('changes.\n'));
    await new Promise(resolve => setImmediate(resolve));
    const backend = children[1];
    expect(backend.args).not.toContain('--watch');
    compiler.stdout.emit('data', Buffer.from('Found 1 error. Watching for file changes.\n'));
    await new Promise(resolve => setImmediate(resolve));
    expect(backend.kill).not.toHaveBeenCalled();
    compiler.stdout.emit('data', Buffer.from('Found 0 errors. Watching for file changes.\n'));
    await new Promise(resolve => setImmediate(resolve));
    expect(backend.kill).toHaveBeenCalledWith('SIGTERM');
    expect(spawn).toHaveBeenCalledTimes(3);
  });
});
