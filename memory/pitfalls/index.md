# Pitfalls

Known bugs, portability hazards, and sharp edges.

* [Client JS in view template literals needs double-backslash escapes](/pitfalls/client-js-template-literal-escaping.md) - The views' client scripts live inside backtick template literals, so a single \n is converted to a real newline at module load and breaks the served inline <script>.
* [Immediate cancel can be masked by a pending grace timer](/pitfalls/cancel-now-after-grace-timer.md) - The servers' /cancel handlers return early when a cancel grace timer exists, so a later ?now=1 cancel may not pre-empt it.
