import { describe, it, expect } from 'vitest';
import { parseSrt, rebuildFromTranslations, serializeSrt } from '../src/parser';

describe('Tag preservation', () => {
  it('preserves inline tags when translations include tags', () => {
    const srt = `1\n00:00:01,000 --> 00:00:03,000\n<font color="#fff">Hello &amp; world</font>\n\n`;
    const entries = parseSrt(srt);
    const translations = ['<font color="#fff">Hola & mundo</font>'];
    const rebuilt = rebuildFromTranslations(entries, translations);
    const out = serializeSrt(rebuilt);
    expect(out).toContain('<font');
    expect(out).toContain('Hola & mundo');
    // timestamps unchanged
    expect(out).toContain('00:00:01,000');
    expect(out).toContain('00:00:03,000');
  });
});
