---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":173740,\"output\":9070,\"cacheRead\":3877888,\"cacheWrite\":0,\"turns\":35}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170574,\"output\":1849,\"cacheRead\":1737728,\"cacheWrite\":0,\"turns\":12},\"openai-codex/gpt-5.6-sol\":{\"input\":30398,\"output\":3717,\"cacheRead\":2566144,\"cacheWrite\":0,\"turns\":14}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":216799,\"output\":1072,\"cacheRead\":2205184,\"cacheWrite\":0,\"turns\":13}}},\"features\":{\"retire-plan\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7},\"activate-work-on-plan-start\":{\"input\":417771,\"output\":6638,\"cacheRead\":6509056,\"cacheWrite\":0,\"turns\":39}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7}},\"activate-work-on-plan-start\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170574,\"output\":1849,\"cacheRead\":1737728,\"cacheWrite\":0,\"turns\":12},\"openai-codex/gpt-5.6-sol\":{\"input\":247197,\"output\":4789,\"cacheRead\":4771328,\"cacheWrite\":0,\"turns\":27}}}}"
prices: "{}"
timestamp: 2026-07-21T14:06:09.898Z
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
| openai-codex/gpt-5.6-sol | 30398 | 3717 | 2566144 | 0 | 14 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 216799 | 1072 | 2205184 | 0 | 13 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 4327 | 565 | 413184 | 0 | 7 | — |
| activate-work-on-plan-start | 417771 | 6638 | 6509056 | 0 | 39 | — |

Total: 595838 in / 16273 out / 10800128 cache-read / 0 cache-write over 81 turns. Cost unavailable: add every used model rate.
