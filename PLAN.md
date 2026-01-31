# SRT-AI Implementation Plan

Short actionable plan for implementing the `srtai` subtitle translation CLI.

## Goals
- Deliver a monorepo (npm workspaces) with two packages: `@srtai/core` and `@srtai/cli`.
- Use AWS Bedrock (Claude) for translation, configurable via env or CLI.
- Preserve SRT timestamps and inline formatting tags.
- Produce per-file localized outputs (`movie.es.srt`) and zip output containing originals + translations.

## Milestones (high level)
1. Initialize npm workspace monorepo
   - Create root `package.json` with `workspaces` configured
   - Add `tsconfig.base.json` and `.env.example`
   - Acceptance: `npm install` runs, workspaces resolve

2. Scaffold `@srtai/core`
   - Directories: `src/parser`, `src/translator`, `src/processor`
   - Implement minimal SRT parse/serialize wrapper using `subtitle` (or chosen lib)
   - Implement format-tag extractor/rebuilder helpers
   - Acceptance: unit tests parse/serialize sample SRT preserving timestamps and tags

3. Scaffold `@srtai/cli`
   - Use `commander` for `translate` command
   - Wire CLI flags to core library calls (`--to`, `--model`, `--region`, `--output`, etc.)
   - Acceptance: `node ./packages/cli/dist/index.js translate --help` shows options

4. Implement Bedrock integration and batching
   - Implement a `translateBatch` function that calls Bedrock runtime via `@aws-sdk/client-bedrock-runtime`
   - Add batching (default 30 entries) and retry logic (default 3 retries)
   - Acceptance: mock/integration test translates a small batch end-to-end

5. File and zip processing
   - Support input as individual `.srt` files or `.zip` archive
   - Output localized files named `name.{lang}.srt` and zip bundle (originals + translations)
   - Acceptance: pipeline converts a zip into expected output structure

6. Testing and CI
   - Add `vitest` tests (integration tests use real Bedrock credentials via `.env.test`)
   - Add npm scripts: `test`, `build`, `lint` (optional)
   - Acceptance: `npm test` runs integration tests when env provided

7. Documentation and README
   - Document usage examples, env variables, and model/region requirements in `README.md`

## Non-functional
- Concurrency configurable for files and batches (default 3).  
- Progress shown via `ora`/`cli-progress`.  
- Conventional commits used for all commits.

## Acceptance criteria (release-ready minimal)
- CLI translates a single `.srt` to a target language and writes `file.{lang}.srt`.
- CLI accepts `--model` and `--region`; `--model` is required.
- Timestamps remain unchanged; inline tags preserved in translated text.
- Zip input -> zip output with correct folder layout.

## Next actions I can do now
1. Initialize root `package.json` and workspaces and scaffold packages.  
2. Implement minimal parser/serializer and a smoke CLI command.  

If you want, I can start with step 1 (init workspace + scaffold). Reply `start` to proceed.
