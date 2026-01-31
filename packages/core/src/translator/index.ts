import { SrtEntry } from '../parser';

export type TranslateOptions = {
  modelId: string;
  region?: string;
  batchSize?: number;
  retries?: number;
  dryRun?: boolean; // if true, returns mocked translations
  targetLanguage?: string; // e.g. 'es'
  invokeOverride?: (modelId: string, region: string | undefined, prompt: string) => Promise<string>;
};

async function invokeBedrock(modelId: string, region: string | undefined, prompt: string) {
  let BedrockRuntimeClient: any;
  let InvokeModelCommand: any;
  try {
    const mod = await import('@aws-sdk/client-bedrock-runtime');
    BedrockRuntimeClient = mod.BedrockRuntimeClient;
    InvokeModelCommand = mod.InvokeModelCommand;
  } catch (e) {
    throw new Error('Missing dependency @aws-sdk/client-bedrock-runtime. Install it to use Bedrock integration.');
  }

  const client = new BedrockRuntimeClient({ region });
  const cmd = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(JSON.stringify({ input: prompt }))
  });
  const res = await client.send(cmd);
  // Response body may be a stream/Uint8Array depending on runtime — coerce to string
  const body = res.body as any;
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (typeof body.transform === 'function') {
    // support stream-like body
    const chunks: Uint8Array[] = [];
    for await (const chunk of body) chunks.push(chunk);
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  // fallback: try toString
  return String(body);
}

export async function translateEntries(entries: SrtEntry[], opts: TranslateOptions): Promise<string[]> {
  const batchSize = opts.batchSize ?? 30;
  const retries = opts.retries ?? 3;
  const modelId = opts.modelId;
  const region = opts.region;
  const dryRun = !!opts.dryRun;
  const target = opts.targetLanguage || 'es';

  const texts = entries.map((e) => e.text);
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) batches.push(texts.slice(i, i + batchSize));

  const results: string[] = [];

  for (const batch of batches) {
    let attempt = 0;
    let success = false;
    let lastErr: Error | null = null;
    while (attempt <= retries && !success) {
      try {
        if (dryRun) {
          // simple mock: prefix with language code
          const translated = batch.map((t) => `[${target}] ${t}`);
          results.push(...translated);
          success = true;
          break;
        }

        // Build a clear prompt with explicit instructions requesting ONLY valid JSON
        // The model must respond with a JSON object: { "translations": ["...", "..."] }
        // Each element must correspond one-to-one to the input `texts` and preserve inline tags (e.g. <font>...) unchanged,
        // only translating inner text. No additional commentary or metadata must be included outside the JSON.
        const instruction = `Translate the following subtitle entries to ${target}.\n` +
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

        // Robust JSON extraction: model may emit extra chars; try to find first JSON object in the response
        function extractJson(text: string): any | null {
          const firstBrace = text.indexOf('{');
          if (firstBrace === -1) return null;
          // Try to find a balanced JSON object by scanning
          let depth = 0;
          for (let i = firstBrace; i < text.length; i++) {
            const ch = text[i];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            if (depth === 0) {
              const candidate = text.slice(firstBrace, i + 1);
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
        if (maybe) {
          if (Array.isArray(maybe)) parsed = maybe.map(String);
          else if (maybe.translations && Array.isArray(maybe.translations)) parsed = maybe.translations.map(String);
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

        results.push(...parsed.slice(0, batch.length));
        success = true;
      } catch (err: any) {
        lastErr = err;
        attempt += 1;
        if (attempt > retries) break;
        // exponential backoff
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    if (!success) {
      // push empty translations for failed batch and continue
      for (let i = 0; i < batch.length; i++) results.push('');
      // optionally log lastErr
    }
  }

  return results;
}
