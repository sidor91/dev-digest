import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { agentRuns, deletedRunCosts } from '../../db/schema.js';

/** All runs contribute once. A delete moves its contribution between tables in one transaction. */
export async function reviewCostsForPulls(db: Db, workspaceId: string, prIds: string[]) {
  if (prIds.length === 0) return [];

  const costs = db
    .select({ prId: agentRuns.prId, costUsd: agentRuns.costUsd, costSource: agentRuns.costSource })
    .from(agentRuns)
    .where(and(
      eq(agentRuns.workspaceId, workspaceId),
      inArray(agentRuns.prId, prIds),
      sql`${agentRuns.status} is distinct from 'running'`,
    ))
    .unionAll(db
      .select({ prId: deletedRunCosts.prId, costUsd: deletedRunCosts.costUsd, costSource: deletedRunCosts.costSource })
      .from(deletedRunCosts)
      .where(and(eq(deletedRunCosts.workspaceId, workspaceId), inArray(deletedRunCosts.prId, prIds))),
    )
    .as('review_costs');

  return db
    .select({
      prId: costs.prId,
      cost_usd: sql<number | null>`sum(${costs.costUsd})`,
      cost_is_partial: sql<boolean>`bool_or(${costs.costUsd} is null)`,
      cost_is_estimated: sql<boolean>`bool_or(${costs.costUsd} is not null and ${costs.costSource} is not distinct from 'estimated')`,
    })
    .from(costs)
    .groupBy(costs.prId);
}
