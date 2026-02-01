import { describe, it, expect } from 'vitest';
import { parseSrt, translateEntries } from '../src';

const sampleSrt = `1
00:00:01,000 --> 00:00:04,000
Hello world`;

describe('Translator prompt construction', () => {
  it('includes filename context when provided', async () => {
    const entries = parseSrt(sampleSrt);
    let capturedPrompt = '';
    
    const mockInvoke = async (_modelId: string, _region: string | undefined, prompt: string) => {
      capturedPrompt = prompt;
      return JSON.stringify({ translations: ['Hola mundo'] });
    };

    await translateEntries(entries, {
      modelId: 'mock',
      targetLanguage: 'es',
      batchSize: 1,
      filename: 'Star_Trek_Test.srt',
      invokeOverride: mockInvoke
    });

    // Verify the prompt structure
    // The prompt is a JSON stringified object { instruction: "...", texts: [...] }
    const parsed = JSON.parse(capturedPrompt);
    expect(parsed.instruction).toContain('The file name is "Star_Trek_Test.srt"');
    expect(parsed.instruction).toContain('Use this to infer context');
    expect(parsed.instruction).toContain('Use canonical translations for show-specific catchphrases');
  });

  it('does not include filename context when omitted', async () => {
    const entries = parseSrt(sampleSrt);
    let capturedPrompt = '';
    
    const mockInvoke = async (_modelId: string, _region: string | undefined, prompt: string) => {
      capturedPrompt = prompt;
      return JSON.stringify({ translations: ['Hola mundo'] });
    };

    await translateEntries(entries, {
      modelId: 'mock',
      targetLanguage: 'es',
      batchSize: 1,
      // filename omitted
      invokeOverride: mockInvoke
    });

    const parsed = JSON.parse(capturedPrompt);
    expect(parsed.instruction).not.toContain('The file name is');
    expect(parsed.instruction).not.toContain('Use this to infer context');
  });
});
