/* FindingsPanel — severity and confidence filters + j/k navigation + FindingCard list,
   wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState, SEV } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { FINDING_SEVERITIES, KEY_TO_ACTION } from "./constants";
import { countBySeverity, visibleFindings } from "./helpers";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [selectedSeverity, setSelectedSeverity] = React.useState<Severity | null>(null);
  const [focusIdx, setFocusIdx] = React.useState(0);

  const confidenceFiltered = React.useMemo(() => visibleFindings(findings, hideLow), [findings, hideLow]);
  const counts = countBySeverity(confidenceFiltered);
  const shown = selectedSeverity
    ? confidenceFiltered.filter((finding) => finding.severity === selectedSeverity)
    : confidenceFiltered;
  const lastIndex = Math.max(0, shown.length - 1);
  const focusedIndex = Math.min(focusIdx, lastIndex);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, lastIndex));
      else if (e.key === "k") setFocusIdx((i) => Math.max(0, Math.min(i, lastIndex) - 1));
      else if (KEY_TO_ACTION[e.key] && shown[focusedIndex]) {
        action.mutate({ findingId: shown[focusedIndex]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusedIndex, lastIndex, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        <div role="group" aria-label={t("panel.severityFilter")} style={s.severityGroup}>
          {FINDING_SEVERITIES.map((severity, index) => {
            const token = SEV[severity];
            const pressed = selectedSeverity === severity;
            const muted = selectedSeverity !== null && !pressed;
            return (
              <React.Fragment key={severity}>
                {index > 0 && <span aria-hidden="true" style={s.severitySeparator}>·</span>}
                <button
                  type="button"
                  aria-pressed={pressed}
                  style={{
                    ...s.severityButton,
                    color: muted ? "var(--text-secondary)" : "var(--text-primary)",
                    background: pressed ? token.bg : "transparent",
                    borderColor: pressed ? token.c : "transparent",
                  }}
                  onClick={() => {
                    setSelectedSeverity((current) => (current === severity ? null : severity));
                    setFocusIdx(0);
                  }}
                >
                  {t("panel.severityCount", { count: counts[severity], label: token.label })}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusedIndex}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
