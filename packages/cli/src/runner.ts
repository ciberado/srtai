import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { parseSrt, serializeSrt, rebuildFromTranslations, translateEntries } from '@srtai/core';

export type TranslateArgs = {
  files: string[];
  to: string;
  model: string;
  region?: string;
  batchSize?: number;
  retries?: number;
  output?: string; // path to output dir or zip
  concurrency?: number;
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
      
      const srtEntries = zipEntries.filter((ze: any) => ze.entryName.endsWith('.srt'));
      const otherEntries = zipEntries.filter((ze: any) => !ze.entryName.endsWith('.srt'));
      
      // Process non-srt files
      for (const ze of otherEntries) {
        zipOut.addFile(ze.entryName, ze.getData());
      }
      
      // Helper to process a single entry
      const processEntry = async (ze: any) => {
        const srtText = ze.getData().toString('utf8');
        const entries = parseSrt(srtText);
        // When processing multiple files in parallel within a zip, we limit the per-file concurrency
        // to avoid exploding the total number of concurrent requests. 
        // We use 1 here so `args.concurrency` controls the number of FILES processed purely.
        const translated = await translateEntries(entries, {
          modelId: args.model,
          region: args.region,
          batchSize: args.batchSize,
          retries: args.retries,
          dryRun: args.dryRun,
          targetLanguage: args.to,
          concurrency: 1, 
          filename: path.basename(ze.entryName)
        });
        const rebuilt = rebuildFromTranslations(entries, translated);
        const outName = path.basename(ze.entryName).replace(/\.srt$/, `.${args.to}.srt`);
        
        // Return result to add to zip later (AdmZip is synchronous, but we can buffer)
        return {
          originalEntryName: ze.entryName,
          originalData: Buffer.from(srtText, 'utf8'),
          translatedEntryName: outName,
          translatedData: Buffer.from(serializeSrt(rebuilt), 'utf8')
        };
      };

      // Parallel processing queue
      const queue = srtEntries.map((ze: any, index: number) => ({ ze, index }));
      // Use args.concurrency or default to 1 (sequential)
      const maxConcurrency = args.concurrency || 1;
      
      const resultsArray = new Array<any>(srtEntries.length);
      
      const worker = async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
             const { ze, index } = item;
             resultsArray[index] = await processEntry(ze);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(maxConcurrency, srtEntries.length) }, () => worker())
      );

      // Add processed files to zip
      for (const res of resultsArray) {
        if (res) {
          zipOut.addFile(originalsFolder + res.originalEntryName, res.originalData);
          zipOut.addFile(translatedFolder + res.translatedEntryName, res.translatedData);
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
        targetLanguage: args.to,
        concurrency: args.concurrency,
        filename: path.basename(abs)
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
