# SRT-AI: Subtitle Translation Application

A command-line application for translating subtitle files using AWS Bedrock with Claude.

---

## Overview

Build a modern TypeScript CLI application that takes subtitle files (individual or in a zip package) and translates them to a user-specified language using AWS Bedrock with Claude for inference.

---

## Project Structure

### Monorepo Architecture (npm workspaces)

```
srtai/
├── package.json              # Root workspace config
├── packages/
│   ├── core/                 # @srtai/core - Translation logic library
│   │   ├── src/
│   │   │   ├── parser/       # SRT parsing/serialization
│   │   │   ├── translator/   # Bedrock integration & batching
│   │   │   ├── processor/    # File/zip handling
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── cli/                  # @srtai/cli - Command-line interface
│       ├── src/
│       │   ├── commands/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── tsconfig.base.json
└── .env.example
```

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript (ES2022+, strict mode) |
| Runtime | Node.js 20+ |
| Package Manager | npm with workspaces |
| SRT Parsing | `subtitle` or `srt-parser-2` |
| CLI Framework | `commander` (most popular) |
| AWS SDK | `@aws-sdk/client-bedrock-runtime` |
| Zip Handling | `adm-zip` or `jszip` |
| Progress UI | `ora` (spinner) + `cli-progress` |
| Environment | `dotenv` |
| Testing | `vitest` with real AWS calls |

---

## Configuration

### Environment Variables (.env)

```env
# AWS Credentials (required)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# AWS Configuration
AWS_REGION=us-east-1              # Default: us-east-1, configurable

# Bedrock Model (required - no default)
BEDROCK_MODEL_ID=                 # e.g., anthropic.claude-3-5-sonnet-20241022-v2:0
```

### CLI Flags Override

All environment variables can be overridden via CLI flags.

---

## CLI Interface

### Basic Usage

```bash
# Translate single file
srtai translate movie.srt --to es

# Translate multiple files
srtai translate movie1.srt movie2.srt --to es

# Translate from zip
srtai translate subtitles.zip --to es --output translated.zip

# With all options
srtai translate movie.srt \
  --to es \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --region us-east-1 \
  --batch-size 30 \
  --concurrency 3 \
  --retries 3 \
  --verbose
```

### Commands & Options

```
srtai translate <files...>

Arguments:
  files                    SRT files or zip archives to translate

Required Options:
  -t, --to <language>      Target language code (e.g., es, fr, de)
  -m, --model <model-id>   Bedrock model ID (or set BEDROCK_MODEL_ID env var)

Optional:
  -o, --output <path>      Output path (file or directory)
  -r, --region <region>    AWS region (default: us-east-1)
  -b, --batch-size <n>     Entries per translation batch (default: 30)
  -c, --concurrency <n>    Parallel batches/files (default: 3)
  --retries <n>            Retry attempts on failure (default: 3)
  -v, --verbose            Enable detailed logging
  -h, --help               Show help
```

---

## Core Logic

### Translation Pipeline

```
1. INPUT
   └── Individual .srt files OR .zip archive

2. PARSE
   └── Load SRT → Parse entries (id, timestamps, text with formatting)

3. BATCH
   └── Group entries into batches of N (default: 30)

4. TRANSLATE (per batch)
   ├── Extract text content (preserve format tags like <font>)
   ├── Send to Bedrock Claude
   ├── Receive translated text
   └── Rebuild entries with translated content + original timestamps

5. REASSEMBLE
   └── Combine all translated entries → Serialize to SRT format

6. OUTPUT
   ├── Individual files: movie.srt → movie.es.srt
   └── Zip input: output.zip containing originals + translations
```

### Format Tag Handling

Preserve inline formatting during translation:

```
Original:  <font color="#fff">Hello</font> world
Extract:   "Hello world" (with tag positions noted)
Translate: "Hola mundo"
Rebuild:   <font color="#fff">Hola</font> mundo
```

### Parallel Processing

- **File-level**: Process multiple files concurrently
- **Batch-level**: Process multiple batches per file concurrently
- Configurable concurrency limit (default: 3)

---

## Output Specification

### File Naming Convention

```
input.srt → input.{lang}.srt

Examples:
  movie.srt      → movie.es.srt
  episode_01.srt → episode_01.fr.srt
```

### Zip Output

When input is a zip or `--output` specifies a zip:

```
output.zip
├── originals/
│   ├── movie1.srt
│   └── movie2.srt
└── translated/
    ├── movie1.es.srt
    └── movie2.es.srt
```

---

## Error Handling

### Strategy: Retry → Continue → Report

1. **Retry**: On batch/file failure, retry up to N times (default: 3)
2. **Continue**: If retries exhausted, skip and continue with remaining
3. **Report**: At completion, display summary of failures

### Error Report Format

```
Translation completed with errors:

✓ 8/10 files translated successfully
✗ 2 files failed:
  - movie3.srt: API rate limit exceeded (after 3 retries)
  - movie7.srt: Invalid SRT format at line 42

Output written to: ./translated/
```

---

## Progress Indicators

### Single File Mode

```
Translating movie.srt to Spanish...
⠋ Processing batch 3/12 [████████░░░░░░░░] 25%
```

### Multi-File Mode

```
Translating 5 files to Spanish...
✓ movie1.srt (1.2s)
⠋ movie2.srt - batch 3/8
◌ movie3.srt (queued)
◌ movie4.srt (queued)
◌ movie5.srt (queued)
```

---

## Testing Strategy

### Test Types (using Vitest)

All tests use **real AWS Bedrock calls** (integration tests).

### Test Cases

```typescript
// Parser Tests
- Parse valid SRT with timestamps
- Parse SRT with format tags (<font>, <b>, <i>)
- Preserve timestamp precision
- Handle edge cases (empty lines, special characters)

// Translator Tests
- Translate simple text batch
- Preserve format tags after translation
- Handle batch with mixed formatted/plain entries

// Processor Tests
- Process single SRT file
- Process multiple SRT files
- Process zip archive
- Generate correct output filenames (movie.es.srt)
- Create zip with originals and translations

// Integration Tests
- End-to-end: file in → translated file out
- Verify timestamps unchanged after translation
- Verify format tags preserved
```

### Test Environment

```env
# .env.test
AWS_ACCESS_KEY_ID=<test-credentials>
AWS_SECRET_ACCESS_KEY=<test-credentials>
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0  # Use Haiku for faster/cheaper tests
```

---

## Package Dependencies

### @srtai/core

```json
{
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.x",
    "subtitle": "^4.x",
    "jszip": "^3.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^2.x",
    "@types/node": "^20.x"
  }
}
```

### @srtai/cli

```json
{
  "dependencies": {
    "@srtai/core": "workspace:*",
    "commander": "^12.x",
    "ora": "^8.x",
    "cli-progress": "^3.x",
    "chalk": "^5.x"
  }
}
```

---

## Future Considerations (Out of Scope)

- Web interface (planned for future package)
- Resume capability for interrupted jobs
- Multiple target languages in single run
- Caching/preservation of existing translations
- Support for other subtitle formats (VTT, ASS)
