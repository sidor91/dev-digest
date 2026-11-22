import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenAIProvider } from '../src/adapters/llm/openai.js';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

const messages = [{ role: 'user' as const, content: 'Review this change' }];
const request = {
  model: 'gpt-6.2-sol',
  messages,
  schema: z.object({ summary: z.string() }),
  schemaName: 'review',
  temperature: 0.2,
  maxTokens: 2048,
};

function completion(content: string | null, finishReason = 'stop', refusal: string | null = null) {
  return {
    choices: [{ finish_reason: finishReason, message: { content, refusal } }],
    usage: { prompt_tokens: 1_000, completion_tokens: 200 },
  };
}

describe('OpenAIProvider', () => {
  const provider = new OpenAIProvider('test-key');

  beforeEach(() => create.mockReset());

  it('uses GPT-6.2 reasoning parameters and validates structured output', async () => {
    create.mockResolvedValueOnce(completion('{"summary":1}'));
    create.mockResolvedValueOnce(completion('{"summary":"ok"}'));

    const result = await provider.completeStructured(request);
    const params = create.mock.calls[0]![0];

    expect(params).toMatchObject({
      model: request.model,
      reasoning_effort: 'medium',
      max_completion_tokens: 2048,
      response_format: { type: 'json_schema', json_schema: { name: 'review', strict: true } },
    });
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('max_tokens');
    expect(result).toMatchObject({
      data: { summary: 'ok' },
      tokensIn: 2_000,
      tokensOut: 400,
      attempts: 2,
    });
    expect(result.costUsd).toBeCloseTo(0.008);
  });

  it('keeps existing sampling and token parameters for GPT-4.1', async () => {
    create.mockResolvedValueOnce(completion('ok'));

    await provider.complete({ model: 'gpt-4.1', messages, temperature: 0.3, maxTokens: 100 });

    const params = create.mock.calls[0]![0];
    expect(params).toMatchObject({ temperature: 0.3, max_tokens: 100 });
    expect(params).not.toHaveProperty('reasoning_effort');
  });

  it('does not price a structured result when a retry omitted token usage', async () => {
    create.mockResolvedValueOnce({ ...completion('{"summary":1}'), usage: null });
    create.mockResolvedValueOnce(completion('{"summary":"ok"}'));

    await expect(provider.completeStructured(request)).resolves.toMatchObject({
      attempts: 2,
      tokensIn: 1_000,
      costUsd: null,
    });
  });

  it.each([
    [completion(null, 'stop', 'I cannot comply'), 'refused'],
    [completion('{"summary":"ok"}', 'length'), 'token limit'],
    [completion(null, 'content_filter'), 'content filter'],
  ])('fails once when the completion cannot be used', async (response, error) => {
    create.mockResolvedValue(response);

    await expect(provider.completeStructured(request)).rejects.toThrow(error);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a truncated text completion', async () => {
    create.mockResolvedValueOnce(completion('unfinished', 'length'));

    await expect(provider.complete({ model: request.model, messages })).rejects.toThrow('token limit');
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]![0];
    expect(params).toMatchObject({ reasoning_effort: 'medium' });
    expect(params).not.toHaveProperty('temperature');
  });
});
