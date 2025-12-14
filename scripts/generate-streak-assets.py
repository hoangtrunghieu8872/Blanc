from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


@dataclass(frozen=True)
class PaletteStop:
    at: float
    color: tuple[int, int, int]


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_color(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(round(lerp(a[0], b[0], t))),
        int(round(lerp(a[1], b[1], t))),
        int(round(lerp(a[2], b[2], t))),
    )


def build_luts(stops: list[PaletteStop], brightness: float = 1.0) -> tuple[list[int], list[int], list[int]]:
    stops_sorted = sorted(stops, key=lambda s: s.at)
    if not stops_sorted:
        raise ValueError("Palette stops cannot be empty")
    if stops_sorted[0].at > 0:
        stops_sorted.insert(0, PaletteStop(0.0, stops_sorted[0].color))
    if stops_sorted[-1].at < 1:
        stops_sorted.append(PaletteStop(1.0, stops_sorted[-1].color))

    lut_r: list[int] = []
    lut_g: list[int] = []
    lut_b: list[int] = []

    for i in range(256):
        x = i / 255
        lo = stops_sorted[0]
        hi = stops_sorted[-1]
        for j in range(len(stops_sorted) - 1):
            if stops_sorted[j].at <= x <= stops_sorted[j + 1].at:
                lo = stops_sorted[j]
                hi = stops_sorted[j + 1]
                break

        span = max(1e-6, hi.at - lo.at)
        t = clamp((x - lo.at) / span, 0.0, 1.0)
        r, g, b = lerp_color(lo.color, hi.color, t)
        r = int(clamp(r * brightness, 0, 255))
        g = int(clamp(g * brightness, 0, 255))
        b = int(clamp(b * brightness, 0, 255))
        lut_r.append(r)
        lut_g.append(g)
        lut_b.append(b)

    return lut_r, lut_g, lut_b


def colorize_gradient(gradient: Image.Image, luts: tuple[list[int], list[int], list[int]]) -> Image.Image:
    r_lut, g_lut, b_lut = luts
    r = gradient.point(r_lut)
    g = gradient.point(g_lut)
    b = gradient.point(b_lut)
    return Image.merge("RGB", (r, g, b)).convert("RGBA")


def alpha_overlay(color: tuple[int, int, int], alpha_mask: Image.Image) -> Image.Image:
    overlay = Image.new("RGBA", alpha_mask.size, (*color, 0))
    overlay.putalpha(alpha_mask)
    return overlay


def draw_flame_mask(size: int, t: float, scale: float = 1.0, y_bias: float = 0.0, x_bias: float = 0.0) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)

    wobble = math.sin(2 * math.pi * t)
    wobble2 = math.sin(2 * math.pi * (t + 0.23))
    wobble3 = math.sin(2 * math.pi * (t + 0.41))

    cx = size * 0.5 + x_bias + (size * 0.018) * wobble2
    base_y = size * 0.68 + y_bias + (size * 0.012) * wobble

    height = size * (0.60 * scale) * (1.0 + 0.06 * wobble)
    width = size * (0.44 * scale) * (1.0 + 0.05 * wobble2)

    # Bottom body
    body_h = height * 0.70
    body_bbox = (
        cx - width / 2,
        base_y - body_h / 2,
        cx + width / 2,
        base_y + body_h / 2,
    )
    draw.ellipse(body_bbox, fill=255)

    # Mid bulge (adds a more organic outline)
    mid_w = width * (0.86 + 0.06 * wobble3)
    mid_h = body_h * 0.78
    mid_y = base_y - body_h * 0.16
    draw.ellipse((cx - mid_w / 2, mid_y - mid_h / 2, cx + mid_w / 2, mid_y + mid_h / 2), fill=255)

    # Tip
    tip_y = base_y - height * (0.58 + 0.02 * wobble2)
    tip_w = width * (0.48 + 0.04 * wobble3)
    tip_h = height * (0.40 + 0.03 * wobble)
    draw.ellipse((cx - tip_w / 2, tip_y - tip_h / 2, cx + tip_w / 2, tip_y + tip_h / 2), fill=255)

    # Bridge (teardrop)
    bridge_y = base_y - body_h * 0.18
    draw.polygon(
        [
            (cx, tip_y - tip_h * 0.44),
            (cx - width * 0.46, bridge_y),
            (cx + width * 0.46, bridge_y),
        ],
        fill=255,
    )

    # Smooth edges and keep a soft falloff
    mask = mask.filter(ImageFilter.GaussianBlur(radius=size * 0.008))
    mask = ImageEnhance.Contrast(mask).enhance(1.15)
    return mask


