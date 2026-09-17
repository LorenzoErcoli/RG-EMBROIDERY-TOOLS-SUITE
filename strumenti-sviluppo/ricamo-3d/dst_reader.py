"""Lettore DST minimale (Tajima). Unità: 0.1 mm. Nessuna dipendenza."""
def read_dst(path):
    data = open(path, 'rb').read()
    header = data[:512].decode('latin-1')
    recs = data[512:]
    x = y = 0
    out = []  # (x_mm, y_mm, tipo) tipo: 'stitch'|'jump'|'color'|'end'
    for i in range(0, len(recs) - 2, 3):
        b0, b1, b2 = recs[i], recs[i+1], recs[i+2]
        if b2 & 0xF3 == 0xF3:
            out.append((x/10, y/10, 'end')); break
        dx = dy = 0
        if b0 & 0x01: dx += 1
        if b0 & 0x02: dx -= 1
        if b0 & 0x04: dx += 9
        if b0 & 0x08: dx -= 9
        if b0 & 0x80: dy += 1
        if b0 & 0x40: dy -= 1
        if b0 & 0x20: dy += 9
        if b0 & 0x10: dy -= 9
        if b1 & 0x01: dx += 3
        if b1 & 0x02: dx -= 3
        if b1 & 0x04: dx += 27
        if b1 & 0x08: dx -= 27
        if b1 & 0x80: dy += 3
        if b1 & 0x40: dy -= 3
        if b1 & 0x20: dy += 27
        if b1 & 0x10: dy -= 27
        if b2 & 0x04: dx += 81
        if b2 & 0x08: dx -= 81
        if b2 & 0x20: dy += 81
        if b2 & 0x10: dy -= 81
        x += dx; y += dy
        if b2 & 0xC0 == 0xC0: t = 'color'
        elif b2 & 0x80: t = 'jump'
        else: t = 'stitch'
        out.append((x/10, y/10, t))
    return header, out
