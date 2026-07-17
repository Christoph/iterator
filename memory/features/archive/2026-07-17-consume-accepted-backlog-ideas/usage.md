---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":4812,\"output\":587,\"cacheRead\":46080,\"cacheWrite\":0,\"turns\":4}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":49508,\"output\":2430,\"cacheRead\":403456,\"cacheWrite\":0,\"turns\":17}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":183090,\"output\":5424,\"cacheRead\":1828352,\"cacheWrite\":0,\"turns\":28}}},\"features\":{\"retire-plan\":{\"input\":4812,\"output\":587,\"cacheRead\":46080,\"cacheWrite\":0,\"turns\":4},\"consume-accepted-backlog-ideas\":{\"input\":183090,\"output\":5424,\"cacheRead\":1828352,\"cacheWrite\":0,\"turns\":28}}}"
timestamp: 2026-07-17T13:53:55.128Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 4812 | 587 | 46080 | 0 | 4 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 49508 | 2430 | 403456 | 0 | 17 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 183090 | 5424 | 1828352 | 0 | 28 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 4812 | 587 | 46080 | 0 | 4 |
| consume-accepted-backlog-ideas | 183090 | 5424 | 1828352 | 0 | 28 |

Total: 237410 in / 8441 out / 2277888 cache-read / 0 cache-write over 49 turns.
