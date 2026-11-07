"""Checks used by setup_env.sh (kept in a file so the shell script runs no inline Python).

    python check_env.py version                       exit 0 if this Python is 3.10 or later
    python check_env.py deps                          exit 0 if build123d, trimesh and manifold3d import
    python check_env.py report <python> <runtime> <plugin_root>  print the JSON line setup_env.sh ends with

Keep the `version` path free of newer syntax: it must run, and fail cleanly, on old Pythons too.
"""
import json
import sys


def main(argv):
    if len(argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    cmd = argv[1]
    if cmd == "version":
        return 0 if sys.version_info >= (3, 10) else 1
    if cmd == "deps":
        try:
            import build123d  # noqa: F401
            import manifold3d  # noqa: F401
            import trimesh  # noqa: F401
        except Exception:
            return 1
        return 0
    if cmd == "report" and len(argv) == 5:
        import build123d
        import trimesh

        print(json.dumps({
            "python": argv[2],
            "runtime": argv[3],
            "plugin_root": argv[4],
            "versions": {"python": sys.version.split()[0], "build123d": build123d.__version__,
                         "trimesh": trimesh.__version__},
        }, ensure_ascii=False))
        return 0
    print(__doc__.strip(), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
