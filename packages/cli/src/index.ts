#!/usr/bin/env node
import { Command } from 'commander';
import { helloCore } from '@srtai/core';

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

program.parse(process.argv);
