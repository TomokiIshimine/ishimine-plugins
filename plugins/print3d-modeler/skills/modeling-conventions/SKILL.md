---
name: modeling-conventions
description: >
  print3d-modeler の共通規約（座標系・方向の語彙・部位の命名・作業フォルダ構成・model.py と p3d ランタイムの使い方）。
  3D プリント用モデルを設計・実装・レビューするとき、部位ラベルや「上・前・右」などの方向を解釈するときに参照する。
user-invocable: false
metadata:
  version: "0.1.0"
---

# モデリング規約

メイン・レビュアー・ビューア・ユーザーが同じ言葉で話すための決まり。ここに書いたことは変えない。

## 座標系と方向（確定）

| 方向 | 軸 | 意味 |
|---|---|---|
| 上 / 下 | +Z / −Z | Z=0 がベッド面。上はベッドから離れる向き |
| 前（手前・正面）/ 後（奥） | −Y / +Y | 正面は使う人から見える側 |
| 右 / 左 | +X / −X | 正面から見たときの左右 |

- 単位は mm。右手系。
- モデルは **使うときの向き（設計姿勢）** で作る。ユーザーの「上に伸ばして」の「上」は常に設計姿勢の +Z。
- 印刷の向きは別に、設計姿勢を X→Y→Z の順に回す角度（度）として持つ（`set_print_orientation`）。STL/3MF の最終出力にだけ適用する。
- 指摘やレビューの `direction` は `"上(+Z)"` か `"+Z"` の形で書く。

## 部位の決まり

- 部位 = ユーザーが指し示す単位。1 部位 = 1 ソリッド。
- `id`: 英小文字のスラッグ（`base`, `handle_left`）。コード・レビュー・ファイル名で使う。
- `label`: ユーザーに見せる日本語名（「台座」「左の取っ手」）。ビューアでは表示順に P1, P2… の短い番号も付く。
- 穴・溝・切り欠きなど形を持たない場所は `add_feature`（場所ラベル）で名前を付ける。
- `key_dims`: ユーザーが気にする主要寸法（例 `{"高さ": 100, "傾き": "後ろへ20°"}`）。ビューアとレビューに出る。
- `requirements`: その部位が満たすべき要件 ID（spec.md の R 番号）。
- 同じ `print_group` の部位は印刷時に 1 つに結合される。別々に印刷して組む部品は group を分ける。
- `print_group` 1 つ = 1 オブジェクト。ビューアのパーツ一覧はオブジェクト > パーツのネスト式で、表示名は `set_object_label(group, label)` で付ける（省略時は group 名）。

## 作業フォルダ（モデル 1 つにつき 1 フォルダ）

```
print3d/
├── printer.json             プリンタ設定（全モデル共通。モデルフォルダに置けばそちらが優先）
└── <model-slug>/
    ├── spec.md              要件（R1…）・印刷環境・ユーザー指摘の履歴      … メインが書く
    ├── design.md            部位分解・寸法・印刷の向きの理由              … メインが書く
    ├── model.py             モデル生成コード                              … メインが書く
    ├── history.md           版ごとの変更（resume が使う）                  … メインが書く
    ├── print-notes.md       印刷メモ                                      … メインが書く（工程 7）
    ├── parts.json           部位定義（id/label/anchor/key_dims/寸法/印刷向き）… model.py が生成
    ├── analysis.json        印刷可能性の自動計測                          … model.py が生成
    ├── viewer.html          確認用 3D ビューア（オフラインで開ける）        … model.py / p3d.viewer が生成
    ├── reviews/iter-N-printability.json, iter-N-requirements.json         … メインがレビュー結果を保存
    └── out/
        ├── model.glb, model.stl, model.step   設計姿勢（GLB は部位別ノード・Z-up・extras.label_ja）
        ├── parts/<id>.stl                      部位ごと（設計姿勢）
        ├── print/<group>.stl                   印刷姿勢（ベッドに接地・group ごとに結合）
        ├── parts.prev.json                     前の版の部位定義（requirements-reviewer が意図しない変更の検出に使う）
        └── final/<model>.3mf, <model>_<group>.stl  最終出力（export）
```

`parts.json` は model.py から生成されるので手で編集しない。部位名や寸法を変えるときは model.py を直して再実行する。

## p3d ランタイム（runtime ディレクトリ）

| コマンド（`cd RT && PY -m …`） | 用途 |
|---|---|
| `P3D_RUNTIME=RT PY model.py`（DIR で実行） | モデル生成 → parts.json / out / analysis.json / viewer.html を一括出力 |
| `p3d.analyze DIR [--stdout]` | 印刷可能性の自動計測（水密・ボディ数・造形範囲・肉厚・オーバーハング・ブリッジ・接地と重心・クリアランス・向き候補） |
| `p3d.measure DIR [--part id / --section z=30 / --distance a b / --ray x,y,z dx,dy,dz]` | 寸法の実測 |
| `p3d.viewer DIR` | ビューアだけ作り直す（モデルは作り直さない） |
| `p3d.export DIR` | 最終 STL/3MF を書き出し、印刷メモ用の事実を JSON で表示 |
| `p3d.printer DIR` / `p3d.printer --presets` | 使われるプリンタ設定の確認／プリセット一覧 |

## LabeledModel の API

```python
m = LabeledModel("pen-stand", title="ペン立て")
m.add_part(id, label, shape, color=None, description="", key_dims=None,
           requirements=None, anchor=None, print_group="main")
m.add_feature(id, label, (x, y, z), description="", requirements=None)
m.add_cut(shape, parts=None)            # 全部位（または指定部位）から削る
m.set_print_orientation(rotation_deg=(rx, ry, rz), bed_face="…", group=None)
m.set_object_label(group, label)        # オブジェクト（print_group）の表示名
m.print_note = "…"
result = m.build(__file__)              # 要約 JSON を返す
```

`shape` は build123d の Part/Solid/Compound、manifold3d.Manifold、trimesh.Trimesh のどれでもよい（build123d を基本にする）。
`anchor` を省くと部位の上寄りの表面にラベルが立つ（ビューアの部位ラベルは初期オフ。オンにしたとき見づらい位置なら指定する）。

build123d の書き方の要点は `references/build123d-cheatsheet.md`、parts.json の項目は `references/parts-schema.json`。