def render_flame_frame(size: int, out_size: int, t: float) -> Image.Image:
    # Gradients (prebuilt at 256x256, resized here)
    margin = 56
    linear_big = Image.linear_gradient("L").resize((size, size + margin), Image.Resampling.BICUBIC)
    wobble = math.sin(2 * math.pi * t)
    crop_y = int((margin / 2) + 12 * wobble)
    crop_y = int(clamp(crop_y, 0, margin))
    linear = linear_big.crop((0, crop_y, size, crop_y + size))

    edge = Image.radial_gradient("L").resize((size, size), Image.Resampling.BICUBIC)
    center = ImageOps.invert(edge)

    brightness = 1.0 + 0.05 * math.sin(2 * math.pi * (t + 0.08))
    outer_luts = build_luts(
        [
            PaletteStop(0.00, (255, 255, 246)),
            PaletteStop(0.18, (255, 242, 170)),
            PaletteStop(0.48, (255, 176, 50)),
            PaletteStop(0.74, (255, 106, 18)),
            PaletteStop(1.00, (235, 40, 6)),
        ],
        brightness=brightness,
    )
    fill = colorize_gradient(linear, outer_luts)

    # Edge shading + hot center highlight
    shade_alpha = edge.point(lambda v: int(v * 0.18))
    fill = Image.alpha_composite(fill, alpha_overlay((0, 0, 0), shade_alpha))

    highlight = ImageChops.offset(center, int(8 * math.sin(2 * math.pi * (t + 0.17))), int(-18 + 6 * wobble))
    highlight_alpha = highlight.point(lambda v: int(v * 0.36))
    fill = Image.alpha_composite(fill, alpha_overlay((255, 255, 255), highlight_alpha))

    outer_mask = draw_flame_mask(size, t, scale=1.0)
    outer = fill.copy()
    outer.putalpha(outer_mask)

    # Inner core
    inner_mask = draw_flame_mask(size, t, scale=0.62, y_bias=-size * 0.02, x_bias=size * 0.01)
    inner_luts = build_luts(
        [
            PaletteStop(0.00, (255, 255, 255)),
            PaletteStop(0.28, (255, 248, 196)),
            PaletteStop(0.62, (255, 212, 106)),
            PaletteStop(1.00, (255, 150, 40)),
        ],
        brightness=1.0 + 0.03 * math.sin(2 * math.pi * (t + 0.33)),
    )
    inner_fill = colorize_gradient(linear, inner_luts)
    inner_glow = ImageChops.offset(center, 0, int(-26 + 4 * wobble))
    inner_alpha = inner_glow.point(lambda v: int(v * 0.42))
    inner_fill = Image.alpha_composite(inner_fill, alpha_overlay((255, 255, 255), inner_alpha))
    inner_fill.putalpha(inner_mask)

    composed = Image.alpha_composite(outer, inner_fill)

    # Glow
    glow = composed.filter(ImageFilter.GaussianBlur(radius=size * 0.02))
    glow = ImageEnhance.Brightness(glow).enhance(1.15)
    glow_alpha = glow.getchannel("A").point(lambda v: int(v * 0.70))
    glow.putalpha(glow_alpha)
    composed = Image.alpha_composite(glow, composed)

    # Tiny ember flicker near the tip
    ember = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ed = ImageDraw.Draw(ember)
    ember_on = 0.45 + 0.55 * math.sin(2 * math.pi * (t + 0.52))
    if ember_on > 0.55:
        ex = size * 0.5 + (size * 0.05) * math.sin(2 * math.pi * (t + 0.12))
        ey = size * 0.22 + (size * 0.03) * math.sin(2 * math.pi * (t + 0.64))
        r = size * 0.018 * (0.9 + 0.4 * ember_on)
        ed.ellipse((ex - r, ey - r, ex + r, ey + r), fill=(255, 255, 255, int(140 * ember_on)))
        ember = ember.filter(ImageFilter.GaussianBlur(radius=size * 0.006))
        composed = Image.alpha_composite(composed, ember)

    # Downscale + subtle sharpen
    out = composed.resize((out_size, out_size), Image.Resampling.LANCZOS)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=160, threshold=2))
    return out


def star_points(cx: float, cy: float, r_outer: float, r_inner: float, points: int, rotation: float) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    step = math.pi / points
    for i in range(points * 2):
        r = r_outer if i % 2 == 0 else r_inner
        angle = rotation + i * step
        pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return pts


