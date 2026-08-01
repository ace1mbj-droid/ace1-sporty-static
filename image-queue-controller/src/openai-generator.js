import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class OpenAIImageGenerator {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = options.model ?? process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1.5';
    this.size = options.size ?? process.env.OPENAI_IMAGE_SIZE ?? '1024x1024';
    this.quality = options.quality ?? process.env.OPENAI_IMAGE_QUALITY ?? 'high';
    this.outputDirectory = options.outputDirectory ?? path.resolve('outputs');
    this.fetch = options.fetchImpl ?? globalThis.fetch;
  }

  async generate(item) {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not configured.');

    const response = await this.fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        prompt: item.prompt,
        size: this.size,
        quality: this.quality,
        output_format: 'png'
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `Image API failed with HTTP ${response.status}.`);
    }

    const encoded = payload?.data?.[0]?.b64_json;
    if (!encoded) throw new Error('Image API returned no image data.');

    await mkdir(this.outputDirectory, { recursive: true });
    const safeName = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const outputPath = path.join(this.outputDirectory, `${safeName}.png`);
    await writeFile(outputPath, Buffer.from(encoded, 'base64'));
    return { outputPath, metadata: payload.usage ?? null };
  }
}
