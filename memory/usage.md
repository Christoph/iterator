---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":16969,\"output\":1048,\"cacheRead\":53248,\"cacheWrite\":0,\"turns\":5}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":61028,\"output\":5028,\"cacheRead\":668672,\"cacheWrite\":0,\"turns\":17}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":119901,\"output\":3970,\"cacheRead\":1700864,\"cacheWrite\":0,\"turns\":19},\"openai-codex/gpt-5.6-sol\":{\"input\":147159,\"output\":3764,\"cacheRead\":2008064,\"cacheWrite\":0,\"turns\":17}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":115474,\"output\":925,\"cacheRead\":333312,\"cacheWrite\":0,\"turns\":4}}},\"features\":{\"retire-plan\":{\"input\":16969,\"output\":1048,\"cacheRead\":53248,\"cacheWrite\":0,\"turns\":5},\"preserve-review-across-planning\":{\"input\":382534,\"output\":8659,\"cacheRead\":4042240,\"cacheWrite\":0,\"turns\":40}}}"
timestamp: 2026-07-17T16:22:50.432Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 16969 | 1048 | 53248 | 0 | 5 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 61028 | 5028 | 668672 | 0 | 17 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 119901 | 3970 | 1700864 | 0 | 19 |
| openai-codex/gpt-5.6-sol | 147159 | 3764 | 2008064 | 0 | 17 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 115474 | 925 | 333312 | 0 | 4 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 16969 | 1048 | 53248 | 0 | 5 |
| preserve-review-across-planning | 382534 | 8659 | 4042240 | 0 | 40 |

Total: 460531 in / 14735 out / 4764160 cache-read / 0 cache-write over 62 turns.
