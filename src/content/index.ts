import type { ClassicText, Guide, NiCommentary } from './types.ts';

const classicModules = import.meta.glob<ClassicText>('./classics/*.json', {
  eager: true,
  import: 'default',
});
const guideModules = import.meta.glob<Guide>('./guide/*.json', {
  eager: true,
  import: 'default',
});
const niModules = import.meta.glob<NiCommentary>('./ni/*.json', {
  eager: true,
  import: 'default',
});
const pictureModules = import.meta.glob<string>('../assets/tujie/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function indexByNumber<T extends { number: number }>(modules: Record<string, T>): Map<number, T> {
  return new Map(Object.values(modules).map((entry) => [entry.number, entry]));
}

const classics = indexByNumber(classicModules);
const guides = indexByNumber(guideModules);
const niCommentaries = indexByNumber(niModules);

/** Picture files are named by hexagram number, such as 03.jpg. */
const pictures = new Map(
  Object.entries(pictureModules).map(([path, url]) => {
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    return [Number.parseInt(fileName, 10), url];
  }),
);

export function classicOf(number: number): ClassicText {
  const classic = classics.get(number);
  if (!classic) {
    throw new Error(`Missing classic text for hexagram ${number}`);
  }
  return classic;
}

export function guideOf(number: number): Guide | undefined {
  return guides.get(number);
}

export function niCommentaryOf(number: number): NiCommentary | undefined {
  return niCommentaries.get(number);
}

export function pictureOf(number: number): string | undefined {
  return pictures.get(number);
}
