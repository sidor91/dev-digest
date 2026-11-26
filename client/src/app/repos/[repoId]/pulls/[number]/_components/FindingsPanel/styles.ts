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
  severityGroup: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  severityButton: {
    minHeight: 24,
    padding: "2px 6px",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  severitySeparator: { color: "var(--text-muted)" } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
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
