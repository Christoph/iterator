---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":118306,\"output\":8575,\"cacheRead\":3610112,\"cacheWrite\":0,\"turns\":21}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1086985,\"output\":12201,\"cacheRead\":6675968,\"cacheWrite\":0,\"turns\":32},\"openai-codex/gpt-5.6-sol\":{\"input\":1191326,\"output\":7856,\"cacheRead\":6515712,\"cacheWrite\":0,\"turns\":26}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":638064,\"output\":3474,\"cacheRead\":3515392,\"cacheWrite\":0,\"turns\":14}}},\"features\":{\"retire-plan\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9},\"fresh-implementation-session\":{\"input\":2916375,\"output\":23531,\"cacheRead\":16707072,\"cacheWrite\":0,\"turns\":72}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9}},\"fresh-implementation-session\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1086985,\"output\":12201,\"cacheRead\":6675968,\"cacheWrite\":0,\"turns\":32},\"openai-codex/gpt-5.6-sol\":{\"input\":1829390,\"output\":11330,\"cacheRead\":10031104,\"cacheWrite\":0,\"turns\":40}}}}"
prices: "{}"
timestamp: 2026-07-20T14:07:08.091Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 243028 | 842 | 811520 | 0 | 9 | — |

## plan

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 118306 | 8575 | 3610112 | 0 | 21 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 1086985 | 12201 | 6675968 | 0 | 32 | — |
| openai-codex/gpt-5.6-sol | 1191326 | 7856 | 6515712 | 0 | 26 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 638064 | 3474 | 3515392 | 0 | 14 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 243028 | 842 | 811520 | 0 | 9 | — |
| fresh-implementation-session | 2916375 | 23531 | 16707072 | 0 | 72 | — |

Total: 3277709 in / 32948 out / 21128704 cache-read / 0 cache-write over 102 turns. Cost unavailable: add every used model rate.
