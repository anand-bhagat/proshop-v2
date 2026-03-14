import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const MessageList = ({
  messages,
  isLoading,
  suggestedPrompts,
  onSuggestedPrompt,
}) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Empty state with suggested prompts
  if (messages.length === 0 && suggestedPrompts) {
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
      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
