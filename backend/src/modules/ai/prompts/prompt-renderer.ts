import { AiPromptInvalidException, AiPromptRenderFailedException } from '../ai.exceptions';

/** `{{ variableName }}` placeholder syntax (alphanumeric + underscore names). */
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Prompt rendering (AF1) — the SINGLE place template variable substitution
 * happens (constraint: never duplicate prompt rendering). Pure functions so any
 * caller (registry, preview, orchestrator) renders identically.
 */

/** Unique variable names referenced by a template body. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name !== undefined) {
      found.add(name);
    }
  }
  return [...found];
}

/**
 * Validate a template body against its declared variables: every placeholder
 * used must be declared (declared-but-unused is allowed). Throws
 * `AI_PROMPT_INVALID` otherwise.
 */
export function validateTemplateBody(body: string, declared: readonly string[]): void {
  const undeclared = extractVariables(body).filter((name) => !declared.includes(name));
  if (undeclared.length > 0) {
    throw new AiPromptInvalidException(`undeclared variables: ${undeclared.join(', ')}`);
  }
}

/**
 * Render a template body by substituting `{{var}}` with the provided values.
 * Throws `AI_PROMPT_RENDER_FAILED` if a referenced variable has no value.
 */
export function renderTemplate(body: string, variables: Record<string, unknown>): string {
  return body.replace(PLACEHOLDER, (_full, name: string): string => {
    const value = variables[name];
    if (value === undefined || value === null) {
      throw new AiPromptRenderFailedException(`missing variable "${name}"`);
    }
    return String(value);
  });
}
