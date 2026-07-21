---
type: Feature
title: Simplify CI workflow
description: Run the repository test suite once in a minimal GitHub Actions job without redundant Node setup or version-matrix executions.
status: done
size: small
depends_on: []
files: [".github/workflows/ci.yml"]
timestamp: "2026-07-21T09:32:48.120Z"
tags: []
commits:
  - sha: 818959c39f190815932ac3d7f9189c7d02e01272
    kind: implement
    date: 2026-07-21
done: 2026-07-21
---

# Implementation notes

Edit `.github/workflows/ci.yml` only. Preserve the `main` push and pull-request triggers, `ubuntu-latest`, checkout, and `npm test`; remove the matrix strategy, parameterized Node versions, and `actions/setup-node`. Validate the resulting workflow structure and run the unchanged local test suite.

# Snippets

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

# Blast radius

GitHub Actions checks for pushes to main and all pull requests.
