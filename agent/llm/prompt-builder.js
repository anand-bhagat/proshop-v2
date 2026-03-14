// agent/llm/prompt-builder.js — System Prompt Construction
// Builds the system prompt with app context, user info, and tool definitions.

/**
 * Build the system prompt for the LLM.
 * @param {Object} options
 * @param {string} options.appName - Application name
 * @param {string} options.appDescription - Brief app description
 * @param {Object} options.userContext - { userId, role, name }
 * @param {Array}  options.toolDefinitions - [{ name, description, parameters }]
 * @returns {string} Complete system prompt
 */
function buildSystemPrompt({ appName, appDescription, userContext, toolDefinitions }) {
  const toolDocs = toolDefinitions
    .map(
      (t) =>
        `### ${t.name}\n${t.description}\nParameters: ${JSON.stringify(t.parameters, null, 2)}`
    )
    .join('\n\n');

  return `You are an AI assistant embedded in ${appName}. ${appDescription}

## Your Capabilities
You help users by querying and managing their data using the tools available to you.
You can call multiple tools in sequence to answer complex questions.

## Rules
1. ALWAYS use tools to get data. NEVER make up or assume information.
2. If a user's request is ambiguous, ask for clarification before acting.
3. For destructive actions (delete, cancel, update), ALWAYS confirm with the user first.
4. If a tool returns an error, explain the issue in plain language. Retry once with corrected parameters if the error suggests a fixable issue.
5. Format data clearly: use tables for lists, highlight key numbers in summaries.
6. Respect permissions — if a tool returns a permission error, explain that the action requires different access.
7. Be concise. Don't repeat tool data verbatim — summarize and highlight what matters.

## Current User
- Name: ${userContext.name || 'Guest'}
- Role: ${userContext.role || 'guest'}
- User ID: ${userContext.userId || 'anonymous'}

## Available Tools
${toolDocs}
`;
}

export { buildSystemPrompt };
