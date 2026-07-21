---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":173740,\"output\":9070,\"cacheRead\":3877888,\"cacheWrite\":0,\"turns\":35}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170574,\"output\":1849,\"cacheRead\":1737728,\"cacheWrite\":0,\"turns\":12},\"openai-codex/gpt-5.6-sol\":{\"input\":488447,\"output\":11892,\"cacheRead\":7139840,\"cacheWrite\":0,\"turns\":37}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":216799,\"output\":1072,\"cacheRead\":2205184,\"cacheWrite\":0,\"turns\":13}}},\"features\":{\"retire-plan\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7},\"activate-work-on-plan-start\":{\"input\":417771,\"output\":6638,\"cacheRead\":6509056,\"cacheWrite\":0,\"turns\":39},\"preserve-runtime-role-model\":{\"input\":458049,\"output\":8175,\"cacheRead\":4573696,\"cacheWrite\":0,\"turns\":23}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4327,\"output\":565,\"cacheRead\":413184,\"cacheWrite\":0,\"turns\":7}},\"activate-work-on-plan-start\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170574,\"output\":1849,\"cacheRead\":1737728,\"cacheWrite\":0,\"turns\":12},\"openai-codex/gpt-5.6-sol\":{\"input\":247197,\"output\":4789,\"cacheRead\":4771328,\"cacheWrite\":0,\"turns\":27}},\"preserve-runtime-role-model\":{\"openai-codex/gpt-5.6-sol\":{\"input\":458049,\"output\":8175,\"cacheRead\":4573696,\"cacheWrite\":0,\"turns\":23}}}}"
prices: "{}"
timestamp: 2026-07-21T14:10:50.474Z
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
| openai-codex/gpt-5.6-sol | 216799 | 1072 | 2205184 | 0 | 13 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 4327 | 565 | 413184 | 0 | 7 | — |
| activate-work-on-plan-start | 417771 | 6638 | 6509056 | 0 | 39 | — |
| preserve-runtime-role-model | 458049 | 8175 | 4573696 | 0 | 23 | — |

Total: 1053887 in / 24448 out / 15373824 cache-read / 0 cache-write over 104 turns. Cost unavailable: add every used model rate.
