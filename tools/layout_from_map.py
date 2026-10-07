# Разметка мира по спутниковой карте (карта — только СПРАВКА о планировке, в игру она не попадает).
# Вход: картинка карты (скриншот спутника Яндекса, 1280×768).  Выход: data/layout/roads.json, data/layout/zones.png
#   roads.json — дороги в метрах игрового мира (x — восток, z — юг), с типом main / street / lane;
#   zones.png  — зоны 2 м/пиксель на всю карту 2000×2000 м: R — застройка (плотность домов), G — лес, B — голый грунт (размытые террасы).
# Привязка карты к миру найдена автоматически: края террас на спутнике совпадают с горизонталями
# реального рельефа (data/terrain/heights.json) при масштабе 1.76 м/пиксель и сдвиге (120, 160) м.
#   запуск:  python3 tools/layout_from_map.py путь/к/карте.webp
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import skeletonize
from skimage.measure import approximate_polygon

S, DX, DZ, PX, PY = 1.76, 120.0, 160.0, 785, 531        # привязка
W2M = lambda px, py: ((px - PX) * S + DX, (py - PY) * S + DZ)
img = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int)
Hh, Ww = img.shape[:2]
R, G, B = img[..., 0], img[..., 1], img[..., 2]
mx, mn = img.max(-1), img.min(-1); lum = img.mean(-1)

# ---------- дороги ----------
# 1) главные дороги — обведены по карте вручную (пиксели карты), чтобы изгибы были точными
MANUAL = {
 'main': [
  # дорога с севера по долине реки Дарголакотты, через всё село, на юг
  [(430,0),(462,30),(478,60),(487,95),(494,135),(499,180),(504,230),(511,280),(522,330),(548,365),(585,392),(615,415),(640,440),(655,470),(664,505),(678,535),(700,560),(718,585),(735,615),(750,645),(765,680),(782,715),(797,745),(805,768)],
  # дорога на восток по склону
  [(660,590),(720,592),(780,598),(850,600),(890,600),(910,618),(925,645),(945,665),(1000,645),(1040,642),(1080,630),(1110,615),(1170,605),(1215,600),(1280,605)],
  # дорога на запад и серпантин вниз
  [(640,575),(600,568),(560,560),(520,556),(497,562),(478,575),(465,595),(445,608),(430,604),(440,615),(452,640),(448,665),(425,690),(398,712),(372,740),(345,768)],
  # северо-восточная дорога с петлёй над лесом
  [(560,262),(605,245),(650,232),(700,228),(745,238),(765,262),(775,292),(820,290),(860,283),(895,272),(908,278),(890,292),(850,302),(800,312),(772,322),(757,350),(742,388),(722,418),(702,447),(690,475)],
 ],
 'street': [
  [(395,200),(430,195),(455,195),(480,180)], [(445,185),(462,218),(480,252),(500,285)],
  [(700,560),(760,563),(810,556),(860,550),(900,546)], [(515,560),(545,575),(575,598),(585,625),(575,660),(570,695),(585,725),(610,735)],
  [(650,590),(655,620),(662,650),(670,680)], [(740,610),(790,620),(820,640),(850,650)],
 ],
}
lines = [{'kind': k, 'pts': [[round(v, 1) for v in W2M(x, y)] for x, y in pl]} for k, pls in MANUAL.items() for pl in pls]

# 2) улицы и переулки внутри села — найдены автоматически: серые тонкие вытянутые линии → «скелет» → ломаные
road = (mx - mn < 20) & (mn > 100) & (mx < 225) & (B >= R - 6)
road = ndi.binary_closing(road, np.ones((3, 3)))
lab, n = ndi.label(road); keep = np.zeros_like(road)
for i, sl in enumerate(ndi.find_objects(lab), 1):
    comp = lab[sl] == i; area = comp.sum()
    if area < 60: continue
    sk = skeletonize(comp).sum()
    if area / max(sk, 1) < 7.5 and sk > 25: keep[sl] |= comp
keep = ndi.binary_closing(keep, np.ones((5, 5)))
sk = skeletonize(keep)
# не дублировать главные дороги: стираем скелет рядом с ними
manual_mask = np.zeros_like(sk)
from PIL import ImageDraw
mm = Image.new('L', (Ww, Hh), 0); d = ImageDraw.Draw(mm)
for pls in MANUAL.values():
    for pl in pls: d.line(pl, fill=255, width=14)
