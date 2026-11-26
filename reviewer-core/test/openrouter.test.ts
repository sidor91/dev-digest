import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenRouterProvider } from '../src/llm/openrouter.js';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
  default: class { chat = { completions: { create } }; },
}));

const request = { model: 'test/model', schema: z.object({ ok: z.boolean() }), schemaName: 'Result', messages: [] };

function response(content: string, usage?: { prompt_tokens: number; completion_tokens: number; cost?: number }) {
  return { choices: [{ message: { content } }], usage };
}

describe('OpenRouter structured cost', () => {
  beforeEach(() => create.mockReset());

  it('combines reported retry cost with estimates for attempts without a price', async () => {
    create
      .mockResolvedValueOnce(response('invalid JSON', { prompt_tokens: 3, completion_tokens: 4, cost: 0.002 }))
      .mockResolvedValueOnce(response('{"ok":true}', { prompt_tokens: 11, completion_tokens: 2 }));
    const estimateCost = vi.fn(() => 0.005);

    const result = await new OpenRouterProvider('test-key', { estimateCost }).completeStructured(request);
    expect(estimateCost).toHaveBeenCalledTimes(1);
    expect(estimateCost).toHaveBeenCalledWith('test/model', 11, 2);
    expect(result).toMatchObject({ costUsd: 0.007, costSource: 'estimated', attempts: 2 });
  });

  it('keeps a reported zero and never estimates it', async () => {
    create.mockResolvedValueOnce(response('{"ok":true}', { prompt_tokens: 3, completion_tokens: 4, cost: 0 }));
    const estimateCost = vi.fn(() => 0.005);

    const result = await new OpenRouterProvider('test-key', { estimateCost }).completeStructured(request);
    expect(result).toMatchObject({ costUsd: 0, costSource: 'reported' });
    expect(estimateCost).not.toHaveBeenCalled();
  });

  it('leaves the run cost unknown when any attempt lacks price and token usage', async () => {
    create
      .mockResolvedValueOnce(response('invalid JSON'))
      .mockResolvedValueOnce(response('{"ok":true}', { prompt_tokens: 3, completion_tokens: 4, cost: 0.002 }));
    const estimateCost = vi.fn(() => 0.005);

    const result = await new OpenRouterProvider('test-key', { estimateCost }).completeStructured(request);
    expect(result.costUsd).toBeNull();
    expect(result.costSource).toBeUndefined();
    expect(estimateCost).not.toHaveBeenCalled();
  });
});
