# ishimine-plugins

English | [日本語](README.ja.md)

A plugin marketplace for Claude Code and Cowork.

## Plugins

### [print3d-modeler](plugins/print3d-modeler/)

Design 3D printable models through conversation. Tell Claude what you want to make; it asks about size and shape, builds the model in Python (build123d), has two independent reviewers check printability and your requirements, and shows it to you in a 3D viewer with part names and directions. When you are happy with it, you get 3MF / STL files in print orientation, ready for an FDM 3D printer.

![The print3d-modeler 3D viewer showing a phone stand with part labels and directions](docs/images/print3d-modeler/en/viewer-overview.png)

See the [plugin README](plugins/print3d-modeler/) for the workflow, viewer features and settings.

## Install

Add the marketplace, then install the plugin:

```
/plugin marketplace add TomokiIshimine/ishimine-plugins
/plugin install print3d-modeler@ishimine-plugins
```

## License

MIT ([LICENSE](LICENSE)). The bundled three.js is also MIT licensed (`plugins/print3d-modeler/runtime/viewer/vendor/THREE_LICENSE.txt`).
