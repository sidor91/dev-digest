import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { agentRuns, multiAgentRuns } from '../../db/schema.js';

/** One result per PR, including commands for which every price is unknown. */
export async function latestReviewCosts(db: Db, workspaceId: string, prIds: string[]) {
  if (prIds.length === 0) return new Map<string, { amount: number | null; partial: boolean }>();

  const rows = await db.selectDistinctOn([multiAgentRuns.prId], {
    prId: multiAgentRuns.prId,
    amount: sql<number>`sum(${agentRuns.costUsd})`.mapWith(Number),
    priced: count(agentRuns.costUsd),
    total: count(),
  })
    .from(multiAgentRuns)
    .innerJoin(agentRuns, and(
      eq(agentRuns.multiAgentRunId, multiAgentRuns.id),
      eq(agentRuns.prId, multiAgentRuns.prId),
      eq(agentRuns.workspaceId, multiAgentRuns.workspaceId),
      eq(agentRuns.source, 'local'),
    ))
    .where(and(eq(multiAgentRuns.workspaceId, workspaceId), inArray(multiAgentRuns.prId, prIds)))
    .groupBy(multiAgentRuns.prId, multiAgentRuns.ranAt, multiAgentRuns.id)
    .having(sql`count(${agentRuns.settledAt}) = count(*)`)
    .orderBy(multiAgentRuns.prId, desc(multiAgentRuns.ranAt), desc(multiAgentRuns.id));

  return new Map(rows.map(({ prId, amount, priced, total }) => [prId, {
    amount: priced === 0 ? null : amount,
    partial: priced > 0 && priced < total,
  }]));
}
