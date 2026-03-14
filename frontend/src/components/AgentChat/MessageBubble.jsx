import ToolResultRenderer from './ToolResultRenderer';

const MessageBubble = ({ message }) => {
  if (message.role === 'status') {
    return <div className='agent-chat-bubble agent-chat-bubble-status'>{message.content}</div>;
  }

  const isUser = message.role === 'user';

  return (
    <div
      className={`agent-chat-bubble ${
        isUser ? 'agent-chat-bubble-user' : 'agent-chat-bubble-agent'
      }`}
    >
      {message.content}
      {message.toolResults && <ToolResultRenderer result={message.toolResults} />}
    </div>
  );
};

export default MessageBubble;
