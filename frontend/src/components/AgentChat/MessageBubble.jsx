import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ToolResultRenderer from './ToolResultRenderer';

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div
      className={`agent-chat-bubble ${
        isUser ? 'agent-chat-bubble-user' : 'agent-chat-bubble-agent'
      }`}
    >
      {isUser ? (
        message.content
      ) : (
        <div className='agent-chat-markdown'>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      )}
      {message.toolResults && <ToolResultRenderer result={message.toolResults} />}
    </div>
  );
};

export default MessageBubble;
