# print3d-modeler

[English](README.md) | 日本語

「こういうものを 3D プリンタで作りたい」と伝えるだけで、Claude が対話しながら Python（build123d）で 3D モデルを設計し、
確認用の 3D ビューアと独立レビューを経て、**FDM 3D プリンタでそのまま印刷できる 3MF / STL** を出力するプラグインです。
Claude デスクトップアプリの Cowork で動かす前提で作っています（Claude Code でも動きます）。

## 使い方

| 言い方の例 | スキル | すること |
|---|---|---|
| 「3Dプリンタでスマホスタンドを作りたい」／`/print3d-modeler:model スマホスタンド` | model | 新規作成の入口。ヒアリングから最終出力まで進める |
| 「さっきのモデルの続き」／`/print3d-modeler:resume` | resume | 作りかけのモデルを中断した工程から再開 |
| 「3Dで見せて」／`/print3d-modeler:view` | view | 確認用 3D ビューアを作り直して開く |
| 「レビューし直して」／`/print3d-modeler:review` | review | 印刷可能性・要望充足のレビューだけ再実行 |
| 「STLを出力して」／`/print3d-modeler:export` | export | 印刷の向きで 3MF/STL と印刷メモを書き出す |
| 「プリンタは A1 mini です」／`/print3d-modeler:printer` | printer | 造形範囲・ノズル径・材料を設定 |
| 「使い方を教えて」／`/print3d-modeler:help` | help | コマンド・作業の流れ・始め方を説明し、作業中のモデルも一覧で表示 |

## 進み方

1. **ヒアリング** … 用途・大きさ・形・組み合わせ・プリンタ機種を、選択肢つきの質問で確認します。
2. **設計** … 部位（台座・背もたれ など）に分け、寸法と印刷の向きを決めて要点を確認します。
3. **実装・実行** … Claude が Python でモデルを作り、自動計測（水密・肉厚・オーバーハング・造形範囲など）で明らかな失敗を直します。
4. **レビュー** … 独立したサブエージェント 2 体（印刷できるか／要望を満たしているか）が並行してチェックします。修正は最大 3 周。
5. **ユーザー確認** … 3D ビューアで見てもらいます。自由に回転・拡大縮小・移動でき、パーツにカーソルを合わせると名前（P1 台座 など）が出ます。パーツやオブジェクトごとの表示/半透明、使うときの向き／印刷の向き、方向・サポートが要りそうな面・大きさの目安の表示を切り替えて確認し、部位名と方向（上下・前後・左右）を使ってチャットで指示できます。
6. **出力** … 印刷の向きに置いた 3MF / STL と、推奨設定・サポートの要否をまとめた印刷メモを書き出します。

## 決まりごと

- 座標系: **上 = +Z（Z=0 がベッド面）、正面（手前）= −Y、右 = +X**、単位 mm。方向は「使うときの向き」が基準で、印刷の向きは別に持ちます。
- 対象は FDM 方式のみ。判定の既定値はノズル 0.4mm（肉厚 0.8mm 以上、オーバーハング 45° まで、ブリッジ 10mm まで、はめ合い 0.2〜0.4mm）。
- 造形範囲はプリンタごとに設定できます（既定 220×220×250mm）。主要機種のプリセットあり。

## 必要なもの

- Python 3.10 以上と、PyPI からパッケージを入れられるネットワーク（初回のみ）。
  初回に build123d・trimesh・manifold3d などを仮想環境（`$CLAUDE_PLUGIN_DATA` または `~/.print3d-modeler/venv`）へ自動で入れます。数分かかります。
- ビューアは three.js を埋め込んだ 1 ファイルの HTML です。アーティファクトとして表示でき、ブラウザで開けばオフラインでも動きます。
- three.js を更新するときは `runtime/viewer/vendor/three-bundle.entry.js` を esbuild で `--bundle --minify --format=iife` して `three-bundle.js` を作り直します。

## 言語

プラグイン本体（スキル・エージェント・テンプレート・ランタイムのメッセージ）は英語で書かれていますが、Claude はあなたが書いた言語で会話します。
部位名や印刷メモなど、ユーザーが読むものもその言語で作ります。
3D ビューアの表示は **日本語と英語** に対応しています。Claude が会話の言語に合わせて、ビューアを作るときに選びます（`LabeledModel(..., lang="ja"|"en")` または `python -m p3d.viewer <フォルダ> --lang ja|en`）。指定が無い場合は、部位名が日本語なら日本語表示になります。

## 作業フォルダ

選んだフォルダの下に `print3d/<モデル名>/` を作り、要件（spec.md）・設計（design.md）・コード（model.py）・ビューア（viewer.html）・レビュー結果・最終ファイル（out/final/）をすべて残します。セッションが切れても `resume` で続きから再開できます。

## 構成

```
print3d-modeler/
├── .claude-plugin/plugin.json
├── skills/            model, resume, view, review, export, printer, help（ユーザー向け）
│                      printability-rules, modeling-conventions（内部の判定基準・規約）
├── agents/            printability-reviewer, requirements-reviewer（読み取り専用のレビュアー）
└── runtime/           setup_env.sh, requirements.txt, p3d/（Python ライブラリ）, viewer/（テンプレートと three.js）
```

three.js（MIT License）を `runtime/viewer/vendor/` に同梱しています。
