---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170439,\"output\":1029,\"cacheRead\":1018880,\"cacheWrite\":0,\"turns\":5}},\"memory\":{\"openai-codex/gpt-5.6-terra\":{\"input\":260681,\"output\":3539,\"cacheRead\":1991168,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":69670,\"output\":4171,\"cacheRead\":3958272,\"cacheWrite\":0,\"turns\":14}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1374282,\"output\":3936,\"cacheRead\":6521856,\"cacheWrite\":0,\"turns\":23}},\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":9213,\"output\":380,\"cacheRead\":1424384,\"cacheWrite\":0,\"turns\":4}}},\"features\":{\"retire-plan\":{\"input\":170439,\"output\":1029,\"cacheRead\":1018880,\"cacheWrite\":0,\"turns\":5},\"reset-plan-runtime-state\":{\"input\":1383495,\"output\":4316,\"cacheRead\":7946240,\"cacheWrite\":0,\"turns\":27}}}"
timestamp: 2026-07-17T17:42:49.505Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 170439 | 1029 | 1018880 | 0 | 5 |

## memory

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 260681 | 3539 | 1991168 | 0 | 9 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 69670 | 4171 | 3958272 | 0 | 14 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 1374282 | 3936 | 6521856 | 0 | 23 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 9213 | 380 | 1424384 | 0 | 4 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 170439 | 1029 | 1018880 | 0 | 5 |
| reset-plan-runtime-state | 1383495 | 4316 | 7946240 | 0 | 27 |

Total: 1884285 in / 13055 out / 14914560 cache-read / 0 cache-write over 55 turns.
