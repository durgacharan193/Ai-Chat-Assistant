import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare, Plus, Pin, Trash2, Search, ChevronLeft, ChevronRight,
  Sparkles, Zap, Hash,
} from 'lucide-react';
import { api } from '../hooks/useApi';

const TONES = ['Professional', 'Casual', 'Concise'];

export default function Sidebar({
  conversations, activeId, onSelect, onNew, onDelete,
  isOpen, onToggle, searchQuery, setSearchQuery, onRefresh,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [newOpts, setNewOpts] = useState({ tone: 'Professional', model: 'openai' });

  // ── Filter by search ──────────────────────────────────────────────────────
  const filtered = conversations.filter(c =>
    !searchQuery ||
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinned = filtered.filter(c => c.isPinned);
  const recent = filtered.filter(c => !c.isPinned);

  // ── Group recent by date ──────────────────────────────────────────────────
  const groups = groupByDate(recent);

  return (
    <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
      {/* Header */}
      <div className="sidebar-header">
        {isOpen && <span className="sidebar-logo">✦ AI Chat</span>}
        <button className="sidebar-toggle icon-btn" onClick={onToggle} title="Toggle sidebar">
          {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {isOpen && (
        <>
          {/* Search */}
          <div className="search-box">
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="search-input"
                style={{ paddingLeft: 30 }}
                placeholder="Search conversations…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* New chat with quick options */}
          <div style={{ padding: '0 12px 10px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <select
                className="model-select"
                value={newOpts.model}
                onChange={e => setNewOpts(o => ({ ...o, model: e.target.value }))}
                style={{ flex: 1 }}
              >
                <option value="openai">GPT-4o Mini</option>
                <option value="claude">Claude 3.5</option>
              </select>
              <select
                className="lang-select"
                value={newOpts.tone}
                onChange={e => setNewOpts(o => ({ ...o, tone: e.target.value }))}
                style={{ flex: 1 }}
              >
                {TONES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <button className="new-chat-btn" onClick={() => onNew(newOpts)}>
              <Plus size={16} />
              New Chat
            </button>
          </div>

          {/* Conversation list */}
          <div className="conv-list">
            {/* Pinned */}
            {pinned.length > 0 && (
              <>
                <div className="conv-group-label">📌 Pinned</div>
                {pinned.map(c => (
                  <ConvItem
                    key={c._id}
                    conv={c}
                    isActive={activeId === c._id}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onRefresh={onRefresh}
                    hovered={hoveredId === c._id}
                    setHovered={setHoveredId}
                  />
                ))}
              </>
            )}

            {/* Grouped recent */}
            {Object.entries(groups).map(([label, items]) => (
              <React.Fragment key={label}>
                <div className="conv-group-label">{label}</div>
                {items.map(c => (
                  <ConvItem
                    key={c._id}
                    conv={c}
                    isActive={activeId === c._id}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onRefresh={onRefresh}
                    hovered={hoveredId === c._id}
                    setHovered={setHoveredId}
                  />
                ))}
              </React.Fragment>
            ))}

            {filtered.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </div>
            )}
          </div>
        </>
      )}

      {/* Collapsed: icon-only new chat */}
      {!isOpen && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="icon-btn" onClick={() => onNew()} title="New chat" style={{ padding: 8 }}>
            <Plus size={18} />
          </button>
        </div>
      )}
    </aside>
  );
}

// ── Individual conversation item ──────────────────────────────────────────────
function ConvItem({ conv, isActive, onSelect, onDelete, onRefresh, hovered, setHovered }) {
  const toneColor = { Professional: '#6366f1', Casual: '#10b981', Concise: '#f59e0b' };
  const modelIcon = conv.model === 'claude' ? <Zap size={10} /> : <Sparkles size={10} />;

  return (
    <div
      className={`conv-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(conv._id)}
      onMouseEnter={() => setHovered(conv._id)}
      onMouseLeave={() => setHovered(null)}
    >
      <MessageSquare size={14} style={{ color: toneColor[conv.tone] || 'var(--text-muted)', flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="conv-title">{conv.title || 'New Conversation'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
            {modelIcon} {conv.model === 'claude' ? 'Claude' : 'GPT'}
          </span>
          {conv.language && conv.language !== 'en' && (
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>· {conv.language.toUpperCase()}</span>
          )}
          {conv.tags?.slice(0, 2).map(t => (
            <span key={t} style={{ color: 'var(--text-muted)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Hash size={8} />{t}
            </span>
          ))}
        </div>
      </div>

      {/* Actions (visible on hover) */}
      <div className="conv-actions">
        <PinToggle conv={conv} onRefresh={onRefresh} />
        <button
          className="icon-btn danger"
          onClick={e => { e.stopPropagation(); onDelete(conv._id); }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {!hovered && (
        <span className="conv-meta">
          {formatDistanceToNow(new Date(conv.updatedAt || conv.createdAt), { addSuffix: true })}
        </span>
      )}
    </div>
  );
}

function PinToggle({ conv, onRefresh }) {
  const handlePin = async (e) => {
    e.stopPropagation();
    await api.updateConversation(conv._id, { isPinned: !conv.isPinned });
    onRefresh();
  };
  return (
    <button className="icon-btn" onClick={handlePin} title={conv.isPinned ? 'Unpin' : 'Pin'}>
      <Pin size={13} style={{ color: conv.isPinned ? 'var(--warning)' : undefined }} />
    </button>
  );
}

// ── Date grouping helper ──────────────────────────────────────────────────────
function groupByDate(items) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const week = new Date(today); week.setDate(today.getDate() - 7);

  const groups = {};
  for (const item of items) {
    const d = new Date(item.updatedAt || item.createdAt);
    let label;
    if (d >= today)         label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= week)      label = 'Past 7 days';
    else                     label = 'Older';
    (groups[label] = groups[label] || []).push(item);
  }
  return groups;
}
