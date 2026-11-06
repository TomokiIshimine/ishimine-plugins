# ishimine-plugins

[English](README.md) | 日本語

イシミネが作った Claude Code / Cowork 用プラグインのマーケットプレイスです。

## 追加のしかた

```
/plugin marketplace add TomokiIshimine/ishimine-plugins
/plugin install print3d-modeler@ishimine-plugins
```

## プラグイン一覧

| プラグイン | 内容 |
|---|---|
| [print3d-modeler](plugins/print3d-modeler/README.ja.md) | 対話しながら Python（build123d）で 3D モデルを設計し、3D ビューアでの確認と独立レビューを経て、FDM 3D プリンタでそのまま印刷できる STL / 3MF を出力する |

## ライセンス

MIT（[LICENSE](LICENSE)）。同梱の three.js も MIT License です（`plugins/print3d-modeler/runtime/viewer/vendor/THREE_LICENSE.txt`）。
