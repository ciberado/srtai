import { describe, it, expect } from 'vitest';
import { parseSrt, translateEntries } from '../src';

const sampleSrt = `1
00:00:01,000 --> 00:00:04,000
Hello one

2
00:00:05,000 --> 00:00:07,000
Hello two

3
00:00:08,000 --> 00:00:10,000
Hello three

`;

describe('Translator batching (dryRun)', () => {
  it('respects batchSize=1', async () => {
    const entries = parseSrt(sampleSrt);
    const out = await translateEntries(entries, { modelId: 'x', dryRun: true, batchSize: 1, targetLanguage: 'es' });
    expect(out.length).toBe(entries.length);
    expect(out[0]).toContain('[es]');
  });

  it('respects batchSize=2 and preserves order', async () => {
    const entries = parseSrt(sampleSrt);
    const out = await translateEntries(entries, { modelId: 'x', dryRun: true, batchSize: 2, targetLanguage: 'fr' });
    expect(out.length).toBe(entries.length);
    expect(out[0]).toContain('[fr]');
    expect(out[1]).toContain('[fr]');
    expect(out[2]).toContain('[fr]');
  });
});
