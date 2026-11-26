CREATE TABLE "deleted_run_costs" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pr_id" uuid NOT NULL,
	"cost_usd" double precision,
	"cost_source" text
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "cost_usd" double precision;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "cost_source" text;--> statement-breakpoint
ALTER TABLE "deleted_run_costs" ADD CONSTRAINT "deleted_run_costs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deleted_run_costs" ADD CONSTRAINT "deleted_run_costs_pr_id_pull_requests_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deleted_run_costs_ws_pr_idx" ON "deleted_run_costs" USING btree ("workspace_id","pr_id");--> statement-breakpoint
CREATE INDEX "agent_runs_ws_pr_idx" ON "agent_runs" USING btree ("workspace_id","pr_id");