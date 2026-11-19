import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, StopCircle, RefreshCw, Copy, ThumbsUp, Hash, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { api, streamChat, streamRegenerate } from '../hooks/useApi';

const TONES = ['Professional', 'Casual', 'Concise'];
const LANGUAGES = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'ar', label: '🇸🇦 Arabic' },
];

export default function ChatWindow({ conversationId, onTitleChange, onConversationUpdate }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const controllerRef = useRef(null);

  // ── Load conversation ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    api.getConversation(conversationId)
      .then(conv => {
        setConversation(conv);
        setMessages(conv.messages || []);
      })
      .catch(() => toast.error('Could not load conversation'))
      .finally(() => setLoading(false));
  }, [conversationId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setStreaming(true);
    setStreamingText('');

    // Optimistically add user message
    setMessages(prev => [...prev, {
      _id: 'pending-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }]);

    controllerRef.current = streamChat(
      conversationId,
      text,
      (token) => setStreamingText(prev => prev + token),
      (payload) => {
        setStreaming(false);
        const aiMsg = {
          _id: 'ai-' + Date.now(),
          role: 'assistant',
          content: streamingText + (payload.remaining || ''),
          timestamp: new Date().toISOString(),
        };
        // Reload full conversation to get persisted data
        api.getConversation(conversationId).then(conv => {
          setConversation(conv);
          setMessages(conv.messages || []);
          setStreamingText('');
          onTitleChange?.(conversationId);
          onConversationUpdate?.();
        });
      },
      (err) => {
        setStreaming(false);
        setStreamingText('');
        toast.error('Error: ' + err);
      }
    );
  }, [input, streaming, conversationId, streamingText, onTitleChange, onConversationUpdate]);

  // ── Stop streaming ─────────────────────────────────────────────────────────
  const handleStop = () => {
    controllerRef.current?.abort();
    setStreaming(false);
    if (streamingText) {
      setMessages(prev => [...prev, {
        _id: 'ai-stopped-' + Date.now(),
        role: 'assistant',
        content: streamingText + ' _(stopped)_',
        timestamp: new Date().toISOString(),
      }]);
      setStreamingText('');
    }
  };

  // ── Regenerate last response ───────────────────────────────────────────────
  const handleRegenerate = () => {
    setStreaming(true);
    setStreamingText('');
    // Remove last AI message optimistically
    setMessages(prev => {
      const msgs = [...prev];
      if (msgs[msgs.length - 1]?.role === 'assistant') msgs.pop();
      return msgs;
    });

    controllerRef.current = streamRegenerate(
      conversationId,
      (token) => setStreamingText(prev => prev + token),
      () => {
        setStreaming(false);
        api.getConversation(conversationId).then(conv => {
          setConversation(conv);
          setMessages(conv.messages || []);
          setStreamingText('');
        });
      },
      (err) => {
        setStreaming(false);
        setStreamingText('');
        toast.error('Regenerate error: ' + err);
      }
    );
  };

  // ── Tone change ────────────────────────────────────────────────────────────
  const handleToneChange = async (tone) => {
    try {
      const updated = await api.updateConversation(conversationId, { tone });
      setConversation(updated);
      toast.success(`Tone set to ${tone}`);
    } catch {
      toast.error('Could not update tone');
    }
  };

  // ── Language change ────────────────────────────────────────────────────────
  const handleLangChange = async (language) => {
    try {
      const updated = await api.updateConversation(conversationId, { language });
      setConversation(updated);
    } catch {
      toast.error('Could not update language');
    }
  };

  // ── Add tag ────────────────────────────────────────────────────────────────
  const handleAddTag = async () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || conversation?.tags?.includes(tag)) { setTagInput(''); return; }
    try {
      const tags = [...(conversation.tags || []), tag];
      const updated = await api.updateConversation(conversationId, { tags });
      setConversation(updated);
      setTagInput('');
      onConversationUpdate?.();
    } catch {
      toast.error('Could not add tag');
    }
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  if (loading) {
    return (
      <div className="chat-window" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="typing-dots">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Top bar */}
      <div className="chat-topbar">
        <div className="chat-topbar-title">{conversation?.title || 'Chat'}</div>

        {/* Tone Toggle – The Vibe Check */}
        <div className="tone-selector">
          {TONES.map(t => (
            <button
              key={t}
              className={`tone-btn ${conversation?.tone === t ? 'active' : ''}`}
              onClick={() => handleToneChange(t)}
              title={`Switch to ${t} tone`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Extra Feature 1: Language Selector */}
        <select
          className="lang-select"
          value={conversation?.language || 'en'}
          onChange={e => handleLangChange(e.target.value)}
          title="Response language"
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        {/* Extra Feature 2: Tag button */}
        <button
          className="icon-btn"
          onClick={() => setShowTagInput(v => !v)}
          title="Add tag / bookmark"
          style={{ padding: 6 }}
        >
          <Hash size={15} />
        </button>

        {/* Model badge */}
        <span style={{
          fontSize: 11, color: 'var(--text-muted)',
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '4px 8px',
        }}>
          {conversation?.model === 'claude' ? '⚡ Claude' : '✨ GPT'}
        </span>
      </div>

      {/* Tag bar */}
      {showTagInput && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)',
          flexWrap: 'wrap',
        }}>
          {conversation?.tags?.map(t => (
            <TagChip
              key={t}
              tag={t}
              onRemove={async () => {
                const tags = conversation.tags.filter(x => x !== t);
                const updated = await api.updateConversation(conversationId, { tags });
                setConversation(updated);
              }}
            />
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
            placeholder="Add tag…"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-secondary)', fontSize: 12, minWidth: 80,
            }}
          />
          <button
            onClick={handleAddTag}
            style={{
              fontSize: 12, color: 'var(--accent)',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >Add</button>
        </div>
      )}

      {/* Messages area */}
      <div className="messages-area">
        {messages.length === 0 && !streaming && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 14 }}>
            Start the conversation below ✨
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={msg._id || i} message={msg} isLast={i === messages.length - 1} />
        ))}

        {/* Streaming AI response */}
        {streaming && (
          <div className="message-row assistant">
            <div className="avatar ai">AI</div>
            <div className="bubble-wrap">
              <div className="bubble assistant">
                {streamingText ? (
                  <>
                    <MarkdownContent content={streamingText} />
                    <span className="streaming-cursor" />
                  </>
                ) : (
                  <div className="typing-dots">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Regenerate button */}
      {!streaming && messages.length >= 2 && messages[messages.length - 1]?.role === 'assistant' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 0' }}>
          <button
            onClick={handleRegenerate}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              borderRadius: 999, padding: '5px 14px', cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
            Regenerate response
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="input-area">
        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Message AI Chat Assistant… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          {streaming ? (
            <button className="send-btn" onClick={handleStop} title="Stop generating" style={{ background: 'var(--danger)' }}>
              <StopCircle size={18} />
            </button>
          ) : (
            <button className="send-btn" onClick={handleSend} disabled={!input.trim()} title="Send message">
              <Send size={18} />
            </button>
          )}
        </div>
        <div className="input-hint">
          Tone: <strong>{conversation?.tone}</strong>
          {conversation?.language !== 'en' && ` · Language: ${conversation?.language?.toUpperCase()}`}
          {conversation?.tags?.length > 0 && ` · Tags: ${conversation.tags.join(', ')}`}
        </div>
      </div>
    </div>
  );
}

// ── Individual message bubble ─────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const initials = isUser ? 'You' : 'AI';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied!');
  };

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && <div className="avatar ai">{initials}</div>}
      <div className="bubble-wrap">
        <div className={`bubble ${isUser ? 'user' : 'assistant'}`}>
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>
        <div className="bubble-actions">
          <button className="icon-btn" onClick={handleCopy} title="Copy">
            <Copy size={12} />
          </button>
          {!isUser && (
            <button className="icon-btn" title="Helpful">
              <ThumbsUp size={12} />
            </button>
          )}
          <span className="bubble-time">
            {message.timestamp
              ? formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })
              : ''}
          </span>
        </div>
      </div>
      {isUser && <div className="avatar user">{initials[0]}</div>}
    </div>
  );
}

// ── Markdown renderer with syntax highlighting ────────────────────────────────
function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              customStyle={{ borderRadius: 8, fontSize: 13, margin: '8px 0' }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>{children}</code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Tag chip ──────────────────────────────────────────────────────────────────
function TagChip({ tag, onRemove }) {
  return (
    <span className="tag">
      #{tag}
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
      >
        ×
      </button>
    </span>
  );
}
