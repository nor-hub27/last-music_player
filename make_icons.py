"""Replaces the Android app icon with assets/icon.png (the sparkle image)."""
import glob
import os
from PIL import Image, ImageDraw

SRC = Image.open("assets/icon.png").convert("RGB")
RES = "android/app/src/main/res"
# density -> (legacy icon size, adaptive foreground size)
SIZES = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216),
         "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}

changed = 0
for density, (legacy, fg) in SIZES.items():
    folder = os.path.join(RES, f"mipmap-{density}")
    if not os.path.isdir(folder):
        continue
    square = SRC.resize((legacy, legacy), Image.LANCZOS)
    square.save(os.path.join(folder, "ic_launcher.png"))
    round_img = Image.new("RGBA", (legacy, legacy), (0, 0, 0, 0))
    mask = Image.new("L", (legacy * 4, legacy * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, legacy * 4 - 1, legacy * 4 - 1), fill=255)
    round_img.paste(square, (0, 0), mask.resize((legacy, legacy), Image.LANCZOS))
    round_img.save(os.path.join(folder, "ic_launcher_round.png"))
    # adaptive icon: image sits in the safe middle area on a transparent canvas
    canvas = Image.new("RGBA", (fg, fg), (0, 0, 0, 0))
    inner = int(fg * 0.66)
    canvas.paste(SRC.resize((inner, inner), Image.LANCZOS), ((fg - inner) // 2, (fg - inner) // 2))
    canvas.save(os.path.join(folder, "ic_launcher_foreground.png"))
    changed += 1

# black background behind the adaptive icon (matches the image's black)
for path in glob.glob(os.path.join(RES, "values", "ic_launcher_background.xml")):
    with open(path, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">#000000</color>\n</resources>\n')
    changed += 1

print(f"Icon updated in {changed} places.")
if not changed:
    print("WARNING: no icon folders found - the default icon will be used.")
