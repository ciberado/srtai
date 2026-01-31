import { parse as parseSrtRaw, stringify as stringifySrt } from 'subtitle';
import he from 'he';

export type SrtEntry = {
  id: number;
  start: number; // milliseconds
  end: number; // milliseconds
  text: string; // raw text as in file (may include tags)
};

export function parseSrt(srt: string): SrtEntry[] {
  const raw = parseSrtRaw(srt);
  // `subtitle.parse` returns items with { type: 'cue', data: { start, end, text } }
  const entries: SrtEntry[] = raw
    .filter((i: any) => i.type === 'cue')
    .map((c: any, idx: number) => ({
      id: idx + 1,
      start: c.data.start,
      end: c.data.end,
      text: c.data.text
    }));
  return entries;
}

export function serializeSrt(entries: SrtEntry[]): string {
  const cues = entries.map((e) => ({
    start: e.start,
    end: e.end,
    text: e.text
  }));
  return stringifySrt(cues);
}

export function extractTexts(entries: SrtEntry[]): string[] {
  // Return an array of texts suitable for sending to the translator.
  // We decode HTML entities but preserve inline tags — tag-preserving
  // handling will be responsibility of translator to respect tags.
  return entries.map((e) => he.decode(e.text));
}

export function rebuildFromTranslations(entries: SrtEntry[], translations: string[]): SrtEntry[] {
  if (entries.length !== translations.length) {
    throw new Error('Translations length must match entries length');
  }
  return entries.map((e, i) => ({ ...e, text: translations[i] }));
}
