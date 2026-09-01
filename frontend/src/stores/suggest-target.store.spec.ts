import { beforeEach, describe, expect, it } from 'vitest';

import { useSuggestTarget } from './suggest-target.store';

const ANCHOR = { from: 5, to: 11, text: 'second' };

describe('suggest-target store', () => {
  beforeEach(() => {
    useSuggestTarget.getState().unregister();
  });

  it('registers a story and starts idle', () => {
    useSuggestTarget.getState().register('piece-1');
    const s = useSuggestTarget.getState();
    expect(s.storyId).toBe('piece-1');
    expect(s.picking).toBe(false);
    expect(s.selection).toBeNull();
  });

  it('re-registering the SAME id leaves live state alone', () => {
    const store = useSuggestTarget.getState();
    store.register('piece-1');
    store.setPicking(true);
    useSuggestTarget.getState().register('piece-1');
    // A re-render must not cancel a mode the reader is in the middle of using.
    expect(useSuggestTarget.getState().picking).toBe(true);
  });

  it('registering a DIFFERENT id drops the mode and any pending pick', () => {
    const store = useSuggestTarget.getState();
    store.register('piece-1');
    store.setPicking(true);
    store.select(ANCHOR);
    useSuggestTarget.getState().register('piece-2');

    // An anchor is meaningless against another document; carrying one across a navigation is how a
    // suggestion lands on the wrong passage.
    const s = useSuggestTarget.getState();
    expect(s.storyId).toBe('piece-2');
    expect(s.picking).toBe(false);
    expect(s.selection).toBeNull();
  });

  it('selecting ends picking, because one pick opens one composer', () => {
    const store = useSuggestTarget.getState();
    store.register('piece-1');
    store.setPicking(true);
    store.select(ANCHOR);

    const s = useSuggestTarget.getState();
    expect(s.selection).toEqual(ANCHOR);
    expect(s.picking).toBe(false);
  });

  it('entering picking clears a stale selection', () => {
    const store = useSuggestTarget.getState();
    store.register('piece-1');
    store.select(ANCHOR);
    store.setPicking(true);
    expect(useSuggestTarget.getState().selection).toBeNull();
  });

  it('LEAVING picking does not clear the selection', () => {
    // `select()` turns picking off before the composer opens, so a setPicking(false) that wiped the
    // selection would close the composer the moment it appeared.
    const store = useSuggestTarget.getState();
    store.register('piece-1');
    store.select(ANCHOR);
    useSuggestTarget.getState().setPicking(false);
    expect(useSuggestTarget.getState().selection).toEqual(ANCHOR);
  });

  it('unregistering clears everything so nothing leaks to the next page', () => {
    const store = useSuggestTarget.getState();
    store.register('piece-1');
    store.setPicking(true);
    store.select(ANCHOR);
    useSuggestTarget.getState().unregister();

    const s = useSuggestTarget.getState();
    expect(s.storyId).toBeNull();
    expect(s.picking).toBe(false);
    expect(s.selection).toBeNull();
  });
});
