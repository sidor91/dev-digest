# What model to choose

A guide to picking the LLM behind a reviewer agent. The model is set per agent
(`agents.provider` + `agents.model`); the seed defaults every built-in agent to
`openrouter` / `deepseek/deepseek-v4-flash`. You can change it per agent in the
studio (the model dropdown) or via `PUT /agents/:id { "model": "…" }`.

## Why the model matters

The prompts (see [`README.md`](./README.md)) tell the model *what* to do; the model
decides *how well*. The cheap default (`deepseek-v4-flash`) is fast and nearly free
but, even with good prompts, tends to:

- **inflate severity** — calling a 2-query sequence or an intended feature
  `CRITICAL`, which turns harmless PRs into blockers;
- **reason inconsistently** — occasionally shipping a finding whose own rationale
  concludes "there is no bug";
- **over-pattern-match** — e.g. labelling a plain REST read as a "lethal trifecta".

A stronger model spends more per run but calibrates severity, follows the
verdict/severity rubric, and produces far fewer false positives. For a review gate,
fewer false blockers is usually worth a few cents.

## Cost per run

A single-pass review of a small/medium PR is roughly **~12k input + ~1.5k output
tokens** (observed: 9k–17k total). The `$/run` column below uses that estimate —
bigger diffs scale up linearly. Prices are OpenRouter list prices (USD per 1M
tokens) as surfaced by the studio's model list; verify live before relying on them.

| Model | in / out ($/M) | ~$/run | Notes |
|---|---|---|---|
| `deepseek/deepseek-v4-flash` *(current default)* | 0.09 / 0.18 | **~$0.0015** | Fast, nearly free. Severity inflation + weak instruction-following. |
| `deepseek/deepseek-v3.2` | 0.23 / 0.34 | ~$0.003 | Cheap step up, decent reasoning. |
| `deepseek/deepseek-chat-v3.1` | 0.21 / 0.79 | ~$0.004 | Solid budget reviewer. |
| **`deepseek/deepseek-v4-pro`** ⭐ | 0.435 / 0.87 | **~$0.006** | **Best cheap upgrade.** Same family/provider → drop-in (no prompt or format change), 1M context, clearly stronger reasoning. Start here. |
| `anthropic/claude-haiku-4.5` | 1 / 5 | ~$0.02 | Cheapest Claude; good at holding the rubric. |
| `google/gemini-2.5-pro` | 1.25 / 10 | ~$0.03 | Strong, good value. |
| `openai/gpt-4.1` | 2 / 8 | ~$0.035 | Reliable instruction-following. |
| **`anthropic/claude-sonnet-4.6`** ⭐ | 3 / 15 | **~$0.05** | **Quality benchmark.** Best severity calibration, lowest false-positive rate of the practical options. Use to see what a great review looks like. |
| `anthropic/claude-opus-4.8` | 5 / 25 | ~$0.10 | Top-tier reasoning; overkill for routine review, useful as a gold-standard reference. |

(All ~40× the default still lands at ≈5 cents/run — trivial for evaluating quality.)

## Recommendation

1. **Cheap, low-risk upgrade → `deepseek/deepseek-v4-pro`.** Only the `model` field
   changes; everything else (prompts, structured output, context) is identical. This
   alone should remove most of the severity-inflation wobble. ~4× the cost, still a
   fraction of a cent per run.
2. **Quality benchmark → `anthropic/claude-sonnet-4.6`.** Switch one agent to it and
   compare side by side. If the quality jump is worth ~$0.05/run for your use, make
   it the default for the gating agents (e.g. Security).
3. **Mixed strategy.** Cheap model for advisory/Performance passes, a strong model
   for the agent that actually blocks merge (Security). Cost follows importance.

## How to A/B test

1. Point one agent at the new model (studio model dropdown, or `PUT /agents/:id`).
2. Re-run all agents on the same PR (`POST /pulls/:id/review { "all": true }` or the
   **Run Review** button).
3. Compare the runs in the timeline + the raw model output in each run's trace
   (`run_traces.raw_output`). Look at: were the findings real, was severity honest,
   did the verdict match the findings, any duplicates or false trifecta?

Because `score` and the merge gate are derived deterministically from the grounded
findings (not the model's self-report), the comparison is apples-to-apples across
models — only the findings and their severities change.

## Compare OpenAI and OpenRouter on fixed inputs

From `server/`, run `pnpm exec tsx scripts/compare-review-models.ts` with
`OPENAI_API_KEY` and `OPENROUTER_API_KEY` configured. The command uses synthetic
diffs and the built-in General Reviewer prompt. It writes one JSON record per
model and diff, without posting reviews or accessing the database. Run it with
`--fixtures-only` to inspect the inputs without credentials or API calls.

Compare the grounded findings against the expected defects in each record.
Check the rationale as well as the cited line before marking a defect as found.
Review false blocks on the clean diff, failed responses, duration, and cost.
The comparison validates the first structured response without sending a repair prompt.
OpenAI cost uses the adapter's standard list-price estimate. OpenRouter cost
uses reported provider usage when available.

Before changing the default model, record which known defects each model found
or missed, confirm that the candidate returned valid structured results for all
fixtures and caught every known critical defect, and record the selected model
in the migration change.

## Development default

Keep DeepSeek V4 Flash through OpenRouter for new reviewers during local
development. In the six-request comparison, each model found both seeded
defects and approved the clean diff. Sol and Sonnet both cited the changed
lines, while DeepSeek cited adjacent lines. The two DeepSeek runs cost
$0.00033, compared with about $0.01326 for Sol and $0.02914 for Sonnet.
GPT-6.2 Sol is the replacement for existing direct Anthropic configurations.
Use representative project PRs to pick the production default.
