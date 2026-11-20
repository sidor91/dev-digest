import type { Provider } from "@devdigest/shared";

/** Default provider/model for a new agent. */
export const DEFAULT_PROVIDER: Provider = "openrouter";
export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4.1",
  openrouter: "deepseek/deepseek-v4-flash",
};

/** Selectable providers in the create form. */
export const PROVIDER_OPTIONS: readonly Provider[] = ["openrouter", "openai"];

/** Modal width (px). */
export const MODAL_WIDTH = 620;
