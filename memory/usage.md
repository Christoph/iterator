---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":92807,\"output\":7147,\"cacheRead\":464384,\"cacheWrite\":0,\"turns\":20}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":244183,\"output\":4327,\"cacheRead\":2065408,\"cacheWrite\":0,\"turns\":31}}},\"features\":{\"retire-plan\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8},\"agent-neutral-shell-copy\":{\"input\":244183,\"output\":4327,\"cacheRead\":2065408,\"cacheWrite\":0,\"turns\":31}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8}},\"agent-neutral-shell-copy\":{\"openai-codex/gpt-5.6-terra\":{\"input\":244183,\"output\":4327,\"cacheRead\":2065408,\"cacheWrite\":0,\"turns\":31}}}}"
prices: "{}"
timestamp: 2026-07-20T16:17:18.580Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 38403 | 1157 | 217088 | 0 | 8 | — |

## plan

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 92807 | 7147 | 464384 | 0 | 20 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 244183 | 4327 | 2065408 | 0 | 31 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 38403 | 1157 | 217088 | 0 | 8 | — |
| agent-neutral-shell-copy | 244183 | 4327 | 2065408 | 0 | 31 | — |

Total: 375393 in / 12631 out / 2746880 cache-read / 0 cache-write over 59 turns. Cost unavailable: add every used model rate.
