#!/bin/bash

OUT_DIR="./ssl"
KEY_OUT="$OUT_DIR/self-signed.key"
CRT_OUT="$OUT_DIR/self-signed.crt"

if ! which openssl > /dev/null 2>&1; then
    echo "Could not find openssl in your PATH. Exiting."
    exit 1
fi

mkdir -p "$OUT_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_OUT" \
    -out "$CRT_OUT"

chmod 600 "$KEY_OUT" \
    "$CRT_OUT"

echo "Finished generating self-signed certificate."