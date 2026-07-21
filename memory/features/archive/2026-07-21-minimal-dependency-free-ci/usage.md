---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":29149,\"output\":698,\"cacheRead\":59392,\"cacheWrite\":0,\"turns\":7}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":75380,\"output\":2872,\"cacheRead\":462336,\"cacheWrite\":0,\"turns\":19}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":92407,\"output\":927,\"cacheRead\":431104,\"cacheWrite\":0,\"turns\":11}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":25758,\"output\":1040,\"cacheRead\":719360,\"cacheWrite\":0,\"turns\":13},\"openai-codex/gpt-5.6-terra\":{\"input\":59064,\"output\":51,\"cacheRead\":58368,\"cacheWrite\":0,\"turns\":2}}},\"features\":{\"retire-plan\":{\"input\":29149,\"output\":698,\"cacheRead\":59392,\"cacheWrite\":0,\"turns\":7},\"simplify-ci-workflow\":{\"input\":113143,\"output\":1522,\"cacheRead\":863232,\"cacheWrite\":0,\"turns\":19}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":29149,\"output\":698,\"cacheRead\":59392,\"cacheWrite\":0,\"turns\":7}},\"simplify-ci-workflow\":{\"openai-codex/gpt-5.6-terra\":{\"input\":92407,\"output\":927,\"cacheRead\":431104,\"cacheWrite\":0,\"turns\":11},\"openai-codex/gpt-5.6-sol\":{\"input\":20736,\"output\":595,\"cacheRead\":432128,\"cacheWrite\":0,\"turns\":8}}}}"
prices: "{}"
timestamp: 2026-07-21T09:33:26.116Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 29149 | 698 | 59392 | 0 | 7 | — |

## plan

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 75380 | 2872 | 462336 | 0 | 19 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 92407 | 927 | 431104 | 0 | 11 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 25758 | 1040 | 719360 | 0 | 13 | — |
| openai-codex/gpt-5.6-terra | 59064 | 51 | 58368 | 0 | 2 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 29149 | 698 | 59392 | 0 | 7 | — |
| simplify-ci-workflow | 113143 | 1522 | 863232 | 0 | 19 | — |

Total: 281758 in / 5588 out / 1730560 cache-read / 0 cache-write over 52 turns. Cost unavailable: add every used model rate.
