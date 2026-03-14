import { useState } from 'react';

const ChatInput = ({ onSend, disabled }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <form className='agent-chat-input' onSubmit={handleSubmit}>
      <input
        type='text'
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Ask the assistant...'
        disabled={disabled}
        autoFocus
      />
      <button
        type='submit'
        className='agent-chat-send-btn'
        disabled={disabled || !text.trim()}
        aria-label='Send message'
      >
        &#9654;
      </button>
    </form>
  );
};

export default ChatInput;
