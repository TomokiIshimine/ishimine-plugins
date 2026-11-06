"""Shared helpers: shape conversion, boolean operations, rotation, direction labels."""
from __future__ import annotations

import math
import tempfile
from pathlib import Path

import numpy as np
import trimesh

# Direction vocabulary (shared by the user, the main agent, the reviewers and the viewer)
DIRECTION_LABELS = {
    "+Z": "up", "-Z": "down",
    "-Y": "front", "+Y": "back",
    "+X": "right", "-X": "left",
}
_AXES = {"+X": (1, 0, 0), "-X": (-1, 0, 0), "+Y": (0, 1, 0), "-Y": (0, -1, 0), "+Z": (0, 0, 1), "-Z": (0, 0, -1)}

STL_TOLERANCE = 0.02       # chord tolerance when meshing build123d shapes [mm]
STL_ANGULAR = 0.15         # angular tolerance [rad]


def direction_of(vec) -> str:
    """Direction key closest to the vector (such as "+Z")."""
    v = np.asarray(vec, dtype=float)
    n = np.linalg.norm(v)
    if n < 1e-9:
        return "+Z"
    v = v / n
    return max(_AXES, key=lambda k: float(np.dot(v, _AXES[k])))


def direction_label(vec) -> str:
    k = direction_of(vec)
    return f"{DIRECTION_LABELS[k]} ({k})"


# --------------------------------------------------------------------- shape conversion
def is_build123d(obj) -> bool:
    return type(obj).__module__.startswith("build123d")


def to_trimesh(obj) -> trimesh.Trimesh:
    """Convert a build123d shape, manifold3d.Manifold or trimesh.Trimesh to a mesh."""
    if isinstance(obj, trimesh.Trimesh):
        return obj.copy()
    if type(obj).__module__.startswith("manifold3d"):
        mesh = obj.to_mesh()
        verts = np.asarray(mesh.vert_properties)[:, :3]
        faces = np.asarray(mesh.tri_verts)
        return trimesh.Trimesh(vertices=verts, faces=faces, process=True)
    if is_build123d(obj) or hasattr(obj, "wrapped"):
        from build123d import export_stl  # lazy import (not needed when only manifold is used)
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "s.stl"
            export_stl(obj, str(p), tolerance=STL_TOLERANCE, angular_tolerance=STL_ANGULAR)
            m = trimesh.load_mesh(p, process=True)
        m.merge_vertices()
        return m
    raise TypeError(f"Cannot use this type as a shape: {type(obj)}")


def to_manifold(mesh: trimesh.Trimesh):
    """trimesh -> manifold3d.Manifold. Returns None if it cannot be made manifold."""
    import manifold3d as mf
    m = mf.Manifold(mf.Mesh(vert_properties=np.asarray(mesh.vertices, dtype=np.float32),
                            tri_verts=np.asarray(mesh.faces, dtype=np.uint32)))
    if m.status() != mf.Error.NoError or m.is_empty():
        return None
    return m


# --------------------------------------------------------------------- boolean operations
def boolean(meshes: list[trimesh.Trimesh], op: str = "union") -> trimesh.Trimesh | None:
    """Boolean operation with manifold3d. Returns None on failure."""
    import manifold3d as mf
    ms = [to_manifold(m) for m in meshes]
    if any(x is None for x in ms):
        return None
    opmap = {"union": mf.OpType.Add, "difference": mf.OpType.Subtract, "intersection": mf.OpType.Intersect}
    return to_trimesh(mf.Manifold.batch_boolean(ms, opmap[op]))


def fuse(meshes: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    """Union of the meshes as a new mesh. Falls back to plain concatenation if the union fails."""
    if len(meshes) == 1:
        return meshes[0].copy()
    r = boolean(meshes, "union")
    return r if r is not None else trimesh.util.concatenate(meshes)


# --------------------------------------------------------------------- transforms
def transformed(mesh: trimesh.Trimesh, matrix) -> trimesh.Trimesh:
    """Copy of the mesh with a 4x4 matrix applied."""
    out = mesh.copy()
    out.apply_transform(matrix)
    return out


def rotation_matrix(rotation_deg) -> np.ndarray:
    """4x4 matrix that rotates about the fixed X, then Y, then Z axes."""
    rx, ry, rz = (math.radians(a) for a in rotation_deg)
    m = trimesh.transformations.euler_matrix(rx, ry, rz, axes="sxyz")
    m[np.abs(m) < 1e-12] = 0.0
    return m


def place_on_bed(mesh: trimesh.Trimesh, rotation_deg, x_offset: float = 0.0) -> tuple[trimesh.Trimesh, np.ndarray]:
    """Rotate, then put the bottom at Z=0 and the XY center at (x_offset, 0). Also returns the matrix."""
    R = rotation_matrix(rotation_deg)
    lo, hi = transformed(mesh, R).bounds
    T = np.eye(4)
    T[:3, 3] = [x_offset - (lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]]
    M = T @ R
    return transformed(mesh, M), M


# --------------------------------------------------------------------- JSON
def round_list(a, nd=2):
    return [round(float(v), nd) for v in np.asarray(a).ravel()]


def np_default(o):
    """For json.dumps(default=...): convert numpy values to Python values."""
    if isinstance(o, np.generic):
        return o.item()
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")
