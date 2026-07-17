---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170439,\"output\":1029,\"cacheRead\":1018880,\"cacheWrite\":0,\"turns\":5}},\"memory\":{\"openai-codex/gpt-5.6-terra\":{\"input\":260681,\"output\":3539,\"cacheRead\":1991168,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":69670,\"output\":4171,\"cacheRead\":3958272,\"cacheWrite\":0,\"turns\":14}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1374282,\"output\":3936,\"cacheRead\":6521856,\"cacheWrite\":0,\"turns\":23}},\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":39405,\"output\":729,\"cacheRead\":1547264,\"cacheWrite\":0,\"turns\":8}}},\"features\":{\"retire-plan\":{\"input\":170439,\"output\":1029,\"cacheRead\":1018880,\"cacheWrite\":0,\"turns\":5},\"reset-plan-runtime-state\":{\"input\":1413687,\"output\":4665,\"cacheRead\":8069120,\"cacheWrite\":0,\"turns\":31}}}"
timestamp: 2026-07-17T17:43:49.472Z
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
| openai-codex/gpt-5.6-terra | 39405 | 729 | 1547264 | 0 | 8 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 170439 | 1029 | 1018880 | 0 | 5 |
| reset-plan-runtime-state | 1413687 | 4665 | 8069120 | 0 | 31 |

Total: 1914477 in / 13404 out / 15037440 cache-read / 0 cache-write over 59 turns.
