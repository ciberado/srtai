import { describe, it, expect } from 'vitest';
import path from 'path';
import dotenv from 'dotenv';
import { parseSrt, translateEntries } from '../src';

// Load root .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sampleSrt = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:07,000
Second line

`;

describe('Translator integration (Bedrock)', () => {
  it('dryRun returns prefixed translations', async () => {
    const entries = parseSrt(sampleSrt);
    const out = await translateEntries(entries, { modelId: 'dummy', dryRun: true, targetLanguage: 'es', batchSize: 1 });
    expect(out.length).toBe(entries.length);
    expect(out[0]).toContain('[es]');
  });

  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) {
    it('skips real Bedrock test if BEDROCK_MODEL_ID not set', () => {
      expect(modelId).toBeUndefined();
    });
    return;
  }

  it('calls Bedrock and returns translations', async () => {
    const entries = parseSrt(sampleSrt);
    const out = await translateEntries(entries, {
      modelId: modelId,
      region: process.env.AWS_REGION || 'us-east-1',
      batchSize: 1,
      retries: 2,
      dryRun: false,
      targetLanguage: 'es'
    });
    expect(out.length).toBe(entries.length);
    for (const t of out) {
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    }
  }, 120000);
});
