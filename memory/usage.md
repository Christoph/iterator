---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":175681,\"output\":515,\"cacheRead\":308736,\"cacheWrite\":0,\"turns\":5}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":58734,\"output\":3635,\"cacheRead\":366080,\"cacheWrite\":0,\"turns\":19}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":235343,\"output\":6089,\"cacheRead\":2935808,\"cacheWrite\":0,\"turns\":43}}},\"features\":{\"retire-plan\":{\"input\":175681,\"output\":515,\"cacheRead\":308736,\"cacheWrite\":0,\"turns\":5},\"always-available-backlog\":{\"input\":235343,\"output\":6089,\"cacheRead\":2935808,\"cacheWrite\":0,\"turns\":43}}}"
timestamp: 2026-07-17T14:16:16.745Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 175681 | 515 | 308736 | 0 | 5 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 58734 | 3635 | 366080 | 0 | 19 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 235343 | 6089 | 2935808 | 0 | 43 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 175681 | 515 | 308736 | 0 | 5 |
| always-available-backlog | 235343 | 6089 | 2935808 | 0 | 43 |

Total: 469758 in / 10239 out / 3610624 cache-read / 0 cache-write over 67 turns.
