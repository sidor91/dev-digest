import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /0 critical/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /0 warning/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /0 suggestion/i })).toBeInTheDocument();
  });

  it("counts findings after the confidence filter and keeps counts when selecting a severity", () => {
    const baseFinding = FINDINGS[0]!;
    const findings: FindingRecord[] = [
      baseFinding,
      { ...baseFinding, id: "f2", title: "Possible secret", confidence: 0.4 },
      { ...baseFinding, id: "f3", title: "Missing check", severity: "WARNING", confidence: 0.65 },
      { ...baseFinding, id: "f4", title: "Clarify name", severity: "SUGGESTION", confidence: 0.3 },
    ];
    renderWithIntl(<FindingsPanel findings={findings} prId="pr1" />);

    const critical = screen.getByRole("button", { name: /2 critical/i });
    const warning = screen.getByRole("button", { name: /1 warning/i });
    const suggestion = screen.getByRole("button", { name: /1 suggestion/i });
    const hideLow = screen.getByRole("switch");

    fireEvent.click(critical);
    expect(critical).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("Possible secret")).toBeInTheDocument();
    expect(screen.queryByText("Missing check")).not.toBeInTheDocument();
    expect(warning).toHaveAccessibleName(/1 warning/i);
    expect(suggestion).toHaveAccessibleName(/1 suggestion/i);

    fireEvent.click(hideLow);
    expect(critical).toHaveAccessibleName(/1 critical/i);
    expect(warning).toHaveAccessibleName(/1 warning/i);
    expect(suggestion).toHaveAccessibleName(/0 suggestion/i);
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.queryByText("Possible secret")).not.toBeInTheDocument();
    expect(screen.queryByText("Missing check")).not.toBeInTheDocument();

    fireEvent.click(warning);
    expect(warning).toHaveAttribute("aria-pressed", "true");
    expect(critical).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Missing check")).toBeInTheDocument();
    expect(screen.queryByText("Hardcoded secret")).not.toBeInTheDocument();
    expect(critical).toHaveAccessibleName(/1 critical/i);

    fireEvent.click(suggestion);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    fireEvent.click(suggestion);
    expect(suggestion).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("Missing check")).toBeInTheDocument();
    expect(screen.queryByText("Clarify name")).not.toBeInTheDocument();

    fireEvent.click(hideLow);
    expect(critical).toHaveAccessibleName(/2 critical/i);
    expect(suggestion).toHaveAccessibleName(/1 suggestion/i);
    expect(screen.getByText("Possible secret")).toBeInTheDocument();
    expect(screen.getByText("Clarify name")).toBeInTheDocument();
  });
});
