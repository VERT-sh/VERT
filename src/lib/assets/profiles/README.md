# Bundled color profile

`srgb.ts` embeds the unmodified 480-byte `sRGB-v4.icc` profile as Base64. It is used by Little CMS inside ImageMagick to convert profiled pixels to standard sRGB before removing metadata. No network request is needed.

Source: [Compact-ICC-Profiles](https://github.com/saucecontrol/Compact-ICC-Profiles/tree/bdd84663061bc4ae95ca70decff54f581e27f702), commit `bdd84663061bc4ae95ca70decff54f581e27f702`, `profiles/sRGB-v4.icc`.

License: [CC0-1.0](LICENSE.txt).

SHA-256: `c56e1685d888f5edb92fe07f2750f387f8fe8e91b32ff8fb0b56bfbbb9458353`.

The test fixture `tests/fixtures/display-p3.icc` is the unmodified 480-byte `profiles/DisplayP3-v4.icc` from the same source and license. SHA-256: `cb51de38e482ee974c0c76b9689e16aad04bad16e226fed2f30c842d15ff3a3d`.
