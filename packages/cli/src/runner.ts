import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { MultiBar, Presets } from 'cli-progress';
import { parseSrt, serializeSrt, rebuildFromTranslations, translateEntries } from '@ciberado/srtai-core';
import { logger } from './logger';

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

function getOutputFilename(originalName: string, targetLang: string, isZip: boolean): string {
  const ext = isZip ? '.zip' : '.srt';
  // If it's a zip return .es.translated.zip, if srt return .es.srt
  const suffix = isZip ? '.translated.zip' : '.srt'; 
  
  // Regex to match language code at the end of filename (e.g. .en.srt or .en-US.zip)
  const langRegex = new RegExp(`\\.([a-z]{2,3}(?:-[a-z0-9]+)?)\\${ext}$`, 'i');

  if (langRegex.test(originalName)) {
    return originalName.replace(langRegex, `.${targetLang}${suffix}`);
  }
  // Fallback: just append/replace extension
  // For zip: file.zip -> file.es.translated.zip
  // For srt: file.srt -> file.es.srt
  return originalName.replace(new RegExp(`\\${ext}$`, 'i'), `.${targetLang}${suffix}`);
}

async function isZip(file: string) {
  const b = await fs.readFile(file);
  // PK header
  return b[0] === 0x50 && b[1] === 0x4b;
}

export async function runTranslate(args: TranslateArgs) {
  const multibar = new MultiBar({
    ...Presets.shades_classic,
    clearOnComplete: false,
    hideCursor: true,
    format: ' {bar} | {filename} | {value}/{total} | {percentage}%',
  });

  const outDir = args.output ? path.resolve(args.output) : path.resolve(process.cwd(), 'translated');
  await fs.mkdir(outDir, { recursive: true });

  const results: string[] = [];

  try {
    for (const file of args.files) {
    const abs = path.resolve(file);
    logger.info(`Processing file: ${file}`);
    const stat = await fs.stat(abs);
    if (stat.isFile() && await isZip(abs)) {
      // extract zip, process .srt inside, then build output zip
      const zip = new AdmZip(abs);
      const zipEntries = zip.getEntries();
      const zipOut = new AdmZip();
      
      const srtEntries = zipEntries.filter((ze: any) => ze.entryName.endsWith('.srt'));
      const otherEntries = zipEntries.filter((ze: any) => !ze.entryName.endsWith('.srt'));
      
      logger.debug(`Found ${srtEntries.length} SRT files and ${otherEntries.length} other files in zip`);

      // Process non-srt files
      for (const ze of otherEntries) {
        zipOut.addFile(ze.entryName, ze.getData());
      }
      
      const originalsFolder = 'originals/';
      const translatedFolder = 'translated/';

      // Helper to process a single entry
      const processEntry = async (ze: any) => {
        logger.info(`Translating zip entry: ${ze.entryName}`);
        const srtText = ze.getData().toString('utf8');
        const entries = parseSrt(srtText);
        logger.debug(`Parsed ${entries.length} segments from ${ze.entryName}`);
        
        const bar = multibar.create(entries.length, 0, { filename: ze.entryName });

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
          filename: path.basename(ze.entryName),
          onProgress: (p) => bar.update(p)
        });
        
        multibar.remove(bar);

        const rebuilt = rebuildFromTranslations(entries, translated);
        logger.debug(`Rebuilt SRT for ${ze.entryName}`);
        const outName = getOutputFilename(path.basename(ze.entryName), args.to, false);
        
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
      
      logger.info(`Starting parallel processing with concurrency ${maxConcurrency}`);

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

      const outZip = path.join(outDir, getOutputFilename(path.basename(abs), args.to, true));
      zipOut.writeZip(outZip);
      logger.info(`Finished processing zip: ${outZip}`);
      results.push(outZip);
    } else if (stat.isFile()) {
      logger.debug(`Reading file ${abs}`);
      const text = await fs.readFile(abs, 'utf8');
      const entries = parseSrt(text);
      logger.info(`Translating ${abs} (${entries.length} segments)`);
      
      const bar = multibar.create(entries.length, 0, { filename: path.basename(abs) });

      const translated = await translateEntries(entries, {
        modelId: args.model,
        region: args.region,
        batchSize: args.batchSize,
        retries: args.retries,
        dryRun: args.dryRun,
        targetLanguage: args.to,
        concurrency: args.concurrency,
        filename: path.basename(abs),
        onProgress: (p) => bar.update(p)
      });
      
      multibar.remove(bar);

      const rebuilt = rebuildFromTranslations(entries, translated);
      const outName = getOutputFilename(path.basename(abs), args.to, false);
      const outPath = path.join(outDir, outName);
      await fs.writeFile(outPath, serializeSrt(rebuilt), 'utf8');
      logger.info(`Finished file: ${outPath}`);
      results.push(outPath);
    }
  }
  } finally {
    multibar.stop();
  }

  return results;
}
