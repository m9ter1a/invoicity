#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p vendor/models
revision=72e986006ef53e37cdd3f6d4241c90b0f01df376
fetch_model() {
  local filename="$1" checksum="$2" dest="vendor/models/$1"
  if [[ ! -f "$dest" ]]; then
    curl -fsSL --retry 3 --continue-at - "https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/$revision/$filename?download=true" -o "$dest.part"
    echo "$checksum  $dest.part" | shasum -a 256 -c -
    mv "$dest.part" "$dest"
  else
    echo "$checksum  $dest" | shasum -a 256 -c -
  fi
}
fetch_model SmolVLM-500M-Instruct-Q8_0.gguf 9d4612de6a42214499e301494a3ecc2be0abdd9de44e663bda63f1152fad1bf4
fetch_model mmproj-SmolVLM-500M-Instruct-Q8_0.gguf d1eb8b6b23979205fdf63703ed10f788131a3f812c7b1f72e0119d5d81295150
if [[ ! -s vendor/models/SmolVLM-LICENSE.txt ]]; then
  curl -fsSL --retry 3 https://www.apache.org/licenses/LICENSE-2.0.txt -o vendor/models/SmolVLM-LICENSE.txt
fi
