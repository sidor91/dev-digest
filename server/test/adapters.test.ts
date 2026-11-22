import { describe, it, expect, vi } from 'vitest';
import { Review } from '@devdigest/shared';
import { OctokitGitHubClient } from '../src/adapters/github/octokit.js';
import {
  MockLLMProvider,
  MockGitClient,
  MockGitHubClient,
  MockCodeIndex,
  MockEmbedder,
} from '../src/adapters/mocks.js';
import { assemblePrompt } from '../src/platform/prompt.js';
import { groundFindings } from '../src/platform/grounding.js';
import { estimateCost } from '../src/adapters/llm/pricing.js';

describe('GitHub pull request snapshots', () => {
  it.each([false, true])('reads every file page and checks whether the head moved (%s)', async (headMoved) => {
    const pullUrl = 'https://api.github.com/repos/acme/widgets/pulls/42';
    let metadataReads = 0;
    vi.stubGlobal('fetch', async (input: string) => {
      const url = new URL(input);
      if (url.href === pullUrl) {
        metadataReads++;
        return Response.json({
          number: 42, title: 'Use a stable diff', state: 'open', changed_files: 2,
          head: { ref: 'feature', sha: headMoved && metadataReads > 1 ? 'new-head' : 'old-head' },
          base: { ref: 'main', sha: 'base' },
        });
      }
      if (`${url.origin}${url.pathname}` === `${pullUrl}/files`) {
        const secondPage = url.searchParams.get('page') === '2';
        return Response.json([{ filename: secondPage ? 'second.ts' : 'first.ts', additions: 1, deletions: 0 }], {
          headers: secondPage ? {} : { link: `<${pullUrl}/files?per_page=100&page=2>; rel="next"` },
        });
      }
      if (`${url.origin}${url.pathname}` === `${pullUrl}/commits`) return Response.json([]);
      return Response.json({ message: 'Unexpected request' }, { status: 404 });
    });
    try {
      const detail = new OctokitGitHubClient().getPullRequest({ owner: 'acme', name: 'widgets' }, 42);
      if (headMoved) {
        await expect(detail).rejects.toThrow('PR #42 changed while loading its files');
      } else {
        await expect(detail).resolves.toMatchObject({ head_sha: 'old-head', files: [{ path: 'first.ts' }, { path: 'second.ts' }] });
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('mock adapters (no network)', () => {
  it('MockGitClient.diff parses into hunks with new line numbers', async () => {
    const git = new MockGitClient();
    const diff = await git.diff();
    expect(diff.files[0]!.path).toBe('src/config.ts');
    expect(diff.files[0]!.hunks[0]!.newLineNumbers.length).toBeGreaterThan(0);
  });

  it('MockGitHubClient records posted reviews and opened PRs', async () => {
    const gh = new MockGitHubClient();
    await gh.postReview({ owner: 'a', name: 'b' }, 482, { body: 'x', event: 'COMMENT' });
    expect(gh.posted).toHaveLength(1);
    const { url } = await gh.openPullRequest({ owner: 'a', name: 'b' }, {
      title: 't',
      head: 'h',
      base: 'main',
      body: 'b',
    });
    expect(url).toContain('github.com');
  });

  it('MockCodeIndex + MockEmbedder return deterministic shapes', async () => {
    const ci = new MockCodeIndex();
    expect((await ci.symbols({ owner: 'a', name: 'b' }))[0]!.name).toBe('rateLimit');
    const emb = await new MockEmbedder().embed(['a', 'b']);
    expect(emb[0]!).toHaveLength(1536);
  });
});

describe('structured review pipeline (mock LLM → grounding)', () => {
  it('runs assemble → completeStructured(Review) → groundFindings end-to-end', async () => {
    // a fixture review where one finding is grounded and one is hallucinated
    const fixture = {
      verdict: 'request_changes',
      summary: 'secret key committed',
      score: 38,
      findings: [
        {
          id: 'f1',
          severity: 'CRITICAL',
          category: 'security',
          title: 'Hardcoded Stripe secret key',
          file: 'src/config.ts',
          start_line: 11,
          end_line: 11,
          rationale: 'sk_live in diff',
          confidence: 0.98,
          kind: 'finding',
        },
        {
          id: 'f-hallucinated',
          severity: 'WARNING',
          category: 'bug',
          title: 'phantom finding on a line not in the diff',
          file: 'src/config.ts',
          start_line: 999,
          end_line: 999,
          rationale: 'not real',
          confidence: 0.3,
          kind: 'finding',
        },
      ],
    };
    const llm = new MockLLMProvider('openai', { structured: fixture });
    const git = new MockGitClient();
    const diff = await git.diff();

    const { messages } = assemblePrompt({
      system: 'security reviewer',
      diff: diff.raw,
      task: 'Review PR #482',
    });
    const result = await llm.completeStructured({
      model: 'gpt-4.1',
      schema: Review,
      schemaName: 'Review',
      messages,
    });
    expect(result.data.findings).toHaveLength(2);

    const grounded = groundFindings(result.data.findings, diff);
    expect(grounded.kept).toHaveLength(1); // the real one survives
    expect(grounded.kept[0]!.id).toBe('f1');
    expect(grounded.dropped[0]!.finding.id).toBe('f-hallucinated');
    expect(llm.calls.find((c) => c.method === 'completeStructured')).toBeTruthy();
  });
});

describe('pricing / cost discipline', () => {
  it('estimates cost for known models and returns null for unknown', () => {
    expect(estimateCost('gpt-4o-mini', 1_000_000, 0)).toBeCloseTo(0.15, 5);
    expect(estimateCost('some-future-model', 1000, 1000)).toBeNull();
  });
});
