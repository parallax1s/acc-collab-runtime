#!/usr/bin/env bash
set -euo pipefail

script_dir() {
  cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

repo_root() {
  local dir
  dir="$(script_dir)"
  cd -P "${dir}/../../.." && pwd
}

resolve_acc_target() {
  if [[ -n "${ACC_CLI:-}" ]]; then
    if [[ "$ACC_CLI" == "acc" ]]; then
      echo "acc"
      return
    fi
    if [[ -f "$ACC_CLI" ]]; then
      echo "node::$ACC_CLI"
      return
    fi
    if command -v "$ACC_CLI" >/dev/null 2>&1; then
      echo "$ACC_CLI"
      return
    fi
    echo "ACC_CLI is set but not resolvable: $ACC_CLI" >&2
    exit 1
  fi

  local root
  root="$(repo_root)"

  if [[ -x "$root/bin/acc" ]]; then
    echo "$root/bin/acc"
    return
  fi

  if [[ -f "$root/acc/bin/acc.js" ]]; then
    echo "node::$root/acc/bin/acc.js"
    return
  fi

  if command -v acc >/dev/null 2>&1; then
    echo "acc"
    return
  fi

  local dir="$PWD"
  while :; do
    if [[ -f "$dir/acc/bin/acc.js" ]]; then
      echo "node::$dir/acc/bin/acc.js"
      return
    fi
    if [[ "$dir" == "/" ]]; then
      break
    fi
    dir="$(dirname "$dir")"
  done

  echo "Could not locate acc CLI. Use the bundled repo copy, install acc on PATH, or set ACC_CLI=/absolute/path/to/acc/bin/acc.js" >&2
  exit 1
}

target="$(resolve_acc_target)"
if [[ "$target" == node::* ]]; then
  node "${target#node::}" "$@"
else
  "$target" "$@"
fi
