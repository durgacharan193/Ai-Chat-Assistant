import React from 'react';
import { Plus } from 'lucide-react';

const QUICK_STARTERS = [
  {
    icon: '💡',
    title: 'Explain a concept',
    desc: 'Get clear, detailed explanations on any topic',
    prompt: 'Explain the concept of ',
    tone: 'Professional',
  },
  {
    icon: '✍️',
    title: 'Write something',
    desc: 'Draft emails, essays, stories, and more',
    prompt: 'Write a ',
    tone: 'Casual',
  },
  {
    icon: '🧮',
    title: 'Solve a problem',
    desc: 'Get help with math, code, or logic puzzles',
    prompt: 'Help me solve ',
    tone: 'Concise',
  },
  {
    icon: '🌐',
    title: 'Translate text',
    desc: 'Translate content across 8 languages',
    prompt: 'Translate the following to ',
    tone: 'Concise',
  },
];

export default function WelcomeScreen({ onNew }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-logo">✦</div>

      <div>
        <h1 className="welcome-title">AI Chat Assistant</h1>
        <p className="welcome-subtitle">
          A powerful AI chat interface with streaming responses, conversation history,
          tone customization, multilingual support, and smart tagging.
        </p>
      </div>

      <div className="quick-actions">
        {QUICK_STARTERS.map((item) => (
          <button
            key={item.title}
            className="quick-card"
            onClick={() => onNew({ tone: item.tone })}
          >
            <div className="quick-card-icon">{item.icon}</div>
            <div className="quick-card-title">{item.title}</div>
            <div className="quick-card-desc">{item.desc}</div>
          </button>
        ))}
      </div>

      <button
        className="new-chat-btn"
        onClick={() => onNew()}
        style={{ fontSize: 15, padding: '12px 24px' }}
      >
        <Plus size={18} />
        Start a new conversation
      </button>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 480 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Features:</strong>{' '}
        Real-time streaming · MongoDB persistence · Tone Toggle (Professional / Casual / Concise) ·
        Multilingual responses · Smart conversation tagging · Regenerate response · Pinned conversations
      </div>
    </div>
  );
}
