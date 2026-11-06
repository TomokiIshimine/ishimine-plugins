# build123d 早見表（algebra モード・FDM 向け）

`from build123d import *` を前提にする。単位 mm。動作確認は build123d 0.13。

## 基本形状と位置

```python
MIN = (Align.CENTER, Align.CENTER, Align.MIN)        # XY 中心・底面を Z=0 に置く
b = Box(80, 60, 10, align=MIN)                        # 幅(X)×奥行(Y)×高さ(Z)
c = Cylinder(radius=5, height=20, align=MIN)
s = Sphere(10); k = Cone(10, 5, 20); t = Torus(20, 3)
p = Pos(0, -20, 10) * Rot(-20, 0, 0) * b              # 右から順に適用：回してから移す
```

- `Rot(x, y, z)` は度（右手系）。`Rot(-20, 0, 0)` で立てた板の上端は後ろ（+Y）へ倒れ、`Rot(20, 0, 0)` なら前（−Y）へ倒れる。`Rot(0, 20, 0)` は上端が右（+X）へ倒れる。
- 迷ったら `p.bounding_box()` の `min` / `max` を print して確かめる。

## ブーリアン

```python
body = b - Pos(0, 0, 2) * Box(76, 56, 20, align=MIN)  # くり抜き
u = a + b                                            # 結合
i = a & b                                            # 共通部分
holes = [loc * Cylinder(1.7, 30) for loc in GridLocations(20, 20, 2, 2)]
for h in holes: body = body - h
ring = [loc * Cylinder(2, 5) for loc in PolarLocations(15, 6)]   # 円周上に 6 個
```

## スケッチ → 押し出し・回転・ロフト

```python
plate = extrude(RectangleRounded(40, 20, 4), amount=3)          # 角丸の板
tri = Polygon((0, 0), (40, 0), (0, 30), align=None)              # 点で多角形（align=None で座標そのまま）
rib = extrude(Plane.YZ * tri, amount=4, both=True)               # YZ 平面に描いて X 方向へ両側 4mm（計 8mm）
cup = revolve(Plane.XZ * Polygon((0, 0), (30, 0), (32, 60), (29, 60), (27, 3), (0, 3), align=None), Axis.Z)
adapter = loft([Plane.XY * Circle(10), Plane.XY.offset(20) * Rectangle(10, 10)])
```

## 面取り・丸め・シェル

```python
b = fillet(b.edges().filter_by(Axis.Z), radius=3)                # 縦の 4 辺を R3
b = chamfer(b.edges().group_by(Axis.Z)[-1], length=1)            # 上面の縁を C1
box = offset(Box(30, 30, 30, align=MIN), amount=-2,
             openings=Box(30, 30, 30, align=MIN).faces().sort_by(Axis.Z)[-1])   # 上が開いた厚さ 2mm の箱
m = mirror(part, about=Plane.YZ)                                  # 左右対称にコピー
```

- 辺の選び方: `.edges().filter_by(Axis.Z)`（Z に平行）、`.group_by(Axis.Z)[0]`（一番下の辺群）、`.sort_by(Axis.Z)[-1]`（一番上の面）。
- フィレットは失敗しやすい。半径を小さくする／先に結合してから丸める／丸めを最後にする。
- **底面（ベッドに付く面）の縁は丸めない**（反り・剥がれの原因）。面取り 0.5mm 程度ならよい。

## 文字

```python
label = extrude(Text("ABC", font_size=8), amount=0.8)            # font_size は文字の高さの目安
```

- FDM では文字の高さ 5mm 以上、線の太さ 0.8mm 以上、浮き出し/彫り込み 0.6mm 以上を目安にする。
- 日本語フォントが無い環境では日本語の文字が出ない。必要なら `font_path=` で TTF を指定するか、ユーザーと相談する。

## FDM 向けの定石

| 形 | 定石 |
|---|---|
| 横向きの穴 | 上側を 45° にとがらせる（ティアドロップ）とサポート不要 |
| 張り出し | 下面を 45° 以内の斜面（面取り）にする。直角の張り出しはサポートが要る |
| ねじ穴（M3 タップなし） | 下穴 φ2.5〜2.8、通し穴 φ3.4、皿・座ぐりは段付きで |
| はめ合い | 片側 0.2〜0.4mm のすき間。きつめ 0.15、ゆるめ 0.5 |
| 薄い壁 | 0.8mm（ノズル 0.4 の 2 本分）以上。強度が要るなら 1.6〜2.4mm |
| 細いピン | φ3mm 以上、根元に R1 程度の丸み |
| 部位の結合 | 0.5〜1mm 重ねる（面が接するだけだと別ボディ扱いになることがある） |

## うまくいかないとき

- `Part` ではなく `Compound` になっても add_part に渡してよい（メッシュ化して扱う）。
- ブーリアンが失敗する・形が消える → 接する面がぴったり一致していないか確認し、0.01mm ずらすか重ねる。
- どうしても build123d で作りにくい形は manifold3d（`import manifold3d as mf`）で作って add_part に渡してよい。
