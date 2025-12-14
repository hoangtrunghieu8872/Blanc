const DEFAULT_TIMEOUT_MS = 8000;

function parseChatIds(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatIds = parseChatIds(process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID);
  const enabled =
    (process.env.TELEGRAM_ENABLED || '').toLowerCase() === 'true' ||
    (token && chatIds.length > 0);

  const timeoutMs = Math.max(
    1000,
    Number.parseInt(process.env.TELEGRAM_SEND_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10) ||
      DEFAULT_TIMEOUT_MS,
  );

  const messageThreadIdRaw = process.env.TELEGRAM_MESSAGE_THREAD_ID;
  const messageThreadId = messageThreadIdRaw ? Number(messageThreadIdRaw) : undefined;

  return { enabled, token, chatIds, timeoutMs, messageThreadId };
}

function truncate(text, maxLength) {
  const value = String(text ?? '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export async function sendTelegramMessage(text, options = {}) {
  const { enabled, token, chatIds, timeoutMs, messageThreadId } = getTelegramConfig();
  if (!enabled) return { ok: false, reason: 'disabled' };
  if (!token || chatIds.length === 0) return { ok: false, reason: 'not_configured' };

  const payloadBase = {
    text: truncate(text, 3900),
    disable_web_page_preview: true,
    ...(typeof options.disableWebPagePreview === 'boolean'
      ? { disable_web_page_preview: options.disableWebPagePreview }
      : {}),
    ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
  };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, ...payloadBase }),
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          const description = data?.description ? `: ${data.description}` : '';
          throw new Error(`Telegram send failed (${res.status})${description}`);
        }
        return { chatId, ok: true };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const ok = results.some((r) => r.status === 'fulfilled');
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason?.message || String(r.reason));

  if (!ok && errors.length) {
    // eslint-disable-next-line no-console
    console.error('[telegram] All sends failed:', errors.join(' | '));
  }

  return { ok, results, errors };
}

