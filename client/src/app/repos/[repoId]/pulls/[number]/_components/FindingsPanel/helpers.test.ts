import { describe, expect, it } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { countBySeverity } from "./helpers";

describe("countBySeverity", () => {
  it("counts only known severities from runtime data", () => {
    const findings: FindingRecord[] = JSON.parse(`[
      { "severity": "CRITICAL" },
      { "severity": "WARNING" },
      { "severity": "WARNING" },
      { "severity": "INFO" },
      {},
      { "severity": "constructor" },
      { "severity": ["CRITICAL"] }
    ]`);

    expect(countBySeverity(findings)).toStrictEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 0 });
  });
});
