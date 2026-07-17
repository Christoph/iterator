---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":175681,\"output\":515,\"cacheRead\":308736,\"cacheWrite\":0,\"turns\":5}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":58734,\"output\":3635,\"cacheRead\":366080,\"cacheWrite\":0,\"turns\":19}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":235343,\"output\":6089,\"cacheRead\":2935808,\"cacheWrite\":0,\"turns\":43},\"openai-codex/gpt-5.6-sol\":{\"input\":4385841,\"output\":28968,\"cacheRead\":23019008,\"cacheWrite\":0,\"turns\":126}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":1415405,\"output\":3677,\"cacheRead\":1258496,\"cacheWrite\":0,\"turns\":14}}},\"features\":{\"retire-plan\":{\"input\":175681,\"output\":515,\"cacheRead\":308736,\"cacheWrite\":0,\"turns\":5},\"always-available-backlog\":{\"input\":436207,\"output\":6962,\"cacheRead\":3155456,\"cacheWrite\":0,\"turns\":47},\"implement-ready-feature-wave\":{\"input\":3803315,\"output\":22133,\"cacheRead\":14354944,\"cacheWrite\":0,\"turns\":95},\"review-multiple-implemented-features\":{\"input\":1797067,\"output\":9639,\"cacheRead\":9702912,\"cacheWrite\":0,\"turns\":41}}}"
timestamp: 2026-07-17T14:40:56.544Z
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
| openai-codex/gpt-5.6-sol | 4385841 | 28968 | 23019008 | 0 | 126 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 1415405 | 3677 | 1258496 | 0 | 14 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 175681 | 515 | 308736 | 0 | 5 |
| always-available-backlog | 436207 | 6962 | 3155456 | 0 | 47 |
| implement-ready-feature-wave | 3803315 | 22133 | 14354944 | 0 | 95 |
| review-multiple-implemented-features | 1797067 | 9639 | 9702912 | 0 | 41 |

Total: 6271004 in / 42884 out / 27888128 cache-read / 0 cache-write over 207 turns.
