---
type: Chunk
title: Return to Work after closing Settings
description: Make closing the dashboard Settings page restore the Work tab and cover the navigation sequence with a regression test.
status: done
size: medium
depends_on: []
files: ["extensions/iterator.js", "lib/views/settings.mjs", "skills/iterator/lib/views/settings.mjs", "test/session-server.test.mjs", "test/sync.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/package-and-skill-layout, decisions/synced-droppable-skill-libs, setup/development-commands, setup/install-and-command-surface]
timestamp: "2026-07-14T11:00:52.712Z"
tags: []
done: 2026-07-14
---

# Implementation notes

Handle the Settings view’s cancel/close result as an explicit idle-dashboard navigation action that refreshes or restores the Work hub. Keep settings saves on the existing deterministic writer path; update the canonical root implementation only, then run the repository sync so the packaged hub copy remains byte-for-byte identical.

# Snippets

```js
const openSettings = async () => {
  const payload = await gatherPayload(cwd, "settings");
  session.showView({ step: "settings", render: () => VIEWS.settings(payload) });
};
```

```js
function onPrimary(){
  const values = changedValues();
  if(!Object.keys(values).length){ post({ type:'cancel' }, 'Nothing changed'); return; }
  post({ type:'settings', values }, 'Settings saved');
}
```

# Blast radius

Dashboard settings navigation, the idle Work hub refresh path, and the synchronized packaged iterator skill.
