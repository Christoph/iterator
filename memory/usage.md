---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":92807,\"output\":7147,\"cacheRead\":464384,\"cacheWrite\":0,\"turns\":20}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":244183,\"output\":4327,\"cacheRead\":2065408,\"cacheWrite\":0,\"turns\":31},\"openai-codex/gpt-5.6-sol\":{\"input\":385552,\"output\":15997,\"cacheRead\":4586496,\"cacheWrite\":0,\"turns\":33}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":668749,\"output\":2049,\"cacheRead\":2107392,\"cacheWrite\":0,\"turns\":18}}},\"features\":{\"retire-plan\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8},\"agent-neutral-shell-copy\":{\"input\":521934,\"output\":5180,\"cacheRead\":2783232,\"cacheWrite\":0,\"turns\":40},\"review-exact-red-test-source\":{\"input\":776550,\"output\":17193,\"cacheRead\":5976064,\"cacheWrite\":0,\"turns\":42}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8}},\"agent-neutral-shell-copy\":{\"openai-codex/gpt-5.6-terra\":{\"input\":244183,\"output\":4327,\"cacheRead\":2065408,\"cacheWrite\":0,\"turns\":31},\"openai-codex/gpt-5.6-sol\":{\"input\":277751,\"output\":853,\"cacheRead\":717824,\"cacheWrite\":0,\"turns\":9}},\"review-exact-red-test-source\":{\"openai-codex/gpt-5.6-sol\":{\"input\":776550,\"output\":17193,\"cacheRead\":5976064,\"cacheWrite\":0,\"turns\":42}}}}"
prices: "{}"
timestamp: 2026-07-20T16:46:50.579Z
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
| openai-codex/gpt-5.6-sol | 385552 | 15997 | 4586496 | 0 | 33 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 668749 | 2049 | 2107392 | 0 | 18 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 38403 | 1157 | 217088 | 0 | 8 | — |
| agent-neutral-shell-copy | 521934 | 5180 | 2783232 | 0 | 40 | — |
| review-exact-red-test-source | 776550 | 17193 | 5976064 | 0 | 42 | — |

Total: 1429694 in / 30677 out / 9440768 cache-read / 0 cache-write over 110 turns. Cost unavailable: add every used model rate.
