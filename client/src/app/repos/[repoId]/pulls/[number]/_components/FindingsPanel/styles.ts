import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  severityFilters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  } satisfies CSSProperties,
  severityCounter: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    minHeight: 28,
    padding: "3px 8px",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    cursor: "pointer",
  } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
