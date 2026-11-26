"use client";

import { useFormatter, useTranslations } from "next-intl";
import styles from "./CostValue.module.css";

const USD = {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
} as const;
const MIN_VISIBLE_USD = 0.0001;

export function CostValue({ usd, estimated, partial }: {
  usd?: number | null;
  estimated?: boolean;
  partial?: boolean;
}) {
  const format = useFormatter();
  const t = useTranslations("prReview.cost");

  if (usd == null) {
    return (
      <span className={styles.cost}>
        <span aria-hidden="true">—</span>
        <span className={styles.visuallyHidden}>{t("unavailable")}</span>
      </span>
    );
  }

  const belowMinimum = usd > 0 && usd < MIN_VISIBLE_USD;
  const amount = format.number(belowMinimum ? MIN_VISIBLE_USD : usd, USD);
  const spokenAmount = belowMinimum ? t("below", { amount }) : amount;
  return (
    <span className={styles.cost}>
      <span className={styles.amount} aria-hidden={estimated || belowMinimum ? true : undefined}>
        {estimated ? "~" : ""}{belowMinimum ? "<" : ""}{amount}
      </span>
      {(estimated || belowMinimum) && (
        <span className={styles.visuallyHidden}>
          {estimated ? t("estimated", { amount: spokenAmount }) : spokenAmount}
        </span>
      )}
      {partial && <span className={styles.partial}>{t("partial")}</span>}
    </span>
  );
}
