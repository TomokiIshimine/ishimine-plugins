              if (v_prev_x < -Number.EPSILON) {
                if (v_next_x < -Number.EPSILON) {
                  direction_eq = true;
                }
              } else {
                if (Math.sign(v_prev_y) === Math.sign(v_next_y)) {
                  direction_eq = true;
                }
              }
            }
            if (direction_eq) {
              v_trans_x = -v_prev_y;
              v_trans_y = v_prev_x;
              shrink_by = Math.sqrt(v_prev_lensq);
            } else {
              v_trans_x = v_prev_x;
              v_trans_y = v_prev_y;
              shrink_by = Math.sqrt(v_prev_lensq / 2);
            }
          }
          return new Vector2(v_trans_x / shrink_by, v_trans_y / shrink_by);
        }
        const contourMovements = [];
        for (let i = 0, il = contour.length, j = il - 1, k = i + 1; i < il; i++, j++, k++) {
          if (j === il) j = 0;
          if (k === il) k = 0;
          contourMovements[i] = getBevelVec(contour[i], contour[j], contour[k]);
        }
        const holesMovements = [];
        let oneHoleMovements, verticesMovements = contourMovements.concat();
        for (let h = 0, hl = holes.length; h < hl; h++) {
          const ahole = holes[h];
          oneHoleMovements = [];
          for (let i = 0, il = ahole.length, j = il - 1, k = i + 1; i < il; i++, j++, k++) {
            if (j === il) j = 0;
            if (k === il) k = 0;
            oneHoleMovements[i] = getBevelVec(ahole[i], ahole[j], ahole[k]);
          }
          holesMovements.push(oneHoleMovements);
          verticesMovements = verticesMovements.concat(oneHoleMovements);
        }
        for (let b = 0; b < bevelSegments; b++) {
          const t = b / bevelSegments;
          const z = bevelThickness * Math.cos(t * Math.PI / 2);
          const bs2 = bevelSize * Math.sin(t * Math.PI / 2) + bevelOffset;
          for (let i = 0, il = contour.length; i < il; i++) {
            const vert = scalePt2(contour[i], contourMovements[i], bs2);
            v(vert.x, vert.y, -z);
          }
          for (let h = 0, hl = holes.length; h < hl; h++) {
            const ahole = holes[h];
            oneHoleMovements = holesMovements[h];
            for (let i = 0, il = ahole.length; i < il; i++) {
              const vert = scalePt2(ahole[i], oneHoleMovements[i], bs2);
              v(vert.x, vert.y, -z);
            }
          }
        }
        const bs = bevelSize + bevelOffset;
        for (let i = 0; i < vlen; i++) {
          const vert = bevelEnabled ? scalePt2(vertices[i], verticesMovements[i], bs) : vertices[i];
          if (!extrudeByPath) {
            v(vert.x, vert.y, 0);
          } else {
            normal.copy(splineTube.normals[0]).multiplyScalar(vert.x);
            binormal.copy(splineTube.binormals[0]).multiplyScalar(vert.y);
            position2.copy(extrudePts[0]).add(normal).add(binormal);
            v(position2.x, position2.y, position2.z);
          }
        }
        for (let s = 1; s <= steps; s++) {
          for (let i = 0; i < vlen; i++) {
            const vert = bevelEnabled ? scalePt2(vertices[i], verticesMovements[i], bs) : vertices[i];
            if (!extrudeByPath) {
              v(vert.x, vert.y, depth / steps * s);
            } else {
              normal.copy(splineTube.normals[s]).multiplyScalar(vert.x);
              binormal.copy(splineTube.binormals[s]).multiplyScalar(vert.y);
              position2.copy(extrudePts[s]).add(normal).add(binormal);
              v(position2.x, position2.y, position2.z);
            }
          }
        }
        for (let b = bevelSegments - 1; b >= 0; b--) {
          const t = b / bevelSegments;
          const z = bevelThickness * Math.cos(t * Math.PI / 2);
          const bs2 = bevelSize * Math.sin(t * Math.PI / 2) + bevelOffset;
          for (let i = 0, il = contour.length; i < il; i++) {
            const vert = scalePt2(contour[i], contourMovements[i], bs2);
            v(vert.x, vert.y, depth + z);
          }
          for (let h = 0, hl = holes.length; h < hl; h++) {
            const ahole = holes[h];
            oneHoleMovements = holesMovements[h];
            for (let i = 0, il = ahole.length; i < il; i++) {
              const vert = scalePt2(ahole[i], oneHoleMovements[i], bs2);
              if (!extrudeByPath) {
                v(vert.x, vert.y, depth + z);
              } else {
                v(vert.x, vert.y + extrudePts[steps - 1].y, extrudePts[steps - 1].x + z);
              }
            }
          }
        }
        buildLidFaces();
        buildSideFaces();
        function buildLidFaces() {
          const start = verticesArray.length / 3;
          if (bevelEnabled) {
            let layer = 0;
            let offset = vlen * layer;
            for (let i = 0; i < flen; i++) {
              const face = faces[i];
              f3(face[2] + offset, face[1] + offset, face[0] + offset);
            }
            layer = steps + bevelSegments * 2;
            offset = vlen * layer;
            for (let i = 0; i < flen; i++) {
              const face = faces[i];
              f3(face[0] + offset, face[1] + offset, face[2] + offset);
            }
          } else {
            for (let i = 0; i < flen; i++) {
              const face = faces[i];
              f3(face[2], face[1], face[0]);
            }
            for (let i = 0; i < flen; i++) {
              const face = faces[i];
              f3(face[0] + vlen * steps, face[1] + vlen * steps, face[2] + vlen * steps);
            }
          }
          scope.addGroup(start, verticesArray.length / 3 - start, 0);
        }
        function buildSideFaces() {
          const start = verticesArray.length / 3;
          let layeroffset = 0;
          sidewalls(contour, layeroffset);
          layeroffset += contour.length;
          for (let h = 0, hl = holes.length; h < hl; h++) {
            const ahole = holes[h];
            sidewalls(ahole, layeroffset);
            layeroffset += ahole.length;
          }
          scope.addGroup(start, verticesArray.length / 3 - start, 1);
        }
        function sidewalls(contour2, layeroffset) {
          let i = contour2.length;
          while (--i >= 0) {
            const j = i;
            let k = i - 1;
            if (k < 0) k = contour2.length - 1;
            for (let s = 0, sl = steps + bevelSegments * 2; s < sl; s++) {
              const slen1 = vlen * s;
              const slen2 = vlen * (s + 1);
              const a = layeroffset + j + slen1, b = layeroffset + k + slen1, c = layeroffset + k + slen2, d = layeroffset + j + slen2;
              f4(a, b, c, d);
            }
          }
        }
        function v(x, y, z) {
          placeholder.push(x);
          placeholder.push(y);
          placeholder.push(z);
        }
        function f3(a, b, c) {
          addVertex(a);
          addVertex(b);
          addVertex(c);
          const nextIndex = verticesArray.length / 3;
          const uvs = uvgen.generateTopUV(scope, verticesArray, nextIndex - 3, nextIndex - 2, nextIndex - 1);
          addUV(uvs[0]);
          addUV(uvs[1]);
          addUV(uvs[2]);
        }
        function f4(a, b, c, d) {
          addVertex(a);
          addVertex(b);
          addVertex(d);
          addVertex(b);
          addVertex(c);
          addVertex(d);
          const nextIndex = verticesArray.length / 3;
          const uvs = uvgen.generateSideWallUV(scope, verticesArray, nextIndex - 6, nextIndex - 3, nextIndex - 2, nextIndex - 1);
          addUV(uvs[0]);
          addUV(uvs[1]);
          addUV(uvs[3]);
          addUV(uvs[1]);
          addUV(uvs[2]);
          addUV(uvs[3]);
        }
        function addVertex(index) {
          verticesArray.push(placeholder[index * 3 + 0]);
          verticesArray.push(placeholder[index * 3 + 1]);
          verticesArray.push(placeholder[index * 3 + 2]);
        }
        function addUV(vector2) {
          uvArray.push(vector2.x);
          uvArray.push(vector2.y);
        }
      }
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      const shapes = this.parameters.shapes;
      const options = this.parameters.options;
      return toJSON$1(shapes, options, data);
    }
    static fromJSON(data, shapes) {
      const geometryShapes = [];
      for (let j = 0, jl = data.shapes.length; j < jl; j++) {
        const shape = shapes[data.shapes[j]];
        geometryShapes.push(shape);
      }
      const extrudePath = data.options.extrudePath;
      if (extrudePath !== void 0) {
        data.options.extrudePath = new Curves[extrudePath.type]().fromJSON(extrudePath);
      }
      return new _ExtrudeGeometry(geometryShapes, data.options);
    }
  };
  var WorldUVGenerator = {
    generateTopUV: function(geometry, vertices, indexA, indexB, indexC) {
      const a_x = vertices[indexA * 3];
      const a_y = vertices[indexA * 3 + 1];
      const b_x = vertices[indexB * 3];
      const b_y = vertices[indexB * 3 + 1];
      const c_x = vertices[indexC * 3];
      const c_y = vertices[indexC * 3 + 1];
      return [
        new Vector2(a_x, a_y),
        new Vector2(b_x, b_y),
        new Vector2(c_x, c_y)
      ];
    },
    generateSideWallUV: function(geometry, vertices, indexA, indexB, indexC, indexD) {
      const a_x = vertices[indexA * 3];
      const a_y = vertices[indexA * 3 + 1];
      const a_z = vertices[indexA * 3 + 2];
      const b_x = vertices[indexB * 3];
      const b_y = vertices[indexB * 3 + 1];
      const b_z = vertices[indexB * 3 + 2];
      const c_x = vertices[indexC * 3];
      const c_y = vertices[indexC * 3 + 1];
      const c_z = vertices[indexC * 3 + 2];
      const d_x = vertices[indexD * 3];
      const d_y = vertices[indexD * 3 + 1];
      const d_z = vertices[indexD * 3 + 2];
      if (Math.abs(a_y - b_y) < Math.abs(a_x - b_x)) {
        return [
          new Vector2(a_x, 1 - a_z),
          new Vector2(b_x, 1 - b_z),
          new Vector2(c_x, 1 - c_z),
          new Vector2(d_x, 1 - d_z)
        ];
      } else {
        return [
          new Vector2(a_y, 1 - a_z),
          new Vector2(b_y, 1 - b_z),
          new Vector2(c_y, 1 - c_z),
          new Vector2(d_y, 1 - d_z)
        ];
      }
    }
  };
  function toJSON$1(shapes, options, data) {
    data.shapes = [];
    if (Array.isArray(shapes)) {
      for (let i = 0, l = shapes.length; i < l; i++) {
        const shape = shapes[i];
        data.shapes.push(shape.uuid);
      }
    } else {
      data.shapes.push(shapes.uuid);
    }
    data.options = Object.assign({}, options);
    if (options.extrudePath !== void 0) data.options.extrudePath = options.extrudePath.toJSON();
    return data;
  }
  var IcosahedronGeometry = class _IcosahedronGeometry extends PolyhedronGeometry {
    constructor(radius = 1, detail = 0) {
      const t = (1 + Math.sqrt(5)) / 2;
      const vertices = [
        -1,
        t,
        0,
        1,
        t,
        0,
        -1,
        -t,
        0,
        1,
        -t,
        0,
        0,
        -1,
        t,
        0,
        1,
        t,
        0,
        -1,
        -t,
        0,
        1,
        -t,
        t,
        0,
        -1,
        t,
        0,
        1,
        -t,
        0,
        -1,
        -t,
        0,
        1
      ];
      const indices = [
        0,
        11,
        5,
        0,
        5,
        1,
        0,
        1,
        7,
        0,
        7,
        10,
        0,
        10,
        11,
        1,
        5,
        9,
        5,
        11,
        4,
        11,
        10,
        2,
        10,
        7,
        6,
        7,
        1,
        8,
        3,
        9,
        4,
        3,
        4,
        2,
        3,
        2,
        6,
        3,
        6,
        8,
        3,
        8,
        9,
        4,
        9,
        5,
        2,
        4,
        11,
        6,
        2,
        10,
        8,
        6,
        7,
        9,
        8,
        1
      ];
      super(vertices, indices, radius, detail);
      this.type = "IcosahedronGeometry";
      this.parameters = {
        radius,
        detail
      };
    }
    static fromJSON(data) {
      return new _IcosahedronGeometry(data.radius, data.detail);
    }
  };
  var OctahedronGeometry = class _OctahedronGeometry extends PolyhedronGeometry {
    constructor(radius = 1, detail = 0) {
      const vertices = [
        1,
        0,
        0,
        -1,
        0,
        0,
        0,
        1,
        0,
        0,
        -1,
        0,
        0,
        0,
        1,
        0,
        0,
        -1
      ];
      const indices = [
        0,
        2,
        4,
        0,
        4,
        3,
        0,
        3,
        5,
        0,
        5,
        2,
        1,
        2,
        5,
        1,
        5,
        3,
        1,
        3,
        4,
        1,
        4,
        2
      ];
      super(vertices, indices, radius, detail);
      this.type = "OctahedronGeometry";
      this.parameters = {
        radius,
        detail
      };
    }
    static fromJSON(data) {
      return new _OctahedronGeometry(data.radius, data.detail);
    }
  };
  var RingGeometry = class _RingGeometry extends BufferGeometry {
    constructor(innerRadius = 0.5, outerRadius = 1, thetaSegments = 32, phiSegments = 1, thetaStart = 0, thetaLength = Math.PI * 2) {
      super();
      this.type = "RingGeometry";
      this.parameters = {
        innerRadius,
        outerRadius,
        thetaSegments,
        phiSegments,
        thetaStart,
        thetaLength
      };
      thetaSegments = Math.max(3, thetaSegments);
      phiSegments = Math.max(1, phiSegments);
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      let radius = innerRadius;
      const radiusStep = (outerRadius - innerRadius) / phiSegments;
      const vertex2 = new Vector3();
      const uv = new Vector2();
      for (let j = 0; j <= phiSegments; j++) {
        for (let i = 0; i <= thetaSegments; i++) {
          const segment = thetaStart + i / thetaSegments * thetaLength;
          vertex2.x = radius * Math.cos(segment);
          vertex2.y = radius * Math.sin(segment);
          vertices.push(vertex2.x, vertex2.y, vertex2.z);
          normals.push(0, 0, 1);
          uv.x = (vertex2.x / outerRadius + 1) / 2;
          uv.y = (vertex2.y / outerRadius + 1) / 2;
          uvs.push(uv.x, uv.y);
        }
        radius += radiusStep;
      }
      for (let j = 0; j < phiSegments; j++) {
        const thetaSegmentLevel = j * (thetaSegments + 1);
        for (let i = 0; i < thetaSegments; i++) {
          const segment = i + thetaSegmentLevel;
          const a = segment;
          const b = segment + thetaSegments + 1;
          const c = segment + thetaSegments + 2;
          const d = segment + 1;
          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    static fromJSON(data) {
      return new _RingGeometry(data.innerRadius, data.outerRadius, data.thetaSegments, data.phiSegments, data.thetaStart, data.thetaLength);
    }
  };
  var ShapeGeometry = class _ShapeGeometry extends BufferGeometry {
    constructor(shapes = new Shape([new Vector2(0, 0.5), new Vector2(-0.5, -0.5), new Vector2(0.5, -0.5)]), curveSegments = 12) {
      super();
      this.type = "ShapeGeometry";
      this.parameters = {
        shapes,
        curveSegments
      };
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      let groupStart = 0;
      let groupCount = 0;
      if (Array.isArray(shapes) === false) {
        addShape(shapes);
      } else {
        for (let i = 0; i < shapes.length; i++) {
          addShape(shapes[i]);
          this.addGroup(groupStart, groupCount, i);
          groupStart += groupCount;
          groupCount = 0;
        }
      }
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      function addShape(shape) {
        const indexOffset = vertices.length / 3;
        const points = shape.extractPoints(curveSegments);
        let shapeVertices = points.shape;
        const shapeHoles = points.holes;
        if (ShapeUtils.isClockWise(shapeVertices) === false) {
          shapeVertices = shapeVertices.reverse();
        }
        for (let i = 0, l = shapeHoles.length; i < l; i++) {
          const shapeHole = shapeHoles[i];
          if (ShapeUtils.isClockWise(shapeHole) === true) {
            shapeHoles[i] = shapeHole.reverse();
          }
        }
        const faces = ShapeUtils.triangulateShape(shapeVertices, shapeHoles);
        for (let i = 0, l = shapeHoles.length; i < l; i++) {
          const shapeHole = shapeHoles[i];
          shapeVertices = shapeVertices.concat(shapeHole);
        }
        for (let i = 0, l = shapeVertices.length; i < l; i++) {
          const vertex2 = shapeVertices[i];
          vertices.push(vertex2.x, vertex2.y, 0);
          normals.push(0, 0, 1);
          uvs.push(vertex2.x, vertex2.y);
        }
        for (let i = 0, l = faces.length; i < l; i++) {
          const face = faces[i];
          const a = face[0] + indexOffset;
          const b = face[1] + indexOffset;
          const c = face[2] + indexOffset;
          indices.push(a, b, c);
          groupCount += 3;
        }
      }
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      const shapes = this.parameters.shapes;
      return toJSON(shapes, data);
    }
    static fromJSON(data, shapes) {
      const geometryShapes = [];
      for (let j = 0, jl = data.shapes.length; j < jl; j++) {
        const shape = shapes[data.shapes[j]];
        geometryShapes.push(shape);
      }
      return new _ShapeGeometry(geometryShapes, data.curveSegments);
    }
  };
  function toJSON(shapes, data) {
    data.shapes = [];
    if (Array.isArray(shapes)) {
      for (let i = 0, l = shapes.length; i < l; i++) {
        const shape = shapes[i];
        data.shapes.push(shape.uuid);
      }
    } else {
      data.shapes.push(shapes.uuid);
    }
    return data;
  }
  var SphereGeometry = class _SphereGeometry extends BufferGeometry {
    constructor(radius = 1, widthSegments = 32, heightSegments = 16, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
      super();
      this.type = "SphereGeometry";
      this.parameters = {
        radius,
        widthSegments,
        heightSegments,
        phiStart,
        phiLength,
        thetaStart,
        thetaLength
      };
      widthSegments = Math.max(3, Math.floor(widthSegments));
      heightSegments = Math.max(2, Math.floor(heightSegments));
      const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);
      let index = 0;
      const grid = [];
      const vertex2 = new Vector3();
      const normal = new Vector3();
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      for (let iy = 0; iy <= heightSegments; iy++) {
        const verticesRow = [];
        const v = iy / heightSegments;
        let uOffset = 0;
        if (iy === 0 && thetaStart === 0) {
          uOffset = 0.5 / widthSegments;
        } else if (iy === heightSegments && thetaEnd === Math.PI) {
          uOffset = -0.5 / widthSegments;
        }
        for (let ix = 0; ix <= widthSegments; ix++) {
          const u = ix / widthSegments;
          vertex2.x = -radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
          vertex2.y = radius * Math.cos(thetaStart + v * thetaLength);
          vertex2.z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
          vertices.push(vertex2.x, vertex2.y, vertex2.z);
          normal.copy(vertex2).normalize();
          normals.push(normal.x, normal.y, normal.z);
          uvs.push(u + uOffset, 1 - v);
          verticesRow.push(index++);
        }
        grid.push(verticesRow);
      }
      for (let iy = 0; iy < heightSegments; iy++) {
        for (let ix = 0; ix < widthSegments; ix++) {
          const a = grid[iy][ix + 1];
          const b = grid[iy][ix];
          const c = grid[iy + 1][ix];
          const d = grid[iy + 1][ix + 1];
          if (iy !== 0 || thetaStart > 0) indices.push(a, b, d);
          if (iy !== heightSegments - 1 || thetaEnd < Math.PI) indices.push(b, c, d);
        }
      }
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    static fromJSON(data) {
      return new _SphereGeometry(data.radius, data.widthSegments, data.heightSegments, data.phiStart, data.phiLength, data.thetaStart, data.thetaLength);
    }
  };
  var TetrahedronGeometry = class _TetrahedronGeometry extends PolyhedronGeometry {
    constructor(radius = 1, detail = 0) {
      const vertices = [
        1,
        1,
        1,
        -1,
        -1,
        1,
        -1,
        1,
        -1,
        1,
        -1,
        -1
      ];
      const indices = [
        2,
        1,
        0,
        0,
        3,
        2,
        1,
        3,
        0,
        2,
        3,
        1
      ];
      super(vertices, indices, radius, detail);
      this.type = "TetrahedronGeometry";
      this.parameters = {
        radius,
        detail
      };
    }
    static fromJSON(data) {
      return new _TetrahedronGeometry(data.radius, data.detail);
    }
  };
  var TorusGeometry = class _TorusGeometry extends BufferGeometry {
    constructor(radius = 1, tube = 0.4, radialSegments = 12, tubularSegments = 48, arc = Math.PI * 2) {
      super();
      this.type = "TorusGeometry";
      this.parameters = {
        radius,
        tube,
        radialSegments,
        tubularSegments,
        arc
      };
      radialSegments = Math.floor(radialSegments);
      tubularSegments = Math.floor(tubularSegments);
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      const center = new Vector3();
      const vertex2 = new Vector3();
      const normal = new Vector3();
      for (let j = 0; j <= radialSegments; j++) {
        for (let i = 0; i <= tubularSegments; i++) {
          const u = i / tubularSegments * arc;
          const v = j / radialSegments * Math.PI * 2;
          vertex2.x = (radius + tube * Math.cos(v)) * Math.cos(u);
          vertex2.y = (radius + tube * Math.cos(v)) * Math.sin(u);
          vertex2.z = tube * Math.sin(v);
          vertices.push(vertex2.x, vertex2.y, vertex2.z);
          center.x = radius * Math.cos(u);
          center.y = radius * Math.sin(u);
          normal.subVectors(vertex2, center).normalize();
          normals.push(normal.x, normal.y, normal.z);
          uvs.push(i / tubularSegments);
          uvs.push(j / radialSegments);
        }
      }
      for (let j = 1; j <= radialSegments; j++) {
        for (let i = 1; i <= tubularSegments; i++) {
          const a = (tubularSegments + 1) * j + i - 1;
          const b = (tubularSegments + 1) * (j - 1) + i - 1;
          const c = (tubularSegments + 1) * (j - 1) + i;
          const d = (tubularSegments + 1) * j + i;
          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    static fromJSON(data) {
      return new _TorusGeometry(data.radius, data.tube, data.radialSegments, data.tubularSegments, data.arc);
    }
  };
  var TorusKnotGeometry = class _TorusKnotGeometry extends BufferGeometry {
    constructor(radius = 1, tube = 0.4, tubularSegments = 64, radialSegments = 8, p = 2, q = 3) {
      super();
      this.type = "TorusKnotGeometry";
      this.parameters = {
        radius,
        tube,
        tubularSegments,
        radialSegments,
        p,
        q
      };
      tubularSegments = Math.floor(tubularSegments);
      radialSegments = Math.floor(radialSegments);
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      const vertex2 = new Vector3();
      const normal = new Vector3();
      const P1 = new Vector3();
      const P2 = new Vector3();
      const B = new Vector3();
      const T = new Vector3();
      const N = new Vector3();
      for (let i = 0; i <= tubularSegments; ++i) {
        const u = i / tubularSegments * p * Math.PI * 2;
        calculatePositionOnCurve(u, p, q, radius, P1);
        calculatePositionOnCurve(u + 0.01, p, q, radius, P2);
        T.subVectors(P2, P1);
        N.addVectors(P2, P1);
        B.crossVectors(T, N);
        N.crossVectors(B, T);
        B.normalize();
        N.normalize();
        for (let j = 0; j <= radialSegments; ++j) {
          const v = j / radialSegments * Math.PI * 2;
          const cx = -tube * Math.cos(v);
          const cy = tube * Math.sin(v);
          vertex2.x = P1.x + (cx * N.x + cy * B.x);
          vertex2.y = P1.y + (cx * N.y + cy * B.y);
          vertex2.z = P1.z + (cx * N.z + cy * B.z);
          vertices.push(vertex2.x, vertex2.y, vertex2.z);
          normal.subVectors(vertex2, P1).normalize();
          normals.push(normal.x, normal.y, normal.z);
          uvs.push(i / tubularSegments);
          uvs.push(j / radialSegments);
        }
      }
      for (let j = 1; j <= tubularSegments; j++) {
        for (let i = 1; i <= radialSegments; i++) {
          const a = (radialSegments + 1) * (j - 1) + (i - 1);
          const b = (radialSegments + 1) * j + (i - 1);
          const c = (radialSegments + 1) * j + i;
          const d = (radialSegments + 1) * (j - 1) + i;
          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      function calculatePositionOnCurve(u, p2, q2, radius2, position) {
        const cu = Math.cos(u);
        const su = Math.sin(u);
        const quOverP = q2 / p2 * u;
        const cs = Math.cos(quOverP);
        position.x = radius2 * (2 + cs) * 0.5 * cu;
        position.y = radius2 * (2 + cs) * su * 0.5;
        position.z = radius2 * Math.sin(quOverP) * 0.5;
      }
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    static fromJSON(data) {
      return new _TorusKnotGeometry(data.radius, data.tube, data.tubularSegments, data.radialSegments, data.p, data.q);
    }
  };
  var TubeGeometry = class _TubeGeometry extends BufferGeometry {
    constructor(path = new QuadraticBezierCurve3(new Vector3(-1, -1, 0), new Vector3(-1, 1, 0), new Vector3(1, 1, 0)), tubularSegments = 64, radius = 1, radialSegments = 8, closed = false) {
      super();
      this.type = "TubeGeometry";
      this.parameters = {
        path,
        tubularSegments,
        radius,
        radialSegments,
        closed
      };
      const frames = path.computeFrenetFrames(tubularSegments, closed);
      this.tangents = frames.tangents;
      this.normals = frames.normals;
      this.binormals = frames.binormals;
      const vertex2 = new Vector3();
      const normal = new Vector3();
      const uv = new Vector2();
      let P = new Vector3();
      const vertices = [];
      const normals = [];
      const uvs = [];
      const indices = [];
      generateBufferData();
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      function generateBufferData() {
        for (let i = 0; i < tubularSegments; i++) {
          generateSegment(i);
        }
        generateSegment(closed === false ? tubularSegments : 0);
        generateUVs();
        generateIndices();
      }
      function generateSegment(i) {
        P = path.getPointAt(i / tubularSegments, P);
        const N = frames.normals[i];
        const B = frames.binormals[i];
        for (let j = 0; j <= radialSegments; j++) {
          const v = j / radialSegments * Math.PI * 2;
          const sin = Math.sin(v);
          const cos = -Math.cos(v);
          normal.x = cos * N.x + sin * B.x;
          normal.y = cos * N.y + sin * B.y;
          normal.z = cos * N.z + sin * B.z;
          normal.normalize();
          normals.push(normal.x, normal.y, normal.z);
          vertex2.x = P.x + radius * normal.x;
          vertex2.y = P.y + radius * normal.y;
          vertex2.z = P.z + radius * normal.z;
          vertices.push(vertex2.x, vertex2.y, vertex2.z);
        }
      }
      function generateIndices() {
        for (let j = 1; j <= tubularSegments; j++) {
          for (let i = 1; i <= radialSegments; i++) {
            const a = (radialSegments + 1) * (j - 1) + (i - 1);
            const b = (radialSegments + 1) * j + (i - 1);
            const c = (radialSegments + 1) * j + i;
            const d = (radialSegments + 1) * (j - 1) + i;
            indices.push(a, b, d);
            indices.push(b, c, d);
          }
        }
      }
      function generateUVs() {
        for (let i = 0; i <= tubularSegments; i++) {
          for (let j = 0; j <= radialSegments; j++) {
            uv.x = i / tubularSegments;
            uv.y = j / radialSegments;
            uvs.push(uv.x, uv.y);
          }
        }
      }
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.path = this.parameters.path.toJSON();
      return data;
    }
    static fromJSON(data) {
      return new _TubeGeometry(
        new Curves[data.path.type]().fromJSON(data.path),
        data.tubularSegments,
        data.radius,
        data.radialSegments,
        data.closed
      );
    }
  };
  var WireframeGeometry = class extends BufferGeometry {
    constructor(geometry = null) {
      super();
      this.type = "WireframeGeometry";
      this.parameters = {
        geometry
      };
      if (geometry !== null) {
        const vertices = [];
        const edges = /* @__PURE__ */ new Set();
        const start = new Vector3();
        const end = new Vector3();
        if (geometry.index !== null) {
          const position = geometry.attributes.position;
          const indices = geometry.index;
          let groups = geometry.groups;
          if (groups.length === 0) {
            groups = [{ start: 0, count: indices.count, materialIndex: 0 }];
          }
          for (let o = 0, ol = groups.length; o < ol; ++o) {
            const group = groups[o];
            const groupStart = group.start;
            const groupCount = group.count;
            for (let i = groupStart, l = groupStart + groupCount; i < l; i += 3) {
              for (let j = 0; j < 3; j++) {
                const index1 = indices.getX(i + j);
                const index2 = indices.getX(i + (j + 1) % 3);
                start.fromBufferAttribute(position, index1);
                end.fromBufferAttribute(position, index2);
                if (isUniqueEdge(start, end, edges) === true) {
                  vertices.push(start.x, start.y, start.z);
                  vertices.push(end.x, end.y, end.z);
                }
              }
            }
          }
        } else {
          const position = geometry.attributes.position;
          for (let i = 0, l = position.count / 3; i < l; i++) {
            for (let j = 0; j < 3; j++) {
              const index1 = 3 * i + j;
              const index2 = 3 * i + (j + 1) % 3;
              start.fromBufferAttribute(position, index1);
              end.fromBufferAttribute(position, index2);
              if (isUniqueEdge(start, end, edges) === true) {
                vertices.push(start.x, start.y, start.z);
                vertices.push(end.x, end.y, end.z);
              }
            }
          }
        }
        this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      }
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
  };
  function isUniqueEdge(start, end, edges) {
    const hash1 = `${start.x},${start.y},${start.z}-${end.x},${end.y},${end.z}`;
    const hash2 = `${end.x},${end.y},${end.z}-${start.x},${start.y},${start.z}`;
    if (edges.has(hash1) === true || edges.has(hash2) === true) {
      return false;
    } else {
      edges.add(hash1);
      edges.add(hash2);
      return true;
    }
  }
  var Geometries = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    BoxGeometry,
    CapsuleGeometry,
    CircleGeometry,
    ConeGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    EdgesGeometry,
    ExtrudeGeometry,
    IcosahedronGeometry,
    LatheGeometry,
    OctahedronGeometry,
    PlaneGeometry,
    PolyhedronGeometry,
    RingGeometry,
    ShapeGeometry,
    SphereGeometry,
    TetrahedronGeometry,
    TorusGeometry,
    TorusKnotGeometry,
    TubeGeometry,
    WireframeGeometry
  });
  var ShadowMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isShadowMaterial = true;
      this.type = "ShadowMaterial";
      this.color = new Color(0);
      this.transparent = true;
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.color.copy(source.color);
      this.fog = source.fog;
      return this;
    }
  };
  var RawShaderMaterial = class extends ShaderMaterial {
    constructor(parameters) {
      super(parameters);
      this.isRawShaderMaterial = true;
      this.type = "RawShaderMaterial";
    }
  };
  var MeshStandardMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isMeshStandardMaterial = true;
      this.defines = { "STANDARD": "" };
      this.type = "MeshStandardMaterial";
      this.color = new Color(16777215);
      this.roughness = 1;
      this.metalness = 0;
      this.map = null;
      this.lightMap = null;
      this.lightMapIntensity = 1;
      this.aoMap = null;
      this.aoMapIntensity = 1;
      this.emissive = new Color(0);
      this.emissiveIntensity = 1;
      this.emissiveMap = null;
      this.bumpMap = null;
      this.bumpScale = 1;
      this.normalMap = null;
      this.normalMapType = TangentSpaceNormalMap;
      this.normalScale = new Vector2(1, 1);
      this.displacementMap = null;
      this.displacementScale = 1;
      this.displacementBias = 0;
      this.roughnessMap = null;
      this.metalnessMap = null;
      this.alphaMap = null;
      this.envMap = null;
      this.envMapIntensity = 1;
      this.wireframe = false;
      this.wireframeLinewidth = 1;
      this.wireframeLinecap = "round";
      this.wireframeLinejoin = "round";
      this.flatShading = false;
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.defines = { "STANDARD": "" };
      this.color.copy(source.color);
      this.roughness = source.roughness;
      this.metalness = source.metalness;
      this.map = source.map;
      this.lightMap = source.lightMap;
      this.lightMapIntensity = source.lightMapIntensity;
      this.aoMap = source.aoMap;
      this.aoMapIntensity = source.aoMapIntensity;
      this.emissive.copy(source.emissive);
      this.emissiveMap = source.emissiveMap;
      this.emissiveIntensity = source.emissiveIntensity;
      this.bumpMap = source.bumpMap;
      this.bumpScale = source.bumpScale;
      this.normalMap = source.normalMap;
      this.normalMapType = source.normalMapType;
      this.normalScale.copy(source.normalScale);
      this.displacementMap = source.displacementMap;
      this.displacementScale = source.displacementScale;
      this.displacementBias = source.displacementBias;
      this.roughnessMap = source.roughnessMap;
      this.metalnessMap = source.metalnessMap;
      this.alphaMap = source.alphaMap;
      this.envMap = source.envMap;
      this.envMapIntensity = source.envMapIntensity;
      this.wireframe = source.wireframe;
      this.wireframeLinewidth = source.wireframeLinewidth;
      this.wireframeLinecap = source.wireframeLinecap;
      this.wireframeLinejoin = source.wireframeLinejoin;
      this.flatShading = source.flatShading;
      this.fog = source.fog;
      return this;
    }
  };
  var MeshPhysicalMaterial = class extends MeshStandardMaterial {
    constructor(parameters) {
      super();
      this.isMeshPhysicalMaterial = true;
      this.defines = {
        "STANDARD": "",
        "PHYSICAL": ""
      };
      this.type = "MeshPhysicalMaterial";
      this.anisotropyRotation = 0;
      this.anisotropyMap = null;
      this.clearcoatMap = null;
      this.clearcoatRoughness = 0;
      this.clearcoatRoughnessMap = null;
      this.clearcoatNormalScale = new Vector2(1, 1);
      this.clearcoatNormalMap = null;
      this.ior = 1.5;
      Object.defineProperty(this, "reflectivity", {
        get: function() {
          return clamp(2.5 * (this.ior - 1) / (this.ior + 1), 0, 1);
        },
        set: function(reflectivity) {
          this.ior = (1 + 0.4 * reflectivity) / (1 - 0.4 * reflectivity);
        }
      });
      this.iridescenceMap = null;
      this.iridescenceIOR = 1.3;
      this.iridescenceThicknessRange = [100, 400];
      this.iridescenceThicknessMap = null;
      this.sheenColor = new Color(0);
      this.sheenColorMap = null;
      this.sheenRoughness = 1;
      this.sheenRoughnessMap = null;
      this.transmissionMap = null;
      this.thickness = 0;
      this.thicknessMap = null;
      this.attenuationDistance = Infinity;
      this.attenuationColor = new Color(1, 1, 1);
      this.specularIntensity = 1;
      this.specularIntensityMap = null;
      this.specularColor = new Color(1, 1, 1);
      this.specularColorMap = null;
      this._anisotropy = 0;
      this._clearcoat = 0;
      this._iridescence = 0;
      this._sheen = 0;
      this._transmission = 0;
      this.setValues(parameters);
    }
    get anisotropy() {
      return this._anisotropy;
    }
    set anisotropy(value) {
      if (this._anisotropy > 0 !== value > 0) {
        this.version++;
      }
      this._anisotropy = value;
    }
    get clearcoat() {
      return this._clearcoat;
    }
    set clearcoat(value) {
      if (this._clearcoat > 0 !== value > 0) {
        this.version++;
      }
      this._clearcoat = value;
    }
    get iridescence() {
      return this._iridescence;
    }
    set iridescence(value) {
      if (this._iridescence > 0 !== value > 0) {
        this.version++;
      }
      this._iridescence = value;
    }
    get sheen() {
      return this._sheen;
    }
    set sheen(value) {
      if (this._sheen > 0 !== value > 0) {
        this.version++;
      }
      this._sheen = value;
    }
    get transmission() {
      return this._transmission;
    }
    set transmission(value) {
      if (this._transmission > 0 !== value > 0) {
        this.version++;
      }
      this._transmission = value;
    }
    copy(source) {
      super.copy(source);
      this.defines = {
        "STANDARD": "",
        "PHYSICAL": ""
      };
      this.anisotropy = source.anisotropy;
      this.anisotropyRotation = source.anisotropyRotation;
      this.anisotropyMap = source.anisotropyMap;
      this.clearcoat = source.clearcoat;
      this.clearcoatMap = source.clearcoatMap;
      this.clearcoatRoughness = source.clearcoatRoughness;
      this.clearcoatRoughnessMap = source.clearcoatRoughnessMap;
      this.clearcoatNormalMap = source.clearcoatNormalMap;
      this.clearcoatNormalScale.copy(source.clearcoatNormalScale);
      this.ior = source.ior;
      this.iridescence = source.iridescence;
      this.iridescenceMap = source.iridescenceMap;
      this.iridescenceIOR = source.iridescenceIOR;
      this.iridescenceThicknessRange = [...source.iridescenceThicknessRange];
      this.iridescenceThicknessMap = source.iridescenceThicknessMap;
      this.sheen = source.sheen;
      this.sheenColor.copy(source.sheenColor);
      this.sheenColorMap = source.sheenColorMap;
      this.sheenRoughness = source.sheenRoughness;
      this.sheenRoughnessMap = source.sheenRoughnessMap;
      this.transmission = source.transmission;
      this.transmissionMap = source.transmissionMap;
      this.thickness = source.thickness;
      this.thicknessMap = source.thicknessMap;
      this.attenuationDistance = source.attenuationDistance;
      this.attenuationColor.copy(source.attenuationColor);
      this.specularIntensity = source.specularIntensity;
      this.specularIntensityMap = source.specularIntensityMap;
      this.specularColor.copy(source.specularColor);
      this.specularColorMap = source.specularColorMap;
      return this;
    }
  };
  var MeshPhongMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isMeshPhongMaterial = true;
      this.type = "MeshPhongMaterial";
      this.color = new Color(16777215);
      this.specular = new Color(1118481);
      this.shininess = 30;
      this.map = null;
      this.lightMap = null;
      this.lightMapIntensity = 1;
      this.aoMap = null;
      this.aoMapIntensity = 1;
      this.emissive = new Color(0);
      this.emissiveIntensity = 1;
      this.emissiveMap = null;
      this.bumpMap = null;
      this.bumpScale = 1;
      this.normalMap = null;
      this.normalMapType = TangentSpaceNormalMap;
      this.normalScale = new Vector2(1, 1);
      this.displacementMap = null;
      this.displacementScale = 1;
      this.displacementBias = 0;
      this.specularMap = null;
      this.alphaMap = null;
      this.envMap = null;
      this.combine = MultiplyOperation;
      this.reflectivity = 1;
      this.refractionRatio = 0.98;
      this.wireframe = false;
      this.wireframeLinewidth = 1;
      this.wireframeLinecap = "round";
      this.wireframeLinejoin = "round";
      this.flatShading = false;
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.color.copy(source.color);
      this.specular.copy(source.specular);
      this.shininess = source.shininess;
      this.map = source.map;
      this.lightMap = source.lightMap;
      this.lightMapIntensity = source.lightMapIntensity;
      this.aoMap = source.aoMap;
      this.aoMapIntensity = source.aoMapIntensity;
      this.emissive.copy(source.emissive);
      this.emissiveMap = source.emissiveMap;
      this.emissiveIntensity = source.emissiveIntensity;
      this.bumpMap = source.bumpMap;
      this.bumpScale = source.bumpScale;
      this.normalMap = source.normalMap;
      this.normalMapType = source.normalMapType;
      this.normalScale.copy(source.normalScale);
      this.displacementMap = source.displacementMap;
      this.displacementScale = source.displacementScale;
      this.displacementBias = source.displacementBias;
      this.specularMap = source.specularMap;
      this.alphaMap = source.alphaMap;
      this.envMap = source.envMap;
      this.combine = source.combine;
      this.reflectivity = source.reflectivity;
      this.refractionRatio = source.refractionRatio;
      this.wireframe = source.wireframe;
      this.wireframeLinewidth = source.wireframeLinewidth;
      this.wireframeLinecap = source.wireframeLinecap;
      this.wireframeLinejoin = source.wireframeLinejoin;
      this.flatShading = source.flatShading;
      this.fog = source.fog;
      return this;
    }
  };
  var MeshToonMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isMeshToonMaterial = true;
      this.defines = { "TOON": "" };
      this.type = "MeshToonMaterial";
      this.color = new Color(16777215);
      this.map = null;
      this.gradientMap = null;
      this.lightMap = null;
      this.lightMapIntensity = 1;
      this.aoMap = null;
      this.aoMapIntensity = 1;
      this.emissive = new Color(0);
      this.emissiveIntensity = 1;
      this.emissiveMap = null;
      this.bumpMap = null;
      this.bumpScale = 1;
      this.normalMap = null;
      this.normalMapType = TangentSpaceNormalMap;
      this.normalScale = new Vector2(1, 1);
      this.displacementMap = null;
      this.displacementScale = 1;
      this.displacementBias = 0;
      this.alphaMap = null;
      this.wireframe = false;
      this.wireframeLinewidth = 1;
      this.wireframeLinecap = "round";
      this.wireframeLinejoin = "round";
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.color.copy(source.color);
      this.map = source.map;
      this.gradientMap = source.gradientMap;
      this.lightMap = source.lightMap;
      this.lightMapIntensity = source.lightMapIntensity;
      this.aoMap = source.aoMap;
      this.aoMapIntensity = source.aoMapIntensity;
      this.emissive.copy(source.emissive);
      this.emissiveMap = source.emissiveMap;
      this.emissiveIntensity = source.emissiveIntensity;
      this.bumpMap = source.bumpMap;
      this.bumpScale = source.bumpScale;
      this.normalMap = source.normalMap;
      this.normalMapType = source.normalMapType;
      this.normalScale.copy(source.normalScale);
      this.displacementMap = source.displacementMap;
      this.displacementScale = source.displacementScale;
      this.displacementBias = source.displacementBias;
      this.alphaMap = source.alphaMap;
      this.wireframe = source.wireframe;
      this.wireframeLinewidth = source.wireframeLinewidth;
      this.wireframeLinecap = source.wireframeLinecap;
      this.wireframeLinejoin = source.wireframeLinejoin;
      this.fog = source.fog;
      return this;
    }
  };
  var MeshNormalMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isMeshNormalMaterial = true;
      this.type = "MeshNormalMaterial";
      this.bumpMap = null;
      this.bumpScale = 1;
      this.normalMap = null;
      this.normalMapType = TangentSpaceNormalMap;
      this.normalScale = new Vector2(1, 1);
      this.displacementMap = null;
      this.displacementScale = 1;
      this.displacementBias = 0;
      this.wireframe = false;
      this.wireframeLinewidth = 1;
      this.flatShading = false;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.bumpMap = source.bumpMap;
      this.bumpScale = source.bumpScale;
      this.normalMap = source.normalMap;
      this.normalMapType = source.normalMapType;
      this.normalScale.copy(source.normalScale);
      this.displacementMap = source.displacementMap;
      this.displacementScale = source.displacementScale;
      this.displacementBias = source.displacementBias;
      this.wireframe = source.wireframe;
      this.wireframeLinewidth = source.wireframeLinewidth;
      this.flatShading = source.flatShading;
      return this;
    }
  };
  var MeshLambertMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isMeshLambertMaterial = true;
      this.type = "MeshLambertMaterial";
      this.color = new Color(16777215);
      this.map = null;
      this.lightMap = null;
      this.lightMapIntensity = 1;
      this.aoMap = null;
      this.aoMapIntensity = 1;
      this.emissive = new Color(0);
      this.emissiveIntensity = 1;
      this.emissiveMap = null;
      this.bumpMap = null;
      this.bumpScale = 1;
      this.normalMap = null;
      this.normalMapType = TangentSpaceNormalMap;
      this.normalScale = new Vector2(1, 1);
      this.displacementMap = null;
      this.displacementScale = 1;
      this.displacementBias = 0;
      this.specularMap = null;
      this.alphaMap = null;
      this.envMap = null;
      this.combine = MultiplyOperation;
      this.reflectivity = 1;
      this.refractionRatio = 0.98;
      this.wireframe = false;
      this.wireframeLinewidth = 1;
      this.wireframeLinecap = "round";
      this.wireframeLinejoin = "round";
      this.flatShading = false;
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.color.copy(source.color);
      this.map = source.map;
      this.lightMap = source.lightMap;
      this.lightMapIntensity = source.lightMapIntensity;
      this.aoMap = source.aoMap;
      this.aoMapIntensity = source.aoMapIntensity;
      this.emissive.copy(source.emissive);
      this.emissiveMap = source.emissiveMap;
      this.emissiveIntensity = source.emissiveIntensity;
      this.bumpMap = source.bumpMap;
      this.bumpScale = source.bumpScale;
      this.normalMap = source.normalMap;
      this.normalMapType = source.normalMapType;
      this.normalScale.copy(source.normalScale);
      this.displacementMap = source.displacementMap;
      this.displacementScale = source.displacementScale;
      this.displacementBias = source.displacementBias;
      this.specularMap = source.specularMap;
      this.alphaMap = source.alphaMap;
      this.envMap = source.envMap;
      this.combine = source.combine;
      this.reflectivity = source.reflectivity;
      this.refractionRatio = source.refractionRatio;
      this.wireframe = source.wireframe;
      this.wireframeLinewidth = source.wireframeLinewidth;
      this.wireframeLinecap = source.wireframeLinecap;
      this.wireframeLinejoin = source.wireframeLinejoin;
      this.flatShading = source.flatShading;
      this.fog = source.fog;
      return this;
    }
  };
  var MeshMatcapMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isMeshMatcapMaterial = true;
      this.defines = { "MATCAP": "" };
      this.type = "MeshMatcapMaterial";
      this.color = new Color(16777215);
      this.matcap = null;
      this.map = null;
      this.bumpMap = null;
      this.bumpScale = 1;
      this.normalMap = null;
      this.normalMapType = TangentSpaceNormalMap;
      this.normalScale = new Vector2(1, 1);
      this.displacementMap = null;
      this.displacementScale = 1;
      this.displacementBias = 0;
      this.alphaMap = null;
      this.flatShading = false;
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.defines = { "MATCAP": "" };
      this.color.copy(source.color);
      this.matcap = source.matcap;
      this.map = source.map;
      this.bumpMap = source.bumpMap;
      this.bumpScale = source.bumpScale;
      this.normalMap = source.normalMap;
      this.normalMapType = source.normalMapType;
      this.normalScale.copy(source.normalScale);
      this.displacementMap = source.displacementMap;
      this.displacementScale = source.displacementScale;
      this.displacementBias = source.displacementBias;
      this.alphaMap = source.alphaMap;
      this.flatShading = source.flatShading;
      this.fog = source.fog;
      return this;
    }
  };
  var LineDashedMaterial = class extends LineBasicMaterial {
    constructor(parameters) {
      super();
      this.isLineDashedMaterial = true;
      this.type = "LineDashedMaterial";
      this.scale = 1;
      this.dashSize = 3;
      this.gapSize = 1;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.scale = source.scale;
      this.dashSize = source.dashSize;
      this.gapSize = source.gapSize;
      return this;
    }
  };
  function convertArray(array, type, forceClone) {
    if (!array || // let 'undefined' and 'null' pass
    !forceClone && array.constructor === type) return array;
    if (typeof type.BYTES_PER_ELEMENT === "number") {
      return new type(array);
    }
    return Array.prototype.slice.call(array);
  }
  function isTypedArray(object) {
    return ArrayBuffer.isView(object) && !(object instanceof DataView);
  }
  function getKeyframeOrder(times) {
    function compareTime(i, j) {
      return times[i] - times[j];
    }
    const n = times.length;
    const result = new Array(n);
    for (let i = 0; i !== n; ++i) result[i] = i;
    result.sort(compareTime);
    return result;
  }
  function sortedArray(values, stride, order) {
    const nValues = values.length;
    const result = new values.constructor(nValues);
    for (let i = 0, dstOffset = 0; dstOffset !== nValues; ++i) {
      const srcOffset = order[i] * stride;
      for (let j = 0; j !== stride; ++j) {
        result[dstOffset++] = values[srcOffset + j];
      }
    }
    return result;
  }
  function flattenJSON(jsonKeys, times, values, valuePropertyName) {
    let i = 1, key = jsonKeys[0];
    while (key !== void 0 && key[valuePropertyName] === void 0) {
      key = jsonKeys[i++];
    }
    if (key === void 0) return;
    let value = key[valuePropertyName];
    if (value === void 0) return;
    if (Array.isArray(value)) {
      do {
        value = key[valuePropertyName];
        if (value !== void 0) {
          times.push(key.time);
          values.push.apply(values, value);
        }
        key = jsonKeys[i++];
      } while (key !== void 0);
    } else if (value.toArray !== void 0) {
      do {
        value = key[valuePropertyName];
        if (value !== void 0) {
          times.push(key.time);
          value.toArray(values, values.length);
        }
        key = jsonKeys[i++];
      } while (key !== void 0);
    } else {
      do {
        value = key[valuePropertyName];
        if (value !== void 0) {
          times.push(key.time);
          values.push(value);
        }
        key = jsonKeys[i++];
      } while (key !== void 0);
    }
  }
  function subclip(sourceClip, name, startFrame, endFrame, fps = 30) {
    const clip = sourceClip.clone();
    clip.name = name;
    const tracks = [];
    for (let i = 0; i < clip.tracks.length; ++i) {
      const track = clip.tracks[i];
      const valueSize = track.getValueSize();
      const times = [];
      const values = [];
      for (let j = 0; j < track.times.length; ++j) {
        const frame = track.times[j] * fps;
        if (frame < startFrame || frame >= endFrame) continue;
        times.push(track.times[j]);
        for (let k = 0; k < valueSize; ++k) {
          values.push(track.values[j * valueSize + k]);
        }
      }
      if (times.length === 0) continue;
      track.times = convertArray(times, track.times.constructor);
      track.values = convertArray(values, track.values.constructor);
      tracks.push(track);
    }
    clip.tracks = tracks;
    let minStartTime = Infinity;
    for (let i = 0; i < clip.tracks.length; ++i) {
      if (minStartTime > clip.tracks[i].times[0]) {
        minStartTime = clip.tracks[i].times[0];
      }
    }
    for (let i = 0; i < clip.tracks.length; ++i) {
      clip.tracks[i].shift(-1 * minStartTime);
    }
    clip.resetDuration();
    return clip;
  }
  function makeClipAdditive(targetClip, referenceFrame = 0, referenceClip = targetClip, fps = 30) {
    if (fps <= 0) fps = 30;
    const numTracks = referenceClip.tracks.length;
    const referenceTime = referenceFrame / fps;
    for (let i = 0; i < numTracks; ++i) {
      const referenceTrack = referenceClip.tracks[i];
      const referenceTrackType = referenceTrack.ValueTypeName;
      if (referenceTrackType === "bool" || referenceTrackType === "string") continue;
      const targetTrack = targetClip.tracks.find(function(track) {
        return track.name === referenceTrack.name && track.ValueTypeName === referenceTrackType;
      });
      if (targetTrack === void 0) continue;
      let referenceOffset = 0;
      const referenceValueSize = referenceTrack.getValueSize();
      if (referenceTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) {
        referenceOffset = referenceValueSize / 3;
      }
      let targetOffset = 0;
      const targetValueSize = targetTrack.getValueSize();
      if (targetTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) {
        targetOffset = targetValueSize / 3;
      }
      const lastIndex = referenceTrack.times.length - 1;
      let referenceValue;
      if (referenceTime <= referenceTrack.times[0]) {
        const startIndex = referenceOffset;
        const endIndex = referenceValueSize - referenceOffset;
        referenceValue = referenceTrack.values.slice(startIndex, endIndex);
      } else if (referenceTime >= referenceTrack.times[lastIndex]) {
        const startIndex = lastIndex * referenceValueSize + referenceOffset;
        const endIndex = startIndex + referenceValueSize - referenceOffset;
        referenceValue = referenceTrack.values.slice(startIndex, endIndex);
      } else {
        const interpolant = referenceTrack.createInterpolant();
        const startIndex = referenceOffset;
        const endIndex = referenceValueSize - referenceOffset;
        interpolant.evaluate(referenceTime);
        referenceValue = interpolant.resultBuffer.slice(startIndex, endIndex);
      }
      if (referenceTrackType === "quaternion") {
        const referenceQuat = new Quaternion().fromArray(referenceValue).normalize().conjugate();
        referenceQuat.toArray(referenceValue);
      }
      const numTimes = targetTrack.times.length;
      for (let j = 0; j < numTimes; ++j) {
        const valueStart = j * targetValueSize + targetOffset;
        if (referenceTrackType === "quaternion") {
          Quaternion.multiplyQuaternionsFlat(
            targetTrack.values,
            valueStart,
            referenceValue,
            0,
            targetTrack.values,
            valueStart
          );
        } else {
          const valueEnd = targetValueSize - targetOffset * 2;
          for (let k = 0; k < valueEnd; ++k) {
            targetTrack.values[valueStart + k] -= referenceValue[k];
          }
        }
      }
    }
    targetClip.blendMode = AdditiveAnimationBlendMode;
    return targetClip;
  }
  var AnimationUtils = {
    convertArray,
    isTypedArray,
    getKeyframeOrder,
    sortedArray,
    flattenJSON,
    subclip,
    makeClipAdditive
  };
  var Interpolant = class {
    constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
      this.parameterPositions = parameterPositions;
      this._cachedIndex = 0;
      this.resultBuffer = resultBuffer !== void 0 ? resultBuffer : new sampleValues.constructor(sampleSize);
      this.sampleValues = sampleValues;
      this.valueSize = sampleSize;
      this.settings = null;
      this.DefaultSettings_ = {};
    }
    evaluate(t) {
      const pp = this.parameterPositions;
      let i1 = this._cachedIndex, t1 = pp[i1], t0 = pp[i1 - 1];
      validate_interval: {
        seek: {
          let right;
          linear_scan: {
            forward_scan: if (!(t < t1)) {
              for (let giveUpAt = i1 + 2; ; ) {
                if (t1 === void 0) {
                  if (t < t0) break forward_scan;
                  i1 = pp.length;
                  this._cachedIndex = i1;
                  return this.copySampleValue_(i1 - 1);
                }
                if (i1 === giveUpAt) break;
                t0 = t1;
                t1 = pp[++i1];
                if (t < t1) {
                  break seek;
                }
              }
              right = pp.length;
              break linear_scan;
            }
            if (!(t >= t0)) {
              const t1global = pp[1];
              if (t < t1global) {
                i1 = 2;
                t0 = t1global;
              }
              for (let giveUpAt = i1 - 2; ; ) {
                if (t0 === void 0) {
                  this._cachedIndex = 0;
                  return this.copySampleValue_(0);
                }
                if (i1 === giveUpAt) break;
                t1 = t0;
                t0 = pp[--i1 - 1];
                if (t >= t0) {
                  break seek;
                }
              }
              right = i1;
              i1 = 0;
              break linear_scan;
            }
            break validate_interval;
          }
          while (i1 < right) {
            const mid = i1 + right >>> 1;
            if (t < pp[mid]) {
              right = mid;
            } else {
              i1 = mid + 1;
            }
          }
          t1 = pp[i1];
          t0 = pp[i1 - 1];
          if (t0 === void 0) {
            this._cachedIndex = 0;
            return this.copySampleValue_(0);
          }
          if (t1 === void 0) {
            i1 = pp.length;
            this._cachedIndex = i1;
            return this.copySampleValue_(i1 - 1);
          }
        }
        this._cachedIndex = i1;
        this.intervalChanged_(i1, t0, t1);
      }
      return this.interpolate_(i1, t0, t, t1);
    }
    getSettings_() {
      return this.settings || this.DefaultSettings_;
    }
    copySampleValue_(index) {
      const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, offset = index * stride;
      for (let i = 0; i !== stride; ++i) {
        result[i] = values[offset + i];
      }
      return result;
    }
    // Template methods for derived classes:
    interpolate_() {
      throw new Error("call to abstract method");
    }
    intervalChanged_() {
    }
  };
  var CubicInterpolant = class extends Interpolant {
    constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
      super(parameterPositions, sampleValues, sampleSize, resultBuffer);
      this._weightPrev = -0;
      this._offsetPrev = -0;
      this._weightNext = -0;
      this._offsetNext = -0;
      this.DefaultSettings_ = {
        endingStart: ZeroCurvatureEnding,
        endingEnd: ZeroCurvatureEnding
      };
    }
    intervalChanged_(i1, t0, t1) {
      const pp = this.parameterPositions;
      let iPrev = i1 - 2, iNext = i1 + 1, tPrev = pp[iPrev], tNext = pp[iNext];
      if (tPrev === void 0) {
        switch (this.getSettings_().endingStart) {
          case ZeroSlopeEnding:
            iPrev = i1;
            tPrev = 2 * t0 - t1;
            break;
          case WrapAroundEnding:
            iPrev = pp.length - 2;
            tPrev = t0 + pp[iPrev] - pp[iPrev + 1];
            break;
          default:
            iPrev = i1;
            tPrev = t1;
        }
      }
      if (tNext === void 0) {
        switch (this.getSettings_().endingEnd) {
          case ZeroSlopeEnding:
            iNext = i1;
            tNext = 2 * t1 - t0;
            break;
          case WrapAroundEnding:
            iNext = 1;
            tNext = t1 + pp[1] - pp[0];
            break;
          default:
            iNext = i1 - 1;
            tNext = t0;
        }
      }
      const halfDt = (t1 - t0) * 0.5, stride = this.valueSize;
      this._weightPrev = halfDt / (t0 - tPrev);
      this._weightNext = halfDt / (tNext - t1);
      this._offsetPrev = iPrev * stride;
      this._offsetNext = iNext * stride;
    }
    interpolate_(i1, t0, t, t1) {
      const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, o1 = i1 * stride, o0 = o1 - stride, oP = this._offsetPrev, oN = this._offsetNext, wP = this._weightPrev, wN = this._weightNext, p = (t - t0) / (t1 - t0), pp = p * p, ppp = pp * p;
      const sP = -wP * ppp + 2 * wP * pp - wP * p;
      const s0 = (1 + wP) * ppp + (-1.5 - 2 * wP) * pp + (-0.5 + wP) * p + 1;
      const s1 = (-1 - wN) * ppp + (1.5 + wN) * pp + 0.5 * p;
      const sN = wN * ppp - wN * pp;
      for (let i = 0; i !== stride; ++i) {
        result[i] = sP * values[oP + i] + s0 * values[o0 + i] + s1 * values[o1 + i] + sN * values[oN + i];
      }
      return result;
    }
  };
  var LinearInterpolant = class extends Interpolant {
    constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
      super(parameterPositions, sampleValues, sampleSize, resultBuffer);
    }
    interpolate_(i1, t0, t, t1) {
      const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, offset1 = i1 * stride, offset0 = offset1 - stride, weight1 = (t - t0) / (t1 - t0), weight0 = 1 - weight1;
      for (let i = 0; i !== stride; ++i) {
        result[i] = values[offset0 + i] * weight0 + values[offset1 + i] * weight1;
      }
      return result;
    }
  };
  var DiscreteInterpolant = class extends Interpolant {
    constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
      super(parameterPositions, sampleValues, sampleSize, resultBuffer);
    }
    interpolate_(i1) {
      return this.copySampleValue_(i1 - 1);
    }
  };
  var KeyframeTrack = class {
    constructor(name, times, values, interpolation) {
      if (name === void 0) throw new Error("THREE.KeyframeTrack: track name is undefined");
      if (times === void 0 || times.length === 0) throw new Error("THREE.KeyframeTrack: no keyframes in track named " + name);
      this.name = name;
      this.times = convertArray(times, this.TimeBufferType);
      this.values = convertArray(values, this.ValueBufferType);
      this.setInterpolation(interpolation || this.DefaultInterpolation);
    }
    // Serialization (in static context, because of constructor invocation
    // and automatic invocation of .toJSON):
    static toJSON(track) {
      const trackType = track.constructor;
      let json;
      if (trackType.toJSON !== this.toJSON) {
        json = trackType.toJSON(track);
      } else {
        json = {
          "name": track.name,
          "times": convertArray(track.times, Array),
          "values": convertArray(track.values, Array)
        };
        const interpolation = track.getInterpolation();
        if (interpolation !== track.DefaultInterpolation) {
          json.interpolation = interpolation;
        }
      }
      json.type = track.ValueTypeName;
      return json;
    }
    InterpolantFactoryMethodDiscrete(result) {
      return new DiscreteInterpolant(this.times, this.values, this.getValueSize(), result);
    }
    InterpolantFactoryMethodLinear(result) {
      return new LinearInterpolant(this.times, this.values, this.getValueSize(), result);
    }
    InterpolantFactoryMethodSmooth(result) {
      return new CubicInterpolant(this.times, this.values, this.getValueSize(), result);
    }
    setInterpolation(interpolation) {
      let factoryMethod;
      switch (interpolation) {
        case InterpolateDiscrete:
          factoryMethod = this.InterpolantFactoryMethodDiscrete;
          break;
        case InterpolateLinear:
          factoryMethod = this.InterpolantFactoryMethodLinear;
          break;
        case InterpolateSmooth:
          factoryMethod = this.InterpolantFactoryMethodSmooth;
          break;
      }
      if (factoryMethod === void 0) {
        const message = "unsupported interpolation for " + this.ValueTypeName + " keyframe track named " + this.name;
        if (this.createInterpolant === void 0) {
          if (interpolation !== this.DefaultInterpolation) {
            this.setInterpolation(this.DefaultInterpolation);
          } else {
            throw new Error(message);
          }
        }
        console.warn("THREE.KeyframeTrack:", message);
        return this;
      }
      this.createInterpolant = factoryMethod;
      return this;
    }
    getInterpolation() {
      switch (this.createInterpolant) {
        case this.InterpolantFactoryMethodDiscrete:
          return InterpolateDiscrete;
        case this.InterpolantFactoryMethodLinear:
          return InterpolateLinear;
        case this.InterpolantFactoryMethodSmooth:
          return InterpolateSmooth;
      }
    }
    getValueSize() {
      return this.values.length / this.times.length;
    }
    // move all keyframes either forwards or backwards in time
    shift(timeOffset) {
      if (timeOffset !== 0) {
        const times = this.times;
        for (let i = 0, n = times.length; i !== n; ++i) {
          times[i] += timeOffset;
        }
      }
      return this;
    }
    // scale all keyframe times by a factor (useful for frame <-> seconds conversions)
    scale(timeScale) {
      if (timeScale !== 1) {
        const times = this.times;
        for (let i = 0, n = times.length; i !== n; ++i) {
          times[i] *= timeScale;
        }
      }
      return this;
    }
    // removes keyframes before and after animation without changing any values within the range [startTime, endTime].
    // IMPORTANT: We do not shift around keys to the start of the track time, because for interpolated keys this will change their values
    trim(startTime, endTime) {
      const times = this.times, nKeys = times.length;
      let from = 0, to = nKeys - 1;
      while (from !== nKeys && times[from] < startTime) {
        ++from;
      }
      while (to !== -1 && times[to] > endTime) {
        --to;
      }
      ++to;
      if (from !== 0 || to !== nKeys) {
        if (from >= to) {
          to = Math.max(to, 1);
          from = to - 1;
        }
        const stride = this.getValueSize();
        this.times = times.slice(from, to);
        this.values = this.values.slice(from * stride, to * stride);
      }
      return this;
    }
    // ensure we do not get a GarbageInGarbageOut situation, make sure tracks are at least minimally viable
    validate() {
      let valid = true;
      const valueSize = this.getValueSize();
      if (valueSize - Math.floor(valueSize) !== 0) {
        console.error("THREE.KeyframeTrack: Invalid value size in track.", this);
        valid = false;
      }
      const times = this.times, values = this.values, nKeys = times.length;
      if (nKeys === 0) {
        console.error("THREE.KeyframeTrack: Track is empty.", this);
        valid = false;
      }
      let prevTime = null;
      for (let i = 0; i !== nKeys; i++) {
        const currTime = times[i];
        if (typeof currTime === "number" && isNaN(currTime)) {
          console.error("THREE.KeyframeTrack: Time is not a valid number.", this, i, currTime);
          valid = false;
          break;
        }
        if (prevTime !== null && prevTime > currTime) {
          console.error("THREE.KeyframeTrack: Out of order keys.", this, i, currTime, prevTime);
          valid = false;
          break;
        }
        prevTime = currTime;
      }
      if (values !== void 0) {
        if (isTypedArray(values)) {
          for (let i = 0, n = values.length; i !== n; ++i) {
            const value = values[i];
            if (isNaN(value)) {
              console.error("THREE.KeyframeTrack: Value is not a valid number.", this, i, value);
              valid = false;
              break;
            }
          }
        }
      }
      return valid;
    }
    // removes equivalent sequential keys as common in morph target sequences
    // (0,0,0,0,1,1,1,0,0,0,0,0,0,0) --> (0,0,1,1,0,0)
    optimize() {
      const times = this.times.slice(), values = this.values.slice(), stride = this.getValueSize(), smoothInterpolation = this.getInterpolation() === InterpolateSmooth, lastIndex = times.length - 1;
      let writeIndex = 1;
      for (let i = 1; i < lastIndex; ++i) {
        let keep = false;
        const time = times[i];
        const timeNext = times[i + 1];
        if (time !== timeNext && (i !== 1 || time !== times[0])) {
          if (!smoothInterpolation) {
            const offset = i * stride, offsetP = offset - stride, offsetN = offset + stride;
            for (let j = 0; j !== stride; ++j) {
              const value = values[offset + j];
              if (value !== values[offsetP + j] || value !== values[offsetN + j]) {
                keep = true;
                break;
              }
            }
          } else {
            keep = true;
          }
        }
        if (keep) {
          if (i !== writeIndex) {
            times[writeIndex] = times[i];
            const readOffset = i * stride, writeOffset = writeIndex * stride;
            for (let j = 0; j !== stride; ++j) {
              values[writeOffset + j] = values[readOffset + j];
            }
          }
          ++writeIndex;
        }
      }
      if (lastIndex > 0) {
        times[writeIndex] = times[lastIndex];
        for (let readOffset = lastIndex * stride, writeOffset = writeIndex * stride, j = 0; j !== stride; ++j) {
          values[writeOffset + j] = values[readOffset + j];
        }
        ++writeIndex;
      }
      if (writeIndex !== times.length) {
        this.times = times.slice(0, writeIndex);
        this.values = values.slice(0, writeIndex * stride);
      } else {
        this.times = times;
        this.values = values;
      }
      return this;
    }
    clone() {
      const times = this.times.slice();
      const values = this.values.slice();
      const TypedKeyframeTrack = this.constructor;
      const track = new TypedKeyframeTrack(this.name, times, values);
      track.createInterpolant = this.createInterpolant;
      return track;
    }
  };
  KeyframeTrack.prototype.TimeBufferType = Float32Array;
  KeyframeTrack.prototype.ValueBufferType = Float32Array;
  KeyframeTrack.prototype.DefaultInterpolation = InterpolateLinear;
  var BooleanKeyframeTrack = class extends KeyframeTrack {
  };
  BooleanKeyframeTrack.prototype.ValueTypeName = "bool";
  BooleanKeyframeTrack.prototype.ValueBufferType = Array;
  BooleanKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
  BooleanKeyframeTrack.prototype.InterpolantFactoryMethodLinear = void 0;
  BooleanKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = void 0;
  var ColorKeyframeTrack = class extends KeyframeTrack {
  };
  ColorKeyframeTrack.prototype.ValueTypeName = "color";
  var NumberKeyframeTrack = class extends KeyframeTrack {
  };
  NumberKeyframeTrack.prototype.ValueTypeName = "number";
  var QuaternionLinearInterpolant = class extends Interpolant {
    constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
      super(parameterPositions, sampleValues, sampleSize, resultBuffer);
    }
    interpolate_(i1, t0, t, t1) {
      const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, alpha = (t - t0) / (t1 - t0);
      let offset = i1 * stride;
      for (let end = offset + stride; offset !== end; offset += 4) {
        Quaternion.slerpFlat(result, 0, values, offset - stride, values, offset, alpha);
      }
      return result;
    }
  };
  var QuaternionKeyframeTrack = class extends KeyframeTrack {
    InterpolantFactoryMethodLinear(result) {
      return new QuaternionLinearInterpolant(this.times, this.values, this.getValueSize(), result);
    }
  };
  QuaternionKeyframeTrack.prototype.ValueTypeName = "quaternion";
  QuaternionKeyframeTrack.prototype.DefaultInterpolation = InterpolateLinear;
  QuaternionKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = void 0;
  var StringKeyframeTrack = class extends KeyframeTrack {
  };
  StringKeyframeTrack.prototype.ValueTypeName = "string";
  StringKeyframeTrack.prototype.ValueBufferType = Array;
  StringKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
  StringKeyframeTrack.prototype.InterpolantFactoryMethodLinear = void 0;
  StringKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = void 0;
  var VectorKeyframeTrack = class extends KeyframeTrack {
  };
  VectorKeyframeTrack.prototype.ValueTypeName = "vector";
  var AnimationClip = class {
    constructor(name, duration = -1, tracks, blendMode = NormalAnimationBlendMode) {
      this.name = name;
      this.tracks = tracks;
      this.duration = duration;
      this.blendMode = blendMode;
      this.uuid = generateUUID();
      if (this.duration < 0) {
        this.resetDuration();
      }
    }
    static parse(json) {
      const tracks = [], jsonTracks = json.tracks, frameTime = 1 / (json.fps || 1);
      for (let i = 0, n = jsonTracks.length; i !== n; ++i) {
        tracks.push(parseKeyframeTrack(jsonTracks[i]).scale(frameTime));
      }
      const clip = new this(json.name, json.duration, tracks, json.blendMode);
      clip.uuid = json.uuid;
      return clip;
    }
    static toJSON(clip) {
      const tracks = [], clipTracks = clip.tracks;
      const json = {
        "name": clip.name,
        "duration": clip.duration,
        "tracks": tracks,
        "uuid": clip.uuid,
        "blendMode": clip.blendMode
      };
      for (let i = 0, n = clipTracks.length; i !== n; ++i) {
        tracks.push(KeyframeTrack.toJSON(clipTracks[i]));
      }
      return json;
    }
    static CreateFromMorphTargetSequence(name, morphTargetSequence, fps, noLoop) {
      const numMorphTargets = morphTargetSequence.length;
      const tracks = [];
      for (let i = 0; i < numMorphTargets; i++) {
        let times = [];
        let values = [];
        times.push(
          (i + numMorphTargets - 1) % numMorphTargets,
          i,
          (i + 1) % numMorphTargets
        );
        values.push(0, 1, 0);
        const order = getKeyframeOrder(times);
        times = sortedArray(times, 1, order);
        values = sortedArray(values, 1, order);
        if (!noLoop && times[0] === 0) {
          times.push(numMorphTargets);
          values.push(values[0]);
        }
        tracks.push(
          new NumberKeyframeTrack(
            ".morphTargetInfluences[" + morphTargetSequence[i].name + "]",
            times,
            values
          ).scale(1 / fps)
        );
      }
      return new this(name, -1, tracks);
    }
    static findByName(objectOrClipArray, name) {
      let clipArray = objectOrClipArray;
      if (!Array.isArray(objectOrClipArray)) {
        const o = objectOrClipArray;
        clipArray = o.geometry && o.geometry.animations || o.animations;
      }
      for (let i = 0; i < clipArray.length; i++) {
        if (clipArray[i].name === name) {
          return clipArray[i];
        }
      }
      return null;
    }
    static CreateClipsFromMorphTargetSequences(morphTargets, fps, noLoop) {
      const animationToMorphTargets = {};
      const pattern = /^([\w-]*?)([\d]+)$/;
      for (let i = 0, il = morphTargets.length; i < il; i++) {
        const morphTarget = morphTargets[i];
        const parts = morphTarget.name.match(pattern);
        if (parts && parts.length > 1) {
          const name = parts[1];
          let animationMorphTargets = animationToMorphTargets[name];
          if (!animationMorphTargets) {
            animationToMorphTargets[name] = animationMorphTargets = [];
          }
          animationMorphTargets.push(morphTarget);
        }
      }
      const clips = [];
      for (const name in animationToMorphTargets) {
        clips.push(this.CreateFromMorphTargetSequence(name, animationToMorphTargets[name], fps, noLoop));
      }
      return clips;
    }
    // parse the animation.hierarchy format
    static parseAnimation(animation, bones) {
      if (!animation) {
        console.error("THREE.AnimationClip: No animation in JSONLoader data.");
        return null;
      }
      const addNonemptyTrack = function(trackType, trackName, animationKeys, propertyName, destTracks) {
        if (animationKeys.length !== 0) {
          const times = [];
          const values = [];
          flattenJSON(animationKeys, times, values, propertyName);
          if (times.length !== 0) {
            destTracks.push(new trackType(trackName, times, values));
          }
        }
      };
      const tracks = [];
      const clipName = animation.name || "default";
      const fps = animation.fps || 30;
      const blendMode = animation.blendMode;
      let duration = animation.length || -1;
      const hierarchyTracks = animation.hierarchy || [];
      for (let h = 0; h < hierarchyTracks.length; h++) {
        const animationKeys = hierarchyTracks[h].keys;
        if (!animationKeys || animationKeys.length === 0) continue;
        if (animationKeys[0].morphTargets) {
          const morphTargetNames = {};
          let k;
          for (k = 0; k < animationKeys.length; k++) {
            if (animationKeys[k].morphTargets) {
              for (let m = 0; m < animationKeys[k].morphTargets.length; m++) {
                morphTargetNames[animationKeys[k].morphTargets[m]] = -1;
              }
            }
          }
          for (const morphTargetName in morphTargetNames) {
            const times = [];
            const values = [];
            for (let m = 0; m !== animationKeys[k].morphTargets.length; ++m) {
              const animationKey = animationKeys[k];
              times.push(animationKey.time);
              values.push(animationKey.morphTarget === morphTargetName ? 1 : 0);
            }
            tracks.push(new NumberKeyframeTrack(".morphTargetInfluence[" + morphTargetName + "]", times, values));
          }
          duration = morphTargetNames.length * fps;
        } else {
          const boneName = ".bones[" + bones[h].name + "]";
          addNonemptyTrack(
            VectorKeyframeTrack,
            boneName + ".position",
            animationKeys,
            "pos",
            tracks
          );
          addNonemptyTrack(
            QuaternionKeyframeTrack,
            boneName + ".quaternion",
            animationKeys,
            "rot",
            tracks
          );
          addNonemptyTrack(
            VectorKeyframeTrack,
            boneName + ".scale",
            animationKeys,
            "scl",
            tracks
          );
        }
      }
      if (tracks.length === 0) {
        return null;
      }
      const clip = new this(clipName, duration, tracks, blendMode);
      return clip;
    }
    resetDuration() {
      const tracks = this.tracks;
      let duration = 0;
      for (let i = 0, n = tracks.length; i !== n; ++i) {
        const track = this.tracks[i];
        duration = Math.max(duration, track.times[track.times.length - 1]);
      }
      this.duration = duration;
      return this;
    }
    trim() {
      for (let i = 0; i < this.tracks.length; i++) {
        this.tracks[i].trim(0, this.duration);
      }
      return this;
    }
    validate() {
      let valid = true;
      for (let i = 0; i < this.tracks.length; i++) {
        valid = valid && this.tracks[i].validate();
      }
      return valid;
    }
    optimize() {
      for (let i = 0; i < this.tracks.length; i++) {
        this.tracks[i].optimize();
      }
      return this;
    }
    clone() {
      const tracks = [];
      for (let i = 0; i < this.tracks.length; i++) {
        tracks.push(this.tracks[i].clone());
      }
      return new this.constructor(this.name, this.duration, tracks, this.blendMode);
    }
    toJSON() {
      return this.constructor.toJSON(this);
    }
  };
  function getTrackTypeForValueTypeName(typeName) {
    switch (typeName.toLowerCase()) {
      case "scalar":
      case "double":
      case "float":
      case "number":
      case "integer":
        return NumberKeyframeTrack;
      case "vector":
      case "vector2":
      case "vector3":
      case "vector4":
        return VectorKeyframeTrack;
      case "color":
        return ColorKeyframeTrack;
      case "quaternion":
        return QuaternionKeyframeTrack;
      case "bool":
      case "boolean":
        return BooleanKeyframeTrack;
      case "string":
        return StringKeyframeTrack;
    }
    throw new Error("THREE.KeyframeTrack: Unsupported typeName: " + typeName);
  }
  function parseKeyframeTrack(json) {
    if (json.type === void 0) {
      throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");
    }
    const trackType = getTrackTypeForValueTypeName(json.type);
    if (json.times === void 0) {
      const times = [], values = [];
      flattenJSON(json.keys, times, values, "value");
      json.times = times;
      json.values = values;
    }
    if (trackType.parse !== void 0) {
      return trackType.parse(json);
    } else {
      return new trackType(json.name, json.times, json.values, json.interpolation);
    }
  }
  var Cache = {
    enabled: false,
    files: {},
    add: function(key, file) {
      if (this.enabled === false) return;
      this.files[key] = file;
    },
    get: function(key) {
      if (this.enabled === false) return;
      return this.files[key];
    },
    remove: function(key) {
      delete this.files[key];
    },
    clear: function() {
      this.files = {};
    }
  };
  var LoadingManager = class {
    constructor(onLoad, onProgress, onError) {
      const scope = this;
      let isLoading = false;
      let itemsLoaded = 0;
      let itemsTotal = 0;
      let urlModifier = void 0;
      const handlers = [];
      this.onStart = void 0;
      this.onLoad = onLoad;
      this.onProgress = onProgress;
      this.onError = onError;
      this.itemStart = function(url) {
        itemsTotal++;
        if (isLoading === false) {
          if (scope.onStart !== void 0) {
            scope.onStart(url, itemsLoaded, itemsTotal);
          }
        }
        isLoading = true;
      };
      this.itemEnd = function(url) {
        itemsLoaded++;
        if (scope.onProgress !== void 0) {
          scope.onProgress(url, itemsLoaded, itemsTotal);
        }
        if (itemsLoaded === itemsTotal) {
          isLoading = false;
          if (scope.onLoad !== void 0) {
            scope.onLoad();
          }
        }
      };
      this.itemError = function(url) {
        if (scope.onError !== void 0) {
          scope.onError(url);
        }
      };
      this.resolveURL = function(url) {
        if (urlModifier) {
          return urlModifier(url);
        }
        return url;
      };
      this.setURLModifier = function(transform) {
        urlModifier = transform;
        return this;
      };
      this.addHandler = function(regex, loader) {
        handlers.push(regex, loader);
        return this;
      };
      this.removeHandler = function(regex) {
        const index = handlers.indexOf(regex);
        if (index !== -1) {
          handlers.splice(index, 2);
        }
        return this;
      };
      this.getHandler = function(file) {
        for (let i = 0, l = handlers.length; i < l; i += 2) {
          const regex = handlers[i];
          const loader = handlers[i + 1];
          if (regex.global) regex.lastIndex = 0;
          if (regex.test(file)) {
            return loader;
          }
        }
        return null;
      };
    }
  };
  var DefaultLoadingManager = /* @__PURE__ */ new LoadingManager();
  var Loader = class {
    constructor(manager) {
      this.manager = manager !== void 0 ? manager : DefaultLoadingManager;
      this.crossOrigin = "anonymous";
      this.withCredentials = false;
      this.path = "";
      this.resourcePath = "";
      this.requestHeader = {};
    }
    load() {
    }
    loadAsync(url, onProgress) {
      const scope = this;
      return new Promise(function(resolve, reject) {
        scope.load(url, resolve, onProgress, reject);
      });
    }
    parse() {
    }
    setCrossOrigin(crossOrigin) {
      this.crossOrigin = crossOrigin;
      return this;
    }
    setWithCredentials(value) {
      this.withCredentials = value;
      return this;
    }
    setPath(path) {
      this.path = path;
      return this;
    }
    setResourcePath(resourcePath) {
      this.resourcePath = resourcePath;
      return this;
    }
    setRequestHeader(requestHeader) {
      this.requestHeader = requestHeader;
      return this;
    }
  };
  Loader.DEFAULT_MATERIAL_NAME = "__DEFAULT";
  var loading = {};
  var HttpError = class extends Error {
    constructor(message, response) {
      super(message);
      this.response = response;
    }
  };
  var FileLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      if (url === void 0) url = "";
      if (this.path !== void 0) url = this.path + url;
      url = this.manager.resolveURL(url);
      const cached = Cache.get(url);
      if (cached !== void 0) {
        this.manager.itemStart(url);
        setTimeout(() => {
          if (onLoad) onLoad(cached);
          this.manager.itemEnd(url);
        }, 0);
        return cached;
      }
      if (loading[url] !== void 0) {
        loading[url].push({
          onLoad,
          onProgress,
          onError
        });
        return;
      }
      loading[url] = [];
      loading[url].push({
        onLoad,
        onProgress,
        onError
      });
      const req = new Request(url, {
        headers: new Headers(this.requestHeader),
        credentials: this.withCredentials ? "include" : "same-origin"
        // An abort controller could be added within a future PR
      });
      const mimeType = this.mimeType;
      const responseType = this.responseType;
      fetch(req).then((response) => {
        if (response.status === 200 || response.status === 0) {
          if (response.status === 0) {
            console.warn("THREE.FileLoader: HTTP Status 0 received.");
          }
          if (typeof ReadableStream === "undefined" || response.body === void 0 || response.body.getReader === void 0) {
            return response;
          }
          const callbacks = loading[url];
          const reader = response.body.getReader();
          const contentLength = response.headers.get("Content-Length") || response.headers.get("X-File-Size");
          const total = contentLength ? parseInt(contentLength) : 0;
          const lengthComputable = total !== 0;
          let loaded = 0;
          const stream = new ReadableStream({
            start(controller) {
              readData();
              function readData() {
                reader.read().then(({ done, value }) => {
                  if (done) {
                    controller.close();
                  } else {
                    loaded += value.byteLength;
                    const event = new ProgressEvent("progress", { lengthComputable, loaded, total });
                    for (let i = 0, il = callbacks.length; i < il; i++) {
                      const callback = callbacks[i];
                      if (callback.onProgress) callback.onProgress(event);
                    }
                    controller.enqueue(value);
                    readData();
                  }
                });
              }
            }
          });
          return new Response(stream);
        } else {
          throw new HttpError(`fetch for "${response.url}" responded with ${response.status}: ${response.statusText}`, response);
        }
      }).then((response) => {
        switch (responseType) {
          case "arraybuffer":
            return response.arrayBuffer();
          case "blob":
            return response.blob();
          case "document":
            return response.text().then((text) => {
              const parser = new DOMParser();
              return parser.parseFromString(text, mimeType);
            });
          case "json":
            return response.json();
          default:
            if (mimeType === void 0) {
              return response.text();
            } else {
              const re = /charset="?([^;"\s]*)"?/i;
              const exec = re.exec(mimeType);
              const label = exec && exec[1] ? exec[1].toLowerCase() : void 0;
              const decoder = new TextDecoder(label);
              return response.arrayBuffer().then((ab) => decoder.decode(ab));
            }
        }
      }).then((data) => {
        Cache.add(url, data);
        const callbacks = loading[url];
        delete loading[url];
        for (let i = 0, il = callbacks.length; i < il; i++) {
          const callback = callbacks[i];
          if (callback.onLoad) callback.onLoad(data);
        }
      }).catch((err) => {
        const callbacks = loading[url];
        if (callbacks === void 0) {
          this.manager.itemError(url);
          throw err;
        }
        delete loading[url];
        for (let i = 0, il = callbacks.length; i < il; i++) {
          const callback = callbacks[i];
          if (callback.onError) callback.onError(err);
        }
        this.manager.itemError(url);
      }).finally(() => {
        this.manager.itemEnd(url);
      });
      this.manager.itemStart(url);
    }
    setResponseType(value) {
      this.responseType = value;
      return this;
    }
    setMimeType(value) {
      this.mimeType = value;
      return this;
    }
  };
  var AnimationLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      const scope = this;
      const loader = new FileLoader(this.manager);
      loader.setPath(this.path);
      loader.setRequestHeader(this.requestHeader);
      loader.setWithCredentials(this.withCredentials);
      loader.load(url, function(text) {
        try {
          onLoad(scope.parse(JSON.parse(text)));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      }, onProgress, onError);
    }
    parse(json) {
      const animations = [];
      for (let i = 0; i < json.length; i++) {
        const clip = AnimationClip.parse(json[i]);
        animations.push(clip);
      }
      return animations;
    }
  };
  var CompressedTextureLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      const scope = this;
      const images = [];
      const texture = new CompressedTexture();
      const loader = new FileLoader(this.manager);
      loader.setPath(this.path);
      loader.setResponseType("arraybuffer");
      loader.setRequestHeader(this.requestHeader);
      loader.setWithCredentials(scope.withCredentials);
      let loaded = 0;
      function loadTexture(i) {
        loader.load(url[i], function(buffer) {
          const texDatas = scope.parse(buffer, true);
          images[i] = {
            width: texDatas.width,
            height: texDatas.height,
            format: texDatas.format,
            mipmaps: texDatas.mipmaps
          };
          loaded += 1;
          if (loaded === 6) {
            if (texDatas.mipmapCount === 1) texture.minFilter = LinearFilter;
            texture.image = images;
            texture.format = texDatas.format;
            texture.needsUpdate = true;
            if (onLoad) onLoad(texture);
          }
        }, onProgress, onError);
      }
      if (Array.isArray(url)) {
        for (let i = 0, il = url.length; i < il; ++i) {
          loadTexture(i);
        }
      } else {
        loader.load(url, function(buffer) {
          const texDatas = scope.parse(buffer, true);
          if (texDatas.isCubemap) {
            const faces = texDatas.mipmaps.length / texDatas.mipmapCount;
            for (let f = 0; f < faces; f++) {
              images[f] = { mipmaps: [] };
              for (let i = 0; i < texDatas.mipmapCount; i++) {
                images[f].mipmaps.push(texDatas.mipmaps[f * texDatas.mipmapCount + i]);
                images[f].format = texDatas.format;
                images[f].width = texDatas.width;
                images[f].height = texDatas.height;
              }
            }
            texture.image = images;
          } else {
            texture.image.width = texDatas.width;
            texture.image.height = texDatas.height;
            texture.mipmaps = texDatas.mipmaps;
          }
          if (texDatas.mipmapCount === 1) {
            texture.minFilter = LinearFilter;
          }
          texture.format = texDatas.format;
          texture.needsUpdate = true;
          if (onLoad) onLoad(texture);
        }, onProgress, onError);
      }
      return texture;
    }
  };
  var ImageLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      if (this.path !== void 0) url = this.path + url;
      url = this.manager.resolveURL(url);
      const scope = this;
      const cached = Cache.get(url);
      if (cached !== void 0) {
        scope.manager.itemStart(url);
        setTimeout(function() {
          if (onLoad) onLoad(cached);
          scope.manager.itemEnd(url);
        }, 0);
        return cached;
      }
      const image = createElementNS("img");
      function onImageLoad() {
        removeEventListeners();
        Cache.add(url, this);
        if (onLoad) onLoad(this);
        scope.manager.itemEnd(url);
      }
      function onImageError(event) {
        removeEventListeners();
        if (onError) onError(event);
        scope.manager.itemError(url);
        scope.manager.itemEnd(url);
      }
      function removeEventListeners() {
        image.removeEventListener("load", onImageLoad, false);
        image.removeEventListener("error", onImageError, false);
      }
      image.addEventListener("load", onImageLoad, false);
      image.addEventListener("error", onImageError, false);
      if (url.slice(0, 5) !== "data:") {
        if (this.crossOrigin !== void 0) image.crossOrigin = this.crossOrigin;
      }
      scope.manager.itemStart(url);
      image.src = url;
      return image;
    }
  };
  var CubeTextureLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(urls, onLoad, onProgress, onError) {
      const texture = new CubeTexture();
      texture.colorSpace = SRGBColorSpace;
      const loader = new ImageLoader(this.manager);
      loader.setCrossOrigin(this.crossOrigin);
      loader.setPath(this.path);
      let loaded = 0;
      function loadTexture(i) {
        loader.load(urls[i], function(image) {
          texture.images[i] = image;
          loaded++;
          if (loaded === 6) {
            texture.needsUpdate = true;
            if (onLoad) onLoad(texture);
          }
        }, void 0, onError);
      }
      for (let i = 0; i < urls.length; ++i) {
        loadTexture(i);
      }
      return texture;
    }
  };
  var DataTextureLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      const scope = this;
      const texture = new DataTexture();
      const loader = new FileLoader(this.manager);
      loader.setResponseType("arraybuffer");
      loader.setRequestHeader(this.requestHeader);
      loader.setPath(this.path);
      loader.setWithCredentials(scope.withCredentials);
      loader.load(url, function(buffer) {
        let texData;
        try {
          texData = scope.parse(buffer);
        } catch (error) {
          if (onError !== void 0) {
            onError(error);
          } else {
            console.error(error);
            return;
          }
        }
        if (texData.image !== void 0) {
          texture.image = texData.image;
        } else if (texData.data !== void 0) {
          texture.image.width = texData.width;
          texture.image.height = texData.height;
          texture.image.data = texData.data;
        }
        texture.wrapS = texData.wrapS !== void 0 ? texData.wrapS : ClampToEdgeWrapping;
        texture.wrapT = texData.wrapT !== void 0 ? texData.wrapT : ClampToEdgeWrapping;
        texture.magFilter = texData.magFilter !== void 0 ? texData.magFilter : LinearFilter;
        texture.minFilter = texData.minFilter !== void 0 ? texData.minFilter : LinearFilter;
        texture.anisotropy = texData.anisotropy !== void 0 ? texData.anisotropy : 1;
        if (texData.colorSpace !== void 0) {
          texture.colorSpace = texData.colorSpace;
        } else if (texData.encoding !== void 0) {
          texture.encoding = texData.encoding;
        }
        if (texData.flipY !== void 0) {
          texture.flipY = texData.flipY;
        }
        if (texData.format !== void 0) {
          texture.format = texData.format;
        }
        if (texData.type !== void 0) {
          texture.type = texData.type;
        }
        if (texData.mipmaps !== void 0) {
          texture.mipmaps = texData.mipmaps;
          texture.minFilter = LinearMipmapLinearFilter;
        }
        if (texData.mipmapCount === 1) {
          texture.minFilter = LinearFilter;
        }
        if (texData.generateMipmaps !== void 0) {
          texture.generateMipmaps = texData.generateMipmaps;
        }
        texture.needsUpdate = true;
        if (onLoad) onLoad(texture, texData);
      }, onProgress, onError);
      return texture;
    }
  };
  var TextureLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      const texture = new Texture();
      const loader = new ImageLoader(this.manager);
      loader.setCrossOrigin(this.crossOrigin);
      loader.setPath(this.path);
      loader.load(url, function(image) {
        texture.image = image;
        texture.needsUpdate = true;
        if (onLoad !== void 0) {
          onLoad(texture);
        }
      }, onProgress, onError);
      return texture;
    }
  };
  var Light = class extends Object3D {
    constructor(color, intensity = 1) {
      super();
      this.isLight = true;
      this.type = "Light";
      this.color = new Color(color);
      this.intensity = intensity;
    }
    dispose() {
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.color.copy(source.color);
      this.intensity = source.intensity;
      return this;
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      data.object.color = this.color.getHex();
      data.object.intensity = this.intensity;
      if (this.groundColor !== void 0) data.object.groundColor = this.groundColor.getHex();
      if (this.distance !== void 0) data.object.distance = this.distance;
      if (this.angle !== void 0) data.object.angle = this.angle;
      if (this.decay !== void 0) data.object.decay = this.decay;
      if (this.penumbra !== void 0) data.object.penumbra = this.penumbra;
      if (this.shadow !== void 0) data.object.shadow = this.shadow.toJSON();
      return data;
    }
  };
  var HemisphereLight = class extends Light {
    constructor(skyColor, groundColor, intensity) {
      super(skyColor, intensity);
      this.isHemisphereLight = true;
      this.type = "HemisphereLight";
      this.position.copy(Object3D.DEFAULT_UP);
      this.updateMatrix();
      this.groundColor = new Color(groundColor);
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.groundColor.copy(source.groundColor);
      return this;
    }
  };
  var _projScreenMatrix$1 = /* @__PURE__ */ new Matrix4();
  var _lightPositionWorld$1 = /* @__PURE__ */ new Vector3();
  var _lookTarget$1 = /* @__PURE__ */ new Vector3();
  var LightShadow = class {
    constructor(camera) {
      this.camera = camera;
      this.bias = 0;
      this.normalBias = 0;
      this.radius = 1;
      this.blurSamples = 8;
      this.mapSize = new Vector2(512, 512);
      this.map = null;
      this.mapPass = null;
      this.matrix = new Matrix4();
      this.autoUpdate = true;
      this.needsUpdate = false;
      this._frustum = new Frustum();
      this._frameExtents = new Vector2(1, 1);
      this._viewportCount = 1;
      this._viewports = [
        new Vector4(0, 0, 1, 1)
      ];
    }
    getViewportCount() {
      return this._viewportCount;
    }
    getFrustum() {
      return this._frustum;
    }
    updateMatrices(light) {
      const shadowCamera = this.camera;
      const shadowMatrix = this.matrix;
      _lightPositionWorld$1.setFromMatrixPosition(light.matrixWorld);
      shadowCamera.position.copy(_lightPositionWorld$1);
      _lookTarget$1.setFromMatrixPosition(light.target.matrixWorld);
      shadowCamera.lookAt(_lookTarget$1);
      shadowCamera.updateMatrixWorld();
      _projScreenMatrix$1.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(_projScreenMatrix$1);
      shadowMatrix.set(
        0.5,
        0,
        0,
        0.5,
        0,
        0.5,
        0,
        0.5,
        0,
        0,
        0.5,
        0.5,
        0,
        0,
        0,
        1
      );
      shadowMatrix.multiply(_projScreenMatrix$1);
    }
    getViewport(viewportIndex) {
      return this._viewports[viewportIndex];
    }
    getFrameExtents() {
      return this._frameExtents;
    }
    dispose() {
      if (this.map) {
        this.map.dispose();
      }
      if (this.mapPass) {
        this.mapPass.dispose();
      }
    }
    copy(source) {
      this.camera = source.camera.clone();
      this.bias = source.bias;
      this.radius = source.radius;
      this.mapSize.copy(source.mapSize);
      return this;
    }
    clone() {
      return new this.constructor().copy(this);
    }
    toJSON() {
      const object = {};
      if (this.bias !== 0) object.bias = this.bias;
      if (this.normalBias !== 0) object.normalBias = this.normalBias;
      if (this.radius !== 1) object.radius = this.radius;
      if (this.mapSize.x !== 512 || this.mapSize.y !== 512) object.mapSize = this.mapSize.toArray();
      object.camera = this.camera.toJSON(false).object;
      delete object.camera.matrix;
      return object;
    }
  };
  var SpotLightShadow = class extends LightShadow {
    constructor() {
      super(new PerspectiveCamera(50, 1, 0.5, 500));
      this.isSpotLightShadow = true;
      this.focus = 1;
    }
    updateMatrices(light) {
      const camera = this.camera;
      const fov2 = RAD2DEG * 2 * light.angle * this.focus;
      const aspect2 = this.mapSize.width / this.mapSize.height;
      const far = light.distance || camera.far;
      if (fov2 !== camera.fov || aspect2 !== camera.aspect || far !== camera.far) {
        camera.fov = fov2;
        camera.aspect = aspect2;
        camera.far = far;
        camera.updateProjectionMatrix();
      }
      super.updateMatrices(light);
    }
    copy(source) {
      super.copy(source);
      this.focus = source.focus;
      return this;
    }
  };
  var SpotLight = class extends Light {
    constructor(color, intensity, distance = 0, angle = Math.PI / 3, penumbra = 0, decay = 2) {
      super(color, intensity);
      this.isSpotLight = true;
      this.type = "SpotLight";
      this.position.copy(Object3D.DEFAULT_UP);
      this.updateMatrix();
      this.target = new Object3D();
      this.distance = distance;
      this.angle = angle;
      this.penumbra = penumbra;
      this.decay = decay;
      this.map = null;
      this.shadow = new SpotLightShadow();
    }
    get power() {
      return this.intensity * Math.PI;
    }
    set power(power) {
      this.intensity = power / Math.PI;
    }
    dispose() {
      this.shadow.dispose();
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.distance = source.distance;
      this.angle = source.angle;
      this.penumbra = source.penumbra;
      this.decay = source.decay;
      this.target = source.target.clone();
      this.shadow = source.shadow.clone();
      return this;
    }
  };
  var _projScreenMatrix = /* @__PURE__ */ new Matrix4();
  var _lightPositionWorld = /* @__PURE__ */ new Vector3();
  var _lookTarget = /* @__PURE__ */ new Vector3();
  var PointLightShadow = class extends LightShadow {
    constructor() {
      super(new PerspectiveCamera(90, 1, 0.5, 500));
      this.isPointLightShadow = true;
      this._frameExtents = new Vector2(4, 2);
      this._viewportCount = 6;
      this._viewports = [
        // These viewports map a cube-map onto a 2D texture with the
        // following orientation:
        //
        //  xzXZ
        //   y Y
        //
        // X - Positive x direction
        // x - Negative x direction
        // Y - Positive y direction
        // y - Negative y direction
        // Z - Positive z direction
        // z - Negative z direction
        // positive X
        new Vector4(2, 1, 1, 1),
        // negative X
        new Vector4(0, 1, 1, 1),
        // positive Z
        new Vector4(3, 1, 1, 1),
        // negative Z
        new Vector4(1, 1, 1, 1),
        // positive Y
        new Vector4(3, 0, 1, 1),
        // negative Y
        new Vector4(1, 0, 1, 1)
      ];
      this._cubeDirections = [
        new Vector3(1, 0, 0),
        new Vector3(-1, 0, 0),
        new Vector3(0, 0, 1),
        new Vector3(0, 0, -1),
        new Vector3(0, 1, 0),
        new Vector3(0, -1, 0)
      ];
      this._cubeUps = [
        new Vector3(0, 1, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 0, 1),
        new Vector3(0, 0, -1)
      ];
    }
    updateMatrices(light, viewportIndex = 0) {
      const camera = this.camera;
      const shadowMatrix = this.matrix;
      const far = light.distance || camera.far;
      if (far !== camera.far) {
        camera.far = far;
        camera.updateProjectionMatrix();
      }
      _lightPositionWorld.setFromMatrixPosition(light.matrixWorld);
      camera.position.copy(_lightPositionWorld);
      _lookTarget.copy(camera.position);
      _lookTarget.add(this._cubeDirections[viewportIndex]);
      camera.up.copy(this._cubeUps[viewportIndex]);
      camera.lookAt(_lookTarget);
      camera.updateMatrixWorld();
      shadowMatrix.makeTranslation(-_lightPositionWorld.x, -_lightPositionWorld.y, -_lightPositionWorld.z);
      _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(_projScreenMatrix);
    }
  };
  var PointLight = class extends Light {
    constructor(color, intensity, distance = 0, decay = 2) {
      super(color, intensity);
      this.isPointLight = true;
      this.type = "PointLight";
      this.distance = distance;
      this.decay = decay;
      this.shadow = new PointLightShadow();
    }
    get power() {
      return this.intensity * 4 * Math.PI;
    }
    set power(power) {
      this.intensity = power / (4 * Math.PI);
    }
    dispose() {
      this.shadow.dispose();
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.distance = source.distance;
      this.decay = source.decay;
      this.shadow = source.shadow.clone();
      return this;
    }
  };
  var DirectionalLightShadow = class extends LightShadow {
    constructor() {
      super(new OrthographicCamera(-5, 5, 5, -5, 0.5, 500));
      this.isDirectionalLightShadow = true;
    }
  };
  var DirectionalLight = class extends Light {
    constructor(color, intensity) {
      super(color, intensity);
      this.isDirectionalLight = true;
      this.type = "DirectionalLight";
      this.position.copy(Object3D.DEFAULT_UP);
      this.updateMatrix();
      this.target = new Object3D();
      this.shadow = new DirectionalLightShadow();
    }
    dispose() {
      this.shadow.dispose();
    }
    copy(source) {
      super.copy(source);
      this.target = source.target.clone();
      this.shadow = source.shadow.clone();
      return this;
    }
  };
  var AmbientLight = class extends Light {
    constructor(color, intensity) {
      super(color, intensity);
      this.isAmbientLight = true;
      this.type = "AmbientLight";
    }
  };
  var RectAreaLight = class extends Light {
    constructor(color, intensity, width = 10, height = 10) {
      super(color, intensity);
      this.isRectAreaLight = true;
      this.type = "RectAreaLight";
      this.width = width;
      this.height = height;
    }
    get power() {
      return this.intensity * this.width * this.height * Math.PI;
    }
    set power(power) {
      this.intensity = power / (this.width * this.height * Math.PI);
    }
    copy(source) {
      super.copy(source);
      this.width = source.width;
      this.height = source.height;
      return this;
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      data.object.width = this.width;
      data.object.height = this.height;
      return data;
    }
  };
  var SphericalHarmonics3 = class {
    constructor() {
      this.isSphericalHarmonics3 = true;
      this.coefficients = [];
      for (let i = 0; i < 9; i++) {
        this.coefficients.push(new Vector3());
      }
    }
    set(coefficients) {
      for (let i = 0; i < 9; i++) {
        this.coefficients[i].copy(coefficients[i]);
      }
      return this;
    }
    zero() {
      for (let i = 0; i < 9; i++) {
        this.coefficients[i].set(0, 0, 0);
      }
      return this;
    }
    // get the radiance in the direction of the normal
    // target is a Vector3
    getAt(normal, target) {
      const x = normal.x, y = normal.y, z = normal.z;
      const coeff = this.coefficients;
      target.copy(coeff[0]).multiplyScalar(0.282095);
      target.addScaledVector(coeff[1], 0.488603 * y);
      target.addScaledVector(coeff[2], 0.488603 * z);
      target.addScaledVector(coeff[3], 0.488603 * x);
      target.addScaledVector(coeff[4], 1.092548 * (x * y));
      target.addScaledVector(coeff[5], 1.092548 * (y * z));
      target.addScaledVector(coeff[6], 0.315392 * (3 * z * z - 1));
      target.addScaledVector(coeff[7], 1.092548 * (x * z));
      target.addScaledVector(coeff[8], 0.546274 * (x * x - y * y));
      return target;
    }
    // get the irradiance (radiance convolved with cosine lobe) in the direction of the normal
    // target is a Vector3
    // https://graphics.stanford.edu/papers/envmap/envmap.pdf
    getIrradianceAt(normal, target) {
      const x = normal.x, y = normal.y, z = normal.z;
      const coeff = this.coefficients;
      target.copy(coeff[0]).multiplyScalar(0.886227);
      target.addScaledVector(coeff[1], 2 * 0.511664 * y);
      target.addScaledVector(coeff[2], 2 * 0.511664 * z);
      target.addScaledVector(coeff[3], 2 * 0.511664 * x);
      target.addScaledVector(coeff[4], 2 * 0.429043 * x * y);
      target.addScaledVector(coeff[5], 2 * 0.429043 * y * z);
      target.addScaledVector(coeff[6], 0.743125 * z * z - 0.247708);
      target.addScaledVector(coeff[7], 2 * 0.429043 * x * z);
      target.addScaledVector(coeff[8], 0.429043 * (x * x - y * y));
      return target;
    }
    add(sh) {
      for (let i = 0; i < 9; i++) {
        this.coefficients[i].add(sh.coefficients[i]);
      }
      return this;
    }
    addScaledSH(sh, s) {
      for (let i = 0; i < 9; i++) {
        this.coefficients[i].addScaledVector(sh.coefficients[i], s);
      }
      return this;
    }
    scale(s) {
      for (let i = 0; i < 9; i++) {
        this.coefficients[i].multiplyScalar(s);
      }
      return this;
    }
    lerp(sh, alpha) {
      for (let i = 0; i < 9; i++) {
        this.coefficients[i].lerp(sh.coefficients[i], alpha);
      }
      return this;
    }
    equals(sh) {
      for (let i = 0; i < 9; i++) {
        if (!this.coefficients[i].equals(sh.coefficients[i])) {
          return false;
        }
      }
      return true;
    }
    copy(sh) {
      return this.set(sh.coefficients);
    }
    clone() {
      return new this.constructor().copy(this);
    }
    fromArray(array, offset = 0) {
      const coefficients = this.coefficients;
      for (let i = 0; i < 9; i++) {
        coefficients[i].fromArray(array, offset + i * 3);
      }
      return this;
    }
    toArray(array = [], offset = 0) {
      const coefficients = this.coefficients;
      for (let i = 0; i < 9; i++) {
        coefficients[i].toArray(array, offset + i * 3);
      }
      return array;
    }
    // evaluate the basis functions
    // shBasis is an Array[ 9 ]
    static getBasisAt(normal, shBasis) {
      const x = normal.x, y = normal.y, z = normal.z;
      shBasis[0] = 0.282095;
      shBasis[1] = 0.488603 * y;
      shBasis[2] = 0.488603 * z;
      shBasis[3] = 0.488603 * x;
      shBasis[4] = 1.092548 * x * y;
      shBasis[5] = 1.092548 * y * z;
      shBasis[6] = 0.315392 * (3 * z * z - 1);
      shBasis[7] = 1.092548 * x * z;
      shBasis[8] = 0.546274 * (x * x - y * y);
    }
  };
  var LightProbe = class extends Light {
    constructor(sh = new SphericalHarmonics3(), intensity = 1) {
      super(void 0, intensity);
      this.isLightProbe = true;
      this.sh = sh;
    }
    copy(source) {
      super.copy(source);
      this.sh.copy(source.sh);
      return this;
    }
    fromJSON(json) {
      this.intensity = json.intensity;
      this.sh.fromArray(json.sh);
      return this;
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      data.object.sh = this.sh.toArray();
      return data;
    }
  };
  var MaterialLoader = class _MaterialLoader extends Loader {
    constructor(manager) {
      super(manager);
      this.textures = {};
    }
    load(url, onLoad, onProgress, onError) {
      const scope = this;
      const loader = new FileLoader(scope.manager);
      loader.setPath(scope.path);
      loader.setRequestHeader(scope.requestHeader);
      loader.setWithCredentials(scope.withCredentials);
      loader.load(url, function(text) {
        try {
          onLoad(scope.parse(JSON.parse(text)));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      }, onProgress, onError);
    }
    parse(json) {
      const textures = this.textures;
      function getTexture(name) {
        if (textures[name] === void 0) {
          console.warn("THREE.MaterialLoader: Undefined texture", name);
        }
        return textures[name];
      }
      const material = _MaterialLoader.createMaterialFromType(json.type);
      if (json.uuid !== void 0) material.uuid = json.uuid;
      if (json.name !== void 0) material.name = json.name;
      if (json.color !== void 0 && material.color !== void 0) material.color.setHex(json.color);
      if (json.roughness !== void 0) material.roughness = json.roughness;
      if (json.metalness !== void 0) material.metalness = json.metalness;
      if (json.sheen !== void 0) material.sheen = json.sheen;
      if (json.sheenColor !== void 0) material.sheenColor = new Color().setHex(json.sheenColor);
      if (json.sheenRoughness !== void 0) material.sheenRoughness = json.sheenRoughness;
      if (json.emissive !== void 0 && material.emissive !== void 0) material.emissive.setHex(json.emissive);
      if (json.specular !== void 0 && material.specular !== void 0) material.specular.setHex(json.specular);
      if (json.specularIntensity !== void 0) material.specularIntensity = json.specularIntensity;
      if (json.specularColor !== void 0 && material.specularColor !== void 0) material.specularColor.setHex(json.specularColor);
      if (json.shininess !== void 0) material.shininess = json.shininess;
      if (json.clearcoat !== void 0) material.clearcoat = json.clearcoat;
      if (json.clearcoatRoughness !== void 0) material.clearcoatRoughness = json.clearcoatRoughness;
      if (json.iridescence !== void 0) material.iridescence = json.iridescence;
      if (json.iridescenceIOR !== void 0) material.iridescenceIOR = json.iridescenceIOR;
      if (json.iridescenceThicknessRange !== void 0) material.iridescenceThicknessRange = json.iridescenceThicknessRange;
      if (json.transmission !== void 0) material.transmission = json.transmission;
      if (json.thickness !== void 0) material.thickness = json.thickness;
      if (json.attenuationDistance !== void 0) material.attenuationDistance = json.attenuationDistance;
      if (json.attenuationColor !== void 0 && material.attenuationColor !== void 0) material.attenuationColor.setHex(json.attenuationColor);
      if (json.anisotropy !== void 0) material.anisotropy = json.anisotropy;
      if (json.anisotropyRotation !== void 0) material.anisotropyRotation = json.anisotropyRotation;
      if (json.fog !== void 0) material.fog = json.fog;
      if (json.flatShading !== void 0) material.flatShading = json.flatShading;
      if (json.blending !== void 0) material.blending = json.blending;
      if (json.combine !== void 0) material.combine = json.combine;
      if (json.side !== void 0) material.side = json.side;
      if (json.shadowSide !== void 0) material.shadowSide = json.shadowSide;
      if (json.opacity !== void 0) material.opacity = json.opacity;
      if (json.transparent !== void 0) material.transparent = json.transparent;
      if (json.alphaTest !== void 0) material.alphaTest = json.alphaTest;
      if (json.alphaHash !== void 0) material.alphaHash = json.alphaHash;
      if (json.depthFunc !== void 0) material.depthFunc = json.depthFunc;
      if (json.depthTest !== void 0) material.depthTest = json.depthTest;
      if (json.depthWrite !== void 0) material.depthWrite = json.depthWrite;
      if (json.colorWrite !== void 0) material.colorWrite = json.colorWrite;
      if (json.blendSrc !== void 0) material.blendSrc = json.blendSrc;
      if (json.blendDst !== void 0) material.blendDst = json.blendDst;
      if (json.blendEquation !== void 0) material.blendEquation = json.blendEquation;
      if (json.blendSrcAlpha !== void 0) material.blendSrcAlpha = json.blendSrcAlpha;
      if (json.blendDstAlpha !== void 0) material.blendDstAlpha = json.blendDstAlpha;
      if (json.blendEquationAlpha !== void 0) material.blendEquationAlpha = json.blendEquationAlpha;
      if (json.blendColor !== void 0 && material.blendColor !== void 0) material.blendColor.setHex(json.blendColor);
      if (json.blendAlpha !== void 0) material.blendAlpha = json.blendAlpha;
      if (json.stencilWriteMask !== void 0) material.stencilWriteMask = json.stencilWriteMask;
      if (json.stencilFunc !== void 0) material.stencilFunc = json.stencilFunc;
      if (json.stencilRef !== void 0) material.stencilRef = json.stencilRef;
      if (json.stencilFuncMask !== void 0) material.stencilFuncMask = json.stencilFuncMask;
      if (json.stencilFail !== void 0) material.stencilFail = json.stencilFail;
      if (json.stencilZFail !== void 0) material.stencilZFail = json.stencilZFail;
      if (json.stencilZPass !== void 0) material.stencilZPass = json.stencilZPass;
      if (json.stencilWrite !== void 0) material.stencilWrite = json.stencilWrite;
      if (json.wireframe !== void 0) material.wireframe = json.wireframe;
      if (json.wireframeLinewidth !== void 0) material.wireframeLinewidth = json.wireframeLinewidth;
      if (json.wireframeLinecap !== void 0) material.wireframeLinecap = json.wireframeLinecap;
      if (json.wireframeLinejoin !== void 0) material.wireframeLinejoin = json.wireframeLinejoin;
      if (json.rotation !== void 0) material.rotation = json.rotation;
      if (json.linewidth !== void 0) material.linewidth = json.linewidth;
      if (json.dashSize !== void 0) material.dashSize = json.dashSize;
      if (json.gapSize !== void 0) material.gapSize = json.gapSize;
      if (json.scale !== void 0) material.scale = json.scale;
      if (json.polygonOffset !== void 0) material.polygonOffset = json.polygonOffset;
      if (json.polygonOffsetFactor !== void 0) material.polygonOffsetFactor = json.polygonOffsetFactor;
      if (json.polygonOffsetUnits !== void 0) material.polygonOffsetUnits = json.polygonOffsetUnits;
      if (json.dithering !== void 0) material.dithering = json.dithering;
      if (json.alphaToCoverage !== void 0) material.alphaToCoverage = json.alphaToCoverage;
      if (json.premultipliedAlpha !== void 0) material.premultipliedAlpha = json.premultipliedAlpha;
      if (json.forceSinglePass !== void 0) material.forceSinglePass = json.forceSinglePass;
      if (json.visible !== void 0) material.visible = json.visible;
      if (json.toneMapped !== void 0) material.toneMapped = json.toneMapped;
      if (json.userData !== void 0) material.userData = json.userData;
      if (json.vertexColors !== void 0) {
        if (typeof json.vertexColors === "number") {
          material.vertexColors = json.vertexColors > 0 ? true : false;
        } else {
          material.vertexColors = json.vertexColors;
        }
      }
      if (json.uniforms !== void 0) {
        for (const name in json.uniforms) {
          const uniform = json.uniforms[name];
          material.uniforms[name] = {};
          switch (uniform.type) {
            case "t":
              material.uniforms[name].value = getTexture(uniform.value);
              break;
            case "c":
              material.uniforms[name].value = new Color().setHex(uniform.value);
              break;
            case "v2":
              material.uniforms[name].value = new Vector2().fromArray(uniform.value);
              break;
            case "v3":
              material.uniforms[name].value = new Vector3().fromArray(uniform.value);
              break;
            case "v4":
              material.uniforms[name].value = new Vector4().fromArray(uniform.value);
              break;
            case "m3":
              material.uniforms[name].value = new Matrix3().fromArray(uniform.value);
              break;
            case "m4":
              material.uniforms[name].value = new Matrix4().fromArray(uniform.value);
              break;
            default:
              material.uniforms[name].value = uniform.value;
          }
        }
      }
      if (json.defines !== void 0) material.defines = json.defines;
      if (json.vertexShader !== void 0) material.vertexShader = json.vertexShader;
      if (json.fragmentShader !== void 0) material.fragmentShader = json.fragmentShader;
      if (json.glslVersion !== void 0) material.glslVersion = json.glslVersion;
      if (json.extensions !== void 0) {
        for (const key in json.extensions) {
          material.extensions[key] = json.extensions[key];
        }
      }
      if (json.lights !== void 0) material.lights = json.lights;
      if (json.clipping !== void 0) material.clipping = json.clipping;
      if (json.size !== void 0) material.size = json.size;
      if (json.sizeAttenuation !== void 0) material.sizeAttenuation = json.sizeAttenuation;
      if (json.map !== void 0) material.map = getTexture(json.map);
      if (json.matcap !== void 0) material.matcap = getTexture(json.matcap);
      if (json.alphaMap !== void 0) material.alphaMap = getTexture(json.alphaMap);
      if (json.bumpMap !== void 0) material.bumpMap = getTexture(json.bumpMap);
      if (json.bumpScale !== void 0) material.bumpScale = json.bumpScale;
      if (json.normalMap !== void 0) material.normalMap = getTexture(json.normalMap);
      if (json.normalMapType !== void 0) material.normalMapType = json.normalMapType;
      if (json.normalScale !== void 0) {
        let normalScale = json.normalScale;
        if (Array.isArray(normalScale) === false) {
          normalScale = [normalScale, normalScale];
        }
        material.normalScale = new Vector2().fromArray(normalScale);
      }
      if (json.displacementMap !== void 0) material.displacementMap = getTexture(json.displacementMap);
      if (json.displacementScale !== void 0) material.displacementScale = json.displacementScale;
      if (json.displacementBias !== void 0) material.displacementBias = json.displacementBias;
      if (json.roughnessMap !== void 0) material.roughnessMap = getTexture(json.roughnessMap);
      if (json.metalnessMap !== void 0) material.metalnessMap = getTexture(json.metalnessMap);
      if (json.emissiveMap !== void 0) material.emissiveMap = getTexture(json.emissiveMap);
      if (json.emissiveIntensity !== void 0) material.emissiveIntensity = json.emissiveIntensity;
      if (json.specularMap !== void 0) material.specularMap = getTexture(json.specularMap);
      if (json.specularIntensityMap !== void 0) material.specularIntensityMap = getTexture(json.specularIntensityMap);
      if (json.specularColorMap !== void 0) material.specularColorMap = getTexture(json.specularColorMap);
      if (json.envMap !== void 0) material.envMap = getTexture(json.envMap);
      if (json.envMapIntensity !== void 0) material.envMapIntensity = json.envMapIntensity;
      if (json.reflectivity !== void 0) material.reflectivity = json.reflectivity;
      if (json.refractionRatio !== void 0) material.refractionRatio = json.refractionRatio;
      if (json.lightMap !== void 0) material.lightMap = getTexture(json.lightMap);
      if (json.lightMapIntensity !== void 0) material.lightMapIntensity = json.lightMapIntensity;
      if (json.aoMap !== void 0) material.aoMap = getTexture(json.aoMap);
      if (json.aoMapIntensity !== void 0) material.aoMapIntensity = json.aoMapIntensity;
      if (json.gradientMap !== void 0) material.gradientMap = getTexture(json.gradientMap);
      if (json.clearcoatMap !== void 0) material.clearcoatMap = getTexture(json.clearcoatMap);
      if (json.clearcoatRoughnessMap !== void 0) material.clearcoatRoughnessMap = getTexture(json.clearcoatRoughnessMap);
      if (json.clearcoatNormalMap !== void 0) material.clearcoatNormalMap = getTexture(json.clearcoatNormalMap);
      if (json.clearcoatNormalScale !== void 0) material.clearcoatNormalScale = new Vector2().fromArray(json.clearcoatNormalScale);
      if (json.iridescenceMap !== void 0) material.iridescenceMap = getTexture(json.iridescenceMap);
      if (json.iridescenceThicknessMap !== void 0) material.iridescenceThicknessMap = getTexture(json.iridescenceThicknessMap);
      if (json.transmissionMap !== void 0) material.transmissionMap = getTexture(json.transmissionMap);
      if (json.thicknessMap !== void 0) material.thicknessMap = getTexture(json.thicknessMap);
      if (json.anisotropyMap !== void 0) material.anisotropyMap = getTexture(json.anisotropyMap);
      if (json.sheenColorMap !== void 0) material.sheenColorMap = getTexture(json.sheenColorMap);
      if (json.sheenRoughnessMap !== void 0) material.sheenRoughnessMap = getTexture(json.sheenRoughnessMap);
      return material;
    }
    setTextures(value) {
      this.textures = value;
      return this;
    }
    static createMaterialFromType(type) {
      const materialLib = {
        ShadowMaterial,
        SpriteMaterial,
        RawShaderMaterial,
        ShaderMaterial,
        PointsMaterial,
        MeshPhysicalMaterial,
        MeshStandardMaterial,
        MeshPhongMaterial,
        MeshToonMaterial,
        MeshNormalMaterial,
        MeshLambertMaterial,
        MeshDepthMaterial,
        MeshDistanceMaterial,
        MeshBasicMaterial,
        MeshMatcapMaterial,
        LineDashedMaterial,
        LineBasicMaterial,
        Material
      };
      return new materialLib[type]();
    }
  };
  var LoaderUtils = class {
    static decodeText(array) {
      if (typeof TextDecoder !== "undefined") {
        return new TextDecoder().decode(array);
      }
      let s = "";
      for (let i = 0, il = array.length; i < il; i++) {
        s += String.fromCharCode(array[i]);
      }
      try {
        return decodeURIComponent(escape(s));
      } catch (e) {
        return s;
      }
    }
    static extractUrlBase(url) {
      const index = url.lastIndexOf("/");
      if (index === -1) return "./";
      return url.slice(0, index + 1);
    }
    static resolveURL(url, path) {
      if (typeof url !== "string" || url === "") return "";
      if (/^https?:\/\//i.test(path) && /^\//.test(url)) {
        path = path.replace(/(^https?:\/\/[^\/]+).*/i, "$1");
      }
      if (/^(https?:)?\/\//i.test(url)) return url;
      if (/^data:.*,.*$/i.test(url)) return url;
      if (/^blob:.*$/i.test(url)) return url;
      return path + url;
    }
  };
  var InstancedBufferGeometry = class extends BufferGeometry {
    constructor() {
      super();
      this.isInstancedBufferGeometry = true;
      this.type = "InstancedBufferGeometry";
      this.instanceCount = Infinity;
    }
    copy(source) {
      super.copy(source);
      this.instanceCount = source.instanceCount;
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.instanceCount = this.instanceCount;
      data.isInstancedBufferGeometry = true;
      return data;
    }
  };
  var BufferGeometryLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      const scope = this;
      const loader = new FileLoader(scope.manager);
      loader.setPath(scope.path);
      loader.setRequestHeader(scope.requestHeader);
      loader.setWithCredentials(scope.withCredentials);
      loader.load(url, function(text) {
        try {
          onLoad(scope.parse(JSON.parse(text)));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      }, onProgress, onError);
    }
    parse(json) {
      const interleavedBufferMap = {};
      const arrayBufferMap = {};
      function getInterleavedBuffer(json2, uuid) {
        if (interleavedBufferMap[uuid] !== void 0) return interleavedBufferMap[uuid];
        const interleavedBuffers = json2.interleavedBuffers;
        const interleavedBuffer = interleavedBuffers[uuid];
        const buffer = getArrayBuffer(json2, interleavedBuffer.buffer);
        const array = getTypedArray(interleavedBuffer.type, buffer);
        const ib = new InterleavedBuffer(array, interleavedBuffer.stride);
        ib.uuid = interleavedBuffer.uuid;
        interleavedBufferMap[uuid] = ib;
        return ib;
      }
      function getArrayBuffer(json2, uuid) {
        if (arrayBufferMap[uuid] !== void 0) return arrayBufferMap[uuid];
        const arrayBuffers = json2.arrayBuffers;
        const arrayBuffer = arrayBuffers[uuid];
        const ab = new Uint32Array(arrayBuffer).buffer;
        arrayBufferMap[uuid] = ab;
        return ab;
      }
      const geometry = json.isInstancedBufferGeometry ? new InstancedBufferGeometry() : new BufferGeometry();
      const index = json.data.index;
      if (index !== void 0) {
        const typedArray = getTypedArray(index.type, index.array);
        geometry.setIndex(new BufferAttribute(typedArray, 1));
      }
      const attributes = json.data.attributes;
      for (const key in attributes) {
        const attribute = attributes[key];
        let bufferAttribute;
        if (attribute.isInterleavedBufferAttribute) {
          const interleavedBuffer = getInterleavedBuffer(json.data, attribute.data);
          bufferAttribute = new InterleavedBufferAttribute(interleavedBuffer, attribute.itemSize, attribute.offset, attribute.normalized);
        } else {
          const typedArray = getTypedArray(attribute.type, attribute.array);
          const bufferAttributeConstr = attribute.isInstancedBufferAttribute ? InstancedBufferAttribute : BufferAttribute;
          bufferAttribute = new bufferAttributeConstr(typedArray, attribute.itemSize, attribute.normalized);
        }
        if (attribute.name !== void 0) bufferAttribute.name = attribute.name;
        if (attribute.usage !== void 0) bufferAttribute.setUsage(attribute.usage);
        geometry.setAttribute(key, bufferAttribute);
      }
      const morphAttributes = json.data.morphAttributes;
      if (morphAttributes) {
        for (const key in morphAttributes) {
          const attributeArray = morphAttributes[key];
          const array = [];
          for (let i = 0, il = attributeArray.length; i < il; i++) {
            const attribute = attributeArray[i];
            let bufferAttribute;
            if (attribute.isInterleavedBufferAttribute) {
              const interleavedBuffer = getInterleavedBuffer(json.data, attribute.data);
              bufferAttribute = new InterleavedBufferAttribute(interleavedBuffer, attribute.itemSize, attribute.offset, attribute.normalized);
            } else {
              const typedArray = getTypedArray(attribute.type, attribute.array);
              bufferAttribute = new BufferAttribute(typedArray, attribute.itemSize, attribute.normalized);
            }
            if (attribute.name !== void 0) bufferAttribute.name = attribute.name;
            array.push(bufferAttribute);
          }
          geometry.morphAttributes[key] = array;
        }
      }
      const morphTargetsRelative = json.data.morphTargetsRelative;
      if (morphTargetsRelative) {
        geometry.morphTargetsRelative = true;
      }
      const groups = json.data.groups || json.data.drawcalls || json.data.offsets;
      if (groups !== void 0) {
        for (let i = 0, n = groups.length; i !== n; ++i) {
          const group = groups[i];
          geometry.addGroup(group.start, group.count, group.materialIndex);
        }
      }
      const boundingSphere = json.data.boundingSphere;
      if (boundingSphere !== void 0) {
        const center = new Vector3();
        if (boundingSphere.center !== void 0) {
          center.fromArray(boundingSphere.center);
        }
        geometry.boundingSphere = new Sphere(center, boundingSphere.radius);
      }
      if (json.name) geometry.name = json.name;
      if (json.userData) geometry.userData = json.userData;
      return geometry;
    }
  };
  var ObjectLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      const scope = this;
      const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;
      this.resourcePath = this.resourcePath || path;
      const loader = new FileLoader(this.manager);
      loader.setPath(this.path);
      loader.setRequestHeader(this.requestHeader);
      loader.setWithCredentials(this.withCredentials);
      loader.load(url, function(text) {
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (error) {
          if (onError !== void 0) onError(error);
          console.error("THREE:ObjectLoader: Can't parse " + url + ".", error.message);
          return;
        }
        const metadata = json.metadata;
        if (metadata === void 0 || metadata.type === void 0 || metadata.type.toLowerCase() === "geometry") {
          if (onError !== void 0) onError(new Error("THREE.ObjectLoader: Can't load " + url));
          console.error("THREE.ObjectLoader: Can't load " + url);
          return;
        }
        scope.parse(json, onLoad);
      }, onProgress, onError);
    }
    async loadAsync(url, onProgress) {
      const scope = this;
      const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;
      this.resourcePath = this.resourcePath || path;
      const loader = new FileLoader(this.manager);
      loader.setPath(this.path);
      loader.setRequestHeader(this.requestHeader);
      loader.setWithCredentials(this.withCredentials);
      const text = await loader.loadAsync(url, onProgress);
      const json = JSON.parse(text);
      const metadata = json.metadata;
      if (metadata === void 0 || metadata.type === void 0 || metadata.type.toLowerCase() === "geometry") {
        throw new Error("THREE.ObjectLoader: Can't load " + url);
      }
      return await scope.parseAsync(json);
    }
    parse(json, onLoad) {
      const animations = this.parseAnimations(json.animations);
      const shapes = this.parseShapes(json.shapes);
      const geometries = this.parseGeometries(json.geometries, shapes);
      const images = this.parseImages(json.images, function() {
        if (onLoad !== void 0) onLoad(object);
      });
      const textures = this.parseTextures(json.textures, images);
      const materials = this.parseMaterials(json.materials, textures);
      const object = this.parseObject(json.object, geometries, materials, textures, animations);
      const skeletons = this.parseSkeletons(json.skeletons, object);
      this.bindSkeletons(object, skeletons);
      if (onLoad !== void 0) {
        let hasImages = false;
        for (const uuid in images) {
          if (images[uuid].data instanceof HTMLImageElement) {
            hasImages = true;
            break;
          }
        }
        if (hasImages === false) onLoad(object);
      }
      return object;
    }
    async parseAsync(json) {
      const animations = this.parseAnimations(json.animations);
      const shapes = this.parseShapes(json.shapes);
      const geometries = this.parseGeometries(json.geometries, shapes);
      const images = await this.parseImagesAsync(json.images);
      const textures = this.parseTextures(json.textures, images);
      const materials = this.parseMaterials(json.materials, textures);
      const object = this.parseObject(json.object, geometries, materials, textures, animations);
      const skeletons = this.parseSkeletons(json.skeletons, object);
      this.bindSkeletons(object, skeletons);
      return object;
    }
    parseShapes(json) {
      const shapes = {};
      if (json !== void 0) {
        for (let i = 0, l = json.length; i < l; i++) {
          const shape = new Shape().fromJSON(json[i]);
          shapes[shape.uuid] = shape;
        }
      }
      return shapes;
    }
    parseSkeletons(json, object) {
      const skeletons = {};
      const bones = {};
      object.traverse(function(child) {
        if (child.isBone) bones[child.uuid] = child;
      });
      if (json !== void 0) {
        for (let i = 0, l = json.length; i < l; i++) {
          const skeleton = new Skeleton().fromJSON(json[i], bones);
          skeletons[skeleton.uuid] = skeleton;
        }
      }
      return skeletons;
    }
    parseGeometries(json, shapes) {
      const geometries = {};
      if (json !== void 0) {
        const bufferGeometryLoader = new BufferGeometryLoader();
        for (let i = 0, l = json.length; i < l; i++) {
          let geometry;
          const data = json[i];
          switch (data.type) {
            case "BufferGeometry":
            case "InstancedBufferGeometry":
              geometry = bufferGeometryLoader.parse(data);
              break;
            default:
              if (data.type in Geometries) {
                geometry = Geometries[data.type].fromJSON(data, shapes);
              } else {
                console.warn(`THREE.ObjectLoader: Unsupported geometry type "${data.type}"`);
              }
          }
          geometry.uuid = data.uuid;
          if (data.name !== void 0) geometry.name = data.name;
          if (data.userData !== void 0) geometry.userData = data.userData;
          geometries[data.uuid] = geometry;
        }
      }
      return geometries;
    }
    parseMaterials(json, textures) {
      const cache = {};
      const materials = {};
      if (json !== void 0) {
        const loader = new MaterialLoader();
        loader.setTextures(textures);
        for (let i = 0, l = json.length; i < l; i++) {
          const data = json[i];
          if (cache[data.uuid] === void 0) {
            cache[data.uuid] = loader.parse(data);
          }
          materials[data.uuid] = cache[data.uuid];
        }
      }
      return materials;
    }
    parseAnimations(json) {
      const animations = {};
      if (json !== void 0) {
        for (let i = 0; i < json.length; i++) {
          const data = json[i];
          const clip = AnimationClip.parse(data);
          animations[clip.uuid] = clip;
        }
      }
      return animations;
    }
    parseImages(json, onLoad) {
      const scope = this;
      const images = {};
      let loader;
      function loadImage(url) {
        scope.manager.itemStart(url);
        return loader.load(url, function() {
          scope.manager.itemEnd(url);
        }, void 0, function() {
          scope.manager.itemError(url);
          scope.manager.itemEnd(url);
        });
      }
      function deserializeImage(image) {
        if (typeof image === "string") {
          const url = image;
          const path = /^(\/\/)|([a-z]+:(\/\/)?)/i.test(url) ? url : scope.resourcePath + url;
          return loadImage(path);
        } else {
          if (image.data) {
            return {
              data: getTypedArray(image.type, image.data),
              width: image.width,
              height: image.height
            };
          } else {
            return null;
          }
        }
      }
      if (json !== void 0 && json.length > 0) {
        const manager = new LoadingManager(onLoad);
        loader = new ImageLoader(manager);
        loader.setCrossOrigin(this.crossOrigin);
        for (let i = 0, il = json.length; i < il; i++) {
          const image = json[i];
          const url = image.url;
          if (Array.isArray(url)) {
            const imageArray = [];
            for (let j = 0, jl = url.length; j < jl; j++) {
              const currentUrl = url[j];
              const deserializedImage = deserializeImage(currentUrl);
              if (deserializedImage !== null) {
                if (deserializedImage instanceof HTMLImageElement) {
                  imageArray.push(deserializedImage);
                } else {
                  imageArray.push(new DataTexture(deserializedImage.data, deserializedImage.width, deserializedImage.height));
                }
              }
            }
            images[image.uuid] = new Source(imageArray);
          } else {
            const deserializedImage = deserializeImage(image.url);
            images[image.uuid] = new Source(deserializedImage);
          }
        }
      }
      return images;
    }
    async parseImagesAsync(json) {
      const scope = this;
      const images = {};
      let loader;
      async function deserializeImage(image) {
        if (typeof image === "string") {
          const url = image;
          const path = /^(\/\/)|([a-z]+:(\/\/)?)/i.test(url) ? url : scope.resourcePath + url;
          return await loader.loadAsync(path);
        } else {
          if (image.data) {
            return {
              data: getTypedArray(image.type, image.data),
              width: image.width,
              height: image.height
            };
          } else {
            return null;
          }
        }
      }
      if (json !== void 0 && json.length > 0) {
        loader = new ImageLoader(this.manager);
        loader.setCrossOrigin(this.crossOrigin);
        for (let i = 0, il = json.length; i < il; i++) {
          const image = json[i];
          const url = image.url;
          if (Array.isArray(url)) {
            const imageArray = [];
            for (let j = 0, jl = url.length; j < jl; j++) {
              const currentUrl = url[j];
              const deserializedImage = await deserializeImage(currentUrl);
              if (deserializedImage !== null) {
                if (deserializedImage instanceof HTMLImageElement) {
                  imageArray.push(deserializedImage);
                } else {
                  imageArray.push(new DataTexture(deserializedImage.data, deserializedImage.width, deserializedImage.height));
                }
              }
            }
            images[image.uuid] = new Source(imageArray);
          } else {
            const deserializedImage = await deserializeImage(image.url);
            images[image.uuid] = new Source(deserializedImage);
          }
        }
      }
      return images;
    }
    parseTextures(json, images) {
      function parseConstant(value, type) {
        if (typeof value === "number") return value;
        console.warn("THREE.ObjectLoader.parseTexture: Constant should be in numeric form.", value);
        return type[value];
      }
      const textures = {};
      if (json !== void 0) {
        for (let i = 0, l = json.length; i < l; i++) {
          const data = json[i];
          if (data.image === void 0) {
            console.warn('THREE.ObjectLoader: No "image" specified for', data.uuid);
          }
          if (images[data.image] === void 0) {
            console.warn("THREE.ObjectLoader: Undefined image", data.image);
          }
          const source = images[data.image];
          const image = source.data;
          let texture;
          if (Array.isArray(image)) {
            texture = new CubeTexture();
            if (image.length === 6) texture.needsUpdate = true;
          } else {
            if (image && image.data) {
              texture = new DataTexture();
            } else {
              texture = new Texture();
            }
            if (image) texture.needsUpdate = true;
          }
          texture.source = source;
          texture.uuid = data.uuid;
          if (data.name !== void 0) texture.name = data.name;
          if (data.mapping !== void 0) texture.mapping = parseConstant(data.mapping, TEXTURE_MAPPING);
          if (data.channel !== void 0) texture.channel = data.channel;
          if (data.offset !== void 0) texture.offset.fromArray(data.offset);
          if (data.repeat !== void 0) texture.repeat.fromArray(data.repeat);
          if (data.center !== void 0) texture.center.fromArray(data.center);
          if (data.rotation !== void 0) texture.rotation = data.rotation;
          if (data.wrap !== void 0) {
            texture.wrapS = parseConstant(data.wrap[0], TEXTURE_WRAPPING);
            texture.wrapT = parseConstant(data.wrap[1], TEXTURE_WRAPPING);
          }
          if (data.format !== void 0) texture.format = data.format;
          if (data.internalFormat !== void 0) texture.internalFormat = data.internalFormat;
          if (data.type !== void 0) texture.type = data.type;
          if (data.colorSpace !== void 0) texture.colorSpace = data.colorSpace;
          if (data.encoding !== void 0) texture.encoding = data.encoding;
          if (data.minFilter !== void 0) texture.minFilter = parseConstant(data.minFilter, TEXTURE_FILTER);
          if (data.magFilter !== void 0) texture.magFilter = parseConstant(data.magFilter, TEXTURE_FILTER);
          if (data.anisotropy !== void 0) texture.anisotropy = data.anisotropy;
          if (data.flipY !== void 0) texture.flipY = data.flipY;
          if (data.generateMipmaps !== void 0) texture.generateMipmaps = data.generateMipmaps;
          if (data.premultiplyAlpha !== void 0) texture.premultiplyAlpha = data.premultiplyAlpha;
          if (data.unpackAlignment !== void 0) texture.unpackAlignment = data.unpackAlignment;
          if (data.compareFunction !== void 0) texture.compareFunction = data.compareFunction;
          if (data.userData !== void 0) texture.userData = data.userData;
          textures[data.uuid] = texture;
        }
      }
      return textures;
    }
    parseObject(data, geometries, materials, textures, animations) {
      let object;
      function getGeometry(name) {
        if (geometries[name] === void 0) {
          console.warn("THREE.ObjectLoader: Undefined geometry", name);
        }
        return geometries[name];
      }
      function getMaterial(name) {
        if (name === void 0) return void 0;
        if (Array.isArray(name)) {
          const array = [];
          for (let i = 0, l = name.length; i < l; i++) {
            const uuid = name[i];
            if (materials[uuid] === void 0) {
              console.warn("THREE.ObjectLoader: Undefined material", uuid);
            }
            array.push(materials[uuid]);
          }
          return array;
        }
        if (materials[name] === void 0) {
          console.warn("THREE.ObjectLoader: Undefined material", name);
        }
        return materials[name];
      }
      function getTexture(uuid) {
        if (textures[uuid] === void 0) {
          console.warn("THREE.ObjectLoader: Undefined texture", uuid);
        }
        return textures[uuid];
      }
      let geometry, material;
      switch (data.type) {
        case "Scene":
          object = new Scene();
          if (data.background !== void 0) {
            if (Number.isInteger(data.background)) {
              object.background = new Color(data.background);
            } else {
              object.background = getTexture(data.background);
            }
          }
          if (data.environment !== void 0) {
            object.environment = getTexture(data.environment);
          }
          if (data.fog !== void 0) {
            if (data.fog.type === "Fog") {
              object.fog = new Fog(data.fog.color, data.fog.near, data.fog.far);
            } else if (data.fog.type === "FogExp2") {
              object.fog = new FogExp2(data.fog.color, data.fog.density);
            }
            if (data.fog.name !== "") {
              object.fog.name = data.fog.name;
            }
          }
          if (data.backgroundBlurriness !== void 0) object.backgroundBlurriness = data.backgroundBlurriness;
          if (data.backgroundIntensity !== void 0) object.backgroundIntensity = data.backgroundIntensity;
          break;
        case "PerspectiveCamera":
          object = new PerspectiveCamera(data.fov, data.aspect, data.near, data.far);
          if (data.focus !== void 0) object.focus = data.focus;
          if (data.zoom !== void 0) object.zoom = data.zoom;
          if (data.filmGauge !== void 0) object.filmGauge = data.filmGauge;
          if (data.filmOffset !== void 0) object.filmOffset = data.filmOffset;
          if (data.view !== void 0) object.view = Object.assign({}, data.view);
          break;
        case "OrthographicCamera":
          object = new OrthographicCamera(data.left, data.right, data.top, data.bottom, data.near, data.far);
          if (data.zoom !== void 0) object.zoom = data.zoom;
          if (data.view !== void 0) object.view = Object.assign({}, data.view);
          break;
        case "AmbientLight":
          object = new AmbientLight(data.color, data.intensity);
          break;
        case "DirectionalLight":
          object = new DirectionalLight(data.color, data.intensity);
          break;
        case "PointLight":
          object = new PointLight(data.color, data.intensity, data.distance, data.decay);
          break;
        case "RectAreaLight":
          object = new RectAreaLight(data.color, data.intensity, data.width, data.height);
          break;
        case "SpotLight":
          object = new SpotLight(data.color, data.intensity, data.distance, data.angle, data.penumbra, data.decay);
          break;
        case "HemisphereLight":
          object = new HemisphereLight(data.color, data.groundColor, data.intensity);
          break;
        case "LightProbe":
          object = new LightProbe().fromJSON(data);
          break;
        case "SkinnedMesh":
          geometry = getGeometry(data.geometry);
          material = getMaterial(data.material);
          object = new SkinnedMesh(geometry, material);
          if (data.bindMode !== void 0) object.bindMode = data.bindMode;
          if (data.bindMatrix !== void 0) object.bindMatrix.fromArray(data.bindMatrix);
          if (data.skeleton !== void 0) object.skeleton = data.skeleton;
          break;
        case "Mesh":
          geometry = getGeometry(data.geometry);
          material = getMaterial(data.material);
          object = new Mesh(geometry, material);
          break;
        case "InstancedMesh":
          geometry = getGeometry(data.geometry);
          material = getMaterial(data.material);
          const count = data.count;
          const instanceMatrix = data.instanceMatrix;
          const instanceColor = data.instanceColor;
          object = new InstancedMesh(geometry, material, count);
          object.instanceMatrix = new InstancedBufferAttribute(new Float32Array(instanceMatrix.array), 16);
          if (instanceColor !== void 0) object.instanceColor = new InstancedBufferAttribute(new Float32Array(instanceColor.array), instanceColor.itemSize);
          break;
        case "BatchedMesh":
          geometry = getGeometry(data.geometry);
          material = getMaterial(data.material);
          object = new BatchedMesh(data.maxGeometryCount, data.maxVertexCount, data.maxIndexCount, material);
          object.geometry = geometry;
          object.perObjectFrustumCulled = data.perObjectFrustumCulled;
          object.sortObjects = data.sortObjects;
          object._drawRanges = data.drawRanges;
          object._reservedRanges = data.reservedRanges;
          object._visibility = data.visibility;
          object._active = data.active;
          object._bounds = data.bounds.map((bound) => {
            const box = new Box3();
            box.min.fromArray(bound.boxMin);
            box.max.fromArray(bound.boxMax);
            const sphere = new Sphere();
            sphere.radius = bound.sphereRadius;
            sphere.center.fromArray(bound.sphereCenter);
            return {
              boxInitialized: bound.boxInitialized,
              box,
              sphereInitialized: bound.sphereInitialized,
              sphere
            };
          });
          object._maxGeometryCount = data.maxGeometryCount;
          object._maxVertexCount = data.maxVertexCount;
          object._maxIndexCount = data.maxIndexCount;
          object._geometryInitialized = data.geometryInitialized;
          object._geometryCount = data.geometryCount;
          object._matricesTexture = getTexture(data.matricesTexture.uuid);
          break;
        case "LOD":
          object = new LOD();
          break;
        case "Line":
          object = new Line(getGeometry(data.geometry), getMaterial(data.material));
          break;
        case "LineLoop":
          object = new LineLoop(getGeometry(data.geometry), getMaterial(data.material));
          break;
        case "LineSegments":
          object = new LineSegments(getGeometry(data.geometry), getMaterial(data.material));
          break;
        case "PointCloud":
        case "Points":
          object = new Points(getGeometry(data.geometry), getMaterial(data.material));
          break;
        case "Sprite":
          object = new Sprite(getMaterial(data.material));
          break;
        case "Group":
          object = new Group();
          break;
        case "Bone":
          object = new Bone();
          break;
        default:
          object = new Object3D();
      }
      object.uuid = data.uuid;
      if (data.name !== void 0) object.name = data.name;
      if (data.matrix !== void 0) {
        object.matrix.fromArray(data.matrix);
        if (data.matrixAutoUpdate !== void 0) object.matrixAutoUpdate = data.matrixAutoUpdate;
        if (object.matrixAutoUpdate) object.matrix.decompose(object.position, object.quaternion, object.scale);
      } else {
        if (data.position !== void 0) object.position.fromArray(data.position);
        if (data.rotation !== void 0) object.rotation.fromArray(data.rotation);
        if (data.quaternion !== void 0) object.quaternion.fromArray(data.quaternion);
        if (data.scale !== void 0) object.scale.fromArray(data.scale);
      }
      if (data.up !== void 0) object.up.fromArray(data.up);
      if (data.castShadow !== void 0) object.castShadow = data.castShadow;
      if (data.receiveShadow !== void 0) object.receiveShadow = data.receiveShadow;
      if (data.shadow) {
        if (data.shadow.bias !== void 0) object.shadow.bias = data.shadow.bias;
        if (data.shadow.normalBias !== void 0) object.shadow.normalBias = data.shadow.normalBias;
        if (data.shadow.radius !== void 0) object.shadow.radius = data.shadow.radius;
        if (data.shadow.mapSize !== void 0) object.shadow.mapSize.fromArray(data.shadow.mapSize);
        if (data.shadow.camera !== void 0) object.shadow.camera = this.parseObject(data.shadow.camera);
      }
      if (data.visible !== void 0) object.visible = data.visible;
      if (data.frustumCulled !== void 0) object.frustumCulled = data.frustumCulled;
      if (data.renderOrder !== void 0) object.renderOrder = data.renderOrder;
      if (data.userData !== void 0) object.userData = data.userData;
      if (data.layers !== void 0) object.layers.mask = data.layers;
      if (data.children !== void 0) {
        const children = data.children;
        for (let i = 0; i < children.length; i++) {
          object.add(this.parseObject(children[i], geometries, materials, textures, animations));
        }
      }
      if (data.animations !== void 0) {
        const objectAnimations = data.animations;
        for (let i = 0; i < objectAnimations.length; i++) {
          const uuid = objectAnimations[i];
          object.animations.push(animations[uuid]);
        }
      }
      if (data.type === "LOD") {
        if (data.autoUpdate !== void 0) object.autoUpdate = data.autoUpdate;
        const levels = data.levels;
        for (let l = 0; l < levels.length; l++) {
          const level = levels[l];
          const child = object.getObjectByProperty("uuid", level.object);
          if (child !== void 0) {
            object.addLevel(child, level.distance, level.hysteresis);
          }
        }
      }
      return object;
    }
    bindSkeletons(object, skeletons) {
      if (Object.keys(skeletons).length === 0) return;
      object.traverse(function(child) {
        if (child.isSkinnedMesh === true && child.skeleton !== void 0) {
          const skeleton = skeletons[child.skeleton];
          if (skeleton === void 0) {
            console.warn("THREE.ObjectLoader: No skeleton found with UUID:", child.skeleton);
          } else {
            child.bind(skeleton, child.bindMatrix);
          }
        }
      });
    }
  };
  var TEXTURE_MAPPING = {
    UVMapping,
    CubeReflectionMapping,
    CubeRefractionMapping,
    EquirectangularReflectionMapping,
    EquirectangularRefractionMapping,
    CubeUVReflectionMapping
  };
  var TEXTURE_WRAPPING = {
    RepeatWrapping,
    ClampToEdgeWrapping,
    MirroredRepeatWrapping
  };
  var TEXTURE_FILTER = {
    NearestFilter,
    NearestMipmapNearestFilter,
    NearestMipmapLinearFilter,
    LinearFilter,
    LinearMipmapNearestFilter,
    LinearMipmapLinearFilter
  };
  var ImageBitmapLoader = class extends Loader {
    constructor(manager) {
      super(manager);
      this.isImageBitmapLoader = true;
      if (typeof createImageBitmap === "undefined") {
        console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported.");
      }
      if (typeof fetch === "undefined") {
        console.warn("THREE.ImageBitmapLoader: fetch() not supported.");
      }
      this.options = { premultiplyAlpha: "none" };
    }
    setOptions(options) {
      this.options = options;
      return this;
    }
    load(url, onLoad, onProgress, onError) {
      if (url === void 0) url = "";
      if (this.path !== void 0) url = this.path + url;
      url = this.manager.resolveURL(url);
      const scope = this;
      const cached = Cache.get(url);
      if (cached !== void 0) {
        scope.manager.itemStart(url);
        if (cached.then) {
          cached.then((imageBitmap) => {
            if (onLoad) onLoad(imageBitmap);
            scope.manager.itemEnd(url);
          }).catch((e) => {
            if (onError) onError(e);
          });
          return;
        }
        setTimeout(function() {
          if (onLoad) onLoad(cached);
          scope.manager.itemEnd(url);
        }, 0);
        return cached;
      }
      const fetchOptions = {};
      fetchOptions.credentials = this.crossOrigin === "anonymous" ? "same-origin" : "include";
      fetchOptions.headers = this.requestHeader;
      const promise = fetch(url, fetchOptions).then(function(res) {
        return res.blob();
      }).then(function(blob) {
        return createImageBitmap(blob, Object.assign(scope.options, { colorSpaceConversion: "none" }));
      }).then(function(imageBitmap) {
        Cache.add(url, imageBitmap);
        if (onLoad) onLoad(imageBitmap);
        scope.manager.itemEnd(url);
        return imageBitmap;
      }).catch(function(e) {
        if (onError) onError(e);
        Cache.remove(url);
        scope.manager.itemError(url);
        scope.manager.itemEnd(url);
      });
      Cache.add(url, promise);
      scope.manager.itemStart(url);
    }
  };
  var _context;
  var AudioContext = class {
    static getContext() {
      if (_context === void 0) {
        _context = new (window.AudioContext || window.webkitAudioContext)();
      }
      return _context;
    }
    static setContext(value) {
      _context = value;
    }
  };
  var AudioLoader = class extends Loader {
    constructor(manager) {
      super(manager);
    }
    load(url, onLoad, onProgress, onError) {
      const scope = this;
      const loader = new FileLoader(this.manager);
      loader.setResponseType("arraybuffer");
      loader.setPath(this.path);
      loader.setRequestHeader(this.requestHeader);
      loader.setWithCredentials(this.withCredentials);
      loader.load(url, function(buffer) {
        try {
          const bufferCopy = buffer.slice(0);
          const context = AudioContext.getContext();
          context.decodeAudioData(bufferCopy, function(audioBuffer) {
            onLoad(audioBuffer);
          }).catch(handleError);
        } catch (e) {
          handleError(e);
        }
      }, onProgress, onError);
      function handleError(e) {
        if (onError) {
          onError(e);
        } else {
          console.error(e);
        }
        scope.manager.itemError(url);
      }
    }
  };
  var _eyeRight = /* @__PURE__ */ new Matrix4();
  var _eyeLeft = /* @__PURE__ */ new Matrix4();
  var _projectionMatrix = /* @__PURE__ */ new Matrix4();
  var StereoCamera = class {
    constructor() {
      this.type = "StereoCamera";
      this.aspect = 1;
      this.eyeSep = 0.064;
      this.cameraL = new PerspectiveCamera();
      this.cameraL.layers.enable(1);
      this.cameraL.matrixAutoUpdate = false;
      this.cameraR = new PerspectiveCamera();
      this.cameraR.layers.enable(2);
      this.cameraR.matrixAutoUpdate = false;
      this._cache = {
        focus: null,
        fov: null,
        aspect: null,
        near: null,
        far: null,
        zoom: null,
        eyeSep: null
      };
    }
    update(camera) {
      const cache = this._cache;
      const needsUpdate = cache.focus !== camera.focus || cache.fov !== camera.fov || cache.aspect !== camera.aspect * this.aspect || cache.near !== camera.near || cache.far !== camera.far || cache.zoom !== camera.zoom || cache.eyeSep !== this.eyeSep;
      if (needsUpdate) {
        cache.focus = camera.focus;
        cache.fov = camera.fov;
        cache.aspect = camera.aspect * this.aspect;
        cache.near = camera.near;
        cache.far = camera.far;
        cache.zoom = camera.zoom;
        cache.eyeSep = this.eyeSep;
        _projectionMatrix.copy(camera.projectionMatrix);
        const eyeSepHalf = cache.eyeSep / 2;
        const eyeSepOnProjection = eyeSepHalf * cache.near / cache.focus;
        const ymax = cache.near * Math.tan(DEG2RAD * cache.fov * 0.5) / cache.zoom;
        let xmin, xmax;
        _eyeLeft.elements[12] = -eyeSepHalf;
        _eyeRight.elements[12] = eyeSepHalf;
        xmin = -ymax * cache.aspect + eyeSepOnProjection;
        xmax = ymax * cache.aspect + eyeSepOnProjection;
        _projectionMatrix.elements[0] = 2 * cache.near / (xmax - xmin);
        _projectionMatrix.elements[8] = (xmax + xmin) / (xmax - xmin);
        this.cameraL.projectionMatrix.copy(_projectionMatrix);
        xmin = -ymax * cache.aspect - eyeSepOnProjection;
        xmax = ymax * cache.aspect - eyeSepOnProjection;
        _projectionMatrix.elements[0] = 2 * cache.near / (xmax - xmin);
        _projectionMatrix.elements[8] = (xmax + xmin) / (xmax - xmin);
        this.cameraR.projectionMatrix.copy(_projectionMatrix);
      }
      this.cameraL.matrixWorld.copy(camera.matrixWorld).multiply(_eyeLeft);
      this.cameraR.matrixWorld.copy(camera.matrixWorld).multiply(_eyeRight);
    }
  };
  var Clock = class {
    constructor(autoStart = true) {
      this.autoStart = autoStart;
      this.startTime = 0;
      this.oldTime = 0;
      this.elapsedTime = 0;
      this.running = false;
    }
    start() {
      this.startTime = now();
      this.oldTime = this.startTime;
      this.elapsedTime = 0;
      this.running = true;
    }
    stop() {
      this.getElapsedTime();
      this.running = false;
      this.autoStart = false;
    }
    getElapsedTime() {
      this.getDelta();
      return this.elapsedTime;
    }
    getDelta() {
      let diff = 0;
      if (this.autoStart && !this.running) {
        this.start();
        return 0;
      }
      if (this.running) {
        const newTime = now();
        diff = (newTime - this.oldTime) / 1e3;
        this.oldTime = newTime;
        this.elapsedTime += diff;
      }
      return diff;
    }
  };
  function now() {
    return (typeof performance === "undefined" ? Date : performance).now();
  }
  var _position$1 = /* @__PURE__ */ new Vector3();
  var _quaternion$1 = /* @__PURE__ */ new Quaternion();
  var _scale$1 = /* @__PURE__ */ new Vector3();
  var _orientation$1 = /* @__PURE__ */ new Vector3();
  var AudioListener = class extends Object3D {
    constructor() {
      super();
      this.type = "AudioListener";
      this.context = AudioContext.getContext();
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
      this.filter = null;
      this.timeDelta = 0;
      this._clock = new Clock();
    }
    getInput() {
      return this.gain;
    }
    removeFilter() {
      if (this.filter !== null) {
        this.gain.disconnect(this.filter);
        this.filter.disconnect(this.context.destination);
        this.gain.connect(this.context.destination);
        this.filter = null;
      }
      return this;
    }
    getFilter() {
      return this.filter;
    }
    setFilter(value) {
      if (this.filter !== null) {
        this.gain.disconnect(this.filter);
        this.filter.disconnect(this.context.destination);
      } else {
        this.gain.disconnect(this.context.destination);
      }
      this.filter = value;
      this.gain.connect(this.filter);
      this.filter.connect(this.context.destination);
      return this;
    }
    getMasterVolume() {
      return this.gain.gain.value;
    }
    setMasterVolume(value) {
      this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
      return this;
    }
    updateMatrixWorld(force) {
      super.updateMatrixWorld(force);
      const listener = this.context.listener;
      const up = this.up;
      this.timeDelta = this._clock.getDelta();
      this.matrixWorld.decompose(_position$1, _quaternion$1, _scale$1);
      _orientation$1.set(0, 0, -1).applyQuaternion(_quaternion$1);
      if (listener.positionX) {
        const endTime = this.context.currentTime + this.timeDelta;
        listener.positionX.linearRampToValueAtTime(_position$1.x, endTime);
        listener.positionY.linearRampToValueAtTime(_position$1.y, endTime);
        listener.positionZ.linearRampToValueAtTime(_position$1.z, endTime);
        listener.forwardX.linearRampToValueAtTime(_orientation$1.x, endTime);
        listener.forwardY.linearRampToValueAtTime(_orientation$1.y, endTime);
        listener.forwardZ.linearRampToValueAtTime(_orientation$1.z, endTime);
        listener.upX.linearRampToValueAtTime(up.x, endTime);
        listener.upY.linearRampToValueAtTime(up.y, endTime);
        listener.upZ.linearRampToValueAtTime(up.z, endTime);
      } else {
        listener.setPosition(_position$1.x, _position$1.y, _position$1.z);
        listener.setOrientation(_orientation$1.x, _orientation$1.y, _orientation$1.z, up.x, up.y, up.z);
      }
    }
  };
  var Audio = class extends Object3D {
    constructor(listener) {
      super();
      this.type = "Audio";
      this.listener = listener;
      this.context = listener.context;
      this.gain = this.context.createGain();
      this.gain.connect(listener.getInput());
      this.autoplay = false;
      this.buffer = null;
      this.detune = 0;
      this.loop = false;
      this.loopStart = 0;
      this.loopEnd = 0;
      this.offset = 0;
      this.duration = void 0;
      this.playbackRate = 1;
      this.isPlaying = false;
      this.hasPlaybackControl = true;
      this.source = null;
      this.sourceType = "empty";
      this._startedAt = 0;
      this._progress = 0;
      this._connected = false;
      this.filters = [];
    }
    getOutput() {
      return this.gain;
    }
    setNodeSource(audioNode) {
      this.hasPlaybackControl = false;
      this.sourceType = "audioNode";
      this.source = audioNode;
      this.connect();
      return this;
    }
    setMediaElementSource(mediaElement) {
      this.hasPlaybackControl = false;
      this.sourceType = "mediaNode";
      this.source = this.context.createMediaElementSource(mediaElement);
      this.connect();
      return this;
    }
    setMediaStreamSource(mediaStream) {
      this.hasPlaybackControl = false;
      this.sourceType = "mediaStreamNode";
      this.source = this.context.createMediaStreamSource(mediaStream);
      this.connect();
      return this;
    }
    setBuffer(audioBuffer) {
      this.buffer = audioBuffer;
      this.sourceType = "buffer";
      if (this.autoplay) this.play();
      return this;
    }
    play(delay = 0) {
      if (this.isPlaying === true) {
        console.warn("THREE.Audio: Audio is already playing.");
        return;
      }
      if (this.hasPlaybackControl === false) {
        console.warn("THREE.Audio: this Audio has no playback control.");
        return;
      }
      this._startedAt = this.context.currentTime + delay;
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.loop = this.loop;
      source.loopStart = this.loopStart;
      source.loopEnd = this.loopEnd;
      source.onended = this.onEnded.bind(this);
      source.start(this._startedAt, this._progress + this.offset, this.duration);
      this.isPlaying = true;
      this.source = source;
      this.setDetune(this.detune);
      this.setPlaybackRate(this.playbackRate);
      return this.connect();
    }
    pause() {
      if (this.hasPlaybackControl === false) {
        console.warn("THREE.Audio: this Audio has no playback control.");
        return;
      }
      if (this.isPlaying === true) {
        this._progress += Math.max(this.context.currentTime - this._startedAt, 0) * this.playbackRate;
        if (this.loop === true) {
          this._progress = this._progress % (this.duration || this.buffer.duration);
        }
        this.source.stop();
        this.source.onended = null;
        this.isPlaying = false;
      }
      return this;
    }
    stop() {
      if (this.hasPlaybackControl === false) {
        console.warn("THREE.Audio: this Audio has no playback control.");
        return;
      }
      this._progress = 0;
      if (this.source !== null) {
        this.source.stop();
        this.source.onended = null;
      }
      this.isPlaying = false;
      return this;
    }
    connect() {
      if (this.filters.length > 0) {
        this.source.connect(this.filters[0]);
        for (let i = 1, l = this.filters.length; i < l; i++) {
          this.filters[i - 1].connect(this.filters[i]);
        }
        this.filters[this.filters.length - 1].connect(this.getOutput());
      } else {
        this.source.connect(this.getOutput());
      }
      this._connected = true;
      return this;
    }
    disconnect() {
      if (this._connected === false) {
        return;
      }
      if (this.filters.length > 0) {
        this.source.disconnect(this.filters[0]);
        for (let i = 1, l = this.filters.length; i < l; i++) {
          this.filters[i - 1].disconnect(this.filters[i]);
        }
        this.filters[this.filters.length - 1].disconnect(this.getOutput());
      } else {
        this.source.disconnect(this.getOutput());
      }
      this._connected = false;
      return this;
    }
    getFilters() {
      return this.filters;
    }
    setFilters(value) {
      if (!value) value = [];
      if (this._connected === true) {
        this.disconnect();
        this.filters = value.slice();
        this.connect();
      } else {
        this.filters = value.slice();
      }
      return this;
    }
    setDetune(value) {
      this.detune = value;
      if (this.source.detune === void 0) return;
      if (this.isPlaying === true) {
        this.source.detune.setTargetAtTime(this.detune, this.context.currentTime, 0.01);
      }
      return this;
    }
    getDetune() {
      return this.detune;
    }
    getFilter() {
      return this.getFilters()[0];
    }
    setFilter(filter) {
      return this.setFilters(filter ? [filter] : []);
    }
    setPlaybackRate(value) {
      if (this.hasPlaybackControl === false) {
        console.warn("THREE.Audio: this Audio has no playback control.");
        return;
      }
      this.playbackRate = value;
      if (this.isPlaying === true) {
        this.source.playbackRate.setTargetAtTime(this.playbackRate, this.context.currentTime, 0.01);
      }
      return this;
    }
    getPlaybackRate() {
      return this.playbackRate;
    }
    onEnded() {
      this.isPlaying = false;
    }
    getLoop() {
      if (this.hasPlaybackControl === false) {
        console.warn("THREE.Audio: this Audio has no playback control.");
        return false;
      }
      return this.loop;
    }
    setLoop(value) {
      if (this.hasPlaybackControl === false) {
        console.warn("THREE.Audio: this Audio has no playback control.");
        return;
      }
      this.loop = value;
      if (this.isPlaying === true) {
        this.source.loop = this.loop;
      }
      return this;
    }
    setLoopStart(value) {
      this.loopStart = value;
      return this;
    }
    setLoopEnd(value) {
      this.loopEnd = value;
      return this;
    }
    getVolume() {
      return this.gain.gain.value;
    }
    setVolume(value) {
      this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
      return this;
    }
  };
  var _position = /* @__PURE__ */ new Vector3();
  var _quaternion = /* @__PURE__ */ new Quaternion();
  var _scale = /* @__PURE__ */ new Vector3();
  var _orientation = /* @__PURE__ */ new Vector3();
  var PositionalAudio = class extends Audio {
    constructor(listener) {
      super(listener);
      this.panner = this.context.createPanner();
      this.panner.panningModel = "HRTF";
      this.panner.connect(this.gain);
    }
    connect() {
      super.connect();
      this.panner.connect(this.gain);
    }
    disconnect() {
      super.disconnect();
      this.panner.disconnect(this.gain);
    }
    getOutput() {
      return this.panner;
    }
    getRefDistance() {
      return this.panner.refDistance;
    }
    setRefDistance(value) {
      this.panner.refDistance = value;
      return this;
    }
    getRolloffFactor() {
      return this.panner.rolloffFactor;
    }
    setRolloffFactor(value) {
      this.panner.rolloffFactor = value;
      return this;
    }
    getDistanceModel() {
      return this.panner.distanceModel;
    }
    setDistanceModel(value) {
      this.panner.distanceModel = value;
      return this;
    }
    getMaxDistance() {
      return this.panner.maxDistance;
    }
    setMaxDistance(value) {
      this.panner.maxDistance = value;
      return this;
    }
    setDirectionalCone(coneInnerAngle, coneOuterAngle, coneOuterGain) {
      this.panner.coneInnerAngle = coneInnerAngle;
      this.panner.coneOuterAngle = coneOuterAngle;
      this.panner.coneOuterGain = coneOuterGain;
      return this;
    }
    updateMatrixWorld(force) {
      super.updateMatrixWorld(force);
      if (this.hasPlaybackControl === true && this.isPlaying === false) return;
      this.matrixWorld.decompose(_position, _quaternion, _scale);
      _orientation.set(0, 0, 1).applyQuaternion(_quaternion);
      const panner = this.panner;
      if (panner.positionX) {
        const endTime = this.context.currentTime + this.listener.timeDelta;
        panner.positionX.linearRampToValueAtTime(_position.x, endTime);
        panner.positionY.linearRampToValueAtTime(_position.y, endTime);
        panner.positionZ.linearRampToValueAtTime(_position.z, endTime);
        panner.orientationX.linearRampToValueAtTime(_orientation.x, endTime);
        panner.orientationY.linearRampToValueAtTime(_orientation.y, endTime);
        panner.orientationZ.linearRampToValueAtTime(_orientation.z, endTime);
      } else {
        panner.setPosition(_position.x, _position.y, _position.z);
        panner.setOrientation(_orientation.x, _orientation.y, _orientation.z);
      }
    }
  };
  var AudioAnalyser = class {
    constructor(audio, fftSize = 2048) {
      this.analyser = audio.context.createAnalyser();
      this.analyser.fftSize = fftSize;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      audio.getOutput().connect(this.analyser);
    }
    getFrequencyData() {
      this.analyser.getByteFrequencyData(this.data);
      return this.data;
    }
    getAverageFrequency() {
      let value = 0;
      const data = this.getFrequencyData();
      for (let i = 0; i < data.length; i++) {
        value += data[i];
      }
      return value / data.length;
    }
  };
  var PropertyMixer = class {
    constructor(binding, typeName, valueSize) {
      this.binding = binding;
      this.valueSize = valueSize;
      let mixFunction, mixFunctionAdditive, setIdentity;
      switch (typeName) {
        case "quaternion":
          mixFunction = this._slerp;
          mixFunctionAdditive = this._slerpAdditive;
          setIdentity = this._setAdditiveIdentityQuaternion;
          this.buffer = new Float64Array(valueSize * 6);
          this._workIndex = 5;
          break;
        case "string":
        case "bool":
          mixFunction = this._select;
          mixFunctionAdditive = this._select;
          setIdentity = this._setAdditiveIdentityOther;
          this.buffer = new Array(valueSize * 5);
          break;
        default:
          mixFunction = this._lerp;
          mixFunctionAdditive = this._lerpAdditive;
          setIdentity = this._setAdditiveIdentityNumeric;
          this.buffer = new Float64Array(valueSize * 5);
      }
      this._mixBufferRegion = mixFunction;
      this._mixBufferRegionAdditive = mixFunctionAdditive;
      this._setIdentity = setIdentity;
      this._origIndex = 3;
      this._addIndex = 4;
      this.cumulativeWeight = 0;
      this.cumulativeWeightAdditive = 0;
      this.useCount = 0;
      this.referenceCount = 0;
    }
    // accumulate data in the 'incoming' region into 'accu<i>'
    accumulate(accuIndex, weight) {
      const buffer = this.buffer, stride = this.valueSize, offset = accuIndex * stride + stride;
      let currentWeight = this.cumulativeWeight;
      if (currentWeight === 0) {
        for (let i = 0; i !== stride; ++i) {
          buffer[offset + i] = buffer[i];
        }
        currentWeight = weight;
      } else {
        currentWeight += weight;
        const mix = weight / currentWeight;
        this._mixBufferRegion(buffer, offset, 0, mix, stride);
      }
      this.cumulativeWeight = currentWeight;
    }
    // accumulate data in the 'incoming' region into 'add'
    accumulateAdditive(weight) {
      const buffer = this.buffer, stride = this.valueSize, offset = stride * this._addIndex;
      if (this.cumulativeWeightAdditive === 0) {
        this._setIdentity();
      }
      this._mixBufferRegionAdditive(buffer, offset, 0, weight, stride);
      this.cumulativeWeightAdditive += weight;
    }
    // apply the state of 'accu<i>' to the binding when accus differ
    apply(accuIndex) {
      const stride = this.valueSize, buffer = this.buffer, offset = accuIndex * stride + stride, weight = this.cumulativeWeight, weightAdditive = this.cumulativeWeightAdditive, binding = this.binding;
      this.cumulativeWeight = 0;
      this.cumulativeWeightAdditive = 0;
      if (weight < 1) {
        const originalValueOffset = stride * this._origIndex;
        this._mixBufferRegion(
          buffer,
          offset,
          originalValueOffset,
          1 - weight,
          stride
        );
      }
      if (weightAdditive > 0) {
        this._mixBufferRegionAdditive(buffer, offset, this._addIndex * stride, 1, stride);
      }
      for (let i = stride, e = stride + stride; i !== e; ++i) {
        if (buffer[i] !== buffer[i + stride]) {
          binding.setValue(buffer, offset);
          break;
        }
      }
    }
    // remember the state of the bound property and copy it to both accus
    saveOriginalState() {
      const binding = this.binding;
      const buffer = this.buffer, stride = this.valueSize, originalValueOffset = stride * this._origIndex;
      binding.getValue(buffer, originalValueOffset);
      for (let i = stride, e = originalValueOffset; i !== e; ++i) {
        buffer[i] = buffer[originalValueOffset + i % stride];
      }
      this._setIdentity();
      this.cumulativeWeight = 0;
      this.cumulativeWeightAdditive = 0;
    }
    // apply the state previously taken via 'saveOriginalState' to the binding
    restoreOriginalState() {
      const originalValueOffset = this.valueSize * 3;
      this.binding.setValue(this.buffer, originalValueOffset);
    }
    _setAdditiveIdentityNumeric() {
      const startIndex = this._addIndex * this.valueSize;
      const endIndex = startIndex + this.valueSize;
      for (let i = startIndex; i < endIndex; i++) {
        this.buffer[i] = 0;
      }
    }
    _setAdditiveIdentityQuaternion() {
      this._setAdditiveIdentityNumeric();
      this.buffer[this._addIndex * this.valueSize + 3] = 1;
    }
    _setAdditiveIdentityOther() {
      const startIndex = this._origIndex * this.valueSize;
      const targetIndex = this._addIndex * this.valueSize;
      for (let i = 0; i < this.valueSize; i++) {
        this.buffer[targetIndex + i] = this.buffer[startIndex + i];
      }
    }
    // mix functions
    _select(buffer, dstOffset, srcOffset, t, stride) {
      if (t >= 0.5) {
        for (let i = 0; i !== stride; ++i) {
          buffer[dstOffset + i] = buffer[srcOffset + i];
        }
      }
    }
    _slerp(buffer, dstOffset, srcOffset, t) {
      Quaternion.slerpFlat(buffer, dstOffset, buffer, dstOffset, buffer, srcOffset, t);
    }
    _slerpAdditive(buffer, dstOffset, srcOffset, t, stride) {
      const workOffset = this._workIndex * stride;
      Quaternion.multiplyQuaternionsFlat(buffer, workOffset, buffer, dstOffset, buffer, srcOffset);
      Quaternion.slerpFlat(buffer, dstOffset, buffer, dstOffset, buffer, workOffset, t);
    }
    _lerp(buffer, dstOffset, srcOffset, t, stride) {
      const s = 1 - t;
      for (let i = 0; i !== stride; ++i) {
        const j = dstOffset + i;
        buffer[j] = buffer[j] * s + buffer[srcOffset + i] * t;
      }
    }
    _lerpAdditive(buffer, dstOffset, srcOffset, t, stride) {
      for (let i = 0; i !== stride; ++i) {
        const j = dstOffset + i;
        buffer[j] = buffer[j] + buffer[srcOffset + i] * t;
      }
    }
  };
  var _RESERVED_CHARS_RE = "\\[\\]\\.:\\/";
  var _reservedRe = new RegExp("[" + _RESERVED_CHARS_RE + "]", "g");
  var _wordChar = "[^" + _RESERVED_CHARS_RE + "]";
  var _wordCharOrDot = "[^" + _RESERVED_CHARS_RE.replace("\\.", "") + "]";
  var _directoryRe = /* @__PURE__ */ /((?:WC+[\/:])*)/.source.replace("WC", _wordChar);
  var _nodeRe = /* @__PURE__ */ /(WCOD+)?/.source.replace("WCOD", _wordCharOrDot);
  var _objectRe = /* @__PURE__ */ /(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC", _wordChar);
  var _propertyRe = /* @__PURE__ */ /\.(WC+)(?:\[(.+)\])?/.source.replace("WC", _wordChar);
  var _trackRe = new RegExp(
    "^" + _directoryRe + _nodeRe + _objectRe + _propertyRe + "$"
  );
  var _supportedObjectNames = ["material", "materials", "bones", "map"];
  var Composite = class {
    constructor(targetGroup, path, optionalParsedPath) {
      const parsedPath = optionalParsedPath || PropertyBinding.parseTrackName(path);
      this._targetGroup = targetGroup;
      this._bindings = targetGroup.subscribe_(path, parsedPath);
    }
    getValue(array, offset) {
      this.bind();
      const firstValidIndex = this._targetGroup.nCachedObjects_, binding = this._bindings[firstValidIndex];
      if (binding !== void 0) binding.getValue(array, offset);
    }
    setValue(array, offset) {
      const bindings = this._bindings;
      for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
        bindings[i].setValue(array, offset);
      }
    }
    bind() {
      const bindings = this._bindings;
      for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
        bindings[i].bind();
      }
    }
    unbind() {
      const bindings = this._bindings;
      for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
        bindings[i].unbind();
      }
    }
  };
  var PropertyBinding = class _PropertyBinding {
    constructor(rootNode, path, parsedPath) {
      this.path = path;
      this.parsedPath = parsedPath || _PropertyBinding.parseTrackName(path);
      this.node = _PropertyBinding.findNode(rootNode, this.parsedPath.nodeName);
      this.rootNode = rootNode;
      this.getValue = this._getValue_unbound;
      this.setValue = this._setValue_unbound;
    }
    static create(root, path, parsedPath) {
      if (!(root && root.isAnimationObjectGroup)) {
        return new _PropertyBinding(root, path, parsedPath);
      } else {
        return new _PropertyBinding.Composite(root, path, parsedPath);
      }
    }
    /**
     * Replaces spaces with underscores and removes unsupported characters from
     * node names, to ensure compatibility with parseTrackName().
     *
     * @param {string} name Node name to be sanitized.
     * @return {string}
     */
    static sanitizeNodeName(name) {
      return name.replace(/\s/g, "_").replace(_reservedRe, "");
    }
    static parseTrackName(trackName) {
      const matches = _trackRe.exec(trackName);
      if (matches === null) {
        throw new Error("PropertyBinding: Cannot parse trackName: " + trackName);
      }
      const results = {
        // directoryName: matches[ 1 ], // (tschw) currently unused
        nodeName: matches[2],
        objectName: matches[3],
        objectIndex: matches[4],
        propertyName: matches[5],
        // required
        propertyIndex: matches[6]
      };
      const lastDot = results.nodeName && results.nodeName.lastIndexOf(".");
      if (lastDot !== void 0 && lastDot !== -1) {
        const objectName = results.nodeName.substring(lastDot + 1);
        if (_supportedObjectNames.indexOf(objectName) !== -1) {
          results.nodeName = results.nodeName.substring(0, lastDot);
          results.objectName = objectName;
        }
      }
      if (results.propertyName === null || results.propertyName.length === 0) {
        throw new Error("PropertyBinding: can not parse propertyName from trackName: " + trackName);
      }
      return results;
    }
    static findNode(root, nodeName) {
      if (nodeName === void 0 || nodeName === "" || nodeName === "." || nodeName === -1 || nodeName === root.name || nodeName === root.uuid) {
        return root;
      }
      if (root.skeleton) {
        const bone = root.skeleton.getBoneByName(nodeName);
        if (bone !== void 0) {
          return bone;
        }
      }
      if (root.children) {
        const searchNodeSubtree = function(children) {
          for (let i = 0; i < children.length; i++) {
            const childNode = children[i];
            if (childNode.name === nodeName || childNode.uuid === nodeName) {
              return childNode;
            }
            const result = searchNodeSubtree(childNode.children);
            if (result) return result;
          }
          return null;
        };
        const subTreeNode = searchNodeSubtree(root.children);
        if (subTreeNode) {
          return subTreeNode;
        }
      }
      return null;
    }
    // these are used to "bind" a nonexistent property
    _getValue_unavailable() {
    }
    _setValue_unavailable() {
    }
    // Getters
    _getValue_direct(buffer, offset) {
      buffer[offset] = this.targetObject[this.propertyName];
    }
    _getValue_array(buffer, offset) {
      const source = this.resolvedProperty;
      for (let i = 0, n = source.length; i !== n; ++i) {
        buffer[offset++] = source[i];
      }
    }
    _getValue_arrayElement(buffer, offset) {
      buffer[offset] = this.resolvedProperty[this.propertyIndex];
    }
    _getValue_toArray(buffer, offset) {
      this.resolvedProperty.toArray(buffer, offset);
    }
    // Direct
    _setValue_direct(buffer, offset) {
      this.targetObject[this.propertyName] = buffer[offset];
    }
    _setValue_direct_setNeedsUpdate(buffer, offset) {
      this.targetObject[this.propertyName] = buffer[offset];
      this.targetObject.needsUpdate = true;
    }
    _setValue_direct_setMatrixWorldNeedsUpdate(buffer, offset) {
      this.targetObject[this.propertyName] = buffer[offset];
      this.targetObject.matrixWorldNeedsUpdate = true;
    }
    // EntireArray
    _setValue_array(buffer, offset) {
      const dest = this.resolvedProperty;
      for (let i = 0, n = dest.length; i !== n; ++i) {
        dest[i] = buffer[offset++];
      }
    }
    _setValue_array_setNeedsUpdate(buffer, offset) {
      const dest = this.resolvedProperty;
      for (let i = 0, n = dest.length; i !== n; ++i) {
        dest[i] = buffer[offset++];
      }
      this.targetObject.needsUpdate = true;
    }
    _setValue_array_setMatrixWorldNeedsUpdate(buffer, offset) {
      const dest = this.resolvedProperty;
      for (let i = 0, n = dest.length; i !== n; ++i) {
        dest[i] = buffer[offset++];
      }
      this.targetObject.matrixWorldNeedsUpdate = true;
    }
    // ArrayElement
    _setValue_arrayElement(buffer, offset) {
      this.resolvedProperty[this.propertyIndex] = buffer[offset];
    }
    _setValue_arrayElement_setNeedsUpdate(buffer, offset) {
      this.resolvedProperty[this.propertyIndex] = buffer[offset];
      this.targetObject.needsUpdate = true;
    }
    _setValue_arrayElement_setMatrixWorldNeedsUpdate(buffer, offset) {
      this.resolvedProperty[this.propertyIndex] = buffer[offset];
      this.targetObject.matrixWorldNeedsUpdate = true;
    }
    // HasToFromArray
    _setValue_fromArray(buffer, offset) {
      this.resolvedProperty.fromArray(buffer, offset);
    }
    _setValue_fromArray_setNeedsUpdate(buffer, offset) {
      this.resolvedProperty.fromArray(buffer, offset);
      this.targetObject.needsUpdate = true;
    }
    _setValue_fromArray_setMatrixWorldNeedsUpdate(buffer, offset) {
      this.resolvedProperty.fromArray(buffer, offset);
      this.targetObject.matrixWorldNeedsUpdate = true;
    }
    _getValue_unbound(targetArray, offset) {
      this.bind();
      this.getValue(targetArray, offset);
    }
    _setValue_unbound(sourceArray, offset) {
      this.bind();
      this.setValue(sourceArray, offset);
    }
    // create getter / setter pair for a property in the scene graph
    bind() {
      let targetObject = this.node;
      const parsedPath = this.parsedPath;
      const objectName = parsedPath.objectName;
      const propertyName = parsedPath.propertyName;
      let propertyIndex = parsedPath.propertyIndex;
      if (!targetObject) {
        targetObject = _PropertyBinding.findNode(this.rootNode, parsedPath.nodeName);
        this.node = targetObject;
      }
      this.getValue = this._getValue_unavailable;
      this.setValue = this._setValue_unavailable;
      if (!targetObject) {
        console.warn("THREE.PropertyBinding: No target node found for track: " + this.path + ".");
        return;
      }
      if (objectName) {
        let objectIndex = parsedPath.objectIndex;
        switch (objectName) {
          case "materials":
            if (!targetObject.material) {
              console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.", this);
              return;
            }
            if (!targetObject.material.materials) {
              console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.", this);
              return;
            }
            targetObject = targetObject.material.materials;
            break;
          case "bones":
            if (!targetObject.skeleton) {
              console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
              return;
            }
            targetObject = targetObject.skeleton.bones;
            for (let i = 0; i < targetObject.length; i++) {
              if (targetObject[i].name === objectIndex) {
                objectIndex = i;
                break;
              }
            }
            break;
          case "map":
            if ("map" in targetObject) {
              targetObject = targetObject.map;
              break;
            }
            if (!targetObject.material) {
              console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.", this);
              return;
            }
            if (!targetObject.material.map) {
              console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.", this);
              return;
            }
            targetObject = targetObject.material.map;
            break;
          default:
            if (targetObject[objectName] === void 0) {
              console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.", this);
              return;
            }
            targetObject = targetObject[objectName];
        }
        if (objectIndex !== void 0) {
          if (targetObject[objectIndex] === void 0) {
            console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, targetObject);
            return;
          }
          targetObject = targetObject[objectIndex];
        }
      }
      const nodeProperty = targetObject[propertyName];
      if (nodeProperty === void 0) {
        const nodeName = parsedPath.nodeName;
        console.error("THREE.PropertyBinding: Trying to update property for track: " + nodeName + "." + propertyName + " but it wasn't found.", targetObject);
        return;
      }
      let versioning = this.Versioning.None;
      this.targetObject = targetObject;
      if (targetObject.needsUpdate !== void 0) {
        versioning = this.Versioning.NeedsUpdate;
      } else if (targetObject.matrixWorldNeedsUpdate !== void 0) {
        versioning = this.Versioning.MatrixWorldNeedsUpdate;
      }
      let bindingType = this.BindingType.Direct;
      if (propertyIndex !== void 0) {
        if (propertyName === "morphTargetInfluences") {
          if (!targetObject.geometry) {
            console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
            return;
          }
          if (!targetObject.geometry.morphAttributes) {
            console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.", this);
            return;
          }
          if (targetObject.morphTargetDictionary[propertyIndex] !== void 0) {
            propertyIndex = targetObject.morphTargetDictionary[propertyIndex];
          }
        }
        bindingType = this.BindingType.ArrayElement;
        this.resolvedProperty = nodeProperty;
        this.propertyIndex = propertyIndex;
      } else if (nodeProperty.fromArray !== void 0 && nodeProperty.toArray !== void 0) {
        bindingType = this.BindingType.HasFromToArray;
        this.resolvedProperty = nodeProperty;
      } else if (Array.isArray(nodeProperty)) {
        bindingType = this.BindingType.EntireArray;
        this.resolvedProperty = nodeProperty;
      } else {
        this.propertyName = propertyName;
      }
      this.getValue = this.GetterByBindingType[bindingType];
      this.setValue = this.SetterByBindingTypeAndVersioning[bindingType][versioning];
    }
    unbind() {
      this.node = null;
      this.getValue = this._getValue_unbound;
      this.setValue = this._setValue_unbound;
    }
  };
  PropertyBinding.Composite = Composite;
  PropertyBinding.prototype.BindingType = {
    Direct: 0,
    EntireArray: 1,
    ArrayElement: 2,
    HasFromToArray: 3
  };
  PropertyBinding.prototype.Versioning = {
    None: 0,
    NeedsUpdate: 1,
    MatrixWorldNeedsUpdate: 2
  };
  PropertyBinding.prototype.GetterByBindingType = [
    PropertyBinding.prototype._getValue_direct,
    PropertyBinding.prototype._getValue_array,
    PropertyBinding.prototype._getValue_arrayElement,
    PropertyBinding.prototype._getValue_toArray
  ];
  PropertyBinding.prototype.SetterByBindingTypeAndVersioning = [
    [
      // Direct
      PropertyBinding.prototype._setValue_direct,
      PropertyBinding.prototype._setValue_direct_setNeedsUpdate,
      PropertyBinding.prototype._setValue_direct_setMatrixWorldNeedsUpdate
    ],
    [
      // EntireArray
      PropertyBinding.prototype._setValue_array,
      PropertyBinding.prototype._setValue_array_setNeedsUpdate,
      PropertyBinding.prototype._setValue_array_setMatrixWorldNeedsUpdate
    ],
    [
      // ArrayElement
      PropertyBinding.prototype._setValue_arrayElement,
      PropertyBinding.prototype._setValue_arrayElement_setNeedsUpdate,
      PropertyBinding.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate
    ],
    [
      // HasToFromArray
      PropertyBinding.prototype._setValue_fromArray,
      PropertyBinding.prototype._setValue_fromArray_setNeedsUpdate,
      PropertyBinding.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate
    ]
  ];
  var AnimationObjectGroup = class {
    constructor() {
      this.isAnimationObjectGroup = true;
      this.uuid = generateUUID();
      this._objects = Array.prototype.slice.call(arguments);
      this.nCachedObjects_ = 0;
      const indices = {};
      this._indicesByUUID = indices;
      for (let i = 0, n = arguments.length; i !== n; ++i) {
        indices[arguments[i].uuid] = i;
      }
      this._paths = [];
      this._parsedPaths = [];
      this._bindings = [];
      this._bindingsIndicesByPath = {};
      const scope = this;
      this.stats = {
        objects: {
          get total() {
            return scope._objects.length;
          },
          get inUse() {
            return this.total - scope.nCachedObjects_;
          }
        },
        get bindingsPerObject() {
          return scope._bindings.length;
        }
      };
    }
    add() {
      const objects = this._objects, indicesByUUID = this._indicesByUUID, paths = this._paths, parsedPaths = this._parsedPaths, bindings = this._bindings, nBindings = bindings.length;
      let knownObject = void 0, nObjects = objects.length, nCachedObjects = this.nCachedObjects_;
      for (let i = 0, n = arguments.length; i !== n; ++i) {
        const object = arguments[i], uuid = object.uuid;
        let index = indicesByUUID[uuid];
        if (index === void 0) {
          index = nObjects++;
          indicesByUUID[uuid] = index;
          objects.push(object);
          for (let j = 0, m = nBindings; j !== m; ++j) {
            bindings[j].push(new PropertyBinding(object, paths[j], parsedPaths[j]));
          }
        } else if (index < nCachedObjects) {
          knownObject = objects[index];
          const firstActiveIndex = --nCachedObjects, lastCachedObject = objects[firstActiveIndex];
          indicesByUUID[lastCachedObject.uuid] = index;
          objects[index] = lastCachedObject;
          indicesByUUID[uuid] = firstActiveIndex;
          objects[firstActiveIndex] = object;
          for (let j = 0, m = nBindings; j !== m; ++j) {
            const bindingsForPath = bindings[j], lastCached = bindingsForPath[firstActiveIndex];
            let binding = bindingsForPath[index];
            bindingsForPath[index] = lastCached;
            if (binding === void 0) {
              binding = new PropertyBinding(object, paths[j], parsedPaths[j]);
            }
            bindingsForPath[firstActiveIndex] = binding;
          }
        } else if (objects[index] !== knownObject) {
          console.error("THREE.AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.");
        }
      }
      this.nCachedObjects_ = nCachedObjects;
    }
    remove() {
      const objects = this._objects, indicesByUUID = this._indicesByUUID, bindings = this._bindings, nBindings = bindings.length;
      let nCachedObjects = this.nCachedObjects_;
      for (let i = 0, n = arguments.length; i !== n; ++i) {
        const object = arguments[i], uuid = object.uuid, index = indicesByUUID[uuid];
        if (index !== void 0 && index >= nCachedObjects) {
          const lastCachedIndex = nCachedObjects++, firstActiveObject = objects[lastCachedIndex];
          indicesByUUID[firstActiveObject.uuid] = index;
          objects[index] = firstActiveObject;
          indicesByUUID[uuid] = lastCachedIndex;
          objects[lastCachedIndex] = object;
          for (let j = 0, m = nBindings; j !== m; ++j) {
            const bindingsForPath = bindings[j], firstActive = bindingsForPath[lastCachedIndex], binding = bindingsForPath[index];
            bindingsForPath[index] = firstActive;
            bindingsForPath[lastCachedIndex] = binding;
          }
        }
      }
      this.nCachedObjects_ = nCachedObjects;
    }
    // remove & forget
    uncache() {
      const objects = this._objects, indicesByUUID = this._indicesByUUID, bindings = this._bindings, nBindings = bindings.length;
      let nCachedObjects = this.nCachedObjects_, nObjects = objects.length;
      for (let i = 0, n = arguments.length; i !== n; ++i) {
        const object = arguments[i], uuid = object.uuid, index = indicesByUUID[uuid];
        if (index !== void 0) {
          delete indicesByUUID[uuid];
          if (index < nCachedObjects) {
            const firstActiveIndex = --nCachedObjects, lastCachedObject = objects[firstActiveIndex], lastIndex = --nObjects, lastObject = objects[lastIndex];
            indicesByUUID[lastCachedObject.uuid] = index;
            objects[index] = lastCachedObject;
            indicesByUUID[lastObject.uuid] = firstActiveIndex;
            objects[firstActiveIndex] = lastObject;
            objects.pop();
            for (let j = 0, m = nBindings; j !== m; ++j) {
              const bindingsForPath = bindings[j], lastCached = bindingsForPath[firstActiveIndex], last = bindingsForPath[lastIndex];
              bindingsForPath[index] = lastCached;
              bindingsForPath[firstActiveIndex] = last;
              bindingsForPath.pop();
            }
          } else {
            const lastIndex = --nObjects, lastObject = objects[lastIndex];
            if (lastIndex > 0) {
              indicesByUUID[lastObject.uuid] = index;
            }
            objects[index] = lastObject;
            objects.pop();
            for (let j = 0, m = nBindings; j !== m; ++j) {
              const bindingsForPath = bindings[j];
              bindingsForPath[index] = bindingsForPath[lastIndex];
              bindingsForPath.pop();
            }
          }
        }
      }
      this.nCachedObjects_ = nCachedObjects;
    }
    // Internal interface used by befriended PropertyBinding.Composite:
    subscribe_(path, parsedPath) {
      const indicesByPath = this._bindingsIndicesByPath;
      let index = indicesByPath[path];
      const bindings = this._bindings;
      if (index !== void 0) return bindings[index];
      const paths = this._paths, parsedPaths = this._parsedPaths, objects = this._objects, nObjects = objects.length, nCachedObjects = this.nCachedObjects_, bindingsForPath = new Array(nObjects);
      index = bindings.length;
      indicesByPath[path] = index;
      paths.push(path);
      parsedPaths.push(parsedPath);
      bindings.push(bindingsForPath);
      for (let i = nCachedObjects, n = objects.length; i !== n; ++i) {
        const object = objects[i];
        bindingsForPath[i] = new PropertyBinding(object, path, parsedPath);
      }
      return bindingsForPath;
    }
    unsubscribe_(path) {
      const indicesByPath = this._bindingsIndicesByPath, index = indicesByPath[path];
      if (index !== void 0) {
        const paths = this._paths, parsedPaths = this._parsedPaths, bindings = this._bindings, lastBindingsIndex = bindings.length - 1, lastBindings = bindings[lastBindingsIndex], lastBindingsPath = path[lastBindingsIndex];
        indicesByPath[lastBindingsPath] = index;
        bindings[index] = lastBindings;
        bindings.pop();
        parsedPaths[index] = parsedPaths[lastBindingsIndex];
        parsedPaths.pop();
        paths[index] = paths[lastBindingsIndex];
        paths.pop();
      }
    }
  };
  var AnimationAction = class {
    constructor(mixer, clip, localRoot = null, blendMode = clip.blendMode) {
      this._mixer = mixer;
      this._clip = clip;
      this._localRoot = localRoot;
      this.blendMode = blendMode;
      const tracks = clip.tracks, nTracks = tracks.length, interpolants = new Array(nTracks);
      const interpolantSettings = {
        endingStart: ZeroCurvatureEnding,
        endingEnd: ZeroCurvatureEnding
      };
      for (let i = 0; i !== nTracks; ++i) {
        const interpolant = tracks[i].createInterpolant(null);
        interpolants[i] = interpolant;
        interpolant.settings = interpolantSettings;
      }
      this._interpolantSettings = interpolantSettings;
      this._interpolants = interpolants;
      this._propertyBindings = new Array(nTracks);
      this._cacheIndex = null;
      this._byClipCacheIndex = null;
      this._timeScaleInterpolant = null;
      this._weightInterpolant = null;
      this.loop = LoopRepeat;
      this._loopCount = -1;
      this._startTime = null;
      this.time = 0;
      this.timeScale = 1;
      this._effectiveTimeScale = 1;
      this.weight = 1;
      this._effectiveWeight = 1;
      this.repetitions = Infinity;
      this.paused = false;
      this.enabled = true;
      this.clampWhenFinished = false;
      this.zeroSlopeAtStart = true;
      this.zeroSlopeAtEnd = true;
    }
    // State & Scheduling
    play() {
      this._mixer._activateAction(this);
      return this;
    }
    stop() {
      this._mixer._deactivateAction(this);
      return this.reset();
    }
    reset() {
      this.paused = false;
      this.enabled = true;
      this.time = 0;
      this._loopCount = -1;
      this._startTime = null;
      return this.stopFading().stopWarping();
    }
    isRunning() {
      return this.enabled && !this.paused && this.timeScale !== 0 && this._startTime === null && this._mixer._isActiveAction(this);
    }
    // return true when play has been called
    isScheduled() {
      return this._mixer._isActiveAction(this);
    }
    startAt(time) {
      this._startTime = time;
      return this;
    }
    setLoop(mode, repetitions) {
      this.loop = mode;
      this.repetitions = repetitions;
      return this;
    }
    // Weight
    // set the weight stopping any scheduled fading
    // although .enabled = false yields an effective weight of zero, this
    // method does *not* change .enabled, because it would be confusing
    setEffectiveWeight(weight) {
      this.weight = weight;
      this._effectiveWeight = this.enabled ? weight : 0;
      return this.stopFading();
    }
    // return the weight considering fading and .enabled
    getEffectiveWeight() {
      return this._effectiveWeight;
    }
    fadeIn(duration) {
      return this._scheduleFading(duration, 0, 1);
    }
    fadeOut(duration) {
      return this._scheduleFading(duration, 1, 0);
    }
    crossFadeFrom(fadeOutAction, duration, warp) {
      fadeOutAction.fadeOut(duration);
      this.fadeIn(duration);
      if (warp) {
        const fadeInDuration = this._clip.duration, fadeOutDuration = fadeOutAction._clip.duration, startEndRatio = fadeOutDuration / fadeInDuration, endStartRatio = fadeInDuration / fadeOutDuration;
        fadeOutAction.warp(1, startEndRatio, duration);
        this.warp(endStartRatio, 1, duration);
      }
      return this;
    }
    crossFadeTo(fadeInAction, duration, warp) {
      return fadeInAction.crossFadeFrom(this, duration, warp);
    }
    stopFading() {
      const weightInterpolant = this._weightInterpolant;
      if (weightInterpolant !== null) {
        this._weightInterpolant = null;
        this._mixer._takeBackControlInterpolant(weightInterpolant);
      }
      return this;
    }
    // Time Scale Control
    // set the time scale stopping any scheduled warping
    // although .paused = true yields an effective time scale of zero, this
    // method does *not* change .paused, because it would be confusing
    setEffectiveTimeScale(timeScale) {
      this.timeScale = timeScale;
      this._effectiveTimeScale = this.paused ? 0 : timeScale;
      return this.stopWarping();
    }
    // return the time scale considering warping and .paused
    getEffectiveTimeScale() {
      return this._effectiveTimeScale;
    }
    setDuration(duration) {
      this.timeScale = this._clip.duration / duration;
      return this.stopWarping();
    }
    syncWith(action) {
      this.time = action.time;
      this.timeScale = action.timeScale;
      return this.stopWarping();
    }
    halt(duration) {
      return this.warp(this._effectiveTimeScale, 0, duration);
    }
    warp(startTimeScale, endTimeScale, duration) {
      const mixer = this._mixer, now2 = mixer.time, timeScale = this.timeScale;
      let interpolant = this._timeScaleInterpolant;
      if (interpolant === null) {
        interpolant = mixer._lendControlInterpolant();
        this._timeScaleInterpolant = interpolant;
      }
      const times = interpolant.parameterPositions, values = interpolant.sampleValues;
      times[0] = now2;
      times[1] = now2 + duration;
      values[0] = startTimeScale / timeScale;
      values[1] = endTimeScale / timeScale;
      return this;
    }
    stopWarping() {
      const timeScaleInterpolant = this._timeScaleInterpolant;
      if (timeScaleInterpolant !== null) {
        this._timeScaleInterpolant = null;
        this._mixer._takeBackControlInterpolant(timeScaleInterpolant);
      }
      return this;
    }
    // Object Accessors
    getMixer() {
      return this._mixer;
    }
    getClip() {
      return this._clip;
    }
    getRoot() {
      return this._localRoot || this._mixer._root;
    }
    // Interna
    _update(time, deltaTime, timeDirection, accuIndex) {
      if (!this.enabled) {
        this._updateWeight(time);
        return;
      }
      const startTime = this._startTime;
      if (startTime !== null) {
        const timeRunning = (time - startTime) * timeDirection;
        if (timeRunning < 0 || timeDirection === 0) {
          deltaTime = 0;
        } else {
          this._startTime = null;
          deltaTime = timeDirection * timeRunning;
        }
      }
      deltaTime *= this._updateTimeScale(time);
      const clipTime = this._updateTime(deltaTime);
      const weight = this._updateWeight(time);
      if (weight > 0) {
        const interpolants = this._interpolants;
        const propertyMixers = this._propertyBindings;
        switch (this.blendMode) {
          case AdditiveAnimationBlendMode:
            for (let j = 0, m = interpolants.length; j !== m; ++j) {
              interpolants[j].evaluate(clipTime);
              propertyMixers[j].accumulateAdditive(weight);
            }
            break;
          case NormalAnimationBlendMode:
          default:
            for (let j = 0, m = interpolants.length; j !== m; ++j) {
              interpolants[j].evaluate(clipTime);
              propertyMixers[j].accumulate(accuIndex, weight);
            }
        }
      }
    }
    _updateWeight(time) {
      let weight = 0;
      if (this.enabled) {
        weight = this.weight;
        const interpolant = this._weightInterpolant;
        if (interpolant !== null) {
          const interpolantValue = interpolant.evaluate(time)[0];
          weight *= interpolantValue;
          if (time > interpolant.parameterPositions[1]) {
            this.stopFading();
            if (interpolantValue === 0) {
              this.enabled = false;
            }
          }
        }
      }
      this._effectiveWeight = weight;
      return weight;
    }
    _updateTimeScale(time) {
      let timeScale = 0;
      if (!this.paused) {
        timeScale = this.timeScale;
        const interpolant = this._timeScaleInterpolant;
        if (interpolant !== null) {
          const interpolantValue = interpolant.evaluate(time)[0];
          timeScale *= interpolantValue;
          if (time > interpolant.parameterPositions[1]) {
            this.stopWarping();
            if (timeScale === 0) {
              this.paused = true;
            } else {
              this.timeScale = timeScale;
            }
          }
        }
      }
      this._effectiveTimeScale = timeScale;
      return timeScale;
    }
    _updateTime(deltaTime) {
      const duration = this._clip.duration;
      const loop = this.loop;
      let time = this.time + deltaTime;
      let loopCount = this._loopCount;
      const pingPong = loop === LoopPingPong;
      if (deltaTime === 0) {
        if (loopCount === -1) return time;
        return pingPong && (loopCount & 1) === 1 ? duration - time : time;
      }
      if (loop === LoopOnce) {
        if (loopCount === -1) {
          this._loopCount = 0;
          this._setEndings(true, true, false);
        }
        handle_stop: {
          if (time >= duration) {
            time = duration;
          } else if (time < 0) {
            time = 0;
          } else {
            this.time = time;
            break handle_stop;
          }
          if (this.clampWhenFinished) this.paused = true;
          else this.enabled = false;
          this.time = time;
          this._mixer.dispatchEvent({
            type: "finished",
            action: this,
            direction: deltaTime < 0 ? -1 : 1
          });
        }
      } else {
        if (loopCount === -1) {
          if (deltaTime >= 0) {
            loopCount = 0;
            this._setEndings(true, this.repetitions === 0, pingPong);
          } else {
            this._setEndings(this.repetitions === 0, true, pingPong);
          }
        }
        if (time >= duration || time < 0) {
          const loopDelta = Math.floor(time / duration);
          time -= duration * loopDelta;
          loopCount += Math.abs(loopDelta);
          const pending = this.repetitions - loopCount;
          if (pending <= 0) {
            if (this.clampWhenFinished) this.paused = true;
            else this.enabled = false;
            time = deltaTime > 0 ? duration : 0;
            this.time = time;
            this._mixer.dispatchEvent({
              type: "finished",
              action: this,
              direction: deltaTime > 0 ? 1 : -1
            });
          } else {
            if (pending === 1) {
              const atStart = deltaTime < 0;
              this._setEndings(atStart, !atStart, pingPong);
            } else {
              this._setEndings(false, false, pingPong);
            }
            this._loopCount = loopCount;
            this.time = time;
            this._mixer.dispatchEvent({
              type: "loop",
              action: this,
              loopDelta
            });
          }
        } else {
          this.time = time;
        }
        if (pingPong && (loopCount & 1) === 1) {
          return duration - time;
        }
      }
      return time;
    }
    _setEndings(atStart, atEnd, pingPong) {
      const settings = this._interpolantSettings;
      if (pingPong) {
        settings.endingStart = ZeroSlopeEnding;
        settings.endingEnd = ZeroSlopeEnding;
      } else {
        if (atStart) {
          settings.endingStart = this.zeroSlopeAtStart ? ZeroSlopeEnding : ZeroCurvatureEnding;
        } else {
          settings.endingStart = WrapAroundEnding;
        }
        if (atEnd) {
          settings.endingEnd = this.zeroSlopeAtEnd ? ZeroSlopeEnding : ZeroCurvatureEnding;
        } else {
          settings.endingEnd = WrapAroundEnding;
        }
      }
    }
    _scheduleFading(duration, weightNow, weightThen) {
      const mixer = this._mixer, now2 = mixer.time;
      let interpolant = this._weightInterpolant;
      if (interpolant === null) {
        interpolant = mixer._lendControlInterpolant();
        this._weightInterpolant = interpolant;
      }
      const times = interpolant.parameterPositions, values = interpolant.sampleValues;
      times[0] = now2;
      values[0] = weightNow;
      times[1] = now2 + duration;
      values[1] = weightThen;
      return this;
    }
  };
  var _controlInterpolantsResultBuffer = new Float32Array(1);
  var AnimationMixer = class extends EventDispatcher {
    constructor(root) {
      super();
      this._root = root;
      this._initMemoryManager();
      this._accuIndex = 0;
      this.time = 0;
      this.timeScale = 1;
    }
    _bindAction(action, prototypeAction) {
      const root = action._localRoot || this._root, tracks = action._clip.tracks, nTracks = tracks.length, bindings = action._propertyBindings, interpolants = action._interpolants, rootUuid = root.uuid, bindingsByRoot = this._bindingsByRootAndName;
      let bindingsByName = bindingsByRoot[rootUuid];
      if (bindingsByName === void 0) {
        bindingsByName = {};
        bindingsByRoot[rootUuid] = bindingsByName;
      }
      for (let i = 0; i !== nTracks; ++i) {
        const track = tracks[i], trackName = track.name;
        let binding = bindingsByName[trackName];
        if (binding !== void 0) {
          ++binding.referenceCount;
          bindings[i] = binding;
        } else {
          binding = bindings[i];
          if (binding !== void 0) {
            if (binding._cacheIndex === null) {
              ++binding.referenceCount;
              this._addInactiveBinding(binding, rootUuid, trackName);
            }
            continue;
          }
          const path = prototypeAction && prototypeAction._propertyBindings[i].binding.parsedPath;
          binding = new PropertyMixer(
            PropertyBinding.create(root, trackName, path),
            track.ValueTypeName,
            track.getValueSize()
          );
          ++binding.referenceCount;
          this._addInactiveBinding(binding, rootUuid, trackName);
          bindings[i] = binding;
        }
        interpolants[i].resultBuffer = binding.buffer;
      }
    }
    _activateAction(action) {
      if (!this._isActiveAction(action)) {
        if (action._cacheIndex === null) {
          const rootUuid = (action._localRoot || this._root).uuid, clipUuid = action._clip.uuid, actionsForClip = this._actionsByClip[clipUuid];
          this._bindAction(
            action,
            actionsForClip && actionsForClip.knownActions[0]
          );
          this._addInactiveAction(action, clipUuid, rootUuid);
        }
        const bindings = action._propertyBindings;
        for (let i = 0, n = bindings.length; i !== n; ++i) {
          const binding = bindings[i];
          if (binding.useCount++ === 0) {
            this._lendBinding(binding);
            binding.saveOriginalState();
          }
        }
        this._lendAction(action);
      }
    }
    _deactivateAction(action) {
      if (this._isActiveAction(action)) {
        const bindings = action._propertyBindings;
        for (let i = 0, n = bindings.length; i !== n; ++i) {
          const binding = bindings[i];
          if (--binding.useCount === 0) {
            binding.restoreOriginalState();
            this._takeBackBinding(binding);
          }
        }
        this._takeBackAction(action);
      }
    }
    // Memory manager
    _initMemoryManager() {
      this._actions = [];
      this._nActiveActions = 0;
      this._actionsByClip = {};
      this._bindings = [];
      this._nActiveBindings = 0;
      this._bindingsByRootAndName = {};
      this._controlInterpolants = [];
      this._nActiveControlInterpolants = 0;
      const scope = this;
      this.stats = {
        actions: {
          get total() {
            return scope._actions.length;
          },
          get inUse() {
            return scope._nActiveActions;
          }
        },
        bindings: {
          get total() {
            return scope._bindings.length;
          },
          get inUse() {
            return scope._nActiveBindings;
          }
        },
        controlInterpolants: {
          get total() {
            return scope._controlInterpolants.length;
          },
          get inUse() {
            return scope._nActiveControlInterpolants;
          }
        }
      };
    }
    // Memory management for AnimationAction objects
    _isActiveAction(action) {
      const index = action._cacheIndex;
      return index !== null && index < this._nActiveActions;
    }
    _addInactiveAction(action, clipUuid, rootUuid) {
      const actions = this._actions, actionsByClip = this._actionsByClip;
      let actionsForClip = actionsByClip[clipUuid];
      if (actionsForClip === void 0) {
        actionsForClip = {
          knownActions: [action],
          actionByRoot: {}
        };
        action._byClipCacheIndex = 0;
        actionsByClip[clipUuid] = actionsForClip;
      } else {
        const knownActions = actionsForClip.knownActions;
        action._byClipCacheIndex = knownActions.length;
        knownActions.push(action);
      }
      action._cacheIndex = actions.length;
      actions.push(action);
      actionsForClip.actionByRoot[rootUuid] = action;
    }
    _removeInactiveAction(action) {
      const actions = this._actions, lastInactiveAction = actions[actions.length - 1], cacheIndex = action._cacheIndex;
      lastInactiveAction._cacheIndex = cacheIndex;
      actions[cacheIndex] = lastInactiveAction;
      actions.pop();
      action._cacheIndex = null;
      const clipUuid = action._clip.uuid, actionsByClip = this._actionsByClip, actionsForClip = actionsByClip[clipUuid], knownActionsForClip = actionsForClip.knownActions, lastKnownAction = knownActionsForClip[knownActionsForClip.length - 1], byClipCacheIndex = action._byClipCacheIndex;
      lastKnownAction._byClipCacheIndex = byClipCacheIndex;
      knownActionsForClip[byClipCacheIndex] = lastKnownAction;
      knownActionsForClip.pop();
      action._byClipCacheIndex = null;
      const actionByRoot = actionsForClip.actionByRoot, rootUuid = (action._localRoot || this._root).uuid;
      delete actionByRoot[rootUuid];
      if (knownActionsForClip.length === 0) {
        delete actionsByClip[clipUuid];
      }
      this._removeInactiveBindingsForAction(action);
    }
    _removeInactiveBindingsForAction(action) {
      const bindings = action._propertyBindings;
      for (let i = 0, n = bindings.length; i !== n; ++i) {
        const binding = bindings[i];
        if (--binding.referenceCount === 0) {
          this._removeInactiveBinding(binding);
        }
      }
    }
    _lendAction(action) {
      const actions = this._actions, prevIndex = action._cacheIndex, lastActiveIndex = this._nActiveActions++, firstInactiveAction = actions[lastActiveIndex];
      action._cacheIndex = lastActiveIndex;
      actions[lastActiveIndex] = action;
      firstInactiveAction._cacheIndex = prevIndex;
      actions[prevIndex] = firstInactiveAction;
    }
    _takeBackAction(action) {
      const actions = this._actions, prevIndex = action._cacheIndex, firstInactiveIndex = --this._nActiveActions, lastActiveAction = actions[firstInactiveIndex];
      action._cacheIndex = firstInactiveIndex;
      actions[firstInactiveIndex] = action;
      lastActiveAction._cacheIndex = prevIndex;
      actions[prevIndex] = lastActiveAction;
    }
    // Memory management for PropertyMixer objects
    _addInactiveBinding(binding, rootUuid, trackName) {
      const bindingsByRoot = this._bindingsByRootAndName, bindings = this._bindings;
      let bindingByName = bindingsByRoot[rootUuid];
      if (bindingByName === void 0) {
        bindingByName = {};
        bindingsByRoot[rootUuid] = bindingByName;
      }
      bindingByName[trackName] = binding;
      binding._cacheIndex = bindings.length;
      bindings.push(binding);
    }
    _removeInactiveBinding(binding) {
      const bindings = this._bindings, propBinding = binding.binding, rootUuid = propBinding.rootNode.uuid, trackName = propBinding.path, bindingsByRoot = this._bindingsByRootAndName, bindingByName = bindingsByRoot[rootUuid], lastInactiveBinding = bindings[bindings.length - 1], cacheIndex = binding._cacheIndex;
      lastInactiveBinding._cacheIndex = cacheIndex;
      bindings[cacheIndex] = lastInactiveBinding;
      bindings.pop();
      delete bindingByName[trackName];
      if (Object.keys(bindingByName).length === 0) {
        delete bindingsByRoot[rootUuid];
      }
    }
    _lendBinding(binding) {
      const bindings = this._bindings, prevIndex = binding._cacheIndex, lastActiveIndex = this._nActiveBindings++, firstInactiveBinding = bindings[lastActiveIndex];
      binding._cacheIndex = lastActiveIndex;
      bindings[lastActiveIndex] = binding;
      firstInactiveBinding._cacheIndex = prevIndex;
      bindings[prevIndex] = firstInactiveBinding;
    }
    _takeBackBinding(binding) {
      const bindings = this._bindings, prevIndex = binding._cacheIndex, firstInactiveIndex = --this._nActiveBindings, lastActiveBinding = bindings[firstInactiveIndex];
      binding._cacheIndex = firstInactiveIndex;
      bindings[firstInactiveIndex] = binding;
      lastActiveBinding._cacheIndex = prevIndex;
      bindings[prevIndex] = lastActiveBinding;
    }
    // Memory management of Interpolants for weight and time scale
    _lendControlInterpolant() {
      const interpolants = this._controlInterpolants, lastActiveIndex = this._nActiveControlInterpolants++;
      let interpolant = interpolants[lastActiveIndex];
      if (interpolant === void 0) {
        interpolant = new LinearInterpolant(
          new Float32Array(2),
          new Float32Array(2),
          1,
          _controlInterpolantsResultBuffer
        );
        interpolant.__cacheIndex = lastActiveIndex;
        interpolants[lastActiveIndex] = interpolant;
      }
      return interpolant;
    }
    _takeBackControlInterpolant(interpolant) {
      const interpolants = this._controlInterpolants, prevIndex = interpolant.__cacheIndex, firstInactiveIndex = --this._nActiveControlInterpolants, lastActiveInterpolant = interpolants[firstInactiveIndex];
      interpolant.__cacheIndex = firstInactiveIndex;
      interpolants[firstInactiveIndex] = interpolant;
      lastActiveInterpolant.__cacheIndex = prevIndex;
      interpolants[prevIndex] = lastActiveInterpolant;
    }
    // return an action for a clip optionally using a custom root target
    // object (this method allocates a lot of dynamic memory in case a
    // previously unknown clip/root combination is specified)
    clipAction(clip, optionalRoot, blendMode) {
      const root = optionalRoot || this._root, rootUuid = root.uuid;
      let clipObject = typeof clip === "string" ? AnimationClip.findByName(root, clip) : clip;
      const clipUuid = clipObject !== null ? clipObject.uuid : clip;
      const actionsForClip = this._actionsByClip[clipUuid];
      let prototypeAction = null;
      if (blendMode === void 0) {
        if (clipObject !== null) {
          blendMode = clipObject.blendMode;
        } else {
          blendMode = NormalAnimationBlendMode;
        }
      }
      if (actionsForClip !== void 0) {
        const existingAction = actionsForClip.actionByRoot[rootUuid];
        if (existingAction !== void 0 && existingAction.blendMode === blendMode) {
          return existingAction;
        }
        prototypeAction = actionsForClip.knownActions[0];
        if (clipObject === null)
          clipObject = prototypeAction._clip;
      }
      if (clipObject === null) return null;
      const newAction = new AnimationAction(this, clipObject, optionalRoot, blendMode);
      this._bindAction(newAction, prototypeAction);
      this._addInactiveAction(newAction, clipUuid, rootUuid);
      return newAction;
    }
    // get an existing action
    existingAction(clip, optionalRoot) {
      const root = optionalRoot || this._root, rootUuid = root.uuid, clipObject = typeof clip === "string" ? AnimationClip.findByName(root, clip) : clip, clipUuid = clipObject ? clipObject.uuid : clip, actionsForClip = this._actionsByClip[clipUuid];
      if (actionsForClip !== void 0) {
        return actionsForClip.actionByRoot[rootUuid] || null;
      }
      return null;
    }
    // deactivates all previously scheduled actions
    stopAllAction() {
      const actions = this._actions, nActions = this._nActiveActions;
      for (let i = nActions - 1; i >= 0; --i) {
        actions[i].stop();
      }
      return this;
    }
    // advance the time and update apply the animation
    update(deltaTime) {
      deltaTime *= this.timeScale;
      const actions = this._actions, nActions = this._nActiveActions, time = this.time += deltaTime, timeDirection = Math.sign(deltaTime), accuIndex = this._accuIndex ^= 1;
      for (let i = 0; i !== nActions; ++i) {
        const action = actions[i];
        action._update(time, deltaTime, timeDirection, accuIndex);
      }
      const bindings = this._bindings, nBindings = this._nActiveBindings;
      for (let i = 0; i !== nBindings; ++i) {
        bindings[i].apply(accuIndex);
      }
      return this;
    }
    // Allows you to seek to a specific time in an animation.
    setTime(timeInSeconds) {
      this.time = 0;
      for (let i = 0; i < this._actions.length; i++) {
        this._actions[i].time = 0;
      }
      return this.update(timeInSeconds);
    }
    // return this mixer's root target object
    getRoot() {
      return this._root;
    }
    // free all resources specific to a particular clip
    uncacheClip(clip) {
      const actions = this._actions, clipUuid = clip.uuid, actionsByClip = this._actionsByClip, actionsForClip = actionsByClip[clipUuid];
      if (actionsForClip !== void 0) {
        const actionsToRemove = actionsForClip.knownActions;
        for (let i = 0, n = actionsToRemove.length; i !== n; ++i) {
          const action = actionsToRemove[i];
          this._deactivateAction(action);
          const cacheIndex = action._cacheIndex, lastInactiveAction = actions[actions.length - 1];
          action._cacheIndex = null;
          action._byClipCacheIndex = null;
          lastInactiveAction._cacheIndex = cacheIndex;
          actions[cacheIndex] = lastInactiveAction;
          actions.pop();
          this._removeInactiveBindingsForAction(action);
        }
        delete actionsByClip[clipUuid];
      }
    }
    // free all resources specific to a particular root target object
    uncacheRoot(root) {
      const rootUuid = root.uuid, actionsByClip = this._actionsByClip;
      for (const clipUuid in actionsByClip) {
        const actionByRoot = actionsByClip[clipUuid].actionByRoot, action = actionByRoot[rootUuid];
        if (action !== void 0) {
          this._deactivateAction(action);
          this._removeInactiveAction(action);
        }
      }
      const bindingsByRoot = this._bindingsByRootAndName, bindingByName = bindingsByRoot[rootUuid];
      if (bindingByName !== void 0) {
        for (const trackName in bindingByName) {
          const binding = bindingByName[trackName];
          binding.restoreOriginalState();
          this._removeInactiveBinding(binding);
        }
      }
    }
    // remove a targeted clip from the cache
    uncacheAction(clip, optionalRoot) {
      const action = this.existingAction(clip, optionalRoot);
      if (action !== null) {
        this._deactivateAction(action);
        this._removeInactiveAction(action);
      }
    }
  };
  var Uniform = class _Uniform {
    constructor(value) {
      this.value = value;
    }
    clone() {
      return new _Uniform(this.value.clone === void 0 ? this.value : this.value.clone());
    }
  };
  var _id = 0;
  var UniformsGroup = class extends EventDispatcher {
    constructor() {
      super();
      this.isUniformsGroup = true;
      Object.defineProperty(this, "id", { value: _id++ });
      this.name = "";
      this.usage = StaticDrawUsage;
      this.uniforms = [];
    }
    add(uniform) {
      this.uniforms.push(uniform);
      return this;
    }
    remove(uniform) {
      const index = this.uniforms.indexOf(uniform);
      if (index !== -1) this.uniforms.splice(index, 1);
      return this;
    }
    setName(name) {
      this.name = name;
      return this;
    }
    setUsage(value) {
      this.usage = value;
      return this;
    }
    dispose() {
      this.dispatchEvent({ type: "dispose" });
      return this;
    }
    copy(source) {
      this.name = source.name;
      this.usage = source.usage;
      const uniformsSource = source.uniforms;
      this.uniforms.length = 0;
      for (let i = 0, l = uniformsSource.length; i < l; i++) {
        const uniforms = Array.isArray(uniformsSource[i]) ? uniformsSource[i] : [uniformsSource[i]];
        for (let j = 0; j < uniforms.length; j++) {
          this.uniforms.push(uniforms[j].clone());
        }
      }
      return this;
    }
    clone() {
      return new this.constructor().copy(this);
    }
  };
  var InstancedInterleavedBuffer = class extends InterleavedBuffer {
    constructor(array, stride, meshPerAttribute = 1) {
      super(array, stride);
      this.isInstancedInterleavedBuffer = true;
      this.meshPerAttribute = meshPerAttribute;
    }
    copy(source) {
      super.copy(source);
      this.meshPerAttribute = source.meshPerAttribute;
      return this;
    }
    clone(data) {
      const ib = super.clone(data);
      ib.meshPerAttribute = this.meshPerAttribute;
      return ib;
    }
    toJSON(data) {
      const json = super.toJSON(data);
      json.isInstancedInterleavedBuffer = true;
      json.meshPerAttribute = this.meshPerAttribute;
      return json;
    }
  };
  var GLBufferAttribute = class {
    constructor(buffer, type, itemSize, elementSize, count) {
      this.isGLBufferAttribute = true;
      this.name = "";
      this.buffer = buffer;
      this.type = type;
      this.itemSize = itemSize;
      this.elementSize = elementSize;
      this.count = count;
      this.version = 0;
    }
    set needsUpdate(value) {
      if (value === true) this.version++;
    }
    setBuffer(buffer) {
      this.buffer = buffer;
      return this;
    }
    setType(type, elementSize) {
      this.type = type;
      this.elementSize = elementSize;
      return this;
    }
    setItemSize(itemSize) {
      this.itemSize = itemSize;
      return this;
    }
    setCount(count) {
      this.count = count;
      return this;
    }
  };
  var Raycaster = class {
    constructor(origin, direction, near = 0, far = Infinity) {
      this.ray = new Ray(origin, direction);
      this.near = near;
      this.far = far;
      this.camera = null;
      this.layers = new Layers();
      this.params = {
        Mesh: {},
        Line: { threshold: 1 },
        LOD: {},
        Points: { threshold: 1 },
        Sprite: {}
      };
    }
    set(origin, direction) {
      this.ray.set(origin, direction);
    }
    setFromCamera(coords, camera) {
      if (camera.isPerspectiveCamera) {
        this.ray.origin.setFromMatrixPosition(camera.matrixWorld);
        this.ray.direction.set(coords.x, coords.y, 0.5).unproject(camera).sub(this.ray.origin).normalize();
        this.camera = camera;
      } else if (camera.isOrthographicCamera) {
        this.ray.origin.set(coords.x, coords.y, (camera.near + camera.far) / (camera.near - camera.far)).unproject(camera);
        this.ray.direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
        this.camera = camera;
      } else {
        console.error("THREE.Raycaster: Unsupported camera type: " + camera.type);
      }
    }
    intersectObject(object, recursive = true, intersects2 = []) {
      intersectObject(object, this, intersects2, recursive);
      intersects2.sort(ascSort);
      return intersects2;
    }
    intersectObjects(objects, recursive = true, intersects2 = []) {
      for (let i = 0, l = objects.length; i < l; i++) {
        intersectObject(objects[i], this, intersects2, recursive);
      }
      intersects2.sort(ascSort);
      return intersects2;
    }
  };
  function ascSort(a, b) {
    return a.distance - b.distance;
  }
  function intersectObject(object, raycaster, intersects2, recursive) {
    if (object.layers.test(raycaster.layers)) {
      object.raycast(raycaster, intersects2);
    }
    if (recursive === true) {
      const children = object.children;
      for (let i = 0, l = children.length; i < l; i++) {
        intersectObject(children[i], raycaster, intersects2, true);
      }
    }
  }
  var Spherical = class {
    constructor(radius = 1, phi = 0, theta = 0) {
      this.radius = radius;
      this.phi = phi;
      this.theta = theta;
      return this;
    }
    set(radius, phi, theta) {
      this.radius = radius;
      this.phi = phi;
      this.theta = theta;
      return this;
    }
    copy(other) {
      this.radius = other.radius;
      this.phi = other.phi;
      this.theta = other.theta;
      return this;
    }
    // restrict phi to be between EPS and PI-EPS
    makeSafe() {
      const EPS = 1e-6;
      this.phi = Math.max(EPS, Math.min(Math.PI - EPS, this.phi));
      return this;
    }
    setFromVector3(v) {
      return this.setFromCartesianCoords(v.x, v.y, v.z);
    }
    setFromCartesianCoords(x, y, z) {
      this.radius = Math.sqrt(x * x + y * y + z * z);
      if (this.radius === 0) {
        this.theta = 0;
        this.phi = 0;
      } else {
        this.theta = Math.atan2(x, z);
        this.phi = Math.acos(clamp(y / this.radius, -1, 1));
      }
      return this;
    }
    clone() {
      return new this.constructor().copy(this);
    }
  };
  var Cylindrical = class {
    constructor(radius = 1, theta = 0, y = 0) {
      this.radius = radius;
      this.theta = theta;
      this.y = y;
      return this;
    }
    set(radius, theta, y) {
      this.radius = radius;
      this.theta = theta;
      this.y = y;
      return this;
    }
    copy(other) {
      this.radius = other.radius;
      this.theta = other.theta;
      this.y = other.y;
      return this;
    }
    setFromVector3(v) {
      return this.setFromCartesianCoords(v.x, v.y, v.z);
    }
    setFromCartesianCoords(x, y, z) {
      this.radius = Math.sqrt(x * x + z * z);
      this.theta = Math.atan2(x, z);
      this.y = y;
      return this;
    }
    clone() {
      return new this.constructor().copy(this);
    }
  };
  var _vector$4 = /* @__PURE__ */ new Vector2();
  var Box2 = class {
    constructor(min = new Vector2(Infinity, Infinity), max = new Vector2(-Infinity, -Infinity)) {
      this.isBox2 = true;
      this.min = min;
      this.max = max;
    }
    set(min, max) {
      this.min.copy(min);
      this.max.copy(max);
      return this;
    }
    setFromPoints(points) {
      this.makeEmpty();
      for (let i = 0, il = points.length; i < il; i++) {
        this.expandByPoint(points[i]);
      }
      return this;
    }
    setFromCenterAndSize(center, size) {
      const halfSize = _vector$4.copy(size).multiplyScalar(0.5);
      this.min.copy(center).sub(halfSize);
      this.max.copy(center).add(halfSize);
      return this;
    }
    clone() {
      return new this.constructor().copy(this);
    }
    copy(box) {
      this.min.copy(box.min);
      this.max.copy(box.max);
      return this;
    }
    makeEmpty() {
      this.min.x = this.min.y = Infinity;
      this.max.x = this.max.y = -Infinity;
      return this;
    }
    isEmpty() {
      return this.max.x < this.min.x || this.max.y < this.min.y;
    }
    getCenter(target) {
      return this.isEmpty() ? target.set(0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5);
    }
    getSize(target) {
      return this.isEmpty() ? target.set(0, 0) : target.subVectors(this.max, this.min);
    }
    expandByPoint(point) {
      this.min.min(point);
      this.max.max(point);
      return this;
    }
    expandByVector(vector) {
      this.min.sub(vector);
      this.max.add(vector);
      return this;
    }
    expandByScalar(scalar) {
      this.min.addScalar(-scalar);
      this.max.addScalar(scalar);
