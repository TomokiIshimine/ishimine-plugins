---
name: printer
description: >
  3D プリンタの機種・造形範囲・ノズル径・材料を設定または確認するときに使う。
  「プリンタは A1 mini です」「造形範囲を 180mm に設定して」「ノズルを 0.6 に変えて」「/print3d-modeler:printer」などで起動する。
argument-hint: "[機種名 または 造形範囲 X×Y×Z]"
metadata:
  version: "0.1.0"
---

# プリンタ設定（造形範囲など）

指定: $ARGUMENTS

設定はファイル `printer.json` に保存する。

- `print3d/printer.json` … そのフォルダの全モデル共通（ふつうはこちら）
- `print3d/<model>/printer.json` … そのモデルだけ別の設定にしたいとき（こちらが優先）
- どちらも無ければ既定値（220×220×250mm・ノズル 0.4mm・PLA・オーバーハング 45°・ブリッジ 10mm・はめ合い 0.2〜0.4mm）

## 手順

1. Python 環境: `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` を実行し、最後の行の JSON の `python`（PY）と `runtime`（RT）を使う（展開されない環境では `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`）。
2. プリセット一覧を見る: `cd RT && PY -m p3d.printer --presets`
3. 機種名がプリセットにあれば `{"preset": "<キー>"}`、無ければ造形範囲を mm で聞いて `{"name": "<機種名>", "build_volume_mm": [X, Y, Z]}` を書く。必要なら上書き項目を足す:
   ```json
   {"preset": "bambu-a1-mini", "nozzle_mm": 0.4, "material": "PETG"}
   ```
   上書きできる項目: `build_volume_mm` `nozzle_mm` `layer_height_mm` `material` `overhang_limit_deg` `max_bridge_mm` `clearance_mm` `min_bed_contact_mm2`
4. プリセットの造形範囲はメーカー公表値の目安なので、ユーザーに「実機の値と違えば教えてください」と添える。
5. 確認: `cd RT && PY -m p3d.printer <model_dir または print3d フォルダ>`
6. 作成中のモデルがあれば、spec.md の「印刷環境」を更新し、model.py を再実行して造形範囲のチェックをやり直す。
