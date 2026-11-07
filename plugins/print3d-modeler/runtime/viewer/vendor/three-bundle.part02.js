                intersection.face.materialIndex = group.materialIndex;
                intersects2.push(intersection);
              }
            }
          }
        } else {
          const start = Math.max(0, drawRange.start);
          const end = Math.min(index.count, drawRange.start + drawRange.count);
          for (let i = start, il = end; i < il; i += 3) {
            const a = index.getX(i);
            const b = index.getX(i + 1);
            const c = index.getX(i + 2);
            intersection = checkGeometryIntersection(this, material, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c);
            if (intersection) {
              intersection.faceIndex = Math.floor(i / 3);
              intersects2.push(intersection);
            }
          }
        }
      } else if (position !== void 0) {
        if (Array.isArray(material)) {
          for (let i = 0, il = groups.length; i < il; i++) {
            const group = groups[i];
            const groupMaterial = material[group.materialIndex];
            const start = Math.max(group.start, drawRange.start);
            const end = Math.min(position.count, Math.min(group.start + group.count, drawRange.start + drawRange.count));
            for (let j = start, jl = end; j < jl; j += 3) {
              const a = j;
              const b = j + 1;
              const c = j + 2;
              intersection = checkGeometryIntersection(this, groupMaterial, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c);
              if (intersection) {
                intersection.faceIndex = Math.floor(j / 3);
                intersection.face.materialIndex = group.materialIndex;
                intersects2.push(intersection);
              }
            }
          }
        } else {
          const start = Math.max(0, drawRange.start);
          const end = Math.min(position.count, drawRange.start + drawRange.count);
          for (let i = start, il = end; i < il; i += 3) {
            const a = i;
            const b = i + 1;
            const c = i + 2;
            intersection = checkGeometryIntersection(this, material, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c);
            if (intersection) {
              intersection.faceIndex = Math.floor(i / 3);
              intersects2.push(intersection);
            }
          }
        }
      }
    }
  };
  function checkIntersection(object, material, raycaster, ray, pA, pB, pC, point) {
    let intersect;
    if (material.side === BackSide) {
      intersect = ray.intersectTriangle(pC, pB, pA, true, point);
    } else {
      intersect = ray.intersectTriangle(pA, pB, pC, material.side === FrontSide, point);
    }
    if (intersect === null) return null;
    _intersectionPointWorld.copy(point);
    _intersectionPointWorld.applyMatrix4(object.matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
    if (distance < raycaster.near || distance > raycaster.far) return null;
    return {
      distance,
      point: _intersectionPointWorld.clone(),
      object
    };
  }
  function checkGeometryIntersection(object, material, raycaster, ray, uv, uv1, normal, a, b, c) {
    object.getVertexPosition(a, _vA$1);
    object.getVertexPosition(b, _vB$1);
    object.getVertexPosition(c, _vC$1);
    const intersection = checkIntersection(object, material, raycaster, ray, _vA$1, _vB$1, _vC$1, _intersectionPoint);
    if (intersection) {
      if (uv) {
        _uvA$1.fromBufferAttribute(uv, a);
        _uvB$1.fromBufferAttribute(uv, b);
        _uvC$1.fromBufferAttribute(uv, c);
        intersection.uv = Triangle.getInterpolation(_intersectionPoint, _vA$1, _vB$1, _vC$1, _uvA$1, _uvB$1, _uvC$1, new Vector2());
      }
      if (uv1) {
        _uvA$1.fromBufferAttribute(uv1, a);
        _uvB$1.fromBufferAttribute(uv1, b);
        _uvC$1.fromBufferAttribute(uv1, c);
        intersection.uv1 = Triangle.getInterpolation(_intersectionPoint, _vA$1, _vB$1, _vC$1, _uvA$1, _uvB$1, _uvC$1, new Vector2());
        intersection.uv2 = intersection.uv1;
      }
      if (normal) {
        _normalA.fromBufferAttribute(normal, a);
        _normalB.fromBufferAttribute(normal, b);
        _normalC.fromBufferAttribute(normal, c);
        intersection.normal = Triangle.getInterpolation(_intersectionPoint, _vA$1, _vB$1, _vC$1, _normalA, _normalB, _normalC, new Vector3());
        if (intersection.normal.dot(ray.direction) > 0) {
          intersection.normal.multiplyScalar(-1);
        }
      }
      const face = {
        a,
        b,
        c,
        normal: new Vector3(),
        materialIndex: 0
      };
      Triangle.getNormal(_vA$1, _vB$1, _vC$1, face.normal);
      intersection.face = face;
    }
    return intersection;
  }
  var BoxGeometry = class _BoxGeometry extends BufferGeometry {
    constructor(width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1) {
      super();
      this.type = "BoxGeometry";
      this.parameters = {
        width,
        height,
        depth,
        widthSegments,
        heightSegments,
        depthSegments
      };
      const scope = this;
      widthSegments = Math.floor(widthSegments);
      heightSegments = Math.floor(heightSegments);
      depthSegments = Math.floor(depthSegments);
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      let numberOfVertices = 0;
      let groupStart = 0;
      buildPlane("z", "y", "x", -1, -1, depth, height, width, depthSegments, heightSegments, 0);
      buildPlane("z", "y", "x", 1, -1, depth, height, -width, depthSegments, heightSegments, 1);
      buildPlane("x", "z", "y", 1, 1, width, depth, height, widthSegments, depthSegments, 2);
      buildPlane("x", "z", "y", 1, -1, width, depth, -height, widthSegments, depthSegments, 3);
      buildPlane("x", "y", "z", 1, -1, width, height, depth, widthSegments, heightSegments, 4);
      buildPlane("x", "y", "z", -1, -1, width, height, -depth, widthSegments, heightSegments, 5);
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      function buildPlane(u, v, w, udir, vdir, width2, height2, depth2, gridX, gridY, materialIndex) {
        const segmentWidth = width2 / gridX;
        const segmentHeight = height2 / gridY;
        const widthHalf = width2 / 2;
        const heightHalf = height2 / 2;
        const depthHalf = depth2 / 2;
        const gridX1 = gridX + 1;
        const gridY1 = gridY + 1;
        let vertexCounter = 0;
        let groupCount = 0;
        const vector = new Vector3();
        for (let iy = 0; iy < gridY1; iy++) {
          const y = iy * segmentHeight - heightHalf;
          for (let ix = 0; ix < gridX1; ix++) {
            const x = ix * segmentWidth - widthHalf;
            vector[u] = x * udir;
            vector[v] = y * vdir;
            vector[w] = depthHalf;
            vertices.push(vector.x, vector.y, vector.z);
            vector[u] = 0;
            vector[v] = 0;
            vector[w] = depth2 > 0 ? 1 : -1;
            normals.push(vector.x, vector.y, vector.z);
            uvs.push(ix / gridX);
            uvs.push(1 - iy / gridY);
            vertexCounter += 1;
          }
        }
        for (let iy = 0; iy < gridY; iy++) {
          for (let ix = 0; ix < gridX; ix++) {
            const a = numberOfVertices + ix + gridX1 * iy;
            const b = numberOfVertices + ix + gridX1 * (iy + 1);
            const c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
            const d = numberOfVertices + (ix + 1) + gridX1 * iy;
            indices.push(a, b, d);
            indices.push(b, c, d);
            groupCount += 6;
          }
        }
        scope.addGroup(groupStart, groupCount, materialIndex);
        groupStart += groupCount;
        numberOfVertices += vertexCounter;
      }
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    static fromJSON(data) {
      return new _BoxGeometry(data.width, data.height, data.depth, data.widthSegments, data.heightSegments, data.depthSegments);
    }
  };
  function cloneUniforms(src) {
    const dst = {};
    for (const u in src) {
      dst[u] = {};
      for (const p in src[u]) {
        const property = src[u][p];
        if (property && (property.isColor || property.isMatrix3 || property.isMatrix4 || property.isVector2 || property.isVector3 || property.isVector4 || property.isTexture || property.isQuaternion)) {
          if (property.isRenderTargetTexture) {
            console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().");
            dst[u][p] = null;
          } else {
            dst[u][p] = property.clone();
          }
        } else if (Array.isArray(property)) {
          dst[u][p] = property.slice();
        } else {
          dst[u][p] = property;
        }
      }
    }
    return dst;
  }
  function mergeUniforms(uniforms) {
    const merged = {};
    for (let u = 0; u < uniforms.length; u++) {
      const tmp2 = cloneUniforms(uniforms[u]);
      for (const p in tmp2) {
        merged[p] = tmp2[p];
      }
    }
    return merged;
  }
  function cloneUniformsGroups(src) {
    const dst = [];
    for (let u = 0; u < src.length; u++) {
      dst.push(src[u].clone());
    }
    return dst;
  }
  function getUnlitUniformColorSpace(renderer) {
    if (renderer.getRenderTarget() === null) {
      return renderer.outputColorSpace;
    }
    return ColorManagement.workingColorSpace;
  }
  var UniformsUtils = { clone: cloneUniforms, merge: mergeUniforms };
  var default_vertex = "void main() {\n	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}";
  var default_fragment = "void main() {\n	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );\n}";
  var ShaderMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isShaderMaterial = true;
      this.type = "ShaderMaterial";
      this.defines = {};
      this.uniforms = {};
      this.uniformsGroups = [];
      this.vertexShader = default_vertex;
      this.fragmentShader = default_fragment;
      this.linewidth = 1;
      this.wireframe = false;
      this.wireframeLinewidth = 1;
      this.fog = false;
      this.lights = false;
      this.clipping = false;
      this.forceSinglePass = true;
      this.extensions = {
        derivatives: false,
        // set to use derivatives
        fragDepth: false,
        // set to use fragment depth values
        drawBuffers: false,
        // set to use draw buffers
        shaderTextureLOD: false,
        // set to use shader texture LOD
        clipCullDistance: false
        // set to use vertex shader clipping
      };
      this.defaultAttributeValues = {
        "color": [1, 1, 1],
        "uv": [0, 0],
        "uv1": [0, 0]
      };
      this.index0AttributeName = void 0;
      this.uniformsNeedUpdate = false;
      this.glslVersion = null;
      if (parameters !== void 0) {
        this.setValues(parameters);
      }
    }
    copy(source) {
      super.copy(source);
      this.fragmentShader = source.fragmentShader;
      this.vertexShader = source.vertexShader;
      this.uniforms = cloneUniforms(source.uniforms);
      this.uniformsGroups = cloneUniformsGroups(source.uniformsGroups);
      this.defines = Object.assign({}, source.defines);
      this.wireframe = source.wireframe;
      this.wireframeLinewidth = source.wireframeLinewidth;
      this.fog = source.fog;
      this.lights = source.lights;
      this.clipping = source.clipping;
      this.extensions = Object.assign({}, source.extensions);
      this.glslVersion = source.glslVersion;
      return this;
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      data.glslVersion = this.glslVersion;
      data.uniforms = {};
      for (const name in this.uniforms) {
        const uniform = this.uniforms[name];
        const value = uniform.value;
        if (value && value.isTexture) {
          data.uniforms[name] = {
            type: "t",
            value: value.toJSON(meta).uuid
          };
        } else if (value && value.isColor) {
          data.uniforms[name] = {
            type: "c",
            value: value.getHex()
          };
        } else if (value && value.isVector2) {
          data.uniforms[name] = {
            type: "v2",
            value: value.toArray()
          };
        } else if (value && value.isVector3) {
          data.uniforms[name] = {
            type: "v3",
            value: value.toArray()
          };
        } else if (value && value.isVector4) {
          data.uniforms[name] = {
            type: "v4",
            value: value.toArray()
          };
        } else if (value && value.isMatrix3) {
          data.uniforms[name] = {
            type: "m3",
            value: value.toArray()
          };
        } else if (value && value.isMatrix4) {
          data.uniforms[name] = {
            type: "m4",
            value: value.toArray()
          };
        } else {
          data.uniforms[name] = {
            value
          };
        }
      }
      if (Object.keys(this.defines).length > 0) data.defines = this.defines;
      data.vertexShader = this.vertexShader;
      data.fragmentShader = this.fragmentShader;
      data.lights = this.lights;
      data.clipping = this.clipping;
      const extensions = {};
      for (const key in this.extensions) {
        if (this.extensions[key] === true) extensions[key] = true;
      }
      if (Object.keys(extensions).length > 0) data.extensions = extensions;
      return data;
    }
  };
  var Camera = class extends Object3D {
    constructor() {
      super();
      this.isCamera = true;
      this.type = "Camera";
      this.matrixWorldInverse = new Matrix4();
      this.projectionMatrix = new Matrix4();
      this.projectionMatrixInverse = new Matrix4();
      this.coordinateSystem = WebGLCoordinateSystem;
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.matrixWorldInverse.copy(source.matrixWorldInverse);
      this.projectionMatrix.copy(source.projectionMatrix);
      this.projectionMatrixInverse.copy(source.projectionMatrixInverse);
      this.coordinateSystem = source.coordinateSystem;
      return this;
    }
    getWorldDirection(target) {
      return super.getWorldDirection(target).negate();
    }
    updateMatrixWorld(force) {
      super.updateMatrixWorld(force);
      this.matrixWorldInverse.copy(this.matrixWorld).invert();
    }
    updateWorldMatrix(updateParents, updateChildren) {
      super.updateWorldMatrix(updateParents, updateChildren);
      this.matrixWorldInverse.copy(this.matrixWorld).invert();
    }
    clone() {
      return new this.constructor().copy(this);
    }
  };
  var PerspectiveCamera = class extends Camera {
    constructor(fov2 = 50, aspect2 = 1, near = 0.1, far = 2e3) {
      super();
      this.isPerspectiveCamera = true;
      this.type = "PerspectiveCamera";
      this.fov = fov2;
      this.zoom = 1;
      this.near = near;
      this.far = far;
      this.focus = 10;
      this.aspect = aspect2;
      this.view = null;
      this.filmGauge = 35;
      this.filmOffset = 0;
      this.updateProjectionMatrix();
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.fov = source.fov;
      this.zoom = source.zoom;
      this.near = source.near;
      this.far = source.far;
      this.focus = source.focus;
      this.aspect = source.aspect;
      this.view = source.view === null ? null : Object.assign({}, source.view);
      this.filmGauge = source.filmGauge;
      this.filmOffset = source.filmOffset;
      return this;
    }
    /**
     * Sets the FOV by focal length in respect to the current .filmGauge.
     *
     * The default film gauge is 35, so that the focal length can be specified for
     * a 35mm (full frame) camera.
     *
     * Values for focal length and film gauge must have the same unit.
     */
    setFocalLength(focalLength) {
      const vExtentSlope = 0.5 * this.getFilmHeight() / focalLength;
      this.fov = RAD2DEG * 2 * Math.atan(vExtentSlope);
      this.updateProjectionMatrix();
    }
    /**
     * Calculates the focal length from the current .fov and .filmGauge.
     */
    getFocalLength() {
      const vExtentSlope = Math.tan(DEG2RAD * 0.5 * this.fov);
      return 0.5 * this.getFilmHeight() / vExtentSlope;
    }
    getEffectiveFOV() {
      return RAD2DEG * 2 * Math.atan(
        Math.tan(DEG2RAD * 0.5 * this.fov) / this.zoom
      );
    }
    getFilmWidth() {
      return this.filmGauge * Math.min(this.aspect, 1);
    }
    getFilmHeight() {
      return this.filmGauge / Math.max(this.aspect, 1);
    }
    /**
     * Sets an offset in a larger frustum. This is useful for multi-window or
     * multi-monitor/multi-machine setups.
     *
     * For example, if you have 3x2 monitors and each monitor is 1920x1080 and
     * the monitors are in grid like this
     *
     *   +---+---+---+
     *   | A | B | C |
     *   +---+---+---+
     *   | D | E | F |
     *   +---+---+---+
     *
     * then for each monitor you would call it like this
     *
     *   const w = 1920;
     *   const h = 1080;
     *   const fullWidth = w * 3;
     *   const fullHeight = h * 2;
     *
     *   --A--
     *   camera.setViewOffset( fullWidth, fullHeight, w * 0, h * 0, w, h );
     *   --B--
     *   camera.setViewOffset( fullWidth, fullHeight, w * 1, h * 0, w, h );
     *   --C--
     *   camera.setViewOffset( fullWidth, fullHeight, w * 2, h * 0, w, h );
     *   --D--
     *   camera.setViewOffset( fullWidth, fullHeight, w * 0, h * 1, w, h );
     *   --E--
     *   camera.setViewOffset( fullWidth, fullHeight, w * 1, h * 1, w, h );
     *   --F--
     *   camera.setViewOffset( fullWidth, fullHeight, w * 2, h * 1, w, h );
     *
     *   Note there is no reason monitors have to be the same size or in a grid.
     */
    setViewOffset(fullWidth, fullHeight, x, y, width, height) {
      this.aspect = fullWidth / fullHeight;
      if (this.view === null) {
        this.view = {
          enabled: true,
          fullWidth: 1,
          fullHeight: 1,
          offsetX: 0,
          offsetY: 0,
          width: 1,
          height: 1
        };
      }
      this.view.enabled = true;
      this.view.fullWidth = fullWidth;
      this.view.fullHeight = fullHeight;
      this.view.offsetX = x;
      this.view.offsetY = y;
      this.view.width = width;
      this.view.height = height;
      this.updateProjectionMatrix();
    }
    clearViewOffset() {
      if (this.view !== null) {
        this.view.enabled = false;
      }
      this.updateProjectionMatrix();
    }
    updateProjectionMatrix() {
      const near = this.near;
      let top = near * Math.tan(DEG2RAD * 0.5 * this.fov) / this.zoom;
      let height = 2 * top;
      let width = this.aspect * height;
      let left = -0.5 * width;
      const view = this.view;
      if (this.view !== null && this.view.enabled) {
        const fullWidth = view.fullWidth, fullHeight = view.fullHeight;
        left += view.offsetX * width / fullWidth;
        top -= view.offsetY * height / fullHeight;
        width *= view.width / fullWidth;
        height *= view.height / fullHeight;
      }
      const skew = this.filmOffset;
      if (skew !== 0) left += near * skew / this.getFilmWidth();
      this.projectionMatrix.makePerspective(left, left + width, top, top - height, near, this.far, this.coordinateSystem);
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      data.object.fov = this.fov;
      data.object.zoom = this.zoom;
      data.object.near = this.near;
      data.object.far = this.far;
      data.object.focus = this.focus;
      data.object.aspect = this.aspect;
      if (this.view !== null) data.object.view = Object.assign({}, this.view);
      data.object.filmGauge = this.filmGauge;
      data.object.filmOffset = this.filmOffset;
      return data;
    }
  };
  var fov = -90;
  var aspect = 1;
  var CubeCamera = class extends Object3D {
    constructor(near, far, renderTarget) {
      super();
      this.type = "CubeCamera";
      this.renderTarget = renderTarget;
      this.coordinateSystem = null;
      this.activeMipmapLevel = 0;
      const cameraPX = new PerspectiveCamera(fov, aspect, near, far);
      cameraPX.layers = this.layers;
      this.add(cameraPX);
      const cameraNX = new PerspectiveCamera(fov, aspect, near, far);
      cameraNX.layers = this.layers;
      this.add(cameraNX);
      const cameraPY = new PerspectiveCamera(fov, aspect, near, far);
      cameraPY.layers = this.layers;
      this.add(cameraPY);
      const cameraNY = new PerspectiveCamera(fov, aspect, near, far);
      cameraNY.layers = this.layers;
      this.add(cameraNY);
      const cameraPZ = new PerspectiveCamera(fov, aspect, near, far);
      cameraPZ.layers = this.layers;
      this.add(cameraPZ);
      const cameraNZ = new PerspectiveCamera(fov, aspect, near, far);
      cameraNZ.layers = this.layers;
      this.add(cameraNZ);
    }
    updateCoordinateSystem() {
      const coordinateSystem = this.coordinateSystem;
      const cameras = this.children.concat();
      const [cameraPX, cameraNX, cameraPY, cameraNY, cameraPZ, cameraNZ] = cameras;
      for (const camera of cameras) this.remove(camera);
      if (coordinateSystem === WebGLCoordinateSystem) {
        cameraPX.up.set(0, 1, 0);
        cameraPX.lookAt(1, 0, 0);
        cameraNX.up.set(0, 1, 0);
        cameraNX.lookAt(-1, 0, 0);
        cameraPY.up.set(0, 0, -1);
        cameraPY.lookAt(0, 1, 0);
        cameraNY.up.set(0, 0, 1);
        cameraNY.lookAt(0, -1, 0);
        cameraPZ.up.set(0, 1, 0);
        cameraPZ.lookAt(0, 0, 1);
        cameraNZ.up.set(0, 1, 0);
        cameraNZ.lookAt(0, 0, -1);
      } else if (coordinateSystem === WebGPUCoordinateSystem) {
        cameraPX.up.set(0, -1, 0);
        cameraPX.lookAt(-1, 0, 0);
        cameraNX.up.set(0, -1, 0);
        cameraNX.lookAt(1, 0, 0);
        cameraPY.up.set(0, 0, 1);
        cameraPY.lookAt(0, 1, 0);
        cameraNY.up.set(0, 0, -1);
        cameraNY.lookAt(0, -1, 0);
        cameraPZ.up.set(0, -1, 0);
        cameraPZ.lookAt(0, 0, 1);
        cameraNZ.up.set(0, -1, 0);
        cameraNZ.lookAt(0, 0, -1);
      } else {
        throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: " + coordinateSystem);
      }
      for (const camera of cameras) {
        this.add(camera);
        camera.updateMatrixWorld();
      }
    }
    update(renderer, scene) {
      if (this.parent === null) this.updateMatrixWorld();
      const { renderTarget, activeMipmapLevel } = this;
      if (this.coordinateSystem !== renderer.coordinateSystem) {
        this.coordinateSystem = renderer.coordinateSystem;
        this.updateCoordinateSystem();
      }
      const [cameraPX, cameraNX, cameraPY, cameraNY, cameraPZ, cameraNZ] = this.children;
      const currentRenderTarget = renderer.getRenderTarget();
      const currentActiveCubeFace = renderer.getActiveCubeFace();
      const currentActiveMipmapLevel = renderer.getActiveMipmapLevel();
      const currentXrEnabled = renderer.xr.enabled;
      renderer.xr.enabled = false;
      const generateMipmaps = renderTarget.texture.generateMipmaps;
      renderTarget.texture.generateMipmaps = false;
      renderer.setRenderTarget(renderTarget, 0, activeMipmapLevel);
      renderer.render(scene, cameraPX);
      renderer.setRenderTarget(renderTarget, 1, activeMipmapLevel);
      renderer.render(scene, cameraNX);
      renderer.setRenderTarget(renderTarget, 2, activeMipmapLevel);
      renderer.render(scene, cameraPY);
      renderer.setRenderTarget(renderTarget, 3, activeMipmapLevel);
      renderer.render(scene, cameraNY);
      renderer.setRenderTarget(renderTarget, 4, activeMipmapLevel);
      renderer.render(scene, cameraPZ);
      renderTarget.texture.generateMipmaps = generateMipmaps;
      renderer.setRenderTarget(renderTarget, 5, activeMipmapLevel);
      renderer.render(scene, cameraNZ);
      renderer.setRenderTarget(currentRenderTarget, currentActiveCubeFace, currentActiveMipmapLevel);
      renderer.xr.enabled = currentXrEnabled;
      renderTarget.texture.needsPMREMUpdate = true;
    }
  };
  var CubeTexture = class extends Texture {
    constructor(images, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace) {
      images = images !== void 0 ? images : [];
      mapping = mapping !== void 0 ? mapping : CubeReflectionMapping;
      super(images, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace);
      this.isCubeTexture = true;
      this.flipY = false;
    }
    get images() {
      return this.image;
    }
    set images(value) {
      this.image = value;
    }
  };
  var WebGLCubeRenderTarget = class extends WebGLRenderTarget {
    constructor(size = 1, options = {}) {
      super(size, size, options);
      this.isWebGLCubeRenderTarget = true;
      const image = { width: size, height: size, depth: 1 };
      const images = [image, image, image, image, image, image];
      if (options.encoding !== void 0) {
        warnOnce("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace.");
        options.colorSpace = options.encoding === sRGBEncoding ? SRGBColorSpace : NoColorSpace;
      }
      this.texture = new CubeTexture(images, options.mapping, options.wrapS, options.wrapT, options.magFilter, options.minFilter, options.format, options.type, options.anisotropy, options.colorSpace);
      this.texture.isRenderTargetTexture = true;
      this.texture.generateMipmaps = options.generateMipmaps !== void 0 ? options.generateMipmaps : false;
      this.texture.minFilter = options.minFilter !== void 0 ? options.minFilter : LinearFilter;
    }
    fromEquirectangularTexture(renderer, texture) {
      this.texture.type = texture.type;
      this.texture.colorSpace = texture.colorSpace;
      this.texture.generateMipmaps = texture.generateMipmaps;
      this.texture.minFilter = texture.minFilter;
      this.texture.magFilter = texture.magFilter;
      const shader = {
        uniforms: {
          tEquirect: { value: null }
        },
        vertexShader: (
          /* glsl */
          `

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`
        ),
        fragmentShader: (
          /* glsl */
          `

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`
        )
      };
      const geometry = new BoxGeometry(5, 5, 5);
      const material = new ShaderMaterial({
        name: "CubemapFromEquirect",
        uniforms: cloneUniforms(shader.uniforms),
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: BackSide,
        blending: NoBlending
      });
      material.uniforms.tEquirect.value = texture;
      const mesh = new Mesh(geometry, material);
      const currentMinFilter = texture.minFilter;
      if (texture.minFilter === LinearMipmapLinearFilter) texture.minFilter = LinearFilter;
      const camera = new CubeCamera(1, 10, this);
      camera.update(renderer, mesh);
      texture.minFilter = currentMinFilter;
      mesh.geometry.dispose();
      mesh.material.dispose();
      return this;
    }
    clear(renderer, color, depth, stencil) {
      const currentRenderTarget = renderer.getRenderTarget();
      for (let i = 0; i < 6; i++) {
        renderer.setRenderTarget(this, i);
        renderer.clear(color, depth, stencil);
      }
      renderer.setRenderTarget(currentRenderTarget);
    }
  };
  var _vector1 = /* @__PURE__ */ new Vector3();
  var _vector2 = /* @__PURE__ */ new Vector3();
  var _normalMatrix = /* @__PURE__ */ new Matrix3();
  var Plane = class {
    constructor(normal = new Vector3(1, 0, 0), constant = 0) {
      this.isPlane = true;
      this.normal = normal;
      this.constant = constant;
    }
    set(normal, constant) {
      this.normal.copy(normal);
      this.constant = constant;
      return this;
    }
    setComponents(x, y, z, w) {
      this.normal.set(x, y, z);
      this.constant = w;
      return this;
    }
    setFromNormalAndCoplanarPoint(normal, point) {
      this.normal.copy(normal);
      this.constant = -point.dot(this.normal);
      return this;
    }
    setFromCoplanarPoints(a, b, c) {
      const normal = _vector1.subVectors(c, b).cross(_vector2.subVectors(a, b)).normalize();
      this.setFromNormalAndCoplanarPoint(normal, a);
      return this;
    }
    copy(plane) {
      this.normal.copy(plane.normal);
      this.constant = plane.constant;
      return this;
    }
    normalize() {
      const inverseNormalLength = 1 / this.normal.length();
      this.normal.multiplyScalar(inverseNormalLength);
      this.constant *= inverseNormalLength;
      return this;
    }
    negate() {
      this.constant *= -1;
      this.normal.negate();
      return this;
    }
    distanceToPoint(point) {
      return this.normal.dot(point) + this.constant;
    }
    distanceToSphere(sphere) {
      return this.distanceToPoint(sphere.center) - sphere.radius;
    }
    projectPoint(point, target) {
      return target.copy(point).addScaledVector(this.normal, -this.distanceToPoint(point));
    }
    intersectLine(line, target) {
      const direction = line.delta(_vector1);
      const denominator = this.normal.dot(direction);
      if (denominator === 0) {
        if (this.distanceToPoint(line.start) === 0) {
          return target.copy(line.start);
        }
        return null;
      }
      const t = -(line.start.dot(this.normal) + this.constant) / denominator;
      if (t < 0 || t > 1) {
        return null;
      }
      return target.copy(line.start).addScaledVector(direction, t);
    }
    intersectsLine(line) {
      const startSign = this.distanceToPoint(line.start);
      const endSign = this.distanceToPoint(line.end);
      return startSign < 0 && endSign > 0 || endSign < 0 && startSign > 0;
    }
    intersectsBox(box) {
      return box.intersectsPlane(this);
    }
    intersectsSphere(sphere) {
      return sphere.intersectsPlane(this);
    }
    coplanarPoint(target) {
      return target.copy(this.normal).multiplyScalar(-this.constant);
    }
    applyMatrix4(matrix, optionalNormalMatrix) {
      const normalMatrix = optionalNormalMatrix || _normalMatrix.getNormalMatrix(matrix);
      const referencePoint = this.coplanarPoint(_vector1).applyMatrix4(matrix);
      const normal = this.normal.applyMatrix3(normalMatrix).normalize();
      this.constant = -referencePoint.dot(normal);
      return this;
    }
    translate(offset) {
      this.constant -= offset.dot(this.normal);
      return this;
    }
    equals(plane) {
      return plane.normal.equals(this.normal) && plane.constant === this.constant;
    }
    clone() {
      return new this.constructor().copy(this);
    }
  };
  var _sphere$5 = /* @__PURE__ */ new Sphere();
  var _vector$7 = /* @__PURE__ */ new Vector3();
  var Frustum = class {
    constructor(p0 = new Plane(), p1 = new Plane(), p2 = new Plane(), p3 = new Plane(), p4 = new Plane(), p5 = new Plane()) {
      this.planes = [p0, p1, p2, p3, p4, p5];
    }
    set(p0, p1, p2, p3, p4, p5) {
      const planes = this.planes;
      planes[0].copy(p0);
      planes[1].copy(p1);
      planes[2].copy(p2);
      planes[3].copy(p3);
      planes[4].copy(p4);
      planes[5].copy(p5);
      return this;
    }
    copy(frustum) {
      const planes = this.planes;
      for (let i = 0; i < 6; i++) {
        planes[i].copy(frustum.planes[i]);
      }
      return this;
    }
    setFromProjectionMatrix(m, coordinateSystem = WebGLCoordinateSystem) {
      const planes = this.planes;
      const me = m.elements;
      const me0 = me[0], me1 = me[1], me2 = me[2], me3 = me[3];
      const me4 = me[4], me5 = me[5], me6 = me[6], me7 = me[7];
      const me8 = me[8], me9 = me[9], me10 = me[10], me11 = me[11];
      const me12 = me[12], me13 = me[13], me14 = me[14], me15 = me[15];
      planes[0].setComponents(me3 - me0, me7 - me4, me11 - me8, me15 - me12).normalize();
      planes[1].setComponents(me3 + me0, me7 + me4, me11 + me8, me15 + me12).normalize();
      planes[2].setComponents(me3 + me1, me7 + me5, me11 + me9, me15 + me13).normalize();
      planes[3].setComponents(me3 - me1, me7 - me5, me11 - me9, me15 - me13).normalize();
      planes[4].setComponents(me3 - me2, me7 - me6, me11 - me10, me15 - me14).normalize();
      if (coordinateSystem === WebGLCoordinateSystem) {
        planes[5].setComponents(me3 + me2, me7 + me6, me11 + me10, me15 + me14).normalize();
      } else if (coordinateSystem === WebGPUCoordinateSystem) {
        planes[5].setComponents(me2, me6, me10, me14).normalize();
      } else {
        throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: " + coordinateSystem);
      }
      return this;
    }
    intersectsObject(object) {
      if (object.boundingSphere !== void 0) {
        if (object.boundingSphere === null) object.computeBoundingSphere();
        _sphere$5.copy(object.boundingSphere).applyMatrix4(object.matrixWorld);
      } else {
        const geometry = object.geometry;
        if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
        _sphere$5.copy(geometry.boundingSphere).applyMatrix4(object.matrixWorld);
      }
      return this.intersectsSphere(_sphere$5);
    }
    intersectsSprite(sprite) {
      _sphere$5.center.set(0, 0, 0);
      _sphere$5.radius = 0.7071067811865476;
      _sphere$5.applyMatrix4(sprite.matrixWorld);
      return this.intersectsSphere(_sphere$5);
    }
    intersectsSphere(sphere) {
      const planes = this.planes;
      const center = sphere.center;
      const negRadius = -sphere.radius;
      for (let i = 0; i < 6; i++) {
        const distance = planes[i].distanceToPoint(center);
        if (distance < negRadius) {
          return false;
        }
      }
      return true;
    }
    intersectsBox(box) {
      const planes = this.planes;
      for (let i = 0; i < 6; i++) {
        const plane = planes[i];
        _vector$7.x = plane.normal.x > 0 ? box.max.x : box.min.x;
        _vector$7.y = plane.normal.y > 0 ? box.max.y : box.min.y;
        _vector$7.z = plane.normal.z > 0 ? box.max.z : box.min.z;
        if (plane.distanceToPoint(_vector$7) < 0) {
          return false;
        }
      }
      return true;
    }
    containsPoint(point) {
      const planes = this.planes;
      for (let i = 0; i < 6; i++) {
        if (planes[i].distanceToPoint(point) < 0) {
          return false;
        }
      }
      return true;
    }
    clone() {
      return new this.constructor().copy(this);
    }
  };
  function WebGLAnimation() {
    let context = null;
    let isAnimating = false;
    let animationLoop = null;
    let requestId = null;
    function onAnimationFrame(time, frame) {
      animationLoop(time, frame);
      requestId = context.requestAnimationFrame(onAnimationFrame);
    }
    return {
      start: function() {
        if (isAnimating === true) return;
        if (animationLoop === null) return;
        requestId = context.requestAnimationFrame(onAnimationFrame);
        isAnimating = true;
      },
      stop: function() {
        context.cancelAnimationFrame(requestId);
        isAnimating = false;
      },
      setAnimationLoop: function(callback) {
        animationLoop = callback;
      },
      setContext: function(value) {
        context = value;
      }
    };
  }
  function WebGLAttributes(gl, capabilities) {
    const isWebGL2 = capabilities.isWebGL2;
    const buffers = /* @__PURE__ */ new WeakMap();
    function createBuffer(attribute, bufferType) {
      const array = attribute.array;
      const usage = attribute.usage;
      const size = array.byteLength;
      const buffer = gl.createBuffer();
      gl.bindBuffer(bufferType, buffer);
      gl.bufferData(bufferType, array, usage);
      attribute.onUploadCallback();
      let type;
      if (array instanceof Float32Array) {
        type = gl.FLOAT;
      } else if (array instanceof Uint16Array) {
        if (attribute.isFloat16BufferAttribute) {
          if (isWebGL2) {
            type = gl.HALF_FLOAT;
          } else {
            throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");
          }
        } else {
          type = gl.UNSIGNED_SHORT;
        }
      } else if (array instanceof Int16Array) {
        type = gl.SHORT;
      } else if (array instanceof Uint32Array) {
        type = gl.UNSIGNED_INT;
      } else if (array instanceof Int32Array) {
        type = gl.INT;
      } else if (array instanceof Int8Array) {
        type = gl.BYTE;
      } else if (array instanceof Uint8Array) {
        type = gl.UNSIGNED_BYTE;
      } else if (array instanceof Uint8ClampedArray) {
        type = gl.UNSIGNED_BYTE;
      } else {
        throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: " + array);
      }
      return {
        buffer,
        type,
        bytesPerElement: array.BYTES_PER_ELEMENT,
        version: attribute.version,
        size
      };
    }
    function updateBuffer(buffer, attribute, bufferType) {
      const array = attribute.array;
      const updateRange = attribute._updateRange;
      const updateRanges = attribute.updateRanges;
      gl.bindBuffer(bufferType, buffer);
      if (updateRange.count === -1 && updateRanges.length === 0) {
        gl.bufferSubData(bufferType, 0, array);
      }
      if (updateRanges.length !== 0) {
        for (let i = 0, l = updateRanges.length; i < l; i++) {
          const range = updateRanges[i];
          if (isWebGL2) {
            gl.bufferSubData(
              bufferType,
              range.start * array.BYTES_PER_ELEMENT,
              array,
              range.start,
              range.count
            );
          } else {
            gl.bufferSubData(
              bufferType,
              range.start * array.BYTES_PER_ELEMENT,
              array.subarray(range.start, range.start + range.count)
            );
          }
        }
        attribute.clearUpdateRanges();
      }
      if (updateRange.count !== -1) {
        if (isWebGL2) {
          gl.bufferSubData(
            bufferType,
            updateRange.offset * array.BYTES_PER_ELEMENT,
            array,
            updateRange.offset,
            updateRange.count
          );
        } else {
          gl.bufferSubData(
            bufferType,
            updateRange.offset * array.BYTES_PER_ELEMENT,
            array.subarray(updateRange.offset, updateRange.offset + updateRange.count)
          );
        }
        updateRange.count = -1;
      }
      attribute.onUploadCallback();
    }
    function get(attribute) {
      if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
      return buffers.get(attribute);
    }
    function remove(attribute) {
      if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
      const data = buffers.get(attribute);
      if (data) {
        gl.deleteBuffer(data.buffer);
        buffers.delete(attribute);
      }
    }
    function update(attribute, bufferType) {
      if (attribute.isGLBufferAttribute) {
        const cached = buffers.get(attribute);
        if (!cached || cached.version < attribute.version) {
          buffers.set(attribute, {
            buffer: attribute.buffer,
            type: attribute.type,
            bytesPerElement: attribute.elementSize,
            version: attribute.version
          });
        }
        return;
      }
      if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
      const data = buffers.get(attribute);
      if (data === void 0) {
        buffers.set(attribute, createBuffer(attribute, bufferType));
      } else if (data.version < attribute.version) {
        if (data.size !== attribute.array.byteLength) {
          throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");
        }
        updateBuffer(data.buffer, attribute, bufferType);
        data.version = attribute.version;
      }
    }
    return {
      get,
      remove,
      update
    };
  }
  var PlaneGeometry = class _PlaneGeometry extends BufferGeometry {
    constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
      super();
      this.type = "PlaneGeometry";
      this.parameters = {
        width,
        height,
        widthSegments,
        heightSegments
      };
      const width_half = width / 2;
      const height_half = height / 2;
      const gridX = Math.floor(widthSegments);
      const gridY = Math.floor(heightSegments);
      const gridX1 = gridX + 1;
      const gridY1 = gridY + 1;
      const segment_width = width / gridX;
      const segment_height = height / gridY;
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      for (let iy = 0; iy < gridY1; iy++) {
        const y = iy * segment_height - height_half;
        for (let ix = 0; ix < gridX1; ix++) {
          const x = ix * segment_width - width_half;
          vertices.push(x, -y, 0);
          normals.push(0, 0, 1);
          uvs.push(ix / gridX);
          uvs.push(1 - iy / gridY);
        }
      }
      for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
          const a = ix + gridX1 * iy;
          const b = ix + gridX1 * (iy + 1);
          const c = ix + 1 + gridX1 * (iy + 1);
          const d = ix + 1 + gridX1 * iy;
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
      return new _PlaneGeometry(data.width, data.height, data.widthSegments, data.heightSegments);
    }
  };
  var alphahash_fragment = "#ifdef USE_ALPHAHASH\n	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;\n#endif";
  var alphahash_pars_fragment = "#ifdef USE_ALPHAHASH\n	const float ALPHA_HASH_SCALE = 0.05;\n	float hash2D( vec2 value ) {\n		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );\n	}\n	float hash3D( vec3 value ) {\n		return hash2D( vec2( hash2D( value.xy ), value.z ) );\n	}\n	float getAlphaHashThreshold( vec3 position ) {\n		float maxDeriv = max(\n			length( dFdx( position.xyz ) ),\n			length( dFdy( position.xyz ) )\n		);\n		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );\n		vec2 pixScales = vec2(\n			exp2( floor( log2( pixScale ) ) ),\n			exp2( ceil( log2( pixScale ) ) )\n		);\n		vec2 alpha = vec2(\n			hash3D( floor( pixScales.x * position.xyz ) ),\n			hash3D( floor( pixScales.y * position.xyz ) )\n		);\n		float lerpFactor = fract( log2( pixScale ) );\n		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;\n		float a = min( lerpFactor, 1.0 - lerpFactor );\n		vec3 cases = vec3(\n			x * x / ( 2.0 * a * ( 1.0 - a ) ),\n			( x - 0.5 * a ) / ( 1.0 - a ),\n			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )\n		);\n		float threshold = ( x < ( 1.0 - a ) )\n			? ( ( x < a ) ? cases.x : cases.y )\n			: cases.z;\n		return clamp( threshold , 1.0e-6, 1.0 );\n	}\n#endif";
  var alphamap_fragment = "#ifdef USE_ALPHAMAP\n	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;\n#endif";
  var alphamap_pars_fragment = "#ifdef USE_ALPHAMAP\n	uniform sampler2D alphaMap;\n#endif";
  var alphatest_fragment = "#ifdef USE_ALPHATEST\n	if ( diffuseColor.a < alphaTest ) discard;\n#endif";
  var alphatest_pars_fragment = "#ifdef USE_ALPHATEST\n	uniform float alphaTest;\n#endif";
  var aomap_fragment = "#ifdef USE_AOMAP\n	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;\n	reflectedLight.indirectDiffuse *= ambientOcclusion;\n	#if defined( USE_CLEARCOAT ) \n		clearcoatSpecularIndirect *= ambientOcclusion;\n	#endif\n	#if defined( USE_SHEEN ) \n		sheenSpecularIndirect *= ambientOcclusion;\n	#endif\n	#if defined( USE_ENVMAP ) && defined( STANDARD )\n		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );\n		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );\n	#endif\n#endif";
  var aomap_pars_fragment = "#ifdef USE_AOMAP\n	uniform sampler2D aoMap;\n	uniform float aoMapIntensity;\n#endif";
  var batching_pars_vertex = "#ifdef USE_BATCHING\n	attribute float batchId;\n	uniform highp sampler2D batchingTexture;\n	mat4 getBatchingMatrix( const in float i ) {\n		int size = textureSize( batchingTexture, 0 ).x;\n		int j = int( i ) * 4;\n		int x = j % size;\n		int y = j / size;\n		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );\n		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );\n		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );\n		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );\n		return mat4( v1, v2, v3, v4 );\n	}\n#endif";
  var batching_vertex = "#ifdef USE_BATCHING\n	mat4 batchingMatrix = getBatchingMatrix( batchId );\n#endif";
  var begin_vertex = "vec3 transformed = vec3( position );\n#ifdef USE_ALPHAHASH\n	vPosition = vec3( position );\n#endif";
  var beginnormal_vertex = "vec3 objectNormal = vec3( normal );\n#ifdef USE_TANGENT\n	vec3 objectTangent = vec3( tangent.xyz );\n#endif";
  var bsdfs = "float G_BlinnPhong_Implicit( ) {\n	return 0.25;\n}\nfloat D_BlinnPhong( const in float shininess, const in float dotNH ) {\n	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );\n}\nvec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float dotVH = saturate( dot( viewDir, halfDir ) );\n	vec3 F = F_Schlick( specularColor, 1.0, dotVH );\n	float G = G_BlinnPhong_Implicit( );\n	float D = D_BlinnPhong( shininess, dotNH );\n	return F * ( G * D );\n} // validated";
  var iridescence_fragment = "#ifdef USE_IRIDESCENCE\n	const mat3 XYZ_TO_REC709 = mat3(\n		 3.2404542, -0.9692660,  0.0556434,\n		-1.5371385,  1.8760108, -0.2040259,\n		-0.4985314,  0.0415560,  1.0572252\n	);\n	vec3 Fresnel0ToIor( vec3 fresnel0 ) {\n		vec3 sqrtF0 = sqrt( fresnel0 );\n		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );\n	}\n	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {\n		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );\n	}\n	float IorToFresnel0( float transmittedIor, float incidentIor ) {\n		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));\n	}\n	vec3 evalSensitivity( float OPD, vec3 shift ) {\n		float phase = 2.0 * PI * OPD * 1.0e-9;\n		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );\n		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );\n		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );\n		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );\n		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );\n		xyz /= 1.0685e-7;\n		vec3 rgb = XYZ_TO_REC709 * xyz;\n		return rgb;\n	}\n	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {\n		vec3 I;\n		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );\n		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );\n		float cosTheta2Sq = 1.0 - sinTheta2Sq;\n		if ( cosTheta2Sq < 0.0 ) {\n			return vec3( 1.0 );\n		}\n		float cosTheta2 = sqrt( cosTheta2Sq );\n		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );\n		float R12 = F_Schlick( R0, 1.0, cosTheta1 );\n		float T121 = 1.0 - R12;\n		float phi12 = 0.0;\n		if ( iridescenceIOR < outsideIOR ) phi12 = PI;\n		float phi21 = PI - phi12;\n		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );\n		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );\n		vec3 phi23 = vec3( 0.0 );\n		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;\n		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;\n		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;\n		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;\n		vec3 phi = vec3( phi21 ) + phi23;\n		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );\n		vec3 r123 = sqrt( R123 );\n		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );\n		vec3 C0 = R12 + Rs;\n		I = C0;\n		vec3 Cm = Rs - T121;\n		for ( int m = 1; m <= 2; ++ m ) {\n			Cm *= r123;\n			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );\n			I += Cm * Sm;\n		}\n		return max( I, vec3( 0.0 ) );\n	}\n#endif";
  var bumpmap_pars_fragment = "#ifdef USE_BUMPMAP\n	uniform sampler2D bumpMap;\n	uniform float bumpScale;\n	vec2 dHdxy_fwd() {\n		vec2 dSTdx = dFdx( vBumpMapUv );\n		vec2 dSTdy = dFdy( vBumpMapUv );\n		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;\n		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;\n		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;\n		return vec2( dBx, dBy );\n	}\n	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {\n		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );\n		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );\n		vec3 vN = surf_norm;\n		vec3 R1 = cross( vSigmaY, vN );\n		vec3 R2 = cross( vN, vSigmaX );\n		float fDet = dot( vSigmaX, R1 ) * faceDirection;\n		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );\n		return normalize( abs( fDet ) * surf_norm - vGrad );\n	}\n#endif";
  var clipping_planes_fragment = "#if NUM_CLIPPING_PLANES > 0\n	vec4 plane;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n		plane = clippingPlanes[ i ];\n		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;\n	}\n	#pragma unroll_loop_end\n	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n		bool clipped = true;\n		#pragma unroll_loop_start\n		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n			plane = clippingPlanes[ i ];\n			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;\n		}\n		#pragma unroll_loop_end\n		if ( clipped ) discard;\n	#endif\n#endif";
  var clipping_planes_pars_fragment = "#if NUM_CLIPPING_PLANES > 0\n	varying vec3 vClipPosition;\n	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];\n#endif";
  var clipping_planes_pars_vertex = "#if NUM_CLIPPING_PLANES > 0\n	varying vec3 vClipPosition;\n#endif";
  var clipping_planes_vertex = "#if NUM_CLIPPING_PLANES > 0\n	vClipPosition = - mvPosition.xyz;\n#endif";
  var color_fragment = "#if defined( USE_COLOR_ALPHA )\n	diffuseColor *= vColor;\n#elif defined( USE_COLOR )\n	diffuseColor.rgb *= vColor;\n#endif";
  var color_pars_fragment = "#if defined( USE_COLOR_ALPHA )\n	varying vec4 vColor;\n#elif defined( USE_COLOR )\n	varying vec3 vColor;\n#endif";
  var color_pars_vertex = "#if defined( USE_COLOR_ALPHA )\n	varying vec4 vColor;\n#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n	varying vec3 vColor;\n#endif";
  var color_vertex = "#if defined( USE_COLOR_ALPHA )\n	vColor = vec4( 1.0 );\n#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n	vColor = vec3( 1.0 );\n#endif\n#ifdef USE_COLOR\n	vColor *= color;\n#endif\n#ifdef USE_INSTANCING_COLOR\n	vColor.xyz *= instanceColor.xyz;\n#endif";
  var common = "#define PI 3.141592653589793\n#define PI2 6.283185307179586\n#define PI_HALF 1.5707963267948966\n#define RECIPROCAL_PI 0.3183098861837907\n#define RECIPROCAL_PI2 0.15915494309189535\n#define EPSILON 1e-6\n#ifndef saturate\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\n#define whiteComplement( a ) ( 1.0 - saturate( a ) )\nfloat pow2( const in float x ) { return x*x; }\nvec3 pow2( const in vec3 x ) { return x*x; }\nfloat pow3( const in float x ) { return x*x*x; }\nfloat pow4( const in float x ) { float x2 = x*x; return x2*x2; }\nfloat max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }\nfloat average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }\nhighp float rand( const in vec2 uv ) {\n	const highp float a = 12.9898, b = 78.233, c = 43758.5453;\n	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );\n	return fract( sin( sn ) * c );\n}\n#ifdef HIGH_PRECISION\n	float precisionSafeLength( vec3 v ) { return length( v ); }\n#else\n	float precisionSafeLength( vec3 v ) {\n		float maxComponent = max3( abs( v ) );\n		return length( v / maxComponent ) * maxComponent;\n	}\n#endif\nstruct IncidentLight {\n	vec3 color;\n	vec3 direction;\n	bool visible;\n};\nstruct ReflectedLight {\n	vec3 directDiffuse;\n	vec3 directSpecular;\n	vec3 indirectDiffuse;\n	vec3 indirectSpecular;\n};\n#ifdef USE_ALPHAHASH\n	varying vec3 vPosition;\n#endif\nvec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n}\nvec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {\n	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );\n}\nmat3 transposeMat3( const in mat3 m ) {\n	mat3 tmp;\n	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );\n	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );\n	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );\n	return tmp;\n}\nfloat luminance( const in vec3 rgb ) {\n	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );\n	return dot( weights, rgb );\n}\nbool isPerspectiveMatrix( mat4 m ) {\n	return m[ 2 ][ 3 ] == - 1.0;\n}\nvec2 equirectUv( in vec3 dir ) {\n	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;\n	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\n	return vec2( u, v );\n}\nvec3 BRDF_Lambert( const in vec3 diffuseColor ) {\n	return RECIPROCAL_PI * diffuseColor;\n}\nvec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {\n	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\n	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\n}\nfloat F_Schlick( const in float f0, const in float f90, const in float dotVH ) {\n	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\n	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\n} // validated";
  var cube_uv_reflection_fragment = "#ifdef ENVMAP_TYPE_CUBE_UV\n	#define cubeUV_minMipLevel 4.0\n	#define cubeUV_minTileSize 16.0\n	float getFace( vec3 direction ) {\n		vec3 absDirection = abs( direction );\n		float face = - 1.0;\n		if ( absDirection.x > absDirection.z ) {\n			if ( absDirection.x > absDirection.y )\n				face = direction.x > 0.0 ? 0.0 : 3.0;\n			else\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n		} else {\n			if ( absDirection.z > absDirection.y )\n				face = direction.z > 0.0 ? 2.0 : 5.0;\n			else\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n		}\n		return face;\n	}\n	vec2 getUV( vec3 direction, float face ) {\n		vec2 uv;\n		if ( face == 0.0 ) {\n			uv = vec2( direction.z, direction.y ) / abs( direction.x );\n		} else if ( face == 1.0 ) {\n			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );\n		} else if ( face == 2.0 ) {\n			uv = vec2( - direction.x, direction.y ) / abs( direction.z );\n		} else if ( face == 3.0 ) {\n			uv = vec2( - direction.z, direction.y ) / abs( direction.x );\n		} else if ( face == 4.0 ) {\n			uv = vec2( - direction.x, direction.z ) / abs( direction.y );\n		} else {\n			uv = vec2( direction.x, direction.y ) / abs( direction.z );\n		}\n		return 0.5 * ( uv + 1.0 );\n	}\n	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {\n		float face = getFace( direction );\n		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );\n		mipInt = max( mipInt, cubeUV_minMipLevel );\n		float faceSize = exp2( mipInt );\n		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;\n		if ( face > 2.0 ) {\n			uv.y += faceSize;\n			face -= 3.0;\n		}\n		uv.x += face * faceSize;\n		uv.x += filterInt * 3.0 * cubeUV_minTileSize;\n		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );\n		uv.x *= CUBEUV_TEXEL_WIDTH;\n		uv.y *= CUBEUV_TEXEL_HEIGHT;\n		#ifdef texture2DGradEXT\n			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;\n		#else\n			return texture2D( envMap, uv ).rgb;\n		#endif\n	}\n	#define cubeUV_r0 1.0\n	#define cubeUV_m0 - 2.0\n	#define cubeUV_r1 0.8\n	#define cubeUV_m1 - 1.0\n	#define cubeUV_r4 0.4\n	#define cubeUV_m4 2.0\n	#define cubeUV_r5 0.305\n	#define cubeUV_m5 3.0\n	#define cubeUV_r6 0.21\n	#define cubeUV_m6 4.0\n	float roughnessToMip( float roughness ) {\n		float mip = 0.0;\n		if ( roughness >= cubeUV_r1 ) {\n			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;\n		} else if ( roughness >= cubeUV_r4 ) {\n			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;\n		} else if ( roughness >= cubeUV_r5 ) {\n			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;\n		} else if ( roughness >= cubeUV_r6 ) {\n			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;\n		} else {\n			mip = - 2.0 * log2( 1.16 * roughness );		}\n		return mip;\n	}\n	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {\n		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );\n		float mipF = fract( mip );\n		float mipInt = floor( mip );\n		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );\n		if ( mipF == 0.0 ) {\n			return vec4( color0, 1.0 );\n		} else {\n			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );\n			return vec4( mix( color0, color1, mipF ), 1.0 );\n		}\n	}\n#endif";
  var defaultnormal_vertex = "vec3 transformedNormal = objectNormal;\n#ifdef USE_TANGENT\n	vec3 transformedTangent = objectTangent;\n#endif\n#ifdef USE_BATCHING\n	mat3 bm = mat3( batchingMatrix );\n	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );\n	transformedNormal = bm * transformedNormal;\n	#ifdef USE_TANGENT\n		transformedTangent = bm * transformedTangent;\n	#endif\n#endif\n#ifdef USE_INSTANCING\n	mat3 im = mat3( instanceMatrix );\n	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );\n	transformedNormal = im * transformedNormal;\n	#ifdef USE_TANGENT\n		transformedTangent = im * transformedTangent;\n	#endif\n#endif\ntransformedNormal = normalMatrix * transformedNormal;\n#ifdef FLIP_SIDED\n	transformedNormal = - transformedNormal;\n#endif\n#ifdef USE_TANGENT\n	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;\n	#ifdef FLIP_SIDED\n		transformedTangent = - transformedTangent;\n	#endif\n#endif";
  var displacementmap_pars_vertex = "#ifdef USE_DISPLACEMENTMAP\n	uniform sampler2D displacementMap;\n	uniform float displacementScale;\n	uniform float displacementBias;\n#endif";
  var displacementmap_vertex = "#ifdef USE_DISPLACEMENTMAP\n	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );\n#endif";
  var emissivemap_fragment = "#ifdef USE_EMISSIVEMAP\n	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );\n	totalEmissiveRadiance *= emissiveColor.rgb;\n#endif";
  var emissivemap_pars_fragment = "#ifdef USE_EMISSIVEMAP\n	uniform sampler2D emissiveMap;\n#endif";
  var colorspace_fragment = "gl_FragColor = linearToOutputTexel( gl_FragColor );";
  var colorspace_pars_fragment = "\nconst mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(\n	vec3( 0.8224621, 0.177538, 0.0 ),\n	vec3( 0.0331941, 0.9668058, 0.0 ),\n	vec3( 0.0170827, 0.0723974, 0.9105199 )\n);\nconst mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(\n	vec3( 1.2249401, - 0.2249404, 0.0 ),\n	vec3( - 0.0420569, 1.0420571, 0.0 ),\n	vec3( - 0.0196376, - 0.0786361, 1.0982735 )\n);\nvec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {\n	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );\n}\nvec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {\n	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );\n}\nvec4 LinearTransferOETF( in vec4 value ) {\n	return value;\n}\nvec4 sRGBTransferOETF( in vec4 value ) {\n	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );\n}\nvec4 LinearToLinear( in vec4 value ) {\n	return value;\n}\nvec4 LinearTosRGB( in vec4 value ) {\n	return sRGBTransferOETF( value );\n}";
  var envmap_fragment = "#ifdef USE_ENVMAP\n	#ifdef ENV_WORLDPOS\n		vec3 cameraToFrag;\n		if ( isOrthographic ) {\n			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n		} else {\n			cameraToFrag = normalize( vWorldPosition - cameraPosition );\n		}\n		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );\n		#ifdef ENVMAP_MODE_REFLECTION\n			vec3 reflectVec = reflect( cameraToFrag, worldNormal );\n		#else\n			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );\n		#endif\n	#else\n		vec3 reflectVec = vReflect;\n	#endif\n	#ifdef ENVMAP_TYPE_CUBE\n		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n	#else\n		vec4 envColor = vec4( 0.0 );\n	#endif\n	#ifdef ENVMAP_BLENDING_MULTIPLY\n		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );\n	#elif defined( ENVMAP_BLENDING_MIX )\n		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );\n	#elif defined( ENVMAP_BLENDING_ADD )\n		outgoingLight += envColor.xyz * specularStrength * reflectivity;\n	#endif\n#endif";
  var envmap_common_pars_fragment = "#ifdef USE_ENVMAP\n	uniform float envMapIntensity;\n	uniform float flipEnvMap;\n	#ifdef ENVMAP_TYPE_CUBE\n		uniform samplerCube envMap;\n	#else\n		uniform sampler2D envMap;\n	#endif\n	\n#endif";
  var envmap_pars_fragment = "#ifdef USE_ENVMAP\n	uniform float reflectivity;\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )\n		#define ENV_WORLDPOS\n	#endif\n	#ifdef ENV_WORLDPOS\n		varying vec3 vWorldPosition;\n		uniform float refractionRatio;\n	#else\n		varying vec3 vReflect;\n	#endif\n#endif";
  var envmap_pars_vertex = "#ifdef USE_ENVMAP\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )\n		#define ENV_WORLDPOS\n	#endif\n	#ifdef ENV_WORLDPOS\n		\n		varying vec3 vWorldPosition;\n	#else\n		varying vec3 vReflect;\n		uniform float refractionRatio;\n	#endif\n#endif";
  var envmap_vertex = "#ifdef USE_ENVMAP\n	#ifdef ENV_WORLDPOS\n		vWorldPosition = worldPosition.xyz;\n	#else\n		vec3 cameraToVertex;\n		if ( isOrthographic ) {\n			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n		} else {\n			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );\n		}\n		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );\n		#ifdef ENVMAP_MODE_REFLECTION\n			vReflect = reflect( cameraToVertex, worldNormal );\n		#else\n			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );\n		#endif\n	#endif\n#endif";
  var fog_vertex = "#ifdef USE_FOG\n	vFogDepth = - mvPosition.z;\n#endif";
  var fog_pars_vertex = "#ifdef USE_FOG\n	varying float vFogDepth;\n#endif";
  var fog_fragment = "#ifdef USE_FOG\n	#ifdef FOG_EXP2\n		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n	#else\n		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n	#endif\n	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif";
  var fog_pars_fragment = "#ifdef USE_FOG\n	uniform vec3 fogColor;\n	varying float vFogDepth;\n	#ifdef FOG_EXP2\n		uniform float fogDensity;\n	#else\n		uniform float fogNear;\n		uniform float fogFar;\n	#endif\n#endif";
  var gradientmap_pars_fragment = "#ifdef USE_GRADIENTMAP\n	uniform sampler2D gradientMap;\n#endif\nvec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {\n	float dotNL = dot( normal, lightDirection );\n	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );\n	#ifdef USE_GRADIENTMAP\n		return vec3( texture2D( gradientMap, coord ).r );\n	#else\n		vec2 fw = fwidth( coord ) * 0.5;\n		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );\n	#endif\n}";
  var lightmap_fragment = "#ifdef USE_LIGHTMAP\n	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;\n	reflectedLight.indirectDiffuse += lightMapIrradiance;\n#endif";
  var lightmap_pars_fragment = "#ifdef USE_LIGHTMAP\n	uniform sampler2D lightMap;\n	uniform float lightMapIntensity;\n#endif";
  var lights_lambert_fragment = "LambertMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularStrength = specularStrength;";
  var lights_lambert_pars_fragment = "varying vec3 vViewPosition;\nstruct LambertMaterial {\n	vec3 diffuseColor;\n	float specularStrength;\n};\nvoid RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_Lambert\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert";
  var lights_pars_begin = "uniform bool receiveShadow;\nuniform vec3 ambientLightColor;\n#if defined( USE_LIGHT_PROBES )\n	uniform vec3 lightProbe[ 9 ];\n#endif\nvec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {\n	float x = normal.x, y = normal.y, z = normal.z;\n	vec3 result = shCoefficients[ 0 ] * 0.886227;\n	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;\n	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;\n	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;\n	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;\n	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;\n	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );\n	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;\n	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );\n	return result;\n}\nvec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {\n	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );\n	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );\n	return irradiance;\n}\nvec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {\n	vec3 irradiance = ambientLightColor;\n	return irradiance;\n}\nfloat getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {\n	#if defined ( LEGACY_LIGHTS )\n		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {\n			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );\n		}\n		return 1.0;\n	#else\n		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );\n		if ( cutoffDistance > 0.0 ) {\n			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );\n		}\n		return distanceFalloff;\n	#endif\n}\nfloat getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {\n	return smoothstep( coneCosine, penumbraCosine, angleCosine );\n}\n#if NUM_DIR_LIGHTS > 0\n	struct DirectionalLight {\n		vec3 direction;\n		vec3 color;\n	};\n	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];\n	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {\n		light.color = directionalLight.color;\n		light.direction = directionalLight.direction;\n		light.visible = true;\n	}\n#endif\n#if NUM_POINT_LIGHTS > 0\n	struct PointLight {\n		vec3 position;\n		vec3 color;\n		float distance;\n		float decay;\n	};\n	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];\n	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {\n		vec3 lVector = pointLight.position - geometryPosition;\n		light.direction = normalize( lVector );\n		float lightDistance = length( lVector );\n		light.color = pointLight.color;\n		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );\n		light.visible = ( light.color != vec3( 0.0 ) );\n	}\n#endif\n#if NUM_SPOT_LIGHTS > 0\n	struct SpotLight {\n		vec3 position;\n		vec3 direction;\n		vec3 color;\n		float distance;\n		float decay;\n		float coneCos;\n		float penumbraCos;\n	};\n	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];\n	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {\n		vec3 lVector = spotLight.position - geometryPosition;\n		light.direction = normalize( lVector );\n		float angleCos = dot( light.direction, spotLight.direction );\n		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );\n		if ( spotAttenuation > 0.0 ) {\n			float lightDistance = length( lVector );\n			light.color = spotLight.color * spotAttenuation;\n			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );\n			light.visible = ( light.color != vec3( 0.0 ) );\n		} else {\n			light.color = vec3( 0.0 );\n			light.visible = false;\n		}\n	}\n#endif\n#if NUM_RECT_AREA_LIGHTS > 0\n	struct RectAreaLight {\n		vec3 color;\n		vec3 position;\n		vec3 halfWidth;\n		vec3 halfHeight;\n	};\n	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;\n	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];\n#endif\n#if NUM_HEMI_LIGHTS > 0\n	struct HemisphereLight {\n		vec3 direction;\n		vec3 skyColor;\n		vec3 groundColor;\n	};\n	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];\n	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {\n		float dotNL = dot( normal, hemiLight.direction );\n		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;\n		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );\n		return irradiance;\n	}\n#endif";
  var envmap_physical_pars_fragment = "#ifdef USE_ENVMAP\n	vec3 getIBLIrradiance( const in vec3 normal ) {\n		#ifdef ENVMAP_TYPE_CUBE_UV\n			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );\n			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );\n			return PI * envMapColor.rgb * envMapIntensity;\n		#else\n			return vec3( 0.0 );\n		#endif\n	}\n	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {\n		#ifdef ENVMAP_TYPE_CUBE_UV\n			vec3 reflectVec = reflect( - viewDir, normal );\n			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );\n			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );\n			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );\n			return envMapColor.rgb * envMapIntensity;\n		#else\n			return vec3( 0.0 );\n		#endif\n	}\n	#ifdef USE_ANISOTROPY\n		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {\n			#ifdef ENVMAP_TYPE_CUBE_UV\n				vec3 bentNormal = cross( bitangent, viewDir );\n				bentNormal = normalize( cross( bentNormal, bitangent ) );\n				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );\n				return getIBLRadiance( viewDir, bentNormal, roughness );\n			#else\n				return vec3( 0.0 );\n			#endif\n		}\n	#endif\n#endif";
  var lights_toon_fragment = "ToonMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;";
  var lights_toon_pars_fragment = "varying vec3 vViewPosition;\nstruct ToonMaterial {\n	vec3 diffuseColor;\n};\nvoid RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_Toon\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon";
  var lights_phong_fragment = "BlinnPhongMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularColor = specular;\nmaterial.specularShininess = shininess;\nmaterial.specularStrength = specularStrength;";
  var lights_phong_pars_fragment = "varying vec3 vViewPosition;\nstruct BlinnPhongMaterial {\n	vec3 diffuseColor;\n	vec3 specularColor;\n	float specularShininess;\n	float specularStrength;\n};\nvoid RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;\n}\nvoid RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_BlinnPhong\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong";
  var lights_physical_fragment = "PhysicalMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );\nvec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );\nfloat geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );\nmaterial.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;\nmaterial.roughness = min( material.roughness, 1.0 );\n#ifdef IOR\n	material.ior = ior;\n	#ifdef USE_SPECULAR\n		float specularIntensityFactor = specularIntensity;\n		vec3 specularColorFactor = specularColor;\n		#ifdef USE_SPECULAR_COLORMAP\n			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;\n		#endif\n		#ifdef USE_SPECULAR_INTENSITYMAP\n			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;\n		#endif\n		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );\n	#else\n		float specularIntensityFactor = 1.0;\n		vec3 specularColorFactor = vec3( 1.0 );\n		material.specularF90 = 1.0;\n	#endif\n	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );\n#else\n	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );\n	material.specularF90 = 1.0;\n#endif\n#ifdef USE_CLEARCOAT\n	material.clearcoat = clearcoat;\n	material.clearcoatRoughness = clearcoatRoughness;\n	material.clearcoatF0 = vec3( 0.04 );\n	material.clearcoatF90 = 1.0;\n	#ifdef USE_CLEARCOATMAP\n		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;\n	#endif\n	#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;\n	#endif\n	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );\n	material.clearcoatRoughness += geometryRoughness;\n	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );\n#endif\n#ifdef USE_IRIDESCENCE\n	material.iridescence = iridescence;\n	material.iridescenceIOR = iridescenceIOR;\n	#ifdef USE_IRIDESCENCEMAP\n		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;\n	#endif\n	#ifdef USE_IRIDESCENCE_THICKNESSMAP\n		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;\n	#else\n		material.iridescenceThickness = iridescenceThicknessMaximum;\n	#endif\n#endif\n#ifdef USE_SHEEN\n	material.sheenColor = sheenColor;\n	#ifdef USE_SHEEN_COLORMAP\n		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;\n	#endif\n	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );\n	#ifdef USE_SHEEN_ROUGHNESSMAP\n		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;\n	#endif\n#endif\n#ifdef USE_ANISOTROPY\n	#ifdef USE_ANISOTROPYMAP\n		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );\n		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;\n		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;\n	#else\n		vec2 anisotropyV = anisotropyVector;\n	#endif\n	material.anisotropy = length( anisotropyV );\n	if( material.anisotropy == 0.0 ) {\n		anisotropyV = vec2( 1.0, 0.0 );\n	} else {\n		anisotropyV /= material.anisotropy;\n		material.anisotropy = saturate( material.anisotropy );\n	}\n	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );\n	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;\n	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;\n#endif";
  var lights_physical_pars_fragment = "struct PhysicalMaterial {\n	vec3 diffuseColor;\n	float roughness;\n	vec3 specularColor;\n	float specularF90;\n	#ifdef USE_CLEARCOAT\n		float clearcoat;\n		float clearcoatRoughness;\n		vec3 clearcoatF0;\n		float clearcoatF90;\n	#endif\n	#ifdef USE_IRIDESCENCE\n		float iridescence;\n		float iridescenceIOR;\n		float iridescenceThickness;\n		vec3 iridescenceFresnel;\n		vec3 iridescenceF0;\n	#endif\n	#ifdef USE_SHEEN\n		vec3 sheenColor;\n		float sheenRoughness;\n	#endif\n	#ifdef IOR\n		float ior;\n	#endif\n	#ifdef USE_TRANSMISSION\n		float transmission;\n		float transmissionAlpha;\n		float thickness;\n		float attenuationDistance;\n		vec3 attenuationColor;\n	#endif\n	#ifdef USE_ANISOTROPY\n		float anisotropy;\n		float alphaT;\n		vec3 anisotropyT;\n		vec3 anisotropyB;\n	#endif\n};\nvec3 clearcoatSpecularDirect = vec3( 0.0 );\nvec3 clearcoatSpecularIndirect = vec3( 0.0 );\nvec3 sheenSpecularDirect = vec3( 0.0 );\nvec3 sheenSpecularIndirect = vec3(0.0 );\nvec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {\n    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );\n    float x2 = x * x;\n    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );\n    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );\n}\nfloat V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {\n	float a2 = pow2( alpha );\n	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\n	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\n	return 0.5 / max( gv + gl, EPSILON );\n}\nfloat D_GGX( const in float alpha, const in float dotNH ) {\n	float a2 = pow2( alpha );\n	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;\n	return RECIPROCAL_PI * a2 / pow2( denom );\n}\n#ifdef USE_ANISOTROPY\n	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {\n		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );\n		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );\n		float v = 0.5 / ( gv + gl );\n		return saturate(v);\n	}\n	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {\n		float a2 = alphaT * alphaB;\n		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );\n		highp float v2 = dot( v, v );\n		float w2 = a2 / v2;\n		return RECIPROCAL_PI * a2 * pow2 ( w2 );\n	}\n#endif\n#ifdef USE_CLEARCOAT\n	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {\n		vec3 f0 = material.clearcoatF0;\n		float f90 = material.clearcoatF90;\n		float roughness = material.clearcoatRoughness;\n		float alpha = pow2( roughness );\n		vec3 halfDir = normalize( lightDir + viewDir );\n		float dotNL = saturate( dot( normal, lightDir ) );\n		float dotNV = saturate( dot( normal, viewDir ) );\n		float dotNH = saturate( dot( normal, halfDir ) );\n		float dotVH = saturate( dot( viewDir, halfDir ) );\n		vec3 F = F_Schlick( f0, f90, dotVH );\n		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\n		float D = D_GGX( alpha, dotNH );\n		return F * ( V * D );\n	}\n#endif\nvec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {\n	vec3 f0 = material.specularColor;\n	float f90 = material.specularF90;\n	float roughness = material.roughness;\n	float alpha = pow2( roughness );\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNL = saturate( dot( normal, lightDir ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float dotVH = saturate( dot( viewDir, halfDir ) );\n	vec3 F = F_Schlick( f0, f90, dotVH );\n	#ifdef USE_IRIDESCENCE\n		F = mix( F, material.iridescenceFresnel, material.iridescence );\n	#endif\n	#ifdef USE_ANISOTROPY\n		float dotTL = dot( material.anisotropyT, lightDir );\n		float dotTV = dot( material.anisotropyT, viewDir );\n		float dotTH = dot( material.anisotropyT, halfDir );\n		float dotBL = dot( material.anisotropyB, lightDir );\n		float dotBV = dot( material.anisotropyB, viewDir );\n		float dotBH = dot( material.anisotropyB, halfDir );\n		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );\n		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );\n	#else\n		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\n		float D = D_GGX( alpha, dotNH );\n	#endif\n	return F * ( V * D );\n}\nvec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {\n	const float LUT_SIZE = 64.0;\n	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;\n	const float LUT_BIAS = 0.5 / LUT_SIZE;\n	float dotNV = saturate( dot( N, V ) );\n	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );\n	uv = uv * LUT_SCALE + LUT_BIAS;\n	return uv;\n}\nfloat LTC_ClippedSphereFormFactor( const in vec3 f ) {\n	float l = length( f );\n	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );\n}\nvec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {\n	float x = dot( v1, v2 );\n	float y = abs( x );\n	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;\n	float b = 3.4175940 + ( 4.1616724 + y ) * y;\n	float v = a / b;\n	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;\n	return cross( v1, v2 ) * theta_sintheta;\n}\nvec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {\n	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];\n	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];\n	vec3 lightNormal = cross( v1, v2 );\n	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );\n	vec3 T1, T2;\n	T1 = normalize( V - N * dot( V, N ) );\n	T2 = - cross( N, T1 );\n	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );\n	vec3 coords[ 4 ];\n	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );\n	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );\n	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );\n	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );\n	coords[ 0 ] = normalize( coords[ 0 ] );\n	coords[ 1 ] = normalize( coords[ 1 ] );\n	coords[ 2 ] = normalize( coords[ 2 ] );\n	coords[ 3 ] = normalize( coords[ 3 ] );\n	vec3 vectorFormFactor = vec3( 0.0 );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );\n	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );\n	return vec3( result );\n}\n#if defined( USE_SHEEN )\nfloat D_Charlie( float roughness, float dotNH ) {\n	float alpha = pow2( roughness );\n	float invAlpha = 1.0 / alpha;\n	float cos2h = dotNH * dotNH;\n	float sin2h = max( 1.0 - cos2h, 0.0078125 );\n	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );\n}\nfloat V_Neubelt( float dotNV, float dotNL ) {\n	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );\n}\nvec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNL = saturate( dot( normal, lightDir ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float D = D_Charlie( sheenRoughness, dotNH );\n	float V = V_Neubelt( dotNV, dotNL );\n	return sheenColor * ( D * V );\n}\n#endif\nfloat IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float r2 = roughness * roughness;\n	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;\n	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;\n	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );\n	return saturate( DG * RECIPROCAL_PI );\n}\nvec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {\n	float dotNV = saturate( dot( normal, viewDir ) );\n	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );\n	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );\n	vec4 r = roughness * c0 + c1;\n	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;\n	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;\n	return fab;\n}\nvec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {\n	vec2 fab = DFGApprox( normal, viewDir, roughness );\n	return specularColor * fab.x + specularF90 * fab.y;\n}\n#ifdef USE_IRIDESCENCE\nvoid computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {\n#else\nvoid computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {\n#endif\n	vec2 fab = DFGApprox( normal, viewDir, roughness );\n	#ifdef USE_IRIDESCENCE\n		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );\n	#else\n		vec3 Fr = specularColor;\n	#endif\n	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;\n	float Ess = fab.x + fab.y;\n	float Ems = 1.0 - Ess;\n	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );\n	singleScatter += FssEss;\n	multiScatter += Fms * Ems;\n}\n#if NUM_RECT_AREA_LIGHTS > 0\n	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n		vec3 normal = geometryNormal;\n		vec3 viewDir = geometryViewDir;\n		vec3 position = geometryPosition;\n		vec3 lightPos = rectAreaLight.position;\n		vec3 halfWidth = rectAreaLight.halfWidth;\n		vec3 halfHeight = rectAreaLight.halfHeight;\n		vec3 lightColor = rectAreaLight.color;\n		float roughness = material.roughness;\n		vec3 rectCoords[ 4 ];\n		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;\n		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;\n		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;\n		vec2 uv = LTC_Uv( normal, viewDir, roughness );\n		vec4 t1 = texture2D( ltc_1, uv );\n		vec4 t2 = texture2D( ltc_2, uv );\n		mat3 mInv = mat3(\n			vec3( t1.x, 0, t1.y ),\n			vec3(    0, 1,    0 ),\n			vec3( t1.z, 0, t1.w )\n		);\n		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );\n		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );\n		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );\n	}\n#endif\nvoid RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	#ifdef USE_CLEARCOAT\n		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );\n		vec3 ccIrradiance = dotNLcc * directLight.color;\n		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );\n	#endif\n	#ifdef USE_SHEEN\n		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );\n	#endif\n	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {\n	#ifdef USE_CLEARCOAT\n		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );\n	#endif\n	#ifdef USE_SHEEN\n		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );\n	#endif\n	vec3 singleScattering = vec3( 0.0 );\n	vec3 multiScattering = vec3( 0.0 );\n	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;\n	#ifdef USE_IRIDESCENCE\n		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );\n	#else\n		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );\n	#endif\n	vec3 totalScattering = singleScattering + multiScattering;\n	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );\n	reflectedLight.indirectSpecular += radiance * singleScattering;\n	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;\n	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;\n}\n#define RE_Direct				RE_Direct_Physical\n#define RE_Direct_RectArea		RE_Direct_RectArea_Physical\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical\n#define RE_IndirectSpecular		RE_IndirectSpecular_Physical\nfloat computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {\n	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );\n}";
  var lights_fragment_begin = "\nvec3 geometryPosition = - vViewPosition;\nvec3 geometryNormal = normal;\nvec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\nvec3 geometryClearcoatNormal = vec3( 0.0 );\n#ifdef USE_CLEARCOAT\n	geometryClearcoatNormal = clearcoatNormal;\n#endif\n#ifdef USE_IRIDESCENCE\n	float dotNVi = saturate( dot( normal, geometryViewDir ) );\n	if ( material.iridescenceThickness == 0.0 ) {\n		material.iridescence = 0.0;\n	} else {\n		material.iridescence = saturate( material.iridescence );\n	}\n	if ( material.iridescence > 0.0 ) {\n		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );\n		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );\n	}\n#endif\nIncidentLight directLight;\n#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n	PointLight pointLight;\n	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n	PointLightShadow pointLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n		pointLight = pointLights[ i ];\n		getPointLightInfo( pointLight, geometryPosition, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\n		pointLightShadow = pointLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n	SpotLight spotLight;\n	vec4 spotColor;\n	vec3 spotLightCoord;\n	bool inSpotLightMap;\n	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n		spotLight = spotLights[ i ];\n		getSpotLightInfo( spotLight, geometryPosition, directLight );\n		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )\n		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX\n		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS\n		#else\n		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )\n		#endif\n		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )\n			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;\n			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );\n			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );\n			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;\n		#endif\n		#undef SPOT_LIGHT_MAP_INDEX\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		spotLightShadow = spotLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n	DirectionalLight directionalLight;\n	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n		directionalLight = directionalLights[ i ];\n		getDirectionalLightInfo( directionalLight, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n		directionalLightShadow = directionalLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n	RectAreaLight rectAreaLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n		rectAreaLight = rectAreaLights[ i ];\n		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if defined( RE_IndirectDiffuse )\n	vec3 iblIrradiance = vec3( 0.0 );\n	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n	#if defined( USE_LIGHT_PROBES )\n		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );\n	#endif\n	#if ( NUM_HEMI_LIGHTS > 0 )\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );\n		}\n		#pragma unroll_loop_end\n	#endif\n#endif\n#if defined( RE_IndirectSpecular )\n	vec3 radiance = vec3( 0.0 );\n	vec3 clearcoatRadiance = vec3( 0.0 );\n#endif";
  var lights_fragment_maps = "#if defined( RE_IndirectDiffuse )\n	#ifdef USE_LIGHTMAP\n		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;\n		irradiance += lightMapIrradiance;\n	#endif\n	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )\n		iblIrradiance += getIBLIrradiance( geometryNormal );\n	#endif\n#endif\n#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )\n	#ifdef USE_ANISOTROPY\n		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );\n	#else\n		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );\n	#endif\n	#ifdef USE_CLEARCOAT\n		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );\n	#endif\n#endif";
  var lights_fragment_end = "#if defined( RE_IndirectDiffuse )\n	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n#endif\n#if defined( RE_IndirectSpecular )\n	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n#endif";
  var logdepthbuf_fragment = "#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )\n	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;\n#endif";
  var logdepthbuf_pars_fragment = "#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )\n	uniform float logDepthBufFC;\n	varying float vFragDepth;\n	varying float vIsPerspective;\n#endif";
  var logdepthbuf_pars_vertex = "#ifdef USE_LOGDEPTHBUF\n	#ifdef USE_LOGDEPTHBUF_EXT\n		varying float vFragDepth;\n		varying float vIsPerspective;\n	#else\n		uniform float logDepthBufFC;\n	#endif\n#endif";
  var logdepthbuf_vertex = "#ifdef USE_LOGDEPTHBUF\n	#ifdef USE_LOGDEPTHBUF_EXT\n		vFragDepth = 1.0 + gl_Position.w;\n		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );\n	#else\n		if ( isPerspectiveMatrix( projectionMatrix ) ) {\n			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;\n			gl_Position.z *= gl_Position.w;\n		}\n	#endif\n#endif";
  var map_fragment = "#ifdef USE_MAP\n	vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n	#ifdef DECODE_VIDEO_TEXTURE\n		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );\n	\n	#endif\n	diffuseColor *= sampledDiffuseColor;\n#endif";
  var map_pars_fragment = "#ifdef USE_MAP\n	uniform sampler2D map;\n#endif";
  var map_particle_fragment = "#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n	#if defined( USE_POINTS_UV )\n		vec2 uv = vUv;\n	#else\n		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;\n	#endif\n#endif\n#ifdef USE_MAP\n	diffuseColor *= texture2D( map, uv );\n#endif\n#ifdef USE_ALPHAMAP\n	diffuseColor.a *= texture2D( alphaMap, uv ).g;\n#endif";
  var map_particle_pars_fragment = "#if defined( USE_POINTS_UV )\n	varying vec2 vUv;\n#else\n	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n		uniform mat3 uvTransform;\n	#endif\n#endif\n#ifdef USE_MAP\n	uniform sampler2D map;\n#endif\n#ifdef USE_ALPHAMAP\n	uniform sampler2D alphaMap;\n#endif";
  var metalnessmap_fragment = "float metalnessFactor = metalness;\n#ifdef USE_METALNESSMAP\n	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );\n	metalnessFactor *= texelMetalness.b;\n#endif";
  var metalnessmap_pars_fragment = "#ifdef USE_METALNESSMAP\n	uniform sampler2D metalnessMap;\n#endif";
  var morphcolor_vertex = "#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )\n	vColor *= morphTargetBaseInfluence;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		#if defined( USE_COLOR_ALPHA )\n			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];\n		#elif defined( USE_COLOR )\n			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];\n		#endif\n	}\n#endif";
  var morphnormal_vertex = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
  var morphtarget_pars_vertex = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform ivec2 morphTargetsTextureSize;\n		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {\n			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;\n			int y = texelIndex / morphTargetsTextureSize.x;\n			int x = texelIndex - y * morphTargetsTextureSize.x;\n			ivec3 morphUV = ivec3( x, y, morphTargetIndex );\n			return texelFetch( morphTargetsTexture, morphUV, 0 );\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
  var morphtarget_vertex = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";
  var normal_fragment_begin = "float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;\n#ifdef FLAT_SHADED\n	vec3 fdx = dFdx( vViewPosition );\n	vec3 fdy = dFdy( vViewPosition );\n	vec3 normal = normalize( cross( fdx, fdy ) );\n#else\n	vec3 normal = normalize( vNormal );\n	#ifdef DOUBLE_SIDED\n		normal *= faceDirection;\n	#endif\n#endif\n#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )\n	#ifdef USE_TANGENT\n		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n	#else\n		mat3 tbn = getTangentFrame( - vViewPosition, normal,\n		#if defined( USE_NORMALMAP )\n			vNormalMapUv\n		#elif defined( USE_CLEARCOAT_NORMALMAP )\n			vClearcoatNormalMapUv\n		#else\n			vUv\n		#endif\n		);\n	#endif\n	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )\n		tbn[0] *= faceDirection;\n		tbn[1] *= faceDirection;\n	#endif\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	#ifdef USE_TANGENT\n		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n	#else\n		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );\n	#endif\n	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )\n		tbn2[0] *= faceDirection;\n		tbn2[1] *= faceDirection;\n	#endif\n#endif\nvec3 nonPerturbedNormal = normal;";
  var normal_fragment_maps = "#ifdef USE_NORMALMAP_OBJECTSPACE\n	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n	#ifdef FLIP_SIDED\n		normal = - normal;\n	#endif\n	#ifdef DOUBLE_SIDED\n		normal = normal * faceDirection;\n	#endif\n	normal = normalize( normalMatrix * normal );\n#elif defined( USE_NORMALMAP_TANGENTSPACE )\n	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n	mapN.xy *= normalScale;\n	normal = normalize( tbn * mapN );\n#elif defined( USE_BUMPMAP )\n	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );\n#endif";
  var normal_pars_fragment = "#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif";
  var normal_pars_vertex = "#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif";
  var normal_vertex = "#ifndef FLAT_SHADED\n	vNormal = normalize( transformedNormal );\n	#ifdef USE_TANGENT\n		vTangent = normalize( transformedTangent );\n		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );\n	#endif\n#endif";
  var normalmap_pars_fragment = "#ifdef USE_NORMALMAP\n	uniform sampler2D normalMap;\n	uniform vec2 normalScale;\n#endif\n#ifdef USE_NORMALMAP_OBJECTSPACE\n	uniform mat3 normalMatrix;\n#endif\n#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )\n	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {\n		vec3 q0 = dFdx( eye_pos.xyz );\n		vec3 q1 = dFdy( eye_pos.xyz );\n		vec2 st0 = dFdx( uv.st );\n		vec2 st1 = dFdy( uv.st );\n		vec3 N = surf_norm;\n		vec3 q1perp = cross( q1, N );\n		vec3 q0perp = cross( N, q0 );\n		vec3 T = q1perp * st0.x + q0perp * st1.x;\n		vec3 B = q1perp * st0.y + q0perp * st1.y;\n		float det = max( dot( T, T ), dot( B, B ) );\n		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );\n		return mat3( T * scale, B * scale, N );\n	}\n#endif";
  var clearcoat_normal_fragment_begin = "#ifdef USE_CLEARCOAT\n	vec3 clearcoatNormal = nonPerturbedNormal;\n#endif";
  var clearcoat_normal_fragment_maps = "#ifdef USE_CLEARCOAT_NORMALMAP\n	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;\n	clearcoatMapN.xy *= clearcoatNormalScale;\n	clearcoatNormal = normalize( tbn2 * clearcoatMapN );\n#endif";
  var clearcoat_pars_fragment = "#ifdef USE_CLEARCOATMAP\n	uniform sampler2D clearcoatMap;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	uniform sampler2D clearcoatNormalMap;\n	uniform vec2 clearcoatNormalScale;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	uniform sampler2D clearcoatRoughnessMap;\n#endif";
  var iridescence_pars_fragment = "#ifdef USE_IRIDESCENCEMAP\n	uniform sampler2D iridescenceMap;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	uniform sampler2D iridescenceThicknessMap;\n#endif";
  var opaque_fragment = "#ifdef OPAQUE\ndiffuseColor.a = 1.0;\n#endif\n#ifdef USE_TRANSMISSION\ndiffuseColor.a *= material.transmissionAlpha;\n#endif\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );";
  var packing = "vec3 packNormalToRGB( const in vec3 normal ) {\n	return normalize( normal ) * 0.5 + 0.5;\n}\nvec3 unpackRGBToNormal( const in vec3 rgb ) {\n	return 2.0 * rgb.xyz - 1.0;\n}\nconst float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;\nconst vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );\nconst vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );\nconst float ShiftRight8 = 1. / 256.;\nvec4 packDepthToRGBA( const in float v ) {\n	vec4 r = vec4( fract( v * PackFactors ), v );\n	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;\n}\nfloat unpackRGBAToDepth( const in vec4 v ) {\n	return dot( v, UnpackFactors );\n}\nvec2 packDepthToRG( in highp float v ) {\n	return packDepthToRGBA( v ).yx;\n}\nfloat unpackRGToDepth( const in highp vec2 v ) {\n	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );\n}\nvec4 pack2HalfToRGBA( vec2 v ) {\n	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );\n	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );\n}\nvec2 unpackRGBATo2Half( vec4 v ) {\n	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );\n}\nfloat viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {\n	return ( viewZ + near ) / ( near - far );\n}\nfloat orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {\n	return depth * ( near - far ) - near;\n}\nfloat viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {\n	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );\n}\nfloat perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {\n	return ( near * far ) / ( ( far - near ) * depth - far );\n}";
  var premultiplied_alpha_fragment = "#ifdef PREMULTIPLIED_ALPHA\n	gl_FragColor.rgb *= gl_FragColor.a;\n#endif";
  var project_vertex = "vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_BATCHING\n	mvPosition = batchingMatrix * mvPosition;\n#endif\n#ifdef USE_INSTANCING\n	mvPosition = instanceMatrix * mvPosition;\n#endif\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;";
  var dithering_fragment = "#ifdef DITHERING\n	gl_FragColor.rgb = dithering( gl_FragColor.rgb );\n#endif";
  var dithering_pars_fragment = "#ifdef DITHERING\n	vec3 dithering( vec3 color ) {\n		float grid_position = rand( gl_FragCoord.xy );\n		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );\n		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );\n		return color + dither_shift_RGB;\n	}\n#endif";
  var roughnessmap_fragment = "float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );\n	roughnessFactor *= texelRoughness.g;\n#endif";
  var roughnessmap_pars_fragment = "#ifdef USE_ROUGHNESSMAP\n	uniform sampler2D roughnessMap;\n#endif";
  var shadowmap_pars_fragment = "#if NUM_SPOT_LIGHT_COORDS > 0\n	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];\n#endif\n#if NUM_SPOT_LIGHT_MAPS > 0\n	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];\n#endif\n#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n		struct DirectionalLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];\n		struct SpotLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n		struct PointLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n	#endif\n	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {\n		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );\n	}\n	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {\n		return unpackRGBATo2Half( texture2D( shadow, uv ) );\n	}\n	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){\n		float occlusion = 1.0;\n		vec2 distribution = texture2DDistribution( shadow, uv );\n		float hard_shadow = step( compare , distribution.x );\n		if (hard_shadow != 1.0 ) {\n			float distance = compare - distribution.x ;\n			float variance = max( 0.00000, distribution.y * distribution.y );\n			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );\n		}\n		return occlusion;\n	}\n	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n		float shadow = 1.0;\n		shadowCoord.xyz /= shadowCoord.w;\n		shadowCoord.z += shadowBias;\n		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;\n		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;\n		if ( frustumTest ) {\n		#if defined( SHADOWMAP_TYPE_PCF )\n			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n			float dx0 = - texelSize.x * shadowRadius;\n			float dy0 = - texelSize.y * shadowRadius;\n			float dx1 = + texelSize.x * shadowRadius;\n			float dy1 = + texelSize.y * shadowRadius;\n			float dx2 = dx0 / 2.0;\n			float dy2 = dy0 / 2.0;\n			float dx3 = dx1 / 2.0;\n			float dy3 = dy1 / 2.0;\n			shadow = (\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )\n			) * ( 1.0 / 17.0 );\n		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\n			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n			float dx = texelSize.x;\n			float dy = texelSize.y;\n			vec2 uv = shadowCoord.xy;\n			vec2 f = fract( uv * shadowMapSize + 0.5 );\n			uv -= f * texelSize;\n			shadow = (\n				texture2DCompare( shadowMap, uv, shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),\n					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),\n					 f.x ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),\n					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),\n					 f.x ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),\n					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),\n					 f.y ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),\n					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),\n					 f.y ) +\n				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),\n						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),\n						  f.x ),\n					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),\n						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),\n						  f.x ),\n					 f.y )\n			) * ( 1.0 / 9.0 );\n		#elif defined( SHADOWMAP_TYPE_VSM )\n			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );\n		#else\n			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );\n		#endif\n		}\n		return shadow;\n	}\n	vec2 cubeToUV( vec3 v, float texelSizeY ) {\n		vec3 absV = abs( v );\n		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );\n		absV *= scaleToCube;\n		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );\n		vec2 planar = v.xy;\n		float almostATexel = 1.5 * texelSizeY;\n		float almostOne = 1.0 - almostATexel;\n		if ( absV.z >= almostOne ) {\n			if ( v.z > 0.0 )\n				planar.x = 4.0 - v.x;\n		} else if ( absV.x >= almostOne ) {\n			float signX = sign( v.x );\n			planar.x = v.z * signX + 2.0 * signX;\n		} else if ( absV.y >= almostOne ) {\n			float signY = sign( v.y );\n			planar.x = v.x + 2.0 * signY + 2.0;\n			planar.y = v.z * signY - 2.0;\n		}\n		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );\n	}\n	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {\n		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );\n		vec3 lightToPosition = shadowCoord.xyz;\n		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;\n		vec3 bd3D = normalize( lightToPosition );\n		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )\n			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;\n			return (\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )\n			) * ( 1.0 / 9.0 );\n		#else\n			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );\n		#endif\n	}\n#endif";
  var shadowmap_pars_vertex = "#if NUM_SPOT_LIGHT_COORDS > 0\n	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];\n	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];\n#endif\n#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n		struct DirectionalLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n		struct SpotLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n		struct PointLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n	#endif\n#endif";
  var shadowmap_vertex = "#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )\n	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );\n	vec4 shadowWorldPosition;\n#endif\n#if defined( USE_SHADOWMAP )\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );\n			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;\n		}\n		#pragma unroll_loop_end\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );\n			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;\n		}\n		#pragma unroll_loop_end\n	#endif\n#endif\n#if NUM_SPOT_LIGHT_COORDS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {\n		shadowWorldPosition = worldPosition;\n		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;\n		#endif\n		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;\n	}\n	#pragma unroll_loop_end\n#endif";
  var shadowmask_pars_fragment = "float getShadowMask() {\n	float shadow = 1.0;\n	#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n		directionalLight = directionalLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {\n		spotLight = spotLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n	PointLightShadow pointLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n		pointLight = pointLightShadows[ i ];\n		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#endif\n	return shadow;\n}";
  var skinbase_vertex = "#ifdef USE_SKINNING\n	mat4 boneMatX = getBoneMatrix( skinIndex.x );\n	mat4 boneMatY = getBoneMatrix( skinIndex.y );\n	mat4 boneMatZ = getBoneMatrix( skinIndex.z );\n	mat4 boneMatW = getBoneMatrix( skinIndex.w );\n#endif";
  var skinning_pars_vertex = "#ifdef USE_SKINNING\n	uniform mat4 bindMatrix;\n	uniform mat4 bindMatrixInverse;\n	uniform highp sampler2D boneTexture;\n	mat4 getBoneMatrix( const in float i ) {\n		int size = textureSize( boneTexture, 0 ).x;\n		int j = int( i ) * 4;\n		int x = j % size;\n		int y = j / size;\n		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );\n		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );\n		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );\n		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );\n		return mat4( v1, v2, v3, v4 );\n	}\n#endif";
  var skinning_vertex = "#ifdef USE_SKINNING\n	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );\n	vec4 skinned = vec4( 0.0 );\n	skinned += boneMatX * skinVertex * skinWeight.x;\n	skinned += boneMatY * skinVertex * skinWeight.y;\n	skinned += boneMatZ * skinVertex * skinWeight.z;\n	skinned += boneMatW * skinVertex * skinWeight.w;\n	transformed = ( bindMatrixInverse * skinned ).xyz;\n#endif";
  var skinnormal_vertex = "#ifdef USE_SKINNING\n	mat4 skinMatrix = mat4( 0.0 );\n	skinMatrix += skinWeight.x * boneMatX;\n	skinMatrix += skinWeight.y * boneMatY;\n	skinMatrix += skinWeight.z * boneMatZ;\n	skinMatrix += skinWeight.w * boneMatW;\n	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;\n	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n	#ifdef USE_TANGENT\n		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;\n	#endif\n#endif";
  var specularmap_fragment = "float specularStrength;\n#ifdef USE_SPECULARMAP\n	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );\n	specularStrength = texelSpecular.r;\n#else\n	specularStrength = 1.0;\n#endif";
  var specularmap_pars_fragment = "#ifdef USE_SPECULARMAP\n	uniform sampler2D specularMap;\n#endif";
  var tonemapping_fragment = "#if defined( TONE_MAPPING )\n	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );\n#endif";
  var tonemapping_pars_fragment = "#ifndef saturate\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\nuniform float toneMappingExposure;\nvec3 LinearToneMapping( vec3 color ) {\n	return saturate( toneMappingExposure * color );\n}\nvec3 ReinhardToneMapping( vec3 color ) {\n	color *= toneMappingExposure;\n	return saturate( color / ( vec3( 1.0 ) + color ) );\n}\nvec3 OptimizedCineonToneMapping( vec3 color ) {\n	color *= toneMappingExposure;\n	color = max( vec3( 0.0 ), color - 0.004 );\n	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );\n}\nvec3 RRTAndODTFit( vec3 v ) {\n	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;\n	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;\n	return a / b;\n}\nvec3 ACESFilmicToneMapping( vec3 color ) {\n	const mat3 ACESInputMat = mat3(\n		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),\n		vec3( 0.04823, 0.01566, 0.83777 )\n	);\n	const mat3 ACESOutputMat = mat3(\n		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),\n		vec3( -0.07367, -0.00605,  1.07602 )\n	);\n	color *= toneMappingExposure / 0.6;\n	color = ACESInputMat * color;\n	color = RRTAndODTFit( color );\n	color = ACESOutputMat * color;\n	return saturate( color );\n}\nconst mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(\n	vec3( 1.6605, - 0.1246, - 0.0182 ),\n	vec3( - 0.5876, 1.1329, - 0.1006 ),\n	vec3( - 0.0728, - 0.0083, 1.1187 )\n);\nconst mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(\n	vec3( 0.6274, 0.0691, 0.0164 ),\n	vec3( 0.3293, 0.9195, 0.0880 ),\n	vec3( 0.0433, 0.0113, 0.8956 )\n);\nvec3 agxDefaultContrastApprox( vec3 x ) {\n	vec3 x2 = x * x;\n	vec3 x4 = x2 * x2;\n	return + 15.5 * x4 * x2\n		- 40.14 * x4 * x\n		+ 31.96 * x4\n		- 6.868 * x2 * x\n		+ 0.4298 * x2\n		+ 0.1191 * x\n		- 0.00232;\n}\nvec3 AgXToneMapping( vec3 color ) {\n	const mat3 AgXInsetMatrix = mat3(\n		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),\n		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),\n		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )\n	);\n	const mat3 AgXOutsetMatrix = mat3(\n		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),\n		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),\n		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )\n	);\n	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;\n	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;\n	color *= toneMappingExposure;\n	color = AgXInsetMatrix * color;\n	color = max( color, 1e-10 );	color = log2( color );\n	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );\n	color = clamp( color, 0.0, 1.0 );\n	color = agxDefaultContrastApprox( color );\n	color = AgXOutsetMatrix * color;\n	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );\n	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;\n	return color;\n}\nvec3 CustomToneMapping( vec3 color ) { return color; }";
  var transmission_fragment = "#ifdef USE_TRANSMISSION\n	material.transmission = transmission;\n	material.transmissionAlpha = 1.0;\n	material.thickness = thickness;\n	material.attenuationDistance = attenuationDistance;\n	material.attenuationColor = attenuationColor;\n	#ifdef USE_TRANSMISSIONMAP\n		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;\n	#endif\n	#ifdef USE_THICKNESSMAP\n		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;\n	#endif\n	vec3 pos = vWorldPosition;\n	vec3 v = normalize( cameraPosition - pos );\n	vec3 n = inverseTransformDirection( normal, viewMatrix );\n	vec4 transmitted = getIBLVolumeRefraction(\n		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,\n		pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,\n		material.attenuationColor, material.attenuationDistance );\n	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );\n	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );\n#endif";
  var transmission_pars_fragment = "#ifdef USE_TRANSMISSION\n	uniform float transmission;\n	uniform float thickness;\n	uniform float attenuationDistance;\n	uniform vec3 attenuationColor;\n	#ifdef USE_TRANSMISSIONMAP\n		uniform sampler2D transmissionMap;\n	#endif\n	#ifdef USE_THICKNESSMAP\n		uniform sampler2D thicknessMap;\n	#endif\n	uniform vec2 transmissionSamplerSize;\n	uniform sampler2D transmissionSamplerMap;\n	uniform mat4 modelMatrix;\n	uniform mat4 projectionMatrix;\n	varying vec3 vWorldPosition;\n	float w0( float a ) {\n		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );\n	}\n	float w1( float a ) {\n		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );\n	}\n	float w2( float a ){\n		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );\n	}\n	float w3( float a ) {\n		return ( 1.0 / 6.0 ) * ( a * a * a );\n	}\n	float g0( float a ) {\n		return w0( a ) + w1( a );\n	}\n	float g1( float a ) {\n		return w2( a ) + w3( a );\n	}\n	float h0( float a ) {\n		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );\n	}\n	float h1( float a ) {\n		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );\n	}\n	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {\n		uv = uv * texelSize.zw + 0.5;\n		vec2 iuv = floor( uv );\n		vec2 fuv = fract( uv );\n		float g0x = g0( fuv.x );\n		float g1x = g1( fuv.x );\n		float h0x = h0( fuv.x );\n		float h1x = h1( fuv.x );\n		float h0y = h0( fuv.y );\n		float h1y = h1( fuv.y );\n		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;\n		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;\n		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;\n		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;\n		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +\n			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );\n	}\n	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {\n		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );\n		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );\n		vec2 fLodSizeInv = 1.0 / fLodSize;\n		vec2 cLodSizeInv = 1.0 / cLodSize;\n		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );\n		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );\n		return mix( fSample, cSample, fract( lod ) );\n	}\n	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {\n		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );\n		vec3 modelScale;\n		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );\n		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );\n		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );\n		return normalize( refractionVector ) * thickness * modelScale;\n	}\n	float applyIorToRoughness( const in float roughness, const in float ior ) {\n		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );\n	}\n	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {\n		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );\n		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );\n	}\n	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {\n		if ( isinf( attenuationDistance ) ) {\n			return vec3( 1.0 );\n		} else {\n			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;\n			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;\n		}\n	}\n	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,\n		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,\n		const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,\n		const in vec3 attenuationColor, const in float attenuationDistance ) {\n		vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );\n		vec3 refractedRayExit = position + transmissionRay;\n		vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );\n		vec2 refractionCoords = ndcPos.xy / ndcPos.w;\n		refractionCoords += 1.0;\n		refractionCoords /= 2.0;\n		vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );\n		vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );\n		vec3 attenuatedColor = transmittance * transmittedLight.rgb;\n		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );\n		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;\n		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );\n	}\n#endif";
  var uv_pars_fragment = "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	varying vec2 vUv;\n#endif\n#ifdef USE_MAP\n	varying vec2 vMapUv;\n#endif\n#ifdef USE_ALPHAMAP\n	varying vec2 vAlphaMapUv;\n#endif\n#ifdef USE_LIGHTMAP\n	varying vec2 vLightMapUv;\n#endif\n#ifdef USE_AOMAP\n	varying vec2 vAoMapUv;\n#endif\n#ifdef USE_BUMPMAP\n	varying vec2 vBumpMapUv;\n#endif\n#ifdef USE_NORMALMAP\n	varying vec2 vNormalMapUv;\n#endif\n#ifdef USE_EMISSIVEMAP\n	varying vec2 vEmissiveMapUv;\n#endif\n#ifdef USE_METALNESSMAP\n	varying vec2 vMetalnessMapUv;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	varying vec2 vRoughnessMapUv;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	varying vec2 vAnisotropyMapUv;\n#endif\n#ifdef USE_CLEARCOATMAP\n	varying vec2 vClearcoatMapUv;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	varying vec2 vClearcoatNormalMapUv;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	varying vec2 vClearcoatRoughnessMapUv;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	varying vec2 vIridescenceMapUv;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	varying vec2 vIridescenceThicknessMapUv;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	varying vec2 vSheenColorMapUv;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	varying vec2 vSheenRoughnessMapUv;\n#endif\n#ifdef USE_SPECULARMAP\n	varying vec2 vSpecularMapUv;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	varying vec2 vSpecularColorMapUv;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	varying vec2 vSpecularIntensityMapUv;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	uniform mat3 transmissionMapTransform;\n	varying vec2 vTransmissionMapUv;\n#endif\n#ifdef USE_THICKNESSMAP\n	uniform mat3 thicknessMapTransform;\n	varying vec2 vThicknessMapUv;\n#endif";
  var uv_pars_vertex = "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	varying vec2 vUv;\n#endif\n#ifdef USE_MAP\n	uniform mat3 mapTransform;\n	varying vec2 vMapUv;\n#endif\n#ifdef USE_ALPHAMAP\n	uniform mat3 alphaMapTransform;\n	varying vec2 vAlphaMapUv;\n#endif\n#ifdef USE_LIGHTMAP\n	uniform mat3 lightMapTransform;\n	varying vec2 vLightMapUv;\n#endif\n#ifdef USE_AOMAP\n	uniform mat3 aoMapTransform;\n	varying vec2 vAoMapUv;\n#endif\n#ifdef USE_BUMPMAP\n	uniform mat3 bumpMapTransform;\n	varying vec2 vBumpMapUv;\n#endif\n#ifdef USE_NORMALMAP\n	uniform mat3 normalMapTransform;\n	varying vec2 vNormalMapUv;\n#endif\n#ifdef USE_DISPLACEMENTMAP\n	uniform mat3 displacementMapTransform;\n	varying vec2 vDisplacementMapUv;\n#endif\n#ifdef USE_EMISSIVEMAP\n	uniform mat3 emissiveMapTransform;\n	varying vec2 vEmissiveMapUv;\n#endif\n#ifdef USE_METALNESSMAP\n	uniform mat3 metalnessMapTransform;\n	varying vec2 vMetalnessMapUv;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	uniform mat3 roughnessMapTransform;\n	varying vec2 vRoughnessMapUv;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	uniform mat3 anisotropyMapTransform;\n	varying vec2 vAnisotropyMapUv;\n#endif\n#ifdef USE_CLEARCOATMAP\n	uniform mat3 clearcoatMapTransform;\n	varying vec2 vClearcoatMapUv;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	uniform mat3 clearcoatNormalMapTransform;\n	varying vec2 vClearcoatNormalMapUv;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	uniform mat3 clearcoatRoughnessMapTransform;\n	varying vec2 vClearcoatRoughnessMapUv;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	uniform mat3 sheenColorMapTransform;\n	varying vec2 vSheenColorMapUv;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	uniform mat3 sheenRoughnessMapTransform;\n	varying vec2 vSheenRoughnessMapUv;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	uniform mat3 iridescenceMapTransform;\n	varying vec2 vIridescenceMapUv;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	uniform mat3 iridescenceThicknessMapTransform;\n	varying vec2 vIridescenceThicknessMapUv;\n#endif\n#ifdef USE_SPECULARMAP\n	uniform mat3 specularMapTransform;\n	varying vec2 vSpecularMapUv;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	uniform mat3 specularColorMapTransform;\n	varying vec2 vSpecularColorMapUv;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	uniform mat3 specularIntensityMapTransform;\n	varying vec2 vSpecularIntensityMapUv;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	uniform mat3 transmissionMapTransform;\n	varying vec2 vTransmissionMapUv;\n#endif\n#ifdef USE_THICKNESSMAP\n	uniform mat3 thicknessMapTransform;\n	varying vec2 vThicknessMapUv;\n#endif";
  var uv_vertex = "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	vUv = vec3( uv, 1 ).xy;\n#endif\n#ifdef USE_MAP\n	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ALPHAMAP\n	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_LIGHTMAP\n	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_AOMAP\n	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_BUMPMAP\n	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_NORMALMAP\n	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_DISPLACEMENTMAP\n	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_EMISSIVEMAP\n	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_METALNESSMAP\n	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOATMAP\n	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULARMAP\n	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_THICKNESSMAP\n	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;\n#endif";
  var worldpos_vertex = "#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0\n	vec4 worldPosition = vec4( transformed, 1.0 );\n	#ifdef USE_BATCHING\n		worldPosition = batchingMatrix * worldPosition;\n	#endif\n	#ifdef USE_INSTANCING\n		worldPosition = instanceMatrix * worldPosition;\n	#endif\n	worldPosition = modelMatrix * worldPosition;\n#endif";
  var vertex$h = "varying vec2 vUv;\nuniform mat3 uvTransform;\nvoid main() {\n	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n	gl_Position = vec4( position.xy, 1.0, 1.0 );\n}";
  var fragment$h = "uniform sampler2D t2D;\nuniform float backgroundIntensity;\nvarying vec2 vUv;\nvoid main() {\n	vec4 texColor = texture2D( t2D, vUv );\n	#ifdef DECODE_VIDEO_TEXTURE\n		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );\n	#endif\n	texColor.rgb *= backgroundIntensity;\n	gl_FragColor = texColor;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}";
  var vertex$g = "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n	gl_Position.z = gl_Position.w;\n}";
  var fragment$g = "#ifdef ENVMAP_TYPE_CUBE\n	uniform samplerCube envMap;\n#elif defined( ENVMAP_TYPE_CUBE_UV )\n	uniform sampler2D envMap;\n#endif\nuniform float flipEnvMap;\nuniform float backgroundBlurriness;\nuniform float backgroundIntensity;\nvarying vec3 vWorldDirection;\n#include <cube_uv_reflection_fragment>\nvoid main() {\n	#ifdef ENVMAP_TYPE_CUBE\n		vec4 texColor = textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );\n	#elif defined( ENVMAP_TYPE_CUBE_UV )\n		vec4 texColor = textureCubeUV( envMap, vWorldDirection, backgroundBlurriness );\n	#else\n		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n	#endif\n	texColor.rgb *= backgroundIntensity;\n	gl_FragColor = texColor;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}";
  var vertex$f = "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n	gl_Position.z = gl_Position.w;\n}";
  var fragment$f = "uniform samplerCube tCube;\nuniform float tFlip;\nuniform float opacity;\nvarying vec3 vWorldDirection;\nvoid main() {\n	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );\n	gl_FragColor = texColor;\n	gl_FragColor.a *= opacity;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}";
  var vertex$e = "#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvarying vec2 vHighPrecisionZW;\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <skinbase_vertex>\n	#ifdef USE_DISPLACEMENTMAP\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vHighPrecisionZW = gl_Position.zw;\n}";
  var fragment$e = "#if DEPTH_PACKING == 3200\n	uniform float opacity;\n#endif\n#include <common>\n#include <packing>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvarying vec2 vHighPrecisionZW;\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( 1.0 );\n	#if DEPTH_PACKING == 3200\n		diffuseColor.a = opacity;\n	#endif\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <logdepthbuf_fragment>\n	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;\n	#if DEPTH_PACKING == 3200\n		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );\n	#elif DEPTH_PACKING == 3201\n		gl_FragColor = packDepthToRGBA( fragCoordZ );\n	#endif\n}";
  var vertex$d = "#define DISTANCE\nvarying vec3 vWorldPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <skinbase_vertex>\n	#ifdef USE_DISPLACEMENTMAP\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <worldpos_vertex>\n	#include <clipping_planes_vertex>\n	vWorldPosition = worldPosition.xyz;\n}";
  var fragment$d = "#define DISTANCE\nuniform vec3 referencePosition;\nuniform float nearDistance;\nuniform float farDistance;\nvarying vec3 vWorldPosition;\n#include <common>\n#include <packing>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main () {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( 1.0 );\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	float dist = length( vWorldPosition - referencePosition );\n	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );\n	dist = saturate( dist );\n	gl_FragColor = packDepthToRGBA( dist );\n}";
  var vertex$c = "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n}";
  var fragment$c = "uniform sampler2D tEquirect;\nvarying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vec3 direction = normalize( vWorldDirection );\n	vec2 sampleUV = equirectUv( direction );\n	gl_FragColor = texture2D( tEquirect, sampleUV );\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}";
  var vertex$b = "uniform float scale;\nattribute float lineDistance;\nvarying float vLineDistance;\n#include <common>\n#include <uv_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	vLineDistance = scale * lineDistance;\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n}";
  var fragment$b = "uniform vec3 diffuse;\nuniform float opacity;\nuniform float dashSize;\nuniform float totalSize;\nvarying float vLineDistance;\n#include <common>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	if ( mod( vLineDistance, totalSize ) > dashSize ) {\n		discard;\n	}\n	vec3 outgoingLight = vec3( 0.0 );\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}";
  var vertex$a = "#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinbase_vertex>\n		#include <skinnormal_vertex>\n		#include <defaultnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <fog_vertex>\n}";
  var fragment$a = "uniform vec3 diffuse;\nuniform float opacity;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	#ifdef USE_LIGHTMAP\n		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;\n	#else\n		reflectedLight.indirectDiffuse += vec3( 1.0 );\n	#endif\n	#include <aomap_fragment>\n	reflectedLight.indirectDiffuse *= diffuseColor.rgb;\n	vec3 outgoingLight = reflectedLight.indirectDiffuse;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
  var vertex$9 = "#define LAMBERT\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
  var fragment$9 = "#define LAMBERT\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_lambert_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_lambert_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
  var vertex$8 = "#define MATCAP\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <color_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n	vViewPosition = - mvPosition.xyz;\n}";
  var fragment$8 = "#define MATCAP\nuniform vec3 diffuse;\nuniform float opacity;\nuniform sampler2D matcap;\nvarying vec3 vViewPosition;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <normal_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	vec3 viewDir = normalize( vViewPosition );\n	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );\n	vec3 y = cross( viewDir, x );\n	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;\n	#ifdef USE_MATCAP\n		vec4 matcapColor = texture2D( matcap, uv );\n	#else\n		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );\n	#endif\n	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
  var vertex$7 = "#define NORMAL\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	varying vec3 vViewPosition;\n#endif\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	vViewPosition = - mvPosition.xyz;\n#endif\n}";
  var fragment$7 = "#define NORMAL\nuniform float opacity;\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	varying vec3 vViewPosition;\n#endif\n#include <packing>\n#include <uv_pars_fragment>\n#include <normal_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	#include <logdepthbuf_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );\n	#ifdef OPAQUE\n		gl_FragColor.a = 1.0;\n	#endif\n}";
  var vertex$6 = "#define PHONG\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
  var fragment$6 = "#define PHONG\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform vec3 specular;\nuniform float shininess;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_phong_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_phong_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
  var vertex$5 = "#define STANDARD\nvarying vec3 vViewPosition;\n#ifdef USE_TRANSMISSION\n	varying vec3 vWorldPosition;\n#endif\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n#ifdef USE_TRANSMISSION\n	vWorldPosition = worldPosition.xyz;\n#endif\n}";
  var fragment$5 = "#define STANDARD\n#ifdef PHYSICAL\n	#define IOR\n	#define USE_SPECULAR\n#endif\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float roughness;\nuniform float metalness;\nuniform float opacity;\n#ifdef IOR\n	uniform float ior;\n#endif\n#ifdef USE_SPECULAR\n	uniform float specularIntensity;\n	uniform vec3 specularColor;\n	#ifdef USE_SPECULAR_COLORMAP\n		uniform sampler2D specularColorMap;\n	#endif\n	#ifdef USE_SPECULAR_INTENSITYMAP\n		uniform sampler2D specularIntensityMap;\n	#endif\n#endif\n#ifdef USE_CLEARCOAT\n	uniform float clearcoat;\n	uniform float clearcoatRoughness;\n#endif\n#ifdef USE_IRIDESCENCE\n	uniform float iridescence;\n	uniform float iridescenceIOR;\n	uniform float iridescenceThicknessMinimum;\n	uniform float iridescenceThicknessMaximum;\n#endif\n#ifdef USE_SHEEN\n	uniform vec3 sheenColor;\n	uniform float sheenRoughness;\n	#ifdef USE_SHEEN_COLORMAP\n		uniform sampler2D sheenColorMap;\n	#endif\n	#ifdef USE_SHEEN_ROUGHNESSMAP\n		uniform sampler2D sheenRoughnessMap;\n	#endif\n#endif\n#ifdef USE_ANISOTROPY\n	uniform vec2 anisotropyVector;\n	#ifdef USE_ANISOTROPYMAP\n		uniform sampler2D anisotropyMap;\n	#endif\n#endif\nvarying vec3 vViewPosition;\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <iridescence_fragment>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_physical_pars_fragment>\n#include <transmission_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <clearcoat_pars_fragment>\n#include <iridescence_pars_fragment>\n#include <roughnessmap_pars_fragment>\n#include <metalnessmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <roughnessmap_fragment>\n	#include <metalnessmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <clearcoat_normal_fragment_begin>\n	#include <clearcoat_normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_physical_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;\n	#include <transmission_fragment>\n	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\n	#ifdef USE_SHEEN\n		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );\n		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;\n	#endif\n	#ifdef USE_CLEARCOAT\n		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );\n		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );\n		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;\n	#endif\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
  var vertex$4 = "#define TOON\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
  var fragment$4 = "#define TOON\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <gradientmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_toon_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_toon_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
  var vertex$3 = "uniform float size;\nuniform float scale;\n#include <common>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n#ifdef USE_POINTS_UV\n	varying vec2 vUv;\n	uniform mat3 uvTransform;\n#endif\nvoid main() {\n	#ifdef USE_POINTS_UV\n		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n	#endif\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <project_vertex>\n	gl_PointSize = size;\n	#ifdef USE_SIZEATTENUATION\n		bool isPerspective = isPerspectiveMatrix( projectionMatrix );\n		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );\n	#endif\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <worldpos_vertex>\n	#include <fog_vertex>\n}";
  var fragment$3 = "uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <color_pars_fragment>\n#include <map_particle_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec3 outgoingLight = vec3( 0.0 );\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_particle_fragment>\n	#include <color_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}";
  var vertex$2 = "#include <common>\n#include <batching_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <shadowmap_pars_vertex>\nvoid main() {\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
  var fragment$2 = "uniform vec3 color;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <logdepthbuf_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\nvoid main() {\n	#include <logdepthbuf_fragment>\n	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n}";
  var vertex$1 = "uniform float rotation;\nuniform vec2 center;\n#include <common>\n#include <uv_pars_vertex>\n#include <fog_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );\n	vec2 scale;\n	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );\n	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );\n	#ifndef USE_SIZEATTENUATION\n		bool isPerspective = isPerspectiveMatrix( projectionMatrix );\n		if ( isPerspective ) scale *= - mvPosition.z;\n	#endif\n	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;\n	vec2 rotatedPosition;\n	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;\n	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;\n	mvPosition.xy += rotatedPosition;\n	gl_Position = projectionMatrix * mvPosition;\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n}";
  var fragment$1 = "uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec3 outgoingLight = vec3( 0.0 );\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n}";
  var ShaderChunk = {
    alphahash_fragment,
    alphahash_pars_fragment,
    alphamap_fragment,
    alphamap_pars_fragment,
    alphatest_fragment,
    alphatest_pars_fragment,
    aomap_fragment,
    aomap_pars_fragment,
    batching_pars_vertex,
    batching_vertex,
    begin_vertex,
    beginnormal_vertex,
    bsdfs,
    iridescence_fragment,
    bumpmap_pars_fragment,
    clipping_planes_fragment,
    clipping_planes_pars_fragment,
    clipping_planes_pars_vertex,
    clipping_planes_vertex,
    color_fragment,
    color_pars_fragment,
    color_pars_vertex,
    color_vertex,
    common,
    cube_uv_reflection_fragment,
    defaultnormal_vertex,
    displacementmap_pars_vertex,
    displacementmap_vertex,
    emissivemap_fragment,
    emissivemap_pars_fragment,
    colorspace_fragment,
    colorspace_pars_fragment,
    envmap_fragment,
    envmap_common_pars_fragment,
    envmap_pars_fragment,
    envmap_pars_vertex,
    envmap_physical_pars_fragment,
    envmap_vertex,
    fog_vertex,
    fog_pars_vertex,
    fog_fragment,
    fog_pars_fragment,
    gradientmap_pars_fragment,
    lightmap_fragment,
    lightmap_pars_fragment,
    lights_lambert_fragment,
    lights_lambert_pars_fragment,
    lights_pars_begin,
    lights_toon_fragment,
    lights_toon_pars_fragment,
    lights_phong_fragment,
    lights_phong_pars_fragment,
    lights_physical_fragment,
    lights_physical_pars_fragment,
    lights_fragment_begin,
    lights_fragment_maps,
    lights_fragment_end,
    logdepthbuf_fragment,
    logdepthbuf_pars_fragment,
    logdepthbuf_pars_vertex,
    logdepthbuf_vertex,
    map_fragment,
    map_pars_fragment,
    map_particle_fragment,
    map_particle_pars_fragment,
    metalnessmap_fragment,
    metalnessmap_pars_fragment,
    morphcolor_vertex,
    morphnormal_vertex,
    morphtarget_pars_vertex,
    morphtarget_vertex,
    normal_fragment_begin,
    normal_fragment_maps,
    normal_pars_fragment,
    normal_pars_vertex,
    normal_vertex,
    normalmap_pars_fragment,
    clearcoat_normal_fragment_begin,
    clearcoat_normal_fragment_maps,
    clearcoat_pars_fragment,
    iridescence_pars_fragment,
    opaque_fragment,
    packing,
    premultiplied_alpha_fragment,
    project_vertex,
    dithering_fragment,
    dithering_pars_fragment,
    roughnessmap_fragment,
    roughnessmap_pars_fragment,
    shadowmap_pars_fragment,
    shadowmap_pars_vertex,
    shadowmap_vertex,
    shadowmask_pars_fragment,
    skinbase_vertex,
    skinning_pars_vertex,
    skinning_vertex,
    skinnormal_vertex,
    specularmap_fragment,
    specularmap_pars_fragment,
    tonemapping_fragment,
    tonemapping_pars_fragment,
    transmission_fragment,
    transmission_pars_fragment,
    uv_pars_fragment,
    uv_pars_vertex,
    uv_vertex,
    worldpos_vertex,
    background_vert: vertex$h,
    background_frag: fragment$h,
    backgroundCube_vert: vertex$g,
    backgroundCube_frag: fragment$g,
    cube_vert: vertex$f,
    cube_frag: fragment$f,
    depth_vert: vertex$e,
    depth_frag: fragment$e,
    distanceRGBA_vert: vertex$d,
    distanceRGBA_frag: fragment$d,
    equirect_vert: vertex$c,
    equirect_frag: fragment$c,
    linedashed_vert: vertex$b,
    linedashed_frag: fragment$b,
    meshbasic_vert: vertex$a,
    meshbasic_frag: fragment$a,
    meshlambert_vert: vertex$9,
    meshlambert_frag: fragment$9,
    meshmatcap_vert: vertex$8,
    meshmatcap_frag: fragment$8,
    meshnormal_vert: vertex$7,
    meshnormal_frag: fragment$7,
    meshphong_vert: vertex$6,
    meshphong_frag: fragment$6,
    meshphysical_vert: vertex$5,
    meshphysical_frag: fragment$5,
    meshtoon_vert: vertex$4,
    meshtoon_frag: fragment$4,
    points_vert: vertex$3,
    points_frag: fragment$3,
    shadow_vert: vertex$2,
    shadow_frag: fragment$2,
    sprite_vert: vertex$1,
    sprite_frag: fragment$1
  };
  var UniformsLib = {
    common: {
      diffuse: { value: /* @__PURE__ */ new Color(16777215) },
      opacity: { value: 1 },
      map: { value: null },
      mapTransform: { value: /* @__PURE__ */ new Matrix3() },
      alphaMap: { value: null },
      alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      alphaTest: { value: 0 }
    },
    specularmap: {
      specularMap: { value: null },
      specularMapTransform: { value: /* @__PURE__ */ new Matrix3() }
    },
    envmap: {
      envMap: { value: null },
      flipEnvMap: { value: -1 },
      reflectivity: { value: 1 },
      // basic, lambert, phong
      ior: { value: 1.5 },
      // physical
      refractionRatio: { value: 0.98 }
      // basic, lambert, phong
    },
    aomap: {
      aoMap: { value: null },
      aoMapIntensity: { value: 1 },
      aoMapTransform: { value: /* @__PURE__ */ new Matrix3() }
    },
    lightmap: {
      lightMap: { value: null },
      lightMapIntensity: { value: 1 },
      lightMapTransform: { value: /* @__PURE__ */ new Matrix3() }
    },
    bumpmap: {
      bumpMap: { value: null },
      bumpMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      bumpScale: { value: 1 }
    },
    normalmap: {
      normalMap: { value: null },
      normalMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      normalScale: { value: /* @__PURE__ */ new Vector2(1, 1) }
    },
    displacementmap: {
      displacementMap: { value: null },
      displacementMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      displacementScale: { value: 1 },
      displacementBias: { value: 0 }
    },
    emissivemap: {
      emissiveMap: { value: null },
      emissiveMapTransform: { value: /* @__PURE__ */ new Matrix3() }
    },
    metalnessmap: {
      metalnessMap: { value: null },
      metalnessMapTransform: { value: /* @__PURE__ */ new Matrix3() }
    },
    roughnessmap: {
      roughnessMap: { value: null },
      roughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() }
    },
    gradientmap: {
      gradientMap: { value: null }
    },
    fog: {
      fogDensity: { value: 25e-5 },
      fogNear: { value: 1 },
      fogFar: { value: 2e3 },
      fogColor: { value: /* @__PURE__ */ new Color(16777215) }
    },
    lights: {
      ambientLightColor: { value: [] },
      lightProbe: { value: [] },
      directionalLights: { value: [], properties: {
        direction: {},
        color: {}
      } },
      directionalLightShadows: { value: [], properties: {
        shadowBias: {},
        shadowNormalBias: {},
        shadowRadius: {},
        shadowMapSize: {}
      } },
      directionalShadowMap: { value: [] },
      directionalShadowMatrix: { value: [] },
      spotLights: { value: [], properties: {
        color: {},
        position: {},
        direction: {},
        distance: {},
        coneCos: {},
        penumbraCos: {},
        decay: {}
      } },
      spotLightShadows: { value: [], properties: {
        shadowBias: {},
        shadowNormalBias: {},
        shadowRadius: {},
        shadowMapSize: {}
      } },
      spotLightMap: { value: [] },
      spotShadowMap: { value: [] },
      spotLightMatrix: { value: [] },
      pointLights: { value: [], properties: {
        color: {},
        position: {},
        decay: {},
        distance: {}
      } },
      pointLightShadows: { value: [], properties: {
        shadowBias: {},
        shadowNormalBias: {},
        shadowRadius: {},
        shadowMapSize: {},
        shadowCameraNear: {},
        shadowCameraFar: {}
      } },
      pointShadowMap: { value: [] },
      pointShadowMatrix: { value: [] },
      hemisphereLights: { value: [], properties: {
        direction: {},
        skyColor: {},
        groundColor: {}
      } },
      // TODO (abelnation): RectAreaLight BRDF data needs to be moved from example to main src
      rectAreaLights: { value: [], properties: {
        color: {},
        position: {},
        width: {},
        height: {}
      } },
      ltc_1: { value: null },
      ltc_2: { value: null }
    },
    points: {
      diffuse: { value: /* @__PURE__ */ new Color(16777215) },
      opacity: { value: 1 },
      size: { value: 1 },
      scale: { value: 1 },
      map: { value: null },
      alphaMap: { value: null },
      alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      alphaTest: { value: 0 },
      uvTransform: { value: /* @__PURE__ */ new Matrix3() }
    },
    sprite: {
      diffuse: { value: /* @__PURE__ */ new Color(16777215) },
      opacity: { value: 1 },
      center: { value: /* @__PURE__ */ new Vector2(0.5, 0.5) },
      rotation: { value: 0 },
      map: { value: null },
      mapTransform: { value: /* @__PURE__ */ new Matrix3() },
      alphaMap: { value: null },
      alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      alphaTest: { value: 0 }
    }
  };
  var ShaderLib = {
    basic: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.specularmap,
        UniformsLib.envmap,
        UniformsLib.aomap,
        UniformsLib.lightmap,
        UniformsLib.fog
      ]),
      vertexShader: ShaderChunk.meshbasic_vert,
      fragmentShader: ShaderChunk.meshbasic_frag
    },
    lambert: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.specularmap,
        UniformsLib.envmap,
        UniformsLib.aomap,
        UniformsLib.lightmap,
        UniformsLib.emissivemap,
        UniformsLib.bumpmap,
        UniformsLib.normalmap,
        UniformsLib.displacementmap,
        UniformsLib.fog,
        UniformsLib.lights,
        {
          emissive: { value: /* @__PURE__ */ new Color(0) }
        }
      ]),
      vertexShader: ShaderChunk.meshlambert_vert,
      fragmentShader: ShaderChunk.meshlambert_frag
    },
    phong: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.specularmap,
        UniformsLib.envmap,
        UniformsLib.aomap,
        UniformsLib.lightmap,
        UniformsLib.emissivemap,
        UniformsLib.bumpmap,
        UniformsLib.normalmap,
        UniformsLib.displacementmap,
        UniformsLib.fog,
        UniformsLib.lights,
        {
          emissive: { value: /* @__PURE__ */ new Color(0) },
          specular: { value: /* @__PURE__ */ new Color(1118481) },
          shininess: { value: 30 }
        }
      ]),
      vertexShader: ShaderChunk.meshphong_vert,
      fragmentShader: ShaderChunk.meshphong_frag
    },
    standard: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.envmap,
        UniformsLib.aomap,
        UniformsLib.lightmap,
        UniformsLib.emissivemap,
        UniformsLib.bumpmap,
        UniformsLib.normalmap,
        UniformsLib.displacementmap,
        UniformsLib.roughnessmap,
        UniformsLib.metalnessmap,
        UniformsLib.fog,
        UniformsLib.lights,
        {
          emissive: { value: /* @__PURE__ */ new Color(0) },
          roughness: { value: 1 },
          metalness: { value: 0 },
          envMapIntensity: { value: 1 }
          // temporary
        }
      ]),
      vertexShader: ShaderChunk.meshphysical_vert,
      fragmentShader: ShaderChunk.meshphysical_frag
    },
    toon: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.aomap,
        UniformsLib.lightmap,
        UniformsLib.emissivemap,
        UniformsLib.bumpmap,
        UniformsLib.normalmap,
        UniformsLib.displacementmap,
        UniformsLib.gradientmap,
        UniformsLib.fog,
        UniformsLib.lights,
        {
          emissive: { value: /* @__PURE__ */ new Color(0) }
        }
      ]),
      vertexShader: ShaderChunk.meshtoon_vert,
      fragmentShader: ShaderChunk.meshtoon_frag
    },
    matcap: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.bumpmap,
        UniformsLib.normalmap,
        UniformsLib.displacementmap,
        UniformsLib.fog,
        {
          matcap: { value: null }
        }
      ]),
      vertexShader: ShaderChunk.meshmatcap_vert,
      fragmentShader: ShaderChunk.meshmatcap_frag
    },
    points: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.points,
        UniformsLib.fog
      ]),
      vertexShader: ShaderChunk.points_vert,
      fragmentShader: ShaderChunk.points_frag
    },
    dashed: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.fog,
        {
          scale: { value: 1 },
          dashSize: { value: 1 },
          totalSize: { value: 2 }
        }
      ]),
      vertexShader: ShaderChunk.linedashed_vert,
      fragmentShader: ShaderChunk.linedashed_frag
    },
    depth: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.displacementmap
      ]),
      vertexShader: ShaderChunk.depth_vert,
      fragmentShader: ShaderChunk.depth_frag
    },
    normal: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.bumpmap,
        UniformsLib.normalmap,
        UniformsLib.displacementmap,
        {
          opacity: { value: 1 }
        }
      ]),
      vertexShader: ShaderChunk.meshnormal_vert,
      fragmentShader: ShaderChunk.meshnormal_frag
    },
    sprite: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.sprite,
        UniformsLib.fog
      ]),
      vertexShader: ShaderChunk.sprite_vert,
      fragmentShader: ShaderChunk.sprite_frag
    },
    background: {
      uniforms: {
        uvTransform: { value: /* @__PURE__ */ new Matrix3() },
        t2D: { value: null },
        backgroundIntensity: { value: 1 }
      },
      vertexShader: ShaderChunk.background_vert,
      fragmentShader: ShaderChunk.background_frag
    },
    backgroundCube: {
      uniforms: {
        envMap: { value: null },
        flipEnvMap: { value: -1 },
        backgroundBlurriness: { value: 0 },
        backgroundIntensity: { value: 1 }
      },
      vertexShader: ShaderChunk.backgroundCube_vert,
      fragmentShader: ShaderChunk.backgroundCube_frag
    },
    cube: {
      uniforms: {
        tCube: { value: null },
        tFlip: { value: -1 },
        opacity: { value: 1 }
      },
      vertexShader: ShaderChunk.cube_vert,
      fragmentShader: ShaderChunk.cube_frag
    },
    equirect: {
      uniforms: {
        tEquirect: { value: null }
      },
      vertexShader: ShaderChunk.equirect_vert,
      fragmentShader: ShaderChunk.equirect_frag
    },
    distanceRGBA: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.common,
        UniformsLib.displacementmap,
        {
          referencePosition: { value: /* @__PURE__ */ new Vector3() },
          nearDistance: { value: 1 },
          farDistance: { value: 1e3 }
        }
      ]),
      vertexShader: ShaderChunk.distanceRGBA_vert,
      fragmentShader: ShaderChunk.distanceRGBA_frag
    },
    shadow: {
      uniforms: /* @__PURE__ */ mergeUniforms([
        UniformsLib.lights,
        UniformsLib.fog,
        {
          color: { value: /* @__PURE__ */ new Color(0) },
          opacity: { value: 1 }
        }
      ]),
      vertexShader: ShaderChunk.shadow_vert,
      fragmentShader: ShaderChunk.shadow_frag
    }
  };
  ShaderLib.physical = {
    uniforms: /* @__PURE__ */ mergeUniforms([
      ShaderLib.standard.uniforms,
      {
        clearcoat: { value: 0 },
        clearcoatMap: { value: null },
        clearcoatMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        clearcoatNormalMap: { value: null },
        clearcoatNormalMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        clearcoatNormalScale: { value: /* @__PURE__ */ new Vector2(1, 1) },
        clearcoatRoughness: { value: 0 },
        clearcoatRoughnessMap: { value: null },
        clearcoatRoughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        iridescence: { value: 0 },
        iridescenceMap: { value: null },
        iridescenceMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        iridescenceIOR: { value: 1.3 },
        iridescenceThicknessMinimum: { value: 100 },
        iridescenceThicknessMaximum: { value: 400 },
        iridescenceThicknessMap: { value: null },
        iridescenceThicknessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        sheen: { value: 0 },
        sheenColor: { value: /* @__PURE__ */ new Color(0) },
        sheenColorMap: { value: null },
        sheenColorMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        sheenRoughness: { value: 1 },
        sheenRoughnessMap: { value: null },
        sheenRoughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        transmission: { value: 0 },
        transmissionMap: { value: null },
        transmissionMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        transmissionSamplerSize: { value: /* @__PURE__ */ new Vector2() },
        transmissionSamplerMap: { value: null },
        thickness: { value: 0 },
        thicknessMap: { value: null },
        thicknessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        attenuationDistance: { value: 0 },
        attenuationColor: { value: /* @__PURE__ */ new Color(0) },
        specularColor: { value: /* @__PURE__ */ new Color(1, 1, 1) },
        specularColorMap: { value: null },
        specularColorMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        specularIntensity: { value: 1 },
        specularIntensityMap: { value: null },
        specularIntensityMapTransform: { value: /* @__PURE__ */ new Matrix3() },
        anisotropyVector: { value: /* @__PURE__ */ new Vector2() },
        anisotropyMap: { value: null },
        anisotropyMapTransform: { value: /* @__PURE__ */ new Matrix3() }
      }
    ]),
    vertexShader: ShaderChunk.meshphysical_vert,
    fragmentShader: ShaderChunk.meshphysical_frag
  };
  var _rgb = { r: 0, b: 0, g: 0 };
  function WebGLBackground(renderer, cubemaps, cubeuvmaps, state, objects, alpha, premultipliedAlpha) {
    const clearColor = new Color(0);
    let clearAlpha = alpha === true ? 0 : 1;
    let planeMesh;
    let boxMesh;
    let currentBackground = null;
    let currentBackgroundVersion = 0;
    let currentTonemapping = null;
    function render(renderList, scene) {
      let forceClear = false;
      let background = scene.isScene === true ? scene.background : null;
      if (background && background.isTexture) {
        const usePMREM = scene.backgroundBlurriness > 0;
        background = (usePMREM ? cubeuvmaps : cubemaps).get(background);
      }
      if (background === null) {
        setClear(clearColor, clearAlpha);
      } else if (background && background.isColor) {
        setClear(background, 1);
        forceClear = true;
      }
      const environmentBlendMode = renderer.xr.getEnvironmentBlendMode();
      if (environmentBlendMode === "additive") {
        state.buffers.color.setClear(0, 0, 0, 1, premultipliedAlpha);
      } else if (environmentBlendMode === "alpha-blend") {
        state.buffers.color.setClear(0, 0, 0, 0, premultipliedAlpha);
      }
      if (renderer.autoClear || forceClear) {
        renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      }
      if (background && (background.isCubeTexture || background.mapping === CubeUVReflectionMapping)) {
        if (boxMesh === void 0) {
          boxMesh = new Mesh(
            new BoxGeometry(1, 1, 1),
            new ShaderMaterial({
              name: "BackgroundCubeMaterial",
              uniforms: cloneUniforms(ShaderLib.backgroundCube.uniforms),
              vertexShader: ShaderLib.backgroundCube.vertexShader,
              fragmentShader: ShaderLib.backgroundCube.fragmentShader,
              side: BackSide,
              depthTest: false,
              depthWrite: false,
              fog: false
            })
          );
          boxMesh.geometry.deleteAttribute("normal");
          boxMesh.geometry.deleteAttribute("uv");
          boxMesh.onBeforeRender = function(renderer2, scene2, camera) {
            this.matrixWorld.copyPosition(camera.matrixWorld);
          };
          Object.defineProperty(boxMesh.material, "envMap", {
            get: function() {
              return this.uniforms.envMap.value;
            }
          });
          objects.update(boxMesh);
        }
        boxMesh.material.uniforms.envMap.value = background;
        boxMesh.material.uniforms.flipEnvMap.value = background.isCubeTexture && background.isRenderTargetTexture === false ? -1 : 1;
        boxMesh.material.uniforms.backgroundBlurriness.value = scene.backgroundBlurriness;
        boxMesh.material.uniforms.backgroundIntensity.value = scene.backgroundIntensity;
        boxMesh.material.toneMapped = ColorManagement.getTransfer(background.colorSpace) !== SRGBTransfer;
        if (currentBackground !== background || currentBackgroundVersion !== background.version || currentTonemapping !== renderer.toneMapping) {
          boxMesh.material.needsUpdate = true;
          currentBackground = background;
          currentBackgroundVersion = background.version;
          currentTonemapping = renderer.toneMapping;
        }
        boxMesh.layers.enableAll();
        renderList.unshift(boxMesh, boxMesh.geometry, boxMesh.material, 0, 0, null);
      } else if (background && background.isTexture) {
        if (planeMesh === void 0) {
          planeMesh = new Mesh(
            new PlaneGeometry(2, 2),
            new ShaderMaterial({
              name: "BackgroundMaterial",
              uniforms: cloneUniforms(ShaderLib.background.uniforms),
              vertexShader: ShaderLib.background.vertexShader,
              fragmentShader: ShaderLib.background.fragmentShader,
              side: FrontSide,
              depthTest: false,
              depthWrite: false,
              fog: false
            })
          );
          planeMesh.geometry.deleteAttribute("normal");
          Object.defineProperty(planeMesh.material, "map", {
            get: function() {
              return this.uniforms.t2D.value;
            }
          });
          objects.update(planeMesh);
        }
        planeMesh.material.uniforms.t2D.value = background;
        planeMesh.material.uniforms.backgroundIntensity.value = scene.backgroundIntensity;
        planeMesh.material.toneMapped = ColorManagement.getTransfer(background.colorSpace) !== SRGBTransfer;
        if (background.matrixAutoUpdate === true) {
          background.updateMatrix();
        }
        planeMesh.material.uniforms.uvTransform.value.copy(background.matrix);
        if (currentBackground !== background || currentBackgroundVersion !== background.version || currentTonemapping !== renderer.toneMapping) {
          planeMesh.material.needsUpdate = true;
          currentBackground = background;
          currentBackgroundVersion = background.version;
          currentTonemapping = renderer.toneMapping;
        }
        planeMesh.layers.enableAll();
        renderList.unshift(planeMesh, planeMesh.geometry, planeMesh.material, 0, 0, null);
      }
    }
    function setClear(color, alpha2) {
      color.getRGB(_rgb, getUnlitUniformColorSpace(renderer));
      state.buffers.color.setClear(_rgb.r, _rgb.g, _rgb.b, alpha2, premultipliedAlpha);
    }
    return {
      getClearColor: function() {
        return clearColor;
      },
      setClearColor: function(color, alpha2 = 1) {
        clearColor.set(color);
        clearAlpha = alpha2;
        setClear(clearColor, clearAlpha);
      },
      getClearAlpha: function() {
        return clearAlpha;
      },
      setClearAlpha: function(alpha2) {
        clearAlpha = alpha2;
        setClear(clearColor, clearAlpha);
      },
      render
    };
  }
  function WebGLBindingStates(gl, extensions, attributes, capabilities) {
    const maxVertexAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    const extension = capabilities.isWebGL2 ? null : extensions.get("OES_vertex_array_object");
    const vaoAvailable = capabilities.isWebGL2 || extension !== null;
    const bindingStates = {};
    const defaultState = createBindingState(null);
    let currentState = defaultState;
    let forceUpdate = false;
    function setup(object, material, program, geometry, index) {
      let updateBuffers = false;
      if (vaoAvailable) {
        const state = getBindingState(geometry, program, material);
        if (currentState !== state) {
          currentState = state;
          bindVertexArrayObject(currentState.object);
        }
        updateBuffers = needsUpdate(object, geometry, program, index);
        if (updateBuffers) saveCache(object, geometry, program, index);
      } else {
        const wireframe = material.wireframe === true;
        if (currentState.geometry !== geometry.id || currentState.program !== program.id || currentState.wireframe !== wireframe) {
          currentState.geometry = geometry.id;
          currentState.program = program.id;
          currentState.wireframe = wireframe;
          updateBuffers = true;
        }
      }
      if (index !== null) {
        attributes.update(index, gl.ELEMENT_ARRAY_BUFFER);
      }
      if (updateBuffers || forceUpdate) {
        forceUpdate = false;
        setupVertexAttributes(object, material, program, geometry);
        if (index !== null) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, attributes.get(index).buffer);
        }
      }
    }
    function createVertexArrayObject() {
      if (capabilities.isWebGL2) return gl.createVertexArray();
      return extension.createVertexArrayOES();
    }
    function bindVertexArrayObject(vao) {
      if (capabilities.isWebGL2) return gl.bindVertexArray(vao);
      return extension.bindVertexArrayOES(vao);
    }
    function deleteVertexArrayObject(vao) {
      if (capabilities.isWebGL2) return gl.deleteVertexArray(vao);
      return extension.deleteVertexArrayOES(vao);
    }
    function getBindingState(geometry, program, material) {
      const wireframe = material.wireframe === true;
      let programMap = bindingStates[geometry.id];
      if (programMap === void 0) {
        programMap = {};
        bindingStates[geometry.id] = programMap;
      }
      let stateMap = programMap[program.id];
      if (stateMap === void 0) {
        stateMap = {};
        programMap[program.id] = stateMap;
      }
      let state = stateMap[wireframe];
      if (state === void 0) {
        state = createBindingState(createVertexArrayObject());
        stateMap[wireframe] = state;
      }
      return state;
    }
    function createBindingState(vao) {
      const newAttributes = [];
      const enabledAttributes = [];
      const attributeDivisors = [];
      for (let i = 0; i < maxVertexAttributes; i++) {
        newAttributes[i] = 0;
        enabledAttributes[i] = 0;
        attributeDivisors[i] = 0;
      }
      return {
        // for backward compatibility on non-VAO support browser
        geometry: null,
        program: null,
        wireframe: false,
        newAttributes,
        enabledAttributes,
        attributeDivisors,
        object: vao,
        attributes: {},
        index: null
      };
    }
    function needsUpdate(object, geometry, program, index) {
      const cachedAttributes = currentState.attributes;
      const geometryAttributes = geometry.attributes;
      let attributesNum = 0;
      const programAttributes = program.getAttributes();
      for (const name in programAttributes) {
        const programAttribute = programAttributes[name];
        if (programAttribute.location >= 0) {
          const cachedAttribute = cachedAttributes[name];
          let geometryAttribute = geometryAttributes[name];
          if (geometryAttribute === void 0) {
            if (name === "instanceMatrix" && object.instanceMatrix) geometryAttribute = object.instanceMatrix;
            if (name === "instanceColor" && object.instanceColor) geometryAttribute = object.instanceColor;
          }
          if (cachedAttribute === void 0) return true;
          if (cachedAttribute.attribute !== geometryAttribute) return true;
          if (geometryAttribute && cachedAttribute.data !== geometryAttribute.data) return true;
          attributesNum++;
        }
      }
      if (currentState.attributesNum !== attributesNum) return true;
      if (currentState.index !== index) return true;
      return false;
    }
    function saveCache(object, geometry, program, index) {
      const cache = {};
      const attributes2 = geometry.attributes;
      let attributesNum = 0;
      const programAttributes = program.getAttributes();
      for (const name in programAttributes) {
        const programAttribute = programAttributes[name];
        if (programAttribute.location >= 0) {
          let attribute = attributes2[name];
          if (attribute === void 0) {
            if (name === "instanceMatrix" && object.instanceMatrix) attribute = object.instanceMatrix;
            if (name === "instanceColor" && object.instanceColor) attribute = object.instanceColor;
          }
          const data = {};
          data.attribute = attribute;
          if (attribute && attribute.data) {
            data.data = attribute.data;
          }
          cache[name] = data;
          attributesNum++;
        }
      }
      currentState.attributes = cache;
      currentState.attributesNum = attributesNum;
      currentState.index = index;
    }
    function initAttributes() {
      const newAttributes = currentState.newAttributes;
      for (let i = 0, il = newAttributes.length; i < il; i++) {
        newAttributes[i] = 0;
      }
    }
    function enableAttribute(attribute) {
      enableAttributeAndDivisor(attribute, 0);
    }
    function enableAttributeAndDivisor(attribute, meshPerAttribute) {
      const newAttributes = currentState.newAttributes;
      const enabledAttributes = currentState.enabledAttributes;
      const attributeDivisors = currentState.attributeDivisors;
      newAttributes[attribute] = 1;
      if (enabledAttributes[attribute] === 0) {
        gl.enableVertexAttribArray(attribute);
        enabledAttributes[attribute] = 1;
      }
      if (attributeDivisors[attribute] !== meshPerAttribute) {
        const extension2 = capabilities.isWebGL2 ? gl : extensions.get("ANGLE_instanced_arrays");
        extension2[capabilities.isWebGL2 ? "vertexAttribDivisor" : "vertexAttribDivisorANGLE"](attribute, meshPerAttribute);
        attributeDivisors[attribute] = meshPerAttribute;
      }
    }
    function disableUnusedAttributes() {
      const newAttributes = currentState.newAttributes;
      const enabledAttributes = currentState.enabledAttributes;
      for (let i = 0, il = enabledAttributes.length; i < il; i++) {
        if (enabledAttributes[i] !== newAttributes[i]) {
          gl.disableVertexAttribArray(i);
          enabledAttributes[i] = 0;
        }
      }
    }
    function vertexAttribPointer(index, size, type, normalized, stride, offset, integer) {
      if (integer === true) {
        gl.vertexAttribIPointer(index, size, type, stride, offset);
      } else {
        gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
      }
    }
    function setupVertexAttributes(object, material, program, geometry) {
      if (capabilities.isWebGL2 === false && (object.isInstancedMesh || geometry.isInstancedBufferGeometry)) {
        if (extensions.get("ANGLE_instanced_arrays") === null) return;
      }
      initAttributes();
      const geometryAttributes = geometry.attributes;
      const programAttributes = program.getAttributes();
      const materialDefaultAttributeValues = material.defaultAttributeValues;
      for (const name in programAttributes) {
        const programAttribute = programAttributes[name];
        if (programAttribute.location >= 0) {
          let geometryAttribute = geometryAttributes[name];
          if (geometryAttribute === void 0) {
            if (name === "instanceMatrix" && object.instanceMatrix) geometryAttribute = object.instanceMatrix;
            if (name === "instanceColor" && object.instanceColor) geometryAttribute = object.instanceColor;
          }
          if (geometryAttribute !== void 0) {
            const normalized = geometryAttribute.normalized;
            const size = geometryAttribute.itemSize;
            const attribute = attributes.get(geometryAttribute);
            if (attribute === void 0) continue;
            const buffer = attribute.buffer;
            const type = attribute.type;
            const bytesPerElement = attribute.bytesPerElement;
            const integer = capabilities.isWebGL2 === true && (type === gl.INT || type === gl.UNSIGNED_INT || geometryAttribute.gpuType === IntType);
            if (geometryAttribute.isInterleavedBufferAttribute) {
              const data = geometryAttribute.data;
              const stride = data.stride;
              const offset = geometryAttribute.offset;
              if (data.isInstancedInterleavedBuffer) {
                for (let i = 0; i < programAttribute.locationSize; i++) {
                  enableAttributeAndDivisor(programAttribute.location + i, data.meshPerAttribute);
                }
                if (object.isInstancedMesh !== true && geometry._maxInstanceCount === void 0) {
                  geometry._maxInstanceCount = data.meshPerAttribute * data.count;
                }
              } else {
                for (let i = 0; i < programAttribute.locationSize; i++) {
                  enableAttribute(programAttribute.location + i);
                }
              }
              gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
              for (let i = 0; i < programAttribute.locationSize; i++) {
                vertexAttribPointer(
                  programAttribute.location + i,
                  size / programAttribute.locationSize,
                  type,
                  normalized,
                  stride * bytesPerElement,
                  (offset + size / programAttribute.locationSize * i) * bytesPerElement,
                  integer
                );
              }
            } else {
              if (geometryAttribute.isInstancedBufferAttribute) {
                for (let i = 0; i < programAttribute.locationSize; i++) {
                  enableAttributeAndDivisor(programAttribute.location + i, geometryAttribute.meshPerAttribute);
                }
                if (object.isInstancedMesh !== true && geometry._maxInstanceCount === void 0) {
                  geometry._maxInstanceCount = geometryAttribute.meshPerAttribute * geometryAttribute.count;
                }
              } else {
                for (let i = 0; i < programAttribute.locationSize; i++) {
                  enableAttribute(programAttribute.location + i);
                }
              }
              gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
              for (let i = 0; i < programAttribute.locationSize; i++) {
                vertexAttribPointer(
                  programAttribute.location + i,
                  size / programAttribute.locationSize,
                  type,
                  normalized,
                  size * bytesPerElement,
                  size / programAttribute.locationSize * i * bytesPerElement,
                  integer
                );
              }
            }
          } else if (materialDefaultAttributeValues !== void 0) {
            const value = materialDefaultAttributeValues[name];
            if (value !== void 0) {
              switch (value.length) {
                case 2:
                  gl.vertexAttrib2fv(programAttribute.location, value);
                  break;
                case 3:
                  gl.vertexAttrib3fv(programAttribute.location, value);
                  break;
                case 4:
                  gl.vertexAttrib4fv(programAttribute.location, value);
                  break;
                default:
                  gl.vertexAttrib1fv(programAttribute.location, value);
              }
            }
          }
        }
      }
      disableUnusedAttributes();
    }
    function dispose() {
      reset();
      for (const geometryId in bindingStates) {
        const programMap = bindingStates[geometryId];
        for (const programId in programMap) {
          const stateMap = programMap[programId];
          for (const wireframe in stateMap) {
            deleteVertexArrayObject(stateMap[wireframe].object);
            delete stateMap[wireframe];
          }
          delete programMap[programId];
        }
        delete bindingStates[geometryId];
      }
    }
    function releaseStatesOfGeometry(geometry) {
      if (bindingStates[geometry.id] === void 0) return;
      const programMap = bindingStates[geometry.id];
      for (const programId in programMap) {
        const stateMap = programMap[programId];
        for (const wireframe in stateMap) {
          deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[programId];
      }
      delete bindingStates[geometry.id];
    }
    function releaseStatesOfProgram(program) {
      for (const geometryId in bindingStates) {
        const programMap = bindingStates[geometryId];
        if (programMap[program.id] === void 0) continue;
        const stateMap = programMap[program.id];
        for (const wireframe in stateMap) {
          deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[program.id];
      }
    }
    function reset() {
      resetDefaultState();
      forceUpdate = true;
      if (currentState === defaultState) return;
      currentState = defaultState;
      bindVertexArrayObject(currentState.object);
    }
    function resetDefaultState() {
      defaultState.geometry = null;
      defaultState.program = null;
      defaultState.wireframe = false;
    }
    return {
      setup,
      reset,
      resetDefaultState,
      dispose,
      releaseStatesOfGeometry,
      releaseStatesOfProgram,
      initAttributes,
      enableAttribute,
      disableUnusedAttributes
    };
  }
  function WebGLBufferRenderer(gl, extensions, info, capabilities) {
    const isWebGL2 = capabilities.isWebGL2;
    let mode;
    function setMode(value) {
      mode = value;
    }
    function render(start, count) {
      gl.drawArrays(mode, start, count);
      info.update(count, mode, 1);
    }
    function renderInstances(start, count, primcount) {
      if (primcount === 0) return;
      let extension, methodName;
      if (isWebGL2) {
        extension = gl;
        methodName = "drawArraysInstanced";
      } else {
        extension = extensions.get("ANGLE_instanced_arrays");
        methodName = "drawArraysInstancedANGLE";
        if (extension === null) {
          console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");
          return;
        }
      }
      extension[methodName](mode, start, count, primcount);
      info.update(count, mode, primcount);
    }
    function renderMultiDraw(starts, counts, drawCount) {
      if (drawCount === 0) return;
      const extension = extensions.get("WEBGL_multi_draw");
      if (extension === null) {
        for (let i = 0; i < drawCount; i++) {
          this.render(starts[i], counts[i]);
        }
      } else {
        extension.multiDrawArraysWEBGL(mode, starts, 0, counts, 0, drawCount);
        let elementCount = 0;
        for (let i = 0; i < drawCount; i++) {
          elementCount += counts[i];
        }
        info.update(elementCount, mode, 1);
      }
    }
    this.setMode = setMode;
    this.render = render;
    this.renderInstances = renderInstances;
    this.renderMultiDraw = renderMultiDraw;
  }
  function WebGLCapabilities(gl, extensions, parameters) {
    let maxAnisotropy;
    function getMaxAnisotropy() {
      if (maxAnisotropy !== void 0) return maxAnisotropy;
      if (extensions.has("EXT_texture_filter_anisotropic") === true) {
        const extension = extensions.get("EXT_texture_filter_anisotropic");
        maxAnisotropy = gl.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      } else {
        maxAnisotropy = 0;
      }
      return maxAnisotropy;
    }
    function getMaxPrecision(precision2) {
      if (precision2 === "highp") {
        if (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT).precision > 0 && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0) {
          return "highp";
        }
        precision2 = "mediump";
      }
      if (precision2 === "mediump") {
        if (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT).precision > 0 && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision > 0) {
          return "mediump";
        }
      }
      return "lowp";
    }
    const isWebGL2 = typeof WebGL2RenderingContext !== "undefined" && gl.constructor.name === "WebGL2RenderingContext";
    let precision = parameters.precision !== void 0 ? parameters.precision : "highp";
    const maxPrecision = getMaxPrecision(precision);
    if (maxPrecision !== precision) {
      console.warn("THREE.WebGLRenderer:", precision, "not supported, using", maxPrecision, "instead.");
      precision = maxPrecision;
    }
    const drawBuffers = isWebGL2 || extensions.has("WEBGL_draw_buffers");
    const logarithmicDepthBuffer = parameters.logarithmicDepthBuffer === true;
    const maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    const maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxCubemapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    const maxAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    const maxVaryings = gl.getParameter(gl.MAX_VARYING_VECTORS);
    const maxFragmentUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    const vertexTextures = maxVertexTextures > 0;
    const floatFragmentTextures = isWebGL2 || extensions.has("OES_texture_float");
    const floatVertexTextures = vertexTextures && floatFragmentTextures;
    const maxSamples = isWebGL2 ? gl.getParameter(gl.MAX_SAMPLES) : 0;
    return {
      isWebGL2,
      drawBuffers,
      getMaxAnisotropy,
      getMaxPrecision,
      precision,
      logarithmicDepthBuffer,
      maxTextures,
      maxVertexTextures,
      maxTextureSize,
      maxCubemapSize,
      maxAttributes,
      maxVertexUniforms,
      maxVaryings,
      maxFragmentUniforms,
      vertexTextures,
      floatFragmentTextures,
      floatVertexTextures,
      maxSamples
    };
  }
  function WebGLClipping(properties) {
    const scope = this;
    let globalState = null, numGlobalPlanes = 0, localClippingEnabled = false, renderingShadows = false;
    const plane = new Plane(), viewNormalMatrix = new Matrix3(), uniform = { value: null, needsUpdate: false };
    this.uniform = uniform;
    this.numPlanes = 0;
    this.numIntersection = 0;
    this.init = function(planes, enableLocalClipping) {
      const enabled = planes.length !== 0 || enableLocalClipping || // enable state of previous frame - the clipping code has to
      // run another frame in order to reset the state:
      numGlobalPlanes !== 0 || localClippingEnabled;
      localClippingEnabled = enableLocalClipping;
      numGlobalPlanes = planes.length;
      return enabled;
    };
    this.beginShadows = function() {
      renderingShadows = true;
      projectPlanes(null);
    };
    this.endShadows = function() {
      renderingShadows = false;
    };
    this.setGlobalState = function(planes, camera) {
      globalState = projectPlanes(planes, camera, 0);
    };
    this.setState = function(material, camera, useCache) {
      const planes = material.clippingPlanes, clipIntersection = material.clipIntersection, clipShadows = material.clipShadows;
      const materialProperties = properties.get(material);
      if (!localClippingEnabled || planes === null || planes.length === 0 || renderingShadows && !clipShadows) {
        if (renderingShadows) {
          projectPlanes(null);
        } else {
          resetGlobalState();
        }
      } else {
        const nGlobal = renderingShadows ? 0 : numGlobalPlanes, lGlobal = nGlobal * 4;
        let dstArray = materialProperties.clippingState || null;
        uniform.value = dstArray;
        dstArray = projectPlanes(planes, camera, lGlobal, useCache);
        for (let i = 0; i !== lGlobal; ++i) {
          dstArray[i] = globalState[i];
        }
        materialProperties.clippingState = dstArray;
        this.numIntersection = clipIntersection ? this.numPlanes : 0;
        this.numPlanes += nGlobal;
      }
    };
    function resetGlobalState() {
      if (uniform.value !== globalState) {
        uniform.value = globalState;
        uniform.needsUpdate = numGlobalPlanes > 0;
      }
      scope.numPlanes = numGlobalPlanes;
      scope.numIntersection = 0;
    }
    function projectPlanes(planes, camera, dstOffset, skipTransform) {
      const nPlanes = planes !== null ? planes.length : 0;
      let dstArray = null;
      if (nPlanes !== 0) {
        dstArray = uniform.value;
        if (skipTransform !== true || dstArray === null) {
          const flatSize = dstOffset + nPlanes * 4, viewMatrix = camera.matrixWorldInverse;
          viewNormalMatrix.getNormalMatrix(viewMatrix);
          if (dstArray === null || dstArray.length < flatSize) {
            dstArray = new Float32Array(flatSize);
          }
          for (let i = 0, i4 = dstOffset; i !== nPlanes; ++i, i4 += 4) {
            plane.copy(planes[i]).applyMatrix4(viewMatrix, viewNormalMatrix);
            plane.normal.toArray(dstArray, i4);
            dstArray[i4 + 3] = plane.constant;
          }
        }
        uniform.value = dstArray;
        uniform.needsUpdate = true;
      }
      scope.numPlanes = nPlanes;
      scope.numIntersection = 0;
      return dstArray;
    }
  }
  function WebGLCubeMaps(renderer) {
    let cubemaps = /* @__PURE__ */ new WeakMap();
    function mapTextureMapping(texture, mapping) {
      if (mapping === EquirectangularReflectionMapping) {
        texture.mapping = CubeReflectionMapping;
      } else if (mapping === EquirectangularRefractionMapping) {
        texture.mapping = CubeRefractionMapping;
      }
      return texture;
    }
    function get(texture) {
      if (texture && texture.isTexture) {
        const mapping = texture.mapping;
        if (mapping === EquirectangularReflectionMapping || mapping === EquirectangularRefractionMapping) {
          if (cubemaps.has(texture)) {
            const cubemap = cubemaps.get(texture).texture;
            return mapTextureMapping(cubemap, texture.mapping);
          } else {
            const image = texture.image;
            if (image && image.height > 0) {
              const renderTarget = new WebGLCubeRenderTarget(image.height / 2);
              renderTarget.fromEquirectangularTexture(renderer, texture);
              cubemaps.set(texture, renderTarget);
              texture.addEventListener("dispose", onTextureDispose);
              return mapTextureMapping(renderTarget.texture, texture.mapping);
            } else {
              return null;
            }
          }
        }
      }
      return texture;
    }
    function onTextureDispose(event) {
      const texture = event.target;
      texture.removeEventListener("dispose", onTextureDispose);
      const cubemap = cubemaps.get(texture);
      if (cubemap !== void 0) {
        cubemaps.delete(texture);
        cubemap.dispose();
      }
    }
    function dispose() {
      cubemaps = /* @__PURE__ */ new WeakMap();
    }
    return {
      get,
      dispose
    };
  }
  var OrthographicCamera = class extends Camera {
    constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2e3) {
      super();
      this.isOrthographicCamera = true;
      this.type = "OrthographicCamera";
      this.zoom = 1;
      this.view = null;
      this.left = left;
      this.right = right;
      this.top = top;
      this.bottom = bottom;
      this.near = near;
      this.far = far;
      this.updateProjectionMatrix();
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.left = source.left;
      this.right = source.right;
      this.top = source.top;
      this.bottom = source.bottom;
      this.near = source.near;
      this.far = source.far;
      this.zoom = source.zoom;
      this.view = source.view === null ? null : Object.assign({}, source.view);
      return this;
    }
    setViewOffset(fullWidth, fullHeight, x, y, width, height) {
      if (this.view === null) {
        this.view = {
          enabled: true,
          fullWidth: 1,
          fullHeight: 1,
          offsetX: 0,
          offsetY: 0,
          width: 1,
          height: 1
        };
      }
      this.view.enabled = true;
      this.view.fullWidth = fullWidth;
      this.view.fullHeight = fullHeight;
      this.view.offsetX = x;
      this.view.offsetY = y;
      this.view.width = width;
      this.view.height = height;
      this.updateProjectionMatrix();
    }
    clearViewOffset() {
      if (this.view !== null) {
        this.view.enabled = false;
      }
      this.updateProjectionMatrix();
    }
    updateProjectionMatrix() {
      const dx = (this.right - this.left) / (2 * this.zoom);
      const dy = (this.top - this.bottom) / (2 * this.zoom);
      const cx = (this.right + this.left) / 2;
      const cy = (this.top + this.bottom) / 2;
      let left = cx - dx;
      let right = cx + dx;
      let top = cy + dy;
      let bottom = cy - dy;
      if (this.view !== null && this.view.enabled) {
        const scaleW = (this.right - this.left) / this.view.fullWidth / this.zoom;
        const scaleH = (this.top - this.bottom) / this.view.fullHeight / this.zoom;
        left += scaleW * this.view.offsetX;
        right = left + scaleW * this.view.width;
        top -= scaleH * this.view.offsetY;
        bottom = top - scaleH * this.view.height;
      }
      this.projectionMatrix.makeOrthographic(left, right, top, bottom, this.near, this.far, this.coordinateSystem);
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      data.object.zoom = this.zoom;
      data.object.left = this.left;
      data.object.right = this.right;
      data.object.top = this.top;
      data.object.bottom = this.bottom;
      data.object.near = this.near;
      data.object.far = this.far;
      if (this.view !== null) data.object.view = Object.assign({}, this.view);
      return data;
    }
  };
  var LOD_MIN = 4;
  var EXTRA_LOD_SIGMA = [0.125, 0.215, 0.35, 0.446, 0.526, 0.582];
  var MAX_SAMPLES = 20;
  var _flatCamera = /* @__PURE__ */ new OrthographicCamera();
  var _clearColor = /* @__PURE__ */ new Color();
  var _oldTarget = null;
  var _oldActiveCubeFace = 0;
  var _oldActiveMipmapLevel = 0;
  var PHI = (1 + Math.sqrt(5)) / 2;
  var INV_PHI = 1 / PHI;
  var _axisDirections = [
    /* @__PURE__ */ new Vector3(1, 1, 1),
    /* @__PURE__ */ new Vector3(-1, 1, 1),
    /* @__PURE__ */ new Vector3(1, 1, -1),
    /* @__PURE__ */ new Vector3(-1, 1, -1),
    /* @__PURE__ */ new Vector3(0, PHI, INV_PHI),
    /* @__PURE__ */ new Vector3(0, PHI, -INV_PHI),
    /* @__PURE__ */ new Vector3(INV_PHI, 0, PHI),
    /* @__PURE__ */ new Vector3(-INV_PHI, 0, PHI),
    /* @__PURE__ */ new Vector3(PHI, INV_PHI, 0),
    /* @__PURE__ */ new Vector3(-PHI, INV_PHI, 0)
  ];
  var PMREMGenerator = class {
    constructor(renderer) {
      this._renderer = renderer;
      this._pingPongRenderTarget = null;
      this._lodMax = 0;
      this._cubeSize = 0;
      this._lodPlanes = [];
      this._sizeLods = [];
      this._sigmas = [];
      this._blurMaterial = null;
      this._cubemapMaterial = null;
      this._equirectMaterial = null;
      this._compileMaterial(this._blurMaterial);
    }
    /**
     * Generates a PMREM from a supplied Scene, which can be faster than using an
     * image if networking bandwidth is low. Optional sigma specifies a blur radius
     * in radians to be applied to the scene before PMREM generation. Optional near
     * and far planes ensure the scene is rendered in its entirety (the cubeCamera
     * is placed at the origin).
     */
    fromScene(scene, sigma = 0, near = 0.1, far = 100) {
      _oldTarget = this._renderer.getRenderTarget();
      _oldActiveCubeFace = this._renderer.getActiveCubeFace();
      _oldActiveMipmapLevel = this._renderer.getActiveMipmapLevel();
      this._setSize(256);
      const cubeUVRenderTarget = this._allocateTargets();
      cubeUVRenderTarget.depthBuffer = true;
      this._sceneToCubeUV(scene, near, far, cubeUVRenderTarget);
      if (sigma > 0) {
        this._blur(cubeUVRenderTarget, 0, 0, sigma);
      }
      this._applyPMREM(cubeUVRenderTarget);
      this._cleanup(cubeUVRenderTarget);
      return cubeUVRenderTarget;
    }
    /**
     * Generates a PMREM from an equirectangular texture, which can be either LDR
     * or HDR. The ideal input image size is 1k (1024 x 512),
     * as this matches best with the 256 x 256 cubemap output.
     */
    fromEquirectangular(equirectangular, renderTarget = null) {
      return this._fromTexture(equirectangular, renderTarget);
    }
    /**
     * Generates a PMREM from an cubemap texture, which can be either LDR
     * or HDR. The ideal input cube size is 256 x 256,
     * as this matches best with the 256 x 256 cubemap output.
     */
    fromCubemap(cubemap, renderTarget = null) {
      return this._fromTexture(cubemap, renderTarget);
    }
    /**
     * Pre-compiles the cubemap shader. You can get faster start-up by invoking this method during
     * your texture's network fetch for increased concurrency.
     */
    compileCubemapShader() {
      if (this._cubemapMaterial === null) {
        this._cubemapMaterial = _getCubemapMaterial();
        this._compileMaterial(this._cubemapMaterial);
      }
    }
    /**
     * Pre-compiles the equirectangular shader. You can get faster start-up by invoking this method during
     * your texture's network fetch for increased concurrency.
     */
    compileEquirectangularShader() {
      if (this._equirectMaterial === null) {
        this._equirectMaterial = _getEquirectMaterial();
        this._compileMaterial(this._equirectMaterial);
      }
    }
    /**
     * Disposes of the PMREMGenerator's internal memory. Note that PMREMGenerator is a static class,
     * so you should not need more than one PMREMGenerator object. If you do, calling dispose() on
     * one of them will cause any others to also become unusable.
     */
    dispose() {
      this._dispose();
      if (this._cubemapMaterial !== null) this._cubemapMaterial.dispose();
      if (this._equirectMaterial !== null) this._equirectMaterial.dispose();
    }
    // private interface
    _setSize(cubeSize) {
      this._lodMax = Math.floor(Math.log2(cubeSize));
      this._cubeSize = Math.pow(2, this._lodMax);
    }
    _dispose() {
      if (this._blurMaterial !== null) this._blurMaterial.dispose();
      if (this._pingPongRenderTarget !== null) this._pingPongRenderTarget.dispose();
      for (let i = 0; i < this._lodPlanes.length; i++) {
        this._lodPlanes[i].dispose();
      }
    }
    _cleanup(outputTarget) {
      this._renderer.setRenderTarget(_oldTarget, _oldActiveCubeFace, _oldActiveMipmapLevel);
      outputTarget.scissorTest = false;
      _setViewport(outputTarget, 0, 0, outputTarget.width, outputTarget.height);
    }
    _fromTexture(texture, renderTarget) {
      if (texture.mapping === CubeReflectionMapping || texture.mapping === CubeRefractionMapping) {
        this._setSize(texture.image.length === 0 ? 16 : texture.image[0].width || texture.image[0].image.width);
      } else {
        this._setSize(texture.image.width / 4);
      }
      _oldTarget = this._renderer.getRenderTarget();
      _oldActiveCubeFace = this._renderer.getActiveCubeFace();
      _oldActiveMipmapLevel = this._renderer.getActiveMipmapLevel();
      const cubeUVRenderTarget = renderTarget || this._allocateTargets();
      this._textureToCubeUV(texture, cubeUVRenderTarget);
      this._applyPMREM(cubeUVRenderTarget);
      this._cleanup(cubeUVRenderTarget);
      return cubeUVRenderTarget;
    }
    _allocateTargets() {
      const width = 3 * Math.max(this._cubeSize, 16 * 7);
      const height = 4 * this._cubeSize;
      const params = {
        magFilter: LinearFilter,
        minFilter: LinearFilter,
        generateMipmaps: false,
        type: HalfFloatType,
        format: RGBAFormat,
        colorSpace: LinearSRGBColorSpace,
        depthBuffer: false
      };
      const cubeUVRenderTarget = _createRenderTarget(width, height, params);
      if (this._pingPongRenderTarget === null || this._pingPongRenderTarget.width !== width || this._pingPongRenderTarget.height !== height) {
        if (this._pingPongRenderTarget !== null) {
          this._dispose();
        }
        this._pingPongRenderTarget = _createRenderTarget(width, height, params);
        const { _lodMax } = this;
        ({ sizeLods: this._sizeLods, lodPlanes: this._lodPlanes, sigmas: this._sigmas } = _createPlanes(_lodMax));
        this._blurMaterial = _getBlurShader(_lodMax, width, height);
      }
      return cubeUVRenderTarget;
    }
    _compileMaterial(material) {
      const tmpMesh = new Mesh(this._lodPlanes[0], material);
      this._renderer.compile(tmpMesh, _flatCamera);
    }
    _sceneToCubeUV(scene, near, far, cubeUVRenderTarget) {
      const fov2 = 90;
      const aspect2 = 1;
      const cubeCamera = new PerspectiveCamera(fov2, aspect2, near, far);
      const upSign = [1, -1, 1, 1, 1, 1];
      const forwardSign = [1, 1, 1, -1, -1, -1];
      const renderer = this._renderer;
      const originalAutoClear = renderer.autoClear;
      const toneMapping = renderer.toneMapping;
      renderer.getClearColor(_clearColor);
      renderer.toneMapping = NoToneMapping;
      renderer.autoClear = false;
      const backgroundMaterial = new MeshBasicMaterial({
        name: "PMREM.Background",
        side: BackSide,
        depthWrite: false,
        depthTest: false
      });
      const backgroundBox = new Mesh(new BoxGeometry(), backgroundMaterial);
      let useSolidColor = false;
      const background = scene.background;
      if (background) {
        if (background.isColor) {
          backgroundMaterial.color.copy(background);
          scene.background = null;
          useSolidColor = true;
        }
      } else {
        backgroundMaterial.color.copy(_clearColor);
        useSolidColor = true;
      }
      for (let i = 0; i < 6; i++) {
        const col = i % 3;
        if (col === 0) {
          cubeCamera.up.set(0, upSign[i], 0);
          cubeCamera.lookAt(forwardSign[i], 0, 0);
        } else if (col === 1) {
          cubeCamera.up.set(0, 0, upSign[i]);
          cubeCamera.lookAt(0, forwardSign[i], 0);
        } else {
          cubeCamera.up.set(0, upSign[i], 0);
          cubeCamera.lookAt(0, 0, forwardSign[i]);
        }
        const size = this._cubeSize;
        _setViewport(cubeUVRenderTarget, col * size, i > 2 ? size : 0, size, size);
        renderer.setRenderTarget(cubeUVRenderTarget);
        if (useSolidColor) {
          renderer.render(backgroundBox, cubeCamera);
        }
        renderer.render(scene, cubeCamera);
      }
      backgroundBox.geometry.dispose();
      backgroundBox.material.dispose();
      renderer.toneMapping = toneMapping;
      renderer.autoClear = originalAutoClear;
      scene.background = background;
    }
    _textureToCubeUV(texture, cubeUVRenderTarget) {
      const renderer = this._renderer;
      const isCubeTexture = texture.mapping === CubeReflectionMapping || texture.mapping === CubeRefractionMapping;
      if (isCubeTexture) {
        if (this._cubemapMaterial === null) {
          this._cubemapMaterial = _getCubemapMaterial();
        }
        this._cubemapMaterial.uniforms.flipEnvMap.value = texture.isRenderTargetTexture === false ? -1 : 1;
      } else {
        if (this._equirectMaterial === null) {
          this._equirectMaterial = _getEquirectMaterial();
        }
      }
      const material = isCubeTexture ? this._cubemapMaterial : this._equirectMaterial;
      const mesh = new Mesh(this._lodPlanes[0], material);
      const uniforms = material.uniforms;
      uniforms["envMap"].value = texture;
      const size = this._cubeSize;
      _setViewport(cubeUVRenderTarget, 0, 0, 3 * size, 2 * size);
      renderer.setRenderTarget(cubeUVRenderTarget);
      renderer.render(mesh, _flatCamera);
    }
    _applyPMREM(cubeUVRenderTarget) {
      const renderer = this._renderer;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      for (let i = 1; i < this._lodPlanes.length; i++) {
        const sigma = Math.sqrt(this._sigmas[i] * this._sigmas[i] - this._sigmas[i - 1] * this._sigmas[i - 1]);
        const poleAxis = _axisDirections[(i - 1) % _axisDirections.length];
        this._blur(cubeUVRenderTarget, i - 1, i, sigma, poleAxis);
      }
      renderer.autoClear = autoClear;
    }
    /**
     * This is a two-pass Gaussian blur for a cubemap. Normally this is done
     * vertically and horizontally, but this breaks down on a cube. Here we apply
     * the blur latitudinally (around the poles), and then longitudinally (towards
     * the poles) to approximate the orthogonally-separable blur. It is least
     * accurate at the poles, but still does a decent job.
     */
    _blur(cubeUVRenderTarget, lodIn, lodOut, sigma, poleAxis) {
      const pingPongRenderTarget = this._pingPongRenderTarget;
      this._halfBlur(
        cubeUVRenderTarget,
        pingPongRenderTarget,
        lodIn,
        lodOut,
        sigma,
        "latitudinal",
        poleAxis
      );
      this._halfBlur(
        pingPongRenderTarget,
        cubeUVRenderTarget,
        lodOut,
        lodOut,
        sigma,
        "longitudinal",
        poleAxis
      );
    }
    _halfBlur(targetIn, targetOut, lodIn, lodOut, sigmaRadians, direction, poleAxis) {
      const renderer = this._renderer;
      const blurMaterial = this._blurMaterial;
      if (direction !== "latitudinal" && direction !== "longitudinal") {
        console.error(
          "blur direction must be either latitudinal or longitudinal!"
        );
      }
      const STANDARD_DEVIATIONS = 3;
      const blurMesh = new Mesh(this._lodPlanes[lodOut], blurMaterial);
      const blurUniforms = blurMaterial.uniforms;
      const pixels = this._sizeLods[lodIn] - 1;
      const radiansPerPixel = isFinite(sigmaRadians) ? Math.PI / (2 * pixels) : 2 * Math.PI / (2 * MAX_SAMPLES - 1);
      const sigmaPixels = sigmaRadians / radiansPerPixel;
      const samples = isFinite(sigmaRadians) ? 1 + Math.floor(STANDARD_DEVIATIONS * sigmaPixels) : MAX_SAMPLES;
      if (samples > MAX_SAMPLES) {
        console.warn(`sigmaRadians, ${sigmaRadians}, is too large and will clip, as it requested ${samples} samples when the maximum is set to ${MAX_SAMPLES}`);
      }
      const weights = [];
      let sum = 0;
      for (let i = 0; i < MAX_SAMPLES; ++i) {
        const x2 = i / sigmaPixels;
        const weight = Math.exp(-x2 * x2 / 2);
        weights.push(weight);
        if (i === 0) {
          sum += weight;
        } else if (i < samples) {
          sum += 2 * weight;
        }
      }
      for (let i = 0; i < weights.length; i++) {
        weights[i] = weights[i] / sum;
      }
      blurUniforms["envMap"].value = targetIn.texture;
      blurUniforms["samples"].value = samples;
      blurUniforms["weights"].value = weights;
      blurUniforms["latitudinal"].value = direction === "latitudinal";
      if (poleAxis) {
        blurUniforms["poleAxis"].value = poleAxis;
      }
      const { _lodMax } = this;
      blurUniforms["dTheta"].value = radiansPerPixel;
      blurUniforms["mipInt"].value = _lodMax - lodIn;
      const outputSize = this._sizeLods[lodOut];
      const x = 3 * outputSize * (lodOut > _lodMax - LOD_MIN ? lodOut - _lodMax + LOD_MIN : 0);
      const y = 4 * (this._cubeSize - outputSize);
      _setViewport(targetOut, x, y, 3 * outputSize, 2 * outputSize);
      renderer.setRenderTarget(targetOut);
      renderer.render(blurMesh, _flatCamera);
    }
  };
  function _createPlanes(lodMax) {
    const lodPlanes = [];
    const sizeLods = [];
    const sigmas = [];
    let lod = lodMax;
    const totalLods = lodMax - LOD_MIN + 1 + EXTRA_LOD_SIGMA.length;
    for (let i = 0; i < totalLods; i++) {
      const sizeLod = Math.pow(2, lod);
      sizeLods.push(sizeLod);
      let sigma = 1 / sizeLod;
      if (i > lodMax - LOD_MIN) {
        sigma = EXTRA_LOD_SIGMA[i - lodMax + LOD_MIN - 1];
      } else if (i === 0) {
        sigma = 0;
      }
      sigmas.push(sigma);
      const texelSize = 1 / (sizeLod - 2);
      const min = -texelSize;
      const max = 1 + texelSize;
