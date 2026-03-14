const DISPLAY_LABELS = {
  _id: 'ID',
  isPaid: 'Paid',
  isDelivered: 'Delivered',
  isAdmin: 'Admin',
  totalPrice: 'Total Price',
  itemsPrice: 'Items Price',
  taxPrice: 'Tax',
  shippingPrice: 'Shipping',
  countInStock: 'In Stock',
  numReviews: 'Reviews',
  createdAt: 'Created',
  updatedAt: 'Updated',
  paidAt: 'Paid At',
  deliveredAt: 'Delivered At',
};

const formatKey = (key) => {
  if (DISPLAY_LABELS[key]) return DISPLAY_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
};

const formatValue = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
    try {
      return new Date(val).toLocaleDateString();
    } catch {
      return String(val);
    }
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

// Pick which keys to show (skip noisy internal fields)
const SKIP_KEYS = new Set(['__v', 'password', 'reviews', 'orderItems']);

const filterKeys = (obj) =>
  Object.keys(obj).filter((k) => !SKIP_KEYS.has(k));

// ── Sub-components ─────────────────────────────────────────────────────

const RecordCard = ({ data, title }) => {
  const keys = filterKeys(data);
  return (
    <div className='agent-chat-result-card'>
      {title && <div className='agent-chat-result-card-title'>{title}</div>}
      {keys.map((key) => (
        <div className='agent-chat-result-row' key={key}>
          <span className='agent-chat-result-key'>{formatKey(key)}</span>
          <span className='agent-chat-result-value'>
            {formatValue(data[key])}
          </span>
        </div>
      ))}
    </div>
  );
};

const DataTable = ({ rows }) => {
  if (!rows.length) return null;
  const columns = filterKeys(rows[0]).slice(0, 6); // Limit columns for readability
  return (
    <table className='agent-chat-result-table'>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col}>{formatKey(col)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row._id || row.id || i}>
            {columns.map((col) => (
              <td key={col}>{formatValue(row[col])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const StatsSummary = ({ data }) => {
  const keys = Object.keys(data);
  return (
    <div className='agent-chat-result-stats'>
      {keys.map((key) => (
        <div className='agent-chat-stat-item' key={key}>
          <div className='agent-chat-stat-value'>{formatValue(data[key])}</div>
          <div className='agent-chat-stat-label'>{formatKey(key)}</div>
        </div>
      ))}
    </div>
  );
};

// ── Main renderer ──────────────────────────────────────────────────────

const ToolResultRenderer = ({ result }) => {
  if (!result) return null;

  // Error result
  if (result.success === false) {
    return (
      <div className='agent-chat-tool-result'>
        <div className='agent-chat-result-delete'>
          <span>&#10007;</span>
          <span>{result.error || 'Action failed'}</span>
        </div>
      </div>
    );
  }

  const { data, metadata } = result;
  if (!data) return null;

  // Delete success
  if (data.deleted || data.message?.toLowerCase().includes('removed')) {
    return (
      <div className='agent-chat-tool-result'>
        <div className='agent-chat-result-delete'>
          <span>&#10003;</span>
          <span>{data.message || 'Successfully deleted'}</span>
        </div>
      </div>
    );
  }

  // Create / update success — has an _id and was just modified
  if (data._id && metadata?.action) {
    const label =
      metadata.action === 'create' ? 'Created' : 'Updated';
    return (
      <div className='agent-chat-tool-result'>
        <div className='agent-chat-result-success'>
          <span>&#10003;</span>
          <span>
            {label}: {data.name || data.email || data._id}
          </span>
        </div>
      </div>
    );
  }

  // Stats / aggregation
  if (
    typeof data === 'object' &&
    !Array.isArray(data) &&
    (data.total !== undefined || data.count !== undefined || data.summary)
  ) {
    return (
      <div className='agent-chat-tool-result'>
        <StatsSummary data={data} />
      </div>
    );
  }

  // List of records
  if (Array.isArray(data) && data.length > 0) {
    return (
      <div className='agent-chat-tool-result'>
        <DataTable rows={data} />
        {metadata && metadata.totalPages > 1 && (
          <div className='agent-chat-result-pagination'>
            Page {metadata.page} of {metadata.totalPages} &middot;{' '}
            {metadata.total} total
          </div>
        )}
      </div>
    );
  }

  // Single record
  if (typeof data === 'object' && !Array.isArray(data)) {
    return (
      <div className='agent-chat-tool-result'>
        <RecordCard data={data} />
      </div>
    );
  }

  // Fallback — formatted JSON
  return (
    <div className='agent-chat-tool-result'>
      <pre className='agent-chat-result-json'>
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
};

export default ToolResultRenderer;
