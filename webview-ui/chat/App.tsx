import React, { useEffect, useRef } from 'react';
import './styles/chat.css';
import { useChat } from './hooks/useChat';

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};
const vscode = acquireVsCodeApi();

// Very lightweight markdown renderer (no external dependency needed)
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

const SUGGESTIONS = [
  'What tables do I have in my current file?',
  'Show me the schema of the orders table',
  'Are there any PII columns in this dataset?',
  'What are the data quality issues?',
  'Show me the lineage of this table',
];

export default function App(): React.ReactElement {
  const {
    messages,
    input,
    setInput,
    isStreaming,
    detectedTables,
    removeTable,
    agents,
    selectedAgent,
    setSelectedAgent,
    sendMessage,
    error,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const handleActionChip = (action: string, content: string) => {
    // Extract table names from the AI response and trigger actions
    if (action === 'lineage') {
      // Try to find a table FQN in recent response
      const fqnMatch = content.match(/`([^`]+\.[^`]+)`/);
      if (fqnMatch) {
        vscode.postMessage({ type: 'showLineage', fqn: fqnMatch[1] });
      }
    } else if (action === 'detail') {
      const fqnMatch = content.match(/`([^`]+\.[^`]+)`/);
      if (fqnMatch) {
        vscode.postMessage({ type: 'showAssetDetail', fqn: fqnMatch[1] });
      }
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="ml-app">
      {/* Header */}
      <div className="ml-header">
        <span className="ml-header-logo">🔭</span>
        <span className="ml-header-title">MetaLens</span>
        <span className="ml-header-subtitle">OpenMetadata AI Chat</span>
      </div>

      {/* Agent Selector */}
      <div className="ml-agent-bar">
        <span className="ml-agent-label">Agent:</span>
        <select
          className="ml-agent-select"
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
        >
          <option value="AskCollateAgent">AskCollateAgent</option>
          <option value="DataQualityPlannerAgent">DataQualityPlannerAgent</option>
          <option value="LineageAgent">LineageAgent</option>
          {agents
            .filter(a => !['AskCollateAgent', 'DataQualityPlannerAgent', 'LineageAgent'].includes(a.name))
            .map(a => (
              <option key={a.name} value={a.name}>
                {a.displayName ?? a.name}
              </option>
            ))}
        </select>
      </div>

      {/* Context Badges */}
      <div className="ml-context-bar">
        {detectedTables.length === 0 ? (
          <span className="ml-context-empty">No tables detected in current file</span>
        ) : (
          detectedTables.map(table => (
            <span
              key={table}
              className="ml-badge ml-badge-table"
              title={`Table context: ${table}`}
              onClick={() => removeTable(table)}
            >
              🗄 {table}
              <span className="ml-badge-remove">✕</span>
            </span>
          ))
        )}
      </div>

      {/* Messages */}
      <div className="ml-messages">
        {!hasMessages ? (
          <div className="ml-empty">
            <div className="ml-empty-icon">🔭</div>
            <div className="ml-empty-title">MetaLens AI Chat</div>
            <div className="ml-empty-subtitle">
              Ask questions about your data catalog, tables, lineage, or data quality.
              {detectedTables.length > 0 && (
                <><br />Context: {detectedTables.join(', ')}</>
              )}
            </div>
            <div className="ml-suggestions">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className="ml-suggestion-btn"
                  onClick={() => handleSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`ml-message ${msg.role}`}>
              <div className="ml-message-role">
                {msg.role === 'user' ? 'You' : 'MetaLens AI'}
              </div>
              <div className="ml-bubble">
                {msg.role === 'assistant' ? (
                  <>
                    <span
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                    {msg.streaming && <span className="ml-streaming-cursor" />}
                    {!msg.streaming && msg.content && (
                      <div className="ml-action-chips">
                        <button
                          className="ml-chip"
                          onClick={() => handleActionChip('lineage', msg.content)}
                        >
                          🔗 View Lineage
                        </button>
                        <button
                          className="ml-chip"
                          onClick={() => handleActionChip('detail', msg.content)}
                        >
                          📊 Asset Detail
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="ml-error-banner">
          ⚠️ {error}
        </div>
      )}

      {/* Input Area */}
      <div className="ml-input-area">
        <div className="ml-input-row">
          <textarea
            ref={textareaRef}
            className="ml-textarea"
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask MetaLens AI about your data catalog… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isStreaming}
          />
          <button
            className="ml-send-btn"
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            title="Send message"
          >
            {isStreaming ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}
