---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-sol\":{\"input\":92807,\"output\":7147,\"cacheRead\":464384,\"cacheWrite\":0,\"turns\":20}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":244183,\"output\":4327,\"cacheRead\":2065408,\"cacheWrite\":0,\"turns\":31},\"openai-codex/gpt-5.6-sol\":{\"input\":676460,\"output\":21230,\"cacheRead\":9467904,\"cacheWrite\":0,\"turns\":55}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":972933,\"output\":4144,\"cacheRead\":6138880,\"cacheWrite\":0,\"turns\":34}}},\"features\":{\"retire-plan\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8},\"agent-neutral-shell-copy\":{\"input\":521934,\"output\":5180,\"cacheRead\":2783232,\"cacheWrite\":0,\"turns\":40},\"review-exact-red-test-source\":{\"input\":776550,\"output\":17193,\"cacheRead\":5976064,\"cacheWrite\":0,\"turns\":42},\"agent-neutral-workflow-copy\":{\"input\":550135,\"output\":5764,\"cacheRead\":6710272,\"cacheWrite\":0,\"turns\":30}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":38403,\"output\":1157,\"cacheRead\":217088,\"cacheWrite\":0,\"turns\":8}},\"agent-neutral-shell-copy\":{\"openai-codex/gpt-5.6-terra\":{\"input\":244183,\"output\":4327,\"cacheRead\":2065408,\"cacheWrite\":0,\"turns\":31},\"openai-codex/gpt-5.6-sol\":{\"input\":277751,\"output\":853,\"cacheRead\":717824,\"cacheWrite\":0,\"turns\":9}},\"review-exact-red-test-source\":{\"openai-codex/gpt-5.6-sol\":{\"input\":776550,\"output\":17193,\"cacheRead\":5976064,\"cacheWrite\":0,\"turns\":42}},\"agent-neutral-workflow-copy\":{\"openai-codex/gpt-5.6-sol\":{\"input\":550135,\"output\":5764,\"cacheRead\":6710272,\"cacheWrite\":0,\"turns\":30}}}}"
prices: "{}"
timestamp: 2026-07-20T16:52:25.238Z
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
| openai-codex/gpt-5.6-sol | 676460 | 21230 | 9467904 | 0 | 55 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 972933 | 4144 | 6138880 | 0 | 34 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 38403 | 1157 | 217088 | 0 | 8 | — |
| agent-neutral-shell-copy | 521934 | 5180 | 2783232 | 0 | 40 | — |
| review-exact-red-test-source | 776550 | 17193 | 5976064 | 0 | 42 | — |
| agent-neutral-workflow-copy | 550135 | 5764 | 6710272 | 0 | 30 | — |

Total: 2024786 in / 38005 out / 18353664 cache-read / 0 cache-write over 148 turns. Cost unavailable: add every used model rate.
