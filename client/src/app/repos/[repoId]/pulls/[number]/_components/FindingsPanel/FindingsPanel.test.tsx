import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate, isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

const CRITICAL: FindingRecord = {
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
};
const WARNING: FindingRecord = {
  ...CRITICAL,
  id: "f2",
  severity: "WARNING",
  title: "Missing input validation",
  confidence: 0.65,
};
const LOW_CONFIDENCE_WARNING: FindingRecord = {
  ...WARNING,
  id: "f3",
  title: "Suspicious default",
  confidence: 0.64,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    ui,
    {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
          {children}
        </NextIntlClientProvider>
      ),
    },
  );
}

describe("FindingsPanel", () => {
  it("counts each run independently and selects, switches, and clears one severity", () => {
    const suggestion: FindingRecord = {
      ...CRITICAL,
      id: "f4",
      review_id: "r2",
      severity: "SUGGESTION",
      title: "Clarify error message",
    };
    renderWithIntl(
      <>
        <section aria-label="First run">
          <FindingsPanel findings={[WARNING, CRITICAL, LOW_CONFIDENCE_WARNING]} prId="pr1" />
        </section>
        <section aria-label="Second run">
          <FindingsPanel findings={[suggestion]} prId="pr1" />
        </section>
      </>,
    );
    const firstRun = within(screen.getByRole("region", { name: "First run" }));
    const secondRun = within(screen.getByRole("region", { name: "Second run" }));
    const critical = firstRun.getByRole("button", { name: "1 CRITICAL", pressed: false });
    const warning = firstRun.getByRole("button", { name: "2 WARNING", pressed: false });
    expect(firstRun.getByRole("button", { name: "0 SUGGESTION", pressed: false })).toBeVisible();
    expect(secondRun.getByRole("button", { name: "0 CRITICAL", pressed: false })).toBeVisible();
    expect(secondRun.getByRole("button", { name: "0 WARNING", pressed: false })).toBeVisible();
    expect(secondRun.getByRole("button", { name: "1 SUGGESTION", pressed: false })).toBeVisible();

    fireEvent.click(critical);
    expect(critical).toHaveAttribute("aria-pressed", "true");
    expect(firstRun.getByText(CRITICAL.title)).toBeVisible();
    expect(firstRun.queryByText(WARNING.title)).not.toBeInTheDocument();
    expect(secondRun.getByText(suggestion.title)).toBeVisible();
    expect(secondRun.getByRole("button", { name: "1 SUGGESTION", pressed: false })).toBeVisible();

    fireEvent.click(warning);
    expect(critical).toHaveAttribute("aria-pressed", "false");
    expect(warning).toHaveAttribute("aria-pressed", "true");
    expect(firstRun.queryByText(CRITICAL.title)).not.toBeInTheDocument();
    expect(firstRun.getByText(WARNING.title)).toBeVisible();
    expect(firstRun.getByText(LOW_CONFIDENCE_WARNING.title)).toBeVisible();

    fireEvent.click(warning);
    expect(warning).toHaveAttribute("aria-pressed", "false");
    expect(firstRun.getByText(CRITICAL.title)).toBeVisible();
    expect(firstRun.getByText(WARNING.title)).toBeVisible();
    expect(firstRun.getByText(LOW_CONFIDENCE_WARNING.title)).toBeVisible();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("combines severity and confidence filters while keeping the run totals", () => {
    renderWithIntl(<FindingsPanel findings={[CRITICAL, WARNING, LOW_CONFIDENCE_WARNING]} prId="pr1" />);
    const hideLow = screen.getByRole("switch", { name: "Hide low confidence" });
    const warning = screen.getByRole("button", { name: "2 WARNING" });
    const suggestion = screen.getByRole("button", { name: "0 SUGGESTION" });

    fireEvent.click(warning);
    fireEvent.click(hideLow);
    expect(screen.getByRole("button", { name: "2 WARNING", pressed: true })).toBeVisible();
    expect(screen.getByText(WARNING.title)).toBeVisible();
    expect(screen.queryByText(LOW_CONFIDENCE_WARNING.title)).not.toBeInTheDocument();
    expect(screen.queryByText(CRITICAL.title)).not.toBeInTheDocument();

    fireEvent.click(suggestion);
    expect(screen.getByText("No findings match")).toBeVisible();

    fireEvent.click(suggestion);
    expect(screen.getByText(CRITICAL.title)).toBeVisible();
    expect(screen.getByText(WARNING.title)).toBeVisible();
    expect(screen.queryByText(LOW_CONFIDENCE_WARNING.title)).not.toBeInTheDocument();
  });

  it("keeps the selected severity and totals when accepted and dismissed findings refresh", () => {
    const { rerender } = renderWithIntl(<FindingsPanel findings={[CRITICAL, WARNING]} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "1 CRITICAL" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(mutate).toHaveBeenLastCalledWith({ findingId: CRITICAL.id, action: "accept", prId: "pr1" });

    const accepted = { ...CRITICAL, accepted_at: "2026-11-22T12:00:00Z" };
    rerender(<FindingsPanel findings={[accepted, WARNING]} prId="pr1" />);
    expect(screen.getByText("accepted", { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(mutate).toHaveBeenLastCalledWith({ findingId: CRITICAL.id, action: "dismiss", prId: "pr1" });

    const dismissed = { ...CRITICAL, dismissed_at: "2026-11-22T12:01:00Z" };
    rerender(<FindingsPanel findings={[dismissed, WARNING]} prId="pr1" />);
    expect(screen.getByText("dismissed", { exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "1 CRITICAL", pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "1 WARNING", pressed: false })).toBeVisible();
    expect(screen.queryByText(WARNING.title)).not.toBeInTheDocument();
  });

  it("returns the keyboard action to the first visible finding when the filter changes", () => {
    renderWithIntl(<FindingsPanel findings={[CRITICAL, WARNING]} prId="pr1" />);
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.click(screen.getByRole("button", { name: "1 CRITICAL" }));
    fireEvent.keyDown(window, { key: "a" });
    expect(mutate).toHaveBeenCalledOnce();
    expect(mutate).toHaveBeenCalledWith({ findingId: CRITICAL.id, action: "accept", prId: "pr1" });
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});
