import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { runTranslate } from '../src/runner';

describe('CLI translate e2e (dryRun)', () => {
  it('translates a single SRT file and writes output with language suffix', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'srtai-'));
    const srt = `1\n00:00:01,000 --> 00:00:02,000\nHello\n\n`;
    const inPath = path.join(tmp, 'test.srt');
    await fs.writeFile(inPath, srt, 'utf8');
    const out = await runTranslate({
      files: [inPath],
      to: 'es',
      model: 'dummy',
      dryRun: true,
      output: tmp
    });
    expect(out.length).toBe(1);
    const outPath = out[0];
    const exists = await fs.readFile(outPath, 'utf8');
    expect(exists).toContain('[es]');
  });
});
