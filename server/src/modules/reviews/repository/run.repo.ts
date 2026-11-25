import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import type { AgentRow } from '../../../db/rows.js';
import * as t from '../../../db/schema.js';
import type { RunSummary, RunTrace } from '@devdigest/shared';

// ---- in-flight / history --------------------------------------------------

/** In-flight runs for a PR (status='running') — the server-side source of
 *  truth for "which agents are running now". Joined with the agent name. */
export async function activeRunsForPull(
  db: Db,
  workspaceId: string,
  prId: string,
): Promise<{ run_id: string; agent_id: string | null; agent_name: string | null; ran_at: string | null }[]> {
  const rows = await db
    .select({
      id: t.agentRuns.id,
      agentId: t.agentRuns.agentId,
      ranAt: t.agentRuns.ranAt,
      agentName: t.agents.name,
    })
    .from(t.agentRuns)
    .leftJoin(t.agents, eq(t.agents.id, t.agentRuns.agentId))
    .where(
      and(
        eq(t.agentRuns.workspaceId, workspaceId),
        eq(t.agentRuns.prId, prId),
        eq(t.agentRuns.status, 'running'),
      ),
    );
  return rows.map((r) => ({
    run_id: r.id,
    agent_id: r.agentId,
    agent_name: r.agentName ?? null,
    ran_at: r.ranAt ? r.ranAt.toISOString() : null,
  }));
}

/** All runs for a PR (any status), newest first — the PR run history. */
export async function listRunsForPull(
  db: Db,
  workspaceId: string,
  prId: string,
): Promise<RunSummary[]> {
  const rows = await db
    .select({ run: t.agentRuns, agentName: t.agents.name })
    .from(t.agentRuns)
    .leftJoin(t.agents, eq(t.agents.id, t.agentRuns.agentId))
    .where(and(eq(t.agentRuns.workspaceId, workspaceId), eq(t.agentRuns.prId, prId)))
    .orderBy(desc(t.agentRuns.ranAt));
  return rows.map(({ run, agentName }) => ({
    run_id: run.id,
    agent_id: run.agentId,
    agent_name: agentName ?? null,
    provider: run.provider,
    model: run.model,
    status: run.status,
    error: run.error,
    duration_ms: run.durationMs,
    tokens_in: run.tokensIn,
    tokens_out: run.tokensOut,
    cost_usd: run.costUsd,
    cost_pending: run.status === 'running' || (run.multiAgentRunId != null && run.settledAt == null),
    findings_count: run.findingsCount,
    grounding: run.grounding,
    ran_at: run.ranAt ? run.ranAt.toISOString() : null,
    score: run.score,
    blockers: run.blockers,
  }));
}

/**
 * Delete one agent run (+ its trace via FK cascade) AND the review it produced.
 * Workspace-scoped. `reviews.run_id` has no FK to `agent_runs`, so the review
 * (and its findings, which DO cascade from `reviews`) must be removed explicitly
 * here — otherwise deleting a run from the timeline leaves its findings orphaned
 * in the Review Runs list below.
 */
export async function deleteAgentRun(
  db: Db,
  workspaceId: string,
  runId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .delete(t.agentRuns)
      .where(and(
        eq(t.agentRuns.id, runId),
        eq(t.agentRuns.workspaceId, workspaceId),
        sql`${t.agentRuns.status} IS DISTINCT FROM 'running'`,
        or(isNull(t.agentRuns.multiAgentRunId), isNotNull(t.agentRuns.settledAt)),
      ))
      .returning({ id: t.agentRuns.id });
    if (!run) return false;

    await tx.delete(t.reviews)
      .where(and(eq(t.reviews.runId, run.id), eq(t.reviews.workspaceId, workspaceId)));
    return true;
  });
}

/** Mark a still-running run as cancelled (no-op if it already finished). */
export async function cancelRunIfRunning(db: Db, workspaceId: string, runId: string): Promise<boolean> {
  const rows = await db
    .update(t.agentRuns)
    .set({ status: 'cancelled' })
    .where(and(eq(t.agentRuns.workspaceId, workspaceId), eq(t.agentRuns.id, runId), eq(t.agentRuns.status, 'running')))
    .returning({ id: t.agentRuns.id });
  return rows.length > 0;
}

