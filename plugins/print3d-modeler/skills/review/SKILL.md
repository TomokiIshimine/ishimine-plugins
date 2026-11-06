---
name: review
description: >
  3D プリント用モデルの独立レビュー（印刷可能性・要望充足の 2 種）だけを手動でやり直すときに使う。
  「レビューし直して」「印刷できるかチェックして」「要望どおりか確認して」「/print3d-modeler:review」などで起動する。
argument-hint: "[モデル名]"
metadata:
  version: "0.1.0"
---

# レビューの再実行

対象: $ARGUMENTS（省略時は最近更新したモデル）

1. 作業フォルダを探す（`resume` スキルの手順 1 と同じ）。
2. Python 環境: `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` を実行し、最後の行の JSON の `python`（PY）と `runtime`（RT）を使う（展開されない環境では `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`）。
3. model.py が parts.json より新しければ、先に `cd <model_dir> && P3D_RUNTIME=RT PY model.py` を実行する。
4. 周回番号 N を決める: `reviews/iter-*-*.json` の最大番号 + 1（無ければ 1）。
5. 2 体を **同じメッセージ内で並列に** Agent ツールで起動する。プロンプトは絶対パスと周回番号だけ（会話の要約は渡さない）:
   - `print3d-modeler:printability-reviewer`
   - `print3d-modeler:requirements-reviewer`
   ```
   model_dir: <絶対パス>
   python: <PY>
   runtime: <RT>
   iteration: <N>
   ```
6. 返ってきた JSON を `reviews/iter-<N>-printability.json`、`reviews/iter-<N>-requirements.json` に保存する（指摘はビューアには出さない。結果はチャットで伝える）。
7. 結果を短く報告する: 2 つの判定（PASS/FAIL）、重大な指摘（部位ラベルと方向つき）、警告の件数。FAIL があれば直してよいかを聞くか、`model` スキルの工程 5 の手順で直す（3 周まで）。
