---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":118306,\"output\":8575,\"cacheRead\":3610112,\"cacheWrite\":0,\"turns\":21}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1086985,\"output\":12201,\"cacheRead\":6675968,\"cacheWrite\":0,\"turns\":32},\"openai-codex/gpt-5.6-sol\":{\"input\":1191326,\"output\":7856,\"cacheRead\":6515712,\"cacheWrite\":0,\"turns\":26}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":588476,\"output\":2395,\"cacheRead\":1334784,\"cacheWrite\":0,\"turns\":7}}},\"features\":{\"retire-plan\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9},\"fresh-implementation-session\":{\"input\":2866787,\"output\":22452,\"cacheRead\":14526464,\"cacheWrite\":0,\"turns\":65}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":243028,\"output\":842,\"cacheRead\":811520,\"cacheWrite\":0,\"turns\":9}},\"fresh-implementation-session\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1086985,\"output\":12201,\"cacheRead\":6675968,\"cacheWrite\":0,\"turns\":32},\"openai-codex/gpt-5.6-sol\":{\"input\":1779802,\"output\":10251,\"cacheRead\":7850496,\"cacheWrite\":0,\"turns\":33}}}}"
prices: "{}"
timestamp: 2026-07-20T14:05:53.791Z
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
| openai-codex/gpt-5.6-sol | 588476 | 2395 | 1334784 | 0 | 7 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 243028 | 842 | 811520 | 0 | 9 | — |
| fresh-implementation-session | 2866787 | 22452 | 14526464 | 0 | 65 | — |

Total: 3228121 in / 31869 out / 18948096 cache-read / 0 cache-write over 95 turns. Cost unavailable: add every used model rate.
