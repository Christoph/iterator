---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":110165,\"output\":950,\"cacheRead\":930816,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":109438,\"output\":7632,\"cacheRead\":1187840,\"cacheWrite\":0,\"turns\":25}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":338695,\"output\":5761,\"cacheRead\":1907200,\"cacheWrite\":0,\"turns\":20},\"openai-codex/gpt-5.6-sol\":{\"input\":1254026,\"output\":22007,\"cacheRead\":13401600,\"cacheWrite\":0,\"turns\":70}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":1668228,\"output\":3409,\"cacheRead\":4064256,\"cacheWrite\":0,\"turns\":29}}},\"features\":{\"retire-plan\":{\"input\":110165,\"output\":950,\"cacheRead\":930816,\"cacheWrite\":0,\"turns\":9},\"bound-feature-memories\":{\"input\":593622,\"output\":7069,\"cacheRead\":2704384,\"cacheWrite\":0,\"turns\":28},\"consolidate-overattached-memories\":{\"input\":665993,\"output\":6838,\"cacheRead\":2766848,\"cacheWrite\":0,\"turns\":22},\"memorize-on-retirement\":{\"input\":1068990,\"output\":8480,\"cacheRead\":4910080,\"cacheWrite\":0,\"turns\":30},\"onboard-planless-projects\":{\"input\":932344,\"output\":8790,\"cacheRead\":8991744,\"cacheWrite\":0,\"turns\":39}}}"
timestamp: 2026-07-18T07:33:18.006Z
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
| openai-codex/gpt-5.6-sol | 1254026 | 22007 | 13401600 | 0 | 70 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 1668228 | 3409 | 4064256 | 0 | 29 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 110165 | 950 | 930816 | 0 | 9 |
| bound-feature-memories | 593622 | 7069 | 2704384 | 0 | 28 |
| consolidate-overattached-memories | 665993 | 6838 | 2766848 | 0 | 22 |
| memorize-on-retirement | 1068990 | 8480 | 4910080 | 0 | 30 |
| onboard-planless-projects | 932344 | 8790 | 8991744 | 0 | 39 |

Total: 3480552 in / 39759 out / 21491712 cache-read / 0 cache-write over 153 turns.
