/**
 * A hexagram is identified two ways:
 * - `number`: its position in the King Wen sequence, 1 to 64.
 * - `code`: a 6-bit integer where bit i is line i+1 counted from the bottom,
 *   and a set bit is a yang line.
 */

export type TrigramKey = 'qian' | 'dui' | 'li' | 'zhen' | 'xun' | 'kan' | 'gen' | 'kun';

export interface Trigram {
  key: TrigramKey;
  name: string;
  nature: string;
  symbol: string;
  /** 3-bit code, bit 0 is the bottom line. */
  code: number;
}

export interface Hexagram {
  number: number;
  code: number;
  name: string;
  fullName: string;
  pinyin: string;
  symbol: string;
  upper: Trigram;
  lower: Trigram;
  /** Line values from bottom to top, true for yang. */
  lines: boolean[];
  yangCount: number;
}

export const LINE_COUNT = 6;
export const HEXAGRAM_COUNT = 64;

const TRIGRAM_LIST: Trigram[] = [
  { key: 'qian', name: '乾', nature: '天', symbol: '☰', code: 0b111 },
  { key: 'dui', name: '兑', nature: '泽', symbol: '☱', code: 0b011 },
  { key: 'li', name: '离', nature: '火', symbol: '☲', code: 0b101 },
  { key: 'zhen', name: '震', nature: '雷', symbol: '☳', code: 0b001 },
  { key: 'xun', name: '巽', nature: '风', symbol: '☴', code: 0b110 },
  { key: 'kan', name: '坎', nature: '水', symbol: '☵', code: 0b010 },
  { key: 'gen', name: '艮', nature: '山', symbol: '☶', code: 0b100 },
  { key: 'kun', name: '坤', nature: '地', symbol: '☷', code: 0b000 },
];

export const TRIGRAMS: Record<TrigramKey, Trigram> = Object.fromEntries(
  TRIGRAM_LIST.map((trigram) => [trigram.key, trigram]),
) as Record<TrigramKey, Trigram>;

const TRIGRAM_BY_CODE = new Map(TRIGRAM_LIST.map((trigram) => [trigram.code, trigram]));

/** King Wen sequence as [name, pinyin, upper trigram, lower trigram]. */
const KING_WEN: [string, string, TrigramKey, TrigramKey][] = [
  ['乾', 'qián', 'qian', 'qian'],
  ['坤', 'kūn', 'kun', 'kun'],
  ['屯', 'zhūn', 'kan', 'zhen'],
  ['蒙', 'méng', 'gen', 'kan'],
  ['需', 'xū', 'kan', 'qian'],
  ['讼', 'sòng', 'qian', 'kan'],
  ['师', 'shī', 'kun', 'kan'],
  ['比', 'bǐ', 'kan', 'kun'],
  ['小畜', 'xiǎo xù', 'xun', 'qian'],
  ['履', 'lǚ', 'qian', 'dui'],
  ['泰', 'tài', 'kun', 'qian'],
  ['否', 'pǐ', 'qian', 'kun'],
  ['同人', 'tóng rén', 'qian', 'li'],
  ['大有', 'dà yǒu', 'li', 'qian'],
  ['谦', 'qiān', 'kun', 'gen'],
  ['豫', 'yù', 'zhen', 'kun'],
  ['随', 'suí', 'dui', 'zhen'],
  ['蛊', 'gǔ', 'gen', 'xun'],
  ['临', 'lín', 'kun', 'dui'],
  ['观', 'guān', 'xun', 'kun'],
  ['噬嗑', 'shì hé', 'li', 'zhen'],
  ['贲', 'bì', 'gen', 'li'],
  ['剥', 'bō', 'gen', 'kun'],
  ['复', 'fù', 'kun', 'zhen'],
  ['无妄', 'wú wàng', 'qian', 'zhen'],
  ['大畜', 'dà xù', 'gen', 'qian'],
  ['颐', 'yí', 'gen', 'zhen'],
  ['大过', 'dà guò', 'dui', 'xun'],
  ['坎', 'kǎn', 'kan', 'kan'],
  ['离', 'lí', 'li', 'li'],
  ['咸', 'xián', 'dui', 'gen'],
  ['恒', 'héng', 'zhen', 'xun'],
  ['遁', 'dùn', 'qian', 'gen'],
  ['大壮', 'dà zhuàng', 'zhen', 'qian'],
  ['晋', 'jìn', 'li', 'kun'],
  ['明夷', 'míng yí', 'kun', 'li'],
  ['家人', 'jiā rén', 'xun', 'li'],
  ['睽', 'kuí', 'li', 'dui'],
  ['蹇', 'jiǎn', 'kan', 'gen'],
  ['解', 'xiè', 'zhen', 'kan'],
  ['损', 'sǔn', 'gen', 'dui'],
  ['益', 'yì', 'xun', 'zhen'],
  ['夬', 'guài', 'dui', 'qian'],
  ['姤', 'gòu', 'qian', 'xun'],
  ['萃', 'cuì', 'dui', 'kun'],
  ['升', 'shēng', 'kun', 'xun'],
  ['困', 'kùn', 'dui', 'kan'],
  ['井', 'jǐng', 'kan', 'xun'],
  ['革', 'gé', 'dui', 'li'],
  ['鼎', 'dǐng', 'li', 'xun'],
  ['震', 'zhèn', 'zhen', 'zhen'],
  ['艮', 'gèn', 'gen', 'gen'],
  ['渐', 'jiàn', 'xun', 'gen'],
  ['归妹', 'guī mèi', 'zhen', 'dui'],
  ['丰', 'fēng', 'zhen', 'li'],
  ['旅', 'lǚ', 'li', 'gen'],
  ['巽', 'xùn', 'xun', 'xun'],
  ['兑', 'duì', 'dui', 'dui'],
  ['涣', 'huàn', 'xun', 'kan'],
  ['节', 'jié', 'kan', 'dui'],
  ['中孚', 'zhōng fú', 'xun', 'dui'],
  ['小过', 'xiǎo guò', 'zhen', 'gen'],
  ['既济', 'jì jì', 'kan', 'li'],
  ['未济', 'wèi jì', 'li', 'kan'],
];

