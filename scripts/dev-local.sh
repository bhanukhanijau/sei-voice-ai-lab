#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1; then
  runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
  if [ -x "$runtime/node/bin/node" ]; then
    PATH="$runtime/node/bin:$runtime/bin/fallback:$PATH"
    export PATH
  else
    echo 'Install Node.js 22+ and pnpm 11+, then run pnpm dev.' >&2
    exit 1
  fi
fi
exec pnpm dev
