---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170439,\"output\":1029,\"cacheRead\":1018880,\"cacheWrite\":0,\"turns\":5}},\"memory\":{\"openai-codex/gpt-5.6-terra\":{\"input\":260681,\"output\":3539,\"cacheRead\":1991168,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":69670,\"output\":4171,\"cacheRead\":3958272,\"cacheWrite\":0,\"turns\":14}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":686837,\"output\":3137,\"cacheRead\":4738560,\"cacheWrite\":0,\"turns\":16}}},\"features\":{\"retire-plan\":{\"input\":170439,\"output\":1029,\"cacheRead\":1018880,\"cacheWrite\":0,\"turns\":5},\"reset-plan-runtime-state\":{\"input\":686837,\"output\":3137,\"cacheRead\":4738560,\"cacheWrite\":0,\"turns\":16}}}"
timestamp: 2026-07-17T17:38:11.791Z
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
| openai-codex/gpt-5.6-terra | 686837 | 3137 | 4738560 | 0 | 16 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 170439 | 1029 | 1018880 | 0 | 5 |
| reset-plan-runtime-state | 686837 | 3137 | 4738560 | 0 | 16 |

Total: 1187627 in / 11876 out / 11706880 cache-read / 0 cache-write over 44 turns.
