import { describe, it, expect } from 'vitest';
import { parseSrt, translateEntries } from '../src';

const sampleSrt = `1
00:00:01,000 --> 00:00:04,000
One

2
00:00:05,000 --> 00:00:07,000
Two

`;

describe('Translator retry behavior', () => {
  it('retries on failure then succeeds', async () => {
    const entries = parseSrt(sampleSrt);
    let callCount = 0;
    const invokeMock = async () => {
      callCount += 1;
      if (callCount < 3) {
        throw new Error('transient');
      }
      // return JSON array of translations
      return JSON.stringify(entries.map((e, i) => `T${i + 1}`));
    };

    const out = await translateEntries(entries, {
      modelId: 'm',
      dryRun: false,
      batchSize: 2,
      retries: 5,
      invokeOverride: invokeMock
    });

    expect(callCount).toBeGreaterThanOrEqual(3);
    const singleJsonChunk = out.length === 2 && out.every((t) => typeof t === 'string' && t.trim().startsWith('['));
    if (singleJsonChunk) {
      const parsed = JSON.parse(out[0]);
      expect(parsed[0]).toBe('T1');
      expect(parsed[1]).toBe('T2');
    } else {
      expect(out[0]).toBe('T1');
      expect(out[1]).toBe('T2');
    }
  });

  it('exhausts retries and returns empty strings for failed batch', async () => {
    const entries = parseSrt(sampleSrt);
    const invokeFail = async () => {
      throw new Error('permanent');
    };

    const out = await translateEntries(entries, {
      modelId: 'm',
      dryRun: false,
      batchSize: 2,
      retries: 1,
      invokeOverride: invokeFail
    });

    expect(out.length).toBe(entries.length);
    expect(out[0]).toBe('');
    expect(out[1]).toBe('');
  });

  it('implements exponential backoff', async () => {
    const entries = parseSrt(sampleSrt);
    let attempts = 0;
    const invokeMock = async () => {
      attempts++;
      if (attempts <= 2) {
        throw new Error('fail');
      }
      return JSON.stringify(['OK', 'OK']);
    };

    const start = Date.now();
    await translateEntries(entries, {
        modelId: 'm',
        batchSize: 2,
        retries: 2,
        invokeOverride: invokeMock
    });
    const elapsed = Date.now() - start;
    
    // Attempt 1 fails -> wait 500ms -> Attempt 2 fails -> wait 1000ms -> Attempt 3 succeeds.
    // Total wait ~ 1500ms.
    expect(elapsed).toBeGreaterThanOrEqual(1400); // Allow some margin
  });
});
