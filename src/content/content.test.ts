import { describe, expect, it } from 'vitest';
import { HEXAGRAMS, lineTitles } from '../domain/hexagrams.ts';
import { classicOf, guideOf, niCommentaryOf } from './index.ts';

describe.each(HEXAGRAMS)('content of hexagram $number $name', (hexagram) => {
  const classic = classicOf(hexagram.number);

  it('has classic text whose line labels match the line pattern', () => {
    const labels = classic.lines.slice(0, 6).map((line) => line.label);
    expect(labels).toEqual(lineTitles(hexagram));
    expect(classic.judgment).not.toBe('');
    expect(classic.tuan).not.toBe('');
    expect(classic.image).not.toBe('');
  });

  it('has a guide with one entry per classic line', () => {
    const guide = guideOf(hexagram.number);
    expect(guide).toBeDefined();
    expect(guide?.lines).toHaveLength(classic.lines.length);
    expect(Array.from(guide?.keyword ?? '').length).toBeLessThanOrEqual(6);
    expect(guide?.overview.length).toBeGreaterThan(0);
    for (const line of guide?.lines ?? []) {
      expect(line.plain).not.toBe('');
      expect(line.note).not.toBe('');
    }
  });

  it('has a commentary entry that cites its sources', () => {
    const commentary = niCommentaryOf(hexagram.number);
    expect(commentary).toBeDefined();
    if (commentary?.status !== 'available') {
      expect(commentary?.note).not.toBe('');
      return;
    }
    expect(commentary.sources.length).toBeGreaterThan(0);
    for (const source of commentary.sources) {
      expect(source.url).toMatch(/^https:\/\//);
    }
    // A source may lack line-by-line text. Otherwise every line is covered.
    const lineCount = commentary.humanWay.lines.length;
    expect(lineCount === 0 || lineCount === classic.lines.length || lineCount === 6).toBe(true);
    commentary.humanWay.lines.slice(0, 6).forEach((line, index) => {
      expect(line.startsWith(classic.lines[index].label)).toBe(true);
    });
  });
});
