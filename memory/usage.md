---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":118306,\"output\":8575,\"cacheRead\":3610112,\"cacheWrite\":0,\"turns\":21}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1454180,\"output\":20444,\"cacheRead\":13496832,\"cacheWrite\":0,\"turns\":53},\"openai-codex/gpt-5.6-sol\":{\"input\":1332608,\"output\":10554,\"cacheRead\":7464960,\"cacheWrite\":0,\"turns\":42}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":683106,\"output\":5003,\"cacheRead\":3732480,\"cacheWrite\":0,\"turns\":20}}},\"features\":{\"retire-plan\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9},\"fresh-implementation-session\":{\"input\":2916375,\"output\":23531,\"cacheRead\":16707072,\"cacheWrite\":0,\"turns\":72},\"active-plan-workspace\":{\"input\":553519,\"output\":12470,\"cacheRead\":7987200,\"cacheWrite\":0,\"turns\":43}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9}},\"fresh-implementation-session\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1086985,\"output\":12201,\"cacheRead\":6675968,\"cacheWrite\":0,\"turns\":32},\"openai-codex/gpt-5.6-sol\":{\"input\":1829390,\"output\":11330,\"cacheRead\":10031104,\"cacheWrite\":0,\"turns\":40}},\"active-plan-workspace\":{\"openai-codex/gpt-5.6-terra\":{\"input\":367195,\"output\":8243,\"cacheRead\":6820864,\"cacheWrite\":0,\"turns\":21},\"openai-codex/gpt-5.6-sol\":{\"input\":186324,\"output\":4227,\"cacheRead\":1166336,\"cacheWrite\":0,\"turns\":22}}}}"
prices: "{}"
timestamp: 2026-07-20T14:23:41.264Z
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
| openai-codex/gpt-5.6-terra | 1454180 | 20444 | 13496832 | 0 | 53 | — |
| openai-codex/gpt-5.6-sol | 1332608 | 10554 | 7464960 | 0 | 42 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 683106 | 5003 | 3732480 | 0 | 20 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 243028 | 842 | 811520 | 0 | 9 | — |
| fresh-implementation-session | 2916375 | 23531 | 16707072 | 0 | 72 | — |
| active-plan-workspace | 553519 | 12470 | 7987200 | 0 | 43 | — |

Total: 3831228 in / 45418 out / 29115904 cache-read / 0 cache-write over 145 turns. Cost unavailable: add every used model rate.
