WITH migrated AS (
  UPDATE "agents"
  SET "provider" = 'openai', "model" = 'gpt-6.2-sol', "version" = "version" + 1
  WHERE "provider" = 'anthropic'
  RETURNING *
)
INSERT INTO "agent_versions" ("agent_id", "version", "config_json")
SELECT m."id", m."version", jsonb_build_object(
  'provider', m."provider",
  'model', m."model",
  'system_prompt', m."system_prompt",
  'output_schema', m."output_schema",
  'strategy', m."strategy",
  'ci_fail_on', m."ci_fail_on",
  'repo_intel', m."repo_intel",
  'skills', COALESCE(
    (SELECT jsonb_agg(link."skill_id" ORDER BY link."order")
     FROM "agent_skills" AS link
     WHERE link."agent_id" = m."id"),
    '[]'::jsonb
  )
)
FROM migrated AS m;
--> statement-breakpoint
UPDATE "settings" AS s
SET "value" = (
  SELECT jsonb_object_agg(feature, CASE
    WHEN choice->>'provider' = 'anthropic'
      THEN choice || '{"provider":"openai","model":"gpt-6.2-sol"}'::jsonb
    ELSE choice
  END)
  FROM jsonb_each(s."value") AS model_choice(feature, choice)
)
WHERE s."key" = 'feature_models' AND EXISTS (
  SELECT 1
  FROM jsonb_each(
    CASE WHEN jsonb_typeof(s."value") = 'object' THEN s."value" ELSE '{}'::jsonb END
  ) AS model_choice(feature, choice)
  WHERE choice->>'provider' = 'anthropic'
);
