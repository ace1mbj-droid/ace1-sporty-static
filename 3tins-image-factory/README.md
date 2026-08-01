# 3Tins Image Factory

Persistent queue worker for generating product images and uploading approved results directly to Shopify.

## Workflow

Pending → Generating → Quality Check → Approved → Shopify Upload → Verify → Completed

Failures move to a retry queue with capped attempts and an error log.

## Initial verified state

- Target: 70 images
- Completed: 5
- Pending: 65
- Current product: Personalised Pencil Box (5/7)
- Next image: Alternate lifestyle scene

## Safety

This project lives only on the `3tins-image-factory` branch. The ACE1 website remains on `main`, and `backup-main-2026-08-01` is the restore branch.
