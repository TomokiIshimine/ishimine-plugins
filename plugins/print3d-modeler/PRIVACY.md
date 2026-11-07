# Privacy policy

English | [日本語](#プライバシーポリシー)

Applies to: the print3d-modeler plugin for Claude Code and Cowork, published by Tomoki Ishimine.
Last updated: 2026-11-07.

## Summary

print3d-modeler has no server, account, API key or telemetry. The author does not collect, receive, store or share any data about you, your conversations or your models.

## What the plugin does where it runs

The plugin runs in the environment where Claude runs commands: in Cowork, an environment in Claude's cloud; in Claude Code on your own computer, that computer.

- **Downloads.** On first run, and again only when `runtime/requirements.txt` changes, `runtime/setup_env.sh` runs `pip` to download build123d, trimesh, manifold3d and their dependencies from PyPI (pypi.org and files.pythonhosted.org). The plugin fetches nothing else from the network. PyPI's own privacy policy applies to those downloads.
- **Programs it runs.** `setup_env.sh` (creates a Python virtual environment and installs the packages), the `model.py` that Claude writes for each model, and the plugin's own Python modules. All of them run in that environment and send nothing anywhere.
- **Files it writes.** Your models go in `print3d/` under the folder you choose. The Python environment goes in the same environment, in the plugin's data folder that Claude Code provides, or `~/.print3d-modeler/` when there is none. Nothing is written anywhere else.
- **The viewer.** `viewer.html` loads nothing from the network.

## Data handled by Claude, not by this plugin

Your conversation with Claude, and any file Claude shows you as an artifact (for example the 3D viewer, which contains the model's shape and part names), are handled by Anthropic under Anthropic's privacy policy, as with any other use of Claude. The plugin does not change that. If you do not want the viewer stored as an artifact, ask Claude not to show it that way and open the local `viewer.html` instead.

## Removing data

Delete the `print3d/` folder to remove your models, and the plugin's data folder (or `~/.print3d-modeler/`) to remove the Python environment. Uninstalling the plugin from Claude Code normally removes its data folder too.

## Changes and contact

Changes to this policy are made in this file and recorded in the repository's history. For questions, open an issue in the GitHub repository TomokiIshimine/ishimine-plugins.

---

# プライバシーポリシー

対象：Tomoki Ishimine が公開している Claude Code / Cowork 用プラグイン print3d-modeler。
最終更新：2026-11-07。

## 概要

print3d-modeler にはサーバー・アカウント・API キー・テレメトリはありません。作者があなたや会話、モデルについてのデータを集めたり、受け取ったり、保存したり、第三者に渡したりすることはありません。

## プラグインが動く場所ですること

プラグインは、Claude がコマンドを実行する環境で動きます。Cowork では Claude のクラウド上の環境、自分のコンピューターで動かす Claude Code ではそのコンピューターです。

- **ダウンロード**：初回と、`runtime/requirements.txt` が変わったときだけ、`runtime/setup_env.sh` が `pip` で build123d・trimesh・manifold3d とその依存パッケージを PyPI（pypi.org と files.pythonhosted.org）から取得します。それ以外にネットワークから取得するものはありません。この取得には PyPI のプライバシーポリシーが適用されます。
- **実行するプログラム**：`setup_env.sh`（Python の仮想環境を作ってパッケージを入れる）、Claude がモデルごとに書く `model.py`、プラグイン自身の Python モジュール。どれもその環境の中で動き、どこにも送信しません。
- **書き込むファイル**：モデルは選んだフォルダの下の `print3d/` に保存します。Python 環境は同じ環境の中の、Claude Code が用意するプラグイン用のデータフォルダ、無ければ `~/.print3d-modeler/` に作ります。それ以外の場所には書き込みません。
- **ビューア**：`viewer.html` はネットワークから何も読み込みません。

## プラグインではなく Claude が扱うデータ

Claude との会話や、Claude がアーティファクトとして表示するファイル（たとえばモデルの形と部位名を含む 3D ビューア）は、Claude の他の使い方と同じく、Anthropic のプライバシーポリシーのもとで Anthropic が扱います。このプラグインがそれを変えることはありません。ビューアをアーティファクトとして保存したくない場合は、Claude にそう伝えて、手元の `viewer.html` を開いてください。

## データの削除

モデルは `print3d/` フォルダを、Python 環境はプラグイン用のデータフォルダ（または `~/.print3d-modeler/`）を削除すれば消えます。Claude Code からプラグインをアンインストールすると、通常はプラグイン用のデータフォルダも削除されます。

## 変更と問い合わせ

このポリシーの変更はこのファイルで行い、リポジトリの履歴に残ります。質問は GitHub リポジトリ TomokiIshimine/ishimine-plugins の Issue でお寄せください。
