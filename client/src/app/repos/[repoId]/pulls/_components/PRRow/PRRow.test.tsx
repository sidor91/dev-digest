import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import type { PrMeta } from "@devdigest/shared";
import prReview from "../../../../../../../messages/en/prReview.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

const pr: PrMeta = {
  number: 482,
  title: "Rate limits",
  author: "marisa",
  branch: "feature",
  base: "main",
  head_sha: "abc123",
  additions: 2,
  deletions: 0,
  files_count: 1,
  status: "needs_review",
};

it.each([
  { amount: 0.0613, partial: false, display: "$0.0613" },
  { amount: 0.0013, partial: true, display: "$0.0013" },
  { amount: 0, partial: false, display: "$0.00" },
  { amount: 0.00003, partial: false, display: "<$0.0001" },
  { amount: undefined, partial: false, display: "Review cost unavailable" },
])("renders $display with the correct partial state for a PR row", ({ amount, partial, display }) => {
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview }}>
      <PRRow pr={{ ...pr, review_cost_usd: amount, review_cost_is_partial: partial }} repoId="repo-1" />
    </NextIntlClientProvider>,
  );

  expect(screen.getByText(display)).toBeInTheDocument();
  expect(screen.queryByText("Partial") != null).toBe(partial);
});
