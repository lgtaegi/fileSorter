#!/bin/zsh
# fileSorter
# Created: 2026-05-04
# Created by lgtaegi

cd "$(dirname "$0")" || exit 1

echo "Starting File Sorter..."
echo "Your browser should open automatically."
echo "If it does not, use the URL printed below."
echo

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x /usr/local/bin/node ]; then
  NODE_BIN="/usr/local/bin/node"
elif [ -x /opt/homebrew/bin/node ]; then
  NODE_BIN="/opt/homebrew/bin/node"
fi

APP_URL="http://127.0.0.1:5000"

if [ -n "$NODE_BIN" ]; then
  nohup "$NODE_BIN" server.js > file-sorter.log 2>&1 &
  SERVER_PID=$!

  for _ in {1..30}; do
    if curl -sf "$APP_URL" >/dev/null 2>&1; then
      open "$APP_URL"
      wait "$SERVER_PID"
      STATUS=$?
      echo
      echo "File Sorter stopped."
      if [ "$STATUS" -ne 0 ]; then
        echo "Exit code: $STATUS"
        read -k 1 "?Press any key to close..."
      fi
      exit "$STATUS"
    fi
    sleep 1
  done

  echo "Server started in the background, but the browser did not open automatically."
  echo "Open this URL manually: $APP_URL"
  wait "$SERVER_PID"
  STATUS=$?
  echo
  echo "File Sorter stopped."
  if [ "$STATUS" -ne 0 ]; then
    echo "Exit code: $STATUS"
    read -k 1 "?Press any key to close..."
  fi
  exit "$STATUS"
fi

if command -v python3 >/dev/null 2>&1; then
  nohup python3 server.py > file-sorter.log 2>&1 &
  SERVER_PID=$!

  for _ in {1..30}; do
    if curl -sf "$APP_URL" >/dev/null 2>&1; then
      open "$APP_URL"
      wait "$SERVER_PID"
      STATUS=$?
      echo
      echo "File Sorter stopped."
      if [ "$STATUS" -ne 0 ]; then
        echo "Exit code: $STATUS"
        read -k 1 "?Press any key to close..."
      fi
      exit "$STATUS"
    fi
    sleep 1
  done

  echo "Server started in the background, but the browser did not open automatically."
  echo "Open this URL manually: $APP_URL"
  wait "$SERVER_PID"
  STATUS=$?
  echo
  echo "File Sorter stopped."
  if [ "$STATUS" -ne 0 ]; then
    echo "Exit code: $STATUS"
    read -k 1 "?Press any key to close..."
  fi
  exit "$STATUS"
fi

echo "Neither Node nor Python 3 was found."
echo "Install Node.js or Python 3, then double-click this file again."
read -k 1 "?Press any key to close..."
exit 1
