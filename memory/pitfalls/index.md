# Pitfalls

Known bugs, portability hazards, and sharp edges.

* [Immediate cancel can be masked by a pending grace timer](/pitfalls/cancel-now-after-grace-timer.md) - The servers' /cancel handlers return early when a cancel grace timer exists, so a later ?now=1 cancel may not pre-empt it.
