---
name: model
description: >
  3D プリンタ（FDM）で印刷するモデルを、ユーザーと対話しながら新しく設計・作成するときに使う。
  「3Dプリンタで○○を作りたい」「スマホスタンドのモデルを作って」「3Dプリント用のSTLを作って」
  「部品を設計して印刷したい」「/print3d-modeler:model」などで起動する。ヒアリング → 設計 → Python（build123d）で実装
  → 独立レビュー 2 種 → 3D ビューアでユーザー確認 → 印刷用 STL/3MF 出力までを一貫して進める。
argument-hint: "[作りたいもの]"
metadata:
  version: "0.1.0"
---

# 3D プリント用モデルの作成（入口）

ユーザーの「こういうものを作りたい」を、FDM 3D プリンタでそのまま印刷できるファイルにする。
対話・設計・実装・実行・出力はすべて自分（メイン）が行い、レビューだけを独立したサブエージェント 2 体に任せる。

作りたいもの（引数）: $ARGUMENTS

## 最初に必ず読むもの

- `modeling-conventions` スキル（座標系・部位命名・フォルダ構成・model.py の書き方）。座標系は **上 = +Z（Z=0 がベッド）、正面 = −Y、右 = +X、単位 mm** で固定。
- 工程ごとの詳しい手順: `${CLAUDE_PLUGIN_ROOT}/skills/model/references/workflow.md`
- ヒアリングの質問例: `${CLAUDE_PLUGIN_ROOT}/skills/model/references/hearing.md`

## 準備（最初の 1 回、ヒアリングと並行して）

1. Python 環境を用意する。初回は依存パッケージ（build123d ほか）のインストールに数分かかるので、Bash をバックグラウンドで実行し、終わるのを待たずにヒアリングを始める。

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"
   ```

   `${CLAUDE_PLUGIN_ROOT}` が展開されない環境では `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1` で探す。
   最後の行の JSON にある `python`（以下 PY）と `runtime`（以下 RT）を以降すべてのコマンドで使う。
2. 作業フォルダを決める。ユーザーが選んだ（接続した）フォルダがあればその直下、無ければ出力用フォルダの直下に `print3d/<モデル名>/` を作る。モデル名は英小文字のスラッグ（例: `phone-stand`）。

## 工程と完了条件

| 工程 | やること | 完了条件 |
|---|---|---|
| 1. ヒアリング | 用途・大きさ・形・動き/組み合わせ・印刷環境を聞く | `spec.md`（要件 R1, R2…）と `print3d/printer.json` |
| 2. 設計 | 部位分解・寸法・印刷の向きの候補を決め、要点を確認 | `design.md` と確認済みの部位リスト |
| 3. 実装 | `model.py` を書く（部位ごとに `add_part`） | `model.py` |
| 4. 実行・自己チェック | `P3D_RUNTIME=RT PY model.py` を実行し、明らかな失敗を自分で直す | `parts.json` `analysis.json` `out/` `viewer.html` |
| 5. レビュー | 2 体のレビュアーを並列起動 → FAIL を直して再レビュー（最大 3 周） | `reviews/iter-N-*.json` |
| 6. ユーザー確認 | ビューアを見てもらい、チャットで指示をもらう | 指摘を `spec.md` に追記（→ 工程 2 か 3 へ）／OK をもらう |
| 7. 出力 | 印刷の向きで STL/3MF と印刷メモを書き出す | `out/final/*.3mf` `*.stl` `print-notes.md` |

各工程の終わりに `history.md` へ 1〜3 行で記録する（`resume` が再開位置の判断に使う）。

## 守るルール

- **レビューを自分で兼ねない。** 工程 5 を通さずにユーザー確認（工程 6）や最終出力（工程 7）へ進まない。
- レビュアーには会話の要約を渡さない。渡すのは絶対パス（モデルフォルダ、PY、RT）と周回番号だけ。根拠はすべて `spec.md` とファイルにある状態にしておく。
- ユーザーへの質問は AskUserQuestion を使い、1 回に論点 1〜3 個、選択肢付きにする。専門用語には言い換えを添える（例: 「オーバーハング（下側が宙に浮いて、支え＝サポート材が必要になる部分）」）。
- 印刷可能性と要望がぶつかったら（例: 希望の壁が薄すぎる）、勝手に決めず代替案を並べて選んでもらう。
- ユーザーの指示は部位ラベル（`parts.json` の label）と方向（上下・前後・左右）に対応づけて `spec.md` に要件として追記してから直す。あいまいなら AskUserQuestion で聞き返す。
- 方向は常に「使うときの向き」が基準。印刷の向きは `set_print_orientation` の回転として別に持つ。
- ビューアを見せるときは、アーティファクトを作るツールが使えれば `viewer.html` の中身をそのままアーティファクトとして表示する（1 ファイルで完結しており、外部読み込みなしで動く）。あわせて必ずファイルへのリンクも示す（Cowork では `computer://<絶対パス>` 形式。ブラウザで開けばオフラインで動く）。

## レビュー（工程 5）の起動方法

2 体を **同じメッセージ内で並列に** Agent ツールで起動する。

- `print3d-modeler:printability-reviewer` … 印刷できるか
- `print3d-modeler:requirements-reviewer` … 要望を満たしているか

プロンプトには次だけを書く（例）:

```
model_dir: /abs/path/print3d/phone-stand
python: /abs/path/venv/bin/python
runtime: /abs/path/print3d-modeler/runtime
iteration: 1
```

返ってきた JSON をそのまま `reviews/iter-<N>-printability.json` と `reviews/iter-<N>-requirements.json` に保存する。
両方 PASS なら工程 6 へ。FAIL があれば指摘を直して再実行・再レビュー（N+1）。3 周しても残るものは、指摘・原因・選択肢をまとめて AskUserQuestion でユーザーに判断を仰ぐ。
`requirements-reviewer` の `questions_for_user`（判定不能の要件）は、工程 6 で AskUserQuestion にして聞く。

## ユーザー確認（工程 6）

1. ビューア（工程 4 で生成済み。無ければ `cd RT && PY -m p3d.viewer <model_dir>`）を見せ、リンクを示す。使い方を 2〜3 行で添える（ドラッグで回転・ホイールで拡大縮小、パーツにカーソルを合わせると名前が出る、右上の「パーツ・表示」で表示切り替え、方向ラベルを使ってチャットで指示）。
2. 確かめたい論点（レビューの `questions_for_user`、設計で迷った点）があれば、ビューアと同じメッセージで AskUserQuestion にして聞く（部位ラベルと方向を添える）。ビューアには質問を載せない。
3. チャットの指示や回答を `spec.md` に要件として追記し、工程 2 か 3 に戻る。ユーザーが「OK」なら工程 7 へ。

## 出力（工程 7）

`export` スキルの手順に従う（`cd RT && PY -m p3d.export <model_dir>` → `print-notes.md` を書く → 3MF/STL と印刷メモをリンクで示す）。
