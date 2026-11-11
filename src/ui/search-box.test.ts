import { describe, expect, it } from 'vitest';
import { searchHexagrams } from './search-box.ts';

function names(query: string): string[] {
  return searchHexagrams(query).map((hexagram) => hexagram.name);
}

describe('searchHexagrams', () => {
  it('finds a hexagram by its King Wen number', () => {
    expect(names('3')).toEqual(['屯']);
    expect(names('第64卦')).toEqual(['未济']);
  });

  it('finds a hexagram by name, with or without the 卦 suffix', () => {
    expect(names('屯')[0]).toBe('屯');
    expect(names('屯卦')[0]).toBe('屯');
    expect(names('大').slice(0, 4).sort()).toEqual(['大壮', '大有', '大畜', '大过']);
  });

  it('finds hexagrams by the trigram part of the full name', () => {
    expect(names('水雷')).toEqual(['屯']);
    expect(names('为天')[0]).toBe('乾');
  });

  it('finds hexagrams by pinyin without tone marks', () => {
    expect(names('zhun')).toEqual(['屯']);
    expect(names('kun')).toEqual(['坤', '困']);
    expect(names('xiaoxu')).toEqual(['小畜']);
  });

  it('returns nothing for an empty or unknown query', () => {
    expect(names('  ')).toEqual([]);
    expect(names('不存在的卦名')).toEqual([]);
  });
});
