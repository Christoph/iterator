---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":110165,\"output\":950,\"cacheRead\":930816,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":109438,\"output\":7632,\"cacheRead\":1187840,\"cacheWrite\":0,\"turns\":25}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":338695,\"output\":5761,\"cacheRead\":1907200,\"cacheWrite\":0,\"turns\":20},\"openai-codex/gpt-5.6-sol\":{\"input\":4014391,\"output\":57964,\"cacheRead\":35012096,\"cacheWrite\":0,\"turns\":189}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":2686173,\"output\":7613,\"cacheRead\":9745920,\"cacheWrite\":0,\"turns\":58}}},\"features\":{\"retire-plan\":{\"input\":110165,\"output\":950,\"cacheRead\":930816,\"cacheWrite\":0,\"turns\":9},\"bound-feature-memories\":{\"input\":593622,\"output\":7069,\"cacheRead\":2704384,\"cacheWrite\":0,\"turns\":28},\"consolidate-overattached-memories\":{\"input\":665993,\"output\":6838,\"cacheRead\":2766848,\"cacheWrite\":0,\"turns\":22},\"memorize-on-retirement\":{\"input\":1068990,\"output\":8480,\"cacheRead\":4910080,\"cacheWrite\":0,\"turns\":30},\"onboard-planless-projects\":{\"input\":1658317,\"output\":12417,\"cacheRead\":15417344,\"cacheWrite\":0,\"turns\":61},\"price-model-usage\":{\"input\":2285732,\"output\":21463,\"cacheRead\":10189824,\"cacheWrite\":0,\"turns\":65},\"reliable-work-blocker\":{\"input\":710934,\"output\":13991,\"cacheRead\":8543232,\"cacheWrite\":0,\"turns\":52}}}"
timestamp: 2026-07-18T07:58:05.257Z
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
| openai-codex/gpt-5.6-sol | 4014391 | 57964 | 35012096 | 0 | 189 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 2686173 | 7613 | 9745920 | 0 | 58 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 110165 | 950 | 930816 | 0 | 9 |
| bound-feature-memories | 593622 | 7069 | 2704384 | 0 | 28 |
| consolidate-overattached-memories | 665993 | 6838 | 2766848 | 0 | 22 |
| memorize-on-retirement | 1068990 | 8480 | 4910080 | 0 | 30 |
| onboard-planless-projects | 1658317 | 12417 | 15417344 | 0 | 61 |
| price-model-usage | 2285732 | 21463 | 10189824 | 0 | 65 |
| reliable-work-blocker | 710934 | 13991 | 8543232 | 0 | 52 |

Total: 7258862 in / 79920 out / 48783872 cache-read / 0 cache-write over 301 turns.
