import { classicOf, guideOf, niCommentaryOf, pictureOf } from '../content/index.ts';
import type { ClassicLine, GuideLine, NiCommentaryAvailable, Source } from '../content/types.ts';
import {
  HEXAGRAM_COUNT,
  LINE_COUNT,
  changedHexagram,
  hexagramByNumber,
  nuclearHexagram,
  oppositeHexagram,
  reversedHexagram,
  type Hexagram,
} from '../domain/hexagrams.ts';
import { h } from './dom.ts';
import { createHexagramChip, createLabelledFigure, createLineStack } from './figure.ts';

export interface DetailPanelCallbacks {
  onNavigate(hexagram: Hexagram): void;
  onClose(): void;
}

type TabKey = 'guide' | 'text' | 'picture' | 'ni' | 'relations';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'guide', label: '入门' },
  { key: 'text', label: '原文逐爻' },
  { key: 'picture', label: '图解' },
  { key: 'ni', label: '倪师讲解' },
  { key: 'relations', label: '卦变' },
];

const LINE_POSITION_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

function section(title: string, children: (Node | null | undefined | false)[]): HTMLElement {
  return h('section', { class: 'block' }, [h('h3', { class: 'block-title', text: title }), ...children]);
}

function notice(text: string): HTMLElement {
  return h('p', { class: 'notice', text });
}

function bulletList(items: string[]): HTMLElement {
  return h(
    'ul',
    { class: 'bullets' },
    items.map((item) => h('li', { text: item })),
  );
}

function sourceList(sources: Source[]): HTMLElement {
  return h(
    'ul',
    { class: 'sources' },
    sources.map((source) =>
      h('li', {}, [
        h('a', {
          text: source.title,
          attrs: { href: source.url, target: '_blank', rel: 'noopener noreferrer' },
        }),
      ]),
    ),
  );
}

/** Shows everything about one hexagram in a side panel with tabs. */
export class DetailPanel {
  private readonly root: HTMLElement;
  private readonly callbacks: DetailPanelCallbacks;
  private activeTab: TabKey = 'guide';
  private hexagram: Hexagram | null = null;

  constructor(root: HTMLElement, callbacks: DetailPanelCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
  }

  show(hexagram: Hexagram): void {
    this.hexagram = hexagram;
    this.root.hidden = false;
    this.render();
    this.root.scrollTop = 0;
  }

  hide(): void {
    this.hexagram = null;
    this.root.hidden = true;
  }

  private render(): void {
    const hexagram = this.hexagram;
    if (!hexagram) {
      return;
    }
    const guide = guideOf(hexagram.number);
    const children = [
      this.renderHeader(hexagram),
      guide ? h('p', { class: 'summary', text: guide.summary }) : null,
      this.renderTabs(),
      h('div', { class: 'tab-body', attrs: { role: 'tabpanel' } }, [this.renderTab(hexagram)]),
    ];
    this.root.replaceChildren(...children.filter((child) => child !== null));
  }

  private renderHeader(hexagram: Hexagram): HTMLElement {
    const guide = guideOf(hexagram.number);
    const stepTo = (offset: number) => {
      const number = ((hexagram.number - 1 + offset + HEXAGRAM_COUNT) % HEXAGRAM_COUNT) + 1;
      this.callbacks.onNavigate(hexagramByNumber(number));
    };
    const iconButton = (label: string, glyph: string, onClick: () => void) =>
      h('button', {
        class: 'icon-button',
        text: glyph,
        attrs: { type: 'button', 'aria-label': label, title: label },
        on: { click: onClick },
      });
    return h('header', { class: 'panel-header' }, [
      h('div', { class: 'panel-actions' }, [
        iconButton('上一卦', '‹', () => stepTo(-1)),
        iconButton('下一卦', '›', () => stepTo(1)),
        h('span', { class: 'panel-actions-spacer' }),
        iconButton('关闭', '×', () => this.callbacks.onClose()),
      ]),
      h('div', { class: 'panel-identity' }, [
        createLabelledFigure(hexagram),
        h('div', { class: 'panel-title' }, [
          h('p', { class: 'eyebrow', text: `第 ${hexagram.number} 卦 · ${hexagram.fullName}` }),
          h('h2', {}, [
            h('span', { text: hexagram.name }),
            h('span', { class: 'pinyin', text: hexagram.pinyin }),
          ]),
          guide ? h('p', { class: 'keyword', text: guide.keyword }) : null,
        ]),
      ]),
    ]);
  }

  private renderTabs(): HTMLElement {
    return h(
      'nav',
      { class: 'tabs', attrs: { role: 'tablist' } },
      TABS.map((tab) =>
        h('button', {
          class: tab.key === this.activeTab ? 'tab is-active' : 'tab',
          text: tab.label,
          attrs: {
            type: 'button',
            role: 'tab',
            'aria-selected': String(tab.key === this.activeTab),
          },
          on: {
            click: () => {
              this.activeTab = tab.key;
              this.render();
              this.scrollToTabStart();
            },
          },
        }),
      ),
    );
  }

