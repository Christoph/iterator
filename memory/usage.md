---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":320642,\"output\":2146,\"cacheRead\":4264960,\"cacheWrite\":0,\"turns\":15},\"openai-codex/gpt-5.6-sol\":{\"input\":182202,\"output\":1827,\"cacheRead\":757248,\"cacheWrite\":0,\"turns\":5}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":365142,\"output\":5142,\"cacheRead\":5167616,\"cacheWrite\":0,\"turns\":16}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":666233,\"output\":19058,\"cacheRead\":3528192,\"cacheWrite\":0,\"turns\":38},\"openai-codex/gpt-5.6-sol\":{\"input\":246771,\"output\":3245,\"cacheRead\":2552320,\"cacheWrite\":0,\"turns\":13}}},\"features\":{\"persistent-budget-prices\":{\"input\":1095206,\"output\":24130,\"cacheRead\":6837760,\"cacheWrite\":0,\"turns\":56}},\"featureModels\":{\"persistent-budget-prices\":{\"openai-codex/gpt-5.6-terra\":{\"input\":666233,\"output\":19058,\"cacheRead\":3528192,\"cacheWrite\":0,\"turns\":38},\"openai-codex/gpt-5.6-sol\":{\"input\":428973,\"output\":5072,\"cacheRead\":3309568,\"cacheWrite\":0,\"turns\":18}}}}"
prices: "{}"
timestamp: 2026-07-20T18:05:22.046Z
---

# Usage

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 320642 | 2146 | 4264960 | 0 | 15 | — |
| openai-codex/gpt-5.6-sol | 182202 | 1827 | 757248 | 0 | 5 | — |

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
| persistent-budget-prices | 1095206 | 24130 | 6837760 | 0 | 56 | — |

Total: 1780990 in / 31418 out / 16270336 cache-read / 0 cache-write over 87 turns. Cost unavailable: add every used model rate.
