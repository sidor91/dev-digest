import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SimpleGitClient, UnsafeClonePathError } from '../src/adapters/git/simple-git.js';

/**
 * S1 (security hardening) — the adapter's own line of defence:
 * clone paths stay inside cloneDir, and the GitHub token never lands in a
 * clone's `.git/config`.
 */

const GIT = 'git';
const run = (cwd: string, ...args: string[]) =>
  execFileSync(GIT, args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    .toString()
    .trim();

let work: string;
let cloneDir: string;
let upstream: string;

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), 'dd-git-safety-'));
  cloneDir = join(work, 'clones');
  upstream = join(work, 'upstream');
  await mkdir(upstream);
  run(upstream, 'init', '-q', '-b', 'main');
  run(upstream, 'config', 'user.email', 't@example.com');
  run(upstream, 'config', 'user.name', 't');
  await writeFile(join(upstream, 'README.md'), 'hello\n');
  run(upstream, 'add', '.');
  run(upstream, 'commit', '-q', '-m', 'init');
});

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

describe('SimpleGitClient.clonePathFor', () => {
  const client = () => new SimpleGitClient('/tmp/dd-clones');

  it('maps owner/name under cloneDir', () => {
    expect(client().clonePathFor({ owner: 'acme', name: 'widgets' })).toBe('/tmp/dd-clones/acme/widgets');
  });

  it.each([
    { owner: '..', name: 'node_modules' },
    { owner: 'acme', name: '..' },
    { owner: '.', name: 'x' },
    { owner: 'a/b', name: 'c' },
    { owner: 'acme', name: '../../etc' },
    { owner: '', name: 'x' },
    { owner: 'acme', name: 'x\0y' },
  ])('throws for %o before touching the filesystem', (ref) => {
    expect(() => client().clonePathFor(ref)).toThrow(UnsafeClonePathError);
  });
});

describe('SimpleGitClient.clone', () => {
  it('clones with a token configured, without writing the token into .git/config', async () => {
    const token = 'ghp_TESTTOKENSHOULDNEVERPERSIST';
    const client = new SimpleGitClient(cloneDir, { getToken: async () => token });
    const { path } = await client.clone({ owner: 'acme', name: 'widgets' }, upstream, { depth: 1 });

    expect(path).toBe(join(cloneDir, 'acme', 'widgets'));
    expect(await readFile(join(path, 'README.md'), 'utf8')).toBe('hello\n');
    const config = await readFile(join(path, '.git', 'config'), 'utf8');
    expect(config).not.toContain(token);
    expect(config).not.toContain('extraHeader');
    expect(config).not.toContain('Authorization');
  });

  it('scrubs a PAT from a legacy origin before fetching with Git config in the parent environment', async () => {
    const dest = join(cloneDir, 'legacy', 'repo');
    const cleanUrl = 'https://github.com/legacy/repo.git';
    await mkdir(join(cloneDir, 'legacy'), { recursive: true });
    run(work, 'clone', '-q', upstream, dest);
    run(dest, 'remote', 'set-url', 'origin', 'https://x-access-token:ghp_OLD@github.com/legacy/repo.git');
    // Fetch from the local fixture only after origin has been scrubbed.
    run(dest, 'config', `url.${upstream}.insteadOf`, cleanUrl);
    run(dest, 'config', 'protocol.https.allow', 'never');

    const client = new SimpleGitClient(cloneDir);
    vi.stubEnv('GIT_CONFIG_COUNT', '2');
    vi.stubEnv('GIT_CONFIG_KEY_0', 'color.ui');
    vi.stubEnv('GIT_CONFIG_VALUE_0', 'false');
    vi.stubEnv('GIT_CONFIG_KEY_1', 'core.quotepath');
    vi.stubEnv('GIT_CONFIG_VALUE_1', 'true');
    try {
      await client.clone({ owner: 'legacy', name: 'repo' }, cleanUrl);
    } finally {
      vi.unstubAllEnvs();
    }

    expect(run(dest, 'config', '--local', '--get', 'remote.origin.url')).toBe(cleanUrl);
  });

  it('never removes anything outside cloneDir for a traversal ref', async () => {
    const sentinel = join(work, 'sentinel');
    await mkdir(sentinel);
    const client = new SimpleGitClient(cloneDir);
    await expect(client.clone({ owner: '..', name: 'sentinel' }, upstream)).rejects.toThrow(UnsafeClonePathError);
    await expect(access(sentinel)).resolves.toBeUndefined();
  });
});
