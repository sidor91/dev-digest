import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../../../../messages/en/agents.json";
import { CreateAgentModal } from "./CreateAgentModal";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../../../../../lib/hooks/agents", () => ({
  useCreateAgent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

afterEach(cleanup);

it("defaults to a budget OpenRouter model and resets the model when the provider changes", () => {
  render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <CreateAgentModal onClose={() => {}} />
    </NextIntlClientProvider>,
  );

  const provider = screen.getByRole("combobox");
  const model = screen.getByDisplayValue("deepseek/deepseek-v4-flash");
  expect(provider).toHaveValue("openrouter");

  fireEvent.change(provider, { target: { value: "openai" } });
  expect(model).toHaveValue("gpt-4.1");

  fireEvent.change(provider, { target: { value: "openrouter" } });
  expect(model).toHaveValue("deepseek/deepseek-v4-flash");
});
