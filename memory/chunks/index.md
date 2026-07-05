# Chunks

* [Schema: tests + commits fields](schema-tests-commits.md) - ✅ done · small · New tests/tests_status/commits frontmatter and the index badge format
* [Dev bind host for Docker](expose-bind-host.md) - ✅ done · small · ITERATOR_HOST=0.0.0.0 support; default port becomes 7777
* [Red mode for iterator-test](test-red-mode.md) - ✅ done · medium · depends: schema-tests-commits · Contract-based failing tests for pending chunks, committed + recorded
* [Green gate for iterator-implement](implement-green-gate.md) - ✅ done · medium · depends: schema-tests-commits · Tests as the implementation goal; test badge in the commit-mode UI
* [Review committed chunks](review-committed-diffs.md) - ✅ done · small · depends: schema-tests-commits · Diff from recorded commits / Chunk trailer when the tree is clean
* [Hub dashboard UI](hub-dashboard-ui.md) - ✅ done · medium · depends: schema-tests-commits · skills/iterator server: cards, badges, graph, empty state
* [Hub dispatch skill](hub-dispatch.md) - ✅ done · medium · depends: hub-dashboard-ui, test-red-mode, implement-green-gate, review-committed-diffs · SKILL.md routing actions into the existing flows
* [Docs refresh](docs-refresh.md) - ✅ done · small · depends: hub-dispatch, expose-bind-host · README + ARCHITECTURE for the six-skill flow
