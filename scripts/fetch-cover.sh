#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: $0 <url> <output-path> [max-width] [quality]" >&2
  echo "example: $0 https://example.com/photo.jpg content/articles/x/y/cover.jpg 1600 82" >&2
  exit 1
fi

URL="$1"
OUT="$2"
WIDTH="${3:-1600}"
QUALITY="${4:-82}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "downloading: $URL"
curl -sSL --max-time 60 -A "Mozilla/5.0" "$URL" -o "$TMP/src"

SRC="$TMP/src"
if ! file "$SRC" | grep -qiE 'image|jpeg|png|gif|webp'; then
  echo "error: downloaded file is not an image" >&2
  file "$SRC" >&2
  exit 1
fi

ORIG_SIZE=$(stat -f%z "$SRC" 2>/dev/null || stat -c%s "$SRC")
echo "original size: $((ORIG_SIZE / 1024)) KB"

sips -Z "$WIDTH" "$SRC" --out "$TMP/resized" >/dev/null 2>&1

EXT="${OUT##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')
case "$EXT_LOWER" in
  jpg|jpeg) FORMAT=jpeg ;;
  png)      FORMAT=png ;;
  *)        FORMAT=jpeg; OUT="${OUT%.*}.jpg" ;;
esac

mkdir -p "$(dirname "$OUT")"
sips -s format "$FORMAT" -s formatOptions "$QUALITY" "$TMP/resized" --out "$OUT" >/dev/null 2>&1

NEW_SIZE=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
echo "output: $OUT"
echo "final size: $((NEW_SIZE / 1024)) KB"
