import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenRouterProvider } from '../src/llm/openrouter.js';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

const request = {
  model: 'review-model',
  messages: [{ role: 'user' as const, content: 'Review this change' }],
  schema: z.object({ summary: z.string() }),
  schemaName: 'Review',
};

function completion(content: string, usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number }) {
  return { choices: [{ message: { content } }], usage };
}

describe('OpenRouter structured pricing', () => {
  beforeEach(() => create.mockReset());

  it('adds charged and estimated attempts without repricing an explicit zero', async () => {
    const estimateCost = vi.fn(() => 0.0013);
    const provider = new OpenRouterProvider('test-key', { estimateCost });
    create.mockResolvedValueOnce(completion('{"summary":1}', { cost: 0 }));
    create.mockResolvedValueOnce(completion('{"summary":1}', { cost: 0.06 }));
    create.mockResolvedValueOnce(completion('{"summary":"ok"}', { prompt_tokens: 100, completion_tokens: 50 }));

    const result = await provider.completeStructured(request);

    expect(result.costUsd).toBeCloseTo(0.0613);
    expect(estimateCost).toHaveBeenCalledTimes(1);
    expect(estimateCost).toHaveBeenCalledWith('review-model', 100, 50);
  });

  it('reports an unknown total if one attempt has neither a charge nor usage', async () => {
    const provider = new OpenRouterProvider('test-key', { estimateCost: () => 0.0013 });
    create.mockResolvedValueOnce(completion('{"summary":1}', { cost: 0.06 }));
    create.mockResolvedValueOnce(completion('{"summary":"ok"}'));

    await expect(provider.completeStructured(request)).resolves.toMatchObject({ costUsd: null });
  });
});
