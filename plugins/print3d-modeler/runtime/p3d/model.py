"""Model with named parts (LabeledModel). Used from model.py; writes every output file."""
from __future__ import annotations

import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import trimesh

from .files import PARTS_JSON, part_stl, print_stl, write_json
from .layout import arrange, placement_matrix
from .meshutil import boolean, fuse, is_build123d, place_on_bed, round_list, to_trimesh, transformed

# No blues, so parts never get confused with the bed-contact highlight (blue)
PALETTE = ["#F28E2B", "#59A14F", "#B07AA1", "#E15759", "#76B7B2",
           "#EDC948", "#9C755F", "#FF9DA7", "#8CD17D", "#BAB0AC"]
ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")


@dataclass
class Part:
    id: str
    label: str
    shape: object
    color: str
    description: str = ""
    key_dims: dict = field(default_factory=dict)
    requirements: list = field(default_factory=list)
    anchor: list | None = None
    print_group: str = "main"


@dataclass
class Feature:
    id: str
    label: str
    position: list
    description: str = ""
    requirements: list = field(default_factory=list)


@dataclass
class Cut:
    shape: object
    parts: list | None   # None = every part

    def applies_to(self, part_id: str) -> bool:
        return self.parts is None or part_id in self.parts


def _hex_rgb(color: str) -> list[int]:
    return [int(color[i:i + 2], 16) for i in (1, 3, 5)]