sk &= ~(np.array(mm) > 0)
# трассировка скелета в ломаные
pts = set(zip(*np.nonzero(sk)))
nb = lambda p: [(p[0] + a, p[1] + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b) and (p[0] + a, p[1] + b) in pts]
seen, polys = set(), []
ends = [p for p in pts if len(nb(p)) != 2]
for start in ends + list(pts):
    if start in seen: continue
    for first in nb(start):
        if (start, first) in seen or first in seen and len(nb(first)) == 2: continue
        path = [start]; prev, cur = start, first
        while True:
            path.append(cur); seen.add(cur)
            if len(nb(cur)) != 2: break
            nxt = [q for q in nb(cur) if q != prev]
            if not nxt or nxt[0] in seen and nxt[0] != start: break
            prev, cur = cur, nxt[0]
            if cur == start: path.append(cur); break
        seen.add(start)
        if len(path) >= 12: polys.append(path)
for pl in polys:
    a = approximate_polygon(np.array(pl, float), 1.2)
    lines.append({'kind': 'lane', 'pts': [[round(v, 1) for v in W2M(x, y)] for y, x in a]})

# ---------- зоны ----------
veg = (G > R + 4) & (G > B + 2)
# лес: тёмные крупные пятна
forest = (lum < 60) & (G >= R - 2)
forest = ndi.binary_opening(forest, np.ones((6, 6)))          # тонкие тени террас отсекаются, остаются широкие массивы
lab, n = ndi.label(forest); sizes = ndi.sum(forest, lab, range(1, n + 1))
forest = np.isin(lab, np.where(sizes > 900)[0] + 1)
forest = ndi.binary_dilation(forest, np.ones((3, 3)))
# голый грунт: светлые бежевые полосы (размытые края террас, осыпи)
bare = (lum > 135) & (R > B + 8) & ~keep
bare = ndi.binary_opening(bare, np.ones((2, 2)))
# застройка: в радиусе ~20 м от улиц и не трава/лес, с пёстрыми крышами
roofs = ((R > G + 25) | (B > R + 10) | ((lum > 170) & (mx - mn < 30))) & ~keep   # красные, синие, светлые крыши
busy = ndi.uniform_filter(np.abs(ndi.laplace(lum.astype(float))), 9)                 # пёстрая «текстура» застройки
near_street = ndi.distance_transform_edt(~keep) < 14
# застройка — там, где рядом с улицами много крыш (пустая дорога в поле не считается)
roofs_near = (roofs & near_street & (busy > 6)).astype(float)
density = ndi.gaussian_filter(roofs_near, 9)
density = np.clip((density - 0.02) / 0.08, 0, 1)
density = ndi.gaussian_filter(density, 3)
# перенос зон в мировую сетку 2 м/пиксель (1000×1000)
WN = 1000; ys, xs = np.mgrid[0:WN, 0:WN]
wx, wz = xs * 2 - 1000 + 1, ys * 2 - 1000 + 1
px, py = (wx - DX) / S + PX, (wz - DZ) / S + PY
inside = (px >= 0) & (px < Ww - 1) & (py >= 0) & (py < Hh - 1)
samp = lambda m: np.where(inside, ndi.map_coordinates(m.astype(float), [py, px], order=1, mode='nearest'), 0)
Z = np.stack([samp(density), samp(ndi.gaussian_filter(forest.astype(float), 1.5)), samp(ndi.gaussian_filter(bare.astype(float), 1.2))], -1)
Image.fromarray((np.clip(Z, 0, 1) * 255).astype(np.uint8)).save('data/layout/zones.png')
json.dump({'_note': 'Дороги по спутниковой карте (метры игрового мира). main — главные, street — улицы, lane — переулки внутри села.',
           'align': {'metersPerPixel': S, 'offset': [DX, DZ]}, 'lines': lines}, open('data/layout/roads.json', 'w'), ensure_ascii=False)
print('lines', len(lines), {k: sum(1 for l in lines if l['kind'] == k) for k in ('main', 'street', 'lane')})
