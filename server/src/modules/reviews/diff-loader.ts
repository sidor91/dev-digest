import type { Container } from '../../platform/container.js';
import type { PrDetail, RepoRef, UnifiedDiff } from '@devdigest/shared';
import { parseUnifiedDiff } from '../../adapters/git/diff-parser.js';
import type { PullRow } from '../../db/rows.js';

/**
 * Review the head captured when the run was queued. The UI's cached patches
 * have no revision attached, so only Git or live GitHub data can supply the diff.
 */
export async function loadDiff(
  container: Container,
  pull: PullRow,
  repoRow: RepoRef,
): Promise<UnifiedDiff> {
  const repo = { owner: repoRow.owner, name: repoRow.name };
  try {
    const diff = await container.git.diff(repo, pull.base, pull.headSha);
    if (diff.files.length > 0) return diff;
  } catch {
    // A shallow clone may not contain the PR head or base branch.
  }

  const revision = `PR #${pull.number} at ${pull.headSha}`;
  let detail: PrDetail;
  try {
    const github = await container.githubForPullReads();
    detail = await github.getPullRequest(repo, pull.number);
  } catch (cause) {
    throw new Error(`Could not load the diff for ${revision} from GitHub. Refresh the pull request and try again.`, { cause });
  }
  if (detail.head_sha !== pull.headSha || detail.base !== pull.base) {
    throw new Error(`GitHub returned a different revision for ${revision}. Refresh the pull request and try again.`);
  }
  if (detail.files.length !== detail.files_count) {
    throw new Error(`GitHub returned an incomplete file list for ${revision}.`);
  }

  const parts: string[] = [];
  for (const f of detail.files) {
    if (!f.patch) continue;
    parts.push(`diff --git a/${f.path} b/${f.path}`);
    parts.push(`--- a/${f.path}`);
    parts.push(`+++ b/${f.path}`);
    parts.push(f.patch);
  }
  const diff = parseUnifiedDiff(parts.join('\n'));
  if (diff.files.length === 0) {
    throw new Error(`GitHub returned no reviewable patches for ${revision}.`);
  }
  return diff;
}
