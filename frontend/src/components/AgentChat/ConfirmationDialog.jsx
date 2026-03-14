const ConfirmationDialog = ({ confirmation, onConfirm, onCancel }) => {
  return (
    <div className='agent-chat-confirmation'>
      <p>{confirmation.message || `Proceed with ${confirmation.tool}?`}</p>
      <div className='agent-chat-confirmation-actions'>
        <button className='agent-chat-btn-cancel' onClick={onCancel}>
          Cancel
        </button>
        <button
          className='agent-chat-btn-confirm'
          onClick={() => onConfirm(confirmation)}
        >
          Yes, proceed
        </button>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
