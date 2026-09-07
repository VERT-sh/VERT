# Image conversion regression tests

Run `bun install --frozen-lockfile`, then `bun run test` (Node.js 20+).

These tests initialize the installed ImageMagick WASM module and invoke the same `magickConvert` function used by the worker. Fixtures are generated in memory. Encoded outputs are decoded again to inspect dimensions, pixels and metadata; no network service or user images are required.

`helpers-load-ts.mjs` transpiles the small TypeScript utility and its relative imports using the existing TypeScript dependency. The test command runs files sequentially to limit WASM memory usage. Application type checking remains a separate `bun run check` command.
