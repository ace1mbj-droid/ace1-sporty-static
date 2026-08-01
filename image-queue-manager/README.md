# 3Tins Image Queue Manager

Persistent queue foundation for multi-image generation projects. A project is complete only when every assigned job is completed and no pending, generating, retry, review, or failed jobs remain.

## Run

```bash
cd image-queue-manager
npm test
npm start
```

The service listens on `http://127.0.0.1:3400` by default and persists state in `data/queue.json`.

## Create a 60-image project

```bash
curl -X POST http://127.0.0.1:3400/projects \
  -H 'content-type: application/json' \
  -d '{
    "name": "Product image set",
    "maxAttempts": 3,
    "jobs": [
      {"purpose":"Main product image","prompt":"White background product image"},
      {"purpose":"Front lifestyle image","prompt":"Front three-quarter lifestyle image"}
    ]
  }'
```

Supply all 60 numbered job objects in `jobs`. The returned project ID can be checked with:

```bash
curl http://127.0.0.1:3400/projects/PROJECT_ID
```

## Implemented

- Durable JSON storage with atomic replacement writes
- Independent project and image-job statuses
- Strict full-project completion condition
- Queue-order claiming
- Automatic retry and maximum-attempt handling
- Human-review state for permanent failures
- Resumable worker interface
- Tests covering 60-image completion and retry behavior

## Next integration slice

Connect a real image generator and vision quality checker to `ImageWorker`, then add start, pause, resume, cancel, and live progress endpoints.
