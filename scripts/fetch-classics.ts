/**
 * Downloads the Zhouyi text of all 64 hexagrams from Chinese Wikisource,
 * converts it to Simplified Chinese, and writes one JSON file per hexagram
 * to src/content/classics.
 *
 * Run with: npm run fetch:classics
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';
import { HEXAGRAMS, lineTitles, type Hexagram } from '../src/domain/hexagrams.ts';

interface ClassicLine {
  label: string;
  text: string;
  image: string;
}

interface ClassicText {
  number: number;
  judgment: string;
  tuan: string;
  image: string;
  lines: ClassicLine[];
}

/**
 * One replacement inside one field of a hexagram. `field` is "judgment",
 * "tuan", "image", or a line field such as "lines[3].text".
 */
interface Correction {
  number: number;
  field: string;
  from: string;
  to: string;
}

const API_URL = 'https://zh.wikisource.org/w/api.php';
const USER_AGENT = 'iching-classics-fetcher/0.1';
const TITLES_PER_REQUEST = 50;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '../src/content/classics');
// The Wikisource edition differs from the received text (the Wang Bi
// recension that printed editions follow) in a number of characters. This
// file lists the places where the received reading replaces it.
const CORRECTIONS_FILE = path.join(SCRIPT_DIR, 'classics-corrections.json');

/** Wikisource page titles that differ from the Simplified hexagram name. */
const TRADITIONAL_TITLES: Record<string, string> = {
  讼: '訟',
  师: '師',
  谦: '謙',
  随: '隨',
  蛊: '蠱',
  临: '臨',
  观: '觀',
  贲: '賁',
  剥: '剝',
  复: '復',
  颐: '頤',
  大过: '大過',
  离: '離',
  遁: '遯',
  大壮: '大壯',
  晋: '晉',
  损: '損',
  渐: '漸',
  归妹: '歸妹',
  丰: '豐',
  兑: '兌',
  涣: '渙',
  节: '節',
  小过: '小過',
  既济: '既濟',
  未济: '未濟',
};

const SECTION_HEADERS: Record<string, 'text' | 'tuan' | 'image' | 'wenyan'> = {
  '易經：': 'text',
  '彖曰：': 'tuan',
  '象曰：': 'image',
  '文言曰：': 'wenyan',
};

/** A line statement such as "初九：潛龍勿用。", where some pages use a comma after the label. */
const LINE_PATTERN = /^(初[九六]|[九六][二三四五]|上[九六]|用[九六])[：，]\s*(.*)$/;

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

// 乾 only becomes 干 where it means "dry", which in the Zhouyi text happens
// in hexagram 21 alone. A blanket conversion would corrupt the name 乾.
const QIAN_PLACEHOLDER = '';
const DRY_PHRASES = ['乾胏', '乾肉'];

// Standard Simplified editions replace these variant forms, but OpenCC keeps them.
const VARIANT_REPLACEMENTS: [RegExp, string][] = [
  [/遯/g, '遁'],
  [/羣/g, '群'],
  [/脩/g, '修'],
  [/覩/g, '睹'],
  // Wikisource prints a rare variant in 睽 六三 where the received text has 掣.
  [/𧤊/gu, '掣'],
];

/** The main CJK block, which every common Chinese font covers. */
function isCommonCjk(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint >= 0x4e00 && codePoint <= 0x9fff;
}

function simplify(text: string): string {
  let protectedText = text.replace(/\s+/g, '');
  for (const phrase of DRY_PHRASES) {
    protectedText = protectedText.replaceAll(phrase, phrase.replace('乾', '干'));
  }
  protectedText = protectedText.replaceAll('乾', QIAN_PLACEHOLDER);
  const original = Array.from(protectedText);
  const converted = Array.from(toSimplified(protectedText));
  if (original.length !== converted.length) {
    throw new Error(`Conversion changed the length of: ${text}`);
  }
  // A few rare characters simplify to forms that most fonts cannot display,
  // such as 餗 to 𫗧. Those keep their traditional form.
  let simplified = converted
    .map((character, index) =>
      isCommonCjk(original[index]) && !isCommonCjk(character) ? original[index] : character,
    )
    .join('')
    .replaceAll(QIAN_PLACEHOLDER, '乾');
  for (const [pattern, replacement] of VARIANT_REPLACEMENTS) {
    simplified = simplified.replace(pattern, replacement);
  }
  return simplified;
}

function traditionalName(hexagram: Hexagram): string {
  return TRADITIONAL_TITLES[hexagram.name] ?? hexagram.name;
}

function pageTitle(hexagram: Hexagram): string {
  return `周易/${traditionalName(hexagram)}`;
}

async function fetchWikitext(titles: string[]): Promise<Map<string, string>> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    formatversion: '2',
    titles: titles.join('|'),
  });
  const response = await fetch(`${API_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Wikisource request failed with status ${response.status}`);
  }
  const body = (await response.json()) as {
    query: { pages: { title: string; revisions?: { slots: { main: { content: string } } }[] }[] };
  };
  const result = new Map<string, string>();
  for (const page of body.query.pages) {
    const content = page.revisions?.[0]?.slots.main.content;
    if (!content) {
      throw new Error(`Wikisource page "${page.title}" has no content`);
    }
    result.set(page.title, content);
  }
  return result;
}

