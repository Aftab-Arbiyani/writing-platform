import { AiPromptInvalidException, AiPromptRenderFailedException } from '../ai.exceptions';
import { extractVariables, renderTemplate, validateTemplateBody } from './prompt-renderer';

describe('prompt-renderer', () => {
  describe('extractVariables', () => {
    it('returns the unique variable names used', () => {
      expect(extractVariables('Hi {{name}}, {{name}} — {{topic}}')).toEqual(['name', 'topic']);
    });

    it('returns [] when there are no placeholders', () => {
      expect(extractVariables('plain text')).toEqual([]);
    });
  });

  describe('validateTemplateBody', () => {
    it('accepts a body whose placeholders are all declared', () => {
      expect(() => validateTemplateBody('{{a}} {{b}}', ['a', 'b', 'c'])).not.toThrow();
    });

    it('throws AiPromptInvalid when a placeholder is undeclared', () => {
      expect(() => validateTemplateBody('{{a}} {{rogue}}', ['a'])).toThrow(
        AiPromptInvalidException,
      );
    });
  });

  describe('renderTemplate', () => {
    it('substitutes declared variables', () => {
      expect(renderTemplate('Hello {{name}}', { name: 'Meera' })).toBe('Hello Meera');
    });

    it('coerces non-string values', () => {
      expect(renderTemplate('n={{n}}', { n: 42 })).toBe('n=42');
    });

    it('throws AiPromptRenderFailed when a variable is missing', () => {
      expect(() => renderTemplate('Hi {{name}}', {})).toThrow(AiPromptRenderFailedException);
    });
  });
});
