"""部位名付きモデル（LabeledModel）。model.py から使い、成果物一式を書き出す。"""
from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import trimesh

from .meshutil import boolean, place_on_bed, round_list, to_trimesh

# 接地面の表示色（青）と紛れないよう、青系は使わない
PALETTE = ["#F28E2B", "#59A14F", "#B07AA1", "#E15759", "#76B7B2",
           "#EDC948", "#9C755F", "#FF9DA7", "#8CD17D", "#BAB0AC"]
ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
LAYOUT_GAP_MM = 10.0


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
    parts: list | None   # None = 全部位


class LabeledModel:
    """部位（id・日本語ラベル・色・主要寸法・要件ID）付きのモデル。

    - 部位 id は英小文字のスラッグ（例: base, handle_left）。ユーザーには label（日本語）を見せる。
    - 形状は build123d の Part/Solid、manifold3d.Manifold、trimesh.Trimesh のどれでもよい。
    - 設計姿勢（使うときの向き）で作る。印刷の向きは set_print_orientation で回転として持つ。
    - 同じ print_group の部位は印刷時に 1 つに結合される。別々に印刷する部品は group を分ける。
    """

    def __init__(self, name: str, title: str | None = None):
        if not ID_RE.match(name.replace("-", "_")):
            raise ValueError("name は英小文字・数字・ハイフンのスラッグにしてください（例: pen-stand）")
        self.name = name
        self.title = title or name
        self.parts: list[Part] = []
        self.features: list[Feature] = []
        self.cuts: list[Cut] = []
        self.print_orientation: dict = {"rotation_deg": [0, 0, 0], "bed_face": "設計姿勢の底面（Z=0）"}
        self.group_orientation: dict[str, dict] = {}
        self.object_labels: dict[str, str] = {}
        self.print_note = ""

    # ------------------------------------------------------------------ 定義
    def add_part(self, id, label, shape, color=None, description="", key_dims=None,
                 requirements=None, anchor=None, print_group="main"):
        if not ID_RE.match(id):
            raise ValueError(f"部位 id は英小文字のスラッグにしてください: {id!r}")
        if any(p.id == id for p in self.parts):
            raise ValueError(f"部位 id が重複しています: {id}")
        color = color or PALETTE[len(self.parts) % len(PALETTE)]
        self.parts.append(Part(id, label, shape, color, description, dict(key_dims or {}),
                               list(requirements or []), list(anchor) if anchor is not None else None,
                               print_group))
        return self

    def add_feature(self, id, label, position, description="", requirements=None):
        """穴・溝など、独立した部位ではない「場所」にラベルを付ける。"""
        self.features.append(Feature(id, label, [float(v) for v in position], description,
                                     list(requirements or [])))
        return self

    def add_cut(self, shape, parts=None):
        """全部位（または parts で指定した部位）から削り取る形状。"""
        self.cuts.append(Cut(shape, list(parts) if parts else None))
        return self

    def set_print_orientation(self, rotation_deg=(0, 0, 0), bed_face="", group=None):
        """印刷の向き。設計姿勢を X→Y→Z の順に何度回すか（度）。group 指定でその部品だけ。"""
        cfg = {"rotation_deg": [float(a) for a in rotation_deg], "bed_face": bed_face}
        if group is None:
            self.print_orientation = cfg
        else:
            self.group_orientation[group] = cfg
        return self

    def set_object_label(self, group, label):
        """オブジェクト（print_group）の表示名。ビューアのパーツ一覧で、パーツをこの名前の下にまとめる。"""
        self.object_labels[group] = label
        return self

    # ------------------------------------------------------------------ 生成
    def _part_meshes(self) -> dict[str, trimesh.Trimesh]:
        cut_meshes = [(to_trimesh(c.shape), c.parts) for c in self.cuts]
        out = {}
        for p in self.parts:
            m = to_trimesh(p.shape)
            cuts = [cm for cm, targets in cut_meshes if targets is None or p.id in targets]
            if cuts:
                r = boolean([m, *cuts], "difference")
                if r is None:
                    raise RuntimeError(f"部位 {p.id} の切り抜きに失敗しました（形状が閉じていない可能性）")
                m = r
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

    def _export_step(self, path: Path):
        try:
            from build123d import Compound, export_step
            if not all(type(p.shape).__module__.startswith("build123d") for p in self.parts):
                return False
            if not all(type(c.shape).__module__.startswith("build123d") for c in self.cuts):
                return False
            shapes = []
            for p in self.parts:
                s = p.shape
                for c in self.cuts:
                    if c.parts is None or p.id in c.parts:
                        s = s - c.shape
                s.label = p.id
                shapes.append(s)
            export_step(Compound(children=shapes), str(path))
            return True
        except Exception:
            return False

    def build(self, where: str | Path) -> dict:
        """成果物一式を書き出す。where は model.py のパス（__file__）か出力フォルダ。

        出力:
          parts.json             部位定義（id/label/anchor/key_dims/requirements/寸法/印刷向き）
          out/parts/<id>.stl     部位ごとのメッシュ（設計姿勢）
          out/model.stl          全体（設計姿勢）
          out/model.glb          ビューア・レビュー用（部位別ノード、Z-up、extras.label_ja）
          out/model.step         build123d で作った場合のみ（CAD 編集用）
          out/print/<group>.stl  印刷姿勢（ベッドに接地、group ごとに結合済み）
          analysis.json          印刷可能性の自動計測結果
          viewer.html            確認用 3D ビューア（オフラインで開ける）
        """
        where = Path(where).resolve()
        d = where.parent if where.suffix == ".py" else where
        out = d / "out"
        if not self.parts:
            raise ValueError("部位がありません。add_part で追加してください")

        for sub in ("parts", "print"):
            if (out / sub).exists():
                shutil.rmtree(out / sub)
        (out / "parts").mkdir(parents=True, exist_ok=True)
        (out / "print").mkdir(parents=True, exist_ok=True)

        meshes = self._part_meshes()

        # ---- 設計姿勢の出力
        scene = trimesh.Scene()
        scene.metadata = {"up_axis": "Z", "units": "mm", "front_axis": "-Y", "model": self.name,
                          "title": self.title}
        for p in self.parts:
            m = meshes[p.id]
            m.export(out / "parts" / f"{p.id}.stl")
            vm = m.copy()
            rgb = [int(p.color[i:i + 2], 16) for i in (1, 3, 5)]
            vm.visual.face_colors = [*rgb, 255]
            vm.metadata = {"label_ja": p.label, "part_id": p.id}
            scene.add_geometry(vm, node_name=p.id, geom_name=p.id)
        scene.export(out / "model.glb")
        trimesh.util.concatenate(list(meshes.values())).export(out / "model.stl")
        step_ok = self._export_step(out / "model.step")

        # ---- 印刷姿勢（group ごとに結合 → 回転 → ベッドに並べる）
        groups = self._groups()
        placed, widths = {}, {}
        for g, plist in groups.items():
            gm = [meshes[p.id] for p in plist]
            fused = boolean(gm, "union") if len(gm) > 1 else gm[0]
            if fused is None:
                fused = trimesh.util.concatenate(gm)
            cfg = self.group_orientation.get(g, self.print_orientation)
            pm, M = place_on_bed(fused, cfg["rotation_deg"])
            placed[g] = (fused, cfg)
            widths[g] = float(pm.extents[0])
        total = sum(widths.values()) + LAYOUT_GAP_MM * (len(widths) - 1)
        x = -total / 2
        group_info = {}
        for g, (fused, cfg) in placed.items():
            pm, M = place_on_bed(fused, cfg["rotation_deg"], x_offset=x + widths[g] / 2)
            x += widths[g] + LAYOUT_GAP_MM
            pm.export(out / "print" / f"{g}.stl")
            group_info[g] = {"rotation_deg": cfg["rotation_deg"], "bed_face": cfg.get("bed_face", ""),
                             "matrix": [round_list(r, 6) for r in M], "parts": [p.id for p in groups[g]],
                             "size_mm": round_list(pm.extents, 2)}

        # ---- parts.json（前版は out/parts.prev.json に残す：意図しない変更の検出用）
        if (d / "parts.json").exists():
            shutil.copy2(d / "parts.json", out / "parts.prev.json")
        parts_json = {
            "model": self.name,
            "title": self.title,
            "units": "mm",
            "up_axis": "+Z",
            "front_axis": "-Y",
            "right_axis": "+X",
            "print_orientation": {**self.print_orientation, "groups": group_info},
            "objects": {g: self.object_labels.get(g, g) for g in groups},
            "print_note": self.print_note,
            "parts": [],
            "features": [f.__dict__ for f in self.features],
            "files": {"glb": "out/model.glb", "step": "out/model.step" if step_ok else None},
        }
        for p in self.parts:
            m = meshes[p.id]
            lo, hi = m.bounds
            parts_json["parts"].append({
                "id": p.id, "label": p.label, "description": p.description, "color": p.color,
                "anchor": round_list(p.anchor if p.anchor is not None else self._auto_anchor(m), 2),
                "key_dims": p.key_dims, "requirements": p.requirements, "print_group": p.print_group,
                "bbox_mm": {"min": round_list(lo), "max": round_list(hi), "size": round_list(hi - lo)},
                "volume_mm3": round(float(m.volume), 1),
                "watertight": bool(m.is_watertight),
            })
        (d / "parts.json").write_text(json.dumps(parts_json, ensure_ascii=False, indent=2), encoding="utf-8")

        # ---- 解析とビューア
        from .analyze import analyze_dir
        from .viewer import build_viewer
        analysis = analyze_dir(d)
        viewer_path = build_viewer(d)

        crit = [f for f in analysis["findings"] if f["severity"] in ("critical", "major")]
        return {
            "model_dir": str(d),
            "viewer": str(viewer_path),
            "size_mm": analysis["summary"]["size_mm"],
            "auto_check": analysis["summary"]["verdict_hint"],
            "critical_or_major": [f"{f['severity']}: {f['issue']}" for f in crit],
            "warnings": [f["issue"] for f in analysis["findings"] if f["severity"] == "warning"],
        }
