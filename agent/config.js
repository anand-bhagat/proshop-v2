// agent/config.js — Agent Configuration
// All settings sourced from environment variables with sensible defaults.

const agentConfig = {
  // LLM Provider Settings
  llm: {
    provider: process.env.LLM_PROVIDER || 'openai-compatible',
    model: process.env.LLM_MODEL || 'glm-4.7-flashx',
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || 'https://open.z.ai/api/paas/v4',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS, 10) || 4096,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0,
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS, 10) || 30000,

    // Streaming
    streamingEnabled: process.env.LLM_STREAMING !== 'false',

    // Cost tracking
    costTracking: {
      enabled: process.env.LLM_COST_TRACKING !== 'false',
      pricing: {
        // Z.ai models
        'glm-4.7-flashx': { input: 0.0001, output: 0.0004 },
        'glm-4.7-flash': { input: 0, output: 0 },
        // Groq
        'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
        // OpenAI
        'gpt-4o': { input: 0.0025, output: 0.01 },
        'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
        // Anthropic
        'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
        'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
      },
    },

    // Conversation memory
    maxHistoryMessages: parseInt(process.env.LLM_MAX_HISTORY_MESSAGES, 10) || 50,
  },

  // Engine Settings
  engine: {
    maxIterations: parseInt(process.env.LLM_MAX_ITERATIONS, 10) ||
                   parseInt(process.env.AGENT_MAX_ITERATIONS, 10) || 10,
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
