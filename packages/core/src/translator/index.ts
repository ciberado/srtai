import { SrtEntry } from '../parser';

export type TranslateOptions = {
  modelId: string;
  region?: string;
  batchSize?: number;
  retries?: number;
  dryRun?: boolean; // if true, returns mocked translations
  targetLanguage?: string; // e.g. 'es'
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

        // Build a prompt joining entries with a separator that can be split later
        const prompt = JSON.stringify({
          target_language: target,
          texts: batch
        });

        const raw = await invokeBedrock(modelId, region, prompt);

        // Try to parse JSON response first, otherwise split by separator
        let parsed: string[] | null = null;
        try {
          const j = JSON.parse(raw);
          if (Array.isArray(j)) parsed = j.map(String);
          else if (j.translations && Array.isArray(j.translations)) parsed = j.translations.map(String);
        } catch (e) {
          // ignore parse error
        }

        if (!parsed) {
          // fallback: assume newline-separated
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
