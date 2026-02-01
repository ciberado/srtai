import { SrtEntry } from '../parser';

export type TranslateOptions = {
  modelId: string;
  region?: string;
  batchSize?: number;
  retries?: number;
  dryRun?: boolean; // if true, returns mocked translations
  targetLanguage?: string; // e.g. 'es'
  filename?: string;
  concurrency?: number;
  invokeOverride?: (modelId: string, region: string | undefined, prompt: string) => Promise<string>;
};

async function invokeBedrock(modelId: string, region: string | undefined, prompt: string) {
  let BedrockRuntimeClient: any;
  let ConverseCommand: any;
  try {
    const mod = await import('@aws-sdk/client-bedrock-runtime');
    BedrockRuntimeClient = mod.BedrockRuntimeClient;
    ConverseCommand = mod.ConverseCommand;
  } catch (e) {
    throw new Error('Missing dependency @aws-sdk/client-bedrock-runtime. Install it to use Bedrock integration.');
  }

  const client = new BedrockRuntimeClient({ region });

  const cmd = new ConverseCommand({
    modelId,
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }]
      }
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0
    }
  });

  try {
    const res = await client.send(cmd);
    
    // The Converse API response structure is standardized:
    // output -> message -> content -> [ { text: "..." } ]
    if (res.output && res.output.message && res.output.message.content && res.output.message.content.length > 0) {
      return res.output.message.content[0].text || '';
    }
    
    return '';
  } catch (err: any) {
    // Better error handling for Bedrock specific errors
    throw new Error(`Bedrock Converse API error: ${err.message}`);
  }
}

export async function translateEntries(entries: SrtEntry[], opts: TranslateOptions): Promise<string[]> {
  const batchSize = opts.batchSize ?? 30;
  const retries = opts.retries ?? 3;
  const modelId = opts.modelId;
  const region = opts.region;
  const dryRun = !!opts.dryRun;
  const concurrency = opts.concurrency || 3;
  const target = opts.targetLanguage || 'es';

  const texts = entries.map((e) => e.text);
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) batches.push(texts.slice(i, i + batchSize));

  // Helper to process a single batch
  const processBatch = async (batch: string[]): Promise<string[]> => {
    let attempt = 0;
    while (attempt <= retries) {
      try {
        if (dryRun) {
          // simple mock: prefix with language code
          return batch.map((t) => `[${target}] ${t}`);
        }

        // Build a clear prompt with explicit instructions requesting ONLY valid JSON
        // The model must respond with a JSON object: { "translations": ["...", "..."] }
        // Each element must correspond one-to-one to the input `texts` and preserve inline tags (e.g. <font>...) unchanged,
        // only translating inner text. No additional commentary or metadata must be included outside the JSON.
        let extraContext = '';
        if (opts.filename) {
          extraContext = `The file name is "${opts.filename}". Use this to infer context (show/movie title, characters, specific terminology) to improve translation quality.\n` +
          `Use canonical translations for show-specific catchphrases and terms (e.g. for Star Trek, translate "Captain's Log" as "Diario del capitán" or "Bitácora", not "Registro").\n`;
        }
        
        const instruction = `Translate the following subtitle entries to ${target}.\n${extraContext}` +
          `Return ONLY a single valid JSON object with exactly one key named \"translations\" whose value is an array of strings.\n` +
          `Each translation must preserve any inline HTML-like tags (for example <font color=\"#fff\">...</font>) in-place; translate only the textual content inside tags.\n` +
          `Do not include any extra text, markdown, or explanation. Example output:\n` +
          `{\n  \"translations\": [\"translated text 1\", \"translated text 2\"]\n}`;

        const promptPayload = {
          instruction,
          texts: batch
        };
        const prompt = JSON.stringify(promptPayload);

        const raw = opts.invokeOverride
          ? await opts.invokeOverride(modelId, region, prompt)
          : await invokeBedrock(modelId, region, prompt);

        // DEBUG: dump raw value during tests
        // eslint-disable-next-line no-console
        console.log('RAW_RAW_TYPE', typeof raw, 'RAW_RAW_VALUE', JSON.stringify(raw));

        // Robust JSON extraction: model may emit extra chars; try to find first JSON value (object or array) in the response
        function extractJson(text: string): any | null {
          const str = String(text).trim();
          // Fast path: try to parse entire string first
          try {
            const v = JSON.parse(str);
            if (typeof v === 'string') {
              const s2 = v.trim();
              if (s2.startsWith('{') || s2.startsWith('[')) {
                try {
                  return JSON.parse(s2);
                } catch (e) {
                  // fallthrough
                }
              }
            }
            return v;
          } catch (e) {
            // continue to scanning
          }
          const firstObj = str.search(/[\[{]/);
          if (firstObj === -1) return null;
          const open = str[firstObj];
          const closeChar = open === '{' ? '}' : ']';
          let depth = 0;
          for (let i = firstObj; i < str.length; i++) {
            const ch = str[i];
            if (ch === open) depth++;
            else if (ch === closeChar) depth--;
            if (depth === 0) {
              const candidate = str.slice(firstObj, i + 1);
              try {
                return JSON.parse(candidate);
              } catch (e) {
                return null;
              }
            }
          }
          return null;
        }

        let parsed: string[] | null = null;
        const maybe = extractJson(raw);
        if (process.env.DEBUG_SRTAI === '1') {
          // eslint-disable-next-line no-console
          console.error('translateEntries debug - raw:', raw);
          // eslint-disable-next-line no-console
          console.error('translateEntries debug - maybe:', maybe);
        }
        // Surface Bedrock error-envelope early
        if (maybe && typeof maybe === 'object' && (maybe as any).Output && (maybe as any).Output.__type) {
          throw new Error(`Bedrock service error: ${JSON.stringify(maybe)}`);
        }
        if (maybe) {
          if (Array.isArray(maybe)) parsed = maybe.map(String);
          else if ((maybe as any).translations && Array.isArray((maybe as any).translations)) parsed = (maybe as any).translations.map(String);
        }

          // Extra attempt: try parsing the whole raw string as JSON (handles cases where extractJson missed it)
          if (!parsed) {
            try {
              let v: any = JSON.parse(String(raw));
              if (typeof v === 'string') {
                try {
                  v = JSON.parse(v);
                } catch (_) {
                  // ignore
                }
              }
              if (Array.isArray(v)) parsed = v.map(String);
              else if (v && v.translations && Array.isArray(v.translations)) parsed = v.translations.map(String);
            } catch (_e) {
              // ignore
            }
          }

        if (!parsed) {
          // fallback: assume newline-separated (last resort)
          parsed = String(raw).split('\n').filter(Boolean);
        }

        // If parsed length differs, attempt to map one-to-one heuristically
        if (parsed.length < batch.length) {
          // pad or duplicate
          while (parsed.length < batch.length) parsed.push(parsed[parsed.length - 1] || '');
        }

        return parsed.slice(0, batch.length);
      } catch (err: any) {
        attempt += 1;
        if (attempt > retries) {
          // eslint-disable-next-line no-console
          console.error('Batch translation failed:', err);
          break;
        }
        // exponential backoff
        // 500ms, 1000ms, 2000ms, 4000ms...
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    // Return placeholders if failed
    return batch.map(() => '');
  };

  // Run batches with limited concurrency
  const queue = batches.map((batch, index) => ({ batch, index }));
  const resultsArray = new Array<string[]>(batches.length);

  const worker = async () => {
    while (queue.length > 0) {
      const { batch, index } = queue.shift()!;
      resultsArray[index] = await processBatch(batch);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, batches.length) }, () => worker())
  );

  return resultsArray.flat();
}
