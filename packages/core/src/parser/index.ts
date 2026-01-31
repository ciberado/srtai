import he from 'he';

export type SrtEntry = {
  id: number;
  start: number; // milliseconds
  end: number; // milliseconds
  text: string; // raw text as in file (may include tags)
};

function parseTimeToMs(t: string): number {
  // t like HH:MM:SS,mmm
  const m = t.trim().match(/(\d+):(\d+):(\d+),(\d+)/);
  if (!m) return 0;
  const [, hh, mm, ss, ms] = m;
  return (
    parseInt(hh, 10) * 3600 * 1000 +
    parseInt(mm, 10) * 60 * 1000 +
    parseInt(ss, 10) * 1000 +
    parseInt(ms, 10)
  );
}

function formatMsToTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${String(millis).padStart(3, '0')}`;
}

export function parseSrt(srt: string): SrtEntry[] {
  const parts = srt.split(/\r?\n\r?\n+/).map((p) => p.trim()).filter(Boolean);
  const entries: SrtEntry[] = parts.map((block, idx) => {
    const lines = block.split(/\r?\n/);
    // first line sometimes is numeric id
    let ptr = 0;
    if (/^\d+$/.test(lines[0].trim())) ptr = 1;
    const timeLine = lines[ptr++] || '';
    const [startRaw, endRaw] = timeLine.split('-->').map((s) => s && s.trim());
    const text = lines.slice(ptr).join('\n');
    return {
      id: idx + 1,
      start: parseTimeToMs(startRaw || '00:00:00,000'),
      end: parseTimeToMs(endRaw || '00:00:00,000'),
      text
    };
  });
  return entries;
}

export function serializeSrt(entries: SrtEntry[]): string {
  return entries
    .map((e, i) => {
      const idx = i + 1;
      const t = `${formatMsToTime(e.start)} --> ${formatMsToTime(e.end)}`;
      return `${idx}\n${t}\n${e.text}`;
    })
    .join('\n\n') + '\n\n';
}

export function extractTexts(entries: SrtEntry[]): string[] {
  return entries.map((e) => he.decode(e.text));
}

export function rebuildFromTranslations(entries: SrtEntry[], translations: string[]): SrtEntry[] {
  if (entries.length !== translations.length) {
    throw new Error('Translations length must match entries length');
  }
  return entries.map((e, i) => ({ ...e, text: translations[i] }));
}
