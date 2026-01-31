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
    expect(out[0]).toBe('T1');
    expect(out[1]).toBe('T2');
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
});
