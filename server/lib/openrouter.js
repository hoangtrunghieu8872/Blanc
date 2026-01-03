export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const DEFAULT_CHAT_MODELS = [
  'qwen/qwen3-coder',
  'qwen/qwen3-235b-a22b',
  'tngtech/deepseek-r1t2-chimera',
  'mistralai/devstral-2512',
  'meta-llama/llama-3.3-70b-instruct',
];

export function parseChatModels(value, defaultModels = DEFAULT_CHAT_MODELS) {
  if (!value) return defaultModels;
  const models = value
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return models.length ? models : defaultModels;
}

function shouldFallbackOpenRouterError(err) {
  const status = err?.status;
  if (!status) return false;
  if (status === 401) return false; // invalid API key - switching models won't help
  if (status >= 500) return true;
  if ([402, 403, 404, 408, 429].includes(status)) return true;

  const message = String(err?.details || err?.message || '').toLowerCase();
  if (status === 400) {
    return (
      message.includes('model') ||
      message.includes('provider') ||
      message.includes('not found') ||
      message.includes('not available') ||
      message.includes('no providers') ||
      message.includes('unsupported') ||
      message.includes('not supported')
    );
  }

  return false;
}

async function callOpenRouterOnce({
  apiKey,
  apiUrl,
  model,
  messages,
  frontendOrigin,
  title,
  fetchFn,
  maxTokens,
  temperature,
  topP,
}) {
  const response = await fetchFn(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': frontendOrigin || 'http://localhost:5173',
      'X-Title': title || 'Blanc Assistant',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    // eslint-disable-next-line no-console
    console.error(`OpenRouter API error (model: ${model}, status: ${response.status}):`, text);
    const error = new Error('Failed to get AI response');
    error.status = response.status;
    error.model = model;
    error.details = text;
    throw error;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Xin lỗi, tôi không thể trả lời lúc này.';
}

export async function callOpenRouterChat({
  apiKey,
  models = DEFAULT_CHAT_MODELS,
  messages,
  frontendOrigin,
  title = 'Blanc Assistant',
  fetchFn = fetch,
  apiUrl = OPENROUTER_API_URL,
  maxTokens = 1000,
  temperature = 0.7,
  topP = 0.9,
}) {
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const errors = [];
  for (const model of models) {
    try {
      const content = await callOpenRouterOnce({
        apiKey,
        apiUrl,
        model,
        messages,
        frontendOrigin,
        title,
        fetchFn,
        maxTokens,
        temperature,
        topP,
      });
      return { content, model };
    } catch (err) {
      errors.push({ model, err });
      if (!shouldFallbackOpenRouterError(err)) {
        throw err;
      }
      // eslint-disable-next-line no-console
      console.warn(
        `[chat] OpenRouter failed for model ${model} (status: ${err?.status ?? 'unknown'}). Falling back...`
      );
    }
  }

  const fallbackError = new Error('AI temporarily unavailable');
  fallbackError.status = 503;
  fallbackError.details = errors.map((e) => `${e.model}:${e.err?.status ?? 'unknown'}`).join(', ');
  throw fallbackError;
}

