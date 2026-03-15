import { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FaGithub } from 'react-icons/fa';
import './WelcomeModal.css';

const CREDENTIALS = [
  { label: 'Regular user', email: 'john@email.com', password: '123456' },
  { label: 'Admin user', email: 'admin@email.com', password: '123456' },
];

const WelcomeModal = ({ show, onHide, onLogin }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleLogin = () => {
    onHide();
    if (onLogin) onLogin();
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      className='welcome-modal'
      size='md'
    >
      <Modal.Body>
        <h2 className='welcome-headline'>AI-Powered E-Commerce Agent</h2>
        <p className='welcome-oneliner'>
          An intelligent shopping assistant built on top of{' '}
          <a
            href='https://github.com/bradtraversy/proshop-v2'
            target='_blank'
            rel='noopener noreferrer'
          >
            Brad Traversy&apos;s ProShop
          </a>
          . I added an AI agent layer with tool-calling that can search products,
          manage orders, handle reviews, and more &mdash; all through natural
          conversation.
        </p>

        {/* Demo Credentials */}
        <div className='welcome-credentials'>
          <h6>Demo Credentials</h6>
          {CREDENTIALS.map((cred) => (
            <div key={cred.email}>
              <div className='welcome-cred-row'>
                <span className='welcome-cred-label'>{cred.label}</span>
                <span className='welcome-cred-value'>{cred.email}</span>
                <button
                  className={`welcome-copy-btn ${copiedField === cred.email ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(cred.email, cred.email)}
                >
                  {copiedField === cred.email ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className='welcome-cred-row'>
                <span className='welcome-cred-label'>Password</span>
                <span className='welcome-cred-value'>{cred.password}</span>
                <button
                  className={`welcome-copy-btn ${copiedField === `${cred.email}-pw` ? 'copied' : ''}`}
                  onClick={() =>
                    copyToClipboard(cred.password, `${cred.email}-pw`)
                  }
                >
                  {copiedField === `${cred.email}-pw` ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button variant='primary' className='welcome-cta' onClick={handleLogin}>
          Login &amp; Try It
        </Button>

        {/* Notes */}
        <p className='welcome-note'>
          Database resets every hour &mdash; feel free to experiment!
        </p>
        <p className='welcome-note-small'>
          This demo uses a free-tier LLM API (GLM-4.7 Flash) which may
          occasionally be slow or unavailable due to rate limits. If the agent
          isn&apos;t responding, try again in a minute.
        </p>

        {/* Technical Details */}
        <button
          className='welcome-details-toggle'
          onClick={() => setShowDetails(!showDetails)}
        >
          <span
            className={`welcome-details-arrow ${showDetails ? 'open' : ''}`}
          >
            &#9654;
          </span>
          Show More &mdash; Technical Details
        </button>

        {showDetails && (
          <div className='welcome-details-content'>
            <h6>Agent Capabilities</h6>
            <ul>
              <li>
                <strong>Products:</strong> search, create, update, delete
              </li>
              <li>
                <strong>Orders:</strong> view, track, mark delivered
              </li>
              <li>
                <strong>Users:</strong> profile management, admin user management
              </li>
              <li>
                <strong>Cart:</strong> add, remove, clear via conversation
              </li>
              <li>
                <strong>Navigation:</strong> route to any page
              </li>
            </ul>

            <h6>Tech Stack</h6>
            <ul>
              <li>LLM provider with tool-calling architecture</li>
              <li>SSE streaming for real-time responses</li>
              <li>React + Redux frontend</li>
              <li>MongoDB + Express backend</li>
            </ul>

            <h6>Architecture</h6>
            <p>
              User message &rarr; LLM with tools &rarr; Tool execution &rarr;
              Streamed response
            </p>
          </div>
        )}

        {/* GitHub */}
        <div className='welcome-github'>
          <a
            href='https://github.com/anand-bhagat/proshop-v2'
            target='_blank'
            rel='noopener noreferrer'
          >
            <FaGithub /> View on GitHub
          </a>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default WelcomeModal;
