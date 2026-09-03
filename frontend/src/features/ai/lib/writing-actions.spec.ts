import { describe, expect, it } from 'vitest';

import {
  defaultPlacement,
  IMPROVE_ASPECTS,
  labelOf,
  ONE_CLICK_ACTIONS,
  promptKeyOf,
  promptVariablesOf,
} from './writing-actions';

describe('Polish actions', () => {
  it('maps every action to its server prompt-template key', () => {
    // These strings must match the server catalogue exactly — a typo here is a 404 at runtime,
    // and the catalogue is the only place the prompt bodies live.
    expect(promptKeyOf({ kind: 'improve', aspect: 'flow' })).toBe('writing_assistant.improve');
    expect(promptKeyOf({ kind: 'simplify' })).toBe('writing_assistant.simplify');
    expect(promptKeyOf({ kind: 'condense' })).toBe('writing_assistant.condense');
  });

  /**
   * D5's actual subject, asserted as an absence.
   *
   * The five removed actions — continue, rewrite, expand, tone, freeform — are gone from the TYPE,
   * so a call naming one is a compile error rather than a test failure, which is the stronger guard
   * and the reason there is no runtime case for them here. What this pins instead is that the three
   * survivors are the three whose prompts still exist server-side: B2 deleted the other five from
   * `prompt-catalog.ts`, so a client that still offered one would send a key the server cannot
   * render.
   *
   * The distinction is not arbitrary. Every remaining action transforms text the writer already
   * wrote; none of them produces new prose. That is the line the audience draws, and it is the whole
   * of why this feature survived.
   */
  it('offers exactly the three transforming actions — the catalogue has no others', () => {
    const keys = (['improve', 'simplify', 'condense'] as const).map((kind) =>
      promptKeyOf({ kind }),
    );
    expect(keys).toEqual([
      'writing_assistant.improve',
      'writing_assistant.simplify',
      'writing_assistant.condense',
    ]);
  });

  it('sends the declared variable for the parametrised action only', () => {
    expect(promptVariablesOf({ kind: 'improve', aspect: 'grammar' })).toEqual({
      aspect: 'grammar and correctness',
    });
    expect(promptVariablesOf({ kind: 'simplify' })).toEqual({});
    expect(promptVariablesOf({ kind: 'condense' })).toEqual({});
  });

  it('falls back to the first aspect when Improve carries none', () => {
    expect(promptVariablesOf({ kind: 'improve' })).toEqual({ aspect: 'flow and rhythm' });
  });

  it('keeps all eight Improve aspects — the tool lost actions, not precision', () => {
    expect(IMPROVE_ASPECTS).toHaveLength(8);
    for (const aspect of IMPROVE_ASPECTS) {
      expect(promptVariablesOf({ kind: 'improve', aspect: aspect.value })).toEqual({
        aspect: aspect.phrase,
      });
    }
  });

  it('labels actions for the button and the suggestion provenance', () => {
    expect(labelOf({ kind: 'simplify' })).toBe('Simplify');
    expect(labelOf({ kind: 'condense' })).toBe('Condense');
    expect(labelOf({ kind: 'improve', aspect: 'dialogue' })).toBe('Improve dialogue');
  });

  describe('default placement', () => {
    it('never replaces when nothing is selected', () => {
      // The safety property of the whole feature: a transform with no selection must not be
      // able to overwrite the entire draft in one click.
      for (const kind of ['simplify', 'condense'] as const) {
        expect(defaultPlacement({ kind }, false)).toBe('insert-below');
      }
      expect(defaultPlacement({ kind: 'improve', aspect: 'flow' }, false)).toBe('insert-below');
    });

    it('replaces the selection when there is one', () => {
      expect(defaultPlacement({ kind: 'simplify' }, true)).toBe('replace-selection');
      expect(defaultPlacement({ kind: 'condense' }, true)).toBe('replace-selection');
      expect(defaultPlacement({ kind: 'improve', aspect: 'flow' }, true)).toBe('replace-selection');
    });

    /**
     * D5 deleted the third case here: "inserts below for continuations even with a selection".
     * Continuations were the reason `isContinuation` existed — continuing must never eat the text
     * it continues from — and with no generation actions left, selection is the only question. The
     * rule did not weaken; its other branch became unreachable.
     */
    it('answers on the selection alone, since every action is now a transform', () => {
      expect(defaultPlacement({ kind: 'improve' }, true)).toBe('replace-selection');
      expect(defaultPlacement({ kind: 'improve' }, false)).toBe('insert-below');
    });
  });

  it('offers only the unparametrised actions as one-click buttons', () => {
    expect(ONE_CLICK_ACTIONS).toEqual(['simplify', 'condense']);
    expect(ONE_CLICK_ACTIONS).not.toContain('improve');
  });
});
