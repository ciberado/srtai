import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { runTranslate } from '../src/runner';

describe('CLI translate zip e2e (dryRun)', () => {
  it('processes zip input and writes output zip containing originals and translated entries', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'srtai-zip-'));
    const srt1 = `1\n00:00:01,000 --> 00:00:02,000\nHello1\n\n`;
    const srt2 = `1\n00:00:03,000 --> 00:00:04,000\nHello2\n\n`;
    const zip = new AdmZip();
    zip.addFile('movie1.srt', Buffer.from(srt1, 'utf8'));
    zip.addFile('movie2.srt', Buffer.from(srt2, 'utf8'));
    const inZipPath = path.join(tmp, 'input.zip');
    zip.writeZip(inZipPath);

    const outs = await runTranslate({
      files: [inZipPath],
      to: 'es',
      model: 'dummy',
      dryRun: true,
      output: tmp
    });
    expect(outs.length).toBe(1);
    const outZipPath = outs[0];
    const outZip = new AdmZip(outZipPath);
    const entries = outZip.getEntries().map((e) => e.entryName);
    // Expect originals/ and translated/ entries
    const hasOriginals = entries.some((n) => n.startsWith('originals/'));
    const hasTranslated = entries.some((n) => n.startsWith('translated/'));
    expect(hasOriginals).toBeTruthy();
    expect(hasTranslated).toBeTruthy();
    // Ensure translated files include language suffix
    const translatedFiles = entries.filter((n) => n.startsWith('translated/'));
    expect(translatedFiles.length).toBeGreaterThanOrEqual(1);
    expect(translatedFiles.some((n) => n.endsWith('.es.srt'))).toBeTruthy();
  });

  it('handles concurrency option correctly for multiple files in zip', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'srtai-zip-parallel-'));
    const zip = new AdmZip();
    // Add multiple files
    for (let i = 0; i < 5; i++) {
        zip.addFile(`file${i}.srt`, Buffer.from(`1\n00:00:00,000 --> 00:00:02,000\nLine ${i}`, 'utf8'));
    }
    const inZipPath = path.join(tmp, 'parallel.zip');
    zip.writeZip(inZipPath);

    const outs = await runTranslate({
      files: [inZipPath],
      to: 'es',
      model: 'dummy',
      dryRun: true,
      concurrency: 3, 
      output: tmp
    });

    const outZipPath = outs[0];
    const outZip = new AdmZip(outZipPath);
    const entries = outZip.getEntries();
    // verify all 5 are translated
    const translated = entries.filter(e => e.entryName.startsWith('translated/') && e.entryName.endsWith('.es.srt'));
    expect(translated.length).toBe(5);
  });
});
