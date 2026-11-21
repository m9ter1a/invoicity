#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(uname -sm)" == "Darwin arm64" ]] || { echo "Для этой сборки требуется macOS arm64."; exit 1; }
mkdir -p vendor/llama vendor/models
model=vendor/models/nemotron.gguf
sha=be5d9a656a51922f24f1f09a759cebb694e1f5d9728bf0ef9f8c972c5a0b5ef2
revision=ba223d14e45525f7fae81db77ea8cabeb2fc6c25
if [[ ! -f "$model" ]]; then
  curl --fail --location --retry 3 --continue-at - "https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF/resolve/$revision/NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf" -o "$model.part"
  echo "$sha  $model.part" | shasum -a 256 -c -
  mv "$model.part" "$model"
else
  echo "$sha  $model" | shasum -a 256 -c -
fi
if [[ ! -x vendor/llama/llama-server || ! -f vendor/llama/.b12611 ]]; then
  archive="$(mktemp -t invoicity-llama)"
  trap 'rm -f "$archive"' EXIT
  curl -fL --retry 2 https://github.com/ggml-org/llama.cpp/releases/download/b12611/llama-b12611-bin-macos-arm64.tar.gz -o "$archive"
  echo "4b9067216c4f06961c3d13426bfa045d7ce68ca3237d3c77a87f575d88482fee  $archive" | shasum -a 256 -c -
  tar -xzf "$archive" --strip-components=1 -C vendor/llama
  touch vendor/llama/.b12611
fi
if [[ ! -s vendor/models/NVIDIA-License.pdf ]]; then
  curl -fL https://www.nvidia.com/content/dam/en-zz/Solutions/license-agreements/enterprise-software/NVIDIA-Nemotron-Open-Model-License-12-12-25.pdf -o vendor/models/NVIDIA-License.pdf
fi
swiftc -O scripts/extract.swift -o vendor/extract

