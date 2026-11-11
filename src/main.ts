import { guideOf } from './content/index.ts';
import { HEXAGRAMS, TRIGRAMS, hexagramByNumber, type Hexagram } from './domain/hexagrams.ts';
import { SphereScene } from './scene/sphere-scene.ts';
import {
  THEMES,
  applyThemeToDocument,
  loadSavedTheme,
  saveTheme,
  type Theme,
} from './theme/themes.ts';
import { DetailPanel } from './ui/detail-panel.ts';
import { h } from './ui/dom.ts';
import { createHexagramChip } from './ui/figure.ts';
import { SearchBox } from './ui/search-box.ts';

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
}

const tooltip = requireElement('tooltip');
const rotateToggle = requireElement<HTMLButtonElement>('rotate-toggle');
const catalogDialog = requireElement<HTMLDialogElement>('catalog-dialog');
const primerDialog = requireElement<HTMLDialogElement>('primer-dialog');

const themeToggle = requireElement<HTMLButtonElement>('theme-toggle');
const themeMenu = requireElement('theme-menu');

let activeTheme = loadSavedTheme();
applyThemeToDocument(activeTheme);

const scene = new SphereScene(
  requireElement('stage-view'),
  {
    onPick: (hexagram) => navigateTo(hexagram),
    onHover: showTooltip,
  },
  activeTheme,
);

const panel = new DetailPanel(requireElement('panel'), {
  onNavigate: (hexagram) => navigateTo(hexagram),
  onClose: () => navigateTo(null),
});

const searchBox = new SearchBox(requireElement('search'), (hexagram) => navigateTo(hexagram));

/** The selected hexagram lives in the URL hash, as in "#/3", so a view can be linked to. */
function navigateTo(hexagram: Hexagram | null): void {
  const hash = hexagram ? `#/${hexagram.number}` : '';
  if (window.location.hash === hash) {
    applyRoute();
    return;
  }
  if (hash) {
    window.location.hash = hash;
  } else {
    history.pushState(null, '', window.location.pathname + window.location.search);
    applyRoute();
  }
}

function hexagramFromHash(): Hexagram | null {
  const match = /^#\/(\d+)$/.exec(window.location.hash);
  const number = match ? Number(match[1]) : Number.NaN;
  return number >= 1 && number <= HEXAGRAMS.length ? hexagramByNumber(number) : null;
}

function applyRoute(): void {
  const hexagram = hexagramFromHash();
  if (hexagram) {
    panel.show(hexagram);
  } else {
    panel.hide();
  }
  scene.setSelection(hexagram, { focus: true });
  syncRotateToggle();
  document.title = hexagram ? `${hexagram.name} · 六十四卦` : '六十四卦 · 卦象球';
}

function showTooltip(hexagram: Hexagram | null, clientX: number, clientY: number): void {
  if (!hexagram) {
    tooltip.hidden = true;
    return;
  }
  const guide = guideOf(hexagram.number);
  tooltip.replaceChildren(
    h('strong', { text: `${hexagram.name} ${hexagram.pinyin}` }),
    h('span', { text: `第 ${hexagram.number} 卦 · ${hexagram.fullName}` }),
    guide ? h('span', { class: 'tooltip-keyword', text: guide.keyword }) : '',
  );
  tooltip.hidden = false;
  tooltip.style.left = `${clientX + 16}px`;
  tooltip.style.top = `${clientY + 16}px`;
}

function syncRotateToggle(): void {
  rotateToggle.setAttribute('aria-pressed', String(scene.autoRotate));
}

function buildCatalog(): void {
  requireElement('catalog-grid').append(
    ...HEXAGRAMS.map((hexagram) =>
      createHexagramChip(hexagram, (target) => {
        catalogDialog.close();
        navigateTo(target);
      }),
    ),
  );
}

function buildTrigramTable(): void {
  requireElement('trigram-table').append(
    ...Object.values(TRIGRAMS).map((trigram) =>
      h('div', { class: 'trigram-cell' }, [
        h('span', { class: 'trigram-symbol', text: trigram.symbol }),
        h('span', { class: 'trigram-cell-name', text: trigram.name }),
        h('span', { class: 'trigram-cell-nature', text: trigram.nature }),
      ]),
    ),
  );
}

function setTheme(theme: Theme): void {
  activeTheme = theme;
  applyThemeToDocument(theme);
  scene.setTheme(theme);
  saveTheme(theme);
  buildThemeMenu();
}

function buildThemeMenu(): void {
  themeMenu.replaceChildren(
    ...THEMES.map((theme) =>
      h('li', {}, [
        h(
          'button',
          {
            class: 'theme-option',
            attrs: {
              type: 'button',
              role: 'radio',
              'aria-checked': String(theme.key === activeTheme.key),
            },
            on: { click: () => setTheme(theme) },
          },
          [
            h('span', { class: 'theme-swatch', attrs: { style: `background: ${theme.scene.background}` } }, [
              h('span', { attrs: { style: `background: ${theme.scene.yangLine}` } }),
              h('span', { attrs: { style: `background: ${theme.scene.yinLine}` } }),
              h('span', { attrs: { style: `background: ${theme.css.accent}` } }),
            ]),
            h('span', { class: 'theme-option-text' }, [
              h('span', { class: 'theme-option-name', text: theme.name }),
              h('span', { class: 'theme-option-description', text: theme.description }),
            ]),
          ],
        ),
      ]),
    ),
  );
}

function setThemeMenuOpen(open: boolean): void {
  themeMenu.hidden = !open;
  themeToggle.setAttribute('aria-expanded', String(open));
}

function bindDialog(dialog: HTMLDialogElement, openButtonId: string): void {
  requireElement(openButtonId).addEventListener('click', () => dialog.showModal());
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}

themeToggle.addEventListener('click', () => {
  setThemeMenuOpen(themeToggle.getAttribute('aria-expanded') !== 'true');
});
document.addEventListener('pointerdown', (event) => {
  if (!requireElement('theme-picker').contains(event.target as Node)) {
    setThemeMenuOpen(false);
  }
});

rotateToggle.addEventListener('click', () => {
  scene.setAutoRotate(!scene.autoRotate);
  syncRotateToggle();
});

document.addEventListener('keydown', (event) => {
  const isTyping = event.target instanceof HTMLInputElement;
  const dialogOpen = catalogDialog.open || primerDialog.open;
  if (event.key === '/' && !isTyping && !dialogOpen) {
    event.preventDefault();
    searchBox.focus();
  } else if (event.key === 'Escape' && !themeMenu.hidden) {
    setThemeMenuOpen(false);
  } else if (event.key === 'Escape' && !isTyping && !dialogOpen) {
    navigateTo(null);
  }
});

window.addEventListener('hashchange', applyRoute);

buildCatalog();
buildTrigramTable();
buildThemeMenu();
bindDialog(catalogDialog, 'open-catalog');
bindDialog(primerDialog, 'open-primer');
applyRoute();
