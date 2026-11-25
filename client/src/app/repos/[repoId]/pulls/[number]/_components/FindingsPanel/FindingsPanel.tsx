/* FindingsPanel — per-run severity controls, keyboard navigation, and finding actions. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, Icon, SEV, Toggle } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { KEY_TO_ACTION, SEVERITY_FILTER_LEVELS } from "./constants";
import { countFindingsBySeverity, visibleFindings } from "./helpers";
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

  const counts = countFindingsBySeverity(findings);
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, selectedSeverity),
    [findings, hideLow, selectedSeverity],
  );

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || shown.length === 0) return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        <div role="group" aria-label={t("panel.severityFilters")} style={s.severityFilters}>
          {SEVERITY_FILTER_LEVELS.map((severity) => {
            const active = selectedSeverity === severity;
            const muted = selectedSeverity !== null && !active;
            const token = SEV[severity];
            const SeverityIcon = Icon[token.icon];

            return (
              <button
                key={severity}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedSeverity((current) => (current === severity ? null : severity));
                  setFocusIdx(0);
                }}
                style={{
                  ...s.severityCounter,
                  color: muted ? "var(--text-secondary)" : "var(--text-primary)",
                  borderColor: active ? token.c : "var(--border)",
                  backgroundColor: active ? token.bg : "transparent",
                }}
              >
                <SeverityIcon
                  size={13}
                  aria-hidden="true"
                  color={muted ? "var(--text-secondary)" : token.c}
                />
                {t("panel.severityCount", {
                  count: counts[severity],
                  severity: t(`panel.severity.${severity}`),
                })}
              </button>
            );
          })}
        </div>
        <label style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle
            on={hideLow}
            onChange={(on) => {
              setHideLow(on);
              setFocusIdx(0);
            }}
            size={16}
          />
        </label>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
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
