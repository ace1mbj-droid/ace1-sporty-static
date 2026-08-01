# Continuous Image Orchestrator

A resumable, queue-driven runner that processes every pending image instead of stopping after the first generation.

## Run now

```bash
cd tools/image-orchestrator
node orchestrator.js add "Main product image on white" "Front three-quarter lifestyle image"
node orchestrator.js run mock
node orchestrator.js status
```

The mock provider proves the complete loop without paid services. It writes one result per queue item to `output/`.

## Real image provider

Add `providers/<name>.js` exporting:

```js
module.exports.generate = async ({ item, outputDir }) => {
  // Call the provider API, save the image, and return metadata.
  return { provider: '<name>', file: '/absolute/or/relative/path.png' };
};
```

Run with `IMAGE_PROVIDER=<name> node orchestrator.js run`.

## Reliability behavior

- Persistent JSON queue survives restarts.
- One active runner is enforced with a lock file.
- Failed jobs move to `retry` and are retried up to three times.
- Completed jobs are never regenerated.
- The loop exits only when no pending/retry jobs remain.
- `status` shows counts and the exact next item.

## Important platform boundary

This runner can continuously call a provider that exposes an API. It cannot recursively press ChatGPT's internal image button from inside a chat turn. For ChatGPT-only generation, use this queue as the source of truth and advance one item per tool call.
