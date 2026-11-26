import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrMeta } from "@devdigest/shared";
import prReview from "../../../../../../../messages/en/prReview.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

const pr: PrMeta = {
  number: 482, title: "Add rate limiting", author: "marisa.koch", branch: "feat/rate-limit", base: "main",
  head_sha: "head", additions: 1, deletions: 0, files_count: 1, status: "reviewed", score: 65,
};

function renderRow(cost: Partial<PrMeta>) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview }}>
      <PRRow pr={{ ...pr, ...cost }} repoId="repo" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow cost", () => {
  it("shows both qualifiers when the PR subtotal is estimated and partial", () => {
    renderRow({ cost_usd: 0.014, cost_is_estimated: true, cost_is_partial: true });
    expect(screen.getByText("~$0.014")).toBeInTheDocument();
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it("shows a recorded zero", () => {
    renderRow({ cost_usd: 0 });
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.queryByText("Cost unavailable")).not.toBeInTheDocument();
  });

  it("keeps tiny positive costs visible", () => {
    renderRow({ cost_usd: 0.000007 });
    expect(screen.getByText("<$0.0001")).toBeInTheDocument();
  });

  it("treats a missing cost on older API responses as unavailable", () => {
    renderRow({});
    expect(screen.getByText("Cost unavailable")).toBeInTheDocument();
  });
});
