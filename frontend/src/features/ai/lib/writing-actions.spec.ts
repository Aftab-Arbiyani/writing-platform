import { describe, expect, it } from 'vitest';

import {
  defaultPlacement,
  isContinuation,
  labelOf,
  promptKeyOf,
  promptVariablesOf,
  QUICK_ACTIONS,
} from './writing-actions';

describe('writing actions', () => {
  it('maps every action to its server prompt-template key', () => {
    // These strings must match the server catalogue exactly — a typo here is a 404 at runtime,
    // and the catalogue is the only place the prompt bodies live.
    expect(promptKeyOf({ kind: 'continue' })).toBe('writing_assistant.continue');
    expect(promptKeyOf({ kind: 'rewrite' })).toBe('writing_assistant.rewrite');
    expect(promptKeyOf({ kind: 'expand' })).toBe('writing_assistant.expand');
    expect(promptKeyOf({ kind: 'condense' })).toBe('writing_assistant.condense');
    expect(promptKeyOf({ kind: 'simplify' })).toBe('writing_assistant.simplify');
    expect(promptKeyOf({ kind: 'improve', aspect: 'flow' })).toBe('writing_assistant.improve');
    expect(promptKeyOf({ kind: 'tone', tone: 'formal' })).toBe('writing_assistant.tone');
    expect(promptKeyOf({ kind: 'freeform' })).toBe('writing_assistant.freeform');
  });

  it('sends the declared variable for the parametrised actions only', () => {
    expect(promptVariablesOf({ kind: 'improve', aspect: 'grammar' })).toEqual({
      aspect: 'grammar and correctness',
    });
    expect(promptVariablesOf({ kind: 'tone', tone: 'poetic' })).toEqual({
      tone: 'poetic and lyrical',
    });
    expect(promptVariablesOf({ kind: 'rewrite' })).toEqual({});
  });

  it('falls back to the first option when a parametrised action carries none', () => {
    expect(promptVariablesOf({ kind: 'improve' })).toEqual({ aspect: 'flow and rhythm' });
    expect(promptVariablesOf({ kind: 'tone' })).toEqual({ tone: 'formal' });
  });

  it('labels actions for the button and the suggestion provenance', () => {
    expect(labelOf({ kind: 'continue' })).toBe('Continue writing');
    expect(labelOf({ kind: 'improve', aspect: 'dialogue' })).toBe('Improve dialogue');
    expect(labelOf({ kind: 'tone', tone: 'suspenseful' })).toBe('Suspenseful tone');
  });

  it('treats continue and freeform as continuations, the rest as transforms', () => {
    expect(isContinuation({ kind: 'continue' })).toBe(true);
    expect(isContinuation({ kind: 'freeform' })).toBe(true);
    expect(isContinuation({ kind: 'rewrite' })).toBe(false);
  });

  describe('default placement', () => {
    it('never replaces when nothing is selected', () => {
      // The safety property of the whole feature: a transform with no selection must not be
      // able to overwrite the entire draft in one click.
      for (const kind of ['rewrite', 'expand', 'condense', 'simplify'] as const) {
        expect(defaultPlacement({ kind }, false)).toBe('insert-below');
      }
      expect(defaultPlacement({ kind: 'improve', aspect: 'flow' }, false)).toBe('insert-below');
      expect(defaultPlacement({ kind: 'tone', tone: 'casual' }, false)).toBe('insert-below');
    });

    it('replaces the selection when there is one', () => {
      expect(defaultPlacement({ kind: 'rewrite' }, true)).toBe('replace-selection');
      expect(defaultPlacement({ kind: 'improve', aspect: 'flow' }, true)).toBe('replace-selection');
    });

    it('inserts below for continuations even with a selection', () => {
      // Continuing writing must never eat the text it is continuing from.
      expect(defaultPlacement({ kind: 'continue' }, true)).toBe('insert-below');
      expect(defaultPlacement({ kind: 'freeform' }, true)).toBe('insert-below');
    });
  });

  it('offers only unparametrised actions as one-click quick actions', () => {
    expect(QUICK_ACTIONS).not.toContain('improve');
    expect(QUICK_ACTIONS).not.toContain('tone');
    expect(QUICK_ACTIONS).not.toContain('freeform');
  });
});
