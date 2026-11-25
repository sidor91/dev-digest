import OpenAI from 'openai';
import type {
  LLMProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResult,
  StructuredRequest,
  StructuredResult,
} from '@devdigest/shared';
import { withRetry, withTimeout } from '../../platform/resilience.js';
import { toJsonSchema, parseWithRepair } from '../../platform/structured.js';
import { estimateCost } from './pricing.js';
import { ExternalServiceError } from '../../platform/errors.js';

const DEFAULT_TIMEOUT = 60_000;
const EMBED_MODEL = 'text-embedding-3-small';

type TuningParams = Pick<
  OpenAI.ChatCompletionCreateParamsNonStreaming,
  'temperature' | 'max_tokens' | 'max_completion_tokens' | 'reasoning_effort'
>;

function tuningParams(
  model: string,
  temperature: number | undefined,
  maxTokens: number | undefined,
): TuningParams {
  const tokenLimit = maxTokens || undefined;
  if (model.startsWith('gpt-6.2-')) {
    return { reasoning_effort: 'medium', max_completion_tokens: tokenLimit };
  }
  if (/^(gpt-5|o1|o3|o4)/.test(model)) {
    return { max_completion_tokens: tokenLimit };
  }
  return { temperature: temperature ?? 0, max_tokens: tokenLimit };
}

function completionText(response: OpenAI.ChatCompletion): string {
  const choice = response.choices?.[0];
  if (choice?.message.refusal) {
    throw new ExternalServiceError('OpenAI refused the request');
  }
  if (choice?.finish_reason === 'content_filter') {
    throw new ExternalServiceError('OpenAI stopped the completion due to its content filter');
  }
  if (choice?.finish_reason === 'length') {
    throw new ExternalServiceError('OpenAI stopped the completion at the token limit');
  }
  return choice?.message.content ?? '';
}

/**
 * OpenAI LLMProvider.
 * - listModels: dynamic via GET /models (not hardcoded).
 * - completeStructured: response_format json_schema + Zod validate + reprompt.
 * - embed: text-embedding-3-small (1536 dims).
 */
export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    return withRetry(async () => {
      const res = await this.client.models.list();
      return res.data
        .filter((m) => m.id.startsWith('gpt') || m.id.includes('o1') || m.id.includes('o3'))
        .map((m) => ({ id: m.id, provider: 'openai' as const, created: m.created }));
    });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const res = await withRetry(() =>
      withTimeout(
        this.client.chat.completions.create({
          model: req.model,
          messages: req.messages,
          ...tuningParams(req.model, req.temperature ?? 0.2, req.maxTokens),
        }),
        req.timeoutMs ?? DEFAULT_TIMEOUT,
      ),
    );
    const text = completionText(res);
    const tokensIn = res.usage?.prompt_tokens ?? 0;
    const tokensOut = res.usage?.completion_tokens ?? 0;
    return {
      text,
      model: req.model,
      tokensIn,
      tokensOut,
      costUsd: estimateCost(req.model, tokensIn, tokensOut),
    };
  }

  async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const jsonSchema = toJsonSchema(req.schema, req.schemaName);
    const maxRetries = req.maxRetries ?? 2;
    const messages = [...req.messages];
    let tokensIn = 0;
    let tokensOut = 0;
    let allUsageReported = true;
    let lastRaw = '';

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const res = await withRetry(() =>
        withTimeout(
          this.client.chat.completions.create({
            model: req.model,
            messages,
            ...tuningParams(req.model, req.temperature, req.maxTokens),
            response_format: {
              type: 'json_schema',
              json_schema: { name: req.schemaName, schema: jsonSchema.schema, strict: true },
            },
          }),
          req.timeoutMs ?? DEFAULT_TIMEOUT,
        ),
      );
      lastRaw = completionText(res);
      allUsageReported &&= res.usage?.prompt_tokens != null && res.usage.completion_tokens != null;
      tokensIn += res.usage?.prompt_tokens ?? 0;
      tokensOut += res.usage?.completion_tokens ?? 0;

      const parsed = parseWithRepair(req.schema, lastRaw);
      if (parsed.ok) {
        return {
          data: parsed.data,
          model: req.model,
          tokensIn,
          tokensOut,
          costUsd: allUsageReported ? estimateCost(req.model, tokensIn, tokensOut) : null,
          raw: lastRaw,
          attempts: attempt,
        };
      }
      // reprompt-on-error
      messages.push({ role: 'assistant', content: lastRaw });
      messages.push({ role: 'user', content: parsed.repromptMessage });
    }

    throw new ExternalServiceError('OpenAI structured output failed schema validation', {
      raw: lastRaw,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    return withRetry(async () => {
      const res = await withTimeout(
        this.client.embeddings.create({ model: EMBED_MODEL, input: texts }),
        DEFAULT_TIMEOUT,
      );
      return res.data.map((d) => d.embedding);
    });
  }
}
