import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import WelcomeScreen from './components/WelcomeScreen';
import { api } from './hooks/useApi';
import toast from 'react-hot-toast';

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // ── Load all conversations ───────────────────────────────────────────────────
  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch {
      toast.error('Could not load conversations');
    }
  };

  useEffect(() => { loadConversations(); }, []);

  // ── Create new conversation ──────────────────────────────────────────────────
  const handleNew = async (opts = {}) => {
    try {
      const conv = await api.createConversation(opts);
      setConversations(prev => [conv, ...prev]);
      setActiveId(conv._id);
      navigate(`/chat/${conv._id}`);
    } catch {
      toast.error('Could not start conversation');
    }
  };

  // ── Delete conversation ──────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.deleteConversation(id);
      setConversations(prev => prev.filter(c => c._id !== id));
      if (activeId === id) {
        setActiveId(null);
        navigate('/');
      }
    } catch {
      toast.error('Could not delete conversation');
    }
  };

  // ── Refresh a single conversation (after chat / settings change) ─────────────
  const refreshConversation = async (id) => {
    try {
      const updated = await api.getConversation(id);
      setConversations(prev => prev.map(c => c._id === id ? { ...c, ...updated } : c));
    } catch {}
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => { setActiveId(id); navigate(`/chat/${id}`); }}
        onNew={handleNew}
        onDelete={handleDelete}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={loadConversations}
      />

      {/* Main content */}
      <main className={`main-content ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <Routes>
          <Route path="/" element={<WelcomeScreen onNew={handleNew} />} />
          <Route
            path="/chat/:id"
            element={
              <ChatWindowWrapper
                onTitleChange={refreshConversation}
                onConversationUpdate={loadConversations}
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function ChatWindowWrapper({ onTitleChange, onConversationUpdate }) {
  const { id } = useParams();
  return (
    <ChatWindow
      key={id}
      conversationId={id}
      onTitleChange={onTitleChange}
      onConversationUpdate={onConversationUpdate}
    />
  );
}
