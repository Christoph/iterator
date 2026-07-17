# Pitfalls

Known bugs, portability hazards, and sharp edges.

* [An IPv4-only bind breaks localhost behind a sandbox forward](/pitfalls/ipv4-only-bind-breaks-localhost.md) - A sandbox publishes both v4 and v6 loopback forwards; bound to 0.0.0.0 the v6 one resets, and a reset stops clients falling back — so localhost fails while 127.0.0.1 works.
* [Client JS in view template literals needs double-backslash escapes](/pitfalls/client-js-template-literal-escaping.md) - The views' client scripts live inside backtick template literals, so a single \n is converted to a real newline at module load and breaks the served inline <script>.
* [Explicit cancel must pre-empt pagehide grace](/pitfalls/cancel-now-after-grace-timer.md) - A pending pagehide grace timer must never delay an explicit cancellation request.
