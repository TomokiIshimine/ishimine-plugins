---
name: export
description: >
  完成した 3D プリント用モデルを、印刷の向きに置いた最終の 3MF / STL と印刷メモとして書き出すときに使う。
  「STLを出力して」「3MFで書き出して」「印刷用ファイルをちょうだい」「/print3d-modeler:export」などで起動する。
argument-hint: "[モデル名]"
metadata:
  version: "0.1.0"
---

# 最終出力

対象: $ARGUMENTS（省略時は最近更新したモデル）

1. 作業フォルダを探す（`resume` スキルの手順 1 と同じ）。
2. Python 環境: `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` を実行し、最後の行の JSON の `python`（PY）と `runtime`（RT）を使う（展開されない環境では `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`）。
3. 前提を確かめる。最新の版のレビュー（`reviews/` の最大周回）が 2 つとも PASS で、ユーザーの OK をもらっていること。
   満たさない場合は、その状態を伝えて「レビューしてから出力」か「このまま出力（リスクを明記）」かを AskUserQuestion で選んでもらう。
4. 書き出す:
   ```bash
   cd RT && PY -m p3d.export <model_dir>
   ```
   `out/final/<model>.3mf`（全部品をベッドに並べたもの）と `out/final/<model>_<group>.stl`（部品ごと）ができる。表示された JSON が印刷メモの材料になる。
5. `<model_dir>/print-notes.md` を `${CLAUDE_PLUGIN_ROOT}/skills/model/templates/print-notes.md` の形で書く。
   - 印刷の向き（部品ごと、どの面を下に）、サポートの要否と場所、ブリムの要否、推奨設定（積層・壁・インフィル）
   - 外形・体積・重さの上限、レビューの警告（`print_notes` と warning）、組み立て手順（複数部品なら）
6. `history.md` に「工程7 出力」を記録する。
7. ユーザーに 3MF・STL・印刷メモをクリックできるリンクで示す（Cowork では `computer://<絶対パス>`）。3MF はスライサー（Bambu Studio / PrusaSlicer / OrcaSlicer / Cura）にそのまま読み込めて、向きも設定済みであることを伝える。
