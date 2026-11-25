"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { RunSummary } from "@devdigest/shared";

const USD: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
};
const MIN_VISIBLE_COST = 0.0001;

export function getRunCost(run: RunSummary) {
  return run.cost_pending || run.status === "running" ? null : run.cost_usd;
}

export function ReviewCost({ amount, partial = false }: {
  amount: number | null | undefined;
  partial?: boolean;
}) {
  const format = useFormatter();
  const t = useTranslations("prReview.cost");
  if (amount == null) {
    return (
      <span className="relative" title={t("unavailable")}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("unavailable")}</span>
      </span>
    );
  }

  const display = amount > 0 && amount < MIN_VISIBLE_COST
    ? `<${format.number(MIN_VISIBLE_COST, USD)}`
    : format.number(amount, USD);

  return (
    <span className="relative" title={partial ? t("partialHint") : t("estimateHint")}>
      <data value={amount} className="mono" aria-hidden="true">{display}</data>
      <span className="sr-only">{t("amount", { amount: display })}</span>
      {partial && (
        <>
          {" "}<span style={{ color: "var(--warn)", fontSize: 11 }}>{t("partial")}</span>
          <span className="sr-only">{` ${t("partialHint")}`}</span>
        </>
      )}
    </span>
  );
}