  /**
   * After a tab change the panel keeps its scroll offset. When the reader had
   * scrolled into the previous tab, that offset would land in the middle or at
   * the end of the new tab, so the panel scrolls back to where the tab begins.
   */
  private scrollToTabStart(): void {
    const tabs = this.root.querySelector<HTMLElement>('.tabs');
    const body = this.root.querySelector<HTMLElement>('.tab-body');
    if (!tabs || !body) {
      return;
    }
    const bodyTop = body.getBoundingClientRect().top - this.root.getBoundingClientRect().top;
    // The tab bar stays fixed at the top of the panel, so the body starts right below it.
    const tabStart = this.root.scrollTop + bodyTop - tabs.offsetHeight;
    if (this.root.scrollTop > tabStart) {
      this.root.scrollTop = tabStart;
    }
  }

  private renderTab(hexagram: Hexagram): HTMLElement {
    switch (this.activeTab) {
      case 'guide':
        return this.renderGuideTab(hexagram);
      case 'text':
        return this.renderTextTab(hexagram);
      case 'picture':
        return this.renderPictureTab(hexagram);
      case 'ni':
        return this.renderNiTab(hexagram);
      case 'relations':
        return this.renderRelationsTab(hexagram);
    }
  }

  private renderGuideTab(hexagram: Hexagram): HTMLElement {
    const guide = guideOf(hexagram.number);
    if (!guide) {
      return h('div', {}, [notice('这一卦的入门讲解还在整理中，可以先看“原文逐爻”。')]);
    }
    return h('div', {}, [
      section(
        '这一卦讲什么',
        guide.overview.map((paragraph) => h('p', { text: paragraph })),
      ),
      section('现实中的启示', [bulletList(guide.advice)]),
      section('字词', [
        h(
          'dl',
          { class: 'glossary' },
          guide.glossary.flatMap((entry) => [
            h('dt', {}, [
              h('span', { text: entry.term }),
              entry.pinyin ? h('span', { class: 'pinyin', text: entry.pinyin }) : null,
            ]),
            h('dd', { text: entry.meaning }),
          ]),
        ),
      ]),
    ]);
  }

  private renderTextTab(hexagram: Hexagram): HTMLElement {
    const classic = classicOf(hexagram.number);
    const guide = guideOf(hexagram.number);
    const classicQuote = (text: string) => h('p', { class: 'classic', text });
    const plain = (text: string | undefined) => (text ? h('p', { class: 'plain', text }) : null);
    const note = (text: string | undefined) => (text ? h('p', { class: 'note', text }) : null);

    return h('div', {}, [
      section('卦辞', [
        classicQuote(`${hexagram.name}：${classic.judgment}`),
        plain(guide?.judgmentPlain),
        note(guide?.judgmentNote),
      ]),
      section('彖传', [
        h('p', { class: 'hint', text: '《彖传》解释卦名和卦辞，说明这一卦整体的道理。' }),
        classicQuote(classic.tuan),
        plain(guide?.tuanPlain),
      ]),
      section('大象传', [
        h('p', { class: 'hint', text: '《大象传》从上下卦的自然景象出发，讲君子应当怎样效法。' }),
        classicQuote(classic.image),
        plain(guide?.imagePlain),
      ]),
      section('六爻', [
        h('p', { class: 'hint', text: '爻自下而上读：初爻在最下面，上爻在最上面。“九”是阳爻，“六”是阴爻。' }),
        ...classic.lines.map((line, index) =>
          this.renderLineCard(hexagram, line, guide?.lines[index], index + 1),
        ),
      ]),
    ]);
  }

  private renderLineCard(
    hexagram: Hexagram,
    line: ClassicLine,
    guideLine: GuideLine | undefined,
    lineNumber: number,
  ): HTMLElement {
    // 乾 and 坤 have a seventh statement that applies when all six lines change.
    const isExtraStatement = lineNumber > LINE_COUNT;
    const changed = isExtraStatement
      ? oppositeHexagram(hexagram)
      : changedHexagram(hexagram, lineNumber);
    const changeLabel = isExtraStatement ? '六爻全变' : `${LINE_POSITION_NAMES[lineNumber - 1]}变`;
    return h('article', { class: 'line-card' }, [
      h('div', { class: 'line-card-head' }, [
        createLineStack(hexagram, isExtraStatement ? undefined : lineNumber),
        h('span', { class: 'line-label', text: line.label }),
        h('span', { class: 'line-change' }, [
          h('span', { text: `${changeLabel} →` }),
          createHexagramChip(changed, this.callbacks.onNavigate),
        ]),
      ]),
      h('p', { class: 'classic', text: line.text }),
      h('p', { class: 'classic-minor', text: `象曰：${line.image}` }),
      guideLine ? h('p', { class: 'plain', text: guideLine.plain }) : null,
      guideLine ? h('p', { class: 'note', text: guideLine.note }) : null,
    ]);
  }

