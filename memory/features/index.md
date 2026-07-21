# Features

* [Teach the bundle to explain its own use](self-describing-bundle-usage.md) - ⬜ pending · medium · Every bundle carries agent-facing usage rules, written at init and drift-checked during consolidate without the dashboard.
* [Reject unusable role models at save time](validate-role-model-on-save.md) - ⬜ pending · medium · Saving a role model that cannot work in the current session is refused with a named reason instead of failing later as a provider 401.
* [Show unusable model choices in settings](flag-unusable-model-fields.md) - ⬜ pending · small · depends: validate-role-model-on-save · The settings model fields visibly mark a value the current session cannot use, and say so when the registry is unavailable.
