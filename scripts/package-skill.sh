#!/usr/bin/env bash
# Builds the white-label drop-in: student-support-escalation.zip containing a
# folder with SKILL.md at its root, the layout ChatGPT and Claude skill uploads expect.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=student-support-escalation
TMP=$(mktemp -d)
cp -R skill "$TMP/$NAME"
rm -f "$NAME.zip"
(cd "$TMP" && zip -r "$OLDPWD/$NAME.zip" "$NAME" -x '*.DS_Store' >/dev/null)
rm -rf "$TMP"
echo "Wrote $NAME.zip"
