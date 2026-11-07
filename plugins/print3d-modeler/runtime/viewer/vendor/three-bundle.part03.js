      const uv1 = [min, min, max, min, max, max, min, min, max, max, min, max];
      const cubeFaces = 6;
      const vertices = 6;
      const positionSize = 3;
      const uvSize = 2;
      const faceIndexSize = 1;
      const position = new Float32Array(positionSize * vertices * cubeFaces);
      const uv = new Float32Array(uvSize * vertices * cubeFaces);
      const faceIndex = new Float32Array(faceIndexSize * vertices * cubeFaces);
      for (let face = 0; face < cubeFaces; face++) {
        const x = face % 3 * 2 / 3 - 1;
        const y = face > 2 ? 0 : -1;
        const coordinates = [
          x,
          y,
          0,
          x + 2 / 3,
          y,
          0,
          x + 2 / 3,
          y + 1,
          0,
          x,
          y,
          0,
          x + 2 / 3,
          y + 1,
          0,
          x,
          y + 1,
          0
        ];
        position.set(coordinates, positionSize * vertices * face);
        uv.set(uv1, uvSize * vertices * face);
        const fill = [face, face, face, face, face, face];
        faceIndex.set(fill, faceIndexSize * vertices * face);
      }
      const planes = new BufferGeometry();
      planes.setAttribute("position", new BufferAttribute(position, positionSize));
      planes.setAttribute("uv", new BufferAttribute(uv, uvSize));
      planes.setAttribute("faceIndex", new BufferAttribute(faceIndex, faceIndexSize));
      lodPlanes.push(planes);
      if (lod > LOD_MIN) {
        lod--;
      }
    }
    return { lodPlanes, sizeLods, sigmas };
  }
  function _createRenderTarget(width, height, params) {
    const cubeUVRenderTarget = new WebGLRenderTarget(width, height, params);
    cubeUVRenderTarget.texture.mapping = CubeUVReflectionMapping;
    cubeUVRenderTarget.texture.name = "PMREM.cubeUv";
    cubeUVRenderTarget.scissorTest = true;
    return cubeUVRenderTarget;
  }
  function _setViewport(target, x, y, width, height) {
    target.viewport.set(x, y, width, height);
    target.scissor.set(x, y, width, height);
  }
  function _getBlurShader(lodMax, width, height) {
    const weights = new Float32Array(MAX_SAMPLES);
    const poleAxis = new Vector3(0, 1, 0);
    const shaderMaterial = new ShaderMaterial({
      name: "SphericalGaussianBlur",
      defines: {
        "n": MAX_SAMPLES,
        "CUBEUV_TEXEL_WIDTH": 1 / width,
        "CUBEUV_TEXEL_HEIGHT": 1 / height,
        "CUBEUV_MAX_MIP": `${lodMax}.0`
      },
      uniforms: {
        "envMap": { value: null },
        "samples": { value: 1 },
        "weights": { value: weights },
        "latitudinal": { value: false },
        "dTheta": { value: 0 },
        "mipInt": { value: 0 },
        "poleAxis": { value: poleAxis }
      },
      vertexShader: _getCommonVertexShader(),
      fragmentShader: (
        /* glsl */
        `

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`
      ),
      blending: NoBlending,
      depthTest: false,
      depthWrite: false
    });
    return shaderMaterial;
  }
  function _getEquirectMaterial() {
    return new ShaderMaterial({
      name: "EquirectangularToCubeUV",
      uniforms: {
        "envMap": { value: null }
      },
      vertexShader: _getCommonVertexShader(),
      fragmentShader: (
        /* glsl */
        `

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`
      ),
      blending: NoBlending,
      depthTest: false,
      depthWrite: false
    });
  }
  function _getCubemapMaterial() {
    return new ShaderMaterial({
      name: "CubemapToCubeUV",
      uniforms: {
        "envMap": { value: null },
        "flipEnvMap": { value: -1 }
      },
      vertexShader: _getCommonVertexShader(),
      fragmentShader: (
        /* glsl */
        `

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`
      ),
      blending: NoBlending,
      depthTest: false,
      depthWrite: false
    });
  }
  function _getCommonVertexShader() {
    return (
      /* glsl */
      `

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`
    );
  }
  function WebGLCubeUVMaps(renderer) {
    let cubeUVmaps = /* @__PURE__ */ new WeakMap();
    let pmremGenerator = null;
    function get(texture) {
      if (texture && texture.isTexture) {
        const mapping = texture.mapping;
        const isEquirectMap = mapping === EquirectangularReflectionMapping || mapping === EquirectangularRefractionMapping;
        const isCubeMap = mapping === CubeReflectionMapping || mapping === CubeRefractionMapping;
        if (isEquirectMap || isCubeMap) {
          if (texture.isRenderTargetTexture && texture.needsPMREMUpdate === true) {
            texture.needsPMREMUpdate = false;
            let renderTarget = cubeUVmaps.get(texture);
            if (pmremGenerator === null) pmremGenerator = new PMREMGenerator(renderer);
            renderTarget = isEquirectMap ? pmremGenerator.fromEquirectangular(texture, renderTarget) : pmremGenerator.fromCubemap(texture, renderTarget);
            cubeUVmaps.set(texture, renderTarget);
            return renderTarget.texture;
          } else {
            if (cubeUVmaps.has(texture)) {
              return cubeUVmaps.get(texture).texture;
            } else {
              const image = texture.image;
              if (isEquirectMap && image && image.height > 0 || isCubeMap && image && isCubeTextureComplete(image)) {
                if (pmremGenerator === null) pmremGenerator = new PMREMGenerator(renderer);
                const renderTarget = isEquirectMap ? pmremGenerator.fromEquirectangular(texture) : pmremGenerator.fromCubemap(texture);
                cubeUVmaps.set(texture, renderTarget);
                texture.addEventListener("dispose", onTextureDispose);
                return renderTarget.texture;
              } else {
                return null;
              }
            }
          }
        }
      }
      return texture;
    }
    function isCubeTextureComplete(image) {
      let count = 0;
      const length = 6;
      for (let i = 0; i < length; i++) {
        if (image[i] !== void 0) count++;
      }
      return count === length;
    }
    function onTextureDispose(event) {
      const texture = event.target;
      texture.removeEventListener("dispose", onTextureDispose);
      const cubemapUV = cubeUVmaps.get(texture);
      if (cubemapUV !== void 0) {
        cubeUVmaps.delete(texture);
        cubemapUV.dispose();
      }
    }
    function dispose() {
      cubeUVmaps = /* @__PURE__ */ new WeakMap();
      if (pmremGenerator !== null) {
        pmremGenerator.dispose();
        pmremGenerator = null;
      }
    }
    return {
      get,
      dispose
    };
  }
  function WebGLExtensions(gl) {
    const extensions = {};
    function getExtension(name) {
      if (extensions[name] !== void 0) {
        return extensions[name];
      }
      let extension;
      switch (name) {
        case "WEBGL_depth_texture":
          extension = gl.getExtension("WEBGL_depth_texture") || gl.getExtension("MOZ_WEBGL_depth_texture") || gl.getExtension("WEBKIT_WEBGL_depth_texture");
          break;
        case "EXT_texture_filter_anisotropic":
          extension = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("MOZ_EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
          break;
        case "WEBGL_compressed_texture_s3tc":
          extension = gl.getExtension("WEBGL_compressed_texture_s3tc") || gl.getExtension("MOZ_WEBGL_compressed_texture_s3tc") || gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
          break;
        case "WEBGL_compressed_texture_pvrtc":
          extension = gl.getExtension("WEBGL_compressed_texture_pvrtc") || gl.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");
          break;
        default:
          extension = gl.getExtension(name);
      }
      extensions[name] = extension;
      return extension;
    }
    return {
      has: function(name) {
        return getExtension(name) !== null;
      },
      init: function(capabilities) {
        if (capabilities.isWebGL2) {
          getExtension("EXT_color_buffer_float");
          getExtension("WEBGL_clip_cull_distance");
        } else {
          getExtension("WEBGL_depth_texture");
          getExtension("OES_texture_float");
          getExtension("OES_texture_half_float");
          getExtension("OES_texture_half_float_linear");
          getExtension("OES_standard_derivatives");
          getExtension("OES_element_index_uint");
          getExtension("OES_vertex_array_object");
          getExtension("ANGLE_instanced_arrays");
        }
        getExtension("OES_texture_float_linear");
        getExtension("EXT_color_buffer_half_float");
        getExtension("WEBGL_multisampled_render_to_texture");
      },
      get: function(name) {
        const extension = getExtension(name);
        if (extension === null) {
          console.warn("THREE.WebGLRenderer: " + name + " extension not supported.");
        }
        return extension;
      }
    };
  }
  function WebGLGeometries(gl, attributes, info, bindingStates) {
    const geometries = {};
    const wireframeAttributes = /* @__PURE__ */ new WeakMap();
    function onGeometryDispose(event) {
      const geometry = event.target;
      if (geometry.index !== null) {
        attributes.remove(geometry.index);
      }
      for (const name in geometry.attributes) {
        attributes.remove(geometry.attributes[name]);
      }
      for (const name in geometry.morphAttributes) {
        const array = geometry.morphAttributes[name];
        for (let i = 0, l = array.length; i < l; i++) {
          attributes.remove(array[i]);
        }
      }
      geometry.removeEventListener("dispose", onGeometryDispose);
      delete geometries[geometry.id];
      const attribute = wireframeAttributes.get(geometry);
      if (attribute) {
        attributes.remove(attribute);
        wireframeAttributes.delete(geometry);
      }
      bindingStates.releaseStatesOfGeometry(geometry);
      if (geometry.isInstancedBufferGeometry === true) {
        delete geometry._maxInstanceCount;
      }
      info.memory.geometries--;
    }
    function get(object, geometry) {
      if (geometries[geometry.id] === true) return geometry;
      geometry.addEventListener("dispose", onGeometryDispose);
      geometries[geometry.id] = true;
      info.memory.geometries++;
      return geometry;
    }
    function update(geometry) {
      const geometryAttributes = geometry.attributes;
      for (const name in geometryAttributes) {
        attributes.update(geometryAttributes[name], gl.ARRAY_BUFFER);
      }
      const morphAttributes = geometry.morphAttributes;
      for (const name in morphAttributes) {
        const array = morphAttributes[name];
        for (let i = 0, l = array.length; i < l; i++) {
          attributes.update(array[i], gl.ARRAY_BUFFER);
        }
      }
    }
    function updateWireframeAttribute(geometry) {
      const indices = [];
      const geometryIndex = geometry.index;
      const geometryPosition = geometry.attributes.position;
      let version = 0;
      if (geometryIndex !== null) {
        const array = geometryIndex.array;
        version = geometryIndex.version;
        for (let i = 0, l = array.length; i < l; i += 3) {
          const a = array[i + 0];
          const b = array[i + 1];
          const c = array[i + 2];
          indices.push(a, b, b, c, c, a);
        }
      } else if (geometryPosition !== void 0) {
        const array = geometryPosition.array;
        version = geometryPosition.version;
        for (let i = 0, l = array.length / 3 - 1; i < l; i += 3) {
          const a = i + 0;
          const b = i + 1;
          const c = i + 2;
          indices.push(a, b, b, c, c, a);
        }
      } else {
        return;
      }
      const attribute = new (arrayNeedsUint32(indices) ? Uint32BufferAttribute : Uint16BufferAttribute)(indices, 1);
      attribute.version = version;
      const previousAttribute = wireframeAttributes.get(geometry);
      if (previousAttribute) attributes.remove(previousAttribute);
      wireframeAttributes.set(geometry, attribute);
    }
    function getWireframeAttribute(geometry) {
      const currentAttribute = wireframeAttributes.get(geometry);
      if (currentAttribute) {
        const geometryIndex = geometry.index;
        if (geometryIndex !== null) {
          if (currentAttribute.version < geometryIndex.version) {
            updateWireframeAttribute(geometry);
          }
        }
      } else {
        updateWireframeAttribute(geometry);
      }
      return wireframeAttributes.get(geometry);
    }
    return {
      get,
      update,
      getWireframeAttribute
    };
  }
  function WebGLIndexedBufferRenderer(gl, extensions, info, capabilities) {
    const isWebGL2 = capabilities.isWebGL2;
    let mode;
    function setMode(value) {
      mode = value;
    }
    let type, bytesPerElement;
    function setIndex(value) {
      type = value.type;
      bytesPerElement = value.bytesPerElement;
    }
    function render(start, count) {
      gl.drawElements(mode, count, type, start * bytesPerElement);
      info.update(count, mode, 1);
    }
    function renderInstances(start, count, primcount) {
      if (primcount === 0) return;
      let extension, methodName;
      if (isWebGL2) {
        extension = gl;
        methodName = "drawElementsInstanced";
      } else {
        extension = extensions.get("ANGLE_instanced_arrays");
        methodName = "drawElementsInstancedANGLE";
        if (extension === null) {
          console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");
          return;
        }
      }
      extension[methodName](mode, count, type, start * bytesPerElement, primcount);
      info.update(count, mode, primcount);
    }
    function renderMultiDraw(starts, counts, drawCount) {
      if (drawCount === 0) return;
      const extension = extensions.get("WEBGL_multi_draw");
      if (extension === null) {
        for (let i = 0; i < drawCount; i++) {
          this.render(starts[i] / bytesPerElement, counts[i]);
        }
      } else {
        extension.multiDrawElementsWEBGL(mode, counts, 0, type, starts, 0, drawCount);
        let elementCount = 0;
        for (let i = 0; i < drawCount; i++) {
          elementCount += counts[i];
        }
        info.update(elementCount, mode, 1);
      }
    }
    this.setMode = setMode;
    this.setIndex = setIndex;
    this.render = render;
    this.renderInstances = renderInstances;
    this.renderMultiDraw = renderMultiDraw;
  }
  function WebGLInfo(gl) {
    const memory = {
      geometries: 0,
      textures: 0
    };
    const render = {
      frame: 0,
      calls: 0,
      triangles: 0,
      points: 0,
      lines: 0
    };
    function update(count, mode, instanceCount) {
      render.calls++;
      switch (mode) {
        case gl.TRIANGLES:
          render.triangles += instanceCount * (count / 3);
          break;
        case gl.LINES:
          render.lines += instanceCount * (count / 2);
          break;
        case gl.LINE_STRIP:
          render.lines += instanceCount * (count - 1);
          break;
        case gl.LINE_LOOP:
          render.lines += instanceCount * count;
          break;
        case gl.POINTS:
          render.points += instanceCount * count;
          break;
        default:
          console.error("THREE.WebGLInfo: Unknown draw mode:", mode);
          break;
      }
    }
    function reset() {
      render.calls = 0;
      render.triangles = 0;
      render.points = 0;
      render.lines = 0;
    }
    return {
      memory,
      render,
      programs: null,
      autoReset: true,
      reset,
      update
    };
  }
  function numericalSort(a, b) {
    return a[0] - b[0];
  }
  function absNumericalSort(a, b) {
    return Math.abs(b[1]) - Math.abs(a[1]);
  }
  function WebGLMorphtargets(gl, capabilities, textures) {
    const influencesList = {};
    const morphInfluences = new Float32Array(8);
    const morphTextures = /* @__PURE__ */ new WeakMap();
    const morph = new Vector4();
    const workInfluences = [];
    for (let i = 0; i < 8; i++) {
      workInfluences[i] = [i, 0];
    }
    function update(object, geometry, program) {
      const objectInfluences = object.morphTargetInfluences;
      if (capabilities.isWebGL2 === true) {
        const morphAttribute = geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color;
        const morphTargetsCount = morphAttribute !== void 0 ? morphAttribute.length : 0;
        let entry = morphTextures.get(geometry);
        if (entry === void 0 || entry.count !== morphTargetsCount) {
          let disposeTexture = function() {
            texture.dispose();
            morphTextures.delete(geometry);
            geometry.removeEventListener("dispose", disposeTexture);
          };
          if (entry !== void 0) entry.texture.dispose();
          const hasMorphPosition = geometry.morphAttributes.position !== void 0;
          const hasMorphNormals = geometry.morphAttributes.normal !== void 0;
          const hasMorphColors = geometry.morphAttributes.color !== void 0;
          const morphTargets = geometry.morphAttributes.position || [];
          const morphNormals = geometry.morphAttributes.normal || [];
          const morphColors = geometry.morphAttributes.color || [];
          let vertexDataCount = 0;
          if (hasMorphPosition === true) vertexDataCount = 1;
          if (hasMorphNormals === true) vertexDataCount = 2;
          if (hasMorphColors === true) vertexDataCount = 3;
          let width = geometry.attributes.position.count * vertexDataCount;
          let height = 1;
          if (width > capabilities.maxTextureSize) {
            height = Math.ceil(width / capabilities.maxTextureSize);
            width = capabilities.maxTextureSize;
          }
          const buffer = new Float32Array(width * height * 4 * morphTargetsCount);
          const texture = new DataArrayTexture(buffer, width, height, morphTargetsCount);
          texture.type = FloatType;
          texture.needsUpdate = true;
          const vertexDataStride = vertexDataCount * 4;
          for (let i = 0; i < morphTargetsCount; i++) {
            const morphTarget = morphTargets[i];
            const morphNormal = morphNormals[i];
            const morphColor = morphColors[i];
            const offset = width * height * 4 * i;
            for (let j = 0; j < morphTarget.count; j++) {
              const stride = j * vertexDataStride;
              if (hasMorphPosition === true) {
                morph.fromBufferAttribute(morphTarget, j);
                buffer[offset + stride + 0] = morph.x;
                buffer[offset + stride + 1] = morph.y;
                buffer[offset + stride + 2] = morph.z;
                buffer[offset + stride + 3] = 0;
              }
              if (hasMorphNormals === true) {
                morph.fromBufferAttribute(morphNormal, j);
                buffer[offset + stride + 4] = morph.x;
                buffer[offset + stride + 5] = morph.y;
                buffer[offset + stride + 6] = morph.z;
                buffer[offset + stride + 7] = 0;
              }
              if (hasMorphColors === true) {
                morph.fromBufferAttribute(morphColor, j);
                buffer[offset + stride + 8] = morph.x;
                buffer[offset + stride + 9] = morph.y;
                buffer[offset + stride + 10] = morph.z;
                buffer[offset + stride + 11] = morphColor.itemSize === 4 ? morph.w : 1;
              }
            }
          }
          entry = {
            count: morphTargetsCount,
            texture,
            size: new Vector2(width, height)
          };
          morphTextures.set(geometry, entry);
          geometry.addEventListener("dispose", disposeTexture);
        }
        let morphInfluencesSum = 0;
        for (let i = 0; i < objectInfluences.length; i++) {
          morphInfluencesSum += objectInfluences[i];
        }
        const morphBaseInfluence = geometry.morphTargetsRelative ? 1 : 1 - morphInfluencesSum;
        program.getUniforms().setValue(gl, "morphTargetBaseInfluence", morphBaseInfluence);
        program.getUniforms().setValue(gl, "morphTargetInfluences", objectInfluences);
        program.getUniforms().setValue(gl, "morphTargetsTexture", entry.texture, textures);
        program.getUniforms().setValue(gl, "morphTargetsTextureSize", entry.size);
      } else {
        const length = objectInfluences === void 0 ? 0 : objectInfluences.length;
        let influences = influencesList[geometry.id];
        if (influences === void 0 || influences.length !== length) {
          influences = [];
          for (let i = 0; i < length; i++) {
            influences[i] = [i, 0];
          }
          influencesList[geometry.id] = influences;
        }
        for (let i = 0; i < length; i++) {
          const influence = influences[i];
          influence[0] = i;
          influence[1] = objectInfluences[i];
        }
        influences.sort(absNumericalSort);
        for (let i = 0; i < 8; i++) {
          if (i < length && influences[i][1]) {
            workInfluences[i][0] = influences[i][0];
            workInfluences[i][1] = influences[i][1];
          } else {
            workInfluences[i][0] = Number.MAX_SAFE_INTEGER;
            workInfluences[i][1] = 0;
          }
        }
        workInfluences.sort(numericalSort);
        const morphTargets = geometry.morphAttributes.position;
        const morphNormals = geometry.morphAttributes.normal;
        let morphInfluencesSum = 0;
        for (let i = 0; i < 8; i++) {
          const influence = workInfluences[i];
          const index = influence[0];
          const value = influence[1];
          if (index !== Number.MAX_SAFE_INTEGER && value) {
            if (morphTargets && geometry.getAttribute("morphTarget" + i) !== morphTargets[index]) {
              geometry.setAttribute("morphTarget" + i, morphTargets[index]);
            }
            if (morphNormals && geometry.getAttribute("morphNormal" + i) !== morphNormals[index]) {
              geometry.setAttribute("morphNormal" + i, morphNormals[index]);
            }
            morphInfluences[i] = value;
            morphInfluencesSum += value;
          } else {
            if (morphTargets && geometry.hasAttribute("morphTarget" + i) === true) {
              geometry.deleteAttribute("morphTarget" + i);
            }
            if (morphNormals && geometry.hasAttribute("morphNormal" + i) === true) {
              geometry.deleteAttribute("morphNormal" + i);
            }
            morphInfluences[i] = 0;
          }
        }
        const morphBaseInfluence = geometry.morphTargetsRelative ? 1 : 1 - morphInfluencesSum;
        program.getUniforms().setValue(gl, "morphTargetBaseInfluence", morphBaseInfluence);
        program.getUniforms().setValue(gl, "morphTargetInfluences", morphInfluences);
      }
    }
    return {
      update
    };
  }
  function WebGLObjects(gl, geometries, attributes, info) {
    let updateMap = /* @__PURE__ */ new WeakMap();
    function update(object) {
      const frame = info.render.frame;
      const geometry = object.geometry;
      const buffergeometry = geometries.get(object, geometry);
      if (updateMap.get(buffergeometry) !== frame) {
        geometries.update(buffergeometry);
        updateMap.set(buffergeometry, frame);
      }
      if (object.isInstancedMesh) {
        if (object.hasEventListener("dispose", onInstancedMeshDispose) === false) {
          object.addEventListener("dispose", onInstancedMeshDispose);
        }
        if (updateMap.get(object) !== frame) {
          attributes.update(object.instanceMatrix, gl.ARRAY_BUFFER);
          if (object.instanceColor !== null) {
            attributes.update(object.instanceColor, gl.ARRAY_BUFFER);
          }
          updateMap.set(object, frame);
        }
      }
      if (object.isSkinnedMesh) {
        const skeleton = object.skeleton;
        if (updateMap.get(skeleton) !== frame) {
          skeleton.update();
          updateMap.set(skeleton, frame);
        }
      }
      return buffergeometry;
    }
    function dispose() {
      updateMap = /* @__PURE__ */ new WeakMap();
    }
    function onInstancedMeshDispose(event) {
      const instancedMesh = event.target;
      instancedMesh.removeEventListener("dispose", onInstancedMeshDispose);
      attributes.remove(instancedMesh.instanceMatrix);
      if (instancedMesh.instanceColor !== null) attributes.remove(instancedMesh.instanceColor);
    }
    return {
      update,
      dispose
    };
  }
  var DepthTexture = class extends Texture {
    constructor(width, height, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, format) {
      format = format !== void 0 ? format : DepthFormat;
      if (format !== DepthFormat && format !== DepthStencilFormat) {
        throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");
      }
      if (type === void 0 && format === DepthFormat) type = UnsignedIntType;
      if (type === void 0 && format === DepthStencilFormat) type = UnsignedInt248Type;
      super(null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
      this.isDepthTexture = true;
      this.image = { width, height };
      this.magFilter = magFilter !== void 0 ? magFilter : NearestFilter;
      this.minFilter = minFilter !== void 0 ? minFilter : NearestFilter;
      this.flipY = false;
      this.generateMipmaps = false;
      this.compareFunction = null;
    }
    copy(source) {
      super.copy(source);
      this.compareFunction = source.compareFunction;
      return this;
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      if (this.compareFunction !== null) data.compareFunction = this.compareFunction;
      return data;
    }
  };
  var emptyTexture = /* @__PURE__ */ new Texture();
  var emptyShadowTexture = /* @__PURE__ */ new DepthTexture(1, 1);
  emptyShadowTexture.compareFunction = LessEqualCompare;
  var emptyArrayTexture = /* @__PURE__ */ new DataArrayTexture();
  var empty3dTexture = /* @__PURE__ */ new Data3DTexture();
  var emptyCubeTexture = /* @__PURE__ */ new CubeTexture();
  var arrayCacheF32 = [];
  var arrayCacheI32 = [];
  var mat4array = new Float32Array(16);
  var mat3array = new Float32Array(9);
  var mat2array = new Float32Array(4);
  function flatten(array, nBlocks, blockSize) {
    const firstElem = array[0];
    if (firstElem <= 0 || firstElem > 0) return array;
    const n = nBlocks * blockSize;
    let r = arrayCacheF32[n];
    if (r === void 0) {
      r = new Float32Array(n);
      arrayCacheF32[n] = r;
    }
    if (nBlocks !== 0) {
      firstElem.toArray(r, 0);
      for (let i = 1, offset = 0; i !== nBlocks; ++i) {
        offset += blockSize;
        array[i].toArray(r, offset);
      }
    }
    return r;
  }
  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0, l = a.length; i < l; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  function copyArray(a, b) {
    for (let i = 0, l = b.length; i < l; i++) {
      a[i] = b[i];
    }
  }
  function allocTexUnits(textures, n) {
    let r = arrayCacheI32[n];
    if (r === void 0) {
      r = new Int32Array(n);
      arrayCacheI32[n] = r;
    }
    for (let i = 0; i !== n; ++i) {
      r[i] = textures.allocateTextureUnit();
    }
    return r;
  }
  function setValueV1f(gl, v) {
    const cache = this.cache;
    if (cache[0] === v) return;
    gl.uniform1f(this.addr, v);
    cache[0] = v;
  }
  function setValueV2f(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y) {
        gl.uniform2f(this.addr, v.x, v.y);
        cache[0] = v.x;
        cache[1] = v.y;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform2fv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueV3f(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
        gl.uniform3f(this.addr, v.x, v.y, v.z);
        cache[0] = v.x;
        cache[1] = v.y;
        cache[2] = v.z;
      }
    } else if (v.r !== void 0) {
      if (cache[0] !== v.r || cache[1] !== v.g || cache[2] !== v.b) {
        gl.uniform3f(this.addr, v.r, v.g, v.b);
        cache[0] = v.r;
        cache[1] = v.g;
        cache[2] = v.b;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform3fv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueV4f(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z || cache[3] !== v.w) {
        gl.uniform4f(this.addr, v.x, v.y, v.z, v.w);
        cache[0] = v.x;
        cache[1] = v.y;
        cache[2] = v.z;
        cache[3] = v.w;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform4fv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueM2(gl, v) {
    const cache = this.cache;
    const elements = v.elements;
    if (elements === void 0) {
      if (arraysEqual(cache, v)) return;
      gl.uniformMatrix2fv(this.addr, false, v);
      copyArray(cache, v);
    } else {
      if (arraysEqual(cache, elements)) return;
      mat2array.set(elements);
      gl.uniformMatrix2fv(this.addr, false, mat2array);
      copyArray(cache, elements);
    }
  }
  function setValueM3(gl, v) {
    const cache = this.cache;
    const elements = v.elements;
    if (elements === void 0) {
      if (arraysEqual(cache, v)) return;
      gl.uniformMatrix3fv(this.addr, false, v);
      copyArray(cache, v);
    } else {
      if (arraysEqual(cache, elements)) return;
      mat3array.set(elements);
      gl.uniformMatrix3fv(this.addr, false, mat3array);
      copyArray(cache, elements);
    }
  }
  function setValueM4(gl, v) {
    const cache = this.cache;
    const elements = v.elements;
    if (elements === void 0) {
      if (arraysEqual(cache, v)) return;
      gl.uniformMatrix4fv(this.addr, false, v);
      copyArray(cache, v);
    } else {
      if (arraysEqual(cache, elements)) return;
      mat4array.set(elements);
      gl.uniformMatrix4fv(this.addr, false, mat4array);
      copyArray(cache, elements);
    }
  }
  function setValueV1i(gl, v) {
    const cache = this.cache;
    if (cache[0] === v) return;
    gl.uniform1i(this.addr, v);
    cache[0] = v;
  }
  function setValueV2i(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y) {
        gl.uniform2i(this.addr, v.x, v.y);
        cache[0] = v.x;
        cache[1] = v.y;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform2iv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueV3i(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
        gl.uniform3i(this.addr, v.x, v.y, v.z);
        cache[0] = v.x;
        cache[1] = v.y;
        cache[2] = v.z;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform3iv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueV4i(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z || cache[3] !== v.w) {
        gl.uniform4i(this.addr, v.x, v.y, v.z, v.w);
        cache[0] = v.x;
        cache[1] = v.y;
        cache[2] = v.z;
        cache[3] = v.w;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform4iv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueV1ui(gl, v) {
    const cache = this.cache;
    if (cache[0] === v) return;
    gl.uniform1ui(this.addr, v);
    cache[0] = v;
  }
  function setValueV2ui(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y) {
        gl.uniform2ui(this.addr, v.x, v.y);
        cache[0] = v.x;
        cache[1] = v.y;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform2uiv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueV3ui(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
        gl.uniform3ui(this.addr, v.x, v.y, v.z);
        cache[0] = v.x;
        cache[1] = v.y;
        cache[2] = v.z;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform3uiv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueV4ui(gl, v) {
    const cache = this.cache;
    if (v.x !== void 0) {
      if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z || cache[3] !== v.w) {
        gl.uniform4ui(this.addr, v.x, v.y, v.z, v.w);
        cache[0] = v.x;
        cache[1] = v.y;
        cache[2] = v.z;
        cache[3] = v.w;
      }
    } else {
      if (arraysEqual(cache, v)) return;
      gl.uniform4uiv(this.addr, v);
      copyArray(cache, v);
    }
  }
  function setValueT1(gl, v, textures) {
    const cache = this.cache;
    const unit = textures.allocateTextureUnit();
    if (cache[0] !== unit) {
      gl.uniform1i(this.addr, unit);
      cache[0] = unit;
    }
    const emptyTexture2D = this.type === gl.SAMPLER_2D_SHADOW ? emptyShadowTexture : emptyTexture;
    textures.setTexture2D(v || emptyTexture2D, unit);
  }
  function setValueT3D1(gl, v, textures) {
    const cache = this.cache;
    const unit = textures.allocateTextureUnit();
    if (cache[0] !== unit) {
      gl.uniform1i(this.addr, unit);
      cache[0] = unit;
    }
    textures.setTexture3D(v || empty3dTexture, unit);
  }
  function setValueT6(gl, v, textures) {
    const cache = this.cache;
    const unit = textures.allocateTextureUnit();
    if (cache[0] !== unit) {
      gl.uniform1i(this.addr, unit);
      cache[0] = unit;
    }
    textures.setTextureCube(v || emptyCubeTexture, unit);
  }
  function setValueT2DArray1(gl, v, textures) {
    const cache = this.cache;
    const unit = textures.allocateTextureUnit();
    if (cache[0] !== unit) {
      gl.uniform1i(this.addr, unit);
      cache[0] = unit;
    }
    textures.setTexture2DArray(v || emptyArrayTexture, unit);
  }
  function getSingularSetter(type) {
    switch (type) {
      case 5126:
        return setValueV1f;
      // FLOAT
      case 35664:
        return setValueV2f;
      // _VEC2
      case 35665:
        return setValueV3f;
      // _VEC3
      case 35666:
        return setValueV4f;
      // _VEC4
      case 35674:
        return setValueM2;
      // _MAT2
      case 35675:
        return setValueM3;
      // _MAT3
      case 35676:
        return setValueM4;
      // _MAT4
      case 5124:
      case 35670:
        return setValueV1i;
      // INT, BOOL
      case 35667:
      case 35671:
        return setValueV2i;
      // _VEC2
      case 35668:
      case 35672:
        return setValueV3i;
      // _VEC3
      case 35669:
      case 35673:
        return setValueV4i;
      // _VEC4
      case 5125:
        return setValueV1ui;
      // UINT
      case 36294:
        return setValueV2ui;
      // _VEC2
      case 36295:
        return setValueV3ui;
      // _VEC3
      case 36296:
        return setValueV4ui;
      // _VEC4
      case 35678:
      // SAMPLER_2D
      case 36198:
      // SAMPLER_EXTERNAL_OES
      case 36298:
      // INT_SAMPLER_2D
      case 36306:
      // UNSIGNED_INT_SAMPLER_2D
      case 35682:
        return setValueT1;
      case 35679:
      // SAMPLER_3D
      case 36299:
      // INT_SAMPLER_3D
      case 36307:
        return setValueT3D1;
      case 35680:
      // SAMPLER_CUBE
      case 36300:
      // INT_SAMPLER_CUBE
      case 36308:
      // UNSIGNED_INT_SAMPLER_CUBE
      case 36293:
        return setValueT6;
      case 36289:
      // SAMPLER_2D_ARRAY
      case 36303:
      // INT_SAMPLER_2D_ARRAY
      case 36311:
      // UNSIGNED_INT_SAMPLER_2D_ARRAY
      case 36292:
        return setValueT2DArray1;
    }
  }
  function setValueV1fArray(gl, v) {
    gl.uniform1fv(this.addr, v);
  }
  function setValueV2fArray(gl, v) {
    const data = flatten(v, this.size, 2);
    gl.uniform2fv(this.addr, data);
  }
  function setValueV3fArray(gl, v) {
    const data = flatten(v, this.size, 3);
    gl.uniform3fv(this.addr, data);
  }
  function setValueV4fArray(gl, v) {
    const data = flatten(v, this.size, 4);
    gl.uniform4fv(this.addr, data);
  }
  function setValueM2Array(gl, v) {
    const data = flatten(v, this.size, 4);
    gl.uniformMatrix2fv(this.addr, false, data);
  }
  function setValueM3Array(gl, v) {
    const data = flatten(v, this.size, 9);
    gl.uniformMatrix3fv(this.addr, false, data);
  }
  function setValueM4Array(gl, v) {
    const data = flatten(v, this.size, 16);
    gl.uniformMatrix4fv(this.addr, false, data);
  }
  function setValueV1iArray(gl, v) {
    gl.uniform1iv(this.addr, v);
  }
  function setValueV2iArray(gl, v) {
    gl.uniform2iv(this.addr, v);
  }
  function setValueV3iArray(gl, v) {
    gl.uniform3iv(this.addr, v);
  }
  function setValueV4iArray(gl, v) {
    gl.uniform4iv(this.addr, v);
  }
  function setValueV1uiArray(gl, v) {
    gl.uniform1uiv(this.addr, v);
  }
  function setValueV2uiArray(gl, v) {
    gl.uniform2uiv(this.addr, v);
  }
  function setValueV3uiArray(gl, v) {
    gl.uniform3uiv(this.addr, v);
  }
  function setValueV4uiArray(gl, v) {
    gl.uniform4uiv(this.addr, v);
  }
  function setValueT1Array(gl, v, textures) {
    const cache = this.cache;
    const n = v.length;
    const units = allocTexUnits(textures, n);
    if (!arraysEqual(cache, units)) {
      gl.uniform1iv(this.addr, units);
      copyArray(cache, units);
    }
    for (let i = 0; i !== n; ++i) {
      textures.setTexture2D(v[i] || emptyTexture, units[i]);
    }
  }
  function setValueT3DArray(gl, v, textures) {
    const cache = this.cache;
    const n = v.length;
    const units = allocTexUnits(textures, n);
    if (!arraysEqual(cache, units)) {
      gl.uniform1iv(this.addr, units);
      copyArray(cache, units);
    }
    for (let i = 0; i !== n; ++i) {
      textures.setTexture3D(v[i] || empty3dTexture, units[i]);
    }
  }
  function setValueT6Array(gl, v, textures) {
    const cache = this.cache;
    const n = v.length;
    const units = allocTexUnits(textures, n);
    if (!arraysEqual(cache, units)) {
      gl.uniform1iv(this.addr, units);
      copyArray(cache, units);
    }
    for (let i = 0; i !== n; ++i) {
      textures.setTextureCube(v[i] || emptyCubeTexture, units[i]);
    }
  }
  function setValueT2DArrayArray(gl, v, textures) {
    const cache = this.cache;
    const n = v.length;
    const units = allocTexUnits(textures, n);
    if (!arraysEqual(cache, units)) {
      gl.uniform1iv(this.addr, units);
      copyArray(cache, units);
    }
    for (let i = 0; i !== n; ++i) {
      textures.setTexture2DArray(v[i] || emptyArrayTexture, units[i]);
    }
  }
  function getPureArraySetter(type) {
    switch (type) {
      case 5126:
        return setValueV1fArray;
      // FLOAT
      case 35664:
        return setValueV2fArray;
      // _VEC2
      case 35665:
        return setValueV3fArray;
      // _VEC3
      case 35666:
        return setValueV4fArray;
      // _VEC4
      case 35674:
        return setValueM2Array;
      // _MAT2
      case 35675:
        return setValueM3Array;
      // _MAT3
      case 35676:
        return setValueM4Array;
      // _MAT4
      case 5124:
      case 35670:
        return setValueV1iArray;
      // INT, BOOL
      case 35667:
      case 35671:
        return setValueV2iArray;
      // _VEC2
      case 35668:
      case 35672:
        return setValueV3iArray;
      // _VEC3
      case 35669:
      case 35673:
        return setValueV4iArray;
      // _VEC4
      case 5125:
        return setValueV1uiArray;
      // UINT
      case 36294:
        return setValueV2uiArray;
      // _VEC2
      case 36295:
        return setValueV3uiArray;
      // _VEC3
      case 36296:
        return setValueV4uiArray;
      // _VEC4
      case 35678:
      // SAMPLER_2D
      case 36198:
      // SAMPLER_EXTERNAL_OES
      case 36298:
      // INT_SAMPLER_2D
      case 36306:
      // UNSIGNED_INT_SAMPLER_2D
      case 35682:
        return setValueT1Array;
      case 35679:
      // SAMPLER_3D
      case 36299:
      // INT_SAMPLER_3D
      case 36307:
        return setValueT3DArray;
      case 35680:
      // SAMPLER_CUBE
      case 36300:
      // INT_SAMPLER_CUBE
      case 36308:
      // UNSIGNED_INT_SAMPLER_CUBE
      case 36293:
        return setValueT6Array;
      case 36289:
      // SAMPLER_2D_ARRAY
      case 36303:
      // INT_SAMPLER_2D_ARRAY
      case 36311:
      // UNSIGNED_INT_SAMPLER_2D_ARRAY
      case 36292:
        return setValueT2DArrayArray;
    }
  }
  var SingleUniform = class {
    constructor(id, activeInfo, addr) {
      this.id = id;
      this.addr = addr;
      this.cache = [];
      this.type = activeInfo.type;
      this.setValue = getSingularSetter(activeInfo.type);
    }
  };
  var PureArrayUniform = class {
    constructor(id, activeInfo, addr) {
      this.id = id;
      this.addr = addr;
      this.cache = [];
      this.type = activeInfo.type;
      this.size = activeInfo.size;
      this.setValue = getPureArraySetter(activeInfo.type);
    }
  };
  var StructuredUniform = class {
    constructor(id) {
      this.id = id;
      this.seq = [];
      this.map = {};
    }
    setValue(gl, value, textures) {
      const seq = this.seq;
      for (let i = 0, n = seq.length; i !== n; ++i) {
        const u = seq[i];
        u.setValue(gl, value[u.id], textures);
      }
    }
  };
  var RePathPart = /(\w+)(\])?(\[|\.)?/g;
  function addUniform(container, uniformObject) {
    container.seq.push(uniformObject);
    container.map[uniformObject.id] = uniformObject;
  }
  function parseUniform(activeInfo, addr, container) {
    const path = activeInfo.name, pathLength = path.length;
    RePathPart.lastIndex = 0;
    while (true) {
      const match = RePathPart.exec(path), matchEnd = RePathPart.lastIndex;
      let id = match[1];
      const idIsIndex = match[2] === "]", subscript = match[3];
      if (idIsIndex) id = id | 0;
      if (subscript === void 0 || subscript === "[" && matchEnd + 2 === pathLength) {
        addUniform(container, subscript === void 0 ? new SingleUniform(id, activeInfo, addr) : new PureArrayUniform(id, activeInfo, addr));
        break;
      } else {
        const map = container.map;
        let next = map[id];
        if (next === void 0) {
          next = new StructuredUniform(id);
          addUniform(container, next);
        }
        container = next;
      }
    }
  }
  var WebGLUniforms = class {
    constructor(gl, program) {
      this.seq = [];
      this.map = {};
      const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; ++i) {
        const info = gl.getActiveUniform(program, i), addr = gl.getUniformLocation(program, info.name);
        parseUniform(info, addr, this);
      }
    }
    setValue(gl, name, value, textures) {
      const u = this.map[name];
      if (u !== void 0) u.setValue(gl, value, textures);
    }
    setOptional(gl, object, name) {
      const v = object[name];
      if (v !== void 0) this.setValue(gl, name, v);
    }
    static upload(gl, seq, values, textures) {
      for (let i = 0, n = seq.length; i !== n; ++i) {
        const u = seq[i], v = values[u.id];
        if (v.needsUpdate !== false) {
          u.setValue(gl, v.value, textures);
        }
      }
    }
    static seqWithValue(seq, values) {
      const r = [];
      for (let i = 0, n = seq.length; i !== n; ++i) {
        const u = seq[i];
        if (u.id in values) r.push(u);
      }
      return r;
    }
  };
  function WebGLShader(gl, type, string) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, string);
    gl.compileShader(shader);
    return shader;
  }
  var COMPLETION_STATUS_KHR = 37297;
  var programIdCount = 0;
  function handleSource(string, errorLine) {
    const lines = string.split("\n");
    const lines2 = [];
    const from = Math.max(errorLine - 6, 0);
    const to = Math.min(errorLine + 6, lines.length);
    for (let i = from; i < to; i++) {
      const line = i + 1;
      lines2.push(`${line === errorLine ? ">" : " "} ${line}: ${lines[i]}`);
    }
    return lines2.join("\n");
  }
  function getEncodingComponents(colorSpace) {
    const workingPrimaries = ColorManagement.getPrimaries(ColorManagement.workingColorSpace);
    const encodingPrimaries = ColorManagement.getPrimaries(colorSpace);
    let gamutMapping;
    if (workingPrimaries === encodingPrimaries) {
      gamutMapping = "";
    } else if (workingPrimaries === P3Primaries && encodingPrimaries === Rec709Primaries) {
      gamutMapping = "LinearDisplayP3ToLinearSRGB";
    } else if (workingPrimaries === Rec709Primaries && encodingPrimaries === P3Primaries) {
      gamutMapping = "LinearSRGBToLinearDisplayP3";
    }
    switch (colorSpace) {
      case LinearSRGBColorSpace:
      case LinearDisplayP3ColorSpace:
        return [gamutMapping, "LinearTransferOETF"];
      case SRGBColorSpace:
      case DisplayP3ColorSpace:
        return [gamutMapping, "sRGBTransferOETF"];
      default:
        console.warn("THREE.WebGLProgram: Unsupported color space:", colorSpace);
        return [gamutMapping, "LinearTransferOETF"];
    }
  }
  function getShaderErrors(gl, shader, type) {
    const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    const errors = gl.getShaderInfoLog(shader).trim();
    if (status && errors === "") return "";
    const errorMatches = /ERROR: 0:(\d+)/.exec(errors);
    if (errorMatches) {
      const errorLine = parseInt(errorMatches[1]);
      return type.toUpperCase() + "\n\n" + errors + "\n\n" + handleSource(gl.getShaderSource(shader), errorLine);
    } else {
      return errors;
    }
  }
  function getTexelEncodingFunction(functionName, colorSpace) {
    const components = getEncodingComponents(colorSpace);
    return `vec4 ${functionName}( vec4 value ) { return ${components[0]}( ${components[1]}( value ) ); }`;
  }
  function getToneMappingFunction(functionName, toneMapping) {
    let toneMappingName;
    switch (toneMapping) {
      case LinearToneMapping:
        toneMappingName = "Linear";
        break;
      case ReinhardToneMapping:
        toneMappingName = "Reinhard";
        break;
      case CineonToneMapping:
        toneMappingName = "OptimizedCineon";
        break;
      case ACESFilmicToneMapping:
        toneMappingName = "ACESFilmic";
        break;
      case AgXToneMapping:
        toneMappingName = "AgX";
        break;
      case CustomToneMapping:
        toneMappingName = "Custom";
        break;
      default:
        console.warn("THREE.WebGLProgram: Unsupported toneMapping:", toneMapping);
        toneMappingName = "Linear";
    }
    return "vec3 " + functionName + "( vec3 color ) { return " + toneMappingName + "ToneMapping( color ); }";
  }
  function generateExtensions(parameters) {
    const chunks = [
      parameters.extensionDerivatives || !!parameters.envMapCubeUVHeight || parameters.bumpMap || parameters.normalMapTangentSpace || parameters.clearcoatNormalMap || parameters.flatShading || parameters.shaderID === "physical" ? "#extension GL_OES_standard_derivatives : enable" : "",
      (parameters.extensionFragDepth || parameters.logarithmicDepthBuffer) && parameters.rendererExtensionFragDepth ? "#extension GL_EXT_frag_depth : enable" : "",
      parameters.extensionDrawBuffers && parameters.rendererExtensionDrawBuffers ? "#extension GL_EXT_draw_buffers : require" : "",
      (parameters.extensionShaderTextureLOD || parameters.envMap || parameters.transmission) && parameters.rendererExtensionShaderTextureLod ? "#extension GL_EXT_shader_texture_lod : enable" : ""
    ];
    return chunks.filter(filterEmptyLine).join("\n");
  }
  function generateVertexExtensions(parameters) {
    const chunks = [
      parameters.extensionClipCullDistance ? "#extension GL_ANGLE_clip_cull_distance : require" : ""
    ];
    return chunks.filter(filterEmptyLine).join("\n");
  }
  function generateDefines(defines) {
    const chunks = [];
    for (const name in defines) {
      const value = defines[name];
      if (value === false) continue;
      chunks.push("#define " + name + " " + value);
    }
    return chunks.join("\n");
  }
  function fetchAttributeLocations(gl, program) {
    const attributes = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveAttrib(program, i);
      const name = info.name;
      let locationSize = 1;
      if (info.type === gl.FLOAT_MAT2) locationSize = 2;
      if (info.type === gl.FLOAT_MAT3) locationSize = 3;
      if (info.type === gl.FLOAT_MAT4) locationSize = 4;
      attributes[name] = {
        type: info.type,
        location: gl.getAttribLocation(program, name),
        locationSize
      };
    }
    return attributes;
  }
  function filterEmptyLine(string) {
    return string !== "";
  }
  function replaceLightNums(string, parameters) {
    const numSpotLightCoords = parameters.numSpotLightShadows + parameters.numSpotLightMaps - parameters.numSpotLightShadowsWithMaps;
    return string.replace(/NUM_DIR_LIGHTS/g, parameters.numDirLights).replace(/NUM_SPOT_LIGHTS/g, parameters.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g, parameters.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g, numSpotLightCoords).replace(/NUM_RECT_AREA_LIGHTS/g, parameters.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g, parameters.numPointLights).replace(/NUM_HEMI_LIGHTS/g, parameters.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g, parameters.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g, parameters.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g, parameters.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g, parameters.numPointLightShadows);
  }
  function replaceClippingPlaneNums(string, parameters) {
    return string.replace(/NUM_CLIPPING_PLANES/g, parameters.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g, parameters.numClippingPlanes - parameters.numClipIntersection);
  }
  var includePattern = /^[ \t]*#include +<([\w\d./]+)>/gm;
  function resolveIncludes(string) {
    return string.replace(includePattern, includeReplacer);
  }
  var shaderChunkMap = /* @__PURE__ */ new Map([
    ["encodings_fragment", "colorspace_fragment"],
    // @deprecated, r154
    ["encodings_pars_fragment", "colorspace_pars_fragment"],
    // @deprecated, r154
    ["output_fragment", "opaque_fragment"]
    // @deprecated, r154
  ]);
  function includeReplacer(match, include) {
    let string = ShaderChunk[include];
    if (string === void 0) {
      const newInclude = shaderChunkMap.get(include);
      if (newInclude !== void 0) {
        string = ShaderChunk[newInclude];
        console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.', include, newInclude);
      } else {
        throw new Error("Can not resolve #include <" + include + ">");
      }
    }
    return resolveIncludes(string);
  }
  var unrollLoopPattern = /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
  function unrollLoops(string) {
    return string.replace(unrollLoopPattern, loopReplacer);
  }
  function loopReplacer(match, start, end, snippet) {
    let string = "";
    for (let i = parseInt(start); i < parseInt(end); i++) {
      string += snippet.replace(/\[\s*i\s*\]/g, "[ " + i + " ]").replace(/UNROLLED_LOOP_INDEX/g, i);
    }
    return string;
  }
  function generatePrecision(parameters) {
    let precisionstring = "precision " + parameters.precision + " float;\nprecision " + parameters.precision + " int;";
    if (parameters.precision === "highp") {
      precisionstring += "\n#define HIGH_PRECISION";
    } else if (parameters.precision === "mediump") {
      precisionstring += "\n#define MEDIUM_PRECISION";
    } else if (parameters.precision === "lowp") {
      precisionstring += "\n#define LOW_PRECISION";
    }
    return precisionstring;
  }
  function generateShadowMapTypeDefine(parameters) {
    let shadowMapTypeDefine = "SHADOWMAP_TYPE_BASIC";
    if (parameters.shadowMapType === PCFShadowMap) {
      shadowMapTypeDefine = "SHADOWMAP_TYPE_PCF";
    } else if (parameters.shadowMapType === PCFSoftShadowMap) {
      shadowMapTypeDefine = "SHADOWMAP_TYPE_PCF_SOFT";
    } else if (parameters.shadowMapType === VSMShadowMap) {
      shadowMapTypeDefine = "SHADOWMAP_TYPE_VSM";
    }
    return shadowMapTypeDefine;
  }
  function generateEnvMapTypeDefine(parameters) {
    let envMapTypeDefine = "ENVMAP_TYPE_CUBE";
    if (parameters.envMap) {
      switch (parameters.envMapMode) {
        case CubeReflectionMapping:
        case CubeRefractionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_CUBE";
          break;
        case CubeUVReflectionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_CUBE_UV";
          break;
      }
    }
    return envMapTypeDefine;
  }
  function generateEnvMapModeDefine(parameters) {
    let envMapModeDefine = "ENVMAP_MODE_REFLECTION";
    if (parameters.envMap) {
      switch (parameters.envMapMode) {
        case CubeRefractionMapping:
          envMapModeDefine = "ENVMAP_MODE_REFRACTION";
          break;
      }
    }
    return envMapModeDefine;
  }
  function generateEnvMapBlendingDefine(parameters) {
    let envMapBlendingDefine = "ENVMAP_BLENDING_NONE";
    if (parameters.envMap) {
      switch (parameters.combine) {
        case MultiplyOperation:
          envMapBlendingDefine = "ENVMAP_BLENDING_MULTIPLY";
          break;
        case MixOperation:
          envMapBlendingDefine = "ENVMAP_BLENDING_MIX";
          break;
        case AddOperation:
          envMapBlendingDefine = "ENVMAP_BLENDING_ADD";
          break;
      }
    }
    return envMapBlendingDefine;
  }
  function generateCubeUVSize(parameters) {
    const imageHeight = parameters.envMapCubeUVHeight;
    if (imageHeight === null) return null;
    const maxMip = Math.log2(imageHeight) - 2;
    const texelHeight = 1 / imageHeight;
    const texelWidth = 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16));
    return { texelWidth, texelHeight, maxMip };
  }
  function WebGLProgram(renderer, cacheKey, parameters, bindingStates) {
    const gl = renderer.getContext();
    const defines = parameters.defines;
    let vertexShader = parameters.vertexShader;
    let fragmentShader = parameters.fragmentShader;
    const shadowMapTypeDefine = generateShadowMapTypeDefine(parameters);
    const envMapTypeDefine = generateEnvMapTypeDefine(parameters);
    const envMapModeDefine = generateEnvMapModeDefine(parameters);
    const envMapBlendingDefine = generateEnvMapBlendingDefine(parameters);
    const envMapCubeUVSize = generateCubeUVSize(parameters);
    const customExtensions = parameters.isWebGL2 ? "" : generateExtensions(parameters);
    const customVertexExtensions = generateVertexExtensions(parameters);
    const customDefines = generateDefines(defines);
    const program = gl.createProgram();
    let prefixVertex, prefixFragment;
    let versionString = parameters.glslVersion ? "#version " + parameters.glslVersion + "\n" : "";
    if (parameters.isRawShaderMaterial) {
      prefixVertex = [
        "#define SHADER_TYPE " + parameters.shaderType,
        "#define SHADER_NAME " + parameters.shaderName,
        customDefines
      ].filter(filterEmptyLine).join("\n");
      if (prefixVertex.length > 0) {
        prefixVertex += "\n";
      }
      prefixFragment = [
        customExtensions,
        "#define SHADER_TYPE " + parameters.shaderType,
        "#define SHADER_NAME " + parameters.shaderName,
        customDefines
      ].filter(filterEmptyLine).join("\n");
      if (prefixFragment.length > 0) {
        prefixFragment += "\n";
      }
    } else {
      prefixVertex = [
        generatePrecision(parameters),
        "#define SHADER_TYPE " + parameters.shaderType,
        "#define SHADER_NAME " + parameters.shaderName,
        customDefines,
        parameters.extensionClipCullDistance ? "#define USE_CLIP_DISTANCE" : "",
        parameters.batching ? "#define USE_BATCHING" : "",
        parameters.instancing ? "#define USE_INSTANCING" : "",
        parameters.instancingColor ? "#define USE_INSTANCING_COLOR" : "",
        parameters.useFog && parameters.fog ? "#define USE_FOG" : "",
        parameters.useFog && parameters.fogExp2 ? "#define FOG_EXP2" : "",
        parameters.map ? "#define USE_MAP" : "",
        parameters.envMap ? "#define USE_ENVMAP" : "",
        parameters.envMap ? "#define " + envMapModeDefine : "",
        parameters.lightMap ? "#define USE_LIGHTMAP" : "",
        parameters.aoMap ? "#define USE_AOMAP" : "",
        parameters.bumpMap ? "#define USE_BUMPMAP" : "",
        parameters.normalMap ? "#define USE_NORMALMAP" : "",
        parameters.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
        parameters.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
        parameters.displacementMap ? "#define USE_DISPLACEMENTMAP" : "",
        parameters.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
        parameters.anisotropy ? "#define USE_ANISOTROPY" : "",
        parameters.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
        parameters.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
        parameters.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
        parameters.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
        parameters.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
        parameters.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
        parameters.specularMap ? "#define USE_SPECULARMAP" : "",
        parameters.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
        parameters.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
        parameters.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
        parameters.metalnessMap ? "#define USE_METALNESSMAP" : "",
        parameters.alphaMap ? "#define USE_ALPHAMAP" : "",
        parameters.alphaHash ? "#define USE_ALPHAHASH" : "",
        parameters.transmission ? "#define USE_TRANSMISSION" : "",
        parameters.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
        parameters.thicknessMap ? "#define USE_THICKNESSMAP" : "",
        parameters.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
        parameters.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
        //
        parameters.mapUv ? "#define MAP_UV " + parameters.mapUv : "",
        parameters.alphaMapUv ? "#define ALPHAMAP_UV " + parameters.alphaMapUv : "",
        parameters.lightMapUv ? "#define LIGHTMAP_UV " + parameters.lightMapUv : "",
        parameters.aoMapUv ? "#define AOMAP_UV " + parameters.aoMapUv : "",
        parameters.emissiveMapUv ? "#define EMISSIVEMAP_UV " + parameters.emissiveMapUv : "",
        parameters.bumpMapUv ? "#define BUMPMAP_UV " + parameters.bumpMapUv : "",
        parameters.normalMapUv ? "#define NORMALMAP_UV " + parameters.normalMapUv : "",
        parameters.displacementMapUv ? "#define DISPLACEMENTMAP_UV " + parameters.displacementMapUv : "",
        parameters.metalnessMapUv ? "#define METALNESSMAP_UV " + parameters.metalnessMapUv : "",
        parameters.roughnessMapUv ? "#define ROUGHNESSMAP_UV " + parameters.roughnessMapUv : "",
        parameters.anisotropyMapUv ? "#define ANISOTROPYMAP_UV " + parameters.anisotropyMapUv : "",
        parameters.clearcoatMapUv ? "#define CLEARCOATMAP_UV " + parameters.clearcoatMapUv : "",
        parameters.clearcoatNormalMapUv ? "#define CLEARCOAT_NORMALMAP_UV " + parameters.clearcoatNormalMapUv : "",
        parameters.clearcoatRoughnessMapUv ? "#define CLEARCOAT_ROUGHNESSMAP_UV " + parameters.clearcoatRoughnessMapUv : "",
        parameters.iridescenceMapUv ? "#define IRIDESCENCEMAP_UV " + parameters.iridescenceMapUv : "",
        parameters.iridescenceThicknessMapUv ? "#define IRIDESCENCE_THICKNESSMAP_UV " + parameters.iridescenceThicknessMapUv : "",
        parameters.sheenColorMapUv ? "#define SHEEN_COLORMAP_UV " + parameters.sheenColorMapUv : "",
        parameters.sheenRoughnessMapUv ? "#define SHEEN_ROUGHNESSMAP_UV " + parameters.sheenRoughnessMapUv : "",
        parameters.specularMapUv ? "#define SPECULARMAP_UV " + parameters.specularMapUv : "",
        parameters.specularColorMapUv ? "#define SPECULAR_COLORMAP_UV " + parameters.specularColorMapUv : "",
        parameters.specularIntensityMapUv ? "#define SPECULAR_INTENSITYMAP_UV " + parameters.specularIntensityMapUv : "",
        parameters.transmissionMapUv ? "#define TRANSMISSIONMAP_UV " + parameters.transmissionMapUv : "",
        parameters.thicknessMapUv ? "#define THICKNESSMAP_UV " + parameters.thicknessMapUv : "",
        //
        parameters.vertexTangents && parameters.flatShading === false ? "#define USE_TANGENT" : "",
        parameters.vertexColors ? "#define USE_COLOR" : "",
        parameters.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
        parameters.vertexUv1s ? "#define USE_UV1" : "",
        parameters.vertexUv2s ? "#define USE_UV2" : "",
        parameters.vertexUv3s ? "#define USE_UV3" : "",
        parameters.pointsUvs ? "#define USE_POINTS_UV" : "",
        parameters.flatShading ? "#define FLAT_SHADED" : "",
        parameters.skinning ? "#define USE_SKINNING" : "",
        parameters.morphTargets ? "#define USE_MORPHTARGETS" : "",
        parameters.morphNormals && parameters.flatShading === false ? "#define USE_MORPHNORMALS" : "",
        parameters.morphColors && parameters.isWebGL2 ? "#define USE_MORPHCOLORS" : "",
        parameters.morphTargetsCount > 0 && parameters.isWebGL2 ? "#define MORPHTARGETS_TEXTURE" : "",
        parameters.morphTargetsCount > 0 && parameters.isWebGL2 ? "#define MORPHTARGETS_TEXTURE_STRIDE " + parameters.morphTextureStride : "",
        parameters.morphTargetsCount > 0 && parameters.isWebGL2 ? "#define MORPHTARGETS_COUNT " + parameters.morphTargetsCount : "",
        parameters.doubleSided ? "#define DOUBLE_SIDED" : "",
        parameters.flipSided ? "#define FLIP_SIDED" : "",
        parameters.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
        parameters.shadowMapEnabled ? "#define " + shadowMapTypeDefine : "",
        parameters.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",
        parameters.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
        parameters.useLegacyLights ? "#define LEGACY_LIGHTS" : "",
        parameters.logarithmicDepthBuffer ? "#define USE_LOGDEPTHBUF" : "",
        parameters.logarithmicDepthBuffer && parameters.rendererExtensionFragDepth ? "#define USE_LOGDEPTHBUF_EXT" : "",
        "uniform mat4 modelMatrix;",
        "uniform mat4 modelViewMatrix;",
        "uniform mat4 projectionMatrix;",
        "uniform mat4 viewMatrix;",
        "uniform mat3 normalMatrix;",
        "uniform vec3 cameraPosition;",
        "uniform bool isOrthographic;",
        "#ifdef USE_INSTANCING",
        "	attribute mat4 instanceMatrix;",
        "#endif",
        "#ifdef USE_INSTANCING_COLOR",
        "	attribute vec3 instanceColor;",
        "#endif",
        "attribute vec3 position;",
        "attribute vec3 normal;",
        "attribute vec2 uv;",
        "#ifdef USE_UV1",
        "	attribute vec2 uv1;",
        "#endif",
        "#ifdef USE_UV2",
        "	attribute vec2 uv2;",
        "#endif",
        "#ifdef USE_UV3",
        "	attribute vec2 uv3;",
        "#endif",
        "#ifdef USE_TANGENT",
        "	attribute vec4 tangent;",
        "#endif",
        "#if defined( USE_COLOR_ALPHA )",
        "	attribute vec4 color;",
        "#elif defined( USE_COLOR )",
        "	attribute vec3 color;",
        "#endif",
        "#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )",
        "	attribute vec3 morphTarget0;",
        "	attribute vec3 morphTarget1;",
        "	attribute vec3 morphTarget2;",
        "	attribute vec3 morphTarget3;",
        "	#ifdef USE_MORPHNORMALS",
        "		attribute vec3 morphNormal0;",
        "		attribute vec3 morphNormal1;",
        "		attribute vec3 morphNormal2;",
        "		attribute vec3 morphNormal3;",
        "	#else",
        "		attribute vec3 morphTarget4;",
        "		attribute vec3 morphTarget5;",
        "		attribute vec3 morphTarget6;",
        "		attribute vec3 morphTarget7;",
        "	#endif",
        "#endif",
        "#ifdef USE_SKINNING",
        "	attribute vec4 skinIndex;",
        "	attribute vec4 skinWeight;",
        "#endif",
        "\n"
      ].filter(filterEmptyLine).join("\n");
      prefixFragment = [
        customExtensions,
        generatePrecision(parameters),
        "#define SHADER_TYPE " + parameters.shaderType,
        "#define SHADER_NAME " + parameters.shaderName,
        customDefines,
        parameters.useFog && parameters.fog ? "#define USE_FOG" : "",
        parameters.useFog && parameters.fogExp2 ? "#define FOG_EXP2" : "",
        parameters.map ? "#define USE_MAP" : "",
        parameters.matcap ? "#define USE_MATCAP" : "",
        parameters.envMap ? "#define USE_ENVMAP" : "",
        parameters.envMap ? "#define " + envMapTypeDefine : "",
        parameters.envMap ? "#define " + envMapModeDefine : "",
        parameters.envMap ? "#define " + envMapBlendingDefine : "",
        envMapCubeUVSize ? "#define CUBEUV_TEXEL_WIDTH " + envMapCubeUVSize.texelWidth : "",
        envMapCubeUVSize ? "#define CUBEUV_TEXEL_HEIGHT " + envMapCubeUVSize.texelHeight : "",
        envMapCubeUVSize ? "#define CUBEUV_MAX_MIP " + envMapCubeUVSize.maxMip + ".0" : "",
        parameters.lightMap ? "#define USE_LIGHTMAP" : "",
        parameters.aoMap ? "#define USE_AOMAP" : "",
        parameters.bumpMap ? "#define USE_BUMPMAP" : "",
        parameters.normalMap ? "#define USE_NORMALMAP" : "",
        parameters.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
        parameters.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
        parameters.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
        parameters.anisotropy ? "#define USE_ANISOTROPY" : "",
        parameters.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
        parameters.clearcoat ? "#define USE_CLEARCOAT" : "",
        parameters.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
        parameters.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
        parameters.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
        parameters.iridescence ? "#define USE_IRIDESCENCE" : "",
        parameters.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
        parameters.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
        parameters.specularMap ? "#define USE_SPECULARMAP" : "",
        parameters.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
        parameters.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
        parameters.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
        parameters.metalnessMap ? "#define USE_METALNESSMAP" : "",
        parameters.alphaMap ? "#define USE_ALPHAMAP" : "",
        parameters.alphaTest ? "#define USE_ALPHATEST" : "",
        parameters.alphaHash ? "#define USE_ALPHAHASH" : "",
        parameters.sheen ? "#define USE_SHEEN" : "",
        parameters.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
        parameters.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
        parameters.transmission ? "#define USE_TRANSMISSION" : "",
        parameters.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
        parameters.thicknessMap ? "#define USE_THICKNESSMAP" : "",
        parameters.vertexTangents && parameters.flatShading === false ? "#define USE_TANGENT" : "",
        parameters.vertexColors || parameters.instancingColor ? "#define USE_COLOR" : "",
        parameters.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
        parameters.vertexUv1s ? "#define USE_UV1" : "",
        parameters.vertexUv2s ? "#define USE_UV2" : "",
        parameters.vertexUv3s ? "#define USE_UV3" : "",
        parameters.pointsUvs ? "#define USE_POINTS_UV" : "",
        parameters.gradientMap ? "#define USE_GRADIENTMAP" : "",
        parameters.flatShading ? "#define FLAT_SHADED" : "",
        parameters.doubleSided ? "#define DOUBLE_SIDED" : "",
        parameters.flipSided ? "#define FLIP_SIDED" : "",
        parameters.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
        parameters.shadowMapEnabled ? "#define " + shadowMapTypeDefine : "",
        parameters.premultipliedAlpha ? "#define PREMULTIPLIED_ALPHA" : "",
        parameters.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
        parameters.useLegacyLights ? "#define LEGACY_LIGHTS" : "",
        parameters.decodeVideoTexture ? "#define DECODE_VIDEO_TEXTURE" : "",
        parameters.logarithmicDepthBuffer ? "#define USE_LOGDEPTHBUF" : "",
        parameters.logarithmicDepthBuffer && parameters.rendererExtensionFragDepth ? "#define USE_LOGDEPTHBUF_EXT" : "",
        "uniform mat4 viewMatrix;",
        "uniform vec3 cameraPosition;",
        "uniform bool isOrthographic;",
        parameters.toneMapping !== NoToneMapping ? "#define TONE_MAPPING" : "",
        parameters.toneMapping !== NoToneMapping ? ShaderChunk["tonemapping_pars_fragment"] : "",
        // this code is required here because it is used by the toneMapping() function defined below
        parameters.toneMapping !== NoToneMapping ? getToneMappingFunction("toneMapping", parameters.toneMapping) : "",
        parameters.dithering ? "#define DITHERING" : "",
        parameters.opaque ? "#define OPAQUE" : "",
        ShaderChunk["colorspace_pars_fragment"],
        // this code is required here because it is used by the various encoding/decoding function defined below
        getTexelEncodingFunction("linearToOutputTexel", parameters.outputColorSpace),
        parameters.useDepthPacking ? "#define DEPTH_PACKING " + parameters.depthPacking : "",
        "\n"
      ].filter(filterEmptyLine).join("\n");
    }
    vertexShader = resolveIncludes(vertexShader);
    vertexShader = replaceLightNums(vertexShader, parameters);
    vertexShader = replaceClippingPlaneNums(vertexShader, parameters);
    fragmentShader = resolveIncludes(fragmentShader);
    fragmentShader = replaceLightNums(fragmentShader, parameters);
    fragmentShader = replaceClippingPlaneNums(fragmentShader, parameters);
    vertexShader = unrollLoops(vertexShader);
    fragmentShader = unrollLoops(fragmentShader);
    if (parameters.isWebGL2 && parameters.isRawShaderMaterial !== true) {
      versionString = "#version 300 es\n";
      prefixVertex = [
        customVertexExtensions,
        "precision mediump sampler2DArray;",
        "#define attribute in",
        "#define varying out",
        "#define texture2D texture"
      ].join("\n") + "\n" + prefixVertex;
      prefixFragment = [
        "precision mediump sampler2DArray;",
        "#define varying in",
        parameters.glslVersion === GLSL3 ? "" : "layout(location = 0) out highp vec4 pc_fragColor;",
        parameters.glslVersion === GLSL3 ? "" : "#define gl_FragColor pc_fragColor",
        "#define gl_FragDepthEXT gl_FragDepth",
        "#define texture2D texture",
        "#define textureCube texture",
        "#define texture2DProj textureProj",
        "#define texture2DLodEXT textureLod",
        "#define texture2DProjLodEXT textureProjLod",
        "#define textureCubeLodEXT textureLod",
        "#define texture2DGradEXT textureGrad",
        "#define texture2DProjGradEXT textureProjGrad",
        "#define textureCubeGradEXT textureGrad"
      ].join("\n") + "\n" + prefixFragment;
    }
    const vertexGlsl = versionString + prefixVertex + vertexShader;
    const fragmentGlsl = versionString + prefixFragment + fragmentShader;
    const glVertexShader = WebGLShader(gl, gl.VERTEX_SHADER, vertexGlsl);
    const glFragmentShader = WebGLShader(gl, gl.FRAGMENT_SHADER, fragmentGlsl);
    gl.attachShader(program, glVertexShader);
    gl.attachShader(program, glFragmentShader);
    if (parameters.index0AttributeName !== void 0) {
      gl.bindAttribLocation(program, 0, parameters.index0AttributeName);
    } else if (parameters.morphTargets === true) {
      gl.bindAttribLocation(program, 0, "position");
    }
    gl.linkProgram(program);
    function onFirstUse(self2) {
      if (renderer.debug.checkShaderErrors) {
        const programLog = gl.getProgramInfoLog(program).trim();
        const vertexLog = gl.getShaderInfoLog(glVertexShader).trim();
        const fragmentLog = gl.getShaderInfoLog(glFragmentShader).trim();
        let runnable = true;
        let haveDiagnostics = true;
        if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
          runnable = false;
          if (typeof renderer.debug.onShaderError === "function") {
            renderer.debug.onShaderError(gl, program, glVertexShader, glFragmentShader);
          } else {
            const vertexErrors = getShaderErrors(gl, glVertexShader, "vertex");
            const fragmentErrors = getShaderErrors(gl, glFragmentShader, "fragment");
            console.error(
              "THREE.WebGLProgram: Shader Error " + gl.getError() + " - VALIDATE_STATUS " + gl.getProgramParameter(program, gl.VALIDATE_STATUS) + "\n\nProgram Info Log: " + programLog + "\n" + vertexErrors + "\n" + fragmentErrors
            );
          }
        } else if (programLog !== "") {
          console.warn("THREE.WebGLProgram: Program Info Log:", programLog);
        } else if (vertexLog === "" || fragmentLog === "") {
          haveDiagnostics = false;
        }
        if (haveDiagnostics) {
          self2.diagnostics = {
            runnable,
            programLog,
            vertexShader: {
              log: vertexLog,
              prefix: prefixVertex
            },
            fragmentShader: {
              log: fragmentLog,
              prefix: prefixFragment
            }
          };
        }
      }
      gl.deleteShader(glVertexShader);
      gl.deleteShader(glFragmentShader);
      cachedUniforms = new WebGLUniforms(gl, program);
      cachedAttributes = fetchAttributeLocations(gl, program);
    }
    let cachedUniforms;
    this.getUniforms = function() {
      if (cachedUniforms === void 0) {
        onFirstUse(this);
      }
      return cachedUniforms;
    };
    let cachedAttributes;
    this.getAttributes = function() {
      if (cachedAttributes === void 0) {
        onFirstUse(this);
      }
      return cachedAttributes;
    };
    let programReady = parameters.rendererExtensionParallelShaderCompile === false;
    this.isReady = function() {
      if (programReady === false) {
        programReady = gl.getProgramParameter(program, COMPLETION_STATUS_KHR);
      }
      return programReady;
    };
    this.destroy = function() {
      bindingStates.releaseStatesOfProgram(this);
      gl.deleteProgram(program);
      this.program = void 0;
    };
    this.type = parameters.shaderType;
    this.name = parameters.shaderName;
    this.id = programIdCount++;
    this.cacheKey = cacheKey;
    this.usedTimes = 1;
    this.program = program;
    this.vertexShader = glVertexShader;
    this.fragmentShader = glFragmentShader;
    return this;
  }
  var _id$1 = 0;
  var WebGLShaderCache = class {
    constructor() {
      this.shaderCache = /* @__PURE__ */ new Map();
      this.materialCache = /* @__PURE__ */ new Map();
    }
    update(material) {
      const vertexShader = material.vertexShader;
      const fragmentShader = material.fragmentShader;
      const vertexShaderStage = this._getShaderStage(vertexShader);
      const fragmentShaderStage = this._getShaderStage(fragmentShader);
      const materialShaders = this._getShaderCacheForMaterial(material);
      if (materialShaders.has(vertexShaderStage) === false) {
        materialShaders.add(vertexShaderStage);
        vertexShaderStage.usedTimes++;
      }
      if (materialShaders.has(fragmentShaderStage) === false) {
        materialShaders.add(fragmentShaderStage);
        fragmentShaderStage.usedTimes++;
      }
      return this;
    }
    remove(material) {
      const materialShaders = this.materialCache.get(material);
      for (const shaderStage of materialShaders) {
        shaderStage.usedTimes--;
        if (shaderStage.usedTimes === 0) this.shaderCache.delete(shaderStage.code);
      }
      this.materialCache.delete(material);
      return this;
    }
    getVertexShaderID(material) {
      return this._getShaderStage(material.vertexShader).id;
    }
    getFragmentShaderID(material) {
      return this._getShaderStage(material.fragmentShader).id;
    }
    dispose() {
      this.shaderCache.clear();
      this.materialCache.clear();
    }
    _getShaderCacheForMaterial(material) {
      const cache = this.materialCache;
      let set = cache.get(material);
      if (set === void 0) {
        set = /* @__PURE__ */ new Set();
        cache.set(material, set);
      }
      return set;
    }
    _getShaderStage(code) {
      const cache = this.shaderCache;
      let stage = cache.get(code);
      if (stage === void 0) {
        stage = new WebGLShaderStage(code);
        cache.set(code, stage);
      }
      return stage;
    }
  };
  var WebGLShaderStage = class {
    constructor(code) {
      this.id = _id$1++;
      this.code = code;
      this.usedTimes = 0;
    }
  };
  function WebGLPrograms(renderer, cubemaps, cubeuvmaps, extensions, capabilities, bindingStates, clipping) {
    const _programLayers = new Layers();
    const _customShaders = new WebGLShaderCache();
    const programs = [];
    const IS_WEBGL2 = capabilities.isWebGL2;
    const logarithmicDepthBuffer = capabilities.logarithmicDepthBuffer;
    const SUPPORTS_VERTEX_TEXTURES = capabilities.vertexTextures;
    let precision = capabilities.precision;
    const shaderIDs = {
      MeshDepthMaterial: "depth",
      MeshDistanceMaterial: "distanceRGBA",
      MeshNormalMaterial: "normal",
      MeshBasicMaterial: "basic",
      MeshLambertMaterial: "lambert",
      MeshPhongMaterial: "phong",
      MeshToonMaterial: "toon",
      MeshStandardMaterial: "physical",
      MeshPhysicalMaterial: "physical",
      MeshMatcapMaterial: "matcap",
      LineBasicMaterial: "basic",
      LineDashedMaterial: "dashed",
      PointsMaterial: "points",
      ShadowMaterial: "shadow",
      SpriteMaterial: "sprite"
    };
    function getChannel(value) {
      if (value === 0) return "uv";
      return `uv${value}`;
    }
    function getParameters(material, lights, shadows, scene, object) {
      const fog = scene.fog;
      const geometry = object.geometry;
      const environment = material.isMeshStandardMaterial ? scene.environment : null;
      const envMap = (material.isMeshStandardMaterial ? cubeuvmaps : cubemaps).get(material.envMap || environment);
      const envMapCubeUVHeight = !!envMap && envMap.mapping === CubeUVReflectionMapping ? envMap.image.height : null;
      const shaderID = shaderIDs[material.type];
      if (material.precision !== null) {
        precision = capabilities.getMaxPrecision(material.precision);
        if (precision !== material.precision) {
          console.warn("THREE.WebGLProgram.getParameters:", material.precision, "not supported, using", precision, "instead.");
        }
      }
      const morphAttribute = geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color;
      const morphTargetsCount = morphAttribute !== void 0 ? morphAttribute.length : 0;
      let morphTextureStride = 0;
      if (geometry.morphAttributes.position !== void 0) morphTextureStride = 1;
      if (geometry.morphAttributes.normal !== void 0) morphTextureStride = 2;
      if (geometry.morphAttributes.color !== void 0) morphTextureStride = 3;
      let vertexShader, fragmentShader;
      let customVertexShaderID, customFragmentShaderID;
      if (shaderID) {
        const shader = ShaderLib[shaderID];
        vertexShader = shader.vertexShader;
        fragmentShader = shader.fragmentShader;
      } else {
        vertexShader = material.vertexShader;
        fragmentShader = material.fragmentShader;
        _customShaders.update(material);
        customVertexShaderID = _customShaders.getVertexShaderID(material);
        customFragmentShaderID = _customShaders.getFragmentShaderID(material);
      }
      const currentRenderTarget = renderer.getRenderTarget();
      const IS_INSTANCEDMESH = object.isInstancedMesh === true;
      const IS_BATCHEDMESH = object.isBatchedMesh === true;
      const HAS_MAP = !!material.map;
      const HAS_MATCAP = !!material.matcap;
      const HAS_ENVMAP = !!envMap;
      const HAS_AOMAP = !!material.aoMap;
      const HAS_LIGHTMAP = !!material.lightMap;
      const HAS_BUMPMAP = !!material.bumpMap;
      const HAS_NORMALMAP = !!material.normalMap;
      const HAS_DISPLACEMENTMAP = !!material.displacementMap;
      const HAS_EMISSIVEMAP = !!material.emissiveMap;
      const HAS_METALNESSMAP = !!material.metalnessMap;
      const HAS_ROUGHNESSMAP = !!material.roughnessMap;
      const HAS_ANISOTROPY = material.anisotropy > 0;
      const HAS_CLEARCOAT = material.clearcoat > 0;
      const HAS_IRIDESCENCE = material.iridescence > 0;
      const HAS_SHEEN = material.sheen > 0;
      const HAS_TRANSMISSION = material.transmission > 0;
      const HAS_ANISOTROPYMAP = HAS_ANISOTROPY && !!material.anisotropyMap;
      const HAS_CLEARCOATMAP = HAS_CLEARCOAT && !!material.clearcoatMap;
      const HAS_CLEARCOAT_NORMALMAP = HAS_CLEARCOAT && !!material.clearcoatNormalMap;
      const HAS_CLEARCOAT_ROUGHNESSMAP = HAS_CLEARCOAT && !!material.clearcoatRoughnessMap;
      const HAS_IRIDESCENCEMAP = HAS_IRIDESCENCE && !!material.iridescenceMap;
      const HAS_IRIDESCENCE_THICKNESSMAP = HAS_IRIDESCENCE && !!material.iridescenceThicknessMap;
      const HAS_SHEEN_COLORMAP = HAS_SHEEN && !!material.sheenColorMap;
      const HAS_SHEEN_ROUGHNESSMAP = HAS_SHEEN && !!material.sheenRoughnessMap;
      const HAS_SPECULARMAP = !!material.specularMap;
      const HAS_SPECULAR_COLORMAP = !!material.specularColorMap;
      const HAS_SPECULAR_INTENSITYMAP = !!material.specularIntensityMap;
      const HAS_TRANSMISSIONMAP = HAS_TRANSMISSION && !!material.transmissionMap;
      const HAS_THICKNESSMAP = HAS_TRANSMISSION && !!material.thicknessMap;
      const HAS_GRADIENTMAP = !!material.gradientMap;
      const HAS_ALPHAMAP = !!material.alphaMap;
      const HAS_ALPHATEST = material.alphaTest > 0;
      const HAS_ALPHAHASH = !!material.alphaHash;
      const HAS_EXTENSIONS = !!material.extensions;
      const HAS_ATTRIBUTE_UV1 = !!geometry.attributes.uv1;
      const HAS_ATTRIBUTE_UV2 = !!geometry.attributes.uv2;
      const HAS_ATTRIBUTE_UV3 = !!geometry.attributes.uv3;
      let toneMapping = NoToneMapping;
      if (material.toneMapped) {
        if (currentRenderTarget === null || currentRenderTarget.isXRRenderTarget === true) {
          toneMapping = renderer.toneMapping;
        }
      }
      const parameters = {
        isWebGL2: IS_WEBGL2,
        shaderID,
        shaderType: material.type,
        shaderName: material.name,
        vertexShader,
        fragmentShader,
        defines: material.defines,
        customVertexShaderID,
        customFragmentShaderID,
        isRawShaderMaterial: material.isRawShaderMaterial === true,
        glslVersion: material.glslVersion,
        precision,
        batching: IS_BATCHEDMESH,
        instancing: IS_INSTANCEDMESH,
        instancingColor: IS_INSTANCEDMESH && object.instanceColor !== null,
        supportsVertexTextures: SUPPORTS_VERTEX_TEXTURES,
        outputColorSpace: currentRenderTarget === null ? renderer.outputColorSpace : currentRenderTarget.isXRRenderTarget === true ? currentRenderTarget.texture.colorSpace : LinearSRGBColorSpace,
        map: HAS_MAP,
        matcap: HAS_MATCAP,
        envMap: HAS_ENVMAP,
        envMapMode: HAS_ENVMAP && envMap.mapping,
        envMapCubeUVHeight,
        aoMap: HAS_AOMAP,
        lightMap: HAS_LIGHTMAP,
        bumpMap: HAS_BUMPMAP,
        normalMap: HAS_NORMALMAP,
        displacementMap: SUPPORTS_VERTEX_TEXTURES && HAS_DISPLACEMENTMAP,
        emissiveMap: HAS_EMISSIVEMAP,
        normalMapObjectSpace: HAS_NORMALMAP && material.normalMapType === ObjectSpaceNormalMap,
        normalMapTangentSpace: HAS_NORMALMAP && material.normalMapType === TangentSpaceNormalMap,
        metalnessMap: HAS_METALNESSMAP,
        roughnessMap: HAS_ROUGHNESSMAP,
        anisotropy: HAS_ANISOTROPY,
        anisotropyMap: HAS_ANISOTROPYMAP,
        clearcoat: HAS_CLEARCOAT,
        clearcoatMap: HAS_CLEARCOATMAP,
        clearcoatNormalMap: HAS_CLEARCOAT_NORMALMAP,
        clearcoatRoughnessMap: HAS_CLEARCOAT_ROUGHNESSMAP,
        iridescence: HAS_IRIDESCENCE,
        iridescenceMap: HAS_IRIDESCENCEMAP,
        iridescenceThicknessMap: HAS_IRIDESCENCE_THICKNESSMAP,
        sheen: HAS_SHEEN,
        sheenColorMap: HAS_SHEEN_COLORMAP,
        sheenRoughnessMap: HAS_SHEEN_ROUGHNESSMAP,
        specularMap: HAS_SPECULARMAP,
        specularColorMap: HAS_SPECULAR_COLORMAP,
        specularIntensityMap: HAS_SPECULAR_INTENSITYMAP,
        transmission: HAS_TRANSMISSION,
        transmissionMap: HAS_TRANSMISSIONMAP,
        thicknessMap: HAS_THICKNESSMAP,
        gradientMap: HAS_GRADIENTMAP,
        opaque: material.transparent === false && material.blending === NormalBlending,
        alphaMap: HAS_ALPHAMAP,
        alphaTest: HAS_ALPHATEST,
        alphaHash: HAS_ALPHAHASH,
        combine: material.combine,
        //
        mapUv: HAS_MAP && getChannel(material.map.channel),
        aoMapUv: HAS_AOMAP && getChannel(material.aoMap.channel),
        lightMapUv: HAS_LIGHTMAP && getChannel(material.lightMap.channel),
        bumpMapUv: HAS_BUMPMAP && getChannel(material.bumpMap.channel),
        normalMapUv: HAS_NORMALMAP && getChannel(material.normalMap.channel),
        displacementMapUv: HAS_DISPLACEMENTMAP && getChannel(material.displacementMap.channel),
        emissiveMapUv: HAS_EMISSIVEMAP && getChannel(material.emissiveMap.channel),
        metalnessMapUv: HAS_METALNESSMAP && getChannel(material.metalnessMap.channel),
        roughnessMapUv: HAS_ROUGHNESSMAP && getChannel(material.roughnessMap.channel),
        anisotropyMapUv: HAS_ANISOTROPYMAP && getChannel(material.anisotropyMap.channel),
        clearcoatMapUv: HAS_CLEARCOATMAP && getChannel(material.clearcoatMap.channel),
        clearcoatNormalMapUv: HAS_CLEARCOAT_NORMALMAP && getChannel(material.clearcoatNormalMap.channel),
        clearcoatRoughnessMapUv: HAS_CLEARCOAT_ROUGHNESSMAP && getChannel(material.clearcoatRoughnessMap.channel),
        iridescenceMapUv: HAS_IRIDESCENCEMAP && getChannel(material.iridescenceMap.channel),
        iridescenceThicknessMapUv: HAS_IRIDESCENCE_THICKNESSMAP && getChannel(material.iridescenceThicknessMap.channel),
        sheenColorMapUv: HAS_SHEEN_COLORMAP && getChannel(material.sheenColorMap.channel),
        sheenRoughnessMapUv: HAS_SHEEN_ROUGHNESSMAP && getChannel(material.sheenRoughnessMap.channel),
        specularMapUv: HAS_SPECULARMAP && getChannel(material.specularMap.channel),
        specularColorMapUv: HAS_SPECULAR_COLORMAP && getChannel(material.specularColorMap.channel),
        specularIntensityMapUv: HAS_SPECULAR_INTENSITYMAP && getChannel(material.specularIntensityMap.channel),
        transmissionMapUv: HAS_TRANSMISSIONMAP && getChannel(material.transmissionMap.channel),
        thicknessMapUv: HAS_THICKNESSMAP && getChannel(material.thicknessMap.channel),
        alphaMapUv: HAS_ALPHAMAP && getChannel(material.alphaMap.channel),
        //
        vertexTangents: !!geometry.attributes.tangent && (HAS_NORMALMAP || HAS_ANISOTROPY),
        vertexColors: material.vertexColors,
        vertexAlphas: material.vertexColors === true && !!geometry.attributes.color && geometry.attributes.color.itemSize === 4,
        vertexUv1s: HAS_ATTRIBUTE_UV1,
        vertexUv2s: HAS_ATTRIBUTE_UV2,
        vertexUv3s: HAS_ATTRIBUTE_UV3,
        pointsUvs: object.isPoints === true && !!geometry.attributes.uv && (HAS_MAP || HAS_ALPHAMAP),
        fog: !!fog,
        useFog: material.fog === true,
        fogExp2: fog && fog.isFogExp2,
        flatShading: material.flatShading === true,
        sizeAttenuation: material.sizeAttenuation === true,
        logarithmicDepthBuffer,
        skinning: object.isSkinnedMesh === true,
        morphTargets: geometry.morphAttributes.position !== void 0,
        morphNormals: geometry.morphAttributes.normal !== void 0,
        morphColors: geometry.morphAttributes.color !== void 0,
        morphTargetsCount,
        morphTextureStride,
        numDirLights: lights.directional.length,
        numPointLights: lights.point.length,
        numSpotLights: lights.spot.length,
        numSpotLightMaps: lights.spotLightMap.length,
        numRectAreaLights: lights.rectArea.length,
        numHemiLights: lights.hemi.length,
        numDirLightShadows: lights.directionalShadowMap.length,
        numPointLightShadows: lights.pointShadowMap.length,
        numSpotLightShadows: lights.spotShadowMap.length,
        numSpotLightShadowsWithMaps: lights.numSpotLightShadowsWithMaps,
        numLightProbes: lights.numLightProbes,
        numClippingPlanes: clipping.numPlanes,
        numClipIntersection: clipping.numIntersection,
        dithering: material.dithering,
        shadowMapEnabled: renderer.shadowMap.enabled && shadows.length > 0,
        shadowMapType: renderer.shadowMap.type,
        toneMapping,
        useLegacyLights: renderer._useLegacyLights,
        decodeVideoTexture: HAS_MAP && material.map.isVideoTexture === true && ColorManagement.getTransfer(material.map.colorSpace) === SRGBTransfer,
        premultipliedAlpha: material.premultipliedAlpha,
        doubleSided: material.side === DoubleSide,
        flipSided: material.side === BackSide,
        useDepthPacking: material.depthPacking >= 0,
        depthPacking: material.depthPacking || 0,
        index0AttributeName: material.index0AttributeName,
        extensionDerivatives: HAS_EXTENSIONS && material.extensions.derivatives === true,
        extensionFragDepth: HAS_EXTENSIONS && material.extensions.fragDepth === true,
        extensionDrawBuffers: HAS_EXTENSIONS && material.extensions.drawBuffers === true,
        extensionShaderTextureLOD: HAS_EXTENSIONS && material.extensions.shaderTextureLOD === true,
        extensionClipCullDistance: HAS_EXTENSIONS && material.extensions.clipCullDistance && extensions.has("WEBGL_clip_cull_distance"),
        rendererExtensionFragDepth: IS_WEBGL2 || extensions.has("EXT_frag_depth"),
        rendererExtensionDrawBuffers: IS_WEBGL2 || extensions.has("WEBGL_draw_buffers"),
        rendererExtensionShaderTextureLod: IS_WEBGL2 || extensions.has("EXT_shader_texture_lod"),
        rendererExtensionParallelShaderCompile: extensions.has("KHR_parallel_shader_compile"),
        customProgramCacheKey: material.customProgramCacheKey()
      };
      return parameters;
    }
    function getProgramCacheKey(parameters) {
      const array = [];
      if (parameters.shaderID) {
        array.push(parameters.shaderID);
      } else {
        array.push(parameters.customVertexShaderID);
        array.push(parameters.customFragmentShaderID);
      }
      if (parameters.defines !== void 0) {
        for (const name in parameters.defines) {
          array.push(name);
          array.push(parameters.defines[name]);
        }
      }
      if (parameters.isRawShaderMaterial === false) {
        getProgramCacheKeyParameters(array, parameters);
        getProgramCacheKeyBooleans(array, parameters);
        array.push(renderer.outputColorSpace);
      }
      array.push(parameters.customProgramCacheKey);
      return array.join();
    }
    function getProgramCacheKeyParameters(array, parameters) {
      array.push(parameters.precision);
      array.push(parameters.outputColorSpace);
      array.push(parameters.envMapMode);
      array.push(parameters.envMapCubeUVHeight);
      array.push(parameters.mapUv);
      array.push(parameters.alphaMapUv);
      array.push(parameters.lightMapUv);
      array.push(parameters.aoMapUv);
      array.push(parameters.bumpMapUv);
      array.push(parameters.normalMapUv);
      array.push(parameters.displacementMapUv);
      array.push(parameters.emissiveMapUv);
      array.push(parameters.metalnessMapUv);
      array.push(parameters.roughnessMapUv);
      array.push(parameters.anisotropyMapUv);
      array.push(parameters.clearcoatMapUv);
      array.push(parameters.clearcoatNormalMapUv);
      array.push(parameters.clearcoatRoughnessMapUv);
      array.push(parameters.iridescenceMapUv);
      array.push(parameters.iridescenceThicknessMapUv);
      array.push(parameters.sheenColorMapUv);
      array.push(parameters.sheenRoughnessMapUv);
      array.push(parameters.specularMapUv);
      array.push(parameters.specularColorMapUv);
      array.push(parameters.specularIntensityMapUv);
      array.push(parameters.transmissionMapUv);
      array.push(parameters.thicknessMapUv);
      array.push(parameters.combine);
      array.push(parameters.fogExp2);
      array.push(parameters.sizeAttenuation);
      array.push(parameters.morphTargetsCount);
      array.push(parameters.morphAttributeCount);
      array.push(parameters.numDirLights);
      array.push(parameters.numPointLights);
      array.push(parameters.numSpotLights);
      array.push(parameters.numSpotLightMaps);
      array.push(parameters.numHemiLights);
      array.push(parameters.numRectAreaLights);
      array.push(parameters.numDirLightShadows);
      array.push(parameters.numPointLightShadows);
      array.push(parameters.numSpotLightShadows);
      array.push(parameters.numSpotLightShadowsWithMaps);
      array.push(parameters.numLightProbes);
      array.push(parameters.shadowMapType);
      array.push(parameters.toneMapping);
      array.push(parameters.numClippingPlanes);
      array.push(parameters.numClipIntersection);
      array.push(parameters.depthPacking);
    }
    function getProgramCacheKeyBooleans(array, parameters) {
      _programLayers.disableAll();
      if (parameters.isWebGL2)
        _programLayers.enable(0);
      if (parameters.supportsVertexTextures)
        _programLayers.enable(1);
      if (parameters.instancing)
        _programLayers.enable(2);
      if (parameters.instancingColor)
        _programLayers.enable(3);
      if (parameters.matcap)
        _programLayers.enable(4);
      if (parameters.envMap)
        _programLayers.enable(5);
      if (parameters.normalMapObjectSpace)
        _programLayers.enable(6);
      if (parameters.normalMapTangentSpace)
        _programLayers.enable(7);
      if (parameters.clearcoat)
        _programLayers.enable(8);
      if (parameters.iridescence)
        _programLayers.enable(9);
      if (parameters.alphaTest)
        _programLayers.enable(10);
      if (parameters.vertexColors)
        _programLayers.enable(11);
      if (parameters.vertexAlphas)
        _programLayers.enable(12);
      if (parameters.vertexUv1s)
        _programLayers.enable(13);
      if (parameters.vertexUv2s)
        _programLayers.enable(14);
      if (parameters.vertexUv3s)
        _programLayers.enable(15);
      if (parameters.vertexTangents)
        _programLayers.enable(16);
      if (parameters.anisotropy)
        _programLayers.enable(17);
      if (parameters.alphaHash)
        _programLayers.enable(18);
      if (parameters.batching)
        _programLayers.enable(19);
      array.push(_programLayers.mask);
      _programLayers.disableAll();
      if (parameters.fog)
        _programLayers.enable(0);
      if (parameters.useFog)
        _programLayers.enable(1);
      if (parameters.flatShading)
        _programLayers.enable(2);
      if (parameters.logarithmicDepthBuffer)
        _programLayers.enable(3);
      if (parameters.skinning)
        _programLayers.enable(4);
      if (parameters.morphTargets)
        _programLayers.enable(5);
      if (parameters.morphNormals)
        _programLayers.enable(6);
      if (parameters.morphColors)
        _programLayers.enable(7);
      if (parameters.premultipliedAlpha)
        _programLayers.enable(8);
      if (parameters.shadowMapEnabled)
        _programLayers.enable(9);
      if (parameters.useLegacyLights)
        _programLayers.enable(10);
      if (parameters.doubleSided)
        _programLayers.enable(11);
      if (parameters.flipSided)
        _programLayers.enable(12);
      if (parameters.useDepthPacking)
        _programLayers.enable(13);
      if (parameters.dithering)
        _programLayers.enable(14);
      if (parameters.transmission)
        _programLayers.enable(15);
      if (parameters.sheen)
        _programLayers.enable(16);
      if (parameters.opaque)
        _programLayers.enable(17);
      if (parameters.pointsUvs)
        _programLayers.enable(18);
      if (parameters.decodeVideoTexture)
        _programLayers.enable(19);
      array.push(_programLayers.mask);
    }
    function getUniforms(material) {
      const shaderID = shaderIDs[material.type];
      let uniforms;
      if (shaderID) {
        const shader = ShaderLib[shaderID];
        uniforms = UniformsUtils.clone(shader.uniforms);
      } else {
        uniforms = material.uniforms;
      }
      return uniforms;
    }
    function acquireProgram(parameters, cacheKey) {
      let program;
      for (let p = 0, pl = programs.length; p < pl; p++) {
        const preexistingProgram = programs[p];
        if (preexistingProgram.cacheKey === cacheKey) {
          program = preexistingProgram;
          ++program.usedTimes;
          break;
        }
      }
      if (program === void 0) {
        program = new WebGLProgram(renderer, cacheKey, parameters, bindingStates);
        programs.push(program);
      }
      return program;
    }
    function releaseProgram(program) {
      if (--program.usedTimes === 0) {
        const i = programs.indexOf(program);
        programs[i] = programs[programs.length - 1];
        programs.pop();
        program.destroy();
      }
    }
    function releaseShaderCache(material) {
      _customShaders.remove(material);
    }
    function dispose() {
      _customShaders.dispose();
    }
    return {
      getParameters,
      getProgramCacheKey,
      getUniforms,
      acquireProgram,
      releaseProgram,
      releaseShaderCache,
      // Exposed for resource monitoring & error feedback via renderer.info:
      programs,
      dispose
    };
  }
  function WebGLProperties() {
    let properties = /* @__PURE__ */ new WeakMap();
    function get(object) {
      let map = properties.get(object);
      if (map === void 0) {
        map = {};
        properties.set(object, map);
      }
      return map;
    }
    function remove(object) {
      properties.delete(object);
    }
    function update(object, key, value) {
      properties.get(object)[key] = value;
    }
    function dispose() {
      properties = /* @__PURE__ */ new WeakMap();
    }
    return {
      get,
      remove,
      update,
      dispose
    };
  }
  function painterSortStable(a, b) {
    if (a.groupOrder !== b.groupOrder) {
      return a.groupOrder - b.groupOrder;
    } else if (a.renderOrder !== b.renderOrder) {
      return a.renderOrder - b.renderOrder;
    } else if (a.material.id !== b.material.id) {
      return a.material.id - b.material.id;
    } else if (a.z !== b.z) {
      return a.z - b.z;
    } else {
      return a.id - b.id;
    }
  }
  function reversePainterSortStable(a, b) {
    if (a.groupOrder !== b.groupOrder) {
      return a.groupOrder - b.groupOrder;
    } else if (a.renderOrder !== b.renderOrder) {
      return a.renderOrder - b.renderOrder;
    } else if (a.z !== b.z) {
      return b.z - a.z;
    } else {
      return a.id - b.id;
    }
  }
  function WebGLRenderList() {
    const renderItems = [];
    let renderItemsIndex = 0;
    const opaque = [];
    const transmissive = [];
    const transparent = [];
    function init() {
      renderItemsIndex = 0;
      opaque.length = 0;
      transmissive.length = 0;
      transparent.length = 0;
    }
    function getNextRenderItem(object, geometry, material, groupOrder, z, group) {
      let renderItem = renderItems[renderItemsIndex];
      if (renderItem === void 0) {
        renderItem = {
          id: object.id,
          object,
          geometry,
          material,
          groupOrder,
          renderOrder: object.renderOrder,
          z,
          group
        };
        renderItems[renderItemsIndex] = renderItem;
      } else {
        renderItem.id = object.id;
        renderItem.object = object;
        renderItem.geometry = geometry;
        renderItem.material = material;
        renderItem.groupOrder = groupOrder;
        renderItem.renderOrder = object.renderOrder;
        renderItem.z = z;
        renderItem.group = group;
      }
      renderItemsIndex++;
      return renderItem;
    }
    function push(object, geometry, material, groupOrder, z, group) {
      const renderItem = getNextRenderItem(object, geometry, material, groupOrder, z, group);
      if (material.transmission > 0) {
        transmissive.push(renderItem);
      } else if (material.transparent === true) {
        transparent.push(renderItem);
      } else {
        opaque.push(renderItem);
      }
    }
    function unshift(object, geometry, material, groupOrder, z, group) {
      const renderItem = getNextRenderItem(object, geometry, material, groupOrder, z, group);
      if (material.transmission > 0) {
        transmissive.unshift(renderItem);
      } else if (material.transparent === true) {
        transparent.unshift(renderItem);
      } else {
        opaque.unshift(renderItem);
      }
    }
    function sort(customOpaqueSort, customTransparentSort) {
      if (opaque.length > 1) opaque.sort(customOpaqueSort || painterSortStable);
      if (transmissive.length > 1) transmissive.sort(customTransparentSort || reversePainterSortStable);
      if (transparent.length > 1) transparent.sort(customTransparentSort || reversePainterSortStable);
    }
    function finish() {
      for (let i = renderItemsIndex, il = renderItems.length; i < il; i++) {
        const renderItem = renderItems[i];
        if (renderItem.id === null) break;
        renderItem.id = null;
        renderItem.object = null;
        renderItem.geometry = null;
        renderItem.material = null;
        renderItem.group = null;
      }
    }
    return {
      opaque,
      transmissive,
      transparent,
      init,
      push,
      unshift,
      finish,
      sort
    };
  }
  function WebGLRenderLists() {
    let lists = /* @__PURE__ */ new WeakMap();
    function get(scene, renderCallDepth) {
      const listArray = lists.get(scene);
      let list;
      if (listArray === void 0) {
        list = new WebGLRenderList();
        lists.set(scene, [list]);
      } else {
        if (renderCallDepth >= listArray.length) {
          list = new WebGLRenderList();
          listArray.push(list);
        } else {
          list = listArray[renderCallDepth];
        }
      }
      return list;
    }
    function dispose() {
      lists = /* @__PURE__ */ new WeakMap();
    }
    return {
      get,
      dispose
    };
  }
  function UniformsCache() {
    const lights = {};
    return {
      get: function(light) {
        if (lights[light.id] !== void 0) {
          return lights[light.id];
        }
        let uniforms;
        switch (light.type) {
          case "DirectionalLight":
            uniforms = {
              direction: new Vector3(),
              color: new Color()
            };
            break;
          case "SpotLight":
            uniforms = {
              position: new Vector3(),
              direction: new Vector3(),
              color: new Color(),
              distance: 0,
              coneCos: 0,
              penumbraCos: 0,
              decay: 0
            };
            break;
          case "PointLight":
            uniforms = {
              position: new Vector3(),
              color: new Color(),
              distance: 0,
              decay: 0
            };
            break;
          case "HemisphereLight":
            uniforms = {
              direction: new Vector3(),
              skyColor: new Color(),
              groundColor: new Color()
            };
            break;
          case "RectAreaLight":
            uniforms = {
              color: new Color(),
              position: new Vector3(),
              halfWidth: new Vector3(),
              halfHeight: new Vector3()
            };
            break;
        }
        lights[light.id] = uniforms;
        return uniforms;
      }
    };
  }
  function ShadowUniformsCache() {
    const lights = {};
    return {
      get: function(light) {
        if (lights[light.id] !== void 0) {
          return lights[light.id];
        }
        let uniforms;
        switch (light.type) {
          case "DirectionalLight":
            uniforms = {
              shadowBias: 0,
              shadowNormalBias: 0,
              shadowRadius: 1,
              shadowMapSize: new Vector2()
            };
            break;
          case "SpotLight":
            uniforms = {
              shadowBias: 0,
              shadowNormalBias: 0,
              shadowRadius: 1,
              shadowMapSize: new Vector2()
            };
            break;
          case "PointLight":
            uniforms = {
              shadowBias: 0,
              shadowNormalBias: 0,
              shadowRadius: 1,
              shadowMapSize: new Vector2(),
              shadowCameraNear: 1,
              shadowCameraFar: 1e3
            };
            break;
        }
        lights[light.id] = uniforms;
        return uniforms;
      }
    };
  }
  var nextVersion = 0;
  function shadowCastingAndTexturingLightsFirst(lightA, lightB) {
    return (lightB.castShadow ? 2 : 0) - (lightA.castShadow ? 2 : 0) + (lightB.map ? 1 : 0) - (lightA.map ? 1 : 0);
  }
  function WebGLLights(extensions, capabilities) {
    const cache = new UniformsCache();
    const shadowCache = ShadowUniformsCache();
    const state = {
      version: 0,
      hash: {
        directionalLength: -1,
        pointLength: -1,
        spotLength: -1,
        rectAreaLength: -1,
        hemiLength: -1,
        numDirectionalShadows: -1,
        numPointShadows: -1,
        numSpotShadows: -1,
        numSpotMaps: -1,
        numLightProbes: -1
      },
      ambient: [0, 0, 0],
      probe: [],
      directional: [],
      directionalShadow: [],
      directionalShadowMap: [],
      directionalShadowMatrix: [],
      spot: [],
      spotLightMap: [],
      spotShadow: [],
      spotShadowMap: [],
      spotLightMatrix: [],
      rectArea: [],
      rectAreaLTC1: null,
      rectAreaLTC2: null,
      point: [],
      pointShadow: [],
      pointShadowMap: [],
      pointShadowMatrix: [],
      hemi: [],
      numSpotLightShadowsWithMaps: 0,
      numLightProbes: 0
    };
    for (let i = 0; i < 9; i++) state.probe.push(new Vector3());
    const vector3 = new Vector3();
    const matrix4 = new Matrix4();
    const matrix42 = new Matrix4();
    function setup(lights, useLegacyLights) {
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < 9; i++) state.probe[i].set(0, 0, 0);
      let directionalLength = 0;
      let pointLength = 0;
      let spotLength = 0;
      let rectAreaLength = 0;
      let hemiLength = 0;
      let numDirectionalShadows = 0;
      let numPointShadows = 0;
      let numSpotShadows = 0;
      let numSpotMaps = 0;
      let numSpotShadowsWithMaps = 0;
      let numLightProbes = 0;
      lights.sort(shadowCastingAndTexturingLightsFirst);
      const scaleFactor = useLegacyLights === true ? Math.PI : 1;
      for (let i = 0, l = lights.length; i < l; i++) {
        const light = lights[i];
        const color = light.color;
        const intensity = light.intensity;
        const distance = light.distance;
        const shadowMap = light.shadow && light.shadow.map ? light.shadow.map.texture : null;
        if (light.isAmbientLight) {
          r += color.r * intensity * scaleFactor;
          g += color.g * intensity * scaleFactor;
          b += color.b * intensity * scaleFactor;
        } else if (light.isLightProbe) {
          for (let j = 0; j < 9; j++) {
            state.probe[j].addScaledVector(light.sh.coefficients[j], intensity);
          }
          numLightProbes++;
        } else if (light.isDirectionalLight) {
          const uniforms = cache.get(light);
          uniforms.color.copy(light.color).multiplyScalar(light.intensity * scaleFactor);
          if (light.castShadow) {
            const shadow = light.shadow;
            const shadowUniforms = shadowCache.get(light);
            shadowUniforms.shadowBias = shadow.bias;
            shadowUniforms.shadowNormalBias = shadow.normalBias;
            shadowUniforms.shadowRadius = shadow.radius;
            shadowUniforms.shadowMapSize = shadow.mapSize;
            state.directionalShadow[directionalLength] = shadowUniforms;
            state.directionalShadowMap[directionalLength] = shadowMap;
            state.directionalShadowMatrix[directionalLength] = light.shadow.matrix;
            numDirectionalShadows++;
          }
          state.directional[directionalLength] = uniforms;
          directionalLength++;
        } else if (light.isSpotLight) {
          const uniforms = cache.get(light);
          uniforms.position.setFromMatrixPosition(light.matrixWorld);
          uniforms.color.copy(color).multiplyScalar(intensity * scaleFactor);
          uniforms.distance = distance;
          uniforms.coneCos = Math.cos(light.angle);
          uniforms.penumbraCos = Math.cos(light.angle * (1 - light.penumbra));
          uniforms.decay = light.decay;
          state.spot[spotLength] = uniforms;
          const shadow = light.shadow;
          if (light.map) {
            state.spotLightMap[numSpotMaps] = light.map;
            numSpotMaps++;
            shadow.updateMatrices(light);
            if (light.castShadow) numSpotShadowsWithMaps++;
          }
          state.spotLightMatrix[spotLength] = shadow.matrix;
          if (light.castShadow) {
            const shadowUniforms = shadowCache.get(light);
            shadowUniforms.shadowBias = shadow.bias;
            shadowUniforms.shadowNormalBias = shadow.normalBias;
            shadowUniforms.shadowRadius = shadow.radius;
            shadowUniforms.shadowMapSize = shadow.mapSize;
            state.spotShadow[spotLength] = shadowUniforms;
            state.spotShadowMap[spotLength] = shadowMap;
            numSpotShadows++;
          }
          spotLength++;
        } else if (light.isRectAreaLight) {
          const uniforms = cache.get(light);
          uniforms.color.copy(color).multiplyScalar(intensity);
          uniforms.halfWidth.set(light.width * 0.5, 0, 0);
          uniforms.halfHeight.set(0, light.height * 0.5, 0);
          state.rectArea[rectAreaLength] = uniforms;
          rectAreaLength++;
        } else if (light.isPointLight) {
          const uniforms = cache.get(light);
          uniforms.color.copy(light.color).multiplyScalar(light.intensity * scaleFactor);
          uniforms.distance = light.distance;
          uniforms.decay = light.decay;
          if (light.castShadow) {
            const shadow = light.shadow;
            const shadowUniforms = shadowCache.get(light);
            shadowUniforms.shadowBias = shadow.bias;
            shadowUniforms.shadowNormalBias = shadow.normalBias;
            shadowUniforms.shadowRadius = shadow.radius;
            shadowUniforms.shadowMapSize = shadow.mapSize;
            shadowUniforms.shadowCameraNear = shadow.camera.near;
            shadowUniforms.shadowCameraFar = shadow.camera.far;
            state.pointShadow[pointLength] = shadowUniforms;
            state.pointShadowMap[pointLength] = shadowMap;
            state.pointShadowMatrix[pointLength] = light.shadow.matrix;
            numPointShadows++;
          }
          state.point[pointLength] = uniforms;
          pointLength++;
        } else if (light.isHemisphereLight) {
          const uniforms = cache.get(light);
          uniforms.skyColor.copy(light.color).multiplyScalar(intensity * scaleFactor);
          uniforms.groundColor.copy(light.groundColor).multiplyScalar(intensity * scaleFactor);
          state.hemi[hemiLength] = uniforms;
          hemiLength++;
        }
      }
      if (rectAreaLength > 0) {
        if (capabilities.isWebGL2) {
          if (extensions.has("OES_texture_float_linear") === true) {
            state.rectAreaLTC1 = UniformsLib.LTC_FLOAT_1;
            state.rectAreaLTC2 = UniformsLib.LTC_FLOAT_2;
          } else {
            state.rectAreaLTC1 = UniformsLib.LTC_HALF_1;
            state.rectAreaLTC2 = UniformsLib.LTC_HALF_2;
          }
        } else {
          if (extensions.has("OES_texture_float_linear") === true) {
            state.rectAreaLTC1 = UniformsLib.LTC_FLOAT_1;
            state.rectAreaLTC2 = UniformsLib.LTC_FLOAT_2;
          } else if (extensions.has("OES_texture_half_float_linear") === true) {
            state.rectAreaLTC1 = UniformsLib.LTC_HALF_1;
            state.rectAreaLTC2 = UniformsLib.LTC_HALF_2;
          } else {
            console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.");
          }
        }
      }
      state.ambient[0] = r;
      state.ambient[1] = g;
      state.ambient[2] = b;
      const hash = state.hash;
      if (hash.directionalLength !== directionalLength || hash.pointLength !== pointLength || hash.spotLength !== spotLength || hash.rectAreaLength !== rectAreaLength || hash.hemiLength !== hemiLength || hash.numDirectionalShadows !== numDirectionalShadows || hash.numPointShadows !== numPointShadows || hash.numSpotShadows !== numSpotShadows || hash.numSpotMaps !== numSpotMaps || hash.numLightProbes !== numLightProbes) {
        state.directional.length = directionalLength;
        state.spot.length = spotLength;
        state.rectArea.length = rectAreaLength;
        state.point.length = pointLength;
        state.hemi.length = hemiLength;
        state.directionalShadow.length = numDirectionalShadows;
        state.directionalShadowMap.length = numDirectionalShadows;
        state.pointShadow.length = numPointShadows;
        state.pointShadowMap.length = numPointShadows;
        state.spotShadow.length = numSpotShadows;
        state.spotShadowMap.length = numSpotShadows;
        state.directionalShadowMatrix.length = numDirectionalShadows;
        state.pointShadowMatrix.length = numPointShadows;
        state.spotLightMatrix.length = numSpotShadows + numSpotMaps - numSpotShadowsWithMaps;
        state.spotLightMap.length = numSpotMaps;
        state.numSpotLightShadowsWithMaps = numSpotShadowsWithMaps;
        state.numLightProbes = numLightProbes;
        hash.directionalLength = directionalLength;
        hash.pointLength = pointLength;
        hash.spotLength = spotLength;
        hash.rectAreaLength = rectAreaLength;
        hash.hemiLength = hemiLength;
        hash.numDirectionalShadows = numDirectionalShadows;
        hash.numPointShadows = numPointShadows;
        hash.numSpotShadows = numSpotShadows;
        hash.numSpotMaps = numSpotMaps;
        hash.numLightProbes = numLightProbes;
        state.version = nextVersion++;
      }
    }
    function setupView(lights, camera) {
      let directionalLength = 0;
      let pointLength = 0;
      let spotLength = 0;
      let rectAreaLength = 0;
      let hemiLength = 0;
      const viewMatrix = camera.matrixWorldInverse;
      for (let i = 0, l = lights.length; i < l; i++) {
        const light = lights[i];
        if (light.isDirectionalLight) {
          const uniforms = state.directional[directionalLength];
          uniforms.direction.setFromMatrixPosition(light.matrixWorld);
          vector3.setFromMatrixPosition(light.target.matrixWorld);
          uniforms.direction.sub(vector3);
          uniforms.direction.transformDirection(viewMatrix);
          directionalLength++;
        } else if (light.isSpotLight) {
          const uniforms = state.spot[spotLength];
          uniforms.position.setFromMatrixPosition(light.matrixWorld);
          uniforms.position.applyMatrix4(viewMatrix);
          uniforms.direction.setFromMatrixPosition(light.matrixWorld);
          vector3.setFromMatrixPosition(light.target.matrixWorld);
          uniforms.direction.sub(vector3);
          uniforms.direction.transformDirection(viewMatrix);
          spotLength++;
        } else if (light.isRectAreaLight) {
          const uniforms = state.rectArea[rectAreaLength];
          uniforms.position.setFromMatrixPosition(light.matrixWorld);
          uniforms.position.applyMatrix4(viewMatrix);
          matrix42.identity();
          matrix4.copy(light.matrixWorld);
          matrix4.premultiply(viewMatrix);
          matrix42.extractRotation(matrix4);
          uniforms.halfWidth.set(light.width * 0.5, 0, 0);
          uniforms.halfHeight.set(0, light.height * 0.5, 0);
          uniforms.halfWidth.applyMatrix4(matrix42);
          uniforms.halfHeight.applyMatrix4(matrix42);
          rectAreaLength++;
        } else if (light.isPointLight) {
          const uniforms = state.point[pointLength];
          uniforms.position.setFromMatrixPosition(light.matrixWorld);
          uniforms.position.applyMatrix4(viewMatrix);
          pointLength++;
        } else if (light.isHemisphereLight) {
          const uniforms = state.hemi[hemiLength];
          uniforms.direction.setFromMatrixPosition(light.matrixWorld);
          uniforms.direction.transformDirection(viewMatrix);
          hemiLength++;
        }
      }
    }
    return {
      setup,
      setupView,
      state
    };
  }
  function WebGLRenderState(extensions, capabilities) {
    const lights = new WebGLLights(extensions, capabilities);
    const lightsArray = [];
    const shadowsArray = [];
    function init() {
      lightsArray.length = 0;
      shadowsArray.length = 0;
    }
    function pushLight(light) {
      lightsArray.push(light);
    }
    function pushShadow(shadowLight) {
      shadowsArray.push(shadowLight);
    }
    function setupLights(useLegacyLights) {
      lights.setup(lightsArray, useLegacyLights);
    }
    function setupLightsView(camera) {
      lights.setupView(lightsArray, camera);
    }
    const state = {
      lightsArray,
      shadowsArray,
      lights
    };
    return {
      init,
      state,
      setupLights,
      setupLightsView,
      pushLight,
      pushShadow
    };
  }
  function WebGLRenderStates(extensions, capabilities) {
    let renderStates = /* @__PURE__ */ new WeakMap();
    function get(scene, renderCallDepth = 0) {
      const renderStateArray = renderStates.get(scene);
      let renderState;
      if (renderStateArray === void 0) {
        renderState = new WebGLRenderState(extensions, capabilities);
        renderStates.set(scene, [renderState]);
      } else {
        if (renderCallDepth >= renderStateArray.length) {
          renderState = new WebGLRenderState(extensions, capabilities);
          renderStateArray.push(renderState);
        } else {
          renderState = renderStateArray[renderCallDepth];
        }
      }
      return renderState;
    }
    function dispose() {
      renderStates = /* @__PURE__ */ new WeakMap();
    }
    return {
      get,
      dispose
    };
  }
  var MeshDepthMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isMeshDepthMaterial = true;
      this.type = "MeshDepthMaterial";
      this.depthPacking = BasicDepthPacking;
      this.map = null;
      this.alphaMap = null;
      this.displacementMap = null;
      this.displacementScale = 1;
      this.displacementBias = 0;
      this.wireframe = false;
      this.wireframeLinewidth = 1;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.depthPacking = source.depthPacking;
      this.map = source.map;
      this.alphaMap = source.alphaMap;
      this.displacementMap = source.displacementMap;
      this.displacementScale = source.displacementScale;
      this.displacementBias = source.displacementBias;
      this.wireframe = source.wireframe;
      this.wireframeLinewidth = source.wireframeLinewidth;
      return this;
    }
  };
  var MeshDistanceMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isMeshDistanceMaterial = true;
      this.type = "MeshDistanceMaterial";
      this.map = null;
      this.alphaMap = null;
      this.displacementMap = null;
      this.displacementScale = 1;
      this.displacementBias = 0;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.map = source.map;
      this.alphaMap = source.alphaMap;
      this.displacementMap = source.displacementMap;
      this.displacementScale = source.displacementScale;
      this.displacementBias = source.displacementBias;
      return this;
    }
  };
  var vertex = "void main() {\n	gl_Position = vec4( position, 1.0 );\n}";
  var fragment = "uniform sampler2D shadow_pass;\nuniform vec2 resolution;\nuniform float radius;\n#include <packing>\nvoid main() {\n	const float samples = float( VSM_SAMPLES );\n	float mean = 0.0;\n	float squared_mean = 0.0;\n	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );\n	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;\n	for ( float i = 0.0; i < samples; i ++ ) {\n		float uvOffset = uvStart + i * uvStride;\n		#ifdef HORIZONTAL_PASS\n			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );\n			mean += distribution.x;\n			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;\n		#else\n			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );\n			mean += depth;\n			squared_mean += depth * depth;\n		#endif\n	}\n	mean = mean / samples;\n	squared_mean = squared_mean / samples;\n	float std_dev = sqrt( squared_mean - mean * mean );\n	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );\n}";
  function WebGLShadowMap(_renderer, _objects, _capabilities) {
    let _frustum2 = new Frustum();
    const _shadowMapSize = new Vector2(), _viewportSize = new Vector2(), _viewport = new Vector4(), _depthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), _distanceMaterial = new MeshDistanceMaterial(), _materialCache = {}, _maxTextureSize = _capabilities.maxTextureSize;
    const shadowSide = { [FrontSide]: BackSide, [BackSide]: FrontSide, [DoubleSide]: DoubleSide };
    const shadowMaterialVertical = new ShaderMaterial({
      defines: {
        VSM_SAMPLES: 8
      },
      uniforms: {
        shadow_pass: { value: null },
        resolution: { value: new Vector2() },
        radius: { value: 4 }
      },
      vertexShader: vertex,
      fragmentShader: fragment
    });
    const shadowMaterialHorizontal = shadowMaterialVertical.clone();
    shadowMaterialHorizontal.defines.HORIZONTAL_PASS = 1;
    const fullScreenTri = new BufferGeometry();
    fullScreenTri.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([-1, -1, 0.5, 3, -1, 0.5, -1, 3, 0.5]),
        3
      )
    );
    const fullScreenMesh = new Mesh(fullScreenTri, shadowMaterialVertical);
    const scope = this;
    this.enabled = false;
    this.autoUpdate = true;
    this.needsUpdate = false;
    this.type = PCFShadowMap;
    let _previousType = this.type;
    this.render = function(lights, scene, camera) {
      if (scope.enabled === false) return;
      if (scope.autoUpdate === false && scope.needsUpdate === false) return;
      if (lights.length === 0) return;
      const currentRenderTarget = _renderer.getRenderTarget();
      const activeCubeFace = _renderer.getActiveCubeFace();
      const activeMipmapLevel = _renderer.getActiveMipmapLevel();
      const _state = _renderer.state;
      _state.setBlending(NoBlending);
      _state.buffers.color.setClear(1, 1, 1, 1);
      _state.buffers.depth.setTest(true);
      _state.setScissorTest(false);
      const toVSM = _previousType !== VSMShadowMap && this.type === VSMShadowMap;
      const fromVSM = _previousType === VSMShadowMap && this.type !== VSMShadowMap;
      for (let i = 0, il = lights.length; i < il; i++) {
        const light = lights[i];
        const shadow = light.shadow;
        if (shadow === void 0) {
          console.warn("THREE.WebGLShadowMap:", light, "has no shadow.");
          continue;
        }
        if (shadow.autoUpdate === false && shadow.needsUpdate === false) continue;
        _shadowMapSize.copy(shadow.mapSize);
        const shadowFrameExtents = shadow.getFrameExtents();
        _shadowMapSize.multiply(shadowFrameExtents);
        _viewportSize.copy(shadow.mapSize);
        if (_shadowMapSize.x > _maxTextureSize || _shadowMapSize.y > _maxTextureSize) {
          if (_shadowMapSize.x > _maxTextureSize) {
            _viewportSize.x = Math.floor(_maxTextureSize / shadowFrameExtents.x);
            _shadowMapSize.x = _viewportSize.x * shadowFrameExtents.x;
            shadow.mapSize.x = _viewportSize.x;
          }
          if (_shadowMapSize.y > _maxTextureSize) {
            _viewportSize.y = Math.floor(_maxTextureSize / shadowFrameExtents.y);
            _shadowMapSize.y = _viewportSize.y * shadowFrameExtents.y;
            shadow.mapSize.y = _viewportSize.y;
          }
        }
        if (shadow.map === null || toVSM === true || fromVSM === true) {
          const pars = this.type !== VSMShadowMap ? { minFilter: NearestFilter, magFilter: NearestFilter } : {};
          if (shadow.map !== null) {
            shadow.map.dispose();
          }
          shadow.map = new WebGLRenderTarget(_shadowMapSize.x, _shadowMapSize.y, pars);
          shadow.map.texture.name = light.name + ".shadowMap";
          shadow.camera.updateProjectionMatrix();
        }
        _renderer.setRenderTarget(shadow.map);
        _renderer.clear();
        const viewportCount = shadow.getViewportCount();
        for (let vp = 0; vp < viewportCount; vp++) {
          const viewport = shadow.getViewport(vp);
          _viewport.set(
            _viewportSize.x * viewport.x,
            _viewportSize.y * viewport.y,
            _viewportSize.x * viewport.z,
            _viewportSize.y * viewport.w
          );
          _state.viewport(_viewport);
          shadow.updateMatrices(light, vp);
          _frustum2 = shadow.getFrustum();
          renderObject(scene, camera, shadow.camera, light, this.type);
        }
        if (shadow.isPointLightShadow !== true && this.type === VSMShadowMap) {
          VSMPass(shadow, camera);
        }
        shadow.needsUpdate = false;
      }
      _previousType = this.type;
      scope.needsUpdate = false;
      _renderer.setRenderTarget(currentRenderTarget, activeCubeFace, activeMipmapLevel);
    };
    function VSMPass(shadow, camera) {
      const geometry = _objects.update(fullScreenMesh);
      if (shadowMaterialVertical.defines.VSM_SAMPLES !== shadow.blurSamples) {
        shadowMaterialVertical.defines.VSM_SAMPLES = shadow.blurSamples;
        shadowMaterialHorizontal.defines.VSM_SAMPLES = shadow.blurSamples;
        shadowMaterialVertical.needsUpdate = true;
        shadowMaterialHorizontal.needsUpdate = true;
      }
      if (shadow.mapPass === null) {
        shadow.mapPass = new WebGLRenderTarget(_shadowMapSize.x, _shadowMapSize.y);
      }
      shadowMaterialVertical.uniforms.shadow_pass.value = shadow.map.texture;
      shadowMaterialVertical.uniforms.resolution.value = shadow.mapSize;
      shadowMaterialVertical.uniforms.radius.value = shadow.radius;
      _renderer.setRenderTarget(shadow.mapPass);
      _renderer.clear();
      _renderer.renderBufferDirect(camera, null, geometry, shadowMaterialVertical, fullScreenMesh, null);
      shadowMaterialHorizontal.uniforms.shadow_pass.value = shadow.mapPass.texture;
      shadowMaterialHorizontal.uniforms.resolution.value = shadow.mapSize;
      shadowMaterialHorizontal.uniforms.radius.value = shadow.radius;
      _renderer.setRenderTarget(shadow.map);
      _renderer.clear();
      _renderer.renderBufferDirect(camera, null, geometry, shadowMaterialHorizontal, fullScreenMesh, null);
    }
    function getDepthMaterial(object, material, light, type) {
      let result = null;
      const customMaterial = light.isPointLight === true ? object.customDistanceMaterial : object.customDepthMaterial;
      if (customMaterial !== void 0) {
        result = customMaterial;
      } else {
        result = light.isPointLight === true ? _distanceMaterial : _depthMaterial;
        if (_renderer.localClippingEnabled && material.clipShadows === true && Array.isArray(material.clippingPlanes) && material.clippingPlanes.length !== 0 || material.displacementMap && material.displacementScale !== 0 || material.alphaMap && material.alphaTest > 0 || material.map && material.alphaTest > 0) {
          const keyA = result.uuid, keyB = material.uuid;
          let materialsForVariant = _materialCache[keyA];
          if (materialsForVariant === void 0) {
            materialsForVariant = {};
            _materialCache[keyA] = materialsForVariant;
          }
          let cachedMaterial = materialsForVariant[keyB];
          if (cachedMaterial === void 0) {
            cachedMaterial = result.clone();
            materialsForVariant[keyB] = cachedMaterial;
            material.addEventListener("dispose", onMaterialDispose);
          }
          result = cachedMaterial;
        }
      }
      result.visible = material.visible;
      result.wireframe = material.wireframe;
      if (type === VSMShadowMap) {
        result.side = material.shadowSide !== null ? material.shadowSide : material.side;
      } else {
        result.side = material.shadowSide !== null ? material.shadowSide : shadowSide[material.side];
      }
      result.alphaMap = material.alphaMap;
      result.alphaTest = material.alphaTest;
      result.map = material.map;
      result.clipShadows = material.clipShadows;
      result.clippingPlanes = material.clippingPlanes;
      result.clipIntersection = material.clipIntersection;
      result.displacementMap = material.displacementMap;
      result.displacementScale = material.displacementScale;
      result.displacementBias = material.displacementBias;
      result.wireframeLinewidth = material.wireframeLinewidth;
      result.linewidth = material.linewidth;
      if (light.isPointLight === true && result.isMeshDistanceMaterial === true) {
        const materialProperties = _renderer.properties.get(result);
        materialProperties.light = light;
      }
      return result;
    }
    function renderObject(object, camera, shadowCamera, light, type) {
      if (object.visible === false) return;
      const visible = object.layers.test(camera.layers);
      if (visible && (object.isMesh || object.isLine || object.isPoints)) {
        if ((object.castShadow || object.receiveShadow && type === VSMShadowMap) && (!object.frustumCulled || _frustum2.intersectsObject(object))) {
          object.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, object.matrixWorld);
          const geometry = _objects.update(object);
          const material = object.material;
          if (Array.isArray(material)) {
            const groups = geometry.groups;
            for (let k = 0, kl = groups.length; k < kl; k++) {
              const group = groups[k];
              const groupMaterial = material[group.materialIndex];
              if (groupMaterial && groupMaterial.visible) {
                const depthMaterial = getDepthMaterial(object, groupMaterial, light, type);
                object.onBeforeShadow(_renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
                _renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, group);
                object.onAfterShadow(_renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
              }
            }
          } else if (material.visible) {
            const depthMaterial = getDepthMaterial(object, material, light, type);
            object.onBeforeShadow(_renderer, object, camera, shadowCamera, geometry, depthMaterial, null);
            _renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, null);
            object.onAfterShadow(_renderer, object, camera, shadowCamera, geometry, depthMaterial, null);
          }
        }
      }
      const children = object.children;
      for (let i = 0, l = children.length; i < l; i++) {
        renderObject(children[i], camera, shadowCamera, light, type);
      }
    }
    function onMaterialDispose(event) {
      const material = event.target;
      material.removeEventListener("dispose", onMaterialDispose);
      for (const id in _materialCache) {
        const cache = _materialCache[id];
        const uuid = event.target.uuid;
        if (uuid in cache) {
          const shadowMaterial = cache[uuid];
          shadowMaterial.dispose();
          delete cache[uuid];
        }
      }
    }
  }
  function WebGLState(gl, extensions, capabilities) {
    const isWebGL2 = capabilities.isWebGL2;
    function ColorBuffer() {
      let locked = false;
      const color = new Vector4();
      let currentColorMask = null;
      const currentColorClear = new Vector4(0, 0, 0, 0);
      return {
        setMask: function(colorMask) {
          if (currentColorMask !== colorMask && !locked) {
            gl.colorMask(colorMask, colorMask, colorMask, colorMask);
            currentColorMask = colorMask;
          }
        },
        setLocked: function(lock) {
          locked = lock;
        },
        setClear: function(r, g, b, a, premultipliedAlpha) {
          if (premultipliedAlpha === true) {
            r *= a;
            g *= a;
            b *= a;
          }
          color.set(r, g, b, a);
          if (currentColorClear.equals(color) === false) {
            gl.clearColor(r, g, b, a);
            currentColorClear.copy(color);
          }
        },
        reset: function() {
          locked = false;
          currentColorMask = null;
          currentColorClear.set(-1, 0, 0, 0);
        }
      };
    }
    function DepthBuffer() {
      let locked = false;
      let currentDepthMask = null;
      let currentDepthFunc = null;
      let currentDepthClear = null;
      return {
        setTest: function(depthTest) {
          if (depthTest) {
            enable(gl.DEPTH_TEST);
          } else {
            disable(gl.DEPTH_TEST);
          }
        },
        setMask: function(depthMask) {
          if (currentDepthMask !== depthMask && !locked) {
            gl.depthMask(depthMask);
            currentDepthMask = depthMask;
          }
        },
        setFunc: function(depthFunc) {
          if (currentDepthFunc !== depthFunc) {
            switch (depthFunc) {
              case NeverDepth:
                gl.depthFunc(gl.NEVER);
                break;
              case AlwaysDepth:
                gl.depthFunc(gl.ALWAYS);
                break;
              case LessDepth:
                gl.depthFunc(gl.LESS);
                break;
              case LessEqualDepth:
                gl.depthFunc(gl.LEQUAL);
                break;
              case EqualDepth:
                gl.depthFunc(gl.EQUAL);
                break;
              case GreaterEqualDepth:
                gl.depthFunc(gl.GEQUAL);
                break;
              case GreaterDepth:
                gl.depthFunc(gl.GREATER);
                break;
              case NotEqualDepth:
                gl.depthFunc(gl.NOTEQUAL);
                break;
              default:
                gl.depthFunc(gl.LEQUAL);
            }
            currentDepthFunc = depthFunc;
          }
        },
        setLocked: function(lock) {
          locked = lock;
        },
        setClear: function(depth) {
          if (currentDepthClear !== depth) {
            gl.clearDepth(depth);
            currentDepthClear = depth;
          }
        },
        reset: function() {
          locked = false;
          currentDepthMask = null;
          currentDepthFunc = null;
          currentDepthClear = null;
        }
      };
    }
    function StencilBuffer() {
      let locked = false;
      let currentStencilMask = null;
      let currentStencilFunc = null;
      let currentStencilRef = null;
      let currentStencilFuncMask = null;
      let currentStencilFail = null;
      let currentStencilZFail = null;
      let currentStencilZPass = null;
      let currentStencilClear = null;
      return {
        setTest: function(stencilTest) {
          if (!locked) {
            if (stencilTest) {
              enable(gl.STENCIL_TEST);
            } else {
              disable(gl.STENCIL_TEST);
            }
          }
        },
        setMask: function(stencilMask) {
          if (currentStencilMask !== stencilMask && !locked) {
            gl.stencilMask(stencilMask);
            currentStencilMask = stencilMask;
          }
        },
        setFunc: function(stencilFunc, stencilRef, stencilMask) {
          if (currentStencilFunc !== stencilFunc || currentStencilRef !== stencilRef || currentStencilFuncMask !== stencilMask) {
            gl.stencilFunc(stencilFunc, stencilRef, stencilMask);
            currentStencilFunc = stencilFunc;
            currentStencilRef = stencilRef;
            currentStencilFuncMask = stencilMask;
          }
        },
        setOp: function(stencilFail, stencilZFail, stencilZPass) {
          if (currentStencilFail !== stencilFail || currentStencilZFail !== stencilZFail || currentStencilZPass !== stencilZPass) {
            gl.stencilOp(stencilFail, stencilZFail, stencilZPass);
            currentStencilFail = stencilFail;
            currentStencilZFail = stencilZFail;
            currentStencilZPass = stencilZPass;
          }
        },
        setLocked: function(lock) {
          locked = lock;
        },
        setClear: function(stencil) {
          if (currentStencilClear !== stencil) {
            gl.clearStencil(stencil);
            currentStencilClear = stencil;
          }
        },
        reset: function() {
          locked = false;
          currentStencilMask = null;
          currentStencilFunc = null;
          currentStencilRef = null;
          currentStencilFuncMask = null;
          currentStencilFail = null;
          currentStencilZFail = null;
          currentStencilZPass = null;
          currentStencilClear = null;
        }
      };
    }
    const colorBuffer = new ColorBuffer();
    const depthBuffer = new DepthBuffer();
    const stencilBuffer = new StencilBuffer();
    const uboBindings = /* @__PURE__ */ new WeakMap();
    const uboProgramMap = /* @__PURE__ */ new WeakMap();
    let enabledCapabilities = {};
    let currentBoundFramebuffers = {};
    let currentDrawbuffers = /* @__PURE__ */ new WeakMap();
    let defaultDrawbuffers = [];
    let currentProgram = null;
    let currentBlendingEnabled = false;
    let currentBlending = null;
    let currentBlendEquation = null;
    let currentBlendSrc = null;
    let currentBlendDst = null;
    let currentBlendEquationAlpha = null;
    let currentBlendSrcAlpha = null;
    let currentBlendDstAlpha = null;
    let currentBlendColor = new Color(0, 0, 0);
    let currentBlendAlpha = 0;
    let currentPremultipledAlpha = false;
    let currentFlipSided = null;
    let currentCullFace = null;
    let currentLineWidth = null;
    let currentPolygonOffsetFactor = null;
    let currentPolygonOffsetUnits = null;
    const maxTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    let lineWidthAvailable = false;
    let version = 0;
    const glVersion = gl.getParameter(gl.VERSION);
    if (glVersion.indexOf("WebGL") !== -1) {
      version = parseFloat(/^WebGL (\d)/.exec(glVersion)[1]);
      lineWidthAvailable = version >= 1;
    } else if (glVersion.indexOf("OpenGL ES") !== -1) {
      version = parseFloat(/^OpenGL ES (\d)/.exec(glVersion)[1]);
      lineWidthAvailable = version >= 2;
    }
    let currentTextureSlot = null;
    let currentBoundTextures = {};
    const scissorParam = gl.getParameter(gl.SCISSOR_BOX);
    const viewportParam = gl.getParameter(gl.VIEWPORT);
    const currentScissor = new Vector4().fromArray(scissorParam);
    const currentViewport = new Vector4().fromArray(viewportParam);
    function createTexture(type, target, count, dimensions) {
      const data = new Uint8Array(4);
      const texture = gl.createTexture();
      gl.bindTexture(type, texture);
      gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      for (let i = 0; i < count; i++) {
        if (isWebGL2 && (type === gl.TEXTURE_3D || type === gl.TEXTURE_2D_ARRAY)) {
          gl.texImage3D(target, 0, gl.RGBA, 1, 1, dimensions, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        } else {
          gl.texImage2D(target + i, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        }
      }
      return texture;
    }
    const emptyTextures = {};
    emptyTextures[gl.TEXTURE_2D] = createTexture(gl.TEXTURE_2D, gl.TEXTURE_2D, 1);
    emptyTextures[gl.TEXTURE_CUBE_MAP] = createTexture(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_CUBE_MAP_POSITIVE_X, 6);
    if (isWebGL2) {
      emptyTextures[gl.TEXTURE_2D_ARRAY] = createTexture(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_2D_ARRAY, 1, 1);
      emptyTextures[gl.TEXTURE_3D] = createTexture(gl.TEXTURE_3D, gl.TEXTURE_3D, 1, 1);
    }
    colorBuffer.setClear(0, 0, 0, 1);
    depthBuffer.setClear(1);
    stencilBuffer.setClear(0);
    enable(gl.DEPTH_TEST);
    depthBuffer.setFunc(LessEqualDepth);
    setFlipSided(false);
    setCullFace(CullFaceBack);
    enable(gl.CULL_FACE);
    setBlending(NoBlending);
    function enable(id) {
      if (enabledCapabilities[id] !== true) {
        gl.enable(id);
        enabledCapabilities[id] = true;
      }
    }
    function disable(id) {
      if (enabledCapabilities[id] !== false) {
        gl.disable(id);
        enabledCapabilities[id] = false;
      }
    }
    function bindFramebuffer(target, framebuffer) {
      if (currentBoundFramebuffers[target] !== framebuffer) {
        gl.bindFramebuffer(target, framebuffer);
        currentBoundFramebuffers[target] = framebuffer;
        if (isWebGL2) {
          if (target === gl.DRAW_FRAMEBUFFER) {
            currentBoundFramebuffers[gl.FRAMEBUFFER] = framebuffer;
          }
          if (target === gl.FRAMEBUFFER) {
            currentBoundFramebuffers[gl.DRAW_FRAMEBUFFER] = framebuffer;
          }
        }
        return true;
      }
      return false;
    }
    function drawBuffers(renderTarget, framebuffer) {
      let drawBuffers2 = defaultDrawbuffers;
      let needsUpdate = false;
      if (renderTarget) {
        drawBuffers2 = currentDrawbuffers.get(framebuffer);
        if (drawBuffers2 === void 0) {
          drawBuffers2 = [];
          currentDrawbuffers.set(framebuffer, drawBuffers2);
        }
        if (renderTarget.isWebGLMultipleRenderTargets) {
          const textures = renderTarget.texture;
          if (drawBuffers2.length !== textures.length || drawBuffers2[0] !== gl.COLOR_ATTACHMENT0) {
            for (let i = 0, il = textures.length; i < il; i++) {
              drawBuffers2[i] = gl.COLOR_ATTACHMENT0 + i;
            }
            drawBuffers2.length = textures.length;
            needsUpdate = true;
          }
        } else {
          if (drawBuffers2[0] !== gl.COLOR_ATTACHMENT0) {
            drawBuffers2[0] = gl.COLOR_ATTACHMENT0;
            needsUpdate = true;
          }
        }
      } else {
        if (drawBuffers2[0] !== gl.BACK) {
          drawBuffers2[0] = gl.BACK;
          needsUpdate = true;
        }
      }
      if (needsUpdate) {
        if (capabilities.isWebGL2) {
          gl.drawBuffers(drawBuffers2);
        } else {
          extensions.get("WEBGL_draw_buffers").drawBuffersWEBGL(drawBuffers2);
        }
      }
    }
    function useProgram(program) {
      if (currentProgram !== program) {
        gl.useProgram(program);
        currentProgram = program;
        return true;
      }
      return false;
    }
    const equationToGL = {
      [AddEquation]: gl.FUNC_ADD,
      [SubtractEquation]: gl.FUNC_SUBTRACT,
      [ReverseSubtractEquation]: gl.FUNC_REVERSE_SUBTRACT
    };
    if (isWebGL2) {
      equationToGL[MinEquation] = gl.MIN;
      equationToGL[MaxEquation] = gl.MAX;
    } else {
      const extension = extensions.get("EXT_blend_minmax");
      if (extension !== null) {
        equationToGL[MinEquation] = extension.MIN_EXT;
        equationToGL[MaxEquation] = extension.MAX_EXT;
      }
    }
    const factorToGL = {
      [ZeroFactor]: gl.ZERO,
      [OneFactor]: gl.ONE,
      [SrcColorFactor]: gl.SRC_COLOR,
      [SrcAlphaFactor]: gl.SRC_ALPHA,
      [SrcAlphaSaturateFactor]: gl.SRC_ALPHA_SATURATE,
      [DstColorFactor]: gl.DST_COLOR,
      [DstAlphaFactor]: gl.DST_ALPHA,
      [OneMinusSrcColorFactor]: gl.ONE_MINUS_SRC_COLOR,
      [OneMinusSrcAlphaFactor]: gl.ONE_MINUS_SRC_ALPHA,
      [OneMinusDstColorFactor]: gl.ONE_MINUS_DST_COLOR,
      [OneMinusDstAlphaFactor]: gl.ONE_MINUS_DST_ALPHA,
      [ConstantColorFactor]: gl.CONSTANT_COLOR,
      [OneMinusConstantColorFactor]: gl.ONE_MINUS_CONSTANT_COLOR,
      [ConstantAlphaFactor]: gl.CONSTANT_ALPHA,
      [OneMinusConstantAlphaFactor]: gl.ONE_MINUS_CONSTANT_ALPHA
    };
    function setBlending(blending, blendEquation, blendSrc, blendDst, blendEquationAlpha, blendSrcAlpha, blendDstAlpha, blendColor, blendAlpha, premultipliedAlpha) {
      if (blending === NoBlending) {
        if (currentBlendingEnabled === true) {
          disable(gl.BLEND);
          currentBlendingEnabled = false;
        }
        return;
      }
      if (currentBlendingEnabled === false) {
        enable(gl.BLEND);
        currentBlendingEnabled = true;
      }
      if (blending !== CustomBlending) {
        if (blending !== currentBlending || premultipliedAlpha !== currentPremultipledAlpha) {
          if (currentBlendEquation !== AddEquation || currentBlendEquationAlpha !== AddEquation) {
            gl.blendEquation(gl.FUNC_ADD);
            currentBlendEquation = AddEquation;
            currentBlendEquationAlpha = AddEquation;
          }
          if (premultipliedAlpha) {
            switch (blending) {
              case NormalBlending:
                gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
              case AdditiveBlending:
                gl.blendFunc(gl.ONE, gl.ONE);
                break;
              case SubtractiveBlending:
                gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
                break;
              case MultiplyBlending:
                gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.SRC_ALPHA);
                break;
              default:
                console.error("THREE.WebGLState: Invalid blending: ", blending);
                break;
            }
          } else {
            switch (blending) {
              case NormalBlending:
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
              case AdditiveBlending:
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                break;
              case SubtractiveBlending:
                gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
                break;
              case MultiplyBlending:
                gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
                break;
              default:
                console.error("THREE.WebGLState: Invalid blending: ", blending);
                break;
            }
          }
          currentBlendSrc = null;
          currentBlendDst = null;
          currentBlendSrcAlpha = null;
          currentBlendDstAlpha = null;
          currentBlendColor.set(0, 0, 0);
          currentBlendAlpha = 0;
          currentBlending = blending;
          currentPremultipledAlpha = premultipliedAlpha;
        }
        return;
      }
      blendEquationAlpha = blendEquationAlpha || blendEquation;
      blendSrcAlpha = blendSrcAlpha || blendSrc;
      blendDstAlpha = blendDstAlpha || blendDst;
      if (blendEquation !== currentBlendEquation || blendEquationAlpha !== currentBlendEquationAlpha) {
        gl.blendEquationSeparate(equationToGL[blendEquation], equationToGL[blendEquationAlpha]);
        currentBlendEquation = blendEquation;
        currentBlendEquationAlpha = blendEquationAlpha;
      }
      if (blendSrc !== currentBlendSrc || blendDst !== currentBlendDst || blendSrcAlpha !== currentBlendSrcAlpha || blendDstAlpha !== currentBlendDstAlpha) {
        gl.blendFuncSeparate(factorToGL[blendSrc], factorToGL[blendDst], factorToGL[blendSrcAlpha], factorToGL[blendDstAlpha]);
        currentBlendSrc = blendSrc;
        currentBlendDst = blendDst;
        currentBlendSrcAlpha = blendSrcAlpha;
        currentBlendDstAlpha = blendDstAlpha;
      }
      if (blendColor.equals(currentBlendColor) === false || blendAlpha !== currentBlendAlpha) {
        gl.blendColor(blendColor.r, blendColor.g, blendColor.b, blendAlpha);
        currentBlendColor.copy(blendColor);
        currentBlendAlpha = blendAlpha;
      }
      currentBlending = blending;
      currentPremultipledAlpha = false;
    }
    function setMaterial(material, frontFaceCW) {
      material.side === DoubleSide ? disable(gl.CULL_FACE) : enable(gl.CULL_FACE);
      let flipSided = material.side === BackSide;
      if (frontFaceCW) flipSided = !flipSided;
      setFlipSided(flipSided);
      material.blending === NormalBlending && material.transparent === false ? setBlending(NoBlending) : setBlending(material.blending, material.blendEquation, material.blendSrc, material.blendDst, material.blendEquationAlpha, material.blendSrcAlpha, material.blendDstAlpha, material.blendColor, material.blendAlpha, material.premultipliedAlpha);
      depthBuffer.setFunc(material.depthFunc);
      depthBuffer.setTest(material.depthTest);
      depthBuffer.setMask(material.depthWrite);
      colorBuffer.setMask(material.colorWrite);
      const stencilWrite = material.stencilWrite;
      stencilBuffer.setTest(stencilWrite);
      if (stencilWrite) {
        stencilBuffer.setMask(material.stencilWriteMask);
        stencilBuffer.setFunc(material.stencilFunc, material.stencilRef, material.stencilFuncMask);
        stencilBuffer.setOp(material.stencilFail, material.stencilZFail, material.stencilZPass);
      }
      setPolygonOffset(material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits);
      material.alphaToCoverage === true ? enable(gl.SAMPLE_ALPHA_TO_COVERAGE) : disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    }
    function setFlipSided(flipSided) {
      if (currentFlipSided !== flipSided) {
        if (flipSided) {
          gl.frontFace(gl.CW);
        } else {
          gl.frontFace(gl.CCW);
        }
        currentFlipSided = flipSided;
      }
    }
    function setCullFace(cullFace) {
      if (cullFace !== CullFaceNone) {
        enable(gl.CULL_FACE);
        if (cullFace !== currentCullFace) {
          if (cullFace === CullFaceBack) {
            gl.cullFace(gl.BACK);
          } else if (cullFace === CullFaceFront) {
            gl.cullFace(gl.FRONT);
          } else {
            gl.cullFace(gl.FRONT_AND_BACK);
          }
        }
      } else {
        disable(gl.CULL_FACE);
      }
      currentCullFace = cullFace;
    }
    function setLineWidth(width) {
      if (width !== currentLineWidth) {
        if (lineWidthAvailable) gl.lineWidth(width);
        currentLineWidth = width;
      }
    }
    function setPolygonOffset(polygonOffset, factor, units) {
      if (polygonOffset) {
        enable(gl.POLYGON_OFFSET_FILL);
        if (currentPolygonOffsetFactor !== factor || currentPolygonOffsetUnits !== units) {
          gl.polygonOffset(factor, units);
          currentPolygonOffsetFactor = factor;
          currentPolygonOffsetUnits = units;
        }
      } else {
        disable(gl.POLYGON_OFFSET_FILL);
      }
    }
    function setScissorTest(scissorTest) {
      if (scissorTest) {
        enable(gl.SCISSOR_TEST);
      } else {
        disable(gl.SCISSOR_TEST);
      }
    }
    function activeTexture(webglSlot) {
      if (webglSlot === void 0) webglSlot = gl.TEXTURE0 + maxTextures - 1;
      if (currentTextureSlot !== webglSlot) {
        gl.activeTexture(webglSlot);
        currentTextureSlot = webglSlot;
      }
    }
    function bindTexture(webglType, webglTexture, webglSlot) {
      if (webglSlot === void 0) {
        if (currentTextureSlot === null) {
          webglSlot = gl.TEXTURE0 + maxTextures - 1;
        } else {
          webglSlot = currentTextureSlot;
        }
      }
      let boundTexture = currentBoundTextures[webglSlot];
      if (boundTexture === void 0) {
        boundTexture = { type: void 0, texture: void 0 };
        currentBoundTextures[webglSlot] = boundTexture;
      }
      if (boundTexture.type !== webglType || boundTexture.texture !== webglTexture) {
        if (currentTextureSlot !== webglSlot) {
          gl.activeTexture(webglSlot);
          currentTextureSlot = webglSlot;
        }
        gl.bindTexture(webglType, webglTexture || emptyTextures[webglType]);
        boundTexture.type = webglType;
        boundTexture.texture = webglTexture;
      }
    }
    function unbindTexture() {
      const boundTexture = currentBoundTextures[currentTextureSlot];
      if (boundTexture !== void 0 && boundTexture.type !== void 0) {
        gl.bindTexture(boundTexture.type, null);
        boundTexture.type = void 0;
        boundTexture.texture = void 0;
      }
    }
    function compressedTexImage2D() {
      try {
        gl.compressedTexImage2D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function compressedTexImage3D() {
      try {
        gl.compressedTexImage3D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function texSubImage2D() {
      try {
        gl.texSubImage2D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function texSubImage3D() {
      try {
        gl.texSubImage3D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function compressedTexSubImage2D() {
      try {
        gl.compressedTexSubImage2D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function compressedTexSubImage3D() {
      try {
        gl.compressedTexSubImage3D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function texStorage2D() {
      try {
        gl.texStorage2D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function texStorage3D() {
      try {
        gl.texStorage3D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function texImage2D() {
      try {
        gl.texImage2D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function texImage3D() {
      try {
        gl.texImage3D.apply(gl, arguments);
      } catch (error) {
        console.error("THREE.WebGLState:", error);
      }
    }
    function scissor(scissor2) {
      if (currentScissor.equals(scissor2) === false) {
        gl.scissor(scissor2.x, scissor2.y, scissor2.z, scissor2.w);
        currentScissor.copy(scissor2);
      }
    }
    function viewport(viewport2) {
      if (currentViewport.equals(viewport2) === false) {
        gl.viewport(viewport2.x, viewport2.y, viewport2.z, viewport2.w);
        currentViewport.copy(viewport2);
      }
    }
    function updateUBOMapping(uniformsGroup, program) {
      let mapping = uboProgramMap.get(program);
      if (mapping === void 0) {
        mapping = /* @__PURE__ */ new WeakMap();
        uboProgramMap.set(program, mapping);
      }
      let blockIndex = mapping.get(uniformsGroup);
      if (blockIndex === void 0) {
        blockIndex = gl.getUniformBlockIndex(program, uniformsGroup.name);
        mapping.set(uniformsGroup, blockIndex);
      }
    }
    function uniformBlockBinding(uniformsGroup, program) {
      const mapping = uboProgramMap.get(program);
      const blockIndex = mapping.get(uniformsGroup);
      if (uboBindings.get(program) !== blockIndex) {
        gl.uniformBlockBinding(program, blockIndex, uniformsGroup.__bindingPointIndex);
        uboBindings.set(program, blockIndex);
      }
    }
    function reset() {
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ZERO);
      gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO);
      gl.blendColor(0, 0, 0, 0);
      gl.colorMask(true, true, true, true);
      gl.clearColor(0, 0, 0, 0);
      gl.depthMask(true);
      gl.depthFunc(gl.LESS);
      gl.clearDepth(1);
      gl.stencilMask(4294967295);
      gl.stencilFunc(gl.ALWAYS, 0, 4294967295);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      gl.clearStencil(0);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
      gl.polygonOffset(0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (isWebGL2 === true) {
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      }
      gl.useProgram(null);
      gl.lineWidth(1);
      gl.scissor(0, 0, gl.canvas.width, gl.canvas.height);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      enabledCapabilities = {};
      currentTextureSlot = null;
      currentBoundTextures = {};
      currentBoundFramebuffers = {};
      currentDrawbuffers = /* @__PURE__ */ new WeakMap();
      defaultDrawbuffers = [];
      currentProgram = null;
      currentBlendingEnabled = false;
      currentBlending = null;
      currentBlendEquation = null;
      currentBlendSrc = null;
      currentBlendDst = null;
      currentBlendEquationAlpha = null;
      currentBlendSrcAlpha = null;
      currentBlendDstAlpha = null;
      currentBlendColor = new Color(0, 0, 0);
      currentBlendAlpha = 0;
      currentPremultipledAlpha = false;
      currentFlipSided = null;
      currentCullFace = null;
      currentLineWidth = null;
      currentPolygonOffsetFactor = null;
      currentPolygonOffsetUnits = null;
      currentScissor.set(0, 0, gl.canvas.width, gl.canvas.height);
      currentViewport.set(0, 0, gl.canvas.width, gl.canvas.height);
      colorBuffer.reset();
      depthBuffer.reset();
      stencilBuffer.reset();
    }
    return {
      buffers: {
        color: colorBuffer,
        depth: depthBuffer,
        stencil: stencilBuffer
      },
      enable,
      disable,
      bindFramebuffer,
      drawBuffers,
      useProgram,
      setBlending,
      setMaterial,
      setFlipSided,
      setCullFace,
      setLineWidth,
      setPolygonOffset,
      setScissorTest,
      activeTexture,
      bindTexture,
      unbindTexture,
      compressedTexImage2D,
      compressedTexImage3D,
      texImage2D,
      texImage3D,
      updateUBOMapping,
      uniformBlockBinding,
      texStorage2D,
      texStorage3D,
      texSubImage2D,
      texSubImage3D,
      compressedTexSubImage2D,
      compressedTexSubImage3D,
      scissor,
      viewport,
      reset
    };
  }
  function WebGLTextures(_gl, extensions, state, properties, capabilities, utils, info) {
    const isWebGL2 = capabilities.isWebGL2;
    const multisampledRTTExt = extensions.has("WEBGL_multisampled_render_to_texture") ? extensions.get("WEBGL_multisampled_render_to_texture") : null;
    const supportsInvalidateFramebuffer = typeof navigator === "undefined" ? false : /OculusBrowser/g.test(navigator.userAgent);
    const _videoTextures = /* @__PURE__ */ new WeakMap();
    let _canvas2;
    const _sources = /* @__PURE__ */ new WeakMap();
    let useOffscreenCanvas = false;
    try {
      useOffscreenCanvas = typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d") !== null;
    } catch (err) {
    }
    function createCanvas(width, height) {
      return useOffscreenCanvas ? (
        // eslint-disable-next-line compat/compat
        new OffscreenCanvas(width, height)
      ) : createElementNS("canvas");
    }
    function resizeImage(image, needsPowerOfTwo, needsNewCanvas, maxSize) {
      let scale = 1;
      if (image.width > maxSize || image.height > maxSize) {
        scale = maxSize / Math.max(image.width, image.height);
      }
      if (scale < 1 || needsPowerOfTwo === true) {
        if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement || typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
          const floor = needsPowerOfTwo ? floorPowerOfTwo : Math.floor;
          const width = floor(scale * image.width);
          const height = floor(scale * image.height);
          if (_canvas2 === void 0) _canvas2 = createCanvas(width, height);
          const canvas = needsNewCanvas ? createCanvas(width, height) : _canvas2;
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          console.warn("THREE.WebGLRenderer: Texture has been resized from (" + image.width + "x" + image.height + ") to (" + width + "x" + height + ").");
          return canvas;
        } else {
          if ("data" in image) {
            console.warn("THREE.WebGLRenderer: Image in DataTexture is too big (" + image.width + "x" + image.height + ").");
          }
          return image;
        }
      }
      return image;
    }
    function isPowerOfTwo$1(image) {
      return isPowerOfTwo(image.width) && isPowerOfTwo(image.height);
    }
    function textureNeedsPowerOfTwo(texture) {
      if (isWebGL2) return false;
      return texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping || texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;
    }
    function textureNeedsGenerateMipmaps(texture, supportsMips) {
      return texture.generateMipmaps && supportsMips && texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;
    }
    function generateMipmap(target) {
      _gl.generateMipmap(target);
    }
    function getInternalFormat(internalFormatName, glFormat, glType, colorSpace, forceLinearTransfer = false) {
      if (isWebGL2 === false) return glFormat;
      if (internalFormatName !== null) {
        if (_gl[internalFormatName] !== void 0) return _gl[internalFormatName];
        console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '" + internalFormatName + "'");
      }
      let internalFormat = glFormat;
      if (glFormat === _gl.RED) {
        if (glType === _gl.FLOAT) internalFormat = _gl.R32F;
        if (glType === _gl.HALF_FLOAT) internalFormat = _gl.R16F;
        if (glType === _gl.UNSIGNED_BYTE) internalFormat = _gl.R8;
      }
      if (glFormat === _gl.RED_INTEGER) {
        if (glType === _gl.UNSIGNED_BYTE) internalFormat = _gl.R8UI;
        if (glType === _gl.UNSIGNED_SHORT) internalFormat = _gl.R16UI;
        if (glType === _gl.UNSIGNED_INT) internalFormat = _gl.R32UI;
        if (glType === _gl.BYTE) internalFormat = _gl.R8I;
        if (glType === _gl.SHORT) internalFormat = _gl.R16I;
        if (glType === _gl.INT) internalFormat = _gl.R32I;
      }
      if (glFormat === _gl.RG) {
        if (glType === _gl.FLOAT) internalFormat = _gl.RG32F;
        if (glType === _gl.HALF_FLOAT) internalFormat = _gl.RG16F;
        if (glType === _gl.UNSIGNED_BYTE) internalFormat = _gl.RG8;
      }
      if (glFormat === _gl.RGBA) {
        const transfer = forceLinearTransfer ? LinearTransfer : ColorManagement.getTransfer(colorSpace);
        if (glType === _gl.FLOAT) internalFormat = _gl.RGBA32F;
        if (glType === _gl.HALF_FLOAT) internalFormat = _gl.RGBA16F;
        if (glType === _gl.UNSIGNED_BYTE) internalFormat = transfer === SRGBTransfer ? _gl.SRGB8_ALPHA8 : _gl.RGBA8;
        if (glType === _gl.UNSIGNED_SHORT_4_4_4_4) internalFormat = _gl.RGBA4;
        if (glType === _gl.UNSIGNED_SHORT_5_5_5_1) internalFormat = _gl.RGB5_A1;
      }
      if (internalFormat === _gl.R16F || internalFormat === _gl.R32F || internalFormat === _gl.RG16F || internalFormat === _gl.RG32F || internalFormat === _gl.RGBA16F || internalFormat === _gl.RGBA32F) {
        extensions.get("EXT_color_buffer_float");
      }
      return internalFormat;
    }
    function getMipLevels(texture, image, supportsMips) {
      if (textureNeedsGenerateMipmaps(texture, supportsMips) === true || texture.isFramebufferTexture && texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter) {
        return Math.log2(Math.max(image.width, image.height)) + 1;
      } else if (texture.mipmaps !== void 0 && texture.mipmaps.length > 0) {
        return texture.mipmaps.length;
      } else if (texture.isCompressedTexture && Array.isArray(texture.image)) {
        return image.mipmaps.length;
      } else {
        return 1;
      }
    }
    function filterFallback(f) {
      if (f === NearestFilter || f === NearestMipmapNearestFilter || f === NearestMipmapLinearFilter) {
        return _gl.NEAREST;
      }
      return _gl.LINEAR;
    }
    function onTextureDispose(event) {
      const texture = event.target;
      texture.removeEventListener("dispose", onTextureDispose);
      deallocateTexture(texture);
      if (texture.isVideoTexture) {
        _videoTextures.delete(texture);
      }
    }
    function onRenderTargetDispose(event) {
      const renderTarget = event.target;
      renderTarget.removeEventListener("dispose", onRenderTargetDispose);
      deallocateRenderTarget(renderTarget);
    }
    function deallocateTexture(texture) {
      const textureProperties = properties.get(texture);
      if (textureProperties.__webglInit === void 0) return;
      const source = texture.source;
      const webglTextures = _sources.get(source);
      if (webglTextures) {
        const webglTexture = webglTextures[textureProperties.__cacheKey];
        webglTexture.usedTimes--;
        if (webglTexture.usedTimes === 0) {
          deleteTexture(texture);
        }
        if (Object.keys(webglTextures).length === 0) {
          _sources.delete(source);
        }
      }
      properties.remove(texture);
    }
    function deleteTexture(texture) {
      const textureProperties = properties.get(texture);
      _gl.deleteTexture(textureProperties.__webglTexture);
      const source = texture.source;
      const webglTextures = _sources.get(source);
      delete webglTextures[textureProperties.__cacheKey];
      info.memory.textures--;
    }
    function deallocateRenderTarget(renderTarget) {
      const texture = renderTarget.texture;
      const renderTargetProperties = properties.get(renderTarget);
      const textureProperties = properties.get(texture);
      if (textureProperties.__webglTexture !== void 0) {
        _gl.deleteTexture(textureProperties.__webglTexture);
        info.memory.textures--;
      }
      if (renderTarget.depthTexture) {
        renderTarget.depthTexture.dispose();
      }
      if (renderTarget.isWebGLCubeRenderTarget) {
        for (let i = 0; i < 6; i++) {
          if (Array.isArray(renderTargetProperties.__webglFramebuffer[i])) {
            for (let level = 0; level < renderTargetProperties.__webglFramebuffer[i].length; level++) _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[i][level]);
          } else {
            _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[i]);
          }
          if (renderTargetProperties.__webglDepthbuffer) _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer[i]);
        }
      } else {
        if (Array.isArray(renderTargetProperties.__webglFramebuffer)) {
          for (let level = 0; level < renderTargetProperties.__webglFramebuffer.length; level++) _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[level]);
        } else {
          _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer);
        }
        if (renderTargetProperties.__webglDepthbuffer) _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer);
        if (renderTargetProperties.__webglMultisampledFramebuffer) _gl.deleteFramebuffer(renderTargetProperties.__webglMultisampledFramebuffer);
        if (renderTargetProperties.__webglColorRenderbuffer) {
          for (let i = 0; i < renderTargetProperties.__webglColorRenderbuffer.length; i++) {
            if (renderTargetProperties.__webglColorRenderbuffer[i]) _gl.deleteRenderbuffer(renderTargetProperties.__webglColorRenderbuffer[i]);
          }
        }
        if (renderTargetProperties.__webglDepthRenderbuffer) _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthRenderbuffer);
      }
      if (renderTarget.isWebGLMultipleRenderTargets) {
        for (let i = 0, il = texture.length; i < il; i++) {
          const attachmentProperties = properties.get(texture[i]);
          if (attachmentProperties.__webglTexture) {
            _gl.deleteTexture(attachmentProperties.__webglTexture);
            info.memory.textures--;
          }
          properties.remove(texture[i]);
        }
      }
      properties.remove(texture);
      properties.remove(renderTarget);
    }
    let textureUnits = 0;
    function resetTextureUnits() {
      textureUnits = 0;
    }
    function allocateTextureUnit() {
      const textureUnit = textureUnits;
      if (textureUnit >= capabilities.maxTextures) {
        console.warn("THREE.WebGLTextures: Trying to use " + textureUnit + " texture units while this GPU supports only " + capabilities.maxTextures);
      }
      textureUnits += 1;
      return textureUnit;
    }
    function getTextureCacheKey(texture) {
      const array = [];
      array.push(texture.wrapS);
      array.push(texture.wrapT);
      array.push(texture.wrapR || 0);
      array.push(texture.magFilter);
      array.push(texture.minFilter);
      array.push(texture.anisotropy);
      array.push(texture.internalFormat);
      array.push(texture.format);
      array.push(texture.type);
      array.push(texture.generateMipmaps);
      array.push(texture.premultiplyAlpha);
      array.push(texture.flipY);
      array.push(texture.unpackAlignment);
      array.push(texture.colorSpace);
      return array.join();
    }
    function setTexture2D(texture, slot) {
      const textureProperties = properties.get(texture);
      if (texture.isVideoTexture) updateVideoTexture(texture);
      if (texture.isRenderTargetTexture === false && texture.version > 0 && textureProperties.__version !== texture.version) {
        const image = texture.image;
        if (image === null) {
          console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");
        } else if (image.complete === false) {
          console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");
        } else {
          uploadTexture(textureProperties, texture, slot);
          return;
        }
      }
      state.bindTexture(_gl.TEXTURE_2D, textureProperties.__webglTexture, _gl.TEXTURE0 + slot);
    }
    function setTexture2DArray(texture, slot) {
      const textureProperties = properties.get(texture);
      if (texture.version > 0 && textureProperties.__version !== texture.version) {
        uploadTexture(textureProperties, texture, slot);
        return;
      }
      state.bindTexture(_gl.TEXTURE_2D_ARRAY, textureProperties.__webglTexture, _gl.TEXTURE0 + slot);
    }
    function setTexture3D(texture, slot) {
      const textureProperties = properties.get(texture);
      if (texture.version > 0 && textureProperties.__version !== texture.version) {
        uploadTexture(textureProperties, texture, slot);
        return;
      }
      state.bindTexture(_gl.TEXTURE_3D, textureProperties.__webglTexture, _gl.TEXTURE0 + slot);
    }
    function setTextureCube(texture, slot) {
      const textureProperties = properties.get(texture);
      if (texture.version > 0 && textureProperties.__version !== texture.version) {
        uploadCubeTexture(textureProperties, texture, slot);
        return;
      }
      state.bindTexture(_gl.TEXTURE_CUBE_MAP, textureProperties.__webglTexture, _gl.TEXTURE0 + slot);
    }
    const wrappingToGL = {
      [RepeatWrapping]: _gl.REPEAT,
      [ClampToEdgeWrapping]: _gl.CLAMP_TO_EDGE,
      [MirroredRepeatWrapping]: _gl.MIRRORED_REPEAT
    };
    const filterToGL = {
      [NearestFilter]: _gl.NEAREST,
      [NearestMipmapNearestFilter]: _gl.NEAREST_MIPMAP_NEAREST,
      [NearestMipmapLinearFilter]: _gl.NEAREST_MIPMAP_LINEAR,
      [LinearFilter]: _gl.LINEAR,
      [LinearMipmapNearestFilter]: _gl.LINEAR_MIPMAP_NEAREST,
      [LinearMipmapLinearFilter]: _gl.LINEAR_MIPMAP_LINEAR
    };
    const compareToGL = {
      [NeverCompare]: _gl.NEVER,
      [AlwaysCompare]: _gl.ALWAYS,
      [LessCompare]: _gl.LESS,
      [LessEqualCompare]: _gl.LEQUAL,
      [EqualCompare]: _gl.EQUAL,
      [GreaterEqualCompare]: _gl.GEQUAL,
      [GreaterCompare]: _gl.GREATER,
      [NotEqualCompare]: _gl.NOTEQUAL
    };
    function setTextureParameters(textureType, texture, supportsMips) {
      if (supportsMips) {
        _gl.texParameteri(textureType, _gl.TEXTURE_WRAP_S, wrappingToGL[texture.wrapS]);
        _gl.texParameteri(textureType, _gl.TEXTURE_WRAP_T, wrappingToGL[texture.wrapT]);
        if (textureType === _gl.TEXTURE_3D || textureType === _gl.TEXTURE_2D_ARRAY) {
          _gl.texParameteri(textureType, _gl.TEXTURE_WRAP_R, wrappingToGL[texture.wrapR]);
        }
        _gl.texParameteri(textureType, _gl.TEXTURE_MAG_FILTER, filterToGL[texture.magFilter]);
        _gl.texParameteri(textureType, _gl.TEXTURE_MIN_FILTER, filterToGL[texture.minFilter]);
      } else {
        _gl.texParameteri(textureType, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE);
        _gl.texParameteri(textureType, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE);
        if (textureType === _gl.TEXTURE_3D || textureType === _gl.TEXTURE_2D_ARRAY) {
          _gl.texParameteri(textureType, _gl.TEXTURE_WRAP_R, _gl.CLAMP_TO_EDGE);
        }
        if (texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping) {
          console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping.");
        }
        _gl.texParameteri(textureType, _gl.TEXTURE_MAG_FILTER, filterFallback(texture.magFilter));
        _gl.texParameteri(textureType, _gl.TEXTURE_MIN_FILTER, filterFallback(texture.minFilter));
        if (texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter) {
          console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.");
        }
      }
      if (texture.compareFunction) {
        _gl.texParameteri(textureType, _gl.TEXTURE_COMPARE_MODE, _gl.COMPARE_REF_TO_TEXTURE);
        _gl.texParameteri(textureType, _gl.TEXTURE_COMPARE_FUNC, compareToGL[texture.compareFunction]);
      }
      if (extensions.has("EXT_texture_filter_anisotropic") === true) {
        const extension = extensions.get("EXT_texture_filter_anisotropic");
        if (texture.magFilter === NearestFilter) return;
        if (texture.minFilter !== NearestMipmapLinearFilter && texture.minFilter !== LinearMipmapLinearFilter) return;
        if (texture.type === FloatType && extensions.has("OES_texture_float_linear") === false) return;
        if (isWebGL2 === false && (texture.type === HalfFloatType && extensions.has("OES_texture_half_float_linear") === false)) return;
        if (texture.anisotropy > 1 || properties.get(texture).__currentAnisotropy) {
          _gl.texParameterf(textureType, extension.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(texture.anisotropy, capabilities.getMaxAnisotropy()));
          properties.get(texture).__currentAnisotropy = texture.anisotropy;
        }
      }
    }
    function initTexture(textureProperties, texture) {
      let forceUpload = false;
      if (textureProperties.__webglInit === void 0) {
        textureProperties.__webglInit = true;
        texture.addEventListener("dispose", onTextureDispose);
      }
      const source = texture.source;
      let webglTextures = _sources.get(source);
      if (webglTextures === void 0) {
        webglTextures = {};
        _sources.set(source, webglTextures);
      }
      const textureCacheKey = getTextureCacheKey(texture);
      if (textureCacheKey !== textureProperties.__cacheKey) {
        if (webglTextures[textureCacheKey] === void 0) {
          webglTextures[textureCacheKey] = {
            texture: _gl.createTexture(),
            usedTimes: 0
          };
          info.memory.textures++;
          forceUpload = true;
        }
        webglTextures[textureCacheKey].usedTimes++;
        const webglTexture = webglTextures[textureProperties.__cacheKey];
        if (webglTexture !== void 0) {
          webglTextures[textureProperties.__cacheKey].usedTimes--;
          if (webglTexture.usedTimes === 0) {
            deleteTexture(texture);
          }
        }
        textureProperties.__cacheKey = textureCacheKey;
        textureProperties.__webglTexture = webglTextures[textureCacheKey].texture;
      }
      return forceUpload;
    }
    function uploadTexture(textureProperties, texture, slot) {
      let textureType = _gl.TEXTURE_2D;
      if (texture.isDataArrayTexture || texture.isCompressedArrayTexture) textureType = _gl.TEXTURE_2D_ARRAY;
      if (texture.isData3DTexture) textureType = _gl.TEXTURE_3D;
      const forceUpload = initTexture(textureProperties, texture);
      const source = texture.source;
      state.bindTexture(textureType, textureProperties.__webglTexture, _gl.TEXTURE0 + slot);
      const sourceProperties = properties.get(source);
      if (source.version !== sourceProperties.__version || forceUpload === true) {
        state.activeTexture(_gl.TEXTURE0 + slot);
        const workingPrimaries = ColorManagement.getPrimaries(ColorManagement.workingColorSpace);
        const texturePrimaries = texture.colorSpace === NoColorSpace ? null : ColorManagement.getPrimaries(texture.colorSpace);
        const unpackConversion = texture.colorSpace === NoColorSpace || workingPrimaries === texturePrimaries ? _gl.NONE : _gl.BROWSER_DEFAULT_WEBGL;
        _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
        _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
        _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
        _gl.pixelStorei(_gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, unpackConversion);
        const needsPowerOfTwo = textureNeedsPowerOfTwo(texture) && isPowerOfTwo$1(texture.image) === false;
        let image = resizeImage(texture.image, needsPowerOfTwo, false, capabilities.maxTextureSize);
        image = verifyColorSpace(texture, image);
        const supportsMips = isPowerOfTwo$1(image) || isWebGL2, glFormat = utils.convert(texture.format, texture.colorSpace);
        let glType = utils.convert(texture.type), glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace, texture.isVideoTexture);
        setTextureParameters(textureType, texture, supportsMips);
        let mipmap;
        const mipmaps = texture.mipmaps;
        const useTexStorage = isWebGL2 && texture.isVideoTexture !== true && glInternalFormat !== RGB_ETC1_Format;
        const allocateMemory = sourceProperties.__version === void 0 || forceUpload === true;
        const levels = getMipLevels(texture, image, supportsMips);
        if (texture.isDepthTexture) {
          glInternalFormat = _gl.DEPTH_COMPONENT;
          if (isWebGL2) {
            if (texture.type === FloatType) {
              glInternalFormat = _gl.DEPTH_COMPONENT32F;
            } else if (texture.type === UnsignedIntType) {
              glInternalFormat = _gl.DEPTH_COMPONENT24;
            } else if (texture.type === UnsignedInt248Type) {
              glInternalFormat = _gl.DEPTH24_STENCIL8;
            } else {
              glInternalFormat = _gl.DEPTH_COMPONENT16;
            }
          } else {
            if (texture.type === FloatType) {
              console.error("WebGLRenderer: Floating point depth texture requires WebGL2.");
            }
          }
          if (texture.format === DepthFormat && glInternalFormat === _gl.DEPTH_COMPONENT) {
            if (texture.type !== UnsignedShortType && texture.type !== UnsignedIntType) {
              console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture.");
              texture.type = UnsignedIntType;
              glType = utils.convert(texture.type);
            }
          }
          if (texture.format === DepthStencilFormat && glInternalFormat === _gl.DEPTH_COMPONENT) {
            glInternalFormat = _gl.DEPTH_STENCIL;
            if (texture.type !== UnsignedInt248Type) {
              console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture.");
              texture.type = UnsignedInt248Type;
              glType = utils.convert(texture.type);
            }
          }
          if (allocateMemory) {
            if (useTexStorage) {
              state.texStorage2D(_gl.TEXTURE_2D, 1, glInternalFormat, image.width, image.height);
            } else {
              state.texImage2D(_gl.TEXTURE_2D, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, null);
            }
          }
        } else if (texture.isDataTexture) {
          if (mipmaps.length > 0 && supportsMips) {
            if (useTexStorage && allocateMemory) {
              state.texStorage2D(_gl.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
            }
            for (let i = 0, il = mipmaps.length; i < il; i++) {
              mipmap = mipmaps[i];
              if (useTexStorage) {
                state.texSubImage2D(_gl.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, glType, mipmap.data);
              } else {
                state.texImage2D(_gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
              }
            }
            texture.generateMipmaps = false;
          } else {
            if (useTexStorage) {
              if (allocateMemory) {
                state.texStorage2D(_gl.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
              }
              state.texSubImage2D(_gl.TEXTURE_2D, 0, 0, 0, image.width, image.height, glFormat, glType, image.data);
            } else {
              state.texImage2D(_gl.TEXTURE_2D, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, image.data);
            }
          }
        } else if (texture.isCompressedTexture) {
          if (texture.isCompressedArrayTexture) {
            if (useTexStorage && allocateMemory) {
              state.texStorage3D(_gl.TEXTURE_2D_ARRAY, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height, image.depth);
            }
            for (let i = 0, il = mipmaps.length; i < il; i++) {
              mipmap = mipmaps[i];
              if (texture.format !== RGBAFormat) {
                if (glFormat !== null) {
                  if (useTexStorage) {
                    state.compressedTexSubImage3D(_gl.TEXTURE_2D_ARRAY, i, 0, 0, 0, mipmap.width, mipmap.height, image.depth, glFormat, mipmap.data, 0, 0);
                  } else {
                    state.compressedTexImage3D(_gl.TEXTURE_2D_ARRAY, i, glInternalFormat, mipmap.width, mipmap.height, image.depth, 0, mipmap.data, 0, 0);
                  }
                } else {
                  console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
                }
              } else {
                if (useTexStorage) {
                  state.texSubImage3D(_gl.TEXTURE_2D_ARRAY, i, 0, 0, 0, mipmap.width, mipmap.height, image.depth, glFormat, glType, mipmap.data);
                } else {
                  state.texImage3D(_gl.TEXTURE_2D_ARRAY, i, glInternalFormat, mipmap.width, mipmap.height, image.depth, 0, glFormat, glType, mipmap.data);
                }
              }
            }
          } else {
            if (useTexStorage && allocateMemory) {
              state.texStorage2D(_gl.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
            }
            for (let i = 0, il = mipmaps.length; i < il; i++) {
              mipmap = mipmaps[i];
              if (texture.format !== RGBAFormat) {
                if (glFormat !== null) {
                  if (useTexStorage) {
                    state.compressedTexSubImage2D(_gl.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, mipmap.data);
                  } else {
                    state.compressedTexImage2D(_gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, mipmap.data);
                  }
                } else {
                  console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
                }
              } else {
                if (useTexStorage) {
                  state.texSubImage2D(_gl.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, glType, mipmap.data);
                } else {
                  state.texImage2D(_gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
                }
              }
            }
          }
        } else if (texture.isDataArrayTexture) {
          if (useTexStorage) {
            if (allocateMemory) {
              state.texStorage3D(_gl.TEXTURE_2D_ARRAY, levels, glInternalFormat, image.width, image.height, image.depth);
            }
            state.texSubImage3D(_gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, image.width, image.height, image.depth, glFormat, glType, image.data);
          } else {
            state.texImage3D(_gl.TEXTURE_2D_ARRAY, 0, glInternalFormat, image.width, image.height, image.depth, 0, glFormat, glType, image.data);
          }
        } else if (texture.isData3DTexture) {
          if (useTexStorage) {
            if (allocateMemory) {
              state.texStorage3D(_gl.TEXTURE_3D, levels, glInternalFormat, image.width, image.height, image.depth);
            }
            state.texSubImage3D(_gl.TEXTURE_3D, 0, 0, 0, 0, image.width, image.height, image.depth, glFormat, glType, image.data);
          } else {
            state.texImage3D(_gl.TEXTURE_3D, 0, glInternalFormat, image.width, image.height, image.depth, 0, glFormat, glType, image.data);
          }
        } else if (texture.isFramebufferTexture) {
          if (allocateMemory) {
            if (useTexStorage) {
              state.texStorage2D(_gl.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
            } else {
              let width = image.width, height = image.height;
              for (let i = 0; i < levels; i++) {
                state.texImage2D(_gl.TEXTURE_2D, i, glInternalFormat, width, height, 0, glFormat, glType, null);
                width >>= 1;
                height >>= 1;
              }
            }
          }
        } else {
          if (mipmaps.length > 0 && supportsMips) {
            if (useTexStorage && allocateMemory) {
              state.texStorage2D(_gl.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
            }
            for (let i = 0, il = mipmaps.length; i < il; i++) {
              mipmap = mipmaps[i];
              if (useTexStorage) {
                state.texSubImage2D(_gl.TEXTURE_2D, i, 0, 0, glFormat, glType, mipmap);
              } else {
                state.texImage2D(_gl.TEXTURE_2D, i, glInternalFormat, glFormat, glType, mipmap);
              }
            }
            texture.generateMipmaps = false;
          } else {
            if (useTexStorage) {
              if (allocateMemory) {
                state.texStorage2D(_gl.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
              }
              state.texSubImage2D(_gl.TEXTURE_2D, 0, 0, 0, glFormat, glType, image);
            } else {
              state.texImage2D(_gl.TEXTURE_2D, 0, glInternalFormat, glFormat, glType, image);
            }
          }
        }
        if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
          generateMipmap(textureType);
        }
        sourceProperties.__version = source.version;
        if (texture.onUpdate) texture.onUpdate(texture);
      }
      textureProperties.__version = texture.version;
    }
    function uploadCubeTexture(textureProperties, texture, slot) {
      if (texture.image.length !== 6) return;
      const forceUpload = initTexture(textureProperties, texture);
      const source = texture.source;
      state.bindTexture(_gl.TEXTURE_CUBE_MAP, textureProperties.__webglTexture, _gl.TEXTURE0 + slot);
      const sourceProperties = properties.get(source);
      if (source.version !== sourceProperties.__version || forceUpload === true) {
        state.activeTexture(_gl.TEXTURE0 + slot);
        const workingPrimaries = ColorManagement.getPrimaries(ColorManagement.workingColorSpace);
        const texturePrimaries = texture.colorSpace === NoColorSpace ? null : ColorManagement.getPrimaries(texture.colorSpace);
        const unpackConversion = texture.colorSpace === NoColorSpace || workingPrimaries === texturePrimaries ? _gl.NONE : _gl.BROWSER_DEFAULT_WEBGL;
        _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
        _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
        _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
        _gl.pixelStorei(_gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, unpackConversion);
        const isCompressed = texture.isCompressedTexture || texture.image[0].isCompressedTexture;
        const isDataTexture = texture.image[0] && texture.image[0].isDataTexture;
        const cubeImage = [];
        for (let i = 0; i < 6; i++) {
          if (!isCompressed && !isDataTexture) {
            cubeImage[i] = resizeImage(texture.image[i], false, true, capabilities.maxCubemapSize);
          } else {
            cubeImage[i] = isDataTexture ? texture.image[i].image : texture.image[i];
          }
          cubeImage[i] = verifyColorSpace(texture, cubeImage[i]);
        }
        const image = cubeImage[0], supportsMips = isPowerOfTwo$1(image) || isWebGL2, glFormat = utils.convert(texture.format, texture.colorSpace), glType = utils.convert(texture.type), glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
        const useTexStorage = isWebGL2 && texture.isVideoTexture !== true;
        const allocateMemory = sourceProperties.__version === void 0 || forceUpload === true;
        let levels = getMipLevels(texture, image, supportsMips);
        setTextureParameters(_gl.TEXTURE_CUBE_MAP, texture, supportsMips);
        let mipmaps;
        if (isCompressed) {
          if (useTexStorage && allocateMemory) {
            state.texStorage2D(_gl.TEXTURE_CUBE_MAP, levels, glInternalFormat, image.width, image.height);
          }
          for (let i = 0; i < 6; i++) {
            mipmaps = cubeImage[i].mipmaps;
            for (let j = 0; j < mipmaps.length; j++) {
              const mipmap = mipmaps[j];
              if (texture.format !== RGBAFormat) {
                if (glFormat !== null) {
                  if (useTexStorage) {
                    state.compressedTexSubImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j, 0, 0, mipmap.width, mipmap.height, glFormat, mipmap.data);
                  } else {
                    state.compressedTexImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j, glInternalFormat, mipmap.width, mipmap.height, 0, mipmap.data);
                  }
                } else {
                  console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");
                }
              } else {
                if (useTexStorage) {
                  state.texSubImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j, 0, 0, mipmap.width, mipmap.height, glFormat, glType, mipmap.data);
                } else {
                  state.texImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
                }
              }
            }
          }
        } else {
          mipmaps = texture.mipmaps;
          if (useTexStorage && allocateMemory) {
            if (mipmaps.length > 0) levels++;
            state.texStorage2D(_gl.TEXTURE_CUBE_MAP, levels, glInternalFormat, cubeImage[0].width, cubeImage[0].height);
          }
          for (let i = 0; i < 6; i++) {
            if (isDataTexture) {
              if (useTexStorage) {
                state.texSubImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 0, 0, cubeImage[i].width, cubeImage[i].height, glFormat, glType, cubeImage[i].data);
              } else {
                state.texImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, cubeImage[i].width, cubeImage[i].height, 0, glFormat, glType, cubeImage[i].data);
              }
              for (let j = 0; j < mipmaps.length; j++) {
                const mipmap = mipmaps[j];
                const mipmapImage = mipmap.image[i].image;
                if (useTexStorage) {
                  state.texSubImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j + 1, 0, 0, mipmapImage.width, mipmapImage.height, glFormat, glType, mipmapImage.data);
                } else {
                  state.texImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j + 1, glInternalFormat, mipmapImage.width, mipmapImage.height, 0, glFormat, glType, mipmapImage.data);
                }
              }
            } else {
              if (useTexStorage) {
                state.texSubImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 0, 0, glFormat, glType, cubeImage[i]);
              } else {
                state.texImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, glFormat, glType, cubeImage[i]);
              }
              for (let j = 0; j < mipmaps.length; j++) {
                const mipmap = mipmaps[j];
                if (useTexStorage) {
                  state.texSubImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j + 1, 0, 0, glFormat, glType, mipmap.image[i]);
                } else {
                  state.texImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j + 1, glInternalFormat, glFormat, glType, mipmap.image[i]);
                }
              }
            }
          }
        }
        if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
          generateMipmap(_gl.TEXTURE_CUBE_MAP);
        }
        sourceProperties.__version = source.version;
        if (texture.onUpdate) texture.onUpdate(texture);
      }
      textureProperties.__version = texture.version;
    }
    function setupFrameBufferTexture(framebuffer, renderTarget, texture, attachment, textureTarget, level) {
      const glFormat = utils.convert(texture.format, texture.colorSpace);
      const glType = utils.convert(texture.type);
      const glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
      const renderTargetProperties = properties.get(renderTarget);
      if (!renderTargetProperties.__hasExternalTextures) {
        const width = Math.max(1, renderTarget.width >> level);
        const height = Math.max(1, renderTarget.height >> level);
        if (textureTarget === _gl.TEXTURE_3D || textureTarget === _gl.TEXTURE_2D_ARRAY) {
          state.texImage3D(textureTarget, level, glInternalFormat, width, height, renderTarget.depth, 0, glFormat, glType, null);
        } else {
          state.texImage2D(textureTarget, level, glInternalFormat, width, height, 0, glFormat, glType, null);
        }
      }
      state.bindFramebuffer(_gl.FRAMEBUFFER, framebuffer);
      if (useMultisampledRTT(renderTarget)) {
        multisampledRTTExt.framebufferTexture2DMultisampleEXT(_gl.FRAMEBUFFER, attachment, textureTarget, properties.get(texture).__webglTexture, 0, getRenderTargetSamples(renderTarget));
      } else if (textureTarget === _gl.TEXTURE_2D || textureTarget >= _gl.TEXTURE_CUBE_MAP_POSITIVE_X && textureTarget <= _gl.TEXTURE_CUBE_MAP_NEGATIVE_Z) {
        _gl.framebufferTexture2D(_gl.FRAMEBUFFER, attachment, textureTarget, properties.get(texture).__webglTexture, level);
      }
      state.bindFramebuffer(_gl.FRAMEBUFFER, null);
    }
    function setupRenderBufferStorage(renderbuffer, renderTarget, isMultisample) {
      _gl.bindRenderbuffer(_gl.RENDERBUFFER, renderbuffer);
      if (renderTarget.depthBuffer && !renderTarget.stencilBuffer) {
        let glInternalFormat = isWebGL2 === true ? _gl.DEPTH_COMPONENT24 : _gl.DEPTH_COMPONENT16;
        if (isMultisample || useMultisampledRTT(renderTarget)) {
          const depthTexture = renderTarget.depthTexture;
          if (depthTexture && depthTexture.isDepthTexture) {
            if (depthTexture.type === FloatType) {
              glInternalFormat = _gl.DEPTH_COMPONENT32F;
            } else if (depthTexture.type === UnsignedIntType) {
              glInternalFormat = _gl.DEPTH_COMPONENT24;
            }
          }
          const samples = getRenderTargetSamples(renderTarget);
          if (useMultisampledRTT(renderTarget)) {
            multisampledRTTExt.renderbufferStorageMultisampleEXT(_gl.RENDERBUFFER, samples, glInternalFormat, renderTarget.width, renderTarget.height);
          } else {
            _gl.renderbufferStorageMultisample(_gl.RENDERBUFFER, samples, glInternalFormat, renderTarget.width, renderTarget.height);
          }
        } else {
          _gl.renderbufferStorage(_gl.RENDERBUFFER, glInternalFormat, renderTarget.width, renderTarget.height);
        }
        _gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer);
      } else if (renderTarget.depthBuffer && renderTarget.stencilBuffer) {
        const samples = getRenderTargetSamples(renderTarget);
        if (isMultisample && useMultisampledRTT(renderTarget) === false) {
          _gl.renderbufferStorageMultisample(_gl.RENDERBUFFER, samples, _gl.DEPTH24_STENCIL8, renderTarget.width, renderTarget.height);
        } else if (useMultisampledRTT(renderTarget)) {
          multisampledRTTExt.renderbufferStorageMultisampleEXT(_gl.RENDERBUFFER, samples, _gl.DEPTH24_STENCIL8, renderTarget.width, renderTarget.height);
        } else {
          _gl.renderbufferStorage(_gl.RENDERBUFFER, _gl.DEPTH_STENCIL, renderTarget.width, renderTarget.height);
        }
        _gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.DEPTH_STENCIL_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer);
      } else {
        const textures = renderTarget.isWebGLMultipleRenderTargets === true ? renderTarget.texture : [renderTarget.texture];
        for (let i = 0; i < textures.length; i++) {
          const texture = textures[i];
          const glFormat = utils.convert(texture.format, texture.colorSpace);
          const glType = utils.convert(texture.type);
          const glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
          const samples = getRenderTargetSamples(renderTarget);
          if (isMultisample && useMultisampledRTT(renderTarget) === false) {
            _gl.renderbufferStorageMultisample(_gl.RENDERBUFFER, samples, glInternalFormat, renderTarget.width, renderTarget.height);
          } else if (useMultisampledRTT(renderTarget)) {
            multisampledRTTExt.renderbufferStorageMultisampleEXT(_gl.RENDERBUFFER, samples, glInternalFormat, renderTarget.width, renderTarget.height);
          } else {
            _gl.renderbufferStorage(_gl.RENDERBUFFER, glInternalFormat, renderTarget.width, renderTarget.height);
          }
        }
      }
      _gl.bindRenderbuffer(_gl.RENDERBUFFER, null);
    }
    function setupDepthTexture(framebuffer, renderTarget) {
      const isCube = renderTarget && renderTarget.isWebGLCubeRenderTarget;
      if (isCube) throw new Error("Depth Texture with cube render targets is not supported");
      state.bindFramebuffer(_gl.FRAMEBUFFER, framebuffer);
      if (!(renderTarget.depthTexture && renderTarget.depthTexture.isDepthTexture)) {
        throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");
      }
      if (!properties.get(renderTarget.depthTexture).__webglTexture || renderTarget.depthTexture.image.width !== renderTarget.width || renderTarget.depthTexture.image.height !== renderTarget.height) {
        renderTarget.depthTexture.image.width = renderTarget.width;
        renderTarget.depthTexture.image.height = renderTarget.height;
        renderTarget.depthTexture.needsUpdate = true;
      }
      setTexture2D(renderTarget.depthTexture, 0);
      const webglDepthTexture = properties.get(renderTarget.depthTexture).__webglTexture;
      const samples = getRenderTargetSamples(renderTarget);
      if (renderTarget.depthTexture.format === DepthFormat) {
        if (useMultisampledRTT(renderTarget)) {
          multisampledRTTExt.framebufferTexture2DMultisampleEXT(_gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.TEXTURE_2D, webglDepthTexture, 0, samples);
        } else {
          _gl.framebufferTexture2D(_gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.TEXTURE_2D, webglDepthTexture, 0);
        }
      } else if (renderTarget.depthTexture.format === DepthStencilFormat) {
        if (useMultisampledRTT(renderTarget)) {
          multisampledRTTExt.framebufferTexture2DMultisampleEXT(_gl.FRAMEBUFFER, _gl.DEPTH_STENCIL_ATTACHMENT, _gl.TEXTURE_2D, webglDepthTexture, 0, samples);
        } else {
          _gl.framebufferTexture2D(_gl.FRAMEBUFFER, _gl.DEPTH_STENCIL_ATTACHMENT, _gl.TEXTURE_2D, webglDepthTexture, 0);
        }
      } else {
        throw new Error("Unknown depthTexture format");
      }
    }
    function setupDepthRenderbuffer(renderTarget) {
      const renderTargetProperties = properties.get(renderTarget);
      const isCube = renderTarget.isWebGLCubeRenderTarget === true;
      if (renderTarget.depthTexture && !renderTargetProperties.__autoAllocateDepthBuffer) {
        if (isCube) throw new Error("target.depthTexture not supported in Cube render targets");
        setupDepthTexture(renderTargetProperties.__webglFramebuffer, renderTarget);
      } else {
        if (isCube) {
          renderTargetProperties.__webglDepthbuffer = [];
          for (let i = 0; i < 6; i++) {
            state.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer[i]);
            renderTargetProperties.__webglDepthbuffer[i] = _gl.createRenderbuffer();
            setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer[i], renderTarget, false);
          }
        } else {
          state.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
          renderTargetProperties.__webglDepthbuffer = _gl.createRenderbuffer();
          setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer, renderTarget, false);
        }
      }
      state.bindFramebuffer(_gl.FRAMEBUFFER, null);
    }
    function rebindTextures(renderTarget, colorTexture, depthTexture) {
      const renderTargetProperties = properties.get(renderTarget);
      if (colorTexture !== void 0) {
        setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer, renderTarget, renderTarget.texture, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_2D, 0);
      }
      if (depthTexture !== void 0) {
        setupDepthRenderbuffer(renderTarget);
      }
    }
    function setupRenderTarget(renderTarget) {
      const texture = renderTarget.texture;
      const renderTargetProperties = properties.get(renderTarget);
      const textureProperties = properties.get(texture);
      renderTarget.addEventListener("dispose", onRenderTargetDispose);
      if (renderTarget.isWebGLMultipleRenderTargets !== true) {
        if (textureProperties.__webglTexture === void 0) {
          textureProperties.__webglTexture = _gl.createTexture();
        }
        textureProperties.__version = texture.version;
        info.memory.textures++;
      }
      const isCube = renderTarget.isWebGLCubeRenderTarget === true;
      const isMultipleRenderTargets = renderTarget.isWebGLMultipleRenderTargets === true;
      const supportsMips = isPowerOfTwo$1(renderTarget) || isWebGL2;
      if (isCube) {
        renderTargetProperties.__webglFramebuffer = [];
        for (let i = 0; i < 6; i++) {
          if (isWebGL2 && texture.mipmaps && texture.mipmaps.length > 0) {
            renderTargetProperties.__webglFramebuffer[i] = [];
            for (let level = 0; level < texture.mipmaps.length; level++) {
              renderTargetProperties.__webglFramebuffer[i][level] = _gl.createFramebuffer();
            }
          } else {
            renderTargetProperties.__webglFramebuffer[i] = _gl.createFramebuffer();
          }
        }
      } else {
        if (isWebGL2 && texture.mipmaps && texture.mipmaps.length > 0) {
          renderTargetProperties.__webglFramebuffer = [];
          for (let level = 0; level < texture.mipmaps.length; level++) {
            renderTargetProperties.__webglFramebuffer[level] = _gl.createFramebuffer();
          }
        } else {
          renderTargetProperties.__webglFramebuffer = _gl.createFramebuffer();
        }
        if (isMultipleRenderTargets) {
          if (capabilities.drawBuffers) {
            const textures = renderTarget.texture;
            for (let i = 0, il = textures.length; i < il; i++) {
              const attachmentProperties = properties.get(textures[i]);
              if (attachmentProperties.__webglTexture === void 0) {
                attachmentProperties.__webglTexture = _gl.createTexture();
                info.memory.textures++;
              }
            }
          } else {
            console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");
          }
        }
        if (isWebGL2 && renderTarget.samples > 0 && useMultisampledRTT(renderTarget) === false) {
          const textures = isMultipleRenderTargets ? texture : [texture];
          renderTargetProperties.__webglMultisampledFramebuffer = _gl.createFramebuffer();
          renderTargetProperties.__webglColorRenderbuffer = [];
          state.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
          for (let i = 0; i < textures.length; i++) {
            const texture2 = textures[i];
            renderTargetProperties.__webglColorRenderbuffer[i] = _gl.createRenderbuffer();
            _gl.bindRenderbuffer(_gl.RENDERBUFFER, renderTargetProperties.__webglColorRenderbuffer[i]);
            const glFormat = utils.convert(texture2.format, texture2.colorSpace);
            const glType = utils.convert(texture2.type);
            const glInternalFormat = getInternalFormat(texture2.internalFormat, glFormat, glType, texture2.colorSpace, renderTarget.isXRRenderTarget === true);
            const samples = getRenderTargetSamples(renderTarget);
            _gl.renderbufferStorageMultisample(_gl.RENDERBUFFER, samples, glInternalFormat, renderTarget.width, renderTarget.height);
            _gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0 + i, _gl.RENDERBUFFER, renderTargetProperties.__webglColorRenderbuffer[i]);
          }
          _gl.bindRenderbuffer(_gl.RENDERBUFFER, null);
          if (renderTarget.depthBuffer) {
            renderTargetProperties.__webglDepthRenderbuffer = _gl.createRenderbuffer();
            setupRenderBufferStorage(renderTargetProperties.__webglDepthRenderbuffer, renderTarget, true);
          }
          state.bindFramebuffer(_gl.FRAMEBUFFER, null);
        }
      }
      if (isCube) {
        state.bindTexture(_gl.TEXTURE_CUBE_MAP, textureProperties.__webglTexture);
        setTextureParameters(_gl.TEXTURE_CUBE_MAP, texture, supportsMips);
        for (let i = 0; i < 6; i++) {
          if (isWebGL2 && texture.mipmaps && texture.mipmaps.length > 0) {
            for (let level = 0; level < texture.mipmaps.length; level++) {
              setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer[i][level], renderTarget, texture, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, level);
            }
          } else {
            setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer[i], renderTarget, texture, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0);
          }
        }
        if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
          generateMipmap(_gl.TEXTURE_CUBE_MAP);
        }
        state.unbindTexture();
      } else if (isMultipleRenderTargets) {
        const textures = renderTarget.texture;
        for (let i = 0, il = textures.length; i < il; i++) {
          const attachment = textures[i];
          const attachmentProperties = properties.get(attachment);
          state.bindTexture(_gl.TEXTURE_2D, attachmentProperties.__webglTexture);
          setTextureParameters(_gl.TEXTURE_2D, attachment, supportsMips);
          setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer, renderTarget, attachment, _gl.COLOR_ATTACHMENT0 + i, _gl.TEXTURE_2D, 0);
          if (textureNeedsGenerateMipmaps(attachment, supportsMips)) {
            generateMipmap(_gl.TEXTURE_2D);
          }
        }
        state.unbindTexture();
      } else {
        let glTextureType = _gl.TEXTURE_2D;
        if (renderTarget.isWebGL3DRenderTarget || renderTarget.isWebGLArrayRenderTarget) {
          if (isWebGL2) {
            glTextureType = renderTarget.isWebGL3DRenderTarget ? _gl.TEXTURE_3D : _gl.TEXTURE_2D_ARRAY;
          } else {
            console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.");
          }
        }
        state.bindTexture(glTextureType, textureProperties.__webglTexture);
        setTextureParameters(glTextureType, texture, supportsMips);
        if (isWebGL2 && texture.mipmaps && texture.mipmaps.length > 0) {
          for (let level = 0; level < texture.mipmaps.length; level++) {
            setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer[level], renderTarget, texture, _gl.COLOR_ATTACHMENT0, glTextureType, level);
          }
        } else {
          setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer, renderTarget, texture, _gl.COLOR_ATTACHMENT0, glTextureType, 0);
        }
        if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
          generateMipmap(glTextureType);
        }
        state.unbindTexture();
      }
      if (renderTarget.depthBuffer) {
        setupDepthRenderbuffer(renderTarget);
      }
    }
    function updateRenderTargetMipmap(renderTarget) {
      const supportsMips = isPowerOfTwo$1(renderTarget) || isWebGL2;
      const textures = renderTarget.isWebGLMultipleRenderTargets === true ? renderTarget.texture : [renderTarget.texture];
      for (let i = 0, il = textures.length; i < il; i++) {
        const texture = textures[i];
        if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
          const target = renderTarget.isWebGLCubeRenderTarget ? _gl.TEXTURE_CUBE_MAP : _gl.TEXTURE_2D;
          const webglTexture = properties.get(texture).__webglTexture;
          state.bindTexture(target, webglTexture);
          generateMipmap(target);
          state.unbindTexture();
        }
      }
    }
    function updateMultisampleRenderTarget(renderTarget) {
      if (isWebGL2 && renderTarget.samples > 0 && useMultisampledRTT(renderTarget) === false) {
        const textures = renderTarget.isWebGLMultipleRenderTargets ? renderTarget.texture : [renderTarget.texture];
        const width = renderTarget.width;
        const height = renderTarget.height;
        let mask = _gl.COLOR_BUFFER_BIT;
        const invalidationArray = [];
        const depthStyle = renderTarget.stencilBuffer ? _gl.DEPTH_STENCIL_ATTACHMENT : _gl.DEPTH_ATTACHMENT;
        const renderTargetProperties = properties.get(renderTarget);
        const isMultipleRenderTargets = renderTarget.isWebGLMultipleRenderTargets === true;
        if (isMultipleRenderTargets) {
          for (let i = 0; i < textures.length; i++) {
            state.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
            _gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0 + i, _gl.RENDERBUFFER, null);
            state.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
            _gl.framebufferTexture2D(_gl.DRAW_FRAMEBUFFER, _gl.COLOR_ATTACHMENT0 + i, _gl.TEXTURE_2D, null, 0);
          }
        }
        state.bindFramebuffer(_gl.READ_FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
        state.bindFramebuffer(_gl.DRAW_FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
        for (let i = 0; i < textures.length; i++) {
          invalidationArray.push(_gl.COLOR_ATTACHMENT0 + i);
          if (renderTarget.depthBuffer) {
            invalidationArray.push(depthStyle);
          }
          const ignoreDepthValues = renderTargetProperties.__ignoreDepthValues !== void 0 ? renderTargetProperties.__ignoreDepthValues : false;
          if (ignoreDepthValues === false) {
            if (renderTarget.depthBuffer) mask |= _gl.DEPTH_BUFFER_BIT;
            if (renderTarget.stencilBuffer) mask |= _gl.STENCIL_BUFFER_BIT;
          }
          if (isMultipleRenderTargets) {
            _gl.framebufferRenderbuffer(_gl.READ_FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, _gl.RENDERBUFFER, renderTargetProperties.__webglColorRenderbuffer[i]);
          }
          if (ignoreDepthValues === true) {
            _gl.invalidateFramebuffer(_gl.READ_FRAMEBUFFER, [depthStyle]);
            _gl.invalidateFramebuffer(_gl.DRAW_FRAMEBUFFER, [depthStyle]);
          }
          if (isMultipleRenderTargets) {
            const webglTexture = properties.get(textures[i]).__webglTexture;
            _gl.framebufferTexture2D(_gl.DRAW_FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_2D, webglTexture, 0);
          }
          _gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, mask, _gl.NEAREST);
          if (supportsInvalidateFramebuffer) {
            _gl.invalidateFramebuffer(_gl.READ_FRAMEBUFFER, invalidationArray);
          }
        }
        state.bindFramebuffer(_gl.READ_FRAMEBUFFER, null);
        state.bindFramebuffer(_gl.DRAW_FRAMEBUFFER, null);
        if (isMultipleRenderTargets) {
          for (let i = 0; i < textures.length; i++) {
            state.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
            _gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0 + i, _gl.RENDERBUFFER, renderTargetProperties.__webglColorRenderbuffer[i]);
            const webglTexture = properties.get(textures[i]).__webglTexture;
            state.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
            _gl.framebufferTexture2D(_gl.DRAW_FRAMEBUFFER, _gl.COLOR_ATTACHMENT0 + i, _gl.TEXTURE_2D, webglTexture, 0);
          }
        }
        state.bindFramebuffer(_gl.DRAW_FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
      }
    }
    function getRenderTargetSamples(renderTarget) {
      return Math.min(capabilities.maxSamples, renderTarget.samples);
    }
    function useMultisampledRTT(renderTarget) {
      const renderTargetProperties = properties.get(renderTarget);
      return isWebGL2 && renderTarget.samples > 0 && extensions.has("WEBGL_multisampled_render_to_texture") === true && renderTargetProperties.__useRenderToTexture !== false;
    }
    function updateVideoTexture(texture) {
      const frame = info.render.frame;
      if (_videoTextures.get(texture) !== frame) {
        _videoTextures.set(texture, frame);
        texture.update();
      }
    }
    function verifyColorSpace(texture, image) {
      const colorSpace = texture.colorSpace;
      const format = texture.format;
      const type = texture.type;
      if (texture.isCompressedTexture === true || texture.isVideoTexture === true || texture.format === _SRGBAFormat) return image;
      if (colorSpace !== LinearSRGBColorSpace && colorSpace !== NoColorSpace) {
        if (ColorManagement.getTransfer(colorSpace) === SRGBTransfer) {
          if (isWebGL2 === false) {
            if (extensions.has("EXT_sRGB") === true && format === RGBAFormat) {
              texture.format = _SRGBAFormat;
              texture.minFilter = LinearFilter;
              texture.generateMipmaps = false;
            } else {
              image = ImageUtils.sRGBToLinear(image);
            }
          } else {
            if (format !== RGBAFormat || type !== UnsignedByteType) {
              console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.");
            }
          }
        } else {
          console.error("THREE.WebGLTextures: Unsupported texture color space:", colorSpace);
        }
      }
      return image;
    }
    this.allocateTextureUnit = allocateTextureUnit;
    this.resetTextureUnits = resetTextureUnits;
    this.setTexture2D = setTexture2D;
    this.setTexture2DArray = setTexture2DArray;
    this.setTexture3D = setTexture3D;
    this.setTextureCube = setTextureCube;
    this.rebindTextures = rebindTextures;
    this.setupRenderTarget = setupRenderTarget;
    this.updateRenderTargetMipmap = updateRenderTargetMipmap;
    this.updateMultisampleRenderTarget = updateMultisampleRenderTarget;
    this.setupDepthRenderbuffer = setupDepthRenderbuffer;
    this.setupFrameBufferTexture = setupFrameBufferTexture;
    this.useMultisampledRTT = useMultisampledRTT;
  }
  function WebGLUtils(gl, extensions, capabilities) {
    const isWebGL2 = capabilities.isWebGL2;
    function convert(p, colorSpace = NoColorSpace) {
      let extension;
      const transfer = ColorManagement.getTransfer(colorSpace);
      if (p === UnsignedByteType) return gl.UNSIGNED_BYTE;
      if (p === UnsignedShort4444Type) return gl.UNSIGNED_SHORT_4_4_4_4;
      if (p === UnsignedShort5551Type) return gl.UNSIGNED_SHORT_5_5_5_1;
      if (p === ByteType) return gl.BYTE;
      if (p === ShortType) return gl.SHORT;
      if (p === UnsignedShortType) return gl.UNSIGNED_SHORT;
      if (p === IntType) return gl.INT;
      if (p === UnsignedIntType) return gl.UNSIGNED_INT;
      if (p === FloatType) return gl.FLOAT;
      if (p === HalfFloatType) {
        if (isWebGL2) return gl.HALF_FLOAT;
        extension = extensions.get("OES_texture_half_float");
        if (extension !== null) {
          return extension.HALF_FLOAT_OES;
        } else {
          return null;
        }
      }
      if (p === AlphaFormat) return gl.ALPHA;
      if (p === RGBAFormat) return gl.RGBA;
      if (p === LuminanceFormat) return gl.LUMINANCE;
      if (p === LuminanceAlphaFormat) return gl.LUMINANCE_ALPHA;
      if (p === DepthFormat) return gl.DEPTH_COMPONENT;
      if (p === DepthStencilFormat) return gl.DEPTH_STENCIL;
      if (p === _SRGBAFormat) {
        extension = extensions.get("EXT_sRGB");
        if (extension !== null) {
          return extension.SRGB_ALPHA_EXT;
        } else {
          return null;
        }
      }
      if (p === RedFormat) return gl.RED;
      if (p === RedIntegerFormat) return gl.RED_INTEGER;
      if (p === RGFormat) return gl.RG;
      if (p === RGIntegerFormat) return gl.RG_INTEGER;
      if (p === RGBAIntegerFormat) return gl.RGBA_INTEGER;
      if (p === RGB_S3TC_DXT1_Format || p === RGBA_S3TC_DXT1_Format || p === RGBA_S3TC_DXT3_Format || p === RGBA_S3TC_DXT5_Format) {
        if (transfer === SRGBTransfer) {
          extension = extensions.get("WEBGL_compressed_texture_s3tc_srgb");
          if (extension !== null) {
            if (p === RGB_S3TC_DXT1_Format) return extension.COMPRESSED_SRGB_S3TC_DXT1_EXT;
            if (p === RGBA_S3TC_DXT1_Format) return extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
            if (p === RGBA_S3TC_DXT3_Format) return extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
            if (p === RGBA_S3TC_DXT5_Format) return extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
          } else {
            return null;
          }
        } else {
          extension = extensions.get("WEBGL_compressed_texture_s3tc");
          if (extension !== null) {
            if (p === RGB_S3TC_DXT1_Format) return extension.COMPRESSED_RGB_S3TC_DXT1_EXT;
            if (p === RGBA_S3TC_DXT1_Format) return extension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
            if (p === RGBA_S3TC_DXT3_Format) return extension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
            if (p === RGBA_S3TC_DXT5_Format) return extension.COMPRESSED_RGBA_S3TC_DXT5_EXT;
          } else {
            return null;
          }
        }
      }
      if (p === RGB_PVRTC_4BPPV1_Format || p === RGB_PVRTC_2BPPV1_Format || p === RGBA_PVRTC_4BPPV1_Format || p === RGBA_PVRTC_2BPPV1_Format) {
        extension = extensions.get("WEBGL_compressed_texture_pvrtc");
        if (extension !== null) {
          if (p === RGB_PVRTC_4BPPV1_Format) return extension.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
          if (p === RGB_PVRTC_2BPPV1_Format) return extension.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
          if (p === RGBA_PVRTC_4BPPV1_Format) return extension.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
          if (p === RGBA_PVRTC_2BPPV1_Format) return extension.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
        } else {
          return null;
        }
      }
      if (p === RGB_ETC1_Format) {
        extension = extensions.get("WEBGL_compressed_texture_etc1");
        if (extension !== null) {
          return extension.COMPRESSED_RGB_ETC1_WEBGL;
        } else {
          return null;
        }
      }
      if (p === RGB_ETC2_Format || p === RGBA_ETC2_EAC_Format) {
        extension = extensions.get("WEBGL_compressed_texture_etc");
        if (extension !== null) {
          if (p === RGB_ETC2_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ETC2 : extension.COMPRESSED_RGB8_ETC2;
          if (p === RGBA_ETC2_EAC_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC : extension.COMPRESSED_RGBA8_ETC2_EAC;
        } else {
          return null;
        }
      }
      if (p === RGBA_ASTC_4x4_Format || p === RGBA_ASTC_5x4_Format || p === RGBA_ASTC_5x5_Format || p === RGBA_ASTC_6x5_Format || p === RGBA_ASTC_6x6_Format || p === RGBA_ASTC_8x5_Format || p === RGBA_ASTC_8x6_Format || p === RGBA_ASTC_8x8_Format || p === RGBA_ASTC_10x5_Format || p === RGBA_ASTC_10x6_Format || p === RGBA_ASTC_10x8_Format || p === RGBA_ASTC_10x10_Format || p === RGBA_ASTC_12x10_Format || p === RGBA_ASTC_12x12_Format) {
        extension = extensions.get("WEBGL_compressed_texture_astc");
        if (extension !== null) {
          if (p === RGBA_ASTC_4x4_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR : extension.COMPRESSED_RGBA_ASTC_4x4_KHR;
          if (p === RGBA_ASTC_5x4_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR : extension.COMPRESSED_RGBA_ASTC_5x4_KHR;
          if (p === RGBA_ASTC_5x5_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR : extension.COMPRESSED_RGBA_ASTC_5x5_KHR;
          if (p === RGBA_ASTC_6x5_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR : extension.COMPRESSED_RGBA_ASTC_6x5_KHR;
          if (p === RGBA_ASTC_6x6_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR : extension.COMPRESSED_RGBA_ASTC_6x6_KHR;
          if (p === RGBA_ASTC_8x5_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR : extension.COMPRESSED_RGBA_ASTC_8x5_KHR;
          if (p === RGBA_ASTC_8x6_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR : extension.COMPRESSED_RGBA_ASTC_8x6_KHR;
          if (p === RGBA_ASTC_8x8_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR : extension.COMPRESSED_RGBA_ASTC_8x8_KHR;
          if (p === RGBA_ASTC_10x5_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR : extension.COMPRESSED_RGBA_ASTC_10x5_KHR;
          if (p === RGBA_ASTC_10x6_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR : extension.COMPRESSED_RGBA_ASTC_10x6_KHR;
          if (p === RGBA_ASTC_10x8_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR : extension.COMPRESSED_RGBA_ASTC_10x8_KHR;
          if (p === RGBA_ASTC_10x10_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR : extension.COMPRESSED_RGBA_ASTC_10x10_KHR;
          if (p === RGBA_ASTC_12x10_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR : extension.COMPRESSED_RGBA_ASTC_12x10_KHR;
          if (p === RGBA_ASTC_12x12_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR : extension.COMPRESSED_RGBA_ASTC_12x12_KHR;
        } else {
          return null;
        }
      }
      if (p === RGBA_BPTC_Format || p === RGB_BPTC_SIGNED_Format || p === RGB_BPTC_UNSIGNED_Format) {
        extension = extensions.get("EXT_texture_compression_bptc");
        if (extension !== null) {
          if (p === RGBA_BPTC_Format) return transfer === SRGBTransfer ? extension.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT : extension.COMPRESSED_RGBA_BPTC_UNORM_EXT;
          if (p === RGB_BPTC_SIGNED_Format) return extension.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
          if (p === RGB_BPTC_UNSIGNED_Format) return extension.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
        } else {
          return null;
        }
      }
      if (p === RED_RGTC1_Format || p === SIGNED_RED_RGTC1_Format || p === RED_GREEN_RGTC2_Format || p === SIGNED_RED_GREEN_RGTC2_Format) {
        extension = extensions.get("EXT_texture_compression_rgtc");
        if (extension !== null) {
          if (p === RGBA_BPTC_Format) return extension.COMPRESSED_RED_RGTC1_EXT;
          if (p === SIGNED_RED_RGTC1_Format) return extension.COMPRESSED_SIGNED_RED_RGTC1_EXT;
          if (p === RED_GREEN_RGTC2_Format) return extension.COMPRESSED_RED_GREEN_RGTC2_EXT;
          if (p === SIGNED_RED_GREEN_RGTC2_Format) return extension.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT;
        } else {
          return null;
        }
      }
      if (p === UnsignedInt248Type) {
        if (isWebGL2) return gl.UNSIGNED_INT_24_8;
        extension = extensions.get("WEBGL_depth_texture");
        if (extension !== null) {
          return extension.UNSIGNED_INT_24_8_WEBGL;
        } else {
          return null;
        }
      }
      return gl[p] !== void 0 ? gl[p] : null;
    }
    return { convert };
  }
  var ArrayCamera = class extends PerspectiveCamera {
    constructor(array = []) {
      super();
      this.isArrayCamera = true;
      this.cameras = array;
    }
  };
  var Group = class extends Object3D {
    constructor() {
      super();
      this.isGroup = true;
      this.type = "Group";
    }
  };
  var _moveEvent = { type: "move" };
  var WebXRController = class {
    constructor() {
      this._targetRay = null;
      this._grip = null;
      this._hand = null;
    }
    getHandSpace() {
      if (this._hand === null) {
        this._hand = new Group();
        this._hand.matrixAutoUpdate = false;
        this._hand.visible = false;
        this._hand.joints = {};
        this._hand.inputState = { pinching: false };
      }
      return this._hand;
    }
    getTargetRaySpace() {
      if (this._targetRay === null) {
        this._targetRay = new Group();
        this._targetRay.matrixAutoUpdate = false;
        this._targetRay.visible = false;
        this._targetRay.hasLinearVelocity = false;
        this._targetRay.linearVelocity = new Vector3();
        this._targetRay.hasAngularVelocity = false;
        this._targetRay.angularVelocity = new Vector3();
      }
      return this._targetRay;
    }
    getGripSpace() {
      if (this._grip === null) {
        this._grip = new Group();
        this._grip.matrixAutoUpdate = false;
        this._grip.visible = false;
        this._grip.hasLinearVelocity = false;
        this._grip.linearVelocity = new Vector3();
        this._grip.hasAngularVelocity = false;
        this._grip.angularVelocity = new Vector3();
      }
      return this._grip;
    }
    dispatchEvent(event) {
      if (this._targetRay !== null) {
        this._targetRay.dispatchEvent(event);
      }
      if (this._grip !== null) {
        this._grip.dispatchEvent(event);
      }
      if (this._hand !== null) {
        this._hand.dispatchEvent(event);
      }
      return this;
    }
    connect(inputSource) {
      if (inputSource && inputSource.hand) {
        const hand = this._hand;
        if (hand) {
          for (const inputjoint of inputSource.hand.values()) {
            this._getHandJoint(hand, inputjoint);
          }
        }
      }
      this.dispatchEvent({ type: "connected", data: inputSource });
      return this;
    }
    disconnect(inputSource) {
      this.dispatchEvent({ type: "disconnected", data: inputSource });
      if (this._targetRay !== null) {
        this._targetRay.visible = false;
      }
      if (this._grip !== null) {
        this._grip.visible = false;
      }
      if (this._hand !== null) {
        this._hand.visible = false;
      }
      return this;
    }
    update(inputSource, frame, referenceSpace) {
      let inputPose = null;
      let gripPose = null;
      let handPose = null;
      const targetRay = this._targetRay;
      const grip = this._grip;
      const hand = this._hand;
      if (inputSource && frame.session.visibilityState !== "visible-blurred") {
        if (hand && inputSource.hand) {
          handPose = true;
          for (const inputjoint of inputSource.hand.values()) {
            const jointPose = frame.getJointPose(inputjoint, referenceSpace);
            const joint = this._getHandJoint(hand, inputjoint);
            if (jointPose !== null) {
              joint.matrix.fromArray(jointPose.transform.matrix);
              joint.matrix.decompose(joint.position, joint.rotation, joint.scale);
              joint.matrixWorldNeedsUpdate = true;
              joint.jointRadius = jointPose.radius;
            }
            joint.visible = jointPose !== null;
          }
          const indexTip = hand.joints["index-finger-tip"];
          const thumbTip = hand.joints["thumb-tip"];
          const distance = indexTip.position.distanceTo(thumbTip.position);
          const distanceToPinch = 0.02;
          const threshold = 5e-3;
          if (hand.inputState.pinching && distance > distanceToPinch + threshold) {
            hand.inputState.pinching = false;
            this.dispatchEvent({
              type: "pinchend",
              handedness: inputSource.handedness,
              target: this
            });
          } else if (!hand.inputState.pinching && distance <= distanceToPinch - threshold) {
            hand.inputState.pinching = true;
            this.dispatchEvent({
              type: "pinchstart",
              handedness: inputSource.handedness,
              target: this
            });
          }
        } else {
          if (grip !== null && inputSource.gripSpace) {
            gripPose = frame.getPose(inputSource.gripSpace, referenceSpace);
            if (gripPose !== null) {
              grip.matrix.fromArray(gripPose.transform.matrix);
              grip.matrix.decompose(grip.position, grip.rotation, grip.scale);
              grip.matrixWorldNeedsUpdate = true;
              if (gripPose.linearVelocity) {
                grip.hasLinearVelocity = true;
                grip.linearVelocity.copy(gripPose.linearVelocity);
              } else {
                grip.hasLinearVelocity = false;
              }
              if (gripPose.angularVelocity) {
                grip.hasAngularVelocity = true;
                grip.angularVelocity.copy(gripPose.angularVelocity);
              } else {
                grip.hasAngularVelocity = false;
              }
            }
          }
        }
        if (targetRay !== null) {
          inputPose = frame.getPose(inputSource.targetRaySpace, referenceSpace);
          if (inputPose === null && gripPose !== null) {
            inputPose = gripPose;
          }
          if (inputPose !== null) {
            targetRay.matrix.fromArray(inputPose.transform.matrix);
            targetRay.matrix.decompose(targetRay.position, targetRay.rotation, targetRay.scale);
            targetRay.matrixWorldNeedsUpdate = true;
            if (inputPose.linearVelocity) {
              targetRay.hasLinearVelocity = true;
              targetRay.linearVelocity.copy(inputPose.linearVelocity);
            } else {
              targetRay.hasLinearVelocity = false;
            }
            if (inputPose.angularVelocity) {
              targetRay.hasAngularVelocity = true;
              targetRay.angularVelocity.copy(inputPose.angularVelocity);
            } else {
              targetRay.hasAngularVelocity = false;
            }
            this.dispatchEvent(_moveEvent);
          }
        }
      }
      if (targetRay !== null) {
        targetRay.visible = inputPose !== null;
      }
      if (grip !== null) {
        grip.visible = gripPose !== null;
      }
      if (hand !== null) {
        hand.visible = handPose !== null;
      }
      return this;
    }
    // private method
    _getHandJoint(hand, inputjoint) {
      if (hand.joints[inputjoint.jointName] === void 0) {
        const joint = new Group();
        joint.matrixAutoUpdate = false;
        joint.visible = false;
        hand.joints[inputjoint.jointName] = joint;
        hand.add(joint);
      }
      return hand.joints[inputjoint.jointName];
    }
  };
  var WebXRManager = class extends EventDispatcher {
    constructor(renderer, gl) {
      super();
      const scope = this;
      let session = null;
      let framebufferScaleFactor = 1;
      let referenceSpace = null;
      let referenceSpaceType = "local-floor";
      let foveation = 1;
      let customReferenceSpace = null;
      let pose = null;
      let glBinding = null;
      let glProjLayer = null;
      let glBaseLayer = null;
      let xrFrame = null;
      const attributes = gl.getContextAttributes();
      let initialRenderTarget = null;
      let newRenderTarget = null;
      const controllers = [];
      const controllerInputSources = [];
      const currentSize = new Vector2();
      let currentPixelRatio = null;
      const cameraL = new PerspectiveCamera();
      cameraL.layers.enable(1);
      cameraL.viewport = new Vector4();
      const cameraR = new PerspectiveCamera();
      cameraR.layers.enable(2);
      cameraR.viewport = new Vector4();
      const cameras = [cameraL, cameraR];
      const cameraXR = new ArrayCamera();
      cameraXR.layers.enable(1);
      cameraXR.layers.enable(2);
      let _currentDepthNear = null;
      let _currentDepthFar = null;
      this.cameraAutoUpdate = true;
      this.enabled = false;
      this.isPresenting = false;
      this.getController = function(index) {
        let controller = controllers[index];
        if (controller === void 0) {
          controller = new WebXRController();
          controllers[index] = controller;
        }
        return controller.getTargetRaySpace();
      };
      this.getControllerGrip = function(index) {
        let controller = controllers[index];
        if (controller === void 0) {
          controller = new WebXRController();
          controllers[index] = controller;
        }
        return controller.getGripSpace();
      };
      this.getHand = function(index) {
        let controller = controllers[index];
        if (controller === void 0) {
          controller = new WebXRController();
          controllers[index] = controller;
        }
        return controller.getHandSpace();
      };
      function onSessionEvent(event) {
        const controllerIndex = controllerInputSources.indexOf(event.inputSource);
        if (controllerIndex === -1) {
          return;
        }
        const controller = controllers[controllerIndex];
        if (controller !== void 0) {
          controller.update(event.inputSource, event.frame, customReferenceSpace || referenceSpace);
          controller.dispatchEvent({ type: event.type, data: event.inputSource });
        }
      }
      function onSessionEnd() {
        session.removeEventListener("select", onSessionEvent);
        session.removeEventListener("selectstart", onSessionEvent);
        session.removeEventListener("selectend", onSessionEvent);
        session.removeEventListener("squeeze", onSessionEvent);
        session.removeEventListener("squeezestart", onSessionEvent);
        session.removeEventListener("squeezeend", onSessionEvent);
        session.removeEventListener("end", onSessionEnd);
        session.removeEventListener("inputsourceschange", onInputSourcesChange);
        for (let i = 0; i < controllers.length; i++) {
          const inputSource = controllerInputSources[i];
          if (inputSource === null) continue;
          controllerInputSources[i] = null;
          controllers[i].disconnect(inputSource);
        }
        _currentDepthNear = null;
        _currentDepthFar = null;
        renderer.setRenderTarget(initialRenderTarget);
        glBaseLayer = null;
        glProjLayer = null;
        glBinding = null;
        session = null;
        newRenderTarget = null;
        animation.stop();
        scope.isPresenting = false;
        renderer.setPixelRatio(currentPixelRatio);
        renderer.setSize(currentSize.width, currentSize.height, false);
        scope.dispatchEvent({ type: "sessionend" });
      }
      this.setFramebufferScaleFactor = function(value) {
        framebufferScaleFactor = value;
        if (scope.isPresenting === true) {
          console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.");
        }
      };
      this.setReferenceSpaceType = function(value) {
        referenceSpaceType = value;
        if (scope.isPresenting === true) {
          console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.");
        }
      };
      this.getReferenceSpace = function() {
        return customReferenceSpace || referenceSpace;
      };
      this.setReferenceSpace = function(space) {
        customReferenceSpace = space;
      };
      this.getBaseLayer = function() {
        return glProjLayer !== null ? glProjLayer : glBaseLayer;
      };
      this.getBinding = function() {
        return glBinding;
      };
      this.getFrame = function() {
        return xrFrame;
      };
      this.getSession = function() {
        return session;
      };
      this.setSession = async function(value) {
        session = value;
        if (session !== null) {
          initialRenderTarget = renderer.getRenderTarget();
          session.addEventListener("select", onSessionEvent);
          session.addEventListener("selectstart", onSessionEvent);
          session.addEventListener("selectend", onSessionEvent);
          session.addEventListener("squeeze", onSessionEvent);
          session.addEventListener("squeezestart", onSessionEvent);
          session.addEventListener("squeezeend", onSessionEvent);
          session.addEventListener("end", onSessionEnd);
          session.addEventListener("inputsourceschange", onInputSourcesChange);
          if (attributes.xrCompatible !== true) {
            await gl.makeXRCompatible();
          }
          currentPixelRatio = renderer.getPixelRatio();
          renderer.getSize(currentSize);
          if (session.renderState.layers === void 0 || renderer.capabilities.isWebGL2 === false) {
            const layerInit = {
              antialias: session.renderState.layers === void 0 ? attributes.antialias : true,
              alpha: true,
              depth: attributes.depth,
              stencil: attributes.stencil,
              framebufferScaleFactor
            };
            glBaseLayer = new XRWebGLLayer(session, gl, layerInit);
            session.updateRenderState({ baseLayer: glBaseLayer });
            renderer.setPixelRatio(1);
            renderer.setSize(glBaseLayer.framebufferWidth, glBaseLayer.framebufferHeight, false);
            newRenderTarget = new WebGLRenderTarget(
              glBaseLayer.framebufferWidth,
              glBaseLayer.framebufferHeight,
              {
                format: RGBAFormat,
                type: UnsignedByteType,
                colorSpace: renderer.outputColorSpace,
                stencilBuffer: attributes.stencil
