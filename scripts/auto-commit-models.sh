#!/bin/sh
# Auto-commit and push changes to AI model code

git add js/*.js
if ! git diff --cached --quiet; then
  git commit -m "Auto-commit: Update AI model code"
  git push
fi