/** Settle orphaned workers, including those interrupted after a cancel request. */
export async function reapStaleRunningRuns(db: Db): Promise<number> {
  const rows = await db
    .update(t.agentRuns)
    .set({
      status: sql`CASE WHEN ${t.agentRuns.status} = 'cancelled' THEN 'cancelled' ELSE 'failed' END`,
      settledAt: new Date(),
    })
    .where(or(
      eq(t.agentRuns.status, 'running'),
      and(isNotNull(t.agentRuns.multiAgentRunId), isNull(t.agentRuns.settledAt)),
    ))
    .returning({ id: t.agentRuns.id });
  return rows.length;
}

// ---- observability: agent_runs + run_traces -------------------------------

/** Publish the command and its full membership together before starting work. */
export async function createReviewRuns(
  db: Db,
  workspaceId: string,
  prId: string,
  agents: Pick<AgentRow, 'id' | 'provider' | 'model'>[],
) {
  if (agents.length === 0) return [];
  return db.transaction(async (tx) => {
    const [group] = await tx.insert(t.multiAgentRuns).values({ workspaceId, prId }).returning();
    return tx.insert(t.agentRuns)
      .values(agents.map((agent) => ({
        workspaceId,
        prId,
        multiAgentRunId: group!.id,
        agentId: agent.id,
        provider: agent.provider,
        model: agent.model,
        status: 'running',
      })))
      .returning({ id: t.agentRuns.id, agentId: t.agentRuns.agentId });
  });
}

export interface AgentRunCompletion {
  status: 'done' | 'failed' | 'cancelled';
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
  findingsCount: number;
  grounding: string;
  score?: number;
  blockers?: number;
  error?: string;
}

export async function completeAgentRun(
  db: Db,
  runId: string,
  values: AgentRunCompletion,
): Promise<boolean> {
  const [run] = await db
    .update(t.agentRuns)
    .set({
      status: sql`CASE WHEN ${t.agentRuns.status} = 'cancelled' THEN 'cancelled' ELSE ${values.status} END`,
      settledAt: new Date(),
      durationMs: values.durationMs,
      tokensIn: values.tokensIn,
      tokensOut: values.tokensOut,
      costUsd: values.costUsd,
      findingsCount: values.findingsCount,
      grounding: values.grounding,
      score: values.score ?? null,
      blockers: values.blockers ?? null,
      error: sql`CASE WHEN ${t.agentRuns.status} = 'cancelled' THEN 'Cancelled by user' ELSE ${values.error ?? null} END`,
    })
    .where(and(
      eq(t.agentRuns.id, runId),
      isNull(t.agentRuns.settledAt),
      values.status === 'done' ? eq(t.agentRuns.status, 'running') : undefined,
    ))
    .returning({ id: t.agentRuns.id });
  return run != null;
}

/** Persist the WHOLE run log as ONE document. PK = runId → agent_runs. */
export async function saveRunTrace(db: Db, runId: string, trace: RunTrace): Promise<void> {
  await db
    .insert(t.runTraces)
    .values({ runId, trace })
    .onConflictDoUpdate({ target: t.runTraces.runId, set: { trace } });
}

export async function getRunTrace(db: Db, workspaceId: string, runId: string): Promise<RunTrace | undefined> {
  const [row] = await db.select({ trace: t.runTraces.trace, costUsd: t.agentRuns.costUsd })
    .from(t.runTraces)
    .innerJoin(t.agentRuns, eq(t.runTraces.runId, t.agentRuns.id))
    .where(and(eq(t.agentRuns.workspaceId, workspaceId), eq(t.runTraces.runId, runId)));
  if (!row) return undefined;

  const trace = row.trace as RunTrace;
  return { ...trace, stats: { ...trace.stats, cost_usd: row.costUsd } };
}
