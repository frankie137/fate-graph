import { describe, expect, it } from 'vitest';
import {
  HEXAGRAMS,
  changedHexagram,
  hexagramByNumber,
  lineTitles,
  nuclearHexagram,
  oppositeHexagram,
  reversedHexagram,
  singleLineEdges,
} from './hexagrams.ts';

describe('hexagram table', () => {
  it('covers all 64 line patterns exactly once', () => {
    expect(new Set(HEXAGRAMS.map((hexagram) => hexagram.code)).size).toBe(64);
  });

  it('assigns the Unicode symbol that matches the King Wen number', () => {
    expect(hexagramByNumber(1).symbol).toBe('䷀');
    expect(hexagramByNumber(64).symbol).toBe('䷿');
  });

  it('derives full names from the trigrams', () => {
    expect(hexagramByNumber(1).fullName).toBe('乾为天');
    expect(hexagramByNumber(3).fullName).toBe('水雷屯');
    expect(hexagramByNumber(63).fullName).toBe('水火既济');
  });

  it('labels lines from bottom to top', () => {
    expect(lineTitles(hexagramByNumber(3))).toEqual(['初九', '六二', '六三', '六四', '九五', '上六']);
  });
});

describe('hexagram relations', () => {
  it('finds the opposite hexagram', () => {
    expect(oppositeHexagram(hexagramByNumber(1)).name).toBe('坤');
    expect(oppositeHexagram(hexagramByNumber(3)).name).toBe('鼎');
  });

  it('finds the reversed hexagram', () => {
    expect(reversedHexagram(hexagramByNumber(3)).name).toBe('蒙');
    expect(reversedHexagram(hexagramByNumber(11)).name).toBe('否');
    expect(reversedHexagram(hexagramByNumber(1)).name).toBe('乾');
  });

  it('finds the nuclear hexagram', () => {
    expect(nuclearHexagram(hexagramByNumber(3)).name).toBe('剥');
    expect(nuclearHexagram(hexagramByNumber(63)).name).toBe('未济');
  });

  it('finds the hexagram reached by changing one line', () => {
    expect(changedHexagram(hexagramByNumber(1), 1).name).toBe('姤');
    expect(changedHexagram(hexagramByNumber(1), 5).name).toBe('大有');
    expect(changedHexagram(hexagramByNumber(2), 1).name).toBe('复');
  });

  it('links every hexagram to six neighbors', () => {
    expect(singleLineEdges()).toHaveLength(192);
  });
});
