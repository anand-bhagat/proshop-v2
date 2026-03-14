import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

const MessageList = ({
  messages,
  isLoading,
  statusMessage,
  suggestedPrompts,
  onSuggestedPrompt,
}) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages or status changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, statusMessage]);

  // Empty state with suggested prompts
  if (messages.length === 0 && !isLoading && suggestedPrompts) {
    return (
      <div className='agent-chat-messages'>
        <div className='agent-chat-suggestions'>
          <p>How can I help you today?</p>
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              className='agent-chat-suggestion-btn'
              onClick={() => onSuggestedPrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='agent-chat-messages'>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && (
        <div className='agent-chat-status-indicator'>
          <div className='agent-chat-status-dot'></div>
          <span>{statusMessage || 'Thinking...'}</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
