---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":175681,\"output\":515,\"cacheRead\":308736,\"cacheWrite\":0,\"turns\":5}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":58734,\"output\":3635,\"cacheRead\":366080,\"cacheWrite\":0,\"turns\":19}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":235343,\"output\":6089,\"cacheRead\":2935808,\"cacheWrite\":0,\"turns\":43},\"openai-codex/gpt-5.6-sol\":{\"input\":2588774,\"output\":19329,\"cacheRead\":13316096,\"cacheWrite\":0,\"turns\":85}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":1102634,\"output\":3221,\"cacheRead\":531456,\"cacheWrite\":0,\"turns\":10}}},\"features\":{\"retire-plan\":{\"input\":175681,\"output\":515,\"cacheRead\":308736,\"cacheWrite\":0,\"turns\":5},\"always-available-backlog\":{\"input\":436207,\"output\":6962,\"cacheRead\":3155456,\"cacheWrite\":0,\"turns\":47},\"implement-ready-feature-wave\":{\"input\":3490544,\"output\":21677,\"cacheRead\":13627904,\"cacheWrite\":0,\"turns\":91}}}"
timestamp: 2026-07-17T14:32:42.792Z
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
| openai-codex/gpt-5.6-sol | 2588774 | 19329 | 13316096 | 0 | 85 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 1102634 | 3221 | 531456 | 0 | 10 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 175681 | 515 | 308736 | 0 | 5 |
| always-available-backlog | 436207 | 6962 | 3155456 | 0 | 47 |
| implement-ready-feature-wave | 3490544 | 21677 | 13627904 | 0 | 91 |

Total: 4161166 in / 32789 out / 17458176 cache-read / 0 cache-write over 162 turns.
