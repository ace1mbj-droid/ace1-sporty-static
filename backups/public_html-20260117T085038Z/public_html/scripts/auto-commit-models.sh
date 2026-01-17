#!/bin/sh
# Auto-commit and push changes to model code

git add js/*.js
if ! git diff --cached --quiet; then
  git commit -m "Auto-commit: Update model code"
  git push
fi
