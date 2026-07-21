---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":29149,\"output\":698,\"cacheRead\":59392,\"cacheWrite\":0,\"turns\":7}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":75380,\"output\":2872,\"cacheRead\":462336,\"cacheWrite\":0,\"turns\":19}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":92407,\"output\":927,\"cacheRead\":431104,\"cacheWrite\":0,\"turns\":11}}},\"features\":{\"retire-plan\":{\"input\":29149,\"output\":698,\"cacheRead\":59392,\"cacheWrite\":0,\"turns\":7},\"simplify-ci-workflow\":{\"input\":92407,\"output\":927,\"cacheRead\":431104,\"cacheWrite\":0,\"turns\":11}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":29149,\"output\":698,\"cacheRead\":59392,\"cacheWrite\":0,\"turns\":7}},\"simplify-ci-workflow\":{\"openai-codex/gpt-5.6-terra\":{\"input\":92407,\"output\":927,\"cacheRead\":431104,\"cacheWrite\":0,\"turns\":11}}}}"
prices: "{}"
timestamp: 2026-07-21T09:32:24.464Z
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

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 29149 | 698 | 59392 | 0 | 7 | — |
| simplify-ci-workflow | 92407 | 927 | 431104 | 0 | 11 | — |

Total: 196936 in / 4497 out / 952832 cache-read / 0 cache-write over 37 turns. Cost unavailable: add every used model rate.
