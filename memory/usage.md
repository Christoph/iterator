---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":110165,\"output\":950,\"cacheRead\":930816,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":109438,\"output\":7632,\"cacheRead\":1187840,\"cacheWrite\":0,\"turns\":25}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":338695,\"output\":5761,\"cacheRead\":1907200,\"cacheWrite\":0,\"turns\":20},\"openai-codex/gpt-5.6-sol\":{\"input\":3415734,\"output\":39904,\"cacheRead\":25694208,\"cacheWrite\":0,\"turns\":112}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":2035312,\"output\":3871,\"cacheRead\":6058496,\"cacheWrite\":0,\"turns\":36}}},\"features\":{\"retire-plan\":{\"input\":110165,\"output\":950,\"cacheRead\":930816,\"cacheWrite\":0,\"turns\":9},\"bound-feature-memories\":{\"input\":593622,\"output\":7069,\"cacheRead\":2704384,\"cacheWrite\":0,\"turns\":28},\"consolidate-overattached-memories\":{\"input\":665993,\"output\":6838,\"cacheRead\":2766848,\"cacheWrite\":0,\"turns\":22},\"memorize-on-retirement\":{\"input\":1068990,\"output\":8480,\"cacheRead\":4910080,\"cacheWrite\":0,\"turns\":30},\"onboard-planless-projects\":{\"input\":1658317,\"output\":12417,\"cacheRead\":15417344,\"cacheWrite\":0,\"turns\":61},\"price-model-usage\":{\"input\":1802819,\"output\":14732,\"cacheRead\":7861248,\"cacheWrite\":0,\"turns\":27}}}"
timestamp: 2026-07-18T07:43:56.217Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 110165 | 950 | 930816 | 0 | 9 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 109438 | 7632 | 1187840 | 0 | 25 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 338695 | 5761 | 1907200 | 0 | 20 |
| openai-codex/gpt-5.6-sol | 3415734 | 39904 | 25694208 | 0 | 112 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 2035312 | 3871 | 6058496 | 0 | 36 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 110165 | 950 | 930816 | 0 | 9 |
| bound-feature-memories | 593622 | 7069 | 2704384 | 0 | 28 |
| consolidate-overattached-memories | 665993 | 6838 | 2766848 | 0 | 22 |
| memorize-on-retirement | 1068990 | 8480 | 4910080 | 0 | 30 |
| onboard-planless-projects | 1658317 | 12417 | 15417344 | 0 | 61 |
| price-model-usage | 1802819 | 14732 | 7861248 | 0 | 27 |

Total: 6009344 in / 58118 out / 35778560 cache-read / 0 cache-write over 202 turns.
