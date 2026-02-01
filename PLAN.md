# SRT-AI Implementation Plan

Short actionable plan for implementing the `srtai` subtitle translation CLI.

## Goals
- Deliver a monorepo (npm workspaces) with two packages: `@srtai/core` and `@srtai/cli`.
- Use AWS Bedrock (Claude) for translation, configurable via env or CLI.
- Preserve SRT timestamps and inline formatting tags.
- Produce per-file localized outputs (`movie.es.srt`) and zip output containing originals + translations.

## Status
- [x] 1. Initialize npm workspace monorepo
- [x] 2. Scaffold `@srtai/core`
- [x] 3. Scaffold `@srtai/cli`
- [x] 4. Implement Bedrock integration and batching
- [x] 5. File and zip processing
- [x] 6. Testing and CI
- [x] 7. Documentation and README


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
