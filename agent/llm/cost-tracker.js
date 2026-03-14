// agent/llm/cost-tracker.js — Token Usage & Cost Tracking
// Tracks input/output tokens per LLM call and calculates cost from config pricing.

let sessionUsage = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0,
  callCount: 0,
};

/**
 * Track token usage for a single LLM call.
 * @param {Object} usage - { inputTokens, outputTokens }
 * @param {string} model - Model identifier (used for pricing lookup)
 * @param {Object} [pricingTable] - { [model]: { input, output } } per 1K tokens
 */
function trackUsage(usage, model, pricingTable = {}) {
  const pricing = pricingTable[model];
  let cost = 0;

  if (pricing) {
    cost =
      (usage.inputTokens / 1000) * pricing.input +
      (usage.outputTokens / 1000) * pricing.output;
  }

  sessionUsage.totalInputTokens += usage.inputTokens;
  sessionUsage.totalOutputTokens += usage.outputTokens;
  sessionUsage.totalCost += cost;
  sessionUsage.callCount++;

  // Structured log
  console.log(
    JSON.stringify({
      type: 'llm_usage',
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cost: cost.toFixed(6),
      timestamp: new Date().toISOString(),
    })
  );

  return cost;
}

/**
 * Get accumulated session usage stats.
 */
function getSessionUsage() {
  return { ...sessionUsage };
}

/**
 * Reset session usage (for tests or new sessions).
 */
function resetSessionUsage() {
  sessionUsage = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    callCount: 0,
  };
}

export { trackUsage, getSessionUsage, resetSessionUsage };