class LabeledModel:
    """Model made of parts, each with an id, a display label, a color, key dimensions and requirement IDs.

    - Part ids are lowercase slugs (e.g. base, handle_left). The user sees the label, written in the user's language.
    - Shapes can be build123d Part/Solid, manifold3d.Manifold or trimesh.Trimesh.
    - Build in the design pose (as used). The print orientation is kept as a rotation via set_print_orientation.
    - Parts in the same print_group are fused into one piece for printing. Use separate groups for separate pieces.
    - lang is the viewer's UI language ("en" or "ja"). None picks it from the labels (Japanese text -> "ja").
    """

    def __init__(self, name: str, title: str | None = None, lang: str | None = None):
        if not ID_RE.match(name.replace("-", "_")):
            raise ValueError("name must be a slug of lowercase letters, digits and hyphens (e.g. pen-stand)")
        self.name = name
        self.title = title or name
        self.lang = lang
        self.parts: list[Part] = []
        self.features: list[Feature] = []
        self.cuts: list[Cut] = []
        self.print_orientation: dict = {"rotation_deg": [0, 0, 0], "bed_face": "bottom face in the design pose (Z=0)"}
        self.group_orientation: dict[str, dict] = {}
        self.object_labels: dict[str, str] = {}
        self.print_note = ""

    # ------------------------------------------------------------------ definition
    def add_part(self, id, label, shape, color=None, description="", key_dims=None,
                 requirements=None, anchor=None, print_group="main"):
        if not ID_RE.match(id):
            raise ValueError(f"Part id must be a lowercase slug: {id!r}")
        if any(p.id == id for p in self.parts):
            raise ValueError(f"Duplicate part id: {id}")
        color = color or PALETTE[len(self.parts) % len(PALETTE)]
        self.parts.append(Part(id, label, shape, color, description, dict(key_dims or {}),
                               list(requirements or []), list(anchor) if anchor is not None else None,
                               print_group))
        return self

    def add_feature(self, id, label, position, description="", requirements=None):
        """Label a location that is not a separate part, such as a hole or a groove."""
        self.features.append(Feature(id, label, [float(v) for v in position], description,
                                     list(requirements or [])))
        return self

    def add_cut(self, shape, parts=None):
        """Shape to subtract from every part (or only from the parts listed in parts)."""
        self.cuts.append(Cut(shape, list(parts) if parts else None))
        return self

    def set_print_orientation(self, rotation_deg=(0, 0, 0), bed_face="", group=None):
        """Print orientation: degrees to rotate the design pose about X, then Y, then Z. Pass group for one piece only."""
        cfg = {"rotation_deg": [float(a) for a in rotation_deg], "bed_face": bed_face}
        if group is None:
            self.print_orientation = cfg
        else:
            self.group_orientation[group] = cfg
        return self

    def set_object_label(self, group, label):
        """Display name of an object (print_group). The viewer's part list nests the parts under this name."""
        self.object_labels[group] = label
        return self

    # ------------------------------------------------------------------ geometry
    def _part_meshes(self) -> dict[str, trimesh.Trimesh]:
        """Mesh of every part with its cuts applied (design pose)."""
        cut_meshes = [(to_trimesh(c.shape), c) for c in self.cuts]
        out = {}
        for p in self.parts:
            m = to_trimesh(p.shape)
            cuts = [cm for cm, c in cut_meshes if c.applies_to(p.id)]
            if cuts:
                m = boolean([m, *cuts], "difference")
                if m is None:
                    raise RuntimeError(f"Cutting part {p.id} failed (the shape may not be closed)")
            out[p.id] = m
        return out

    def _groups(self) -> dict[str, list[Part]]:
        g: dict[str, list[Part]] = {}
        for p in self.parts:
            g.setdefault(p.print_group, []).append(p)
        return g

    @staticmethod
    def _auto_anchor(mesh: trimesh.Trimesh) -> list:
        lo, hi = mesh.bounds
        c = (lo + hi) / 2
        c[2] = lo[2] + (hi[2] - lo[2]) * 0.75
        tc = mesh.triangles_center
        return tc[np.argmin(np.linalg.norm(tc - c, axis=1))].tolist()

    # ------------------------------------------------------------------ outputs
    def _export_step(self, path: Path) -> bool:
        """STEP for CAD editing. Only possible when every part and cut is a build123d shape."""
        try:
            from build123d import Compound, export_step
            if not all(is_build123d(s) for s in [*(p.shape for p in self.parts), *(c.shape for c in self.cuts)]):
                return False
            shapes = []
            for p in self.parts:
                s = p.shape
                for c in self.cuts:
                    if c.applies_to(p.id):
                        s = s - c.shape
                s.label = p.id
                shapes.append(s)
            export_step(Compound(children=shapes), str(path))
            return True
        except Exception:
            return False

    def _write_design_outputs(self, d: Path, meshes: dict) -> bool:
        """out/parts/<id>.stl, out/model.glb, out/model.stl and out/model.step. Returns whether STEP was written."""
        out = d / "out"
        scene = trimesh.Scene()
        scene.metadata = {"up_axis": "Z", "units": "mm", "front_axis": "-Y", "model": self.name,
                          "title": self.title}
        for p in self.parts:
            m = meshes[p.id]
            m.export(part_stl(d, p.id))
            vm = m.copy()
            vm.visual.face_colors = [*_hex_rgb(p.color), 255]
            vm.metadata = {"label": p.label, "part_id": p.id}
            scene.add_geometry(vm, node_name=p.id, geom_name=p.id)
        scene.export(out / "model.glb")
        trimesh.util.concatenate(list(meshes.values())).export(out / "model.stl")
        return self._export_step(out / "model.step")

    def _write_print_outputs(self, d: Path, meshes: dict, groups: dict[str, list[Part]]) -> tuple[dict, dict]:
        """out/print/<group>.stl: each group fused, rotated and laid out on the printer's bed (p3d.layout).

        Returns (group info, layout summary for parts.json)."""
        from .printer import load_printer   # imported here so `python -m p3d.printer` stays warning-free
        printer = load_printer(d)
        posed = {}
        for g, plist in groups.items():
            fused = fuse([meshes[p.id] for p in plist])
            cfg = self.group_orientation.get(g, self.print_orientation)
            pm, M = place_on_bed(fused, cfg["rotation_deg"])
            posed[g] = (pm, M, cfg)
        lay = arrange({g: pm for g, (pm, _, _) in posed.items()}, printer["build_volume_mm"],
                      printer["part_spacing_mm"])
        info = {}
        for g, (pm, M, cfg) in posed.items():
            piece = lay["pieces"][g]
            P = placement_matrix(pm, piece, lay["plate_pitch_mm"])
            pm, M = transformed(pm, P), P @ M
            pm.export(print_stl(d, g))
            info[g] = {"rotation_deg": cfg["rotation_deg"], "bed_face": cfg.get("bed_face", ""),
                       "matrix": [round_list(r, 6) for r in M], "parts": [p.id for p in groups[g]],
                       "size_mm": round_list(pm.extents, 2), "plate": piece["plate"],
                       "bed_turn_deg": piece["turn_deg"], "bed_fit": piece["fit"]}
        summary = {"printer": printer["name"], "bed_mm": lay["bed_mm"], "spacing_mm": lay["spacing_mm"],
                   "plates": lay["plates"], "plate_pitch_mm": lay["plate_pitch_mm"]}
        return info, summary

    def _parts_json(self, meshes: dict, groups: dict, group_info: dict, layout: dict, step_ok: bool) -> dict:
        parts = []
        for p in self.parts:
            m = meshes[p.id]
            lo, hi = m.bounds
            parts.append({
                "id": p.id, "label": p.label, "description": p.description, "color": p.color,
                "anchor": round_list(p.anchor if p.anchor is not None else self._auto_anchor(m), 2),
                "key_dims": p.key_dims, "requirements": p.requirements, "print_group": p.print_group,
                "bbox_mm": {"min": round_list(lo), "max": round_list(hi), "size": round_list(hi - lo)},
                "volume_mm3": round(float(m.volume), 1),
                "watertight": bool(m.is_watertight),
            })
        return {
            "model": self.name,
            "title": self.title,
            "lang": self.lang,
            "units": "mm",
            "up_axis": "+Z",
            "front_axis": "-Y",
            "right_axis": "+X",
            "print_orientation": {**self.print_orientation, "groups": group_info},
            "print_layout": layout,
            "objects": {g: self.object_labels.get(g, g) for g in groups},
            "print_note": self.print_note,
            "parts": parts,
            "features": [f.__dict__ for f in self.features],
            "files": {"glb": "out/model.glb", "step": "out/model.step" if step_ok else None},
        }

    def build(self, where: str | Path) -> dict:
        """Write every output file. where is the path of model.py (__file__) or an output folder.

        Outputs:
          parts.json             part definitions (id/label/anchor/key_dims/requirements/size/print orientation)
          out/parts/<id>.stl     mesh per part (design pose)
          out/model.stl          whole model (design pose)
          out/model.glb          for the viewer and reviews (one node per part, Z-up, extras.label)
          out/model.step         only when built with build123d (for CAD editing)
          out/print/<group>.stl  print pose (resting on the bed, fused per group)
          analysis.json          automatic printability measurements
          viewer.html            3D viewer for checking the model (opens offline)
        """
        where = Path(where).resolve()
        d = where.parent if where.suffix == ".py" else where
        out = d / "out"
        if not self.parts:
            raise ValueError("No parts. Add some with add_part")

        for sub in ("parts", "print"):
            if (out / sub).exists():
                shutil.rmtree(out / sub)
            (out / sub).mkdir(parents=True, exist_ok=True)

        meshes = self._part_meshes()
        step_ok = self._write_design_outputs(d, meshes)
        groups = self._groups()
        group_info, layout = self._write_print_outputs(d, meshes, groups)

        # the previous parts.json is kept as out/parts.prev.json to detect unintended changes
        if (d / PARTS_JSON).exists():
            shutil.copy2(d / PARTS_JSON, out / "parts.prev.json")
        write_json(d / PARTS_JSON, self._parts_json(meshes, groups, group_info, layout, step_ok))

        from .analyze import BLOCKING, analyze_dir
        from .viewer import build_viewer
        analysis = analyze_dir(d)
        viewer_path = build_viewer(d)

        findings = analysis["findings"]
        return {
            "model_dir": str(d),
            "viewer": str(viewer_path),
            "size_mm": analysis["summary"]["size_mm"],
            "auto_check": analysis["summary"]["verdict_hint"],
            "critical_or_major": [f"{f['severity']}: {f['issue']}" for f in findings if f["severity"] in BLOCKING],
            "warnings": [f["issue"] for f in findings if f["severity"] == "warning"],
        }
