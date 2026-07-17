---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":342718,\"output\":807,\"cacheRead\":2367488,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":67425,\"output\":6184,\"cacheRead\":585216,\"cacheWrite\":0,\"turns\":20}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":110063,\"output\":5537,\"cacheRead\":2072064,\"cacheWrite\":0,\"turns\":27},\"openai-codex/gpt-5.6-sol\":{\"input\":720890,\"output\":9622,\"cacheRead\":9267200,\"cacheWrite\":0,\"turns\":60}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":539714,\"output\":5512,\"cacheRead\":5673472,\"cacheWrite\":0,\"turns\":39}}},\"features\":{\"retire-plan\":{\"input\":342718,\"output\":807,\"cacheRead\":2367488,\"cacheWrite\":0,\"turns\":8},\"always-available-backlog\":{\"input\":878061,\"output\":13393,\"cacheRead\":6248448,\"cacheWrite\":0,\"turns\":68},\"implement-ready-feature-wave\":{\"input\":170659,\"output\":2421,\"cacheRead\":3658240,\"cacheWrite\":0,\"turns\":23},\"review-multiple-implemented-features\":{\"input\":321947,\"output\":4857,\"cacheRead\":7106048,\"cacheWrite\":0,\"turns\":35}}}"
timestamp: 2026-07-17T15:25:39.935Z
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
| openai-codex/gpt-5.6-sol | 720890 | 9622 | 9267200 | 0 | 60 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 539714 | 5512 | 5673472 | 0 | 39 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 342718 | 807 | 2367488 | 0 | 8 |
| always-available-backlog | 878061 | 13393 | 6248448 | 0 | 68 |
| implement-ready-feature-wave | 170659 | 2421 | 3658240 | 0 | 23 |
| review-multiple-implemented-features | 321947 | 4857 | 7106048 | 0 | 35 |

Total: 1780810 in / 27662 out / 19965440 cache-read / 0 cache-write over 154 turns.
