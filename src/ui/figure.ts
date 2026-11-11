import { LINE_COUNT, lineTitles, type Hexagram } from '../domain/hexagrams.ts';
import { h } from './dom.ts';

/**
 * Draws the six lines of a hexagram, top line first. `highlightLine` is a
 * line number from 1 (bottom) to 6 (top) to emphasize.
 */
export function createLineStack(hexagram: Hexagram, highlightLine?: number): HTMLElement {
  const titles = lineTitles(hexagram);
  const stack = h('div', { class: 'line-stack', attrs: { role: 'img', 'aria-label': hexagram.fullName } });
  for (let line = LINE_COUNT; line >= 1; line -= 1) {
    const isYang = hexagram.lines[line - 1];
    const classes = ['line', isYang ? 'is-yang' : 'is-yin'];
    if (highlightLine !== undefined) {
      classes.push(line === highlightLine ? 'is-highlighted' : 'is-muted');
    }
    stack.append(h('span', { class: classes.join(' '), attrs: { title: titles[line - 1] } }));
  }
  return stack;
}

/** The large figure in the panel header, with the two trigrams labelled. */
export function createLabelledFigure(hexagram: Hexagram): HTMLElement {
  const trigramLabel = (position: string, trigram: Hexagram['upper']) =>
    h('div', { class: 'trigram-label' }, [
      h('span', { class: 'trigram-position', text: position }),
      h('span', { class: 'trigram-name', text: `${trigram.name} · ${trigram.nature}` }),
    ]);
  return h('div', { class: 'figure' }, [
    createLineStack(hexagram),
    h('div', { class: 'trigram-labels' }, [
      trigramLabel('上卦', hexagram.upper),
      trigramLabel('下卦', hexagram.lower),
    ]),
  ]);
}

/** A clickable chip that names a hexagram and leads to it. */
export function createHexagramChip(
  hexagram: Hexagram,
  onNavigate: (hexagram: Hexagram) => void,
): HTMLButtonElement {
  return h(
    'button',
    {
      class: 'hexagram-chip',
      attrs: { type: 'button', title: `第 ${hexagram.number} 卦 ${hexagram.fullName}` },
      on: { click: () => onNavigate(hexagram) },
    },
    [
      createLineStack(hexagram),
      h('span', { class: 'chip-name', text: hexagram.name }),
      h('span', { class: 'chip-number', text: String(hexagram.number) }),
    ],
  );
}