def render_star_frame(size: int, out_size: int, t: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * t)
    pulse2 = 0.5 + 0.5 * math.sin(2 * math.pi * (t + 0.27))
    rotation = (math.pi / 10) * math.sin(2 * math.pi * (t + 0.10))
    scale = 0.92 + 0.10 * pulse

    cx = size * 0.5
    cy = size * 0.5

    outer = size * 0.25 * scale
    inner = size * 0.10 * scale
    main_pts = star_points(cx, cy, outer, inner, points=4, rotation=rotation)
    draw.polygon(main_pts, fill=(255, 220, 80, 240))

    core_pts = star_points(cx, cy, outer * 0.58, inner * 0.44, points=4, rotation=rotation)
    draw.polygon(core_pts, fill=(255, 255, 255, int(150 + 60 * pulse2)))

    # Cross streaks
    streak_len = outer * (0.95 + 0.18 * pulse)
    streak_w = max(2, int(size * 0.010))
    draw.line((cx - streak_len, cy, cx + streak_len, cy), fill=(255, 255, 255, int(90 + 80 * pulse2)), width=streak_w)
    draw.line((cx, cy - streak_len, cx, cy + streak_len), fill=(255, 255, 255, int(80 + 70 * pulse)), width=streak_w)

    # Tiny twinkles
    tx = cx + size * 0.20
    ty = cy - size * 0.18
    tw_outer = size * 0.085 * (0.85 + 0.22 * (1 - pulse))
    tw_inner = size * 0.030 * (0.85 + 0.22 * (1 - pulse))
    draw.polygon(star_points(tx, ty, tw_outer, tw_inner, points=4, rotation=-rotation * 1.3), fill=(255, 255, 255, int(90 + 80 * pulse)))

    bx = cx - size * 0.20
    by = cy + size * 0.18
    bw_outer = size * 0.060 * (0.90 + 0.25 * pulse2)
    bw_inner = size * 0.022 * (0.90 + 0.25 * pulse2)
    draw.polygon(star_points(bx, by, bw_outer, bw_inner, points=4, rotation=rotation * 1.1), fill=(255, 255, 255, int(60 + 70 * pulse2)))

    # Glow
    glow = img.filter(ImageFilter.GaussianBlur(radius=size * 0.018))
    glow = ImageEnhance.Brightness(glow).enhance(1.12)
    glow_alpha = glow.getchannel("A").point(lambda v: int(v * 0.80))
    glow.putalpha(glow_alpha)
    img = Image.alpha_composite(glow, img)

    out = img.resize((out_size, out_size), Image.Resampling.LANCZOS)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.0, percent=140, threshold=2))
    return out


def rgba_to_gif_frame(img: Image.Image, alpha_threshold: int = 8, colors: int = 128) -> Image.Image:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")

    pal = rgba.convert(
        "P",
        palette=Image.Palette.ADAPTIVE,
        colors=colors,
        dither=Image.Dither.NONE,
    )

    transparent = Image.eval(alpha, lambda a: 255 if a <= alpha_threshold else 0)
    pal.paste(0, transparent)
    pal.info["transparency"] = 0
    return pal


def main() -> None:
    out_dir = Path("public") / "streak"
    out_dir.mkdir(parents=True, exist_ok=True)

    out_size = 64
    size = 320
    frames = 24

    flame_rgba = [render_flame_frame(size, out_size, i / frames) for i in range(frames)]
    star_rgba = [render_star_frame(size, out_size, i / frames) for i in range(frames)]

    # PNG fallbacks
    flame_rgba[0].save(out_dir / "flame.png")
    star_rgba[0].save(out_dir / "star.png")

    # GIFs
    flame_gif = [rgba_to_gif_frame(f, colors=96) for f in flame_rgba]
    star_gif = [rgba_to_gif_frame(f, colors=96) for f in star_rgba]

    flame_gif[0].save(
        out_dir / "flame.gif",
        save_all=True,
        append_images=flame_gif[1:],
        loop=0,
        duration=50,
        disposal=2,
        optimize=True,
        transparency=0,
    )

    star_gif[0].save(
        out_dir / "star.gif",
        save_all=True,
        append_images=star_gif[1:],
        loop=0,
        duration=55,
        disposal=2,
        optimize=True,
        transparency=0,
    )

    print("Wrote:", out_dir / "flame.gif", out_dir / "star.gif")


if __name__ == "__main__":
    main()

