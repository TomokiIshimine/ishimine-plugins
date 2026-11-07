      return this;
    }
    containsPoint(point) {
      return point.x < this.min.x || point.x > this.max.x || point.y < this.min.y || point.y > this.max.y ? false : true;
    }
    containsBox(box) {
      return this.min.x <= box.min.x && box.max.x <= this.max.x && this.min.y <= box.min.y && box.max.y <= this.max.y;
    }
    getParameter(point, target) {
      return target.set(
        (point.x - this.min.x) / (this.max.x - this.min.x),
        (point.y - this.min.y) / (this.max.y - this.min.y)
      );
    }
    intersectsBox(box) {
      return box.max.x < this.min.x || box.min.x > this.max.x || box.max.y < this.min.y || box.min.y > this.max.y ? false : true;
    }
    clampPoint(point, target) {
      return target.copy(point).clamp(this.min, this.max);
    }
    distanceToPoint(point) {
      return this.clampPoint(point, _vector$4).distanceTo(point);
    }
    intersect(box) {
      this.min.max(box.min);
      this.max.min(box.max);
      if (this.isEmpty()) this.makeEmpty();
      return this;
    }
    union(box) {
      this.min.min(box.min);
      this.max.max(box.max);
      return this;
    }
    translate(offset) {
      this.min.add(offset);
      this.max.add(offset);
      return this;
    }
    equals(box) {
      return box.min.equals(this.min) && box.max.equals(this.max);
    }
  };
  var _startP = /* @__PURE__ */ new Vector3();
  var _startEnd = /* @__PURE__ */ new Vector3();
  var Line3 = class {
    constructor(start = new Vector3(), end = new Vector3()) {
      this.start = start;
      this.end = end;
    }
    set(start, end) {
      this.start.copy(start);
      this.end.copy(end);
      return this;
    }
    copy(line) {
      this.start.copy(line.start);
      this.end.copy(line.end);
      return this;
    }
    getCenter(target) {
      return target.addVectors(this.start, this.end).multiplyScalar(0.5);
    }
    delta(target) {
      return target.subVectors(this.end, this.start);
    }
    distanceSq() {
      return this.start.distanceToSquared(this.end);
    }
    distance() {
      return this.start.distanceTo(this.end);
    }
    at(t, target) {
      return this.delta(target).multiplyScalar(t).add(this.start);
    }
    closestPointToPointParameter(point, clampToLine) {
      _startP.subVectors(point, this.start);
      _startEnd.subVectors(this.end, this.start);
      const startEnd2 = _startEnd.dot(_startEnd);
      const startEnd_startP = _startEnd.dot(_startP);
      let t = startEnd_startP / startEnd2;
      if (clampToLine) {
        t = clamp(t, 0, 1);
      }
      return t;
    }
    closestPointToPoint(point, clampToLine, target) {
      const t = this.closestPointToPointParameter(point, clampToLine);
      return this.delta(target).multiplyScalar(t).add(this.start);
    }
    applyMatrix4(matrix) {
      this.start.applyMatrix4(matrix);
      this.end.applyMatrix4(matrix);
      return this;
    }
    equals(line) {
      return line.start.equals(this.start) && line.end.equals(this.end);
    }
    clone() {
      return new this.constructor().copy(this);
    }
  };
  var _vector$3 = /* @__PURE__ */ new Vector3();
  var SpotLightHelper = class extends Object3D {
    constructor(light, color) {
      super();
      this.light = light;
      this.matrix = light.matrixWorld;
      this.matrixAutoUpdate = false;
      this.color = color;
      this.type = "SpotLightHelper";
      const geometry = new BufferGeometry();
      const positions = [
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        -1,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        1,
        0,
        0,
        0,
        0,
        -1,
        1
      ];
      for (let i = 0, j = 1, l = 32; i < l; i++, j++) {
        const p1 = i / l * Math.PI * 2;
        const p2 = j / l * Math.PI * 2;
        positions.push(
          Math.cos(p1),
          Math.sin(p1),
          1,
          Math.cos(p2),
          Math.sin(p2),
          1
        );
      }
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      const material = new LineBasicMaterial({ fog: false, toneMapped: false });
      this.cone = new LineSegments(geometry, material);
      this.add(this.cone);
      this.update();
    }
    dispose() {
      this.cone.geometry.dispose();
      this.cone.material.dispose();
    }
    update() {
      this.light.updateWorldMatrix(true, false);
      this.light.target.updateWorldMatrix(true, false);
      const coneLength = this.light.distance ? this.light.distance : 1e3;
      const coneWidth = coneLength * Math.tan(this.light.angle);
      this.cone.scale.set(coneWidth, coneWidth, coneLength);
      _vector$3.setFromMatrixPosition(this.light.target.matrixWorld);
      this.cone.lookAt(_vector$3);
      if (this.color !== void 0) {
        this.cone.material.color.set(this.color);
      } else {
        this.cone.material.color.copy(this.light.color);
      }
    }
  };
  var _vector$2 = /* @__PURE__ */ new Vector3();
  var _boneMatrix = /* @__PURE__ */ new Matrix4();
  var _matrixWorldInv = /* @__PURE__ */ new Matrix4();
  var SkeletonHelper = class extends LineSegments {
    constructor(object) {
      const bones = getBoneList(object);
      const geometry = new BufferGeometry();
      const vertices = [];
      const colors = [];
      const color1 = new Color(0, 0, 1);
      const color2 = new Color(0, 1, 0);
      for (let i = 0; i < bones.length; i++) {
        const bone = bones[i];
        if (bone.parent && bone.parent.isBone) {
          vertices.push(0, 0, 0);
          vertices.push(0, 0, 0);
          colors.push(color1.r, color1.g, color1.b);
          colors.push(color2.r, color2.g, color2.b);
        }
      }
      geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      const material = new LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, toneMapped: false, transparent: true });
      super(geometry, material);
      this.isSkeletonHelper = true;
      this.type = "SkeletonHelper";
      this.root = object;
      this.bones = bones;
      this.matrix = object.matrixWorld;
      this.matrixAutoUpdate = false;
    }
    updateMatrixWorld(force) {
      const bones = this.bones;
      const geometry = this.geometry;
      const position = geometry.getAttribute("position");
      _matrixWorldInv.copy(this.root.matrixWorld).invert();
      for (let i = 0, j = 0; i < bones.length; i++) {
        const bone = bones[i];
        if (bone.parent && bone.parent.isBone) {
          _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.matrixWorld);
          _vector$2.setFromMatrixPosition(_boneMatrix);
          position.setXYZ(j, _vector$2.x, _vector$2.y, _vector$2.z);
          _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.parent.matrixWorld);
          _vector$2.setFromMatrixPosition(_boneMatrix);
          position.setXYZ(j + 1, _vector$2.x, _vector$2.y, _vector$2.z);
          j += 2;
        }
      }
      geometry.getAttribute("position").needsUpdate = true;
      super.updateMatrixWorld(force);
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  function getBoneList(object) {
    const boneList = [];
    if (object.isBone === true) {
      boneList.push(object);
    }
    for (let i = 0; i < object.children.length; i++) {
      boneList.push.apply(boneList, getBoneList(object.children[i]));
    }
    return boneList;
  }
  var PointLightHelper = class extends Mesh {
    constructor(light, sphereSize, color) {
      const geometry = new SphereGeometry(sphereSize, 4, 2);
      const material = new MeshBasicMaterial({ wireframe: true, fog: false, toneMapped: false });
      super(geometry, material);
      this.light = light;
      this.color = color;
      this.type = "PointLightHelper";
      this.matrix = this.light.matrixWorld;
      this.matrixAutoUpdate = false;
      this.update();
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
    update() {
      this.light.updateWorldMatrix(true, false);
      if (this.color !== void 0) {
        this.material.color.set(this.color);
      } else {
        this.material.color.copy(this.light.color);
      }
    }
  };
  var _vector$1 = /* @__PURE__ */ new Vector3();
  var _color1 = /* @__PURE__ */ new Color();
  var _color2 = /* @__PURE__ */ new Color();
  var HemisphereLightHelper = class extends Object3D {
    constructor(light, size, color) {
      super();
      this.light = light;
      this.matrix = light.matrixWorld;
      this.matrixAutoUpdate = false;
      this.color = color;
      this.type = "HemisphereLightHelper";
      const geometry = new OctahedronGeometry(size);
      geometry.rotateY(Math.PI * 0.5);
      this.material = new MeshBasicMaterial({ wireframe: true, fog: false, toneMapped: false });
      if (this.color === void 0) this.material.vertexColors = true;
      const position = geometry.getAttribute("position");
      const colors = new Float32Array(position.count * 3);
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      this.add(new Mesh(geometry, this.material));
      this.update();
    }
    dispose() {
      this.children[0].geometry.dispose();
      this.children[0].material.dispose();
    }
    update() {
      const mesh = this.children[0];
      if (this.color !== void 0) {
        this.material.color.set(this.color);
      } else {
        const colors = mesh.geometry.getAttribute("color");
        _color1.copy(this.light.color);
        _color2.copy(this.light.groundColor);
        for (let i = 0, l = colors.count; i < l; i++) {
          const color = i < l / 2 ? _color1 : _color2;
          colors.setXYZ(i, color.r, color.g, color.b);
        }
        colors.needsUpdate = true;
      }
      this.light.updateWorldMatrix(true, false);
      mesh.lookAt(_vector$1.setFromMatrixPosition(this.light.matrixWorld).negate());
    }
  };
  var GridHelper = class extends LineSegments {
    constructor(size = 10, divisions = 10, color1 = 4473924, color2 = 8947848) {
      color1 = new Color(color1);
      color2 = new Color(color2);
      const center = divisions / 2;
      const step = size / divisions;
      const halfSize = size / 2;
      const vertices = [], colors = [];
      for (let i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
        vertices.push(-halfSize, 0, k, halfSize, 0, k);
        vertices.push(k, 0, -halfSize, k, 0, halfSize);
        const color = i === center ? color1 : color2;
        color.toArray(colors, j);
        j += 3;
        color.toArray(colors, j);
        j += 3;
        color.toArray(colors, j);
        j += 3;
        color.toArray(colors, j);
        j += 3;
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
      super(geometry, material);
      this.type = "GridHelper";
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  var PolarGridHelper = class extends LineSegments {
    constructor(radius = 10, sectors = 16, rings = 8, divisions = 64, color1 = 4473924, color2 = 8947848) {
      color1 = new Color(color1);
      color2 = new Color(color2);
      const vertices = [];
      const colors = [];
      if (sectors > 1) {
        for (let i = 0; i < sectors; i++) {
          const v = i / sectors * (Math.PI * 2);
          const x = Math.sin(v) * radius;
          const z = Math.cos(v) * radius;
          vertices.push(0, 0, 0);
          vertices.push(x, 0, z);
          const color = i & 1 ? color1 : color2;
          colors.push(color.r, color.g, color.b);
          colors.push(color.r, color.g, color.b);
        }
      }
      for (let i = 0; i < rings; i++) {
        const color = i & 1 ? color1 : color2;
        const r = radius - radius / rings * i;
        for (let j = 0; j < divisions; j++) {
          let v = j / divisions * (Math.PI * 2);
          let x = Math.sin(v) * r;
          let z = Math.cos(v) * r;
          vertices.push(x, 0, z);
          colors.push(color.r, color.g, color.b);
          v = (j + 1) / divisions * (Math.PI * 2);
          x = Math.sin(v) * r;
          z = Math.cos(v) * r;
          vertices.push(x, 0, z);
          colors.push(color.r, color.g, color.b);
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
      super(geometry, material);
      this.type = "PolarGridHelper";
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  var _v1 = /* @__PURE__ */ new Vector3();
  var _v2 = /* @__PURE__ */ new Vector3();
  var _v3 = /* @__PURE__ */ new Vector3();
  var DirectionalLightHelper = class extends Object3D {
    constructor(light, size, color) {
      super();
      this.light = light;
      this.matrix = light.matrixWorld;
      this.matrixAutoUpdate = false;
      this.color = color;
      this.type = "DirectionalLightHelper";
      if (size === void 0) size = 1;
      let geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute([
        -size,
        size,
        0,
        size,
        size,
        0,
        size,
        -size,
        0,
        -size,
        -size,
        0,
        -size,
        size,
        0
      ], 3));
      const material = new LineBasicMaterial({ fog: false, toneMapped: false });
      this.lightPlane = new Line(geometry, material);
      this.add(this.lightPlane);
      geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3));
      this.targetLine = new Line(geometry, material);
      this.add(this.targetLine);
      this.update();
    }
    dispose() {
      this.lightPlane.geometry.dispose();
      this.lightPlane.material.dispose();
      this.targetLine.geometry.dispose();
      this.targetLine.material.dispose();
    }
    update() {
      this.light.updateWorldMatrix(true, false);
      this.light.target.updateWorldMatrix(true, false);
      _v1.setFromMatrixPosition(this.light.matrixWorld);
      _v2.setFromMatrixPosition(this.light.target.matrixWorld);
      _v3.subVectors(_v2, _v1);
      this.lightPlane.lookAt(_v2);
      if (this.color !== void 0) {
        this.lightPlane.material.color.set(this.color);
        this.targetLine.material.color.set(this.color);
      } else {
        this.lightPlane.material.color.copy(this.light.color);
        this.targetLine.material.color.copy(this.light.color);
      }
      this.targetLine.lookAt(_v2);
      this.targetLine.scale.z = _v3.length();
    }
  };
  var _vector = /* @__PURE__ */ new Vector3();
  var _camera = /* @__PURE__ */ new Camera();
  var CameraHelper = class extends LineSegments {
    constructor(camera) {
      const geometry = new BufferGeometry();
      const material = new LineBasicMaterial({ color: 16777215, vertexColors: true, toneMapped: false });
      const vertices = [];
      const colors = [];
      const pointMap = {};
      addLine("n1", "n2");
      addLine("n2", "n4");
      addLine("n4", "n3");
      addLine("n3", "n1");
      addLine("f1", "f2");
      addLine("f2", "f4");
      addLine("f4", "f3");
      addLine("f3", "f1");
      addLine("n1", "f1");
      addLine("n2", "f2");
      addLine("n3", "f3");
      addLine("n4", "f4");
      addLine("p", "n1");
      addLine("p", "n2");
      addLine("p", "n3");
      addLine("p", "n4");
      addLine("u1", "u2");
      addLine("u2", "u3");
      addLine("u3", "u1");
      addLine("c", "t");
      addLine("p", "c");
      addLine("cn1", "cn2");
      addLine("cn3", "cn4");
      addLine("cf1", "cf2");
      addLine("cf3", "cf4");
      function addLine(a, b) {
        addPoint(a);
        addPoint(b);
      }
      function addPoint(id) {
        vertices.push(0, 0, 0);
        colors.push(0, 0, 0);
        if (pointMap[id] === void 0) {
          pointMap[id] = [];
        }
        pointMap[id].push(vertices.length / 3 - 1);
      }
      geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      super(geometry, material);
      this.type = "CameraHelper";
      this.camera = camera;
      if (this.camera.updateProjectionMatrix) this.camera.updateProjectionMatrix();
      this.matrix = camera.matrixWorld;
      this.matrixAutoUpdate = false;
      this.pointMap = pointMap;
      this.update();
      const colorFrustum = new Color(16755200);
      const colorCone = new Color(16711680);
      const colorUp = new Color(43775);
      const colorTarget = new Color(16777215);
      const colorCross = new Color(3355443);
      this.setColors(colorFrustum, colorCone, colorUp, colorTarget, colorCross);
    }
    setColors(frustum, cone, up, target, cross) {
      const geometry = this.geometry;
      const colorAttribute = geometry.getAttribute("color");
      colorAttribute.setXYZ(0, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(1, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(2, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(3, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(4, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(5, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(6, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(7, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(8, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(9, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(10, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(11, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(12, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(13, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(14, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(15, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(16, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(17, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(18, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(19, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(20, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(21, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(22, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(23, frustum.r, frustum.g, frustum.b);
      colorAttribute.setXYZ(24, cone.r, cone.g, cone.b);
      colorAttribute.setXYZ(25, cone.r, cone.g, cone.b);
      colorAttribute.setXYZ(26, cone.r, cone.g, cone.b);
      colorAttribute.setXYZ(27, cone.r, cone.g, cone.b);
      colorAttribute.setXYZ(28, cone.r, cone.g, cone.b);
      colorAttribute.setXYZ(29, cone.r, cone.g, cone.b);
      colorAttribute.setXYZ(30, cone.r, cone.g, cone.b);
      colorAttribute.setXYZ(31, cone.r, cone.g, cone.b);
      colorAttribute.setXYZ(32, up.r, up.g, up.b);
      colorAttribute.setXYZ(33, up.r, up.g, up.b);
      colorAttribute.setXYZ(34, up.r, up.g, up.b);
      colorAttribute.setXYZ(35, up.r, up.g, up.b);
      colorAttribute.setXYZ(36, up.r, up.g, up.b);
      colorAttribute.setXYZ(37, up.r, up.g, up.b);
      colorAttribute.setXYZ(38, target.r, target.g, target.b);
      colorAttribute.setXYZ(39, target.r, target.g, target.b);
      colorAttribute.setXYZ(40, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(41, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(42, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(43, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(44, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(45, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(46, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(47, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(48, cross.r, cross.g, cross.b);
      colorAttribute.setXYZ(49, cross.r, cross.g, cross.b);
      colorAttribute.needsUpdate = true;
    }
    update() {
      const geometry = this.geometry;
      const pointMap = this.pointMap;
      const w = 1, h = 1;
      _camera.projectionMatrixInverse.copy(this.camera.projectionMatrixInverse);
      setPoint("c", pointMap, geometry, _camera, 0, 0, -1);
      setPoint("t", pointMap, geometry, _camera, 0, 0, 1);
      setPoint("n1", pointMap, geometry, _camera, -w, -h, -1);
      setPoint("n2", pointMap, geometry, _camera, w, -h, -1);
      setPoint("n3", pointMap, geometry, _camera, -w, h, -1);
      setPoint("n4", pointMap, geometry, _camera, w, h, -1);
      setPoint("f1", pointMap, geometry, _camera, -w, -h, 1);
      setPoint("f2", pointMap, geometry, _camera, w, -h, 1);
      setPoint("f3", pointMap, geometry, _camera, -w, h, 1);
      setPoint("f4", pointMap, geometry, _camera, w, h, 1);
      setPoint("u1", pointMap, geometry, _camera, w * 0.7, h * 1.1, -1);
      setPoint("u2", pointMap, geometry, _camera, -w * 0.7, h * 1.1, -1);
      setPoint("u3", pointMap, geometry, _camera, 0, h * 2, -1);
      setPoint("cf1", pointMap, geometry, _camera, -w, 0, 1);
      setPoint("cf2", pointMap, geometry, _camera, w, 0, 1);
      setPoint("cf3", pointMap, geometry, _camera, 0, -h, 1);
      setPoint("cf4", pointMap, geometry, _camera, 0, h, 1);
      setPoint("cn1", pointMap, geometry, _camera, -w, 0, -1);
      setPoint("cn2", pointMap, geometry, _camera, w, 0, -1);
      setPoint("cn3", pointMap, geometry, _camera, 0, -h, -1);
      setPoint("cn4", pointMap, geometry, _camera, 0, h, -1);
      geometry.getAttribute("position").needsUpdate = true;
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  function setPoint(point, pointMap, geometry, camera, x, y, z) {
    _vector.set(x, y, z).unproject(camera);
    const points = pointMap[point];
    if (points !== void 0) {
      const position = geometry.getAttribute("position");
      for (let i = 0, l = points.length; i < l; i++) {
        position.setXYZ(points[i], _vector.x, _vector.y, _vector.z);
      }
    }
  }
  var _box = /* @__PURE__ */ new Box3();
  var BoxHelper = class extends LineSegments {
    constructor(object, color = 16776960) {
      const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
      const positions = new Float32Array(8 * 3);
      const geometry = new BufferGeometry();
      geometry.setIndex(new BufferAttribute(indices, 1));
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      super(geometry, new LineBasicMaterial({ color, toneMapped: false }));
      this.object = object;
      this.type = "BoxHelper";
      this.matrixAutoUpdate = false;
      this.update();
    }
    update(object) {
      if (object !== void 0) {
        console.warn("THREE.BoxHelper: .update() has no longer arguments.");
      }
      if (this.object !== void 0) {
        _box.setFromObject(this.object);
      }
      if (_box.isEmpty()) return;
      const min = _box.min;
      const max = _box.max;
      const position = this.geometry.attributes.position;
      const array = position.array;
      array[0] = max.x;
      array[1] = max.y;
      array[2] = max.z;
      array[3] = min.x;
      array[4] = max.y;
      array[5] = max.z;
      array[6] = min.x;
      array[7] = min.y;
      array[8] = max.z;
      array[9] = max.x;
      array[10] = min.y;
      array[11] = max.z;
      array[12] = max.x;
      array[13] = max.y;
      array[14] = min.z;
      array[15] = min.x;
      array[16] = max.y;
      array[17] = min.z;
      array[18] = min.x;
      array[19] = min.y;
      array[20] = min.z;
      array[21] = max.x;
      array[22] = min.y;
      array[23] = min.z;
      position.needsUpdate = true;
      this.geometry.computeBoundingSphere();
    }
    setFromObject(object) {
      this.object = object;
      this.update();
      return this;
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.object = source.object;
      return this;
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  var Box3Helper = class extends LineSegments {
    constructor(box, color = 16776960) {
      const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
      const positions = [1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1];
      const geometry = new BufferGeometry();
      geometry.setIndex(new BufferAttribute(indices, 1));
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      super(geometry, new LineBasicMaterial({ color, toneMapped: false }));
      this.box = box;
      this.type = "Box3Helper";
      this.geometry.computeBoundingSphere();
    }
    updateMatrixWorld(force) {
      const box = this.box;
      if (box.isEmpty()) return;
      box.getCenter(this.position);
      box.getSize(this.scale);
      this.scale.multiplyScalar(0.5);
      super.updateMatrixWorld(force);
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  var PlaneHelper = class extends Line {
    constructor(plane, size = 1, hex = 16776960) {
      const color = hex;
      const positions = [1, -1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0, 1, 1, 0];
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
      super(geometry, new LineBasicMaterial({ color, toneMapped: false }));
      this.type = "PlaneHelper";
      this.plane = plane;
      this.size = size;
      const positions2 = [1, 1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, -1, -1, 0, 1, -1, 0];
      const geometry2 = new BufferGeometry();
      geometry2.setAttribute("position", new Float32BufferAttribute(positions2, 3));
      geometry2.computeBoundingSphere();
      this.add(new Mesh(geometry2, new MeshBasicMaterial({ color, opacity: 0.2, transparent: true, depthWrite: false, toneMapped: false })));
    }
    updateMatrixWorld(force) {
      this.position.set(0, 0, 0);
      this.scale.set(0.5 * this.size, 0.5 * this.size, 1);
      this.lookAt(this.plane.normal);
      this.translateZ(-this.plane.constant);
      super.updateMatrixWorld(force);
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
      this.children[0].geometry.dispose();
      this.children[0].material.dispose();
    }
  };
  var _axis = /* @__PURE__ */ new Vector3();
  var _lineGeometry;
  var _coneGeometry;
  var ArrowHelper = class extends Object3D {
    // dir is assumed to be normalized
    constructor(dir = new Vector3(0, 0, 1), origin = new Vector3(0, 0, 0), length = 1, color = 16776960, headLength = length * 0.2, headWidth = headLength * 0.2) {
      super();
      this.type = "ArrowHelper";
      if (_lineGeometry === void 0) {
        _lineGeometry = new BufferGeometry();
        _lineGeometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
        _coneGeometry = new CylinderGeometry(0, 0.5, 1, 5, 1);
        _coneGeometry.translate(0, -0.5, 0);
      }
      this.position.copy(origin);
      this.line = new Line(_lineGeometry, new LineBasicMaterial({ color, toneMapped: false }));
      this.line.matrixAutoUpdate = false;
      this.add(this.line);
      this.cone = new Mesh(_coneGeometry, new MeshBasicMaterial({ color, toneMapped: false }));
      this.cone.matrixAutoUpdate = false;
      this.add(this.cone);
      this.setDirection(dir);
      this.setLength(length, headLength, headWidth);
    }
    setDirection(dir) {
      if (dir.y > 0.99999) {
        this.quaternion.set(0, 0, 0, 1);
      } else if (dir.y < -0.99999) {
        this.quaternion.set(1, 0, 0, 0);
      } else {
        _axis.set(dir.z, 0, -dir.x).normalize();
        const radians = Math.acos(dir.y);
        this.quaternion.setFromAxisAngle(_axis, radians);
      }
    }
    setLength(length, headLength = length * 0.2, headWidth = headLength * 0.2) {
      this.line.scale.set(1, Math.max(1e-4, length - headLength), 1);
      this.line.updateMatrix();
      this.cone.scale.set(headWidth, headLength, headWidth);
      this.cone.position.y = length;
      this.cone.updateMatrix();
    }
    setColor(color) {
      this.line.material.color.set(color);
      this.cone.material.color.set(color);
    }
    copy(source) {
      super.copy(source, false);
      this.line.copy(source.line);
      this.cone.copy(source.cone);
      return this;
    }
    dispose() {
      this.line.geometry.dispose();
      this.line.material.dispose();
      this.cone.geometry.dispose();
      this.cone.material.dispose();
    }
  };
  var AxesHelper = class extends LineSegments {
    constructor(size = 1) {
      const vertices = [
        0,
        0,
        0,
        size,
        0,
        0,
        0,
        0,
        0,
        0,
        size,
        0,
        0,
        0,
        0,
        0,
        0,
        size
      ];
      const colors = [
        1,
        0,
        0,
        1,
        0.6,
        0,
        0,
        1,
        0,
        0.6,
        1,
        0,
        0,
        0,
        1,
        0,
        0.6,
        1
      ];
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
      super(geometry, material);
      this.type = "AxesHelper";
    }
    setColors(xAxisColor, yAxisColor, zAxisColor) {
      const color = new Color();
      const array = this.geometry.attributes.color.array;
      color.set(xAxisColor);
      color.toArray(array, 0);
      color.toArray(array, 3);
      color.set(yAxisColor);
      color.toArray(array, 6);
      color.toArray(array, 9);
      color.set(zAxisColor);
      color.toArray(array, 12);
      color.toArray(array, 15);
      this.geometry.attributes.color.needsUpdate = true;
      return this;
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  var ShapePath = class {
    constructor() {
      this.type = "ShapePath";
      this.color = new Color();
      this.subPaths = [];
      this.currentPath = null;
    }
    moveTo(x, y) {
      this.currentPath = new Path();
      this.subPaths.push(this.currentPath);
      this.currentPath.moveTo(x, y);
      return this;
    }
    lineTo(x, y) {
      this.currentPath.lineTo(x, y);
      return this;
    }
    quadraticCurveTo(aCPx, aCPy, aX, aY) {
      this.currentPath.quadraticCurveTo(aCPx, aCPy, aX, aY);
      return this;
    }
    bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY) {
      this.currentPath.bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY);
      return this;
    }
    splineThru(pts) {
      this.currentPath.splineThru(pts);
      return this;
    }
    toShapes(isCCW) {
      function toShapesNoHoles(inSubpaths) {
        const shapes2 = [];
        for (let i = 0, l = inSubpaths.length; i < l; i++) {
          const tmpPath2 = inSubpaths[i];
          const tmpShape2 = new Shape();
          tmpShape2.curves = tmpPath2.curves;
          shapes2.push(tmpShape2);
        }
        return shapes2;
      }
      function isPointInsidePolygon(inPt, inPolygon) {
        const polyLen = inPolygon.length;
        let inside = false;
        for (let p = polyLen - 1, q = 0; q < polyLen; p = q++) {
          let edgeLowPt = inPolygon[p];
          let edgeHighPt = inPolygon[q];
          let edgeDx = edgeHighPt.x - edgeLowPt.x;
          let edgeDy = edgeHighPt.y - edgeLowPt.y;
          if (Math.abs(edgeDy) > Number.EPSILON) {
            if (edgeDy < 0) {
              edgeLowPt = inPolygon[q];
              edgeDx = -edgeDx;
              edgeHighPt = inPolygon[p];
              edgeDy = -edgeDy;
            }
            if (inPt.y < edgeLowPt.y || inPt.y > edgeHighPt.y) continue;
            if (inPt.y === edgeLowPt.y) {
              if (inPt.x === edgeLowPt.x) return true;
            } else {
              const perpEdge = edgeDy * (inPt.x - edgeLowPt.x) - edgeDx * (inPt.y - edgeLowPt.y);
              if (perpEdge === 0) return true;
              if (perpEdge < 0) continue;
              inside = !inside;
            }
          } else {
            if (inPt.y !== edgeLowPt.y) continue;
            if (edgeHighPt.x <= inPt.x && inPt.x <= edgeLowPt.x || edgeLowPt.x <= inPt.x && inPt.x <= edgeHighPt.x) return true;
          }
        }
        return inside;
      }
      const isClockWise = ShapeUtils.isClockWise;
      const subPaths = this.subPaths;
      if (subPaths.length === 0) return [];
      let solid, tmpPath, tmpShape;
      const shapes = [];
      if (subPaths.length === 1) {
        tmpPath = subPaths[0];
        tmpShape = new Shape();
        tmpShape.curves = tmpPath.curves;
        shapes.push(tmpShape);
        return shapes;
      }
      let holesFirst = !isClockWise(subPaths[0].getPoints());
      holesFirst = isCCW ? !holesFirst : holesFirst;
      const betterShapeHoles = [];
      const newShapes = [];
      let newShapeHoles = [];
      let mainIdx = 0;
      let tmpPoints;
      newShapes[mainIdx] = void 0;
      newShapeHoles[mainIdx] = [];
      for (let i = 0, l = subPaths.length; i < l; i++) {
        tmpPath = subPaths[i];
        tmpPoints = tmpPath.getPoints();
        solid = isClockWise(tmpPoints);
        solid = isCCW ? !solid : solid;
        if (solid) {
          if (!holesFirst && newShapes[mainIdx]) mainIdx++;
          newShapes[mainIdx] = { s: new Shape(), p: tmpPoints };
          newShapes[mainIdx].s.curves = tmpPath.curves;
          if (holesFirst) mainIdx++;
          newShapeHoles[mainIdx] = [];
        } else {
          newShapeHoles[mainIdx].push({ h: tmpPath, p: tmpPoints[0] });
        }
      }
      if (!newShapes[0]) return toShapesNoHoles(subPaths);
      if (newShapes.length > 1) {
        let ambiguous = false;
        let toChange = 0;
        for (let sIdx = 0, sLen = newShapes.length; sIdx < sLen; sIdx++) {
          betterShapeHoles[sIdx] = [];
        }
        for (let sIdx = 0, sLen = newShapes.length; sIdx < sLen; sIdx++) {
          const sho = newShapeHoles[sIdx];
          for (let hIdx = 0; hIdx < sho.length; hIdx++) {
            const ho = sho[hIdx];
            let hole_unassigned = true;
            for (let s2Idx = 0; s2Idx < newShapes.length; s2Idx++) {
              if (isPointInsidePolygon(ho.p, newShapes[s2Idx].p)) {
                if (sIdx !== s2Idx) toChange++;
                if (hole_unassigned) {
                  hole_unassigned = false;
                  betterShapeHoles[s2Idx].push(ho);
                } else {
                  ambiguous = true;
                }
              }
            }
            if (hole_unassigned) {
              betterShapeHoles[sIdx].push(ho);
            }
          }
        }
        if (toChange > 0 && ambiguous === false) {
          newShapeHoles = betterShapeHoles;
        }
      }
      let tmpHoles;
      for (let i = 0, il = newShapes.length; i < il; i++) {
        tmpShape = newShapes[i].s;
        shapes.push(tmpShape);
        tmpHoles = newShapeHoles[i];
        for (let j = 0, jl = tmpHoles.length; j < jl; j++) {
          tmpShape.holes.push(tmpHoles[j].h);
        }
      }
      return shapes;
    }
  };
  if (typeof __THREE_DEVTOOLS__ !== "undefined") {
    __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register", { detail: {
      revision: REVISION
    } }));
  }
  if (typeof window !== "undefined") {
    if (window.__THREE__) {
      console.warn("WARNING: Multiple instances of Three.js being imported.");
    } else {
      window.__THREE__ = REVISION;
    }
  }

  // node_modules/three/examples/jsm/controls/OrbitControls.js
  var _changeEvent = { type: "change" };
  var _startEvent = { type: "start" };
  var _endEvent = { type: "end" };
  var _ray2 = new Ray();
  var _plane = new Plane();
  var TILT_LIMIT = Math.cos(70 * MathUtils.DEG2RAD);
  var OrbitControls = class extends EventDispatcher {
    constructor(object, domElement) {
      super();
      this.object = object;
      this.domElement = domElement;
      this.domElement.style.touchAction = "none";
      this.enabled = true;
      this.target = new Vector3();
      this.cursor = new Vector3();
      this.minDistance = 0;
      this.maxDistance = Infinity;
      this.minZoom = 0;
      this.maxZoom = Infinity;
      this.minTargetRadius = 0;
      this.maxTargetRadius = Infinity;
      this.minPolarAngle = 0;
      this.maxPolarAngle = Math.PI;
      this.minAzimuthAngle = -Infinity;
      this.maxAzimuthAngle = Infinity;
      this.enableDamping = false;
      this.dampingFactor = 0.05;
      this.enableZoom = true;
      this.zoomSpeed = 1;
      this.enableRotate = true;
      this.rotateSpeed = 1;
      this.enablePan = true;
      this.panSpeed = 1;
      this.screenSpacePanning = true;
      this.keyPanSpeed = 7;
      this.zoomToCursor = false;
      this.autoRotate = false;
      this.autoRotateSpeed = 2;
      this.keys = { LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" };
      this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
      this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
      this.target0 = this.target.clone();
      this.position0 = this.object.position.clone();
      this.zoom0 = this.object.zoom;
      this._domElementKeyEvents = null;
      this.getPolarAngle = function() {
        return spherical.phi;
      };
      this.getAzimuthalAngle = function() {
        return spherical.theta;
      };
      this.getDistance = function() {
        return this.object.position.distanceTo(this.target);
      };
      this.listenToKeyEvents = function(domElement2) {
        domElement2.addEventListener("keydown", onKeyDown);
        this._domElementKeyEvents = domElement2;
      };
      this.stopListenToKeyEvents = function() {
        this._domElementKeyEvents.removeEventListener("keydown", onKeyDown);
        this._domElementKeyEvents = null;
      };
      this.saveState = function() {
        scope.target0.copy(scope.target);
        scope.position0.copy(scope.object.position);
        scope.zoom0 = scope.object.zoom;
      };
      this.reset = function() {
        scope.target.copy(scope.target0);
        scope.object.position.copy(scope.position0);
        scope.object.zoom = scope.zoom0;
        scope.object.updateProjectionMatrix();
        scope.dispatchEvent(_changeEvent);
        scope.update();
        state = STATE.NONE;
      };
      this.update = function() {
        const offset = new Vector3();
        const quat = new Quaternion().setFromUnitVectors(object.up, new Vector3(0, 1, 0));
        const quatInverse = quat.clone().invert();
        const lastPosition = new Vector3();
        const lastQuaternion = new Quaternion();
        const lastTargetPosition = new Vector3();
        const twoPI = 2 * Math.PI;
        return function update(deltaTime = null) {
          const position = scope.object.position;
          offset.copy(position).sub(scope.target);
          offset.applyQuaternion(quat);
          spherical.setFromVector3(offset);
          if (scope.autoRotate && state === STATE.NONE) {
            rotateLeft(getAutoRotationAngle(deltaTime));
          }
          if (scope.enableDamping) {
            spherical.theta += sphericalDelta.theta * scope.dampingFactor;
            spherical.phi += sphericalDelta.phi * scope.dampingFactor;
          } else {
            spherical.theta += sphericalDelta.theta;
            spherical.phi += sphericalDelta.phi;
          }
          let min = scope.minAzimuthAngle;
          let max = scope.maxAzimuthAngle;
          if (isFinite(min) && isFinite(max)) {
            if (min < -Math.PI) min += twoPI;
            else if (min > Math.PI) min -= twoPI;
            if (max < -Math.PI) max += twoPI;
            else if (max > Math.PI) max -= twoPI;
            if (min <= max) {
              spherical.theta = Math.max(min, Math.min(max, spherical.theta));
            } else {
              spherical.theta = spherical.theta > (min + max) / 2 ? Math.max(min, spherical.theta) : Math.min(max, spherical.theta);
            }
          }
          spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));
          spherical.makeSafe();
          if (scope.enableDamping === true) {
            scope.target.addScaledVector(panOffset, scope.dampingFactor);
          } else {
            scope.target.add(panOffset);
          }
          scope.target.sub(scope.cursor);
          scope.target.clampLength(scope.minTargetRadius, scope.maxTargetRadius);
          scope.target.add(scope.cursor);
          if (scope.zoomToCursor && performCursorZoom || scope.object.isOrthographicCamera) {
            spherical.radius = clampDistance(spherical.radius);
          } else {
            spherical.radius = clampDistance(spherical.radius * scale);
          }
          offset.setFromSpherical(spherical);
          offset.applyQuaternion(quatInverse);
          position.copy(scope.target).add(offset);
          scope.object.lookAt(scope.target);
          if (scope.enableDamping === true) {
            sphericalDelta.theta *= 1 - scope.dampingFactor;
            sphericalDelta.phi *= 1 - scope.dampingFactor;
            panOffset.multiplyScalar(1 - scope.dampingFactor);
          } else {
            sphericalDelta.set(0, 0, 0);
            panOffset.set(0, 0, 0);
          }
          let zoomChanged = false;
          if (scope.zoomToCursor && performCursorZoom) {
            let newRadius = null;
            if (scope.object.isPerspectiveCamera) {
              const prevRadius = offset.length();
              newRadius = clampDistance(prevRadius * scale);
              const radiusDelta = prevRadius - newRadius;
              scope.object.position.addScaledVector(dollyDirection, radiusDelta);
              scope.object.updateMatrixWorld();
            } else if (scope.object.isOrthographicCamera) {
              const mouseBefore = new Vector3(mouse.x, mouse.y, 0);
              mouseBefore.unproject(scope.object);
              scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / scale));
              scope.object.updateProjectionMatrix();
              zoomChanged = true;
              const mouseAfter = new Vector3(mouse.x, mouse.y, 0);
              mouseAfter.unproject(scope.object);
              scope.object.position.sub(mouseAfter).add(mouseBefore);
              scope.object.updateMatrixWorld();
              newRadius = offset.length();
            } else {
              console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.");
              scope.zoomToCursor = false;
            }
            if (newRadius !== null) {
              if (this.screenSpacePanning) {
                scope.target.set(0, 0, -1).transformDirection(scope.object.matrix).multiplyScalar(newRadius).add(scope.object.position);
              } else {
                _ray2.origin.copy(scope.object.position);
                _ray2.direction.set(0, 0, -1).transformDirection(scope.object.matrix);
                if (Math.abs(scope.object.up.dot(_ray2.direction)) < TILT_LIMIT) {
                  object.lookAt(scope.target);
                } else {
                  _plane.setFromNormalAndCoplanarPoint(scope.object.up, scope.target);
                  _ray2.intersectPlane(_plane, scope.target);
                }
              }
            }
          } else if (scope.object.isOrthographicCamera) {
            scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / scale));
            scope.object.updateProjectionMatrix();
            zoomChanged = true;
          }
          scale = 1;
          performCursorZoom = false;
          if (zoomChanged || lastPosition.distanceToSquared(scope.object.position) > EPS || 8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS || lastTargetPosition.distanceToSquared(scope.target) > 0) {
            scope.dispatchEvent(_changeEvent);
            lastPosition.copy(scope.object.position);
            lastQuaternion.copy(scope.object.quaternion);
            lastTargetPosition.copy(scope.target);
            return true;
          }
          return false;
        };
      }();
      this.dispose = function() {
        scope.domElement.removeEventListener("contextmenu", onContextMenu);
        scope.domElement.removeEventListener("pointerdown", onPointerDown);
        scope.domElement.removeEventListener("pointercancel", onPointerUp);
        scope.domElement.removeEventListener("wheel", onMouseWheel);
        scope.domElement.removeEventListener("pointermove", onPointerMove);
        scope.domElement.removeEventListener("pointerup", onPointerUp);
        if (scope._domElementKeyEvents !== null) {
          scope._domElementKeyEvents.removeEventListener("keydown", onKeyDown);
          scope._domElementKeyEvents = null;
        }
      };
      const scope = this;
      const STATE = {
        NONE: -1,
        ROTATE: 0,
        DOLLY: 1,
        PAN: 2,
        TOUCH_ROTATE: 3,
        TOUCH_PAN: 4,
        TOUCH_DOLLY_PAN: 5,
        TOUCH_DOLLY_ROTATE: 6
      };
      let state = STATE.NONE;
      const EPS = 1e-6;
      const spherical = new Spherical();
      const sphericalDelta = new Spherical();
      let scale = 1;
      const panOffset = new Vector3();
      const rotateStart = new Vector2();
      const rotateEnd = new Vector2();
      const rotateDelta = new Vector2();
      const panStart = new Vector2();
      const panEnd = new Vector2();
      const panDelta = new Vector2();
      const dollyStart = new Vector2();
      const dollyEnd = new Vector2();
      const dollyDelta = new Vector2();
      const dollyDirection = new Vector3();
      const mouse = new Vector2();
      let performCursorZoom = false;
      const pointers = [];
      const pointerPositions = {};
      function getAutoRotationAngle(deltaTime) {
        if (deltaTime !== null) {
          return 2 * Math.PI / 60 * scope.autoRotateSpeed * deltaTime;
        } else {
          return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
        }
      }
      function getZoomScale(delta) {
        const normalized_delta = Math.abs(delta) / (100 * (window.devicePixelRatio | 0));
        return Math.pow(0.95, scope.zoomSpeed * normalized_delta);
      }
      function rotateLeft(angle) {
        sphericalDelta.theta -= angle;
      }
      function rotateUp(angle) {
        sphericalDelta.phi -= angle;
      }
      const panLeft = function() {
        const v = new Vector3();
        return function panLeft2(distance, objectMatrix) {
          v.setFromMatrixColumn(objectMatrix, 0);
          v.multiplyScalar(-distance);
          panOffset.add(v);
        };
      }();
      const panUp = function() {
        const v = new Vector3();
        return function panUp2(distance, objectMatrix) {
          if (scope.screenSpacePanning === true) {
            v.setFromMatrixColumn(objectMatrix, 1);
          } else {
            v.setFromMatrixColumn(objectMatrix, 0);
            v.crossVectors(scope.object.up, v);
          }
          v.multiplyScalar(distance);
          panOffset.add(v);
        };
      }();
      const pan = function() {
        const offset = new Vector3();
        return function pan2(deltaX, deltaY) {
          const element = scope.domElement;
          if (scope.object.isPerspectiveCamera) {
            const position = scope.object.position;
            offset.copy(position).sub(scope.target);
            let targetDistance = offset.length();
            targetDistance *= Math.tan(scope.object.fov / 2 * Math.PI / 180);
            panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
            panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);
          } else if (scope.object.isOrthographicCamera) {
            panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix);
            panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix);
          } else {
            console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.");
            scope.enablePan = false;
          }
        };
      }();
      function dollyOut(dollyScale) {
        if (scope.object.isPerspectiveCamera || scope.object.isOrthographicCamera) {
          scale /= dollyScale;
        } else {
          console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.");
          scope.enableZoom = false;
        }
      }
      function dollyIn(dollyScale) {
        if (scope.object.isPerspectiveCamera || scope.object.isOrthographicCamera) {
          scale *= dollyScale;
        } else {
          console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.");
          scope.enableZoom = false;
        }
      }
      function updateZoomParameters(x, y) {
        if (!scope.zoomToCursor) {
          return;
        }
        performCursorZoom = true;
        const rect = scope.domElement.getBoundingClientRect();
        const dx = x - rect.left;
        const dy = y - rect.top;
        const w = rect.width;
        const h = rect.height;
        mouse.x = dx / w * 2 - 1;
        mouse.y = -(dy / h) * 2 + 1;
        dollyDirection.set(mouse.x, mouse.y, 1).unproject(scope.object).sub(scope.object.position).normalize();
      }
      function clampDistance(dist) {
        return Math.max(scope.minDistance, Math.min(scope.maxDistance, dist));
      }
      function handleMouseDownRotate(event) {
        rotateStart.set(event.clientX, event.clientY);
      }
      function handleMouseDownDolly(event) {
        updateZoomParameters(event.clientX, event.clientX);
        dollyStart.set(event.clientX, event.clientY);
      }
      function handleMouseDownPan(event) {
        panStart.set(event.clientX, event.clientY);
      }
      function handleMouseMoveRotate(event) {
        rotateEnd.set(event.clientX, event.clientY);
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        const element = scope.domElement;
        rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight);
        rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);
        rotateStart.copy(rotateEnd);
        scope.update();
      }
      function handleMouseMoveDolly(event) {
        dollyEnd.set(event.clientX, event.clientY);
        dollyDelta.subVectors(dollyEnd, dollyStart);
        if (dollyDelta.y > 0) {
          dollyOut(getZoomScale(dollyDelta.y));
        } else if (dollyDelta.y < 0) {
          dollyIn(getZoomScale(dollyDelta.y));
        }
        dollyStart.copy(dollyEnd);
        scope.update();
      }
      function handleMouseMovePan(event) {
        panEnd.set(event.clientX, event.clientY);
        panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);
        pan(panDelta.x, panDelta.y);
        panStart.copy(panEnd);
        scope.update();
      }
      function handleMouseWheel(event) {
        updateZoomParameters(event.clientX, event.clientY);
        if (event.deltaY < 0) {
          dollyIn(getZoomScale(event.deltaY));
        } else if (event.deltaY > 0) {
          dollyOut(getZoomScale(event.deltaY));
        }
        scope.update();
      }
      function handleKeyDown(event) {
        let needsUpdate = false;
        switch (event.code) {
          case scope.keys.UP:
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
              rotateUp(2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight);
            } else {
              pan(0, scope.keyPanSpeed);
            }
            needsUpdate = true;
            break;
          case scope.keys.BOTTOM:
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
              rotateUp(-2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight);
            } else {
              pan(0, -scope.keyPanSpeed);
            }
            needsUpdate = true;
            break;
          case scope.keys.LEFT:
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
              rotateLeft(2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight);
            } else {
              pan(scope.keyPanSpeed, 0);
            }
            needsUpdate = true;
            break;
          case scope.keys.RIGHT:
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
              rotateLeft(-2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight);
            } else {
              pan(-scope.keyPanSpeed, 0);
            }
            needsUpdate = true;
            break;
        }
        if (needsUpdate) {
          event.preventDefault();
          scope.update();
        }
      }
      function handleTouchStartRotate(event) {
        if (pointers.length === 1) {
          rotateStart.set(event.pageX, event.pageY);
        } else {
          const position = getSecondPointerPosition(event);
          const x = 0.5 * (event.pageX + position.x);
          const y = 0.5 * (event.pageY + position.y);
          rotateStart.set(x, y);
        }
      }
      function handleTouchStartPan(event) {
        if (pointers.length === 1) {
          panStart.set(event.pageX, event.pageY);
        } else {
          const position = getSecondPointerPosition(event);
          const x = 0.5 * (event.pageX + position.x);
          const y = 0.5 * (event.pageY + position.y);
          panStart.set(x, y);
        }
      }
      function handleTouchStartDolly(event) {
        const position = getSecondPointerPosition(event);
        const dx = event.pageX - position.x;
        const dy = event.pageY - position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        dollyStart.set(0, distance);
      }
      function handleTouchStartDollyPan(event) {
        if (scope.enableZoom) handleTouchStartDolly(event);
        if (scope.enablePan) handleTouchStartPan(event);
      }
      function handleTouchStartDollyRotate(event) {
        if (scope.enableZoom) handleTouchStartDolly(event);
        if (scope.enableRotate) handleTouchStartRotate(event);
      }
      function handleTouchMoveRotate(event) {
        if (pointers.length == 1) {
          rotateEnd.set(event.pageX, event.pageY);
        } else {
          const position = getSecondPointerPosition(event);
          const x = 0.5 * (event.pageX + position.x);
          const y = 0.5 * (event.pageY + position.y);
          rotateEnd.set(x, y);
        }
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        const element = scope.domElement;
        rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight);
        rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);
        rotateStart.copy(rotateEnd);
      }
      function handleTouchMovePan(event) {
        if (pointers.length === 1) {
          panEnd.set(event.pageX, event.pageY);
        } else {
          const position = getSecondPointerPosition(event);
          const x = 0.5 * (event.pageX + position.x);
          const y = 0.5 * (event.pageY + position.y);
          panEnd.set(x, y);
        }
        panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);
        pan(panDelta.x, panDelta.y);
        panStart.copy(panEnd);
      }
      function handleTouchMoveDolly(event) {
        const position = getSecondPointerPosition(event);
        const dx = event.pageX - position.x;
        const dy = event.pageY - position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        dollyEnd.set(0, distance);
        dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));
        dollyOut(dollyDelta.y);
        dollyStart.copy(dollyEnd);
        const centerX = (event.pageX + position.x) * 0.5;
        const centerY = (event.pageY + position.y) * 0.5;
        updateZoomParameters(centerX, centerY);
      }
      function handleTouchMoveDollyPan(event) {
        if (scope.enableZoom) handleTouchMoveDolly(event);
        if (scope.enablePan) handleTouchMovePan(event);
      }
      function handleTouchMoveDollyRotate(event) {
        if (scope.enableZoom) handleTouchMoveDolly(event);
        if (scope.enableRotate) handleTouchMoveRotate(event);
      }
      function onPointerDown(event) {
        if (scope.enabled === false) return;
        if (pointers.length === 0) {
          scope.domElement.setPointerCapture(event.pointerId);
          scope.domElement.addEventListener("pointermove", onPointerMove);
          scope.domElement.addEventListener("pointerup", onPointerUp);
        }
        addPointer(event);
        if (event.pointerType === "touch") {
          onTouchStart(event);
        } else {
          onMouseDown(event);
        }
      }
      function onPointerMove(event) {
        if (scope.enabled === false) return;
        if (event.pointerType === "touch") {
          onTouchMove(event);
        } else {
          onMouseMove(event);
        }
      }
      function onPointerUp(event) {
        removePointer(event);
        if (pointers.length === 0) {
          scope.domElement.releasePointerCapture(event.pointerId);
          scope.domElement.removeEventListener("pointermove", onPointerMove);
          scope.domElement.removeEventListener("pointerup", onPointerUp);
        }
        scope.dispatchEvent(_endEvent);
        state = STATE.NONE;
      }
      function onMouseDown(event) {
        let mouseAction;
        switch (event.button) {
          case 0:
            mouseAction = scope.mouseButtons.LEFT;
            break;
          case 1:
            mouseAction = scope.mouseButtons.MIDDLE;
            break;
          case 2:
            mouseAction = scope.mouseButtons.RIGHT;
            break;
          default:
            mouseAction = -1;
        }
        switch (mouseAction) {
          case MOUSE.DOLLY:
            if (scope.enableZoom === false) return;
            handleMouseDownDolly(event);
            state = STATE.DOLLY;
            break;
          case MOUSE.ROTATE:
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
              if (scope.enablePan === false) return;
              handleMouseDownPan(event);
              state = STATE.PAN;
            } else {
              if (scope.enableRotate === false) return;
              handleMouseDownRotate(event);
              state = STATE.ROTATE;
            }
            break;
          case MOUSE.PAN:
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
              if (scope.enableRotate === false) return;
              handleMouseDownRotate(event);
              state = STATE.ROTATE;
            } else {
              if (scope.enablePan === false) return;
              handleMouseDownPan(event);
              state = STATE.PAN;
            }
            break;
          default:
            state = STATE.NONE;
        }
        if (state !== STATE.NONE) {
          scope.dispatchEvent(_startEvent);
        }
      }
      function onMouseMove(event) {
        switch (state) {
          case STATE.ROTATE:
            if (scope.enableRotate === false) return;
            handleMouseMoveRotate(event);
            break;
          case STATE.DOLLY:
            if (scope.enableZoom === false) return;
            handleMouseMoveDolly(event);
            break;
          case STATE.PAN:
            if (scope.enablePan === false) return;
            handleMouseMovePan(event);
            break;
        }
      }
      function onMouseWheel(event) {
        if (scope.enabled === false || scope.enableZoom === false || state !== STATE.NONE) return;
        event.preventDefault();
        scope.dispatchEvent(_startEvent);
        handleMouseWheel(event);
        scope.dispatchEvent(_endEvent);
      }
      function onKeyDown(event) {
        if (scope.enabled === false || scope.enablePan === false) return;
        handleKeyDown(event);
      }
      function onTouchStart(event) {
        trackPointer(event);
        switch (pointers.length) {
          case 1:
            switch (scope.touches.ONE) {
              case TOUCH.ROTATE:
                if (scope.enableRotate === false) return;
                handleTouchStartRotate(event);
                state = STATE.TOUCH_ROTATE;
                break;
              case TOUCH.PAN:
                if (scope.enablePan === false) return;
                handleTouchStartPan(event);
                state = STATE.TOUCH_PAN;
                break;
              default:
                state = STATE.NONE;
            }
            break;
          case 2:
            switch (scope.touches.TWO) {
              case TOUCH.DOLLY_PAN:
                if (scope.enableZoom === false && scope.enablePan === false) return;
                handleTouchStartDollyPan(event);
                state = STATE.TOUCH_DOLLY_PAN;
                break;
              case TOUCH.DOLLY_ROTATE:
                if (scope.enableZoom === false && scope.enableRotate === false) return;
                handleTouchStartDollyRotate(event);
                state = STATE.TOUCH_DOLLY_ROTATE;
                break;
              default:
                state = STATE.NONE;
            }
            break;
          default:
            state = STATE.NONE;
        }
        if (state !== STATE.NONE) {
          scope.dispatchEvent(_startEvent);
        }
      }
      function onTouchMove(event) {
        trackPointer(event);
        switch (state) {
          case STATE.TOUCH_ROTATE:
            if (scope.enableRotate === false) return;
            handleTouchMoveRotate(event);
            scope.update();
            break;
          case STATE.TOUCH_PAN:
            if (scope.enablePan === false) return;
            handleTouchMovePan(event);
            scope.update();
            break;
          case STATE.TOUCH_DOLLY_PAN:
            if (scope.enableZoom === false && scope.enablePan === false) return;
            handleTouchMoveDollyPan(event);
            scope.update();
            break;
          case STATE.TOUCH_DOLLY_ROTATE:
            if (scope.enableZoom === false && scope.enableRotate === false) return;
            handleTouchMoveDollyRotate(event);
            scope.update();
            break;
          default:
            state = STATE.NONE;
        }
      }
      function onContextMenu(event) {
        if (scope.enabled === false) return;
        event.preventDefault();
      }
      function addPointer(event) {
        pointers.push(event.pointerId);
      }
      function removePointer(event) {
        delete pointerPositions[event.pointerId];
        for (let i = 0; i < pointers.length; i++) {
          if (pointers[i] == event.pointerId) {
            pointers.splice(i, 1);
            return;
          }
        }
      }
      function trackPointer(event) {
        let position = pointerPositions[event.pointerId];
        if (position === void 0) {
          position = new Vector2();
          pointerPositions[event.pointerId] = position;
        }
        position.set(event.pageX, event.pageY);
      }
      function getSecondPointerPosition(event) {
        const pointerId = event.pointerId === pointers[0] ? pointers[1] : pointers[0];
        return pointerPositions[pointerId];
      }
      scope.domElement.addEventListener("contextmenu", onContextMenu);
      scope.domElement.addEventListener("pointerdown", onPointerDown);
      scope.domElement.addEventListener("pointercancel", onPointerUp);
      scope.domElement.addEventListener("wheel", onMouseWheel, { passive: false });
      this.update();
    }
  };

  // node_modules/three/examples/jsm/renderers/CSS2DRenderer.js
  var CSS2DObject = class extends Object3D {
    constructor(element = document.createElement("div")) {
      super();
      this.isCSS2DObject = true;
      this.element = element;
      this.element.style.position = "absolute";
      this.element.style.userSelect = "none";
      this.element.setAttribute("draggable", false);
      this.center = new Vector2(0.5, 0.5);
      this.addEventListener("removed", function() {
        this.traverse(function(object) {
          if (object.element instanceof Element && object.element.parentNode !== null) {
            object.element.parentNode.removeChild(object.element);
          }
        });
      });
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.element = source.element.cloneNode(true);
      this.center = source.center;
      return this;
    }
  };
  var _vector4 = new Vector3();
  var _viewMatrix = new Matrix4();
  var _viewProjectionMatrix = new Matrix4();
  var _a = new Vector3();
  var _b = new Vector3();
  var CSS2DRenderer = class {
    constructor(parameters = {}) {
      const _this = this;
      let _width, _height;
      let _widthHalf, _heightHalf;
      const cache = {
        objects: /* @__PURE__ */ new WeakMap()
      };
      const domElement = parameters.element !== void 0 ? parameters.element : document.createElement("div");
      domElement.style.overflow = "hidden";
      this.domElement = domElement;
      this.getSize = function() {
        return {
          width: _width,
          height: _height
        };
      };
      this.render = function(scene, camera) {
        if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
        if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
        _viewMatrix.copy(camera.matrixWorldInverse);
        _viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, _viewMatrix);
        renderObject(scene, scene, camera);
        zOrder2(scene);
      };
      this.setSize = function(width, height) {
        _width = width;
        _height = height;
        _widthHalf = _width / 2;
        _heightHalf = _height / 2;
        domElement.style.width = width + "px";
        domElement.style.height = height + "px";
      };
      function renderObject(object, scene, camera) {
        if (object.isCSS2DObject) {
          _vector4.setFromMatrixPosition(object.matrixWorld);
          _vector4.applyMatrix4(_viewProjectionMatrix);
          const visible = object.visible === true && (_vector4.z >= -1 && _vector4.z <= 1) && object.layers.test(camera.layers) === true;
          object.element.style.display = visible === true ? "" : "none";
          if (visible === true) {
            object.onBeforeRender(_this, scene, camera);
            const element = object.element;
            element.style.transform = "translate(" + -100 * object.center.x + "%," + -100 * object.center.y + "%)translate(" + (_vector4.x * _widthHalf + _widthHalf) + "px," + (-_vector4.y * _heightHalf + _heightHalf) + "px)";
            if (element.parentNode !== domElement) {
              domElement.appendChild(element);
            }
            object.onAfterRender(_this, scene, camera);
          }
          const objectData = {
            distanceToCameraSquared: getDistanceToSquared(camera, object)
          };
          cache.objects.set(object, objectData);
        }
        for (let i = 0, l = object.children.length; i < l; i++) {
          renderObject(object.children[i], scene, camera);
        }
      }
      function getDistanceToSquared(object1, object2) {
        _a.setFromMatrixPosition(object1.matrixWorld);
        _b.setFromMatrixPosition(object2.matrixWorld);
        return _a.distanceToSquared(_b);
      }
      function filterAndFlatten(scene) {
        const result = [];
        scene.traverse(function(object) {
          if (object.isCSS2DObject) result.push(object);
        });
        return result;
      }
      function zOrder2(scene) {
        const sorted = filterAndFlatten(scene).sort(function(a, b) {
          if (a.renderOrder !== b.renderOrder) {
            return b.renderOrder - a.renderOrder;
          }
          const distanceA = cache.objects.get(a).distanceToCameraSquared;
          const distanceB = cache.objects.get(b).distanceToCameraSquared;
          return distanceA - distanceB;
        });
        const zMax = sorted.length;
        for (let i = 0, l = sorted.length; i < l; i++) {
          sorted[i].element.style.zIndex = zMax - i;
        }
      }
    }
  };

  // three-bundle.entry.js
  window.P3D_THREE = { THREE: three_module_exports, OrbitControls, CSS2DRenderer, CSS2DObject };
})();
