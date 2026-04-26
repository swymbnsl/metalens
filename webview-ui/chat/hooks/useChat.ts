import { useState, useEffect, useRef, useCallback } from 'react';

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

export const vscode = acquireVsCodeApi();

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  timestamp: number;
}

interface UseChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  detectedTables: string[];
  removeTable: (t: string) => void;
  agents: { name: string; displayName?: string }[];
  selectedAgent: string;
  setSelectedAgent: (a: string) => void;
  sendMessage: () => void;
  error: string | null;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectedTables, setDetectedTables] = useState<string[]>([]);
  const [agents, setAgents] = useState<{ name: string; displayName?: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Notify host that webview is ready
    vscode.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent) => {
      const msg = event.data as { type: string; [key: string]: unknown };

      switch (msg.type) {
        case 'seedContext': {
          const tables = msg.tables as string[];
          setDetectedTables(prev => [...new Set([...prev, ...tables])]);
          break;
        }

        case 'config': {
          if (msg.defaultAgent) setSelectedAgent(String(msg.defaultAgent));
          break;
        }

        case 'agentList': {
          const agentList = msg.agents as { name: string; displayName?: string }[];
          if (agentList?.length > 0) {
            setAgents(agentList);
            setSelectedAgent(prev => prev || agentList[0].name);
          }
          break;
        }

        case 'startStream': {
          const id = `msg-${Date.now()}`;
          streamingIdRef.current = id;
          setIsStreaming(true);
          setError(null);
          setMessages(prev => [
            ...prev,
            { id, role: 'assistant', content: '', streaming: true, timestamp: Date.now() },
          ]);
          break;
        }

        case 'chunk': {
          const chunk = String(msg.content ?? '');
          if (streamingIdRef.current) {
            const sid = streamingIdRef.current;
            setMessages(prev =>
              prev.map(m => m.id === sid ? { ...m, content: m.content + chunk } : m)
            );
          }
          break;
        }

        case 'endStream': {
          if (streamingIdRef.current) {
            const sid = streamingIdRef.current;
            setMessages(prev =>
              prev.map(m => m.id === sid ? { ...m, streaming: false } : m)
            );
          }
          streamingIdRef.current = null;
          setIsStreaming(false);
          break;
        }

        case 'error': {
          setError(String(msg.message ?? 'Unknown error'));
          setIsStreaming(false);
          if (streamingIdRef.current) {
            const sid = streamingIdRef.current;
            setMessages(prev =>
              prev.map(m => m.id === sid ? { ...m, streaming: false } : m)
            );
          }
          streamingIdRef.current = null;
          break;
        }

        case 'autoQuery': {
          // Triggered by explainQuery command
          const text = String(msg.text ?? '');
          if (text) {
            setInput(text);
            // Auto-send after brief delay
            setTimeout(() => {
              sendMessageWith(text);
            }, 100);
          }
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validate and auto-select agent
  useEffect(() => {
    if (agents.length > 0 && selectedAgent) {
      const valid = agents.some(a => a.name === selectedAgent);
      if (!valid) {
        setSelectedAgent(agents[0].name);
      }
    }
  }, [agents, selectedAgent]);

  const sendMessageWith = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    vscode.postMessage({
      type: 'sendMessage',
      text,
      agentName: selectedAgent,
      context: detectedTables,
    });
  }, [isStreaming, selectedAgent, detectedTables]);

  const sendMessage = useCallback(() => {
    if (!input.trim()) return;
    sendMessageWith(input);
    setInput('');
  }, [input, sendMessageWith]);

  const removeTable = useCallback((table: string) => {
    setDetectedTables(prev => prev.filter(t => t !== table));
  }, []);

  return {
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
  };
}
