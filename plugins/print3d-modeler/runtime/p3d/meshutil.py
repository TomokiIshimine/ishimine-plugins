"""形状変換・回転・方向ラベルなどの共通処理。"""
from __future__ import annotations

import math
import tempfile
from pathlib import Path

import numpy as np
import trimesh

# 方向の語彙（ユーザー・メイン・レビュアー・ビューアで共通）
DIRECTION_LABELS = {
    "+Z": "上", "-Z": "下",
    "-Y": "前", "+Y": "後",
    "+X": "右", "-X": "左",
}
_AXES = {"+X": (1, 0, 0), "-X": (-1, 0, 0), "+Y": (0, 1, 0), "-Y": (0, -1, 0), "+Z": (0, 0, 1), "-Z": (0, 0, -1)}

STL_TOLERANCE = 0.02       # build123d → メッシュ化の弦誤差 [mm]
STL_ANGULAR = 0.15         # 角度誤差 [rad]


def direction_of(vec) -> str:
    """ベクトルに最も近い方向キー（"+Z" など）。"""
    v = np.asarray(vec, dtype=float)
    n = np.linalg.norm(v)
    if n < 1e-9:
        return "+Z"
    v = v / n
    return max(_AXES, key=lambda k: float(np.dot(v, _AXES[k])))


def direction_label(vec) -> str:
    k = direction_of(vec)
    return f"{DIRECTION_LABELS[k]}({k})"


def to_trimesh(obj) -> trimesh.Trimesh:
    """build123d の形状 / manifold3d.Manifold / trimesh.Trimesh をメッシュに変換する。"""
    if isinstance(obj, trimesh.Trimesh):
        return obj.copy()
    mod = type(obj).__module__
    if mod.startswith("manifold3d"):
        mesh = obj.to_mesh()
        verts = np.asarray(mesh.vert_properties)[:, :3]
        faces = np.asarray(mesh.tri_verts)
        return trimesh.Trimesh(vertices=verts, faces=faces, process=True)
    if mod.startswith("build123d") or hasattr(obj, "wrapped"):
        from build123d import export_stl  # 遅延 import（manifold だけ使う場合に不要なため）
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "s.stl"
            export_stl(obj, str(p), tolerance=STL_TOLERANCE, angular_tolerance=STL_ANGULAR)
            m = trimesh.load_mesh(p, process=True)
        m.merge_vertices()
        return m
    raise TypeError(f"形状として扱えない型です: {type(obj)}")


def to_manifold(mesh: trimesh.Trimesh):
    """trimesh → manifold3d.Manifold。多様体にできなければ None。"""
    import manifold3d as mf
    m = mf.Manifold(mf.Mesh(vert_properties=np.asarray(mesh.vertices, dtype=np.float32),
                            tri_verts=np.asarray(mesh.faces, dtype=np.uint32)))
    if m.status() != mf.Error.NoError or m.is_empty():
        return None
    return m


def manifold_to_trimesh(m) -> trimesh.Trimesh:
    return to_trimesh(m)


def boolean(meshes: list[trimesh.Trimesh], op: str = "union") -> trimesh.Trimesh | None:
    """manifold3d によるブーリアン。失敗したら None。"""
    import manifold3d as mf
    ms = [to_manifold(m) for m in meshes]
    if any(x is None for x in ms):
        return None
    opmap = {"union": mf.OpType.Add, "difference": mf.OpType.Subtract, "intersection": mf.OpType.Intersect}
    return manifold_to_trimesh(mf.Manifold.batch_boolean(ms, opmap[op]))


def rotation_matrix(rotation_deg) -> np.ndarray:
    """X→Y→Z の順に（固定軸まわりで）回す 4x4 行列。"""
    rx, ry, rz = (math.radians(a) for a in rotation_deg)
    m = trimesh.transformations.euler_matrix(rx, ry, rz, axes="sxyz")
    m[np.abs(m) < 1e-12] = 0.0
    return m


def place_on_bed(mesh: trimesh.Trimesh, rotation_deg, x_offset: float = 0.0) -> tuple[trimesh.Trimesh, np.ndarray]:
    """回転してから、底を Z=0 に、XY 中心を (x_offset, 0) に合わせる。変換行列も返す。"""
    R = rotation_matrix(rotation_deg)
    tmp = mesh.copy()
    tmp.apply_transform(R)
    lo, hi = tmp.bounds
    T = np.eye(4)
    T[:3, 3] = [x_offset - (lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]]
    M = T @ R
    out = mesh.copy()
    out.apply_transform(M)
    return out, M


def round_list(a, nd=2):
    return [round(float(v), nd) for v in np.asarray(a).ravel()]


def np_default(o):
    """json.dumps(default=...) 用：numpy の値を Python の値にする。"""
    if isinstance(o, np.generic):
        return o.item()
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")
