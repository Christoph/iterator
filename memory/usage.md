---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":16969,\"output\":1048,\"cacheRead\":53248,\"cacheWrite\":0,\"turns\":5}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":61028,\"output\":5028,\"cacheRead\":668672,\"cacheWrite\":0,\"turns\":17}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":119901,\"output\":3970,\"cacheRead\":1700864,\"cacheWrite\":0,\"turns\":19},\"openai-codex/gpt-5.6-sol\":{\"input\":196441,\"output\":8227,\"cacheRead\":4274176,\"cacheWrite\":0,\"turns\":31}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":282795,\"output\":1756,\"cacheRead\":733184,\"cacheWrite\":0,\"turns\":8}}},\"features\":{\"retire-plan\":{\"input\":16969,\"output\":1048,\"cacheRead\":53248,\"cacheWrite\":0,\"turns\":5},\"preserve-review-across-planning\":{\"input\":549855,\"output\":9490,\"cacheRead\":4442112,\"cacheWrite\":0,\"turns\":44},\"show-active-work-in-work\":{\"input\":49282,\"output\":4463,\"cacheRead\":2266112,\"cacheWrite\":0,\"turns\":14}}}"
timestamp: 2026-07-17T16:26:06.426Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 16969 | 1048 | 53248 | 0 | 5 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 61028 | 5028 | 668672 | 0 | 17 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 119901 | 3970 | 1700864 | 0 | 19 |
| openai-codex/gpt-5.6-sol | 196441 | 8227 | 4274176 | 0 | 31 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 282795 | 1756 | 733184 | 0 | 8 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 16969 | 1048 | 53248 | 0 | 5 |
| preserve-review-across-planning | 549855 | 9490 | 4442112 | 0 | 44 |
| show-active-work-in-work | 49282 | 4463 | 2266112 | 0 | 14 |

Total: 677134 in / 20029 out / 7430144 cache-read / 0 cache-write over 80 turns.
