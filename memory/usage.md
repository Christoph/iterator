---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":342718,\"output\":807,\"cacheRead\":2367488,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":67425,\"output\":6184,\"cacheRead\":585216,\"cacheWrite\":0,\"turns\":20}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":110063,\"output\":5537,\"cacheRead\":2072064,\"cacheWrite\":0,\"turns\":27},\"openai-codex/gpt-5.6-sol\":{\"input\":385656,\"output\":5395,\"cacheRead\":2564096,\"cacheWrite\":0,\"turns\":24}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":223403,\"output\":1256,\"cacheRead\":807936,\"cacheWrite\":0,\"turns\":10}}},\"features\":{\"retire-plan\":{\"input\":342718,\"output\":807,\"cacheRead\":2367488,\"cacheWrite\":0,\"turns\":8},\"always-available-backlog\":{\"input\":719122,\"output\":12188,\"cacheRead\":5444096,\"cacheWrite\":0,\"turns\":61}}}"
timestamp: 2026-07-17T15:13:01.626Z
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
| openai-codex/gpt-5.6-sol | 385656 | 5395 | 2564096 | 0 | 24 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 223403 | 1256 | 807936 | 0 | 10 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 342718 | 807 | 2367488 | 0 | 8 |
| always-available-backlog | 719122 | 12188 | 5444096 | 0 | 61 |

Total: 1129265 in / 19179 out / 8396800 cache-read / 0 cache-write over 89 turns.
