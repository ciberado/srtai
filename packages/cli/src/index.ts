#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { helloCore } from '@srtai/core';
import { runTranslate } from './runner';
import { configureLogger, logger } from './logger';

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
  .option('-v, --verbose', 'enable verbose logging')
  .addHelpText('after', `

Examples:
  $ srtai translate movie.srt -t es
  $ srtai translate movie.srt -t fr --model anthropic.claude-v2
  $ srtai translate season1/*.srt -t de --output translated/
  $ srtai translate subtitles.zip -t pt-BR
`)
  .action(async (files: string[], opts: any, command: Command) => {
    configureLogger({ verbose: opts.verbose });
    let validationError = false;

    // Validate numeric options
    if (Number.isNaN(opts.batchSize)) {
      logger.error('Option --batch-size must be a number');
      validationError = true;
    }
    if (Number.isNaN(opts.retries)) {
      logger.error('Option --retries must be a number');
      validationError = true;
    }
    if (Number.isNaN(opts.concurrency)) {
      logger.error('Option --concurrency must be a number');
      validationError = true;
    }

    // Validate Model ID (env or flag)
    const modelId = opts.model || process.env.BEDROCK_MODEL_ID;
    if (!modelId) {
      logger.error('Model ID is required. Pass --model or set BEDROCK_MODEL_ID env var.');
      validationError = true;
    }

    // Validate files existence
    for (const file of files) {
      if (!fs.existsSync(file)) {
        logger.error(`Input file not found: ${file}`);
        validationError = true;
      }
    }

    if (validationError) {
      console.log(''); // spacer
      command.outputHelp();
      process.exit(1);
    }

    try {
      const region = opts.region || process.env.AWS_REGION;

      logger.info(`Starting translation task for ${files.length} file(s)`);
      if (opts.verbose) {
         logger.debug(`Options: ${JSON.stringify(opts)}`);
      }

      const res = await runTranslate({
        files,
        to: opts.to,
        model: modelId,
        region: region,
        batchSize: opts.batchSize,
        retries: opts.retries,
        output: opts.output,
        concurrency: opts.concurrency,
        dryRun: opts.dryRun
      });
      for (const r of res) logger.info(`Wrote ${r}`);
    } catch (err: any) {
      logger.error(`Error: ${err?.message || err}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
