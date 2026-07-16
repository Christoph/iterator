# Issues

- `restart-feature` discards working-tree changes, but under the commit-at-implement
  flow (`commit-feature`) an implemented feature's work is already committed — restart
  silently no-ops on it. Consider guarding: when `resolveFeatureCommits` finds
  implement-kind commits, fail with "feature has implement commits — revert manually".
