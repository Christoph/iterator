---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":320642,\"output\":2146,\"cacheRead\":4264960,\"cacheWrite\":0,\"turns\":15},\"openai-codex/gpt-5.6-sol\":{\"input\":679165,\"output\":3722,\"cacheRead\":3019776,\"cacheWrite\":0,\"turns\":16}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":365142,\"output\":5142,\"cacheRead\":5167616,\"cacheWrite\":0,\"turns\":16}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":666233,\"output\":19058,\"cacheRead\":3528192,\"cacheWrite\":0,\"turns\":38},\"openai-codex/gpt-5.6-sol\":{\"input\":246771,\"output\":3245,\"cacheRead\":2552320,\"cacheWrite\":0,\"turns\":13}}},\"features\":{\"persistent-budget-prices\":{\"input\":1573113,\"output\":25021,\"cacheRead\":7823872,\"cacheWrite\":0,\"turns\":62}},\"featureModels\":{\"persistent-budget-prices\":{\"openai-codex/gpt-5.6-terra\":{\"input\":666233,\"output\":19058,\"cacheRead\":3528192,\"cacheWrite\":0,\"turns\":38},\"openai-codex/gpt-5.6-sol\":{\"input\":906880,\"output\":5963,\"cacheRead\":4295680,\"cacheWrite\":0,\"turns\":24}}}}"
prices: "{}"
timestamp: 2026-07-20T18:06:40.402Z
---

# Usage

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 320642 | 2146 | 4264960 | 0 | 15 | — |
| openai-codex/gpt-5.6-sol | 679165 | 3722 | 3019776 | 0 | 16 | — |

## plan

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 365142 | 5142 | 5167616 | 0 | 16 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 666233 | 19058 | 3528192 | 0 | 38 | — |
| openai-codex/gpt-5.6-sol | 246771 | 3245 | 2552320 | 0 | 13 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| persistent-budget-prices | 1573113 | 25021 | 7823872 | 0 | 62 | — |

Total: 2277953 in / 33313 out / 18532864 cache-read / 0 cache-write over 98 turns. Cost unavailable: add every used model rate.
