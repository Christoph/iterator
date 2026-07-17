---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":342718,\"output\":807,\"cacheRead\":2367488,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":67425,\"output\":6184,\"cacheRead\":585216,\"cacheWrite\":0,\"turns\":20}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":110063,\"output\":5537,\"cacheRead\":2072064,\"cacheWrite\":0,\"turns\":27},\"openai-codex/gpt-5.6-sol\":{\"input\":432155,\"output\":6315,\"cacheRead\":4017152,\"cacheWrite\":0,\"turns\":34}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":382342,\"output\":2461,\"cacheRead\":1612288,\"cacheWrite\":0,\"turns\":17}}},\"features\":{\"retire-plan\":{\"input\":342718,\"output\":807,\"cacheRead\":2367488,\"cacheWrite\":0,\"turns\":8},\"always-available-backlog\":{\"input\":878061,\"output\":13393,\"cacheRead\":6248448,\"cacheWrite\":0,\"turns\":68},\"implement-ready-feature-wave\":{\"input\":46499,\"output\":920,\"cacheRead\":1453056,\"cacheWrite\":0,\"turns\":10}}}"
timestamp: 2026-07-17T15:15:41.509Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 342718 | 807 | 2367488 | 0 | 8 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 67425 | 6184 | 585216 | 0 | 20 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 110063 | 5537 | 2072064 | 0 | 27 |
| openai-codex/gpt-5.6-sol | 432155 | 6315 | 4017152 | 0 | 34 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 382342 | 2461 | 1612288 | 0 | 17 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 342718 | 807 | 2367488 | 0 | 8 |
| always-available-backlog | 878061 | 13393 | 6248448 | 0 | 68 |
| implement-ready-feature-wave | 46499 | 920 | 1453056 | 0 | 10 |

Total: 1334703 in / 21304 out / 10654208 cache-read / 0 cache-write over 106 turns.
