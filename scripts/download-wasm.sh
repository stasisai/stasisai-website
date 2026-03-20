#!/usr/bin/env bash
# Download the latest WASM artifacts from the simulator repo.
# Works in both local (gh CLI) and Vercel build environments (curl fallback).
# Usage: ./scripts/download-wasm.sh [tag]
# If no tag is given, downloads the latest release.

set -euo pipefail

REPO="stasis-industry/mafis"
DEST="public/sim"
TAG="${1:-latest}"

echo "Downloading WASM artifacts from $REPO ($TAG)..."

if [ "$TAG" = "latest" ]; then
  URL="https://api.github.com/repos/${REPO}/releases/latest"
  DOWNLOAD_URL=$(curl -sL "$URL" | grep -o '"browser_download_url":\s*"[^"]*mafis-wasm\.tar\.gz"' | cut -d'"' -f4)
  if [ -z "$DOWNLOAD_URL" ]; then
    echo "No release found — skipping WASM download."
    exit 0
  fi
else
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/mafis-wasm.tar.gz"
fi

curl -sL "$DOWNLOAD_URL" -o /tmp/mafis-wasm.tar.gz

mkdir -p "$DEST"
tar -xzf /tmp/mafis-wasm.tar.gz -C "$DEST"
rm /tmp/mafis-wasm.tar.gz

echo "WASM artifacts extracted to $DEST/"
ls -lh "$DEST/"
