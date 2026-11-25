import type { FindingRecord, Severity } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

export function countFindingsBySeverity(findings: FindingRecord[]): Record<Severity, number> {
  const counts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const { severity } of findings) {
    counts[severity] += 1;
  }
  return counts;
}

export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  selectedSeverity: Severity | null = null,
): FindingRecord[] {
  return findings
    .filter(
      (finding) =>
        (!selectedSeverity || finding.severity === selectedSeverity) &&
        (!hideLow || finding.confidence >= LOW_CONFIDENCE_THRESHOLD),
    )
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
}
