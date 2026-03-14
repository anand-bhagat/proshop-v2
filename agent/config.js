// agent/config.js — Agent Configuration
// All settings sourced from environment variables with sensible defaults.

const agentConfig = {
  // LLM Provider Settings
  llm: {
    provider: process.env.LLM_PROVIDER || 'anthropic',
    model: process.env.LLM_MODEL || 'claude-sonnet-4-20250514',
    apiKey: process.env.LLM_API_KEY || '',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS, 10) || 1024,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
  },

  // Engine Settings
  engine: {
    maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS, 10) || 10,
    maxRetries: parseInt(process.env.AGENT_MAX_RETRIES, 10) || 2,
    timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS, 10) || 30000,
  },

  // Feature Flags — which tool categories are enabled
  enabledCategories: (process.env.AGENT_ENABLED_CATEGORIES || 'products,orders,users,cart,navigation')
    .split(',')
    .map((c) => c.trim()),

  // System prompt template path (relative to project root)
  systemPromptPath: process.env.AGENT_SYSTEM_PROMPT_PATH || 'agent/prompts/system.txt',

  // Rate Limiting
  rateLimit: {
    maxRequestsPerMinute: parseInt(process.env.AGENT_RATE_LIMIT_PER_MIN, 10) || 20,
    maxRequestsPerHour: parseInt(process.env.AGENT_RATE_LIMIT_PER_HOUR, 10) || 200,
  },
};

export default agentConfig;
