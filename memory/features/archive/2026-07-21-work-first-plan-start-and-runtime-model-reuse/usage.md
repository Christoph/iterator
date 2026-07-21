---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":173740,\"output\":9070,\"cacheRead\":3877888,\"cacheWrite\":0,\"turns\":35}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170574,\"output\":1849,\"cacheRead\":1737728,\"cacheWrite\":0,\"turns\":12},\"openai-codex/gpt-5.6-sol\":{\"input\":488447,\"output\":11892,\"cacheRead\":7139840,\"cacheWrite\":0,\"turns\":37}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":681248,\"output\":3134,\"cacheRead\":4352000,\"cacheWrite\":0,\"turns\":24},\"openai-codex/gpt-5.6-terra\":{\"input\":237542,\"output\":49,\"cacheRead\":236544,\"cacheWrite\":0,\"turns\":2}}},\"features\":{\"retire-plan\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7},\"activate-work-on-plan-start\":{\"input\":417771,\"output\":6638,\"cacheRead\":6509056,\"cacheWrite\":0,\"turns\":39},\"preserve-runtime-role-model\":{\"input\":912341,\"output\":8904,\"cacheRead\":5768192,\"cacheWrite\":0,\"turns\":30}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7}},\"activate-work-on-plan-start\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170574,\"output\":1849,\"cacheRead\":1737728,\"cacheWrite\":0,\"turns\":12},\"openai-codex/gpt-5.6-sol\":{\"input\":247197,\"output\":4789,\"cacheRead\":4771328,\"cacheWrite\":0,\"turns\":27}},\"preserve-runtime-role-model\":{\"openai-codex/gpt-5.6-sol\":{\"input\":912341,\"output\":8904,\"cacheRead\":5768192,\"cacheWrite\":0,\"turns\":30}}}}"
prices: "{}"
timestamp: 2026-07-21T14:12:19.535Z
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
| openai-codex/gpt-5.6-sol | 488447 | 11892 | 7139840 | 0 | 37 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 681248 | 3134 | 4352000 | 0 | 24 | — |
| openai-codex/gpt-5.6-terra | 237542 | 49 | 236544 | 0 | 2 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 4327 | 565 | 413184 | 0 | 7 | — |
| activate-work-on-plan-start | 417771 | 6638 | 6509056 | 0 | 39 | — |
| preserve-runtime-role-model | 912341 | 8904 | 5768192 | 0 | 30 | — |

Total: 1755878 in / 26559 out / 17757184 cache-read / 0 cache-write over 117 turns. Cost unavailable: add every used model rate.
