---
name: engineering-insights
description: Read and record durable findings in DevDigest package INSIGHTS.md journals. Use when starting package work, uncovering a reusable finding, or wrapping up a package task.
---

# Engineering Insights

1. Use the root `AGENTS.md` to identify the packages involved. Read each package's `AGENTS.md` and `INSIGHTS.md` before investigating, editing, or answering about it. If ownership is unclear, do only the lookup needed to resolve it first. Repeat when a new package comes into scope.
2. During the task, flag findings with an evidenced, non-obvious consequence that changes a future action or check. Use code, tests, reproduced observations, or documentation as evidence. Include failed approaches as well as successes. Skip routine work, implementation details visible at a glance, and sensitive information.
3. Before the final response, reread the entire current `INSIGHTS.md` of each candidate's owning package, including uncommitted edits. Compare meaning across all sections and skip equivalent entries even if worded differently. For behavior shared across packages, record it with the owner unless another package has its own distinct action to capture.
4. Take a unique temporary snapshot of the current working copy immediately before editing. If it differs from what you reviewed or the patch context has changed, reread the journal and recheck for duplicates. Use `apply_patch` or `git apply` to insert each entry at the end of the best-fitting section. The patch must contain context and additions only. Include the ISO date (`YYYY-MM-DD`), when the finding applies, what to do or verify, why, and the evidence. For code or tests, cite a repository-relative path with a symbol or line number. If new evidence corrects an older entry, add an evidence-backed correction that identifies the older entry.
5. Compare the saved journal against the snapshot. Confirm that every previous line, including headings, whitespace, and uncommitted edits, is intact and in the same order. Correct only your own edits if the comparison shows a change to an existing line.
6. Finish when all candidates have been checked and qualifying entries are saved and verified. Diagnosing or explaining a package can produce an entry when writes are allowed. Leave the journals untouched in Plan Mode, when the user or environment requires read-only work, or when the task has no owner or qualifying entry.

## Choose a section

- **What Works** — A verified approach worth reusing and the conditions that make it work.
- **What Doesn't Work** — A reproducible dead end, its failure mode, and what to try instead if known.
- **Codebase Patterns** — A non-obvious local convention or architectural decision and its rationale.
- **Tool & Library Notes** — A tool or dependency behavior that changes how to use it. Include the applicable version or environment when relevant.
- **Recurring Errors & Fixes** — A repeatable symptom with a verified cause and fix.
- **Session Notes** — A dated discovery whose timing changes later work. Record it only if another section does not already capture the lesson.
- **Open Questions** — An evidenced gap that affects later work, with the next concrete check.
