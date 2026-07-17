---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":175681,\"output\":515,\"cacheRead\":308736,\"cacheWrite\":0,\"turns\":5}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":58734,\"output\":3635,\"cacheRead\":366080,\"cacheWrite\":0,\"turns\":19}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":235343,\"output\":6089,\"cacheRead\":2935808,\"cacheWrite\":0,\"turns\":43},\"openai-codex/gpt-5.6-sol\":{\"input\":977867,\"output\":9814,\"cacheRead\":3878912,\"cacheWrite\":0,\"turns\":35}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":600832,\"output\":2307,\"cacheRead\":344064,\"cacheWrite\":0,\"turns\":7}}},\"features\":{\"retire-plan\":{\"input\":175681,\"output\":515,\"cacheRead\":308736,\"cacheWrite\":0,\"turns\":5},\"always-available-backlog\":{\"input\":436207,\"output\":6962,\"cacheRead\":3155456,\"cacheWrite\":0,\"turns\":47},\"implement-ready-feature-wave\":{\"input\":1377835,\"output\":11248,\"cacheRead\":4003328,\"cacheWrite\":0,\"turns\":38}}}"
timestamp: 2026-07-17T14:23:44.075Z
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
| openai-codex/gpt-5.6-sol | 977867 | 9814 | 3878912 | 0 | 35 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 600832 | 2307 | 344064 | 0 | 7 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 175681 | 515 | 308736 | 0 | 5 |
| always-available-backlog | 436207 | 6962 | 3155456 | 0 | 47 |
| implement-ready-feature-wave | 1377835 | 11248 | 4003328 | 0 | 38 |

Total: 2048457 in / 22360 out / 7833600 cache-read / 0 cache-write over 109 turns.
