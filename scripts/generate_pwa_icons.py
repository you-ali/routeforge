#!/usr/bin/env python3
"""Generate PWA PNG icons (stdlib only). Run: python3 scripts/generate_pwa_icons.py"""
import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "docs" / "icons"
BG = (10, 10, 10)
FG = (255, 255, 255)


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def _write_png(path: Path, width: int, height: int, get_rgb) -> None:
    """get_rgb(x, y) -> (r,g,b) for 0 <= x < width, 0 <= y < height."""
    rows = []
    for y in range(height):
        row = b"\x00"
        for x in range(width):
            r, g, b = get_rgb(x, y)
            row += bytes((r, g, b))
        rows.append(row)
    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack(">2I5B", width, height, 8, 2, 0, 0, 0)
    buf = b"\x89PNG\r\n\x1a\n"
    buf += _png_chunk(b"IHDR", ihdr)
    buf += _png_chunk(b"IDAT", compressed)
    buf += _png_chunk(b"IEND", b"")
    path.write_bytes(buf)


def _icon_pixels(size: int, x: int, y: int) -> tuple[int, int, int]:
    if not (0 <= x < size and 0 <= y < size):
        return BG
    u, v = x / size, y / size
    pad = 0.2
    if 0.22 <= u <= 0.36 and pad <= v <= 1.0 - pad:
        return FG
    cx, cy = 0.46, 0.34
    dx, dy = u - cx, v - cy
    r = math.hypot(dx, dy)
    if 0.27 <= r <= 0.43:
        ang = (math.degrees(math.atan2(dy, dx)) + 360) % 360
        if 195 <= ang <= 335:
            return FG
    return BG


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("icon-180.png", 180)]:
        _write_png(ROOT / name, size, size, lambda x, y, s=size: _icon_pixels(s, x, y))
    print("Wrote:", *[p.name for p in sorted(ROOT.glob("icon-*.png"))])


if __name__ == "__main__":
    main()
