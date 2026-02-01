# @ciberado/srtai-core

The core logical engine for [SRT-AI](https://github.com/ciberado/srtai), providing robust SRT parsing, serialization, and AWS Bedrock-backed translation capabilities.

This package is designed to be used by the `@ciberado/srtai` CLI or integrated into other Node.js applications that require subtitle translation services.

## Installation

```bash
npm install @ciberado/srtai-core
```

## Architecture

The library is split into two primary domains: **Parser** and **Translator**.

### 1. Parser Engine
The parser handles the distinct structure of SubRip (.srt) files.
- **Parsing**: Converts raw SRT text into structured `SrtEntry` objects, handling timestamp conversion (HH:MM:SS,mmm -> milliseconds).
- **Serialization**: Converts `SrtEntry` objects back to valid SRT format.
- **Tag Preservation**: The structure separates timing from content, preventing translation engines from hallucinating or damaging timestamps.

### 2. Translation Engine
The translator orchestrates interaction with AWS Bedrock.
- **Batching**: Subtitles are grouped into efficient batches to minimize API round-trips and optimize context window usage.
- **JSON Protocol**: It enforces a strict JSON output schema from the LLM, ensuring the number of translated lines exactly matches the input.
- **Context Injection**: Filenames and other metadata are injected into the system prompt to provide context (e.g., "Star Trek" implies specific terminology).
- **Retry Logic**: Built-in exponential backoff for handling AWS Bedrock throttling or transient failures.

## Usage Example

```typescript
import { parseSrt, serializeSrt, rebuildFromTranslations } from '@ciberado/srtai-core/parser';
import { translateEntries } from '@ciberado/srtai-core/translator';
import fs from 'fs';

async function main() {
  // 1. Load and Parse
  const rawSrt = fs.readFileSync('movie.en.srt', 'utf-8');
  const entries = parseSrt(rawSrt);

  // 2. Translate
  // Returns raw array of translated strings corresponding to entries
  const translatedTexts = await translateEntries(entries, {
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    targetLanguage: 'es', // Spanish
    region: 'us-east-1',
    concurrency: 5, // parallelize batches
    filename: 'movie.en.srt' // helps context
  });

  // 3. Reconstruct
  const translatedEntries = rebuildFromTranslations(entries, translatedTexts);
  
  // 4. Save
  const outputSrt = serializeSrt(translatedEntries);
  fs.writeFileSync('movie.es.srt', outputSrt);
}
```

## API Reference

### Parser
- `parseSrt(content: string): SrtEntry[]`
- `serializeSrt(entries: SrtEntry[]): string`
- `rebuildFromTranslations(original: SrtEntry[], translations: string[]): SrtEntry[]`

### Translator
- `translateEntries(entries: SrtEntry[], options: TranslateOptions): Promise<string[]>`

#### TranslateOptions
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `modelId` | string | (Required) | AWS Bedrock Model ID (e.g., Claude 3 Haiku) |
| `targetLanguage` | string | `'es'` | Target language code (ISO 639-1) |
| `region` | string | `undefined` | AWS Region (defaults to local config) |
| `concurrency` | number | `3` | Number of concurrent batch requests |
| `batchSize` | number | `30` | Number of subtitle blocks per API call |
| `retries` | number | `3` | Max retries per batch on failure |
