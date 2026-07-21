---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":173740,\"output\":9070,\"cacheRead\":3877888,\"cacheWrite\":0,\"turns\":35}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170574,\"output\":1849,\"cacheRead\":1737728,\"cacheWrite\":0,\"turns\":12}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":186110,\"output\":546,\"cacheRead\":852992,\"cacheWrite\":0,\"turns\":6}}},\"features\":{\"retire-plan\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7},\"activate-work-on-plan-start\":{\"input\":356684,\"output\":2395,\"cacheRead\":2590720,\"cacheWrite\":0,\"turns\":18}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7}},\"activate-work-on-plan-start\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170574,\"output\":1849,\"cacheRead\":1737728,\"cacheWrite\":0,\"turns\":12},\"openai-codex/gpt-5.6-sol\":{\"input\":186110,\"output\":546,\"cacheRead\":852992,\"cacheWrite\":0,\"turns\":6}}}}"
prices: "{}"
timestamp: 2026-07-21T14:02:58.191Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 4327 | 565 | 413184 | 0 | 7 | — |

## plan

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 173740 | 9070 | 3877888 | 0 | 35 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 170574 | 1849 | 1737728 | 0 | 12 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 186110 | 546 | 852992 | 0 | 6 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 4327 | 565 | 413184 | 0 | 7 | — |
| activate-work-on-plan-start | 356684 | 2395 | 2590720 | 0 | 18 | — |

Total: 534751 in / 12030 out / 6881792 cache-read / 0 cache-write over 60 turns. Cost unavailable: add every used model rate.
