// API utility – all calls to the Express backend
const BASE = process.env.REACT_APP_API_URL || '/api';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getConversations:   ()        => req('GET',    '/conversations'),
  getConversation:    (id)      => req('GET',    `/conversations/${id}`),
  createConversation: (body)    => req('POST',   '/conversations', body),
  updateConversation: (id, body)=> req('PATCH',  `/conversations/${id}`, body),
  deleteConversation: (id)      => req('DELETE', `/conversations/${id}`),
  search:             (q)       => req('GET',    `/search?q=${encodeURIComponent(q)}`),
  health:             ()        => req('GET',    '/health'),
};

// SSE streaming helper
export function streamChat(conversationId, message, onToken, onDone, onError) {
  const controller = new AbortController();

  fetch(`${BASE}/conversations/${conversationId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      onError(err.error || 'Stream failed');
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.error) { onError(payload.error); return; }
          if (payload.token) onToken(payload.token);
          if (payload.done)  onDone(payload);
        } catch {}
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err.message);
  });

  return controller; // caller can call controller.abort() to cancel
}

export function streamRegenerate(conversationId, onToken, onDone, onError) {
  const controller = new AbortController();

  fetch(`${BASE}/conversations/${conversationId}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      onError(err.error || 'Regenerate failed');
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.error) { onError(payload.error); return; }
          if (payload.token) onToken(payload.token);
          if (payload.done)  onDone(payload);
        } catch {}
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err.message);
  });

  return controller;
}
