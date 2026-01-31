import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { parseSrt, serializeSrt, rebuildFromTranslations } from '../../core/src/parser';
import { translateEntries } from '../../core/src/translator';

export type TranslateArgs = {
  files: string[];
  to: string;
  model: string;
  region?: string;
  batchSize?: number;
  retries?: number;
  output?: string; // path to output dir or zip
  dryRun?: boolean;
};

async function isZip(file: string) {
  const b = await fs.readFile(file);
  // PK header
  return b[0] === 0x50 && b[1] === 0x4b;
}

export async function runTranslate(args: TranslateArgs) {
  const outDir = args.output ? path.resolve(args.output) : path.resolve(process.cwd(), 'translated');
  await fs.mkdir(outDir, { recursive: true });

  const results: string[] = [];

  for (const file of args.files) {
    const abs = path.resolve(file);
    const stat = await fs.stat(abs);
    if (stat.isFile() && await isZip(abs)) {
      // extract zip, process .srt inside, then build output zip
      const zip = new AdmZip(abs);
      const zipEntries = zip.getEntries();
      const zipOut = new AdmZip();
      const originalsFolder = 'originals/';
      const translatedFolder = 'translated/';
      for (const ze of zipEntries) {
        if (ze.entryName.endsWith('.srt')) {
          const srtText = ze.getData().toString('utf8');
          const entries = parseSrt(srtText);
          const translated = await translateEntries(entries, {
            modelId: args.model,
            region: args.region,
            batchSize: args.batchSize,
            retries: args.retries,
            dryRun: args.dryRun,
            targetLanguage: args.to
          });
          const rebuilt = rebuildFromTranslations(entries, translated);
          const outName = path.basename(ze.entryName).replace(/\.srt$/, `.${args.to}.srt`);
          zipOut.addFile(originalsFolder + ze.entryName, Buffer.from(srtText, 'utf8'));
          zipOut.addFile(translatedFolder + outName, Buffer.from(serializeSrt(rebuilt), 'utf8'));
        } else {
          zipOut.addFile(ze.entryName, ze.getData());
        }
      }
      const outZip = path.join(outDir, path.basename(abs).replace(/\.zip$/, `.translated.zip`));
      zipOut.writeZip(outZip);
      results.push(outZip);
    } else if (stat.isFile()) {
      const text = await fs.readFile(abs, 'utf8');
      const entries = parseSrt(text);
      const translated = await translateEntries(entries, {
        modelId: args.model,
        region: args.region,
        batchSize: args.batchSize,
        retries: args.retries,
        dryRun: args.dryRun,
        targetLanguage: args.to
      });
      const rebuilt = rebuildFromTranslations(entries, translated);
      const outName = path.basename(abs).replace(/\.srt$/, `.${args.to}.srt`);
      const outPath = path.join(outDir, outName);
      await fs.writeFile(outPath, serializeSrt(rebuilt), 'utf8');
      results.push(outPath);
    }
  }

  return results;
}
