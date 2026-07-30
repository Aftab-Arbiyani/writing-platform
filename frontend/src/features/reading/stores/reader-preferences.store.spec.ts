import { beforeEach, describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '@/lib/constants';

import { readerStyle, useReaderPreferences } from './reader-preferences.store';

describe('reader preferences', () => {
  beforeEach(() => {
    useReaderPreferences.getState().reset();
  });

  it('defaults to the shipped reading typography', () => {
    const { textSize, lineSpacing, width } = useReaderPreferences.getState();
    expect({ textSize, lineSpacing, width }).toEqual({
      textSize: 'md',
      lineSpacing: 'normal',
      width: 'medium',
    });
    // The default must reproduce the pre-preferences rendering exactly.
    expect(readerStyle({ textSize, lineSpacing, width })).toEqual({
      fontSize: '1.25rem',
      lineHeight: 1.7,
    });
  });

  it('persists a change to the device so it survives a reload', () => {
    useReaderPreferences.getState().setTextSize('lg');
    expect(localStorage.getItem(STORAGE_KEYS.readerPreferences)).toContain('"textSize":"lg"');
  });

  it('scales size and spacing from the reader’s choice', () => {
    expect(readerStyle({ textSize: 'sm', lineSpacing: 'compact', width: 'narrow' })).toEqual({
      fontSize: '1.125rem',
      lineHeight: 1.5,
    });
    expect(readerStyle({ textSize: 'lg', lineSpacing: 'relaxed', width: 'wide' })).toEqual({
      fontSize: '1.5rem',
      lineHeight: 2,
    });
  });

  it('floors Nastaliq leading at 2.1 whatever the reader picked', () => {
    // docs/06 §7: never below 2.0 for Nastaliq. A "compact" choice must not win here.
    expect(
      readerStyle({ textSize: 'md', lineSpacing: 'compact', width: 'medium' }, 'Nastaliq')
        .lineHeight,
    ).toBe(2.1);
    expect(
      readerStyle({ textSize: 'md', lineSpacing: 'relaxed', width: 'medium' }, 'nastaliq')
        .lineHeight,
    ).toBe(2.1);
  });

  it('leaves non-Nastaliq scripts on the chosen spacing', () => {
    expect(
      readerStyle({ textSize: 'md', lineSpacing: 'compact', width: 'medium' }, 'Devanagari')
        .lineHeight,
    ).toBe(1.5);
  });
});
