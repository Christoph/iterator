---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"memory\":{\"openai-codex/gpt-5.6-terra\":{\"input\":44198,\"output\":3999,\"cacheRead\":403968,\"cacheWrite\":0,\"turns\":15}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":34390,\"output\":2701,\"cacheRead\":236544,\"cacheWrite\":0,\"turns\":13}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":366372,\"output\":15944,\"cacheRead\":4166144,\"cacheWrite\":0,\"turns\":90}},\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":164248,\"output\":533,\"cacheRead\":262144,\"cacheWrite\":0,\"turns\":6}}},\"features\":{\"clarify-dashboard-identity\":{\"input\":145062,\"output\":6981,\"cacheRead\":2294272,\"cacheWrite\":0,\"turns\":41},\"bound-planning-archives\":{\"input\":97794,\"output\":4549,\"cacheRead\":805888,\"cacheWrite\":0,\"turns\":24},\"scope-settings-model-options\":{\"input\":287764,\"output\":4947,\"cacheRead\":1328128,\"cacheWrite\":0,\"turns\":31}}}"
timestamp: 2026-07-17T08:06:03.591Z
---

# Usage

## memory

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 44198 | 3999 | 403968 | 0 | 15 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 34390 | 2701 | 236544 | 0 | 13 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 366372 | 15944 | 4166144 | 0 | 90 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 164248 | 533 | 262144 | 0 | 6 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| clarify-dashboard-identity | 145062 | 6981 | 2294272 | 0 | 41 |
| bound-planning-archives | 97794 | 4549 | 805888 | 0 | 24 |
| scope-settings-model-options | 287764 | 4947 | 1328128 | 0 | 31 |

Total: 609208 in / 23177 out / 5068800 cache-read / 0 cache-write over 124 turns.
