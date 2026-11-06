---
name: resume
description: >
  作りかけの 3D プリント用モデルの作業を、中断した工程から再開するときに使う。
  「さっきのモデルの続き」「前に作ったスマホスタンドを直したい」「/print3d-modeler:resume」などで起動する。
argument-hint: "[モデル名]"
metadata:
  version: "0.1.0"
---

# 作業の再開

対象: $ARGUMENTS

1. 作業フォルダを探す。ユーザーが選んだフォルダ（無ければ出力フォルダ）の下の `print3d/*/spec.md` を Glob で探す。
   - 引数があればモデル名（フォルダ名）か spec.md のタイトルで絞る。
   - 候補が複数で決められなければ、更新日時の新しい順に最大 4 件を AskUserQuestion で選んでもらう。
   - 見つからなければ、新規作成（`model` スキル）を提案する。
2. Python 環境: `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` を実行し、最後の行の JSON の `python`（PY）と `runtime`（RT）を使う（展開されない環境では `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`）。
3. 状態を読む: `spec.md`、`design.md`、`history.md`（最後の `## vN … 工程X` 行）、`reviews/` の最新周回、`out/final/` の有無。
4. 再開位置を決める。
   | 状態 | 再開する工程 |
   |---|---|
   | spec.md だけ | 工程 2（設計） |
   | design.md まで、model.py なし | 工程 3（実装） |
   | model.py はあるが parts.json / viewer.html が古い・無い | 工程 4（実行） |
   | 最新の版にレビューが無い、または FAIL が残る | 工程 5（レビュー。周回番号は続きから。3 周の上限は版ごとに数え直さない） |
   | レビュー PASS、ユーザー確認待ち | 工程 6（ビューアを作り直して再提示） |
   | out/final がある | 完了。追加の修正か再出力かを聞く |
5. ユーザーに「どこまで進んでいて、次に何をするか」を 2〜3 行で伝え、`model` スキルの該当工程の手順（`${CLAUDE_PLUGIN_ROOT}/skills/model/SKILL.md` と `references/workflow.md`）に沿って続ける。
6. セッションが変わると Python のパスが変わることがある。model.py は `P3D_RUNTIME` 環境変数で runtime を受け取るので、毎回 `P3D_RUNTIME=RT PY model.py` で実行する。
