---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":261034,\"output\":1116,\"cacheRead\":1795072,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":63084,\"output\":4999,\"cacheRead\":612864,\"cacheWrite\":0,\"turns\":20}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":117926,\"output\":9423,\"cacheRead\":2369024,\"cacheWrite\":0,\"turns\":31}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":161613,\"output\":576,\"cacheRead\":722944,\"cacheWrite\":0,\"turns\":8}}},\"features\":{\"retire-plan\":{\"input\":261034,\"output\":1116,\"cacheRead\":1795072,\"cacheWrite\":0,\"turns\":8},\"safe-role-model-handoff\":{\"input\":279539,\"output\":9999,\"cacheRead\":3091968,\"cacheWrite\":0,\"turns\":39}},\"featureModels\":{\"safe-role-model-handoff\":{\"openai-codex/gpt-5.6-terra\":{\"input\":117926,\"output\":9423,\"cacheRead\":2369024,\"cacheWrite\":0,\"turns\":31},\"openai-codex/gpt-5.6-sol\":{\"input\":161613,\"output\":576,\"cacheRead\":722944,\"cacheWrite\":0,\"turns\":8}}}}"
prices: "{}"
timestamp: 2026-07-20T13:35:07.863Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 261034 | 1116 | 1795072 | 0 | 8 | — |

## plan

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 63084 | 4999 | 612864 | 0 | 20 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 117926 | 9423 | 2369024 | 0 | 31 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 161613 | 576 | 722944 | 0 | 8 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 261034 | 1116 | 1795072 | 0 | 8 | — |
| safe-role-model-handoff | 279539 | 9999 | 3091968 | 0 | 39 | — |

Total: 603657 in / 16114 out / 5499904 cache-read / 0 cache-write over 67 turns. Cost unavailable: add every used model rate.