function stripMarkup(wikitext: string): string {
  return wikitext
    .replace(/-\{T\|[^}]*\}-/g, '')
    .replace(/-\{([^}]*)\}-/g, '$1')
    .replace(/\{\{另\|([^|}]*)\|[^}]*\}\}/g, '$1')
    .replace(/\{\{\*\|[^}]*\}\}/g, '')
    .replace(/<\/?span[^>]*>/g, '')
    .replace(/'''/g, '');
}

function parsePage(hexagram: Hexagram, wikitext: string): ClassicText {
  let section: 'text' | 'tuan' | 'image' | 'wenyan' | undefined;
  let judgment = '';
  let image = '';
  const tuanParagraphs: string[] = [];
  const lines: { label: string; text: string }[] = [];
  const lineImages: string[] = [];

  // Markup is stripped from the whole page first because a tag can span two lines.
  for (const line of stripMarkup(wikitext).split('\n')) {
    const bullet = /^(\*+#?:?)\s*(.*?)\s*$/.exec(line);
    if (!bullet) {
      continue;
    }
    const [, marker, content] = bullet;
    if (marker === '*' && content in SECTION_HEADERS) {
      section = SECTION_HEADERS[content];
      continue;
    }
    if (!content || !section || section === 'wenyan') {
      continue;
    }
    if (content.includes('{{') || content.includes('[[')) {
      throw new Error(`Unhandled markup in ${hexagram.name}: ${content}`);
    }
    const isNumbered = marker.endsWith('#');
    if (section === 'text') {
      const lineMatch = LINE_PATTERN.exec(content);
      const namePrefix = `${traditionalName(hexagram)}：`;
      if (isNumbered) {
        if (!lineMatch) {
          throw new Error(`Unrecognized line statement in ${hexagram.name}: ${content}`);
        }
        lines.push({ label: lineMatch[1], text: lineMatch[2] });
      } else if (content.startsWith(namePrefix)) {
        judgment = content.slice(namePrefix.length);
      } else {
        // Some judgments run on from the name without a colon (否之匪人),
        // and the judgment of 坤 continues on further bullets.
        judgment += content;
      }
    } else if (section === 'tuan') {
      tuanParagraphs.push(content);
    } else if (isNumbered) {
      lineImages.push(content);
    } else {
      image += content;
    }
  }

  if (lines.length !== lineImages.length) {
    throw new Error(
      `${hexagram.name}: ${lines.length} line texts but ${lineImages.length} line images`,
    );
  }
  // The page of 恒 spells the name with a variant character, so its prefix
  // survives the earlier check and is removed here after conversion.
  const simplifiedJudgment = simplify(judgment).replace(new RegExp(`^${hexagram.name}：`), '');
  return {
    number: hexagram.number,
    judgment: simplifiedJudgment,
    tuan: simplify(tuanParagraphs.join('')),
    image: simplify(image),
    lines: lines.map((line, index) => ({
      label: simplify(line.label),
      text: simplify(line.text),
      image: simplify(lineImages[index]),
    })),
  };
}

const LINE_FIELD_PATTERN = /^lines\[(\d+)\]\.(text|image)$/;

function applyCorrection(classic: ClassicText, correction: Correction): void {
  const replace = (current: string): string => {
    if (!current.includes(correction.from)) {
      throw new Error(
        `Correction for hexagram ${correction.number} ${correction.field} does not apply: ` +
          `"${correction.from}" is not in "${current}"`,
      );
    }
    return current.replace(correction.from, correction.to);
  };
  const lineField = LINE_FIELD_PATTERN.exec(correction.field);
  if (lineField) {
    const line = classic.lines[Number(lineField[1])];
    const key = lineField[2] as 'text' | 'image';
    line[key] = replace(line[key]);
  } else if (
    correction.field === 'judgment' ||
    correction.field === 'tuan' ||
    correction.field === 'image'
  ) {
    classic[correction.field] = replace(classic[correction.field]);
  } else {
    throw new Error(`Unknown correction field "${correction.field}"`);
  }
}

/** Checks the parsed text against the line pattern derived from the trigrams. */
function validate(hexagram: Hexagram, classic: ClassicText): void {
  const expectedLabels = lineTitles(hexagram);
  const actualLabels = classic.lines.slice(0, expectedLabels.length).map((line) => line.label);
  if (actualLabels.join() !== expectedLabels.join()) {
    throw new Error(`${hexagram.name}: line labels ${actualLabels} do not match ${expectedLabels}`);
  }
  // 乾 and 坤 carry one extra statement, 用九 and 用六.
  const expectedLineCount = hexagram.number <= 2 ? 7 : 6;
  if (classic.lines.length !== expectedLineCount) {
    throw new Error(`${hexagram.name}: expected ${expectedLineCount} lines`);
  }
  if (!classic.judgment || !classic.tuan || !classic.image) {
    throw new Error(`${hexagram.name}: missing judgment, tuan or image text`);
  }
}

async function main(): Promise<void> {
  const corrections = JSON.parse(await readFile(CORRECTIONS_FILE, 'utf8')) as Correction[];
  const wikitextByTitle = new Map<string, string>();
  const titles = HEXAGRAMS.map(pageTitle);
  for (let start = 0; start < titles.length; start += TITLES_PER_REQUEST) {
    const batch = await fetchWikitext(titles.slice(start, start + TITLES_PER_REQUEST));
    for (const [title, content] of batch) {
      wikitextByTitle.set(title, content);
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const hexagram of HEXAGRAMS) {
    const wikitext = wikitextByTitle.get(pageTitle(hexagram));
    if (!wikitext) {
      throw new Error(`Missing Wikisource page for ${hexagram.name}`);
    }
    const classic = parsePage(hexagram, wikitext);
    for (const correction of corrections) {
      if (correction.number === hexagram.number) {
        applyCorrection(classic, correction);
      }
    }
    validate(hexagram, classic);
    const fileName = `${String(hexagram.number).padStart(2, '0')}.json`;
    await writeFile(path.join(OUTPUT_DIR, fileName), `${JSON.stringify(classic, null, 2)}\n`);
  }
  console.log(`Wrote ${HEXAGRAMS.length} files to ${OUTPUT_DIR}`);
}

await main();
