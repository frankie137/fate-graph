import { guideOf } from '../content/index.ts';
import { HEXAGRAMS, type Hexagram } from '../domain/hexagrams.ts';
import { h } from './dom.ts';
import { createLineStack } from './figure.ts';

const MAX_RESULTS = 8;

interface SearchEntry {
  hexagram: Hexagram;
  /** Pinyin without tone marks or spaces, such as "xiaoxu". */
  plainPinyin: string;
  keywords: string;
}

function stripTones(pinyin: string): string {
  return pinyin
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const ENTRIES: SearchEntry[] = HEXAGRAMS.map((hexagram) => {
  const guide = guideOf(hexagram.number);
  return {
    hexagram,
    plainPinyin: stripTones(hexagram.pinyin),
    keywords: guide ? `${guide.keyword}${guide.summary}` : '',
  };
});

/** Lower ranks are better matches. Returns undefined when the entry does not match. */
function rank(entry: SearchEntry, query: string): number | undefined {
  const { hexagram } = entry;
  if (/^\d+$/.test(query)) {
    return Number(query) === hexagram.number ? 0 : undefined;
  }
  if (hexagram.name === query) {
    return 1;
  }
  if (hexagram.name.startsWith(query)) {
    return 2;
  }
  if (hexagram.fullName.includes(query) || `${hexagram.name}卦` === query) {
    return 3;
  }
  const latinQuery = stripTones(query);
  if (/^[a-z]+$/.test(latinQuery)) {
    if (entry.plainPinyin.startsWith(latinQuery)) {
      return 4;
    }
    return entry.plainPinyin.includes(latinQuery) ? 5 : undefined;
  }
  return entry.keywords.includes(query) ? 6 : undefined;
}

export function searchHexagrams(rawQuery: string): Hexagram[] {
  const query = rawQuery.trim().replace(/^第/, '').replace(/卦$/, (suffix, offset: number) =>
    offset === 0 ? suffix : '',
  );
  if (!query) {
    return [];
  }
  return ENTRIES.map((entry) => ({ entry, score: rank(entry, query) }))
    .filter((match): match is { entry: SearchEntry; score: number } => match.score !== undefined)
    .sort((a, b) => a.score - b.score || a.entry.hexagram.number - b.entry.hexagram.number)
    .slice(0, MAX_RESULTS)
    .map((match) => match.entry.hexagram);
}

/** Search field with a result list that can be driven by the keyboard. */
export class SearchBox {
  private readonly input: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly onSelect: (hexagram: Hexagram) => void;
  private results: Hexagram[] = [];
  private activeIndex = 0;

  constructor(root: HTMLElement, onSelect: (hexagram: Hexagram) => void) {
    this.onSelect = onSelect;
    this.input = h('input', {
      class: 'search-input',
      attrs: {
        type: 'search',
        placeholder: '搜索卦名、卦序或拼音，如 屯 / 3 / zhun',
        'aria-label': '搜索卦',
        autocomplete: 'off',
        spellcheck: 'false',
      },
    });
    this.list = h('ul', { class: 'search-results', attrs: { role: 'listbox' } });
    this.list.hidden = true;
    root.append(this.input, this.list);

    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('focus', () => this.update());
    this.input.addEventListener('keydown', (event) => this.handleKey(event));
    document.addEventListener('pointerdown', (event) => {
      if (!root.contains(event.target as Node)) {
        this.list.hidden = true;
      }
    });
  }

  focus(): void {
    this.input.focus();
    this.input.select();
  }

  private update(): void {
    this.results = searchHexagrams(this.input.value);
    this.activeIndex = 0;
    this.renderResults();
  }

  private renderResults(): void {
    const hasQuery = this.input.value.trim() !== '';
    this.list.hidden = !hasQuery;
    if (!hasQuery) {
      return;
    }
    if (this.results.length === 0) {
      this.list.replaceChildren(h('li', { class: 'search-empty', text: '没有找到匹配的卦' }));
      return;
    }
    this.list.replaceChildren(
      ...this.results.map((hexagram, index) => {
        const guide = guideOf(hexagram.number);
        return h(
          'li',
          {
            class: index === this.activeIndex ? 'search-result is-active' : 'search-result',
            attrs: { role: 'option', 'aria-selected': String(index === this.activeIndex) },
            on: {
              // pointerdown fires before the input loses focus, so the list is still open.
              pointerdown: (event) => {
                event.preventDefault();
                this.choose(hexagram);
              },
            },
          },
          [
            createLineStack(hexagram),
            h('span', { class: 'search-result-name', text: hexagram.name }),
            h('span', { class: 'search-result-meta' }, [
              h('span', { text: `第 ${hexagram.number} 卦 · ${hexagram.fullName} · ${hexagram.pinyin}` }),
              guide ? h('span', { class: 'search-result-keyword', text: guide.keyword }) : null,
            ]),
          ],
        );
      }),
    );
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.list.hidden = true;
      this.input.blur();
      return;
    }
    if (this.results.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex = (this.activeIndex + step + this.results.length) % this.results.length;
      this.renderResults();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.choose(this.results[this.activeIndex]);
    }
  }

  private choose(hexagram: Hexagram): void {
    this.list.hidden = true;
    this.input.value = '';
    this.input.blur();
    this.onSelect(hexagram);
  }
}
