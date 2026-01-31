#!/usr/bin/env node
import { Command } from 'commander';
import { helloCore } from '@srtai/core';
import { runTranslate } from './runner';

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
  .requiredOption('-m, --model <modelId>', 'Bedrock model id')
  .option('-r, --region <region>', 'AWS region')
  .option('-b, --batch-size <n>', 'batch size', (v) => parseInt(v, 10), 30)
  .option('-c, --concurrency <n>', 'concurrency (not used yet)', (v) => parseInt(v, 10), 1)
  .option('--retries <n>', 'retries', (v) => parseInt(v, 10), 3)
  .option('-o, --output <path>', 'output directory')
  .option('--dry-run', 'dry run (no external calls)')
  .action(async (files: string[], opts: any) => {
    try {
      const res = await runTranslate({
        files,
        to: opts.to,
        model: opts.model,
        region: opts.region,
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
