---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":118306,\"output\":8575,\"cacheRead\":3610112,\"cacheWrite\":0,\"turns\":21}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1859547,\"output\":31908,\"cacheRead\":17335296,\"cacheWrite\":0,\"turns\":85},\"openai-codex/gpt-5.6-sol\":{\"input\":1332608,\"output\":10554,\"cacheRead\":7464960,\"cacheWrite\":0,\"turns\":42}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":728855,\"output\":5624,\"cacheRead\":4130304,\"cacheWrite\":0,\"turns\":25},\"openai-codex/gpt-5.6-terra\":{\"input\":164150,\"output\":533,\"cacheRead\":1024000,\"cacheWrite\":0,\"turns\":7}}},\"features\":{\"retire-plan\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9},\"fresh-implementation-session\":{\"input\":2916375,\"output\":23531,\"cacheRead\":16707072,\"cacheWrite\":0,\"turns\":72},\"active-plan-workspace\":{\"input\":599268,\"output\":13091,\"cacheRead\":8385024,\"cacheWrite\":0,\"turns\":48},\"settings-dashboard-modal\":{\"input\":569517,\"output\":11997,\"cacheRead\":4862464,\"cacheWrite\":0,\"turns\":39}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9}},\"fresh-implementation-session\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1086985,\"output\":12201,\"cacheRead\":6675968,\"cacheWrite\":0,\"turns\":32},\"openai-codex/gpt-5.6-sol\":{\"input\":1829390,\"output\":11330,\"cacheRead\":10031104,\"cacheWrite\":0,\"turns\":40}},\"active-plan-workspace\":{\"openai-codex/gpt-5.6-terra\":{\"input\":367195,\"output\":8243,\"cacheRead\":6820864,\"cacheWrite\":0,\"turns\":21},\"openai-codex/gpt-5.6-sol\":{\"input\":232073,\"output\":4848,\"cacheRead\":1564160,\"cacheWrite\":0,\"turns\":27}},\"settings-dashboard-modal\":{\"openai-codex/gpt-5.6-terra\":{\"input\":569517,\"output\":11997,\"cacheRead\":4862464,\"cacheWrite\":0,\"turns\":39}}}}"
prices: "{}"
timestamp: 2026-07-20T14:36:29.498Z
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
| openai-codex/gpt-5.6-terra | 1859547 | 31908 | 17335296 | 0 | 85 | — |
| openai-codex/gpt-5.6-sol | 1332608 | 10554 | 7464960 | 0 | 42 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 728855 | 5624 | 4130304 | 0 | 25 | — |
| openai-codex/gpt-5.6-terra | 164150 | 533 | 1024000 | 0 | 7 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 243028 | 842 | 811520 | 0 | 9 | — |
| fresh-implementation-session | 2916375 | 23531 | 16707072 | 0 | 72 | — |
| active-plan-workspace | 599268 | 13091 | 8385024 | 0 | 48 | — |
| settings-dashboard-modal | 569517 | 11997 | 4862464 | 0 | 39 | — |

Total: 4446494 in / 58036 out / 34376192 cache-read / 0 cache-write over 189 turns. Cost unavailable: add every used model rate.
