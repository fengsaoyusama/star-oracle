"""生成 1200x630 的社交分享封面（OG image）"""
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
OUT = "preview/og-cover.png"

FONT_MSYH = "C:/Windows/Fonts/msyh.ttc"
FONT_MSYH_BD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_SYMBOL = "C:/Windows/Fonts/seguisym.ttf"
GOLD = (242, 207, 141)
INK = (246, 242, 255)
MUTED = (169, 162, 199)
FAINT = (111, 106, 143)
SYMBOLS = "♈♉♊♋♌♍♎♏♐♑♒♓"


def gradient_bg():
    y = np.linspace(0, 1, H)[:, None]
    top = np.array([8, 6, 22], dtype=float)
    mid = np.array([16, 12, 38], dtype=float)
    bottom = np.array([10, 8, 26], dtype=float)
    rows = np.where(y < 0.55, top + (mid - top) * (y / 0.55), mid + (bottom - mid) * ((y - 0.55) / 0.45))
    img = np.repeat(rows[:, None, :], W, axis=1)

    xs, ys = np.meshgrid(np.arange(W), np.arange(H))
    violet = np.exp(-(((xs - 950) ** 2) / (2 * 330 ** 2) + ((ys - 60) ** 2) / (2 * 260 ** 2)))
    rose = np.exp(-(((xs - 150) ** 2) / (2 * 300 ** 2) + ((ys - 620) ** 2) / (2 * 260 ** 2)))
    goldg = np.exp(-(((xs - 640) ** 2) / (2 * 280 ** 2) + ((ys - 340) ** 2) / (2 * 200 ** 2)))
    img += violet[:, :, None] * np.array([124, 86, 255]) * 0.24
    img += rose[:, :, None] * np.array([255, 138, 190]) * 0.10
    img += goldg[:, :, None] * np.array([242, 207, 141]) * 0.05
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")


def draw_stars(draw, rng):
    for _ in range(160):
        x, y = rng.randint(0, W), rng.randint(0, H)
        r = rng.uniform(0.4, 1.6)
        a = int(rng.uniform(35, 170))
        color = (242, 207, 141, a) if rng.random() < 0.22 else (226, 232, 255, a)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def draw_sparkle(draw, cx, cy, size, color):
    draw.line((cx - size, cy, cx + size, cy), fill=color, width=1)
    draw.line((cx, cy - size, cx, cy + size), fill=color, width=1)


def draw_wheel(img):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    cx, cy = 965, 322
    r_outer, r_sign = 178, 148
    gold_soft = (242, 207, 141, 60)
    white_soft = (255, 255, 255, 42)
    d.ellipse((cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer), outline=tuple(gold_soft), width=1)
    d.ellipse((cx - r_sign, cy - r_sign, cx + r_sign, cy + r_sign), outline=white_soft, width=1)
    d.ellipse((cx - 92, cy - 92, cx + 92, cy + 92), outline=(242, 207, 141, 40), width=1)
    glyph_font = ImageFont.truetype(FONT_SYMBOL, 26)
    for i in range(12):
        angle = math.radians(-90 + i * 30)
        mid = math.radians(-90 + i * 30 + 15)
        x1, y1 = cx + (r_sign - 22) * math.cos(angle), cy + (r_sign - 22) * math.sin(angle)
        x2, y2 = cx + (r_outer + 16) * math.cos(angle), cy + (r_outer + 16) * math.sin(angle)
        d.line((x1, y1, x2, y2), fill=(255, 255, 255, 26), width=1)
        gx, gy = cx + (r_outer + 42) * math.cos(mid), cy + (r_outer + 42) * math.sin(mid)
        d.text((gx, gy), SYMBOLS[i], font=glyph_font, fill=(242, 207, 141, 210), anchor="mm")
    # 太阳 / 月亮
    d.ellipse((cx - 46, cy - 30, cx - 34, cy - 18), fill=(242, 207, 141, 255))
    d.ellipse((cx + 30, cy + 40, cx + 42, cy + 52), fill=(188, 212, 255, 235))
    # 中心上升符号
    center_font = ImageFont.truetype(FONT_SYMBOL, 34)
    d.text((cx, cy - 4), "♎", font=center_font, fill=(242, 207, 141, 255), anchor="mm")
    center_cn = ImageFont.truetype(FONT_MSYH, 14)
    d.text((cx, cy + 32), "今日星象", font=center_cn, fill=(169, 162, 199, 230), anchor="mm")

    img.alpha_composite(overlay)


def main():
    rng = random.Random(20261018)
    img = gradient_bg().convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_stars(ImageDraw.Draw(overlay), rng)
    for _ in range(6):
        draw_sparkle(ImageDraw.Draw(overlay), rng.randint(40, W - 40), rng.randint(40, H - 40),
                     rng.uniform(4, 9), (242, 207, 141, rng.randint(50, 110)))
    img.alpha_composite(overlay)

    draw_wheel(img)
    d = ImageDraw.Draw(img)

    brand_font = ImageFont.truetype(FONT_MSYH_BD, 26)
    brand_en = ImageFont.truetype(FONT_MSYH, 12)
    draw_sparkle(d, 82, 68, 9, GOLD + (255,))
    d.text((104, 54), "星屿占卜馆", font=brand_font, fill=GOLD)
    d.text((72, 92), "S T A R   I S L E   O R A C L E", font=brand_en, fill=FAINT)

    title_font = ImageFont.truetype(FONT_MSYH_BD, 62)
    d.text((70, 168), "把今晚的星星", font=title_font, fill=INK)
    d.text((70, 252), "装进你的口袋", font=title_font, fill=GOLD)

    line_font = ImageFont.truetype(FONT_MSYH, 23)
    d.text((72, 366), "每日运势 · 爱情桃花 · 财运分析", font=line_font, fill=MUTED)
    d.text((72, 404), "双人配对 · 简易星盘 · 今日星签", font=line_font, fill=MUTED)

    d.line((72, 456, 640, 456), fill=(242, 207, 141, 90), width=1)

    tag_font = ImageFont.truetype(FONT_MSYH, 19)
    d.text((72, 484), "输入生日，看看星星想对你说什么。", font=tag_font, fill=MUTED)
    d.text((72, 560), "12 星座 / 365 天星签 / 离线也能玩", font=ImageFont.truetype(FONT_MSYH, 16), fill=FAINT)

    img.convert("RGB").save(OUT, quality=92)
    print("saved", OUT, img.size)


if __name__ == "__main__":
    main()