  private renderPictureTab(hexagram: Hexagram): HTMLElement {
    const picture = pictureOf(hexagram.number);
    const ni = niCommentaryOf(hexagram.number);
    const imageReading = ni?.status === 'available' ? ni.imageReading : undefined;
    return h('div', {}, [
      picture
        ? h('img', {
            class: 'picture',
            attrs: { src: picture, alt: `${hexagram.fullName}图解` },
          })
        : h('div', { class: 'picture-placeholder' }, [
            h('p', { text: '图解待补充' }),
            h('p', {
              class: 'hint',
              text: `把图片放到 src/assets/tujie/${String(hexagram.number).padStart(2, '0')}.jpg 后会显示在这里。`,
            }),
          ]),
      imageReading
        ? section('倪师《卦图象解》要点', [
            h('p', { class: 'classic-minor', text: `图中：${imageReading.scene}` }),
            imageReading.motto ? h('p', { class: 'motto', text: imageReading.motto }) : null,
            bulletList(imageReading.points),
            h('p', { class: 'hint', text: '出处见“倪师讲解”一栏。' }),
          ])
        : null,
    ]);
  }

  private renderNiTab(hexagram: Hexagram): HTMLElement {
    const ni = niCommentaryOf(hexagram.number);
    if (!ni) {
      return h('div', {}, [notice('这一卦的倪师讲解还在整理中。')]);
    }
    if (ni.status === 'missing') {
      return h('div', {}, [notice('暂缺：没有找到这一卦可靠的倪师讲解文字。'), h('p', { class: 'hint', text: ni.note })]);
    }
    return this.renderNiCommentary(ni);
  }

  private renderNiCommentary(ni: NiCommentaryAvailable): HTMLElement {
    return h('div', {}, [
      h('p', {
        class: 'hint',
        text: '以下是根据网络上流传的倪海厦《天纪》文字整理的要点摘要，不是原文，细节请以出处为准。',
      }),
      ni.humanWay.summary
        ? section('人间道：整体看法', [h('p', { text: ni.humanWay.summary })])
        : null,
      ni.humanWay.judgment
        ? section('卦辞怎么讲', [h('p', { text: ni.humanWay.judgment })])
        : null,
      ni.humanWay.lines.length > 0
        ? section('逐爻要点', [bulletList(ni.humanWay.lines)])
        : null,
      ni.divination?.length ? section('占断要点', [bulletList(ni.divination)]) : null,
      ni.note ? h('p', { class: 'hint', text: ni.note }) : null,
      section('出处', [sourceList(ni.sources)]),
    ]);
  }

  private renderRelationsTab(hexagram: Hexagram): HTMLElement {
    const relationCard = (
      color: string,
      title: string,
      explanation: string,
      target: Hexagram,
    ): HTMLElement =>
      h('article', { class: 'relation-card', attrs: { style: `--relation-color: ${color}` } }, [
        h('div', { class: 'relation-head' }, [
          h('span', { class: 'relation-title', text: title }),
          target.code === hexagram.code
            ? h('span', { class: 'relation-self', text: '就是它自己' })
            : createHexagramChip(target, this.callbacks.onNavigate),
        ]),
        h('p', { text: explanation }),
      ]);

    return h('div', {}, [
      section('三种结构关系', [
        relationCard(
          'var(--relation-opposite)',
          '错卦',
          '六爻的阴阳全部相反。它是同一件事的反面，在球上位于正对面，用虚线穿过球心相连。',
          oppositeHexagram(hexagram),
        ),
        relationCard(
          'var(--relation-reversed)',
          '综卦',
          '把整个卦上下颠倒。它相当于站到对方的位置，回头看同一件事。',
          reversedHexagram(hexagram),
        ),
        relationCard(
          'var(--relation-nuclear)',
          '互卦',
          '取二、三、四爻作下卦，三、四、五爻作上卦。它是藏在卦内部的结构，常用来看事情发展的过程。',
          nuclearHexagram(hexagram),
        ),
      ]),
      section('变卦：只变一爻', [
        h('p', {
          class: 'hint',
          text: '某一爻由阴变阳或由阳变阴，就得到一个新的卦。球上的金色连线就是这六条路。',
        }),
        h(
          'div',
          { class: 'change-grid' },
          LINE_POSITION_NAMES.map((name, index) =>
            h('div', { class: 'change-item' }, [
              h('span', { class: 'change-name', text: `${name}变` }),
              createHexagramChip(changedHexagram(hexagram, index + 1), this.callbacks.onNavigate),
            ]),
          ),
        ),
      ]),
    ]);
  }
}
