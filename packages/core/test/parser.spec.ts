import { describe, it, expect } from 'vitest';
import { parseSrt, serializeSrt, extractTexts, rebuildFromTranslations } from '../src/parser';

const sampleSrt = `1
00:00:01,000 --> 00:00:04,000
<font color="#fff">Hello &amp; world</font>

2
00:00:05,000 --> 00:00:07,000
Second line

`;

describe('SRT parser', () => {
  it('parses entries and preserves timestamps and tags', () => {
    const entries = parseSrt(sampleSrt);
    expect(entries.length).toBe(2);
    expect(entries[0].start).toBe(1000);
    expect(entries[0].end).toBe(4000);
    expect(entries[0].text).toContain('<font');
    expect(entries[0].text).toContain('&amp;');
  });

  it('serializes back to SRT-like format containing timestamps and text', () => {
    const entries = parseSrt(sampleSrt);
    const out = serializeSrt(entries);
    expect(out).toContain('00:00:01');
    expect(out).toContain('<font');
    expect(out).toContain('Hello');
  });

  it('extractTexts decodes HTML entities', () => {
    const entries = parseSrt(sampleSrt);
    const texts = extractTexts(entries);
    expect(texts[0]).toContain('Hello & world');
    // tags are preserved
    expect(texts[0]).toContain('<font');
  });

  it('rebuildFromTranslations replaces texts correctly', () => {
    const entries = parseSrt(sampleSrt);
    const translations = ['<font color="#fff">Hola mundo</font>', 'Segunda línea'];
    const rebuilt = rebuildFromTranslations(entries, translations);
    expect(rebuilt[0].text).toBe(translations[0]);
    const out = serializeSrt(rebuilt);
    expect(out).toContain('Hola');
  });
});