const HEXAGRAM_SYMBOL_BASE = 0x4dc0;
const LINE_MASK = (1 << LINE_COUNT) - 1;

function buildHexagram(index: number): Hexagram {
  const [name, pinyin, upperKey, lowerKey] = KING_WEN[index];
  const upper = TRIGRAMS[upperKey];
  const lower = TRIGRAMS[lowerKey];
  const code = (upper.code << 3) | lower.code;
  const lines = Array.from({ length: LINE_COUNT }, (_, line) => ((code >> line) & 1) === 1);
  const fullName =
    upper === lower ? `${name}为${upper.nature}` : `${upper.nature}${lower.nature}${name}`;
  return {
    number: index + 1,
    code,
    name,
    fullName,
    pinyin,
    symbol: String.fromCodePoint(HEXAGRAM_SYMBOL_BASE + index),
    upper,
    lower,
    lines,
    yangCount: lines.filter(Boolean).length,
  };
}

export const HEXAGRAMS: Hexagram[] = KING_WEN.map((_, index) => buildHexagram(index));

const HEXAGRAM_BY_CODE = new Map(HEXAGRAMS.map((hexagram) => [hexagram.code, hexagram]));

export function hexagramByNumber(number: number): Hexagram {
  const hexagram = HEXAGRAMS[number - 1];
  if (!hexagram) {
    throw new Error(`No hexagram with number ${number}`);
  }
  return hexagram;
}

export function hexagramByCode(code: number): Hexagram {
  const hexagram = HEXAGRAM_BY_CODE.get(code);
  if (!hexagram) {
    throw new Error(`No hexagram with code ${code}`);
  }
  return hexagram;
}

/** 变卦: the hexagram reached by flipping one line, numbered 1 to 6 from the bottom. */
export function changedHexagram(hexagram: Hexagram, line: number): Hexagram {
  return hexagramByCode(hexagram.code ^ (1 << (line - 1)));
}

/** 错卦: every line flipped. */
export function oppositeHexagram(hexagram: Hexagram): Hexagram {
  return hexagramByCode(~hexagram.code & LINE_MASK);
}

/** 综卦: the hexagram turned upside down. */
export function reversedHexagram(hexagram: Hexagram): Hexagram {
  let code = 0;
  for (let line = 0; line < LINE_COUNT; line += 1) {
    if (hexagram.lines[line]) {
      code |= 1 << (LINE_COUNT - 1 - line);
    }
  }
  return hexagramByCode(code);
}

/** 互卦: lines 2-4 form the lower trigram and lines 3-5 the upper trigram. */
export function nuclearHexagram(hexagram: Hexagram): Hexagram {
  const lower = (hexagram.code >> 1) & 0b111;
  const upper = (hexagram.code >> 2) & 0b111;
  return hexagramByCode((upper << 3) | lower);
}

export function trigramByCode(code: number): Trigram {
  const trigram = TRIGRAM_BY_CODE.get(code);
  if (!trigram) {
    throw new Error(`No trigram with code ${code}`);
  }
  return trigram;
}

/** Traditional line titles such as 初九, 六二 and 上六, from bottom to top. */
export function lineTitles(hexagram: Hexagram): string[] {
  const positions = ['初', '二', '三', '四', '五', '上'];
  return hexagram.lines.map((isYang, index) => {
    const value = isYang ? '九' : '六';
    const isEdge = index === 0 || index === LINE_COUNT - 1;
    return isEdge ? `${positions[index]}${value}` : `${value}${positions[index]}`;
  });
}

/** Every pair of hexagrams that differ in exactly one line, as [codeA, codeB] with codeA < codeB. */
export function singleLineEdges(): [number, number][] {
  const edges: [number, number][] = [];
  for (let code = 0; code < HEXAGRAM_COUNT; code += 1) {
    for (let line = 0; line < LINE_COUNT; line += 1) {
      const neighbor = code ^ (1 << line);
      if (code < neighbor) {
        edges.push([code, neighbor]);
      }
    }
  }
  return edges;
}
