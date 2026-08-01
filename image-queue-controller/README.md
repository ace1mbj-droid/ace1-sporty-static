# Continuous Image Queue Controller

This standalone Node.js service owns the image-generation loop. One click starts the queue; after each API response it automatically selects and generates the next pending image until the queue is empty.

## What it does

- Persists queue state in `data/queue.json`
- Automatically continues after each completed image
- Retries temporary failures up to `maxRetries`
- Recovers items left in `generating` after a restart
- Saves PNG outputs under `outputs/`
- Shows live completed, pending, retry, and failed status
- Supports pause and resume without losing progress

## Run

Requires Node.js 20+ and an OpenAI API key with image-generation access.

```bash
cd image-queue-controller
export OPENAI_API_KEY="your-key"
npm start
```

Open `http://localhost:4173` and press **Start / Continue** once. The service keeps generating until no runnable item remains.

Optional settings:

```bash
export OPENAI_IMAGE_MODEL="gpt-image-1.5"
export OPENAI_IMAGE_SIZE="1024x1024"
export OPENAI_IMAGE_QUALITY="high"
export PORT="4173"
```

## Customize the queue

Edit `data/queue.json`. Each item needs a unique `id`, `title`, `prompt`, and initial `state` of `pending`. Add the exact product-reference instructions or image inputs required by the chosen generator adapter before production use.

## Test

```bash
npm test
```

The tests use a fake generator and do not spend API credits.

## Important integration boundary

This controller does not automate the ChatGPT iOS/web interface or repeatedly press its Continue button. It calls the image API directly, because an ordinary ChatGPT conversation cannot autonomously initiate another tool call after a turn has ended. The `OpenAIImageGenerator` adapter can later be replaced with Apixel, Magnific, or another provider while keeping the queue and dashboard unchanged.
