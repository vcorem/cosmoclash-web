#!/bin/bash
# Pack 81 explosion frames into a 9x9 sprite atlas.
# Requires ImageMagick (montage command).
# Usage: ./scripts/pack-atlas.sh

set -euo pipefail

SRC="../turtle_svn/trunk/Turtle/mediaflat/explosion1"
OUT="public/textures/explosion_atlas.png"
COLS=9

# Collect frames in order (0000 through 0080 = 81 frames)
FILES=""
for i in $(seq -w 0 80); do
  f="$SRC/explosion1_00${i}.jpg"
  if [ ! -f "$f" ]; then
    echo "ERROR: missing frame $f" >&2
    exit 1
  fi
  FILES="$FILES $f"
done

mkdir -p "$(dirname "$OUT")"

# Pack into atlas, then add alpha from luminance so dark background is transparent
TEMP_JPG="${OUT%.png}.tmp.jpg"
montage $FILES -tile ${COLS}x -geometry +0+0 -background black "$TEMP_JPG"
magick "$TEMP_JPG" \( +clone -colorspace gray \) -alpha off -compose CopyOpacity -composite "$OUT"
rm -f "$TEMP_JPG"
echo "Created $OUT ($(du -h "$OUT" | cut -f1) )"
