#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { helloCore } from '@srtai/core';
import { runTranslate } from './runner';

// Try to load .env from current directory or up the tree
try {
   // verify if the function exists (node >= 20.x)
   if (typeof process.loadEnvFile === 'function') {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        process.loadEnvFile(envPath);
      } else {
        // try one level up (useful mostly in monorepos)
        const upPath = path.resolve(process.cwd(), '../../.env');
        if (fs.existsSync(upPath)) process.loadEnvFile(upPath);
      }
   }
} catch (e) {
  // ignore errors
}

const program = new Command();

program
  .name('srtai')
  .description('SRT-AI command-line tool')
  .version('0.1.0');

program
  .command('hello')
  .description('Smoke command to verify CLI')
  .action(() => {
    console.log('srtai hello —', helloCore());
  });

program
  .command('translate <files...>')
  .description('Translate SRT files or a zip archive')
  .requiredOption('-t, --to <language>', 'target language code')
  .option('-m, --model <modelId>', 'Bedrock model id, defaults to BEDROCK_MODEL_ID env var')
  .option('-r, --region <region>', 'AWS region, defaults to AWS_REGION env var')
  .option('-b, --batch-size <n>', 'batch size', (v) => parseInt(v, 10), 30)
  .option('-c, --concurrency <n>', 'concurrency (not used yet)', (v) => parseInt(v, 10), 1)
  .option('--retries <n>', 'retries', (v) => parseInt(v, 10), 3)
  .option('-o, --output <path>', 'output directory')
  .option('--dry-run', 'dry run (no external calls)')
  .action(async (files: string[], opts: any) => {
    try {
      const modelId = opts.model || process.env.BEDROCK_MODEL_ID;
      const region = opts.region || process.env.AWS_REGION;

      if (!modelId) {
         throw new Error('Model ID is required (pass --model or set BEDROCK_MODEL_ID)');
      }

      const res = await runTranslate({
        files,
        to: opts.to,
        model: modelId,
        region: region,
        batchSize: opts.batchSize,
        retries: opts.retries,
        output: opts.output,
        dryRun: opts.dryRun
      });
      for (const r of res) console.log('Wrote', r);
    } catch (err: any) {
      console.error('Error:', err?.message || err);
      process.exit(1);
    }
  });

program.parse(process.argv);
