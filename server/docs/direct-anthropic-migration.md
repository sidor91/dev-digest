# Direct Anthropic cutover and rollback

Migration `0010_remove-direct-anthropic` moves existing direct Anthropic
agents and feature model overrides to `openai` / `gpt-6.2-sol`, the approved
replacement after the [model comparison](../../docs/agent-prompts/choosing-a-model.md#compare-openai-and-openrouter-on-fixed-inputs).
Past runs and agent versions still identify the original provider. Existing
OpenRouter selections, including Claude, keep their configured models.
New agents start on DeepSeek V4 Flash through OpenRouter for development.

1. Before upgrading an installation with direct Anthropic configurations, verify that its OpenAI key can complete a structured review with the approved model. Keep the current release running if that preflight fails.
2. Stop DevDigest before migrating its database. Take a PostgreSQL custom-format backup with `pg_dump --format=custom` and check that `pg_restore --list` can read it. Retain the previous application revision and its provider credentials for rollback.
3. Run `pnpm db:migrate` from `server/` and verify a Studio review before reopening the app for normal use. Check an existing migrated agent, its pre-migration version, and a pre-migration review in the run history.

If a check fails before reopening the app, stop the new release, restore the
backup into a separate database, and point the previous release at the restored
database. Keep the upgraded database for diagnosis. If writes resumed after
the upgrade, also back up the upgraded database and reconcile those writes
before switching to the restored database.
