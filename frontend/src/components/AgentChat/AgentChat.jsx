import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { addToCart, removeFromCart, clearCartItems } from '../../slices/cartSlice';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ConfirmationDialog from './ConfirmationDialog';
import './AgentChat.css';

// ── Helpers ────────────────────────────────────────────────────────────

let msgIdCounter = 0;
const generateId = () => `msg-${Date.now()}-${++msgIdCounter}`;

const SUGGESTED_PROMPTS = {
  user: [
    'Show me my recent orders',
    "What's the status of my last order?",
    'Find products under $50',
  ],
  admin: [
    "Show me today's orders",
    'List all users',
    'Show top products',
  ],
};

// ── Component ──────────────────────────────────────────────────────────

const AgentChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [error, setError] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const { userInfo } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Keep a ref of conversationId for use in async callbacks
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // Escape key closes the widget
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ── API helper ─────────────────────────────────────────────────────

  const callAgentApi = async (body) => {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Agent error: ${res.status}`);
    }
    return res.json();
  };

  // ── Frontend dispatch actions ──────────────────────────────────────

  const executeFrontendDispatch = async (action, params) => {
    switch (action) {
      case 'addToCart': {
        const res = await fetch(`/api/products/${params.product_id}`);
        if (!res.ok) throw new Error('Product not found');
        const product = await res.json();
        if (params.qty > product.countInStock) {
          return {
            success: false,
            error: `Only ${product.countInStock} in stock`,
          };
        }
        dispatch(addToCart({ ...product, qty: params.qty }));
        return {
          success: true,
          message: `Added ${product.name} (qty: ${params.qty}) to cart`,
        };
      }
      case 'removeFromCart':
        dispatch(removeFromCart(params.product_id));
        return { success: true, message: 'Item removed from cart' };
      case 'clearCartItems':
        dispatch(clearCartItems());
        return { success: true, message: 'Cart cleared' };
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  };

  // ── Frontend navigation ────────────────────────────────────────────

  const executeFrontendNavigate = (route, params) => {
    let resolved = route;
    if (route.includes(':id') && params) {
      const id = params.product_id || params.order_id;
      if (id) resolved = route.replace(':id', id);
    }
    navigate(resolved);
    return { success: true, message: `Navigated to ${resolved}` };
  };

  // ── Handle agent response (recursive for agentic loop) ─────────────

  const handleAgentResponse = async (data) => {
    if (data.conversationId) {
      setConversationId(data.conversationId);
      conversationIdRef.current = data.conversationId;
    }

    if (data.type === 'confirmation_needed') {
      setPendingConfirmation(data);
      setIsLoading(false);
    } else if (data.type === 'frontend_action') {
      await handleFrontendAction(data);
    } else if (data.type === 'response') {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'agent',
          content: data.message,
          toolResults: data.toolResults || null,
          timestamp: Date.now(),
        },
      ]);
      setIsLoading(false);
    } else if (data.type === 'error') {
      setError(data.message || 'An error occurred');
      setIsLoading(false);
    } else {
      // Unknown type — treat as text response
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'agent',
            content: data.message,
            timestamp: Date.now(),
          },
        ]);
      }
      setIsLoading(false);
    }
  };

  // ── SSE stream processor (shared by sendMessage and frontend result callback)

  const processSSEStream = async (res) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let agentContent = '';
    let agentMsgId = null;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr);

          if (event.type === 'status') {
            setStatusMessage(event.message);
          } else if (event.type === 'text_delta') {
            // Clear status once text starts streaming
            if (!agentMsgId) {
              agentMsgId = generateId();
              setStatusMessage(null);
              setMessages((prev) => [
                ...prev,
                { id: agentMsgId, role: 'agent', content: '', timestamp: Date.now() },
              ]);
            }
            agentContent += event.content;
            const capturedId = agentMsgId;
            const capturedContent = agentContent;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === capturedId ? { ...m, content: capturedContent } : m
              )
            );
          } else if (event.type === 'tool_start' || event.type === 'tool_result') {
            // Intermediate agentic loop events — status already handled by engine
          } else if (event.type === 'frontend_action') {
            setStatusMessage(null);
            await handleFrontendAction(event);
            return;
          } else if (event.type === 'confirmation_needed') {
            setStatusMessage(null);
            setPendingConfirmation(event);
            setIsLoading(false);
            return;
          } else if (event.type === 'error') {
            setStatusMessage(null);
            if (event.conversationId) {
              setConversationId(event.conversationId);
              conversationIdRef.current = event.conversationId;
            }
            setError(event.message || 'An error occurred');
            setIsLoading(false);
            return;
          } else if (event.type === 'done') {
            setStatusMessage(null);
            if (event.conversationId) {
              setConversationId(event.conversationId);
              conversationIdRef.current = event.conversationId;
            }
            break;
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }

    setStatusMessage(null);
    setIsLoading(false);
  };

  // ── Streaming fetch helper ──────────────────────────────────────────

  const fetchSSE = async (body) => {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Agent error: ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      await processSSEStream(res);
    } else {
      // Fallback: server returned plain JSON
      setStatusMessage(null);
      const data = await res.json();
      await handleAgentResponse(data);
    }
  };

  // ── Handle frontend action from engine ─────────────────────────────

  const handleFrontendAction = async (data) => {
    const { tool, actionType, params, route, action } = data;

    let result;
    try {
      if (actionType === 'dispatch') {
        result = await executeFrontendDispatch(action, params);
      } else if (actionType === 'navigate') {
        result = executeFrontendNavigate(route, params);
      } else {
        result = { success: false, error: `Unknown action type: ${actionType}` };
      }
    } catch (err) {
      result = { success: false, error: err.message };
    }

    // Report result back to engine via streaming so we get real-time
    // status updates if the LLM chains more tools after this
    try {
      await fetchSSE({
        frontendResult: { tool, toolCallId: data.toolCallId, ...result },
        conversationId: conversationIdRef.current,
      });
    } catch (err) {
      setStatusMessage(null);
      setError(err.message);
      setIsLoading(false);
    }
  };

  // ── Send message (non-streaming) ───────────────────────────────────

  const sendMessage = async (userMessage) => {
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      },
    ]);
    setIsLoading(true);
    setError(null);

    try {
      const data = await callAgentApi({
        message: userMessage,
        conversationId: conversationIdRef.current,
      });
      await handleAgentResponse(data);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // ── Send message (streaming via SSE) ───────────────────────────────

  const sendMessageStreaming = async (userMessage) => {
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      },
    ]);
    setIsLoading(true);
    setStatusMessage(null);
    setError(null);

    try {
      await fetchSSE({
        message: userMessage,
        conversationId: conversationIdRef.current,
      });
    } catch (err) {
      setStatusMessage(null);
      setError(err.message);
      setIsLoading(false);
    }
  };

  // ── Confirmation handlers ──────────────────────────────────────────

  const handleConfirm = async (confirmation) => {
    setPendingConfirmation(null);
    setIsLoading(true);
    try {
      const data = await callAgentApi({
        message: `Yes, confirmed: ${confirmation.tool}`,
        conversationId: conversationIdRef.current,
      });
      await handleAgentResponse(data);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setPendingConfirmation(null);
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'agent',
        content: 'Action cancelled.',
        timestamp: Date.now(),
      },
    ]);
  };

  // ── Clear conversation ─────────────────────────────────────────────

  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
    setError(null);
    setPendingConfirmation(null);
  };

  // ── Retry last message ─────────────────────────────────────────────

  const retryLastMessage = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      setError(null);
      sendMessageStreaming(lastUserMsg.content);
    }
  };

  // ── Send handler ───────────────────────────────────────────────────
  // Use streaming to get real-time status updates during the agentic loop.

  const handleSend = (message) => {
    sendMessageStreaming(message);
  };

  // ── Render ─────────────────────────────────────────────────────────

  const role = userInfo?.isAdmin ? 'admin' : userInfo ? 'user' : null;
  const prompts = SUGGESTED_PROMPTS[role] || SUGGESTED_PROMPTS.user;

  return (
    <>
      <button
        className='agent-chat-trigger'
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open chat assistant'}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {isOpen && (
        <div className='agent-chat-drawer'>
          <div className='agent-chat-header'>
            <span>ProShop Assistant</span>
            <div>
              {messages.length > 0 && (
                <button
                  className='agent-chat-clear-btn'
                  onClick={clearConversation}
                  title='Clear conversation'
                >
                  Clear
                </button>
              )}
              <button
                className='agent-chat-close-btn'
                onClick={() => setIsOpen(false)}
                aria-label='Close chat'
              >
                ✕
              </button>
            </div>
          </div>

          <MessageList
            messages={messages}
            isLoading={isLoading}
            statusMessage={statusMessage}
            suggestedPrompts={messages.length === 0 ? prompts : null}
            onSuggestedPrompt={handleSend}
          />

          {pendingConfirmation && (
            <ConfirmationDialog
              confirmation={pendingConfirmation}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          )}

          {error && (
            <div className='agent-chat-error'>
              <span>{error}</span>
              <button onClick={retryLastMessage}>Retry</button>
            </div>
          )}

          <ChatInput
            onSend={handleSend}
            disabled={isLoading || !!pendingConfirmation}
          />
        </div>
      )}
    </>
  );
};

export default AgentChat;
