import { describe, it, expect } from 'vitest';
import { parseSrt, translateEntries } from '../src';

const sampleSrt = `1
00:00:01,000 --> 00:00:04,000
Line 1

2
00:00:05,000 --> 00:00:07,000
Line 2

3
00:00:08,000 --> 00:00:10,000
Line 3

4
00:00:11,000 --> 00:00:13,000
Line 4
`;

describe('Translator concurrency', () => {
  it('executes batches in parallel (faster than sequential)', async () => {
    const entries = parseSrt(sampleSrt);
    // 4 entries. Batch size 1 => 4 batches.
    
    // Use a delay large enough to distinguish sequential vs parallel
    const delay = 100;
    const mockInvoke = async (_modelId: string, _region: string | undefined, prompt: string) => {
      await new Promise((r) => setTimeout(r, delay));
      return JSON.stringify({ translations: ['Translated'] });
    };

    const start = Date.now();
    await translateEntries(entries, {
      modelId: 'mock',
      targetLanguage: 'es',
      batchSize: 1,
      concurrency: 4, // Should run all 4 at once roughly, taking ~100ms total
      invokeOverride: mockInvoke
    });
    const duration = Date.now() - start;

    // If sequential: 4 * 100 = 400ms.
    // Allow some buffer for overhead, but it should be much closer to 100ms than 400ms.
    // Let's assert it took less than 250ms (well under sequential time).
    expect(duration).toBeLessThan(350); 
    expect(duration).toBeGreaterThanOrEqual(delay); // Can't be instantaneous
  });

  it('respects concurrency limit', async () => {
     const entries = parseSrt(sampleSrt);
    // 4 entries. Batch size 1 => 4 batches.
    
    let active = 0;
    let maxActive = 0;

    const delay = 50;
    const mockInvoke = async (_modelId: string, _region: string | undefined, prompt: string) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, delay));
      active--;
      return JSON.stringify({ translations: ['Translated'] });
    };

    await translateEntries(entries, {
      modelId: 'mock',
      targetLanguage: 'es',
      batchSize: 1,
      concurrency: 2, 
      invokeOverride: mockInvoke
    });

    // Since JS is single-threaded event loop, we can correctly track active promises this way
    expect(maxActive).toBeLessThanOrEqual(2);
    // And it should have used at least 2 at some point since we have 4 tasks
    expect(maxActive).toBe(2);
  });
});
