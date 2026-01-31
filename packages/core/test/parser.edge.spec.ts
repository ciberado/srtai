import { describe, it, expect } from 'vitest';
import { parseSrt, serializeSrt } from '../src/parser';

describe('Parser edge cases', () => {
  it('handles multi-line cue text', () => {
    const srt = `1\n00:00:00,000 --> 00:00:02,000\nLine1\nLine2\n\n`;
    const entries = parseSrt(srt);
    expect(entries[0].text).toContain('Line1');
    expect(entries[0].text).toContain('Line2');
    const out = serializeSrt(entries);
    expect(out).toContain('Line1');
    expect(out).toContain('Line2');
  });

  it('preserves high-precision milliseconds', () => {
    const srt = `1\n00:00:00,123 --> 00:00:01,456\nHi\n\n`;
    const entries = parseSrt(srt);
    expect(entries[0].start).toBe(123);
    expect(entries[0].end).toBe(1456);
  });

  it('handles RTL characters and special symbols', () => {
    const srt = `1\n00:00:00,000 --> 00:00:02,000\nשלום עולם\n\n`;
    const entries = parseSrt(srt);
    expect(entries[0].text).toContain('שלום');
  });
});
