              }
            );
          } else {
            let depthFormat = null;
            let depthType = null;
            let glDepthFormat = null;
            if (attributes.depth) {
              glDepthFormat = attributes.stencil ? gl.DEPTH24_STENCIL8 : gl.DEPTH_COMPONENT24;
              depthFormat = attributes.stencil ? DepthStencilFormat : DepthFormat;
              depthType = attributes.stencil ? UnsignedInt248Type : UnsignedIntType;
            }
            const projectionlayerInit = {
              colorFormat: gl.RGBA8,
              depthFormat: glDepthFormat,
              scaleFactor: framebufferScaleFactor
            };
            glBinding = new XRWebGLBinding(session, gl);
            glProjLayer = glBinding.createProjectionLayer(projectionlayerInit);
            session.updateRenderState({ layers: [glProjLayer] });
            renderer.setPixelRatio(1);
            renderer.setSize(glProjLayer.textureWidth, glProjLayer.textureHeight, false);
            newRenderTarget = new WebGLRenderTarget(
              glProjLayer.textureWidth,
              glProjLayer.textureHeight,
              {
                format: RGBAFormat,
                type: UnsignedByteType,
                depthTexture: new DepthTexture(glProjLayer.textureWidth, glProjLayer.textureHeight, depthType, void 0, void 0, void 0, void 0, void 0, void 0, depthFormat),
                stencilBuffer: attributes.stencil,
                colorSpace: renderer.outputColorSpace,
                samples: attributes.antialias ? 4 : 0
              }
            );
            const renderTargetProperties = renderer.properties.get(newRenderTarget);
            renderTargetProperties.__ignoreDepthValues = glProjLayer.ignoreDepthValues;
          }
          newRenderTarget.isXRRenderTarget = true;
          this.setFoveation(foveation);
          customReferenceSpace = null;
          referenceSpace = await session.requestReferenceSpace(referenceSpaceType);
          animation.setContext(session);
          animation.start();
          scope.isPresenting = true;
          scope.dispatchEvent({ type: "sessionstart" });
        }
      };
      this.getEnvironmentBlendMode = function() {
        if (session !== null) {
          return session.environmentBlendMode;
        }
      };
      function onInputSourcesChange(event) {
        for (let i = 0; i < event.removed.length; i++) {
          const inputSource = event.removed[i];
          const index = controllerInputSources.indexOf(inputSource);
          if (index >= 0) {
            controllerInputSources[index] = null;
            controllers[index].disconnect(inputSource);
          }
        }
        for (let i = 0; i < event.added.length; i++) {
          const inputSource = event.added[i];
          let controllerIndex = controllerInputSources.indexOf(inputSource);
          if (controllerIndex === -1) {
            for (let i2 = 0; i2 < controllers.length; i2++) {
              if (i2 >= controllerInputSources.length) {
                controllerInputSources.push(inputSource);
                controllerIndex = i2;
                break;
              } else if (controllerInputSources[i2] === null) {
                controllerInputSources[i2] = inputSource;
                controllerIndex = i2;
                break;
              }
            }
            if (controllerIndex === -1) break;
          }
          const controller = controllers[controllerIndex];
          if (controller) {
            controller.connect(inputSource);
          }
        }
      }
      const cameraLPos = new Vector3();
      const cameraRPos = new Vector3();
      function setProjectionFromUnion(camera, cameraL2, cameraR2) {
        cameraLPos.setFromMatrixPosition(cameraL2.matrixWorld);
        cameraRPos.setFromMatrixPosition(cameraR2.matrixWorld);
        const ipd = cameraLPos.distanceTo(cameraRPos);
        const projL = cameraL2.projectionMatrix.elements;
        const projR = cameraR2.projectionMatrix.elements;
        const near = projL[14] / (projL[10] - 1);
        const far = projL[14] / (projL[10] + 1);
        const topFov = (projL[9] + 1) / projL[5];
        const bottomFov = (projL[9] - 1) / projL[5];
        const leftFov = (projL[8] - 1) / projL[0];
        const rightFov = (projR[8] + 1) / projR[0];
        const left = near * leftFov;
        const right = near * rightFov;
        const zOffset = ipd / (-leftFov + rightFov);
        const xOffset = zOffset * -leftFov;
        cameraL2.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
        camera.translateX(xOffset);
        camera.translateZ(zOffset);
        camera.matrixWorld.compose(camera.position, camera.quaternion, camera.scale);
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
        const near2 = near + zOffset;
        const far2 = far + zOffset;
        const left2 = left - xOffset;
        const right2 = right + (ipd - xOffset);
        const top2 = topFov * far / far2 * near2;
        const bottom2 = bottomFov * far / far2 * near2;
        camera.projectionMatrix.makePerspective(left2, right2, top2, bottom2, near2, far2);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }
      function updateCamera(camera, parent) {
        if (parent === null) {
          camera.matrixWorld.copy(camera.matrix);
        } else {
          camera.matrixWorld.multiplyMatrices(parent.matrixWorld, camera.matrix);
        }
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      }
      this.updateCamera = function(camera) {
        if (session === null) return;
        cameraXR.near = cameraR.near = cameraL.near = camera.near;
        cameraXR.far = cameraR.far = cameraL.far = camera.far;
        if (_currentDepthNear !== cameraXR.near || _currentDepthFar !== cameraXR.far) {
          session.updateRenderState({
            depthNear: cameraXR.near,
            depthFar: cameraXR.far
          });
          _currentDepthNear = cameraXR.near;
          _currentDepthFar = cameraXR.far;
        }
        const parent = camera.parent;
        const cameras2 = cameraXR.cameras;
        updateCamera(cameraXR, parent);
        for (let i = 0; i < cameras2.length; i++) {
          updateCamera(cameras2[i], parent);
        }
        if (cameras2.length === 2) {
          setProjectionFromUnion(cameraXR, cameraL, cameraR);
        } else {
          cameraXR.projectionMatrix.copy(cameraL.projectionMatrix);
        }
        updateUserCamera(camera, cameraXR, parent);
      };
      function updateUserCamera(camera, cameraXR2, parent) {
        if (parent === null) {
          camera.matrix.copy(cameraXR2.matrixWorld);
        } else {
          camera.matrix.copy(parent.matrixWorld);
          camera.matrix.invert();
          camera.matrix.multiply(cameraXR2.matrixWorld);
        }
        camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
        camera.updateMatrixWorld(true);
        camera.projectionMatrix.copy(cameraXR2.projectionMatrix);
        camera.projectionMatrixInverse.copy(cameraXR2.projectionMatrixInverse);
        if (camera.isPerspectiveCamera) {
          camera.fov = RAD2DEG * 2 * Math.atan(1 / camera.projectionMatrix.elements[5]);
          camera.zoom = 1;
        }
      }
      this.getCamera = function() {
        return cameraXR;
      };
      this.getFoveation = function() {
        if (glProjLayer === null && glBaseLayer === null) {
          return void 0;
        }
        return foveation;
      };
      this.setFoveation = function(value) {
        foveation = value;
        if (glProjLayer !== null) {
          glProjLayer.fixedFoveation = value;
        }
        if (glBaseLayer !== null && glBaseLayer.fixedFoveation !== void 0) {
          glBaseLayer.fixedFoveation = value;
        }
      };
      let onAnimationFrameCallback = null;
      function onAnimationFrame(time, frame) {
        pose = frame.getViewerPose(customReferenceSpace || referenceSpace);
        xrFrame = frame;
        if (pose !== null) {
          const views = pose.views;
          if (glBaseLayer !== null) {
            renderer.setRenderTargetFramebuffer(newRenderTarget, glBaseLayer.framebuffer);
            renderer.setRenderTarget(newRenderTarget);
          }
          let cameraXRNeedsUpdate = false;
          if (views.length !== cameraXR.cameras.length) {
            cameraXR.cameras.length = 0;
            cameraXRNeedsUpdate = true;
          }
          for (let i = 0; i < views.length; i++) {
            const view = views[i];
            let viewport = null;
            if (glBaseLayer !== null) {
              viewport = glBaseLayer.getViewport(view);
            } else {
              const glSubImage = glBinding.getViewSubImage(glProjLayer, view);
              viewport = glSubImage.viewport;
              if (i === 0) {
                renderer.setRenderTargetTextures(
                  newRenderTarget,
                  glSubImage.colorTexture,
                  glProjLayer.ignoreDepthValues ? void 0 : glSubImage.depthStencilTexture
                );
                renderer.setRenderTarget(newRenderTarget);
              }
            }
            let camera = cameras[i];
            if (camera === void 0) {
              camera = new PerspectiveCamera();
              camera.layers.enable(i);
              camera.viewport = new Vector4();
              cameras[i] = camera;
            }
            camera.matrix.fromArray(view.transform.matrix);
            camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
            camera.projectionMatrix.fromArray(view.projectionMatrix);
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
            camera.viewport.set(viewport.x, viewport.y, viewport.width, viewport.height);
            if (i === 0) {
              cameraXR.matrix.copy(camera.matrix);
              cameraXR.matrix.decompose(cameraXR.position, cameraXR.quaternion, cameraXR.scale);
            }
            if (cameraXRNeedsUpdate === true) {
              cameraXR.cameras.push(camera);
            }
          }
        }
        for (let i = 0; i < controllers.length; i++) {
          const inputSource = controllerInputSources[i];
          const controller = controllers[i];
          if (inputSource !== null && controller !== void 0) {
            controller.update(inputSource, frame, customReferenceSpace || referenceSpace);
          }
        }
        if (onAnimationFrameCallback) onAnimationFrameCallback(time, frame);
        if (frame.detectedPlanes) {
          scope.dispatchEvent({ type: "planesdetected", data: frame });
        }
        xrFrame = null;
      }
      const animation = new WebGLAnimation();
      animation.setAnimationLoop(onAnimationFrame);
      this.setAnimationLoop = function(callback) {
        onAnimationFrameCallback = callback;
      };
      this.dispose = function() {
      };
    }
  };
  function WebGLMaterials(renderer, properties) {
    function refreshTransformUniform(map, uniform) {
      if (map.matrixAutoUpdate === true) {
        map.updateMatrix();
      }
      uniform.value.copy(map.matrix);
    }
    function refreshFogUniforms(uniforms, fog) {
      fog.color.getRGB(uniforms.fogColor.value, getUnlitUniformColorSpace(renderer));
      if (fog.isFog) {
        uniforms.fogNear.value = fog.near;
        uniforms.fogFar.value = fog.far;
      } else if (fog.isFogExp2) {
        uniforms.fogDensity.value = fog.density;
      }
    }
    function refreshMaterialUniforms(uniforms, material, pixelRatio, height, transmissionRenderTarget) {
      if (material.isMeshBasicMaterial) {
        refreshUniformsCommon(uniforms, material);
      } else if (material.isMeshLambertMaterial) {
        refreshUniformsCommon(uniforms, material);
      } else if (material.isMeshToonMaterial) {
        refreshUniformsCommon(uniforms, material);
        refreshUniformsToon(uniforms, material);
      } else if (material.isMeshPhongMaterial) {
        refreshUniformsCommon(uniforms, material);
        refreshUniformsPhong(uniforms, material);
      } else if (material.isMeshStandardMaterial) {
        refreshUniformsCommon(uniforms, material);
        refreshUniformsStandard(uniforms, material);
        if (material.isMeshPhysicalMaterial) {
          refreshUniformsPhysical(uniforms, material, transmissionRenderTarget);
        }
      } else if (material.isMeshMatcapMaterial) {
        refreshUniformsCommon(uniforms, material);
        refreshUniformsMatcap(uniforms, material);
      } else if (material.isMeshDepthMaterial) {
        refreshUniformsCommon(uniforms, material);
      } else if (material.isMeshDistanceMaterial) {
        refreshUniformsCommon(uniforms, material);
        refreshUniformsDistance(uniforms, material);
      } else if (material.isMeshNormalMaterial) {
        refreshUniformsCommon(uniforms, material);
      } else if (material.isLineBasicMaterial) {
        refreshUniformsLine(uniforms, material);
        if (material.isLineDashedMaterial) {
          refreshUniformsDash(uniforms, material);
        }
      } else if (material.isPointsMaterial) {
        refreshUniformsPoints(uniforms, material, pixelRatio, height);
      } else if (material.isSpriteMaterial) {
        refreshUniformsSprites(uniforms, material);
      } else if (material.isShadowMaterial) {
        uniforms.color.value.copy(material.color);
        uniforms.opacity.value = material.opacity;
      } else if (material.isShaderMaterial) {
        material.uniformsNeedUpdate = false;
      }
    }
    function refreshUniformsCommon(uniforms, material) {
      uniforms.opacity.value = material.opacity;
      if (material.color) {
        uniforms.diffuse.value.copy(material.color);
      }
      if (material.emissive) {
        uniforms.emissive.value.copy(material.emissive).multiplyScalar(material.emissiveIntensity);
      }
      if (material.map) {
        uniforms.map.value = material.map;
        refreshTransformUniform(material.map, uniforms.mapTransform);
      }
      if (material.alphaMap) {
        uniforms.alphaMap.value = material.alphaMap;
        refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
      }
      if (material.bumpMap) {
        uniforms.bumpMap.value = material.bumpMap;
        refreshTransformUniform(material.bumpMap, uniforms.bumpMapTransform);
        uniforms.bumpScale.value = material.bumpScale;
        if (material.side === BackSide) {
          uniforms.bumpScale.value *= -1;
        }
      }
      if (material.normalMap) {
        uniforms.normalMap.value = material.normalMap;
        refreshTransformUniform(material.normalMap, uniforms.normalMapTransform);
        uniforms.normalScale.value.copy(material.normalScale);
        if (material.side === BackSide) {
          uniforms.normalScale.value.negate();
        }
      }
      if (material.displacementMap) {
        uniforms.displacementMap.value = material.displacementMap;
        refreshTransformUniform(material.displacementMap, uniforms.displacementMapTransform);
        uniforms.displacementScale.value = material.displacementScale;
        uniforms.displacementBias.value = material.displacementBias;
      }
      if (material.emissiveMap) {
        uniforms.emissiveMap.value = material.emissiveMap;
        refreshTransformUniform(material.emissiveMap, uniforms.emissiveMapTransform);
      }
      if (material.specularMap) {
        uniforms.specularMap.value = material.specularMap;
        refreshTransformUniform(material.specularMap, uniforms.specularMapTransform);
      }
      if (material.alphaTest > 0) {
        uniforms.alphaTest.value = material.alphaTest;
      }
      const envMap = properties.get(material).envMap;
      if (envMap) {
        uniforms.envMap.value = envMap;
        uniforms.flipEnvMap.value = envMap.isCubeTexture && envMap.isRenderTargetTexture === false ? -1 : 1;
        uniforms.reflectivity.value = material.reflectivity;
        uniforms.ior.value = material.ior;
        uniforms.refractionRatio.value = material.refractionRatio;
      }
      if (material.lightMap) {
        uniforms.lightMap.value = material.lightMap;
        const scaleFactor = renderer._useLegacyLights === true ? Math.PI : 1;
        uniforms.lightMapIntensity.value = material.lightMapIntensity * scaleFactor;
        refreshTransformUniform(material.lightMap, uniforms.lightMapTransform);
      }
      if (material.aoMap) {
        uniforms.aoMap.value = material.aoMap;
        uniforms.aoMapIntensity.value = material.aoMapIntensity;
        refreshTransformUniform(material.aoMap, uniforms.aoMapTransform);
      }
    }
    function refreshUniformsLine(uniforms, material) {
      uniforms.diffuse.value.copy(material.color);
      uniforms.opacity.value = material.opacity;
      if (material.map) {
        uniforms.map.value = material.map;
        refreshTransformUniform(material.map, uniforms.mapTransform);
      }
    }
    function refreshUniformsDash(uniforms, material) {
      uniforms.dashSize.value = material.dashSize;
      uniforms.totalSize.value = material.dashSize + material.gapSize;
      uniforms.scale.value = material.scale;
    }
    function refreshUniformsPoints(uniforms, material, pixelRatio, height) {
      uniforms.diffuse.value.copy(material.color);
      uniforms.opacity.value = material.opacity;
      uniforms.size.value = material.size * pixelRatio;
      uniforms.scale.value = height * 0.5;
      if (material.map) {
        uniforms.map.value = material.map;
        refreshTransformUniform(material.map, uniforms.uvTransform);
      }
      if (material.alphaMap) {
        uniforms.alphaMap.value = material.alphaMap;
        refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
      }
      if (material.alphaTest > 0) {
        uniforms.alphaTest.value = material.alphaTest;
      }
    }
    function refreshUniformsSprites(uniforms, material) {
      uniforms.diffuse.value.copy(material.color);
      uniforms.opacity.value = material.opacity;
      uniforms.rotation.value = material.rotation;
      if (material.map) {
        uniforms.map.value = material.map;
        refreshTransformUniform(material.map, uniforms.mapTransform);
      }
      if (material.alphaMap) {
        uniforms.alphaMap.value = material.alphaMap;
        refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
      }
      if (material.alphaTest > 0) {
        uniforms.alphaTest.value = material.alphaTest;
      }
    }
    function refreshUniformsPhong(uniforms, material) {
      uniforms.specular.value.copy(material.specular);
      uniforms.shininess.value = Math.max(material.shininess, 1e-4);
    }
    function refreshUniformsToon(uniforms, material) {
      if (material.gradientMap) {
        uniforms.gradientMap.value = material.gradientMap;
      }
    }
    function refreshUniformsStandard(uniforms, material) {
      uniforms.metalness.value = material.metalness;
      if (material.metalnessMap) {
        uniforms.metalnessMap.value = material.metalnessMap;
        refreshTransformUniform(material.metalnessMap, uniforms.metalnessMapTransform);
      }
      uniforms.roughness.value = material.roughness;
      if (material.roughnessMap) {
        uniforms.roughnessMap.value = material.roughnessMap;
        refreshTransformUniform(material.roughnessMap, uniforms.roughnessMapTransform);
      }
      const envMap = properties.get(material).envMap;
      if (envMap) {
        uniforms.envMapIntensity.value = material.envMapIntensity;
      }
    }
    function refreshUniformsPhysical(uniforms, material, transmissionRenderTarget) {
      uniforms.ior.value = material.ior;
      if (material.sheen > 0) {
        uniforms.sheenColor.value.copy(material.sheenColor).multiplyScalar(material.sheen);
        uniforms.sheenRoughness.value = material.sheenRoughness;
        if (material.sheenColorMap) {
          uniforms.sheenColorMap.value = material.sheenColorMap;
          refreshTransformUniform(material.sheenColorMap, uniforms.sheenColorMapTransform);
        }
        if (material.sheenRoughnessMap) {
          uniforms.sheenRoughnessMap.value = material.sheenRoughnessMap;
          refreshTransformUniform(material.sheenRoughnessMap, uniforms.sheenRoughnessMapTransform);
        }
      }
      if (material.clearcoat > 0) {
        uniforms.clearcoat.value = material.clearcoat;
        uniforms.clearcoatRoughness.value = material.clearcoatRoughness;
        if (material.clearcoatMap) {
          uniforms.clearcoatMap.value = material.clearcoatMap;
          refreshTransformUniform(material.clearcoatMap, uniforms.clearcoatMapTransform);
        }
        if (material.clearcoatRoughnessMap) {
          uniforms.clearcoatRoughnessMap.value = material.clearcoatRoughnessMap;
          refreshTransformUniform(material.clearcoatRoughnessMap, uniforms.clearcoatRoughnessMapTransform);
        }
        if (material.clearcoatNormalMap) {
          uniforms.clearcoatNormalMap.value = material.clearcoatNormalMap;
          refreshTransformUniform(material.clearcoatNormalMap, uniforms.clearcoatNormalMapTransform);
          uniforms.clearcoatNormalScale.value.copy(material.clearcoatNormalScale);
          if (material.side === BackSide) {
            uniforms.clearcoatNormalScale.value.negate();
          }
        }
      }
      if (material.iridescence > 0) {
        uniforms.iridescence.value = material.iridescence;
        uniforms.iridescenceIOR.value = material.iridescenceIOR;
        uniforms.iridescenceThicknessMinimum.value = material.iridescenceThicknessRange[0];
        uniforms.iridescenceThicknessMaximum.value = material.iridescenceThicknessRange[1];
        if (material.iridescenceMap) {
          uniforms.iridescenceMap.value = material.iridescenceMap;
          refreshTransformUniform(material.iridescenceMap, uniforms.iridescenceMapTransform);
        }
        if (material.iridescenceThicknessMap) {
          uniforms.iridescenceThicknessMap.value = material.iridescenceThicknessMap;
          refreshTransformUniform(material.iridescenceThicknessMap, uniforms.iridescenceThicknessMapTransform);
        }
      }
      if (material.transmission > 0) {
        uniforms.transmission.value = material.transmission;
        uniforms.transmissionSamplerMap.value = transmissionRenderTarget.texture;
        uniforms.transmissionSamplerSize.value.set(transmissionRenderTarget.width, transmissionRenderTarget.height);
        if (material.transmissionMap) {
          uniforms.transmissionMap.value = material.transmissionMap;
          refreshTransformUniform(material.transmissionMap, uniforms.transmissionMapTransform);
        }
        uniforms.thickness.value = material.thickness;
        if (material.thicknessMap) {
          uniforms.thicknessMap.value = material.thicknessMap;
          refreshTransformUniform(material.thicknessMap, uniforms.thicknessMapTransform);
        }
        uniforms.attenuationDistance.value = material.attenuationDistance;
        uniforms.attenuationColor.value.copy(material.attenuationColor);
      }
      if (material.anisotropy > 0) {
        uniforms.anisotropyVector.value.set(material.anisotropy * Math.cos(material.anisotropyRotation), material.anisotropy * Math.sin(material.anisotropyRotation));
        if (material.anisotropyMap) {
          uniforms.anisotropyMap.value = material.anisotropyMap;
          refreshTransformUniform(material.anisotropyMap, uniforms.anisotropyMapTransform);
        }
      }
      uniforms.specularIntensity.value = material.specularIntensity;
      uniforms.specularColor.value.copy(material.specularColor);
      if (material.specularColorMap) {
        uniforms.specularColorMap.value = material.specularColorMap;
        refreshTransformUniform(material.specularColorMap, uniforms.specularColorMapTransform);
      }
      if (material.specularIntensityMap) {
        uniforms.specularIntensityMap.value = material.specularIntensityMap;
        refreshTransformUniform(material.specularIntensityMap, uniforms.specularIntensityMapTransform);
      }
    }
    function refreshUniformsMatcap(uniforms, material) {
      if (material.matcap) {
        uniforms.matcap.value = material.matcap;
      }
    }
    function refreshUniformsDistance(uniforms, material) {
      const light = properties.get(material).light;
      uniforms.referencePosition.value.setFromMatrixPosition(light.matrixWorld);
      uniforms.nearDistance.value = light.shadow.camera.near;
      uniforms.farDistance.value = light.shadow.camera.far;
    }
    return {
      refreshFogUniforms,
      refreshMaterialUniforms
    };
  }
  function WebGLUniformsGroups(gl, info, capabilities, state) {
    let buffers = {};
    let updateList = {};
    let allocatedBindingPoints = [];
    const maxBindingPoints = capabilities.isWebGL2 ? gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS) : 0;
    function bind(uniformsGroup, program) {
      const webglProgram = program.program;
      state.uniformBlockBinding(uniformsGroup, webglProgram);
    }
    function update(uniformsGroup, program) {
      let buffer = buffers[uniformsGroup.id];
      if (buffer === void 0) {
        prepareUniformsGroup(uniformsGroup);
        buffer = createBuffer(uniformsGroup);
        buffers[uniformsGroup.id] = buffer;
        uniformsGroup.addEventListener("dispose", onUniformsGroupsDispose);
      }
      const webglProgram = program.program;
      state.updateUBOMapping(uniformsGroup, webglProgram);
      const frame = info.render.frame;
      if (updateList[uniformsGroup.id] !== frame) {
        updateBufferData(uniformsGroup);
        updateList[uniformsGroup.id] = frame;
      }
    }
    function createBuffer(uniformsGroup) {
      const bindingPointIndex = allocateBindingPointIndex();
      uniformsGroup.__bindingPointIndex = bindingPointIndex;
      const buffer = gl.createBuffer();
      const size = uniformsGroup.__size;
      const usage = uniformsGroup.usage;
      gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
      gl.bufferData(gl.UNIFORM_BUFFER, size, usage);
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);
      gl.bindBufferBase(gl.UNIFORM_BUFFER, bindingPointIndex, buffer);
      return buffer;
    }
    function allocateBindingPointIndex() {
      for (let i = 0; i < maxBindingPoints; i++) {
        if (allocatedBindingPoints.indexOf(i) === -1) {
          allocatedBindingPoints.push(i);
          return i;
        }
      }
      console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.");
      return 0;
    }
    function updateBufferData(uniformsGroup) {
      const buffer = buffers[uniformsGroup.id];
      const uniforms = uniformsGroup.uniforms;
      const cache = uniformsGroup.__cache;
      gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
      for (let i = 0, il = uniforms.length; i < il; i++) {
        const uniformArray = Array.isArray(uniforms[i]) ? uniforms[i] : [uniforms[i]];
        for (let j = 0, jl = uniformArray.length; j < jl; j++) {
          const uniform = uniformArray[j];
          if (hasUniformChanged(uniform, i, j, cache) === true) {
            const offset = uniform.__offset;
            const values = Array.isArray(uniform.value) ? uniform.value : [uniform.value];
            let arrayOffset = 0;
            for (let k = 0; k < values.length; k++) {
              const value = values[k];
              const info2 = getUniformSize(value);
              if (typeof value === "number" || typeof value === "boolean") {
                uniform.__data[0] = value;
                gl.bufferSubData(gl.UNIFORM_BUFFER, offset + arrayOffset, uniform.__data);
              } else if (value.isMatrix3) {
                uniform.__data[0] = value.elements[0];
                uniform.__data[1] = value.elements[1];
                uniform.__data[2] = value.elements[2];
                uniform.__data[3] = 0;
                uniform.__data[4] = value.elements[3];
                uniform.__data[5] = value.elements[4];
                uniform.__data[6] = value.elements[5];
                uniform.__data[7] = 0;
                uniform.__data[8] = value.elements[6];
                uniform.__data[9] = value.elements[7];
                uniform.__data[10] = value.elements[8];
                uniform.__data[11] = 0;
              } else {
                value.toArray(uniform.__data, arrayOffset);
                arrayOffset += info2.storage / Float32Array.BYTES_PER_ELEMENT;
              }
            }
            gl.bufferSubData(gl.UNIFORM_BUFFER, offset, uniform.__data);
          }
        }
      }
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }
    function hasUniformChanged(uniform, index, indexArray, cache) {
      const value = uniform.value;
      const indexString = index + "_" + indexArray;
      if (cache[indexString] === void 0) {
        if (typeof value === "number" || typeof value === "boolean") {
          cache[indexString] = value;
        } else {
          cache[indexString] = value.clone();
        }
        return true;
      } else {
        const cachedObject = cache[indexString];
        if (typeof value === "number" || typeof value === "boolean") {
          if (cachedObject !== value) {
            cache[indexString] = value;
            return true;
          }
        } else {
          if (cachedObject.equals(value) === false) {
            cachedObject.copy(value);
            return true;
          }
        }
      }
      return false;
    }
    function prepareUniformsGroup(uniformsGroup) {
      const uniforms = uniformsGroup.uniforms;
      let offset = 0;
      const chunkSize = 16;
      for (let i = 0, l = uniforms.length; i < l; i++) {
        const uniformArray = Array.isArray(uniforms[i]) ? uniforms[i] : [uniforms[i]];
        for (let j = 0, jl = uniformArray.length; j < jl; j++) {
          const uniform = uniformArray[j];
          const values = Array.isArray(uniform.value) ? uniform.value : [uniform.value];
          for (let k = 0, kl = values.length; k < kl; k++) {
            const value = values[k];
            const info2 = getUniformSize(value);
            const chunkOffsetUniform = offset % chunkSize;
            if (chunkOffsetUniform !== 0 && chunkSize - chunkOffsetUniform < info2.boundary) {
              offset += chunkSize - chunkOffsetUniform;
            }
            uniform.__data = new Float32Array(info2.storage / Float32Array.BYTES_PER_ELEMENT);
            uniform.__offset = offset;
            offset += info2.storage;
          }
        }
      }
      const chunkOffset = offset % chunkSize;
      if (chunkOffset > 0) offset += chunkSize - chunkOffset;
      uniformsGroup.__size = offset;
      uniformsGroup.__cache = {};
      return this;
    }
    function getUniformSize(value) {
      const info2 = {
        boundary: 0,
        // bytes
        storage: 0
        // bytes
      };
      if (typeof value === "number" || typeof value === "boolean") {
        info2.boundary = 4;
        info2.storage = 4;
      } else if (value.isVector2) {
        info2.boundary = 8;
        info2.storage = 8;
      } else if (value.isVector3 || value.isColor) {
        info2.boundary = 16;
        info2.storage = 12;
      } else if (value.isVector4) {
        info2.boundary = 16;
        info2.storage = 16;
      } else if (value.isMatrix3) {
        info2.boundary = 48;
        info2.storage = 48;
      } else if (value.isMatrix4) {
        info2.boundary = 64;
        info2.storage = 64;
      } else if (value.isTexture) {
        console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group.");
      } else {
        console.warn("THREE.WebGLRenderer: Unsupported uniform value type.", value);
      }
      return info2;
    }
    function onUniformsGroupsDispose(event) {
      const uniformsGroup = event.target;
      uniformsGroup.removeEventListener("dispose", onUniformsGroupsDispose);
      const index = allocatedBindingPoints.indexOf(uniformsGroup.__bindingPointIndex);
      allocatedBindingPoints.splice(index, 1);
      gl.deleteBuffer(buffers[uniformsGroup.id]);
      delete buffers[uniformsGroup.id];
      delete updateList[uniformsGroup.id];
    }
    function dispose() {
      for (const id in buffers) {
        gl.deleteBuffer(buffers[id]);
      }
      allocatedBindingPoints = [];
      buffers = {};
      updateList = {};
    }
    return {
      bind,
      update,
      dispose
    };
  }
  var WebGLRenderer = class {
    constructor(parameters = {}) {
      const {
        canvas = createCanvasElement(),
        context = null,
        depth = true,
        stencil = true,
        alpha = false,
        antialias = false,
        premultipliedAlpha = true,
        preserveDrawingBuffer = false,
        powerPreference = "default",
        failIfMajorPerformanceCaveat = false
      } = parameters;
      this.isWebGLRenderer = true;
      let _alpha;
      if (context !== null) {
        _alpha = context.getContextAttributes().alpha;
      } else {
        _alpha = alpha;
      }
      const uintClearColor = new Uint32Array(4);
      const intClearColor = new Int32Array(4);
      let currentRenderList = null;
      let currentRenderState = null;
      const renderListStack = [];
      const renderStateStack = [];
      this.domElement = canvas;
      this.debug = {
        /**
         * Enables error checking and reporting when shader programs are being compiled
         * @type {boolean}
         */
        checkShaderErrors: true,
        /**
         * Callback for custom error reporting.
         * @type {?Function}
         */
        onShaderError: null
      };
      this.autoClear = true;
      this.autoClearColor = true;
      this.autoClearDepth = true;
      this.autoClearStencil = true;
      this.sortObjects = true;
      this.clippingPlanes = [];
      this.localClippingEnabled = false;
      this._outputColorSpace = SRGBColorSpace;
      this._useLegacyLights = false;
      this.toneMapping = NoToneMapping;
      this.toneMappingExposure = 1;
      const _this = this;
      let _isContextLost = false;
      let _currentActiveCubeFace = 0;
      let _currentActiveMipmapLevel = 0;
      let _currentRenderTarget = null;
      let _currentMaterialId = -1;
      let _currentCamera = null;
      const _currentViewport = new Vector4();
      const _currentScissor = new Vector4();
      let _currentScissorTest = null;
      const _currentClearColor = new Color(0);
      let _currentClearAlpha = 0;
      let _width = canvas.width;
      let _height = canvas.height;
      let _pixelRatio = 1;
      let _opaqueSort = null;
      let _transparentSort = null;
      const _viewport = new Vector4(0, 0, _width, _height);
      const _scissor = new Vector4(0, 0, _width, _height);
      let _scissorTest = false;
      const _frustum2 = new Frustum();
      let _clippingEnabled = false;
      let _localClippingEnabled = false;
      let _transmissionRenderTarget = null;
      const _projScreenMatrix2 = new Matrix4();
      const _vector22 = new Vector2();
      const _vector32 = new Vector3();
      const _emptyScene = { background: null, fog: null, environment: null, overrideMaterial: null, isScene: true };
      function getTargetPixelRatio() {
        return _currentRenderTarget === null ? _pixelRatio : 1;
      }
      let _gl = context;
      function getContext(contextNames, contextAttributes) {
        for (let i = 0; i < contextNames.length; i++) {
          const contextName = contextNames[i];
          const context2 = canvas.getContext(contextName, contextAttributes);
          if (context2 !== null) return context2;
        }
        return null;
      }
      try {
        const contextAttributes = {
          alpha: true,
          depth,
          stencil,
          antialias,
          premultipliedAlpha,
          preserveDrawingBuffer,
          powerPreference,
          failIfMajorPerformanceCaveat
        };
        if ("setAttribute" in canvas) canvas.setAttribute("data-engine", `three.js r${REVISION}`);
        canvas.addEventListener("webglcontextlost", onContextLost, false);
        canvas.addEventListener("webglcontextrestored", onContextRestore, false);
        canvas.addEventListener("webglcontextcreationerror", onContextCreationError, false);
        if (_gl === null) {
          const contextNames = ["webgl2", "webgl", "experimental-webgl"];
          if (_this.isWebGL1Renderer === true) {
            contextNames.shift();
          }
          _gl = getContext(contextNames, contextAttributes);
          if (_gl === null) {
            if (getContext(contextNames)) {
              throw new Error("Error creating WebGL context with your selected attributes.");
            } else {
              throw new Error("Error creating WebGL context.");
            }
          }
        }
        if (typeof WebGLRenderingContext !== "undefined" && _gl instanceof WebGLRenderingContext) {
          console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163.");
        }
        if (_gl.getShaderPrecisionFormat === void 0) {
          _gl.getShaderPrecisionFormat = function() {
            return { "rangeMin": 1, "rangeMax": 1, "precision": 1 };
          };
        }
      } catch (error) {
        console.error("THREE.WebGLRenderer: " + error.message);
        throw error;
      }
      let extensions, capabilities, state, info;
      let properties, textures, cubemaps, cubeuvmaps, attributes, geometries, objects;
      let programCache, materials, renderLists, renderStates, clipping, shadowMap;
      let background, morphtargets, bufferRenderer, indexedBufferRenderer;
      let utils, bindingStates, uniformsGroups;
      function initGLContext() {
        extensions = new WebGLExtensions(_gl);
        capabilities = new WebGLCapabilities(_gl, extensions, parameters);
        extensions.init(capabilities);
        utils = new WebGLUtils(_gl, extensions, capabilities);
        state = new WebGLState(_gl, extensions, capabilities);
        info = new WebGLInfo(_gl);
        properties = new WebGLProperties();
        textures = new WebGLTextures(_gl, extensions, state, properties, capabilities, utils, info);
        cubemaps = new WebGLCubeMaps(_this);
        cubeuvmaps = new WebGLCubeUVMaps(_this);
        attributes = new WebGLAttributes(_gl, capabilities);
        bindingStates = new WebGLBindingStates(_gl, extensions, attributes, capabilities);
        geometries = new WebGLGeometries(_gl, attributes, info, bindingStates);
        objects = new WebGLObjects(_gl, geometries, attributes, info);
        morphtargets = new WebGLMorphtargets(_gl, capabilities, textures);
        clipping = new WebGLClipping(properties);
        programCache = new WebGLPrograms(_this, cubemaps, cubeuvmaps, extensions, capabilities, bindingStates, clipping);
        materials = new WebGLMaterials(_this, properties);
        renderLists = new WebGLRenderLists();
        renderStates = new WebGLRenderStates(extensions, capabilities);
        background = new WebGLBackground(_this, cubemaps, cubeuvmaps, state, objects, _alpha, premultipliedAlpha);
        shadowMap = new WebGLShadowMap(_this, objects, capabilities);
        uniformsGroups = new WebGLUniformsGroups(_gl, info, capabilities, state);
        bufferRenderer = new WebGLBufferRenderer(_gl, extensions, info, capabilities);
        indexedBufferRenderer = new WebGLIndexedBufferRenderer(_gl, extensions, info, capabilities);
        info.programs = programCache.programs;
        _this.capabilities = capabilities;
        _this.extensions = extensions;
        _this.properties = properties;
        _this.renderLists = renderLists;
        _this.shadowMap = shadowMap;
        _this.state = state;
        _this.info = info;
      }
      initGLContext();
      const xr = new WebXRManager(_this, _gl);
      this.xr = xr;
      this.getContext = function() {
        return _gl;
      };
      this.getContextAttributes = function() {
        return _gl.getContextAttributes();
      };
      this.forceContextLoss = function() {
        const extension = extensions.get("WEBGL_lose_context");
        if (extension) extension.loseContext();
      };
      this.forceContextRestore = function() {
        const extension = extensions.get("WEBGL_lose_context");
        if (extension) extension.restoreContext();
      };
      this.getPixelRatio = function() {
        return _pixelRatio;
      };
      this.setPixelRatio = function(value) {
        if (value === void 0) return;
        _pixelRatio = value;
        this.setSize(_width, _height, false);
      };
      this.getSize = function(target) {
        return target.set(_width, _height);
      };
      this.setSize = function(width, height, updateStyle = true) {
        if (xr.isPresenting) {
          console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");
          return;
        }
        _width = width;
        _height = height;
        canvas.width = Math.floor(width * _pixelRatio);
        canvas.height = Math.floor(height * _pixelRatio);
        if (updateStyle === true) {
          canvas.style.width = width + "px";
          canvas.style.height = height + "px";
        }
        this.setViewport(0, 0, width, height);
      };
      this.getDrawingBufferSize = function(target) {
        return target.set(_width * _pixelRatio, _height * _pixelRatio).floor();
      };
      this.setDrawingBufferSize = function(width, height, pixelRatio) {
        _width = width;
        _height = height;
        _pixelRatio = pixelRatio;
        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);
        this.setViewport(0, 0, width, height);
      };
      this.getCurrentViewport = function(target) {
        return target.copy(_currentViewport);
      };
      this.getViewport = function(target) {
        return target.copy(_viewport);
      };
      this.setViewport = function(x, y, width, height) {
        if (x.isVector4) {
          _viewport.set(x.x, x.y, x.z, x.w);
        } else {
          _viewport.set(x, y, width, height);
        }
        state.viewport(_currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor());
      };
      this.getScissor = function(target) {
        return target.copy(_scissor);
      };
      this.setScissor = function(x, y, width, height) {
        if (x.isVector4) {
          _scissor.set(x.x, x.y, x.z, x.w);
        } else {
          _scissor.set(x, y, width, height);
        }
        state.scissor(_currentScissor.copy(_scissor).multiplyScalar(_pixelRatio).floor());
      };
      this.getScissorTest = function() {
        return _scissorTest;
      };
      this.setScissorTest = function(boolean) {
        state.setScissorTest(_scissorTest = boolean);
      };
      this.setOpaqueSort = function(method) {
        _opaqueSort = method;
      };
      this.setTransparentSort = function(method) {
        _transparentSort = method;
      };
      this.getClearColor = function(target) {
        return target.copy(background.getClearColor());
      };
      this.setClearColor = function() {
        background.setClearColor.apply(background, arguments);
      };
      this.getClearAlpha = function() {
        return background.getClearAlpha();
      };
      this.setClearAlpha = function() {
        background.setClearAlpha.apply(background, arguments);
      };
      this.clear = function(color = true, depth2 = true, stencil2 = true) {
        let bits = 0;
        if (color) {
          let isIntegerFormat = false;
          if (_currentRenderTarget !== null) {
            const targetFormat = _currentRenderTarget.texture.format;
            isIntegerFormat = targetFormat === RGBAIntegerFormat || targetFormat === RGIntegerFormat || targetFormat === RedIntegerFormat;
          }
          if (isIntegerFormat) {
            const targetType = _currentRenderTarget.texture.type;
            const isUnsignedType = targetType === UnsignedByteType || targetType === UnsignedIntType || targetType === UnsignedShortType || targetType === UnsignedInt248Type || targetType === UnsignedShort4444Type || targetType === UnsignedShort5551Type;
            const clearColor = background.getClearColor();
            const a = background.getClearAlpha();
            const r = clearColor.r;
            const g = clearColor.g;
            const b = clearColor.b;
            if (isUnsignedType) {
              uintClearColor[0] = r;
              uintClearColor[1] = g;
              uintClearColor[2] = b;
              uintClearColor[3] = a;
              _gl.clearBufferuiv(_gl.COLOR, 0, uintClearColor);
            } else {
              intClearColor[0] = r;
              intClearColor[1] = g;
              intClearColor[2] = b;
              intClearColor[3] = a;
              _gl.clearBufferiv(_gl.COLOR, 0, intClearColor);
            }
          } else {
            bits |= _gl.COLOR_BUFFER_BIT;
          }
        }
        if (depth2) bits |= _gl.DEPTH_BUFFER_BIT;
        if (stencil2) {
          bits |= _gl.STENCIL_BUFFER_BIT;
          this.state.buffers.stencil.setMask(4294967295);
        }
        _gl.clear(bits);
      };
      this.clearColor = function() {
        this.clear(true, false, false);
      };
      this.clearDepth = function() {
        this.clear(false, true, false);
      };
      this.clearStencil = function() {
        this.clear(false, false, true);
      };
      this.dispose = function() {
        canvas.removeEventListener("webglcontextlost", onContextLost, false);
        canvas.removeEventListener("webglcontextrestored", onContextRestore, false);
        canvas.removeEventListener("webglcontextcreationerror", onContextCreationError, false);
        renderLists.dispose();
        renderStates.dispose();
        properties.dispose();
        cubemaps.dispose();
        cubeuvmaps.dispose();
        objects.dispose();
        bindingStates.dispose();
        uniformsGroups.dispose();
        programCache.dispose();
        xr.dispose();
        xr.removeEventListener("sessionstart", onXRSessionStart);
        xr.removeEventListener("sessionend", onXRSessionEnd);
        if (_transmissionRenderTarget) {
          _transmissionRenderTarget.dispose();
          _transmissionRenderTarget = null;
        }
        animation.stop();
      };
      function onContextLost(event) {
        event.preventDefault();
        console.log("THREE.WebGLRenderer: Context Lost.");
        _isContextLost = true;
      }
      function onContextRestore() {
        console.log("THREE.WebGLRenderer: Context Restored.");
        _isContextLost = false;
        const infoAutoReset = info.autoReset;
        const shadowMapEnabled = shadowMap.enabled;
        const shadowMapAutoUpdate = shadowMap.autoUpdate;
        const shadowMapNeedsUpdate = shadowMap.needsUpdate;
        const shadowMapType = shadowMap.type;
        initGLContext();
        info.autoReset = infoAutoReset;
        shadowMap.enabled = shadowMapEnabled;
        shadowMap.autoUpdate = shadowMapAutoUpdate;
        shadowMap.needsUpdate = shadowMapNeedsUpdate;
        shadowMap.type = shadowMapType;
      }
      function onContextCreationError(event) {
        console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ", event.statusMessage);
      }
      function onMaterialDispose(event) {
        const material = event.target;
        material.removeEventListener("dispose", onMaterialDispose);
        deallocateMaterial(material);
      }
      function deallocateMaterial(material) {
        releaseMaterialProgramReferences(material);
        properties.remove(material);
      }
      function releaseMaterialProgramReferences(material) {
        const programs = properties.get(material).programs;
        if (programs !== void 0) {
          programs.forEach(function(program) {
            programCache.releaseProgram(program);
          });
          if (material.isShaderMaterial) {
            programCache.releaseShaderCache(material);
          }
        }
      }
      this.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
        if (scene === null) scene = _emptyScene;
        const frontFaceCW = object.isMesh && object.matrixWorld.determinant() < 0;
        const program = setProgram(camera, scene, geometry, material, object);
        state.setMaterial(material, frontFaceCW);
        let index = geometry.index;
        let rangeFactor = 1;
        if (material.wireframe === true) {
          index = geometries.getWireframeAttribute(geometry);
          if (index === void 0) return;
          rangeFactor = 2;
        }
        const drawRange = geometry.drawRange;
        const position = geometry.attributes.position;
        let drawStart = drawRange.start * rangeFactor;
        let drawEnd = (drawRange.start + drawRange.count) * rangeFactor;
        if (group !== null) {
          drawStart = Math.max(drawStart, group.start * rangeFactor);
          drawEnd = Math.min(drawEnd, (group.start + group.count) * rangeFactor);
        }
        if (index !== null) {
          drawStart = Math.max(drawStart, 0);
          drawEnd = Math.min(drawEnd, index.count);
        } else if (position !== void 0 && position !== null) {
          drawStart = Math.max(drawStart, 0);
          drawEnd = Math.min(drawEnd, position.count);
        }
        const drawCount = drawEnd - drawStart;
        if (drawCount < 0 || drawCount === Infinity) return;
        bindingStates.setup(object, material, program, geometry, index);
        let attribute;
        let renderer = bufferRenderer;
        if (index !== null) {
          attribute = attributes.get(index);
          renderer = indexedBufferRenderer;
          renderer.setIndex(attribute);
        }
        if (object.isMesh) {
          if (material.wireframe === true) {
            state.setLineWidth(material.wireframeLinewidth * getTargetPixelRatio());
            renderer.setMode(_gl.LINES);
          } else {
            renderer.setMode(_gl.TRIANGLES);
          }
        } else if (object.isLine) {
          let lineWidth = material.linewidth;
          if (lineWidth === void 0) lineWidth = 1;
          state.setLineWidth(lineWidth * getTargetPixelRatio());
          if (object.isLineSegments) {
            renderer.setMode(_gl.LINES);
          } else if (object.isLineLoop) {
            renderer.setMode(_gl.LINE_LOOP);
          } else {
            renderer.setMode(_gl.LINE_STRIP);
          }
        } else if (object.isPoints) {
          renderer.setMode(_gl.POINTS);
        } else if (object.isSprite) {
          renderer.setMode(_gl.TRIANGLES);
        }
        if (object.isBatchedMesh) {
          renderer.renderMultiDraw(object._multiDrawStarts, object._multiDrawCounts, object._multiDrawCount);
        } else if (object.isInstancedMesh) {
          renderer.renderInstances(drawStart, drawCount, object.count);
        } else if (geometry.isInstancedBufferGeometry) {
          const maxInstanceCount = geometry._maxInstanceCount !== void 0 ? geometry._maxInstanceCount : Infinity;
          const instanceCount = Math.min(geometry.instanceCount, maxInstanceCount);
          renderer.renderInstances(drawStart, drawCount, instanceCount);
        } else {
          renderer.render(drawStart, drawCount);
        }
      };
      function prepareMaterial(material, scene, object) {
        if (material.transparent === true && material.side === DoubleSide && material.forceSinglePass === false) {
          material.side = BackSide;
          material.needsUpdate = true;
          getProgram(material, scene, object);
          material.side = FrontSide;
          material.needsUpdate = true;
          getProgram(material, scene, object);
          material.side = DoubleSide;
        } else {
          getProgram(material, scene, object);
        }
      }
      this.compile = function(scene, camera, targetScene = null) {
        if (targetScene === null) targetScene = scene;
        currentRenderState = renderStates.get(targetScene);
        currentRenderState.init();
        renderStateStack.push(currentRenderState);
        targetScene.traverseVisible(function(object) {
          if (object.isLight && object.layers.test(camera.layers)) {
            currentRenderState.pushLight(object);
            if (object.castShadow) {
              currentRenderState.pushShadow(object);
            }
          }
        });
        if (scene !== targetScene) {
          scene.traverseVisible(function(object) {
            if (object.isLight && object.layers.test(camera.layers)) {
              currentRenderState.pushLight(object);
              if (object.castShadow) {
                currentRenderState.pushShadow(object);
              }
            }
          });
        }
        currentRenderState.setupLights(_this._useLegacyLights);
        const materials2 = /* @__PURE__ */ new Set();
        scene.traverse(function(object) {
          const material = object.material;
          if (material) {
            if (Array.isArray(material)) {
              for (let i = 0; i < material.length; i++) {
                const material2 = material[i];
                prepareMaterial(material2, targetScene, object);
                materials2.add(material2);
              }
            } else {
              prepareMaterial(material, targetScene, object);
              materials2.add(material);
            }
          }
        });
        renderStateStack.pop();
        currentRenderState = null;
        return materials2;
      };
      this.compileAsync = function(scene, camera, targetScene = null) {
        const materials2 = this.compile(scene, camera, targetScene);
        return new Promise((resolve) => {
          function checkMaterialsReady() {
            materials2.forEach(function(material) {
              const materialProperties = properties.get(material);
              const program = materialProperties.currentProgram;
              if (program.isReady()) {
                materials2.delete(material);
              }
            });
            if (materials2.size === 0) {
              resolve(scene);
              return;
            }
            setTimeout(checkMaterialsReady, 10);
          }
          if (extensions.get("KHR_parallel_shader_compile") !== null) {
            checkMaterialsReady();
          } else {
            setTimeout(checkMaterialsReady, 10);
          }
        });
      };
      let onAnimationFrameCallback = null;
      function onAnimationFrame(time) {
        if (onAnimationFrameCallback) onAnimationFrameCallback(time);
      }
      function onXRSessionStart() {
        animation.stop();
      }
      function onXRSessionEnd() {
        animation.start();
      }
      const animation = new WebGLAnimation();
      animation.setAnimationLoop(onAnimationFrame);
      if (typeof self !== "undefined") animation.setContext(self);
      this.setAnimationLoop = function(callback) {
        onAnimationFrameCallback = callback;
        xr.setAnimationLoop(callback);
        callback === null ? animation.stop() : animation.start();
      };
      xr.addEventListener("sessionstart", onXRSessionStart);
      xr.addEventListener("sessionend", onXRSessionEnd);
      this.render = function(scene, camera) {
        if (camera !== void 0 && camera.isCamera !== true) {
          console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");
          return;
        }
        if (_isContextLost === true) return;
        if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
        if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
        if (xr.enabled === true && xr.isPresenting === true) {
          if (xr.cameraAutoUpdate === true) xr.updateCamera(camera);
          camera = xr.getCamera();
        }
        if (scene.isScene === true) scene.onBeforeRender(_this, scene, camera, _currentRenderTarget);
        currentRenderState = renderStates.get(scene, renderStateStack.length);
        currentRenderState.init();
        renderStateStack.push(currentRenderState);
        _projScreenMatrix2.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _frustum2.setFromProjectionMatrix(_projScreenMatrix2);
        _localClippingEnabled = this.localClippingEnabled;
        _clippingEnabled = clipping.init(this.clippingPlanes, _localClippingEnabled);
        currentRenderList = renderLists.get(scene, renderListStack.length);
        currentRenderList.init();
        renderListStack.push(currentRenderList);
        projectObject(scene, camera, 0, _this.sortObjects);
        currentRenderList.finish();
        if (_this.sortObjects === true) {
          currentRenderList.sort(_opaqueSort, _transparentSort);
        }
        this.info.render.frame++;
        if (_clippingEnabled === true) clipping.beginShadows();
        const shadowsArray = currentRenderState.state.shadowsArray;
        shadowMap.render(shadowsArray, scene, camera);
        if (_clippingEnabled === true) clipping.endShadows();
        if (this.info.autoReset === true) this.info.reset();
        background.render(currentRenderList, scene);
        currentRenderState.setupLights(_this._useLegacyLights);
        if (camera.isArrayCamera) {
          const cameras = camera.cameras;
          for (let i = 0, l = cameras.length; i < l; i++) {
            const camera2 = cameras[i];
            renderScene(currentRenderList, scene, camera2, camera2.viewport);
          }
        } else {
          renderScene(currentRenderList, scene, camera);
        }
        if (_currentRenderTarget !== null) {
          textures.updateMultisampleRenderTarget(_currentRenderTarget);
          textures.updateRenderTargetMipmap(_currentRenderTarget);
        }
        if (scene.isScene === true) scene.onAfterRender(_this, scene, camera);
        bindingStates.resetDefaultState();
        _currentMaterialId = -1;
        _currentCamera = null;
        renderStateStack.pop();
        if (renderStateStack.length > 0) {
          currentRenderState = renderStateStack[renderStateStack.length - 1];
        } else {
          currentRenderState = null;
        }
        renderListStack.pop();
        if (renderListStack.length > 0) {
          currentRenderList = renderListStack[renderListStack.length - 1];
        } else {
          currentRenderList = null;
        }
      };
      function projectObject(object, camera, groupOrder, sortObjects) {
        if (object.visible === false) return;
        const visible = object.layers.test(camera.layers);
        if (visible) {
          if (object.isGroup) {
            groupOrder = object.renderOrder;
          } else if (object.isLOD) {
            if (object.autoUpdate === true) object.update(camera);
          } else if (object.isLight) {
            currentRenderState.pushLight(object);
            if (object.castShadow) {
              currentRenderState.pushShadow(object);
            }
          } else if (object.isSprite) {
            if (!object.frustumCulled || _frustum2.intersectsSprite(object)) {
              if (sortObjects) {
                _vector32.setFromMatrixPosition(object.matrixWorld).applyMatrix4(_projScreenMatrix2);
              }
              const geometry = objects.update(object);
              const material = object.material;
              if (material.visible) {
                currentRenderList.push(object, geometry, material, groupOrder, _vector32.z, null);
              }
            }
          } else if (object.isMesh || object.isLine || object.isPoints) {
            if (!object.frustumCulled || _frustum2.intersectsObject(object)) {
              const geometry = objects.update(object);
              const material = object.material;
              if (sortObjects) {
                if (object.boundingSphere !== void 0) {
                  if (object.boundingSphere === null) object.computeBoundingSphere();
                  _vector32.copy(object.boundingSphere.center);
                } else {
                  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
                  _vector32.copy(geometry.boundingSphere.center);
                }
                _vector32.applyMatrix4(object.matrixWorld).applyMatrix4(_projScreenMatrix2);
              }
              if (Array.isArray(material)) {
                const groups = geometry.groups;
                for (let i = 0, l = groups.length; i < l; i++) {
                  const group = groups[i];
                  const groupMaterial = material[group.materialIndex];
                  if (groupMaterial && groupMaterial.visible) {
                    currentRenderList.push(object, geometry, groupMaterial, groupOrder, _vector32.z, group);
                  }
                }
              } else if (material.visible) {
                currentRenderList.push(object, geometry, material, groupOrder, _vector32.z, null);
              }
            }
          }
        }
        const children = object.children;
        for (let i = 0, l = children.length; i < l; i++) {
          projectObject(children[i], camera, groupOrder, sortObjects);
        }
      }
      function renderScene(currentRenderList2, scene, camera, viewport) {
        const opaqueObjects = currentRenderList2.opaque;
        const transmissiveObjects = currentRenderList2.transmissive;
        const transparentObjects = currentRenderList2.transparent;
        currentRenderState.setupLightsView(camera);
        if (_clippingEnabled === true) clipping.setGlobalState(_this.clippingPlanes, camera);
        if (transmissiveObjects.length > 0) renderTransmissionPass(opaqueObjects, transmissiveObjects, scene, camera);
        if (viewport) state.viewport(_currentViewport.copy(viewport));
        if (opaqueObjects.length > 0) renderObjects(opaqueObjects, scene, camera);
        if (transmissiveObjects.length > 0) renderObjects(transmissiveObjects, scene, camera);
        if (transparentObjects.length > 0) renderObjects(transparentObjects, scene, camera);
        state.buffers.depth.setTest(true);
        state.buffers.depth.setMask(true);
        state.buffers.color.setMask(true);
        state.setPolygonOffset(false);
      }
      function renderTransmissionPass(opaqueObjects, transmissiveObjects, scene, camera) {
        const overrideMaterial = scene.isScene === true ? scene.overrideMaterial : null;
        if (overrideMaterial !== null) {
          return;
        }
        const isWebGL2 = capabilities.isWebGL2;
        if (_transmissionRenderTarget === null) {
          _transmissionRenderTarget = new WebGLRenderTarget(1, 1, {
            generateMipmaps: true,
            type: extensions.has("EXT_color_buffer_half_float") ? HalfFloatType : UnsignedByteType,
            minFilter: LinearMipmapLinearFilter,
            samples: isWebGL2 ? 4 : 0
          });
        }
        _this.getDrawingBufferSize(_vector22);
        if (isWebGL2) {
          _transmissionRenderTarget.setSize(_vector22.x, _vector22.y);
        } else {
          _transmissionRenderTarget.setSize(floorPowerOfTwo(_vector22.x), floorPowerOfTwo(_vector22.y));
        }
        const currentRenderTarget = _this.getRenderTarget();
        _this.setRenderTarget(_transmissionRenderTarget);
        _this.getClearColor(_currentClearColor);
        _currentClearAlpha = _this.getClearAlpha();
        if (_currentClearAlpha < 1) _this.setClearColor(16777215, 0.5);
        _this.clear();
        const currentToneMapping = _this.toneMapping;
        _this.toneMapping = NoToneMapping;
        renderObjects(opaqueObjects, scene, camera);
        textures.updateMultisampleRenderTarget(_transmissionRenderTarget);
        textures.updateRenderTargetMipmap(_transmissionRenderTarget);
        let renderTargetNeedsUpdate = false;
        for (let i = 0, l = transmissiveObjects.length; i < l; i++) {
          const renderItem = transmissiveObjects[i];
          const object = renderItem.object;
          const geometry = renderItem.geometry;
          const material = renderItem.material;
          const group = renderItem.group;
          if (material.side === DoubleSide && object.layers.test(camera.layers)) {
            const currentSide = material.side;
            material.side = BackSide;
            material.needsUpdate = true;
            renderObject(object, scene, camera, geometry, material, group);
            material.side = currentSide;
            material.needsUpdate = true;
            renderTargetNeedsUpdate = true;
          }
        }
        if (renderTargetNeedsUpdate === true) {
          textures.updateMultisampleRenderTarget(_transmissionRenderTarget);
          textures.updateRenderTargetMipmap(_transmissionRenderTarget);
        }
        _this.setRenderTarget(currentRenderTarget);
        _this.setClearColor(_currentClearColor, _currentClearAlpha);
        _this.toneMapping = currentToneMapping;
      }
      function renderObjects(renderList, scene, camera) {
        const overrideMaterial = scene.isScene === true ? scene.overrideMaterial : null;
        for (let i = 0, l = renderList.length; i < l; i++) {
          const renderItem = renderList[i];
          const object = renderItem.object;
          const geometry = renderItem.geometry;
          const material = overrideMaterial === null ? renderItem.material : overrideMaterial;
          const group = renderItem.group;
          if (object.layers.test(camera.layers)) {
            renderObject(object, scene, camera, geometry, material, group);
          }
        }
      }
      function renderObject(object, scene, camera, geometry, material, group) {
        object.onBeforeRender(_this, scene, camera, geometry, material, group);
        object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
        object.normalMatrix.getNormalMatrix(object.modelViewMatrix);
        material.onBeforeRender(_this, scene, camera, geometry, object, group);
        if (material.transparent === true && material.side === DoubleSide && material.forceSinglePass === false) {
          material.side = BackSide;
          material.needsUpdate = true;
          _this.renderBufferDirect(camera, scene, geometry, material, object, group);
          material.side = FrontSide;
          material.needsUpdate = true;
          _this.renderBufferDirect(camera, scene, geometry, material, object, group);
          material.side = DoubleSide;
        } else {
          _this.renderBufferDirect(camera, scene, geometry, material, object, group);
        }
        object.onAfterRender(_this, scene, camera, geometry, material, group);
      }
      function getProgram(material, scene, object) {
        if (scene.isScene !== true) scene = _emptyScene;
        const materialProperties = properties.get(material);
        const lights = currentRenderState.state.lights;
        const shadowsArray = currentRenderState.state.shadowsArray;
        const lightsStateVersion = lights.state.version;
        const parameters2 = programCache.getParameters(material, lights.state, shadowsArray, scene, object);
        const programCacheKey = programCache.getProgramCacheKey(parameters2);
        let programs = materialProperties.programs;
        materialProperties.environment = material.isMeshStandardMaterial ? scene.environment : null;
        materialProperties.fog = scene.fog;
        materialProperties.envMap = (material.isMeshStandardMaterial ? cubeuvmaps : cubemaps).get(material.envMap || materialProperties.environment);
        if (programs === void 0) {
          material.addEventListener("dispose", onMaterialDispose);
          programs = /* @__PURE__ */ new Map();
          materialProperties.programs = programs;
        }
        let program = programs.get(programCacheKey);
        if (program !== void 0) {
          if (materialProperties.currentProgram === program && materialProperties.lightsStateVersion === lightsStateVersion) {
            updateCommonMaterialProperties(material, parameters2);
            return program;
          }
        } else {
          parameters2.uniforms = programCache.getUniforms(material);
          material.onBuild(object, parameters2, _this);
          material.onBeforeCompile(parameters2, _this);
          program = programCache.acquireProgram(parameters2, programCacheKey);
          programs.set(programCacheKey, program);
          materialProperties.uniforms = parameters2.uniforms;
        }
        const uniforms = materialProperties.uniforms;
        if (!material.isShaderMaterial && !material.isRawShaderMaterial || material.clipping === true) {
          uniforms.clippingPlanes = clipping.uniform;
        }
        updateCommonMaterialProperties(material, parameters2);
        materialProperties.needsLights = materialNeedsLights(material);
        materialProperties.lightsStateVersion = lightsStateVersion;
        if (materialProperties.needsLights) {
          uniforms.ambientLightColor.value = lights.state.ambient;
          uniforms.lightProbe.value = lights.state.probe;
          uniforms.directionalLights.value = lights.state.directional;
          uniforms.directionalLightShadows.value = lights.state.directionalShadow;
          uniforms.spotLights.value = lights.state.spot;
          uniforms.spotLightShadows.value = lights.state.spotShadow;
          uniforms.rectAreaLights.value = lights.state.rectArea;
          uniforms.ltc_1.value = lights.state.rectAreaLTC1;
          uniforms.ltc_2.value = lights.state.rectAreaLTC2;
          uniforms.pointLights.value = lights.state.point;
          uniforms.pointLightShadows.value = lights.state.pointShadow;
          uniforms.hemisphereLights.value = lights.state.hemi;
          uniforms.directionalShadowMap.value = lights.state.directionalShadowMap;
          uniforms.directionalShadowMatrix.value = lights.state.directionalShadowMatrix;
          uniforms.spotShadowMap.value = lights.state.spotShadowMap;
          uniforms.spotLightMatrix.value = lights.state.spotLightMatrix;
          uniforms.spotLightMap.value = lights.state.spotLightMap;
          uniforms.pointShadowMap.value = lights.state.pointShadowMap;
          uniforms.pointShadowMatrix.value = lights.state.pointShadowMatrix;
        }
        materialProperties.currentProgram = program;
        materialProperties.uniformsList = null;
        return program;
      }
      function getUniformList(materialProperties) {
        if (materialProperties.uniformsList === null) {
          const progUniforms = materialProperties.currentProgram.getUniforms();
          materialProperties.uniformsList = WebGLUniforms.seqWithValue(progUniforms.seq, materialProperties.uniforms);
        }
        return materialProperties.uniformsList;
      }
      function updateCommonMaterialProperties(material, parameters2) {
        const materialProperties = properties.get(material);
        materialProperties.outputColorSpace = parameters2.outputColorSpace;
        materialProperties.batching = parameters2.batching;
        materialProperties.instancing = parameters2.instancing;
        materialProperties.instancingColor = parameters2.instancingColor;
        materialProperties.skinning = parameters2.skinning;
        materialProperties.morphTargets = parameters2.morphTargets;
        materialProperties.morphNormals = parameters2.morphNormals;
        materialProperties.morphColors = parameters2.morphColors;
        materialProperties.morphTargetsCount = parameters2.morphTargetsCount;
        materialProperties.numClippingPlanes = parameters2.numClippingPlanes;
        materialProperties.numIntersection = parameters2.numClipIntersection;
        materialProperties.vertexAlphas = parameters2.vertexAlphas;
        materialProperties.vertexTangents = parameters2.vertexTangents;
        materialProperties.toneMapping = parameters2.toneMapping;
      }
      function setProgram(camera, scene, geometry, material, object) {
        if (scene.isScene !== true) scene = _emptyScene;
        textures.resetTextureUnits();
        const fog = scene.fog;
        const environment = material.isMeshStandardMaterial ? scene.environment : null;
        const colorSpace = _currentRenderTarget === null ? _this.outputColorSpace : _currentRenderTarget.isXRRenderTarget === true ? _currentRenderTarget.texture.colorSpace : LinearSRGBColorSpace;
        const envMap = (material.isMeshStandardMaterial ? cubeuvmaps : cubemaps).get(material.envMap || environment);
        const vertexAlphas = material.vertexColors === true && !!geometry.attributes.color && geometry.attributes.color.itemSize === 4;
        const vertexTangents = !!geometry.attributes.tangent && (!!material.normalMap || material.anisotropy > 0);
        const morphTargets = !!geometry.morphAttributes.position;
        const morphNormals = !!geometry.morphAttributes.normal;
        const morphColors = !!geometry.morphAttributes.color;
        let toneMapping = NoToneMapping;
        if (material.toneMapped) {
          if (_currentRenderTarget === null || _currentRenderTarget.isXRRenderTarget === true) {
            toneMapping = _this.toneMapping;
          }
        }
        const morphAttribute = geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color;
        const morphTargetsCount = morphAttribute !== void 0 ? morphAttribute.length : 0;
        const materialProperties = properties.get(material);
        const lights = currentRenderState.state.lights;
        if (_clippingEnabled === true) {
          if (_localClippingEnabled === true || camera !== _currentCamera) {
            const useCache = camera === _currentCamera && material.id === _currentMaterialId;
            clipping.setState(material, camera, useCache);
          }
        }
        let needsProgramChange = false;
        if (material.version === materialProperties.__version) {
          if (materialProperties.needsLights && materialProperties.lightsStateVersion !== lights.state.version) {
            needsProgramChange = true;
          } else if (materialProperties.outputColorSpace !== colorSpace) {
            needsProgramChange = true;
          } else if (object.isBatchedMesh && materialProperties.batching === false) {
            needsProgramChange = true;
          } else if (!object.isBatchedMesh && materialProperties.batching === true) {
            needsProgramChange = true;
          } else if (object.isInstancedMesh && materialProperties.instancing === false) {
            needsProgramChange = true;
          } else if (!object.isInstancedMesh && materialProperties.instancing === true) {
            needsProgramChange = true;
          } else if (object.isSkinnedMesh && materialProperties.skinning === false) {
            needsProgramChange = true;
          } else if (!object.isSkinnedMesh && materialProperties.skinning === true) {
            needsProgramChange = true;
          } else if (object.isInstancedMesh && materialProperties.instancingColor === true && object.instanceColor === null) {
            needsProgramChange = true;
          } else if (object.isInstancedMesh && materialProperties.instancingColor === false && object.instanceColor !== null) {
            needsProgramChange = true;
          } else if (materialProperties.envMap !== envMap) {
            needsProgramChange = true;
          } else if (material.fog === true && materialProperties.fog !== fog) {
            needsProgramChange = true;
          } else if (materialProperties.numClippingPlanes !== void 0 && (materialProperties.numClippingPlanes !== clipping.numPlanes || materialProperties.numIntersection !== clipping.numIntersection)) {
            needsProgramChange = true;
          } else if (materialProperties.vertexAlphas !== vertexAlphas) {
            needsProgramChange = true;
          } else if (materialProperties.vertexTangents !== vertexTangents) {
            needsProgramChange = true;
          } else if (materialProperties.morphTargets !== morphTargets) {
            needsProgramChange = true;
          } else if (materialProperties.morphNormals !== morphNormals) {
            needsProgramChange = true;
          } else if (materialProperties.morphColors !== morphColors) {
            needsProgramChange = true;
          } else if (materialProperties.toneMapping !== toneMapping) {
            needsProgramChange = true;
          } else if (capabilities.isWebGL2 === true && materialProperties.morphTargetsCount !== morphTargetsCount) {
            needsProgramChange = true;
          }
        } else {
          needsProgramChange = true;
          materialProperties.__version = material.version;
        }
        let program = materialProperties.currentProgram;
        if (needsProgramChange === true) {
          program = getProgram(material, scene, object);
        }
        let refreshProgram = false;
        let refreshMaterial = false;
        let refreshLights = false;
        const p_uniforms = program.getUniforms(), m_uniforms = materialProperties.uniforms;
        if (state.useProgram(program.program)) {
          refreshProgram = true;
          refreshMaterial = true;
          refreshLights = true;
        }
        if (material.id !== _currentMaterialId) {
          _currentMaterialId = material.id;
          refreshMaterial = true;
        }
        if (refreshProgram || _currentCamera !== camera) {
          p_uniforms.setValue(_gl, "projectionMatrix", camera.projectionMatrix);
          p_uniforms.setValue(_gl, "viewMatrix", camera.matrixWorldInverse);
          const uCamPos = p_uniforms.map.cameraPosition;
          if (uCamPos !== void 0) {
            uCamPos.setValue(_gl, _vector32.setFromMatrixPosition(camera.matrixWorld));
          }
          if (capabilities.logarithmicDepthBuffer) {
            p_uniforms.setValue(
              _gl,
              "logDepthBufFC",
              2 / (Math.log(camera.far + 1) / Math.LN2)
            );
          }
          if (material.isMeshPhongMaterial || material.isMeshToonMaterial || material.isMeshLambertMaterial || material.isMeshBasicMaterial || material.isMeshStandardMaterial || material.isShaderMaterial) {
            p_uniforms.setValue(_gl, "isOrthographic", camera.isOrthographicCamera === true);
          }
          if (_currentCamera !== camera) {
            _currentCamera = camera;
            refreshMaterial = true;
            refreshLights = true;
          }
        }
        if (object.isSkinnedMesh) {
          p_uniforms.setOptional(_gl, object, "bindMatrix");
          p_uniforms.setOptional(_gl, object, "bindMatrixInverse");
          const skeleton = object.skeleton;
          if (skeleton) {
            if (capabilities.floatVertexTextures) {
              if (skeleton.boneTexture === null) skeleton.computeBoneTexture();
              p_uniforms.setValue(_gl, "boneTexture", skeleton.boneTexture, textures);
            } else {
              console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required.");
            }
          }
        }
        if (object.isBatchedMesh) {
          p_uniforms.setOptional(_gl, object, "batchingTexture");
          p_uniforms.setValue(_gl, "batchingTexture", object._matricesTexture, textures);
        }
        const morphAttributes = geometry.morphAttributes;
        if (morphAttributes.position !== void 0 || morphAttributes.normal !== void 0 || morphAttributes.color !== void 0 && capabilities.isWebGL2 === true) {
          morphtargets.update(object, geometry, program);
        }
        if (refreshMaterial || materialProperties.receiveShadow !== object.receiveShadow) {
          materialProperties.receiveShadow = object.receiveShadow;
          p_uniforms.setValue(_gl, "receiveShadow", object.receiveShadow);
        }
        if (material.isMeshGouraudMaterial && material.envMap !== null) {
          m_uniforms.envMap.value = envMap;
          m_uniforms.flipEnvMap.value = envMap.isCubeTexture && envMap.isRenderTargetTexture === false ? -1 : 1;
        }
        if (refreshMaterial) {
          p_uniforms.setValue(_gl, "toneMappingExposure", _this.toneMappingExposure);
          if (materialProperties.needsLights) {
            markUniformsLightsNeedsUpdate(m_uniforms, refreshLights);
          }
          if (fog && material.fog === true) {
            materials.refreshFogUniforms(m_uniforms, fog);
          }
          materials.refreshMaterialUniforms(m_uniforms, material, _pixelRatio, _height, _transmissionRenderTarget);
          WebGLUniforms.upload(_gl, getUniformList(materialProperties), m_uniforms, textures);
        }
        if (material.isShaderMaterial && material.uniformsNeedUpdate === true) {
          WebGLUniforms.upload(_gl, getUniformList(materialProperties), m_uniforms, textures);
          material.uniformsNeedUpdate = false;
        }
        if (material.isSpriteMaterial) {
          p_uniforms.setValue(_gl, "center", object.center);
        }
        p_uniforms.setValue(_gl, "modelViewMatrix", object.modelViewMatrix);
        p_uniforms.setValue(_gl, "normalMatrix", object.normalMatrix);
        p_uniforms.setValue(_gl, "modelMatrix", object.matrixWorld);
        if (material.isShaderMaterial || material.isRawShaderMaterial) {
          const groups = material.uniformsGroups;
          for (let i = 0, l = groups.length; i < l; i++) {
            if (capabilities.isWebGL2) {
              const group = groups[i];
              uniformsGroups.update(group, program);
              uniformsGroups.bind(group, program);
            } else {
              console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.");
            }
          }
        }
        return program;
      }
      function markUniformsLightsNeedsUpdate(uniforms, value) {
        uniforms.ambientLightColor.needsUpdate = value;
        uniforms.lightProbe.needsUpdate = value;
        uniforms.directionalLights.needsUpdate = value;
        uniforms.directionalLightShadows.needsUpdate = value;
        uniforms.pointLights.needsUpdate = value;
        uniforms.pointLightShadows.needsUpdate = value;
        uniforms.spotLights.needsUpdate = value;
        uniforms.spotLightShadows.needsUpdate = value;
        uniforms.rectAreaLights.needsUpdate = value;
        uniforms.hemisphereLights.needsUpdate = value;
      }
      function materialNeedsLights(material) {
        return material.isMeshLambertMaterial || material.isMeshToonMaterial || material.isMeshPhongMaterial || material.isMeshStandardMaterial || material.isShadowMaterial || material.isShaderMaterial && material.lights === true;
      }
      this.getActiveCubeFace = function() {
        return _currentActiveCubeFace;
      };
      this.getActiveMipmapLevel = function() {
        return _currentActiveMipmapLevel;
      };
      this.getRenderTarget = function() {
        return _currentRenderTarget;
      };
      this.setRenderTargetTextures = function(renderTarget, colorTexture, depthTexture) {
        properties.get(renderTarget.texture).__webglTexture = colorTexture;
        properties.get(renderTarget.depthTexture).__webglTexture = depthTexture;
        const renderTargetProperties = properties.get(renderTarget);
        renderTargetProperties.__hasExternalTextures = true;
        if (renderTargetProperties.__hasExternalTextures) {
          renderTargetProperties.__autoAllocateDepthBuffer = depthTexture === void 0;
          if (!renderTargetProperties.__autoAllocateDepthBuffer) {
            if (extensions.has("WEBGL_multisampled_render_to_texture") === true) {
              console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided");
              renderTargetProperties.__useRenderToTexture = false;
            }
          }
        }
      };
      this.setRenderTargetFramebuffer = function(renderTarget, defaultFramebuffer) {
        const renderTargetProperties = properties.get(renderTarget);
        renderTargetProperties.__webglFramebuffer = defaultFramebuffer;
        renderTargetProperties.__useDefaultFramebuffer = defaultFramebuffer === void 0;
      };
      this.setRenderTarget = function(renderTarget, activeCubeFace = 0, activeMipmapLevel = 0) {
        _currentRenderTarget = renderTarget;
        _currentActiveCubeFace = activeCubeFace;
        _currentActiveMipmapLevel = activeMipmapLevel;
        let useDefaultFramebuffer = true;
        let framebuffer = null;
        let isCube = false;
        let isRenderTarget3D = false;
        if (renderTarget) {
          const renderTargetProperties = properties.get(renderTarget);
          if (renderTargetProperties.__useDefaultFramebuffer !== void 0) {
            state.bindFramebuffer(_gl.FRAMEBUFFER, null);
            useDefaultFramebuffer = false;
          } else if (renderTargetProperties.__webglFramebuffer === void 0) {
            textures.setupRenderTarget(renderTarget);
          } else if (renderTargetProperties.__hasExternalTextures) {
            textures.rebindTextures(renderTarget, properties.get(renderTarget.texture).__webglTexture, properties.get(renderTarget.depthTexture).__webglTexture);
          }
          const texture = renderTarget.texture;
          if (texture.isData3DTexture || texture.isDataArrayTexture || texture.isCompressedArrayTexture) {
            isRenderTarget3D = true;
          }
          const __webglFramebuffer = properties.get(renderTarget).__webglFramebuffer;
          if (renderTarget.isWebGLCubeRenderTarget) {
            if (Array.isArray(__webglFramebuffer[activeCubeFace])) {
              framebuffer = __webglFramebuffer[activeCubeFace][activeMipmapLevel];
            } else {
              framebuffer = __webglFramebuffer[activeCubeFace];
            }
            isCube = true;
          } else if (capabilities.isWebGL2 && renderTarget.samples > 0 && textures.useMultisampledRTT(renderTarget) === false) {
            framebuffer = properties.get(renderTarget).__webglMultisampledFramebuffer;
          } else {
            if (Array.isArray(__webglFramebuffer)) {
              framebuffer = __webglFramebuffer[activeMipmapLevel];
            } else {
              framebuffer = __webglFramebuffer;
            }
          }
          _currentViewport.copy(renderTarget.viewport);
          _currentScissor.copy(renderTarget.scissor);
          _currentScissorTest = renderTarget.scissorTest;
        } else {
          _currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor();
          _currentScissor.copy(_scissor).multiplyScalar(_pixelRatio).floor();
          _currentScissorTest = _scissorTest;
        }
        const framebufferBound = state.bindFramebuffer(_gl.FRAMEBUFFER, framebuffer);
        if (framebufferBound && capabilities.drawBuffers && useDefaultFramebuffer) {
          state.drawBuffers(renderTarget, framebuffer);
        }
        state.viewport(_currentViewport);
        state.scissor(_currentScissor);
        state.setScissorTest(_currentScissorTest);
        if (isCube) {
          const textureProperties = properties.get(renderTarget.texture);
          _gl.framebufferTexture2D(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_CUBE_MAP_POSITIVE_X + activeCubeFace, textureProperties.__webglTexture, activeMipmapLevel);
        } else if (isRenderTarget3D) {
          const textureProperties = properties.get(renderTarget.texture);
          const layer = activeCubeFace || 0;
          _gl.framebufferTextureLayer(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, textureProperties.__webglTexture, activeMipmapLevel || 0, layer);
        }
        _currentMaterialId = -1;
      };
      this.readRenderTargetPixels = function(renderTarget, x, y, width, height, buffer, activeCubeFaceIndex) {
        if (!(renderTarget && renderTarget.isWebGLRenderTarget)) {
          console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
          return;
        }
        let framebuffer = properties.get(renderTarget).__webglFramebuffer;
        if (renderTarget.isWebGLCubeRenderTarget && activeCubeFaceIndex !== void 0) {
          framebuffer = framebuffer[activeCubeFaceIndex];
        }
        if (framebuffer) {
          state.bindFramebuffer(_gl.FRAMEBUFFER, framebuffer);
          try {
            const texture = renderTarget.texture;
            const textureFormat = texture.format;
            const textureType = texture.type;
            if (textureFormat !== RGBAFormat && utils.convert(textureFormat) !== _gl.getParameter(_gl.IMPLEMENTATION_COLOR_READ_FORMAT)) {
              console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");
              return;
            }
            const halfFloatSupportedByExt = textureType === HalfFloatType && (extensions.has("EXT_color_buffer_half_float") || capabilities.isWebGL2 && extensions.has("EXT_color_buffer_float"));
            if (textureType !== UnsignedByteType && utils.convert(textureType) !== _gl.getParameter(_gl.IMPLEMENTATION_COLOR_READ_TYPE) && // Edge and Chrome Mac < 52 (#9513)
            !(textureType === FloatType && (capabilities.isWebGL2 || extensions.has("OES_texture_float") || extensions.has("WEBGL_color_buffer_float"))) && // Chrome Mac >= 52 and Firefox
            !halfFloatSupportedByExt) {
              console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");
              return;
            }
            if (x >= 0 && x <= renderTarget.width - width && (y >= 0 && y <= renderTarget.height - height)) {
              _gl.readPixels(x, y, width, height, utils.convert(textureFormat), utils.convert(textureType), buffer);
            }
          } finally {
            const framebuffer2 = _currentRenderTarget !== null ? properties.get(_currentRenderTarget).__webglFramebuffer : null;
            state.bindFramebuffer(_gl.FRAMEBUFFER, framebuffer2);
          }
        }
      };
      this.copyFramebufferToTexture = function(position, texture, level = 0) {
        const levelScale = Math.pow(2, -level);
        const width = Math.floor(texture.image.width * levelScale);
        const height = Math.floor(texture.image.height * levelScale);
        textures.setTexture2D(texture, 0);
        _gl.copyTexSubImage2D(_gl.TEXTURE_2D, level, 0, 0, position.x, position.y, width, height);
        state.unbindTexture();
      };
      this.copyTextureToTexture = function(position, srcTexture, dstTexture, level = 0) {
        const width = srcTexture.image.width;
        const height = srcTexture.image.height;
        const glFormat = utils.convert(dstTexture.format);
        const glType = utils.convert(dstTexture.type);
        textures.setTexture2D(dstTexture, 0);
        _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, dstTexture.flipY);
        _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, dstTexture.premultiplyAlpha);
        _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, dstTexture.unpackAlignment);
        if (srcTexture.isDataTexture) {
          _gl.texSubImage2D(_gl.TEXTURE_2D, level, position.x, position.y, width, height, glFormat, glType, srcTexture.image.data);
        } else {
          if (srcTexture.isCompressedTexture) {
            _gl.compressedTexSubImage2D(_gl.TEXTURE_2D, level, position.x, position.y, srcTexture.mipmaps[0].width, srcTexture.mipmaps[0].height, glFormat, srcTexture.mipmaps[0].data);
          } else {
            _gl.texSubImage2D(_gl.TEXTURE_2D, level, position.x, position.y, glFormat, glType, srcTexture.image);
          }
        }
        if (level === 0 && dstTexture.generateMipmaps) _gl.generateMipmap(_gl.TEXTURE_2D);
        state.unbindTexture();
      };
      this.copyTextureToTexture3D = function(sourceBox, position, srcTexture, dstTexture, level = 0) {
        if (_this.isWebGL1Renderer) {
          console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");
          return;
        }
        const width = sourceBox.max.x - sourceBox.min.x + 1;
        const height = sourceBox.max.y - sourceBox.min.y + 1;
        const depth2 = sourceBox.max.z - sourceBox.min.z + 1;
        const glFormat = utils.convert(dstTexture.format);
        const glType = utils.convert(dstTexture.type);
        let glTarget;
        if (dstTexture.isData3DTexture) {
          textures.setTexture3D(dstTexture, 0);
          glTarget = _gl.TEXTURE_3D;
        } else if (dstTexture.isDataArrayTexture || dstTexture.isCompressedArrayTexture) {
          textures.setTexture2DArray(dstTexture, 0);
          glTarget = _gl.TEXTURE_2D_ARRAY;
        } else {
          console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");
          return;
        }
        _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, dstTexture.flipY);
        _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, dstTexture.premultiplyAlpha);
        _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, dstTexture.unpackAlignment);
        const unpackRowLen = _gl.getParameter(_gl.UNPACK_ROW_LENGTH);
        const unpackImageHeight = _gl.getParameter(_gl.UNPACK_IMAGE_HEIGHT);
        const unpackSkipPixels = _gl.getParameter(_gl.UNPACK_SKIP_PIXELS);
        const unpackSkipRows = _gl.getParameter(_gl.UNPACK_SKIP_ROWS);
        const unpackSkipImages = _gl.getParameter(_gl.UNPACK_SKIP_IMAGES);
        const image = srcTexture.isCompressedTexture ? srcTexture.mipmaps[level] : srcTexture.image;
        _gl.pixelStorei(_gl.UNPACK_ROW_LENGTH, image.width);
        _gl.pixelStorei(_gl.UNPACK_IMAGE_HEIGHT, image.height);
        _gl.pixelStorei(_gl.UNPACK_SKIP_PIXELS, sourceBox.min.x);
        _gl.pixelStorei(_gl.UNPACK_SKIP_ROWS, sourceBox.min.y);
        _gl.pixelStorei(_gl.UNPACK_SKIP_IMAGES, sourceBox.min.z);
        if (srcTexture.isDataTexture || srcTexture.isData3DTexture) {
          _gl.texSubImage3D(glTarget, level, position.x, position.y, position.z, width, height, depth2, glFormat, glType, image.data);
        } else {
          if (srcTexture.isCompressedArrayTexture) {
            console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture.");
            _gl.compressedTexSubImage3D(glTarget, level, position.x, position.y, position.z, width, height, depth2, glFormat, image.data);
          } else {
            _gl.texSubImage3D(glTarget, level, position.x, position.y, position.z, width, height, depth2, glFormat, glType, image);
          }
        }
        _gl.pixelStorei(_gl.UNPACK_ROW_LENGTH, unpackRowLen);
        _gl.pixelStorei(_gl.UNPACK_IMAGE_HEIGHT, unpackImageHeight);
        _gl.pixelStorei(_gl.UNPACK_SKIP_PIXELS, unpackSkipPixels);
        _gl.pixelStorei(_gl.UNPACK_SKIP_ROWS, unpackSkipRows);
        _gl.pixelStorei(_gl.UNPACK_SKIP_IMAGES, unpackSkipImages);
        if (level === 0 && dstTexture.generateMipmaps) _gl.generateMipmap(glTarget);
        state.unbindTexture();
      };
      this.initTexture = function(texture) {
        if (texture.isCubeTexture) {
          textures.setTextureCube(texture, 0);
        } else if (texture.isData3DTexture) {
          textures.setTexture3D(texture, 0);
        } else if (texture.isDataArrayTexture || texture.isCompressedArrayTexture) {
          textures.setTexture2DArray(texture, 0);
        } else {
          textures.setTexture2D(texture, 0);
        }
        state.unbindTexture();
      };
      this.resetState = function() {
        _currentActiveCubeFace = 0;
        _currentActiveMipmapLevel = 0;
        _currentRenderTarget = null;
        state.reset();
        bindingStates.reset();
      };
      if (typeof __THREE_DEVTOOLS__ !== "undefined") {
        __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
      }
    }
    get coordinateSystem() {
      return WebGLCoordinateSystem;
    }
    get outputColorSpace() {
      return this._outputColorSpace;
    }
    set outputColorSpace(colorSpace) {
      this._outputColorSpace = colorSpace;
      const gl = this.getContext();
      gl.drawingBufferColorSpace = colorSpace === DisplayP3ColorSpace ? "display-p3" : "srgb";
      gl.unpackColorSpace = ColorManagement.workingColorSpace === LinearDisplayP3ColorSpace ? "display-p3" : "srgb";
    }
    get outputEncoding() {
      console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead.");
      return this.outputColorSpace === SRGBColorSpace ? sRGBEncoding : LinearEncoding;
    }
    set outputEncoding(encoding) {
      console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead.");
      this.outputColorSpace = encoding === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace;
    }
    get useLegacyLights() {
      console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733.");
      return this._useLegacyLights;
    }
    set useLegacyLights(value) {
      console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733.");
      this._useLegacyLights = value;
    }
  };
  var WebGL1Renderer = class extends WebGLRenderer {
  };
  WebGL1Renderer.prototype.isWebGL1Renderer = true;
  var FogExp2 = class _FogExp2 {
    constructor(color, density = 25e-5) {
      this.isFogExp2 = true;
      this.name = "";
      this.color = new Color(color);
      this.density = density;
    }
    clone() {
      return new _FogExp2(this.color, this.density);
    }
    toJSON() {
      return {
        type: "FogExp2",
        name: this.name,
        color: this.color.getHex(),
        density: this.density
      };
    }
  };
  var Fog = class _Fog {
    constructor(color, near = 1, far = 1e3) {
      this.isFog = true;
      this.name = "";
      this.color = new Color(color);
      this.near = near;
      this.far = far;
    }
    clone() {
      return new _Fog(this.color, this.near, this.far);
    }
    toJSON() {
      return {
        type: "Fog",
        name: this.name,
        color: this.color.getHex(),
        near: this.near,
        far: this.far
      };
    }
  };
  var Scene = class extends Object3D {
    constructor() {
      super();
      this.isScene = true;
      this.type = "Scene";
      this.background = null;
      this.environment = null;
      this.fog = null;
      this.backgroundBlurriness = 0;
      this.backgroundIntensity = 1;
      this.overrideMaterial = null;
      if (typeof __THREE_DEVTOOLS__ !== "undefined") {
        __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
      }
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      if (source.background !== null) this.background = source.background.clone();
      if (source.environment !== null) this.environment = source.environment.clone();
      if (source.fog !== null) this.fog = source.fog.clone();
      this.backgroundBlurriness = source.backgroundBlurriness;
      this.backgroundIntensity = source.backgroundIntensity;
      if (source.overrideMaterial !== null) this.overrideMaterial = source.overrideMaterial.clone();
      this.matrixAutoUpdate = source.matrixAutoUpdate;
      return this;
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      if (this.fog !== null) data.object.fog = this.fog.toJSON();
      if (this.backgroundBlurriness > 0) data.object.backgroundBlurriness = this.backgroundBlurriness;
      if (this.backgroundIntensity !== 1) data.object.backgroundIntensity = this.backgroundIntensity;
      return data;
    }
  };
  var InterleavedBuffer = class {
    constructor(array, stride) {
      this.isInterleavedBuffer = true;
      this.array = array;
      this.stride = stride;
      this.count = array !== void 0 ? array.length / stride : 0;
      this.usage = StaticDrawUsage;
      this._updateRange = { offset: 0, count: -1 };
      this.updateRanges = [];
      this.version = 0;
      this.uuid = generateUUID();
    }
    onUploadCallback() {
    }
    set needsUpdate(value) {
      if (value === true) this.version++;
    }
    get updateRange() {
      console.warn("THREE.InterleavedBuffer: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead.");
      return this._updateRange;
    }
    setUsage(value) {
      this.usage = value;
      return this;
    }
    addUpdateRange(start, count) {
      this.updateRanges.push({ start, count });
    }
    clearUpdateRanges() {
      this.updateRanges.length = 0;
    }
    copy(source) {
      this.array = new source.array.constructor(source.array);
      this.count = source.count;
      this.stride = source.stride;
      this.usage = source.usage;
      return this;
    }
    copyAt(index1, attribute, index2) {
      index1 *= this.stride;
      index2 *= attribute.stride;
      for (let i = 0, l = this.stride; i < l; i++) {
        this.array[index1 + i] = attribute.array[index2 + i];
      }
      return this;
    }
    set(value, offset = 0) {
      this.array.set(value, offset);
      return this;
    }
    clone(data) {
      if (data.arrayBuffers === void 0) {
        data.arrayBuffers = {};
      }
      if (this.array.buffer._uuid === void 0) {
        this.array.buffer._uuid = generateUUID();
      }
      if (data.arrayBuffers[this.array.buffer._uuid] === void 0) {
        data.arrayBuffers[this.array.buffer._uuid] = this.array.slice(0).buffer;
      }
      const array = new this.array.constructor(data.arrayBuffers[this.array.buffer._uuid]);
      const ib = new this.constructor(array, this.stride);
      ib.setUsage(this.usage);
      return ib;
    }
    onUpload(callback) {
      this.onUploadCallback = callback;
      return this;
    }
    toJSON(data) {
      if (data.arrayBuffers === void 0) {
        data.arrayBuffers = {};
      }
      if (this.array.buffer._uuid === void 0) {
        this.array.buffer._uuid = generateUUID();
      }
      if (data.arrayBuffers[this.array.buffer._uuid] === void 0) {
        data.arrayBuffers[this.array.buffer._uuid] = Array.from(new Uint32Array(this.array.buffer));
      }
      return {
        uuid: this.uuid,
        buffer: this.array.buffer._uuid,
        type: this.array.constructor.name,
        stride: this.stride
      };
    }
  };
  var _vector$6 = /* @__PURE__ */ new Vector3();
  var InterleavedBufferAttribute = class _InterleavedBufferAttribute {
    constructor(interleavedBuffer, itemSize, offset, normalized = false) {
      this.isInterleavedBufferAttribute = true;
      this.name = "";
      this.data = interleavedBuffer;
      this.itemSize = itemSize;
      this.offset = offset;
      this.normalized = normalized;
    }
    get count() {
      return this.data.count;
    }
    get array() {
      return this.data.array;
    }
    set needsUpdate(value) {
      this.data.needsUpdate = value;
    }
    applyMatrix4(m) {
      for (let i = 0, l = this.data.count; i < l; i++) {
        _vector$6.fromBufferAttribute(this, i);
        _vector$6.applyMatrix4(m);
        this.setXYZ(i, _vector$6.x, _vector$6.y, _vector$6.z);
      }
      return this;
    }
    applyNormalMatrix(m) {
      for (let i = 0, l = this.count; i < l; i++) {
        _vector$6.fromBufferAttribute(this, i);
        _vector$6.applyNormalMatrix(m);
        this.setXYZ(i, _vector$6.x, _vector$6.y, _vector$6.z);
      }
      return this;
    }
    transformDirection(m) {
      for (let i = 0, l = this.count; i < l; i++) {
        _vector$6.fromBufferAttribute(this, i);
        _vector$6.transformDirection(m);
        this.setXYZ(i, _vector$6.x, _vector$6.y, _vector$6.z);
      }
      return this;
    }
    setX(index, x) {
      if (this.normalized) x = normalize(x, this.array);
      this.data.array[index * this.data.stride + this.offset] = x;
      return this;
    }
    setY(index, y) {
      if (this.normalized) y = normalize(y, this.array);
      this.data.array[index * this.data.stride + this.offset + 1] = y;
      return this;
    }
    setZ(index, z) {
      if (this.normalized) z = normalize(z, this.array);
      this.data.array[index * this.data.stride + this.offset + 2] = z;
      return this;
    }
    setW(index, w) {
      if (this.normalized) w = normalize(w, this.array);
      this.data.array[index * this.data.stride + this.offset + 3] = w;
      return this;
    }
    getX(index) {
      let x = this.data.array[index * this.data.stride + this.offset];
      if (this.normalized) x = denormalize(x, this.array);
      return x;
    }
    getY(index) {
      let y = this.data.array[index * this.data.stride + this.offset + 1];
      if (this.normalized) y = denormalize(y, this.array);
      return y;
    }
    getZ(index) {
      let z = this.data.array[index * this.data.stride + this.offset + 2];
      if (this.normalized) z = denormalize(z, this.array);
      return z;
    }
    getW(index) {
      let w = this.data.array[index * this.data.stride + this.offset + 3];
      if (this.normalized) w = denormalize(w, this.array);
      return w;
    }
    setXY(index, x, y) {
      index = index * this.data.stride + this.offset;
      if (this.normalized) {
        x = normalize(x, this.array);
        y = normalize(y, this.array);
      }
      this.data.array[index + 0] = x;
      this.data.array[index + 1] = y;
      return this;
    }
    setXYZ(index, x, y, z) {
      index = index * this.data.stride + this.offset;
      if (this.normalized) {
        x = normalize(x, this.array);
        y = normalize(y, this.array);
        z = normalize(z, this.array);
      }
      this.data.array[index + 0] = x;
      this.data.array[index + 1] = y;
      this.data.array[index + 2] = z;
      return this;
    }
    setXYZW(index, x, y, z, w) {
      index = index * this.data.stride + this.offset;
      if (this.normalized) {
        x = normalize(x, this.array);
        y = normalize(y, this.array);
        z = normalize(z, this.array);
        w = normalize(w, this.array);
      }
      this.data.array[index + 0] = x;
      this.data.array[index + 1] = y;
      this.data.array[index + 2] = z;
      this.data.array[index + 3] = w;
      return this;
    }
    clone(data) {
      if (data === void 0) {
        console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");
        const array = [];
        for (let i = 0; i < this.count; i++) {
          const index = i * this.data.stride + this.offset;
          for (let j = 0; j < this.itemSize; j++) {
            array.push(this.data.array[index + j]);
          }
        }
        return new BufferAttribute(new this.array.constructor(array), this.itemSize, this.normalized);
      } else {
        if (data.interleavedBuffers === void 0) {
          data.interleavedBuffers = {};
        }
        if (data.interleavedBuffers[this.data.uuid] === void 0) {
          data.interleavedBuffers[this.data.uuid] = this.data.clone(data);
        }
        return new _InterleavedBufferAttribute(data.interleavedBuffers[this.data.uuid], this.itemSize, this.offset, this.normalized);
      }
    }
    toJSON(data) {
      if (data === void 0) {
        console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");
        const array = [];
        for (let i = 0; i < this.count; i++) {
          const index = i * this.data.stride + this.offset;
          for (let j = 0; j < this.itemSize; j++) {
            array.push(this.data.array[index + j]);
          }
        }
        return {
          itemSize: this.itemSize,
          type: this.array.constructor.name,
          array,
          normalized: this.normalized
        };
      } else {
        if (data.interleavedBuffers === void 0) {
          data.interleavedBuffers = {};
        }
        if (data.interleavedBuffers[this.data.uuid] === void 0) {
          data.interleavedBuffers[this.data.uuid] = this.data.toJSON(data);
        }
        return {
          isInterleavedBufferAttribute: true,
          itemSize: this.itemSize,
          data: this.data.uuid,
          offset: this.offset,
          normalized: this.normalized
        };
      }
    }
  };
  var SpriteMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isSpriteMaterial = true;
      this.type = "SpriteMaterial";
      this.color = new Color(16777215);
      this.map = null;
      this.alphaMap = null;
      this.rotation = 0;
      this.sizeAttenuation = true;
      this.transparent = true;
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.color.copy(source.color);
      this.map = source.map;
      this.alphaMap = source.alphaMap;
      this.rotation = source.rotation;
      this.sizeAttenuation = source.sizeAttenuation;
      this.fog = source.fog;
      return this;
    }
  };
  var _geometry;
  var _intersectPoint = /* @__PURE__ */ new Vector3();
  var _worldScale = /* @__PURE__ */ new Vector3();
  var _mvPosition = /* @__PURE__ */ new Vector3();
  var _alignedPosition = /* @__PURE__ */ new Vector2();
  var _rotatedPosition = /* @__PURE__ */ new Vector2();
  var _viewWorldMatrix = /* @__PURE__ */ new Matrix4();
  var _vA = /* @__PURE__ */ new Vector3();
  var _vB = /* @__PURE__ */ new Vector3();
  var _vC = /* @__PURE__ */ new Vector3();
  var _uvA = /* @__PURE__ */ new Vector2();
  var _uvB = /* @__PURE__ */ new Vector2();
  var _uvC = /* @__PURE__ */ new Vector2();
  var Sprite = class extends Object3D {
    constructor(material = new SpriteMaterial()) {
      super();
      this.isSprite = true;
      this.type = "Sprite";
      if (_geometry === void 0) {
        _geometry = new BufferGeometry();
        const float32Array = new Float32Array([
          -0.5,
          -0.5,
          0,
          0,
          0,
          0.5,
          -0.5,
          0,
          1,
          0,
          0.5,
          0.5,
          0,
          1,
          1,
          -0.5,
          0.5,
          0,
          0,
          1
        ]);
        const interleavedBuffer = new InterleavedBuffer(float32Array, 5);
        _geometry.setIndex([0, 1, 2, 0, 2, 3]);
        _geometry.setAttribute("position", new InterleavedBufferAttribute(interleavedBuffer, 3, 0, false));
        _geometry.setAttribute("uv", new InterleavedBufferAttribute(interleavedBuffer, 2, 3, false));
      }
      this.geometry = _geometry;
      this.material = material;
      this.center = new Vector2(0.5, 0.5);
    }
    raycast(raycaster, intersects2) {
      if (raycaster.camera === null) {
        console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.');
      }
      _worldScale.setFromMatrixScale(this.matrixWorld);
      _viewWorldMatrix.copy(raycaster.camera.matrixWorld);
      this.modelViewMatrix.multiplyMatrices(raycaster.camera.matrixWorldInverse, this.matrixWorld);
      _mvPosition.setFromMatrixPosition(this.modelViewMatrix);
      if (raycaster.camera.isPerspectiveCamera && this.material.sizeAttenuation === false) {
        _worldScale.multiplyScalar(-_mvPosition.z);
      }
      const rotation = this.material.rotation;
      let sin, cos;
      if (rotation !== 0) {
        cos = Math.cos(rotation);
        sin = Math.sin(rotation);
      }
      const center = this.center;
      transformVertex(_vA.set(-0.5, -0.5, 0), _mvPosition, center, _worldScale, sin, cos);
      transformVertex(_vB.set(0.5, -0.5, 0), _mvPosition, center, _worldScale, sin, cos);
      transformVertex(_vC.set(0.5, 0.5, 0), _mvPosition, center, _worldScale, sin, cos);
      _uvA.set(0, 0);
      _uvB.set(1, 0);
      _uvC.set(1, 1);
      let intersect = raycaster.ray.intersectTriangle(_vA, _vB, _vC, false, _intersectPoint);
      if (intersect === null) {
        transformVertex(_vB.set(-0.5, 0.5, 0), _mvPosition, center, _worldScale, sin, cos);
        _uvB.set(0, 1);
        intersect = raycaster.ray.intersectTriangle(_vA, _vC, _vB, false, _intersectPoint);
        if (intersect === null) {
          return;
        }
      }
      const distance = raycaster.ray.origin.distanceTo(_intersectPoint);
      if (distance < raycaster.near || distance > raycaster.far) return;
      intersects2.push({
        distance,
        point: _intersectPoint.clone(),
        uv: Triangle.getInterpolation(_intersectPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2()),
        face: null,
        object: this
      });
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      if (source.center !== void 0) this.center.copy(source.center);
      this.material = source.material;
      return this;
    }
  };
  function transformVertex(vertexPosition, mvPosition, center, scale, sin, cos) {
    _alignedPosition.subVectors(vertexPosition, center).addScalar(0.5).multiply(scale);
    if (sin !== void 0) {
      _rotatedPosition.x = cos * _alignedPosition.x - sin * _alignedPosition.y;
      _rotatedPosition.y = sin * _alignedPosition.x + cos * _alignedPosition.y;
    } else {
      _rotatedPosition.copy(_alignedPosition);
    }
    vertexPosition.copy(mvPosition);
    vertexPosition.x += _rotatedPosition.x;
    vertexPosition.y += _rotatedPosition.y;
    vertexPosition.applyMatrix4(_viewWorldMatrix);
  }
  var _v1$2 = /* @__PURE__ */ new Vector3();
  var _v2$1 = /* @__PURE__ */ new Vector3();
  var LOD = class extends Object3D {
    constructor() {
      super();
      this._currentLevel = 0;
      this.type = "LOD";
      Object.defineProperties(this, {
        levels: {
          enumerable: true,
          value: []
        },
        isLOD: {
          value: true
        }
      });
      this.autoUpdate = true;
    }
    copy(source) {
      super.copy(source, false);
      const levels = source.levels;
      for (let i = 0, l = levels.length; i < l; i++) {
        const level = levels[i];
        this.addLevel(level.object.clone(), level.distance, level.hysteresis);
      }
      this.autoUpdate = source.autoUpdate;
      return this;
    }
    addLevel(object, distance = 0, hysteresis = 0) {
      distance = Math.abs(distance);
      const levels = this.levels;
      let l;
      for (l = 0; l < levels.length; l++) {
        if (distance < levels[l].distance) {
          break;
        }
      }
      levels.splice(l, 0, { distance, hysteresis, object });
      this.add(object);
      return this;
    }
    getCurrentLevel() {
      return this._currentLevel;
    }
    getObjectForDistance(distance) {
      const levels = this.levels;
      if (levels.length > 0) {
        let i, l;
        for (i = 1, l = levels.length; i < l; i++) {
          let levelDistance = levels[i].distance;
          if (levels[i].object.visible) {
            levelDistance -= levelDistance * levels[i].hysteresis;
          }
          if (distance < levelDistance) {
            break;
          }
        }
        return levels[i - 1].object;
      }
      return null;
    }
    raycast(raycaster, intersects2) {
      const levels = this.levels;
      if (levels.length > 0) {
        _v1$2.setFromMatrixPosition(this.matrixWorld);
        const distance = raycaster.ray.origin.distanceTo(_v1$2);
        this.getObjectForDistance(distance).raycast(raycaster, intersects2);
      }
    }
    update(camera) {
      const levels = this.levels;
      if (levels.length > 1) {
        _v1$2.setFromMatrixPosition(camera.matrixWorld);
        _v2$1.setFromMatrixPosition(this.matrixWorld);
        const distance = _v1$2.distanceTo(_v2$1) / camera.zoom;
        levels[0].object.visible = true;
        let i, l;
        for (i = 1, l = levels.length; i < l; i++) {
          let levelDistance = levels[i].distance;
          if (levels[i].object.visible) {
            levelDistance -= levelDistance * levels[i].hysteresis;
          }
          if (distance >= levelDistance) {
            levels[i - 1].object.visible = false;
            levels[i].object.visible = true;
          } else {
            break;
          }
        }
        this._currentLevel = i - 1;
        for (; i < l; i++) {
          levels[i].object.visible = false;
        }
      }
    }
    toJSON(meta) {
      const data = super.toJSON(meta);
      if (this.autoUpdate === false) data.object.autoUpdate = false;
      data.object.levels = [];
      const levels = this.levels;
      for (let i = 0, l = levels.length; i < l; i++) {
        const level = levels[i];
        data.object.levels.push({
          object: level.object.uuid,
          distance: level.distance,
          hysteresis: level.hysteresis
        });
      }
      return data;
    }
  };
  var _basePosition = /* @__PURE__ */ new Vector3();
  var _skinIndex = /* @__PURE__ */ new Vector4();
  var _skinWeight = /* @__PURE__ */ new Vector4();
  var _vector3 = /* @__PURE__ */ new Vector3();
  var _matrix4 = /* @__PURE__ */ new Matrix4();
  var _vertex = /* @__PURE__ */ new Vector3();
  var _sphere$4 = /* @__PURE__ */ new Sphere();
  var _inverseMatrix$2 = /* @__PURE__ */ new Matrix4();
  var _ray$2 = /* @__PURE__ */ new Ray();
  var SkinnedMesh = class extends Mesh {
    constructor(geometry, material) {
      super(geometry, material);
      this.isSkinnedMesh = true;
      this.type = "SkinnedMesh";
      this.bindMode = AttachedBindMode;
      this.bindMatrix = new Matrix4();
      this.bindMatrixInverse = new Matrix4();
      this.boundingBox = null;
      this.boundingSphere = null;
    }
    computeBoundingBox() {
      const geometry = this.geometry;
      if (this.boundingBox === null) {
        this.boundingBox = new Box3();
      }
      this.boundingBox.makeEmpty();
      const positionAttribute = geometry.getAttribute("position");
      for (let i = 0; i < positionAttribute.count; i++) {
        this.getVertexPosition(i, _vertex);
        this.boundingBox.expandByPoint(_vertex);
      }
    }
    computeBoundingSphere() {
      const geometry = this.geometry;
      if (this.boundingSphere === null) {
        this.boundingSphere = new Sphere();
      }
      this.boundingSphere.makeEmpty();
      const positionAttribute = geometry.getAttribute("position");
      for (let i = 0; i < positionAttribute.count; i++) {
        this.getVertexPosition(i, _vertex);
        this.boundingSphere.expandByPoint(_vertex);
      }
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.bindMode = source.bindMode;
      this.bindMatrix.copy(source.bindMatrix);
      this.bindMatrixInverse.copy(source.bindMatrixInverse);
      this.skeleton = source.skeleton;
      if (source.boundingBox !== null) this.boundingBox = source.boundingBox.clone();
      if (source.boundingSphere !== null) this.boundingSphere = source.boundingSphere.clone();
      return this;
    }
    raycast(raycaster, intersects2) {
      const material = this.material;
      const matrixWorld = this.matrixWorld;
      if (material === void 0) return;
      if (this.boundingSphere === null) this.computeBoundingSphere();
      _sphere$4.copy(this.boundingSphere);
      _sphere$4.applyMatrix4(matrixWorld);
      if (raycaster.ray.intersectsSphere(_sphere$4) === false) return;
      _inverseMatrix$2.copy(matrixWorld).invert();
      _ray$2.copy(raycaster.ray).applyMatrix4(_inverseMatrix$2);
      if (this.boundingBox !== null) {
        if (_ray$2.intersectsBox(this.boundingBox) === false) return;
      }
      this._computeIntersections(raycaster, intersects2, _ray$2);
    }
    getVertexPosition(index, target) {
      super.getVertexPosition(index, target);
      this.applyBoneTransform(index, target);
      return target;
    }
    bind(skeleton, bindMatrix) {
      this.skeleton = skeleton;
      if (bindMatrix === void 0) {
        this.updateMatrixWorld(true);
        this.skeleton.calculateInverses();
        bindMatrix = this.matrixWorld;
      }
      this.bindMatrix.copy(bindMatrix);
      this.bindMatrixInverse.copy(bindMatrix).invert();
    }
    pose() {
      this.skeleton.pose();
    }
    normalizeSkinWeights() {
      const vector = new Vector4();
      const skinWeight = this.geometry.attributes.skinWeight;
      for (let i = 0, l = skinWeight.count; i < l; i++) {
        vector.fromBufferAttribute(skinWeight, i);
        const scale = 1 / vector.manhattanLength();
        if (scale !== Infinity) {
          vector.multiplyScalar(scale);
        } else {
          vector.set(1, 0, 0, 0);
        }
        skinWeight.setXYZW(i, vector.x, vector.y, vector.z, vector.w);
      }
    }
    updateMatrixWorld(force) {
      super.updateMatrixWorld(force);
      if (this.bindMode === AttachedBindMode) {
        this.bindMatrixInverse.copy(this.matrixWorld).invert();
      } else if (this.bindMode === DetachedBindMode) {
        this.bindMatrixInverse.copy(this.bindMatrix).invert();
      } else {
        console.warn("THREE.SkinnedMesh: Unrecognized bindMode: " + this.bindMode);
      }
    }
    applyBoneTransform(index, vector) {
      const skeleton = this.skeleton;
      const geometry = this.geometry;
      _skinIndex.fromBufferAttribute(geometry.attributes.skinIndex, index);
      _skinWeight.fromBufferAttribute(geometry.attributes.skinWeight, index);
      _basePosition.copy(vector).applyMatrix4(this.bindMatrix);
      vector.set(0, 0, 0);
      for (let i = 0; i < 4; i++) {
        const weight = _skinWeight.getComponent(i);
        if (weight !== 0) {
          const boneIndex = _skinIndex.getComponent(i);
          _matrix4.multiplyMatrices(skeleton.bones[boneIndex].matrixWorld, skeleton.boneInverses[boneIndex]);
          vector.addScaledVector(_vector3.copy(_basePosition).applyMatrix4(_matrix4), weight);
        }
      }
      return vector.applyMatrix4(this.bindMatrixInverse);
    }
    boneTransform(index, vector) {
      console.warn("THREE.SkinnedMesh: .boneTransform() was renamed to .applyBoneTransform() in r151.");
      return this.applyBoneTransform(index, vector);
    }
  };
  var Bone = class extends Object3D {
    constructor() {
      super();
      this.isBone = true;
      this.type = "Bone";
    }
  };
  var DataTexture = class extends Texture {
    constructor(data = null, width = 1, height = 1, format, type, mapping, wrapS, wrapT, magFilter = NearestFilter, minFilter = NearestFilter, anisotropy, colorSpace) {
      super(null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace);
      this.isDataTexture = true;
      this.image = { data, width, height };
      this.generateMipmaps = false;
      this.flipY = false;
      this.unpackAlignment = 1;
    }
  };
  var _offsetMatrix = /* @__PURE__ */ new Matrix4();
  var _identityMatrix$1 = /* @__PURE__ */ new Matrix4();
  var Skeleton = class _Skeleton {
    constructor(bones = [], boneInverses = []) {
      this.uuid = generateUUID();
      this.bones = bones.slice(0);
      this.boneInverses = boneInverses;
      this.boneMatrices = null;
      this.boneTexture = null;
      this.init();
    }
    init() {
      const bones = this.bones;
      const boneInverses = this.boneInverses;
      this.boneMatrices = new Float32Array(bones.length * 16);
      if (boneInverses.length === 0) {
        this.calculateInverses();
      } else {
        if (bones.length !== boneInverses.length) {
          console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones.");
          this.boneInverses = [];
          for (let i = 0, il = this.bones.length; i < il; i++) {
            this.boneInverses.push(new Matrix4());
          }
        }
      }
    }
    calculateInverses() {
      this.boneInverses.length = 0;
      for (let i = 0, il = this.bones.length; i < il; i++) {
        const inverse = new Matrix4();
        if (this.bones[i]) {
          inverse.copy(this.bones[i].matrixWorld).invert();
        }
        this.boneInverses.push(inverse);
      }
    }
    pose() {
      for (let i = 0, il = this.bones.length; i < il; i++) {
        const bone = this.bones[i];
        if (bone) {
          bone.matrixWorld.copy(this.boneInverses[i]).invert();
        }
      }
      for (let i = 0, il = this.bones.length; i < il; i++) {
        const bone = this.bones[i];
        if (bone) {
          if (bone.parent && bone.parent.isBone) {
            bone.matrix.copy(bone.parent.matrixWorld).invert();
            bone.matrix.multiply(bone.matrixWorld);
          } else {
            bone.matrix.copy(bone.matrixWorld);
          }
          bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
        }
      }
    }
    update() {
      const bones = this.bones;
      const boneInverses = this.boneInverses;
      const boneMatrices = this.boneMatrices;
      const boneTexture = this.boneTexture;
      for (let i = 0, il = bones.length; i < il; i++) {
        const matrix = bones[i] ? bones[i].matrixWorld : _identityMatrix$1;
        _offsetMatrix.multiplyMatrices(matrix, boneInverses[i]);
        _offsetMatrix.toArray(boneMatrices, i * 16);
      }
      if (boneTexture !== null) {
        boneTexture.needsUpdate = true;
      }
    }
    clone() {
      return new _Skeleton(this.bones, this.boneInverses);
    }
    computeBoneTexture() {
      let size = Math.sqrt(this.bones.length * 4);
      size = Math.ceil(size / 4) * 4;
      size = Math.max(size, 4);
      const boneMatrices = new Float32Array(size * size * 4);
      boneMatrices.set(this.boneMatrices);
      const boneTexture = new DataTexture(boneMatrices, size, size, RGBAFormat, FloatType);
      boneTexture.needsUpdate = true;
      this.boneMatrices = boneMatrices;
      this.boneTexture = boneTexture;
      return this;
    }
    getBoneByName(name) {
      for (let i = 0, il = this.bones.length; i < il; i++) {
        const bone = this.bones[i];
        if (bone.name === name) {
          return bone;
        }
      }
      return void 0;
    }
    dispose() {
      if (this.boneTexture !== null) {
        this.boneTexture.dispose();
        this.boneTexture = null;
      }
    }
    fromJSON(json, bones) {
      this.uuid = json.uuid;
      for (let i = 0, l = json.bones.length; i < l; i++) {
        const uuid = json.bones[i];
        let bone = bones[uuid];
        if (bone === void 0) {
          console.warn("THREE.Skeleton: No bone found with UUID:", uuid);
          bone = new Bone();
        }
        this.bones.push(bone);
        this.boneInverses.push(new Matrix4().fromArray(json.boneInverses[i]));
      }
      this.init();
      return this;
    }
    toJSON() {
      const data = {
        metadata: {
          version: 4.6,
          type: "Skeleton",
          generator: "Skeleton.toJSON"
        },
        bones: [],
        boneInverses: []
      };
      data.uuid = this.uuid;
      const bones = this.bones;
      const boneInverses = this.boneInverses;
      for (let i = 0, l = bones.length; i < l; i++) {
        const bone = bones[i];
        data.bones.push(bone.uuid);
        const boneInverse = boneInverses[i];
        data.boneInverses.push(boneInverse.toArray());
      }
      return data;
    }
  };
  var InstancedBufferAttribute = class extends BufferAttribute {
    constructor(array, itemSize, normalized, meshPerAttribute = 1) {
      super(array, itemSize, normalized);
      this.isInstancedBufferAttribute = true;
      this.meshPerAttribute = meshPerAttribute;
    }
    copy(source) {
      super.copy(source);
      this.meshPerAttribute = source.meshPerAttribute;
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.meshPerAttribute = this.meshPerAttribute;
      data.isInstancedBufferAttribute = true;
      return data;
    }
  };
  var _instanceLocalMatrix = /* @__PURE__ */ new Matrix4();
  var _instanceWorldMatrix = /* @__PURE__ */ new Matrix4();
  var _instanceIntersects = [];
  var _box3 = /* @__PURE__ */ new Box3();
  var _identity = /* @__PURE__ */ new Matrix4();
  var _mesh$1 = /* @__PURE__ */ new Mesh();
  var _sphere$3 = /* @__PURE__ */ new Sphere();
  var InstancedMesh = class extends Mesh {
    constructor(geometry, material, count) {
      super(geometry, material);
      this.isInstancedMesh = true;
      this.instanceMatrix = new InstancedBufferAttribute(new Float32Array(count * 16), 16);
      this.instanceColor = null;
      this.count = count;
      this.boundingBox = null;
      this.boundingSphere = null;
      for (let i = 0; i < count; i++) {
        this.setMatrixAt(i, _identity);
      }
    }
    computeBoundingBox() {
      const geometry = this.geometry;
      const count = this.count;
      if (this.boundingBox === null) {
        this.boundingBox = new Box3();
      }
      if (geometry.boundingBox === null) {
        geometry.computeBoundingBox();
      }
      this.boundingBox.makeEmpty();
      for (let i = 0; i < count; i++) {
        this.getMatrixAt(i, _instanceLocalMatrix);
        _box3.copy(geometry.boundingBox).applyMatrix4(_instanceLocalMatrix);
        this.boundingBox.union(_box3);
      }
    }
    computeBoundingSphere() {
      const geometry = this.geometry;
      const count = this.count;
      if (this.boundingSphere === null) {
        this.boundingSphere = new Sphere();
      }
      if (geometry.boundingSphere === null) {
        geometry.computeBoundingSphere();
      }
      this.boundingSphere.makeEmpty();
      for (let i = 0; i < count; i++) {
        this.getMatrixAt(i, _instanceLocalMatrix);
        _sphere$3.copy(geometry.boundingSphere).applyMatrix4(_instanceLocalMatrix);
        this.boundingSphere.union(_sphere$3);
      }
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.instanceMatrix.copy(source.instanceMatrix);
      if (source.instanceColor !== null) this.instanceColor = source.instanceColor.clone();
      this.count = source.count;
      if (source.boundingBox !== null) this.boundingBox = source.boundingBox.clone();
      if (source.boundingSphere !== null) this.boundingSphere = source.boundingSphere.clone();
      return this;
    }
    getColorAt(index, color) {
      color.fromArray(this.instanceColor.array, index * 3);
    }
    getMatrixAt(index, matrix) {
      matrix.fromArray(this.instanceMatrix.array, index * 16);
    }
    raycast(raycaster, intersects2) {
      const matrixWorld = this.matrixWorld;
      const raycastTimes = this.count;
      _mesh$1.geometry = this.geometry;
      _mesh$1.material = this.material;
      if (_mesh$1.material === void 0) return;
      if (this.boundingSphere === null) this.computeBoundingSphere();
      _sphere$3.copy(this.boundingSphere);
      _sphere$3.applyMatrix4(matrixWorld);
      if (raycaster.ray.intersectsSphere(_sphere$3) === false) return;
      for (let instanceId = 0; instanceId < raycastTimes; instanceId++) {
        this.getMatrixAt(instanceId, _instanceLocalMatrix);
        _instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix);
        _mesh$1.matrixWorld = _instanceWorldMatrix;
        _mesh$1.raycast(raycaster, _instanceIntersects);
        for (let i = 0, l = _instanceIntersects.length; i < l; i++) {
          const intersect = _instanceIntersects[i];
          intersect.instanceId = instanceId;
          intersect.object = this;
          intersects2.push(intersect);
        }
        _instanceIntersects.length = 0;
      }
    }
    setColorAt(index, color) {
      if (this.instanceColor === null) {
        this.instanceColor = new InstancedBufferAttribute(new Float32Array(this.instanceMatrix.count * 3), 3);
      }
      color.toArray(this.instanceColor.array, index * 3);
    }
    setMatrixAt(index, matrix) {
      matrix.toArray(this.instanceMatrix.array, index * 16);
    }
    updateMorphTargets() {
    }
    dispose() {
      this.dispatchEvent({ type: "dispose" });
    }
  };
  function sortOpaque(a, b) {
    return a.z - b.z;
  }
  function sortTransparent(a, b) {
    return b.z - a.z;
  }
  var MultiDrawRenderList = class {
    constructor() {
      this.index = 0;
      this.pool = [];
      this.list = [];
    }
    push(drawRange, z) {
      const pool = this.pool;
      const list = this.list;
      if (this.index >= pool.length) {
        pool.push({
          start: -1,
          count: -1,
          z: -1
        });
      }
      const item = pool[this.index];
      list.push(item);
      this.index++;
      item.start = drawRange.start;
      item.count = drawRange.count;
      item.z = z;
    }
    reset() {
      this.list.length = 0;
      this.index = 0;
    }
  };
  var ID_ATTR_NAME = "batchId";
  var _matrix = /* @__PURE__ */ new Matrix4();
  var _invMatrixWorld = /* @__PURE__ */ new Matrix4();
  var _identityMatrix = /* @__PURE__ */ new Matrix4();
  var _projScreenMatrix$2 = /* @__PURE__ */ new Matrix4();
  var _frustum = /* @__PURE__ */ new Frustum();
  var _box$1 = /* @__PURE__ */ new Box3();
  var _sphere$2 = /* @__PURE__ */ new Sphere();
  var _vector$5 = /* @__PURE__ */ new Vector3();
  var _renderList = /* @__PURE__ */ new MultiDrawRenderList();
  var _mesh = /* @__PURE__ */ new Mesh();
  var _batchIntersects = [];
  function copyAttributeData(src, target, targetOffset = 0) {
    const itemSize = target.itemSize;
    if (src.isInterleavedBufferAttribute || src.array.constructor !== target.array.constructor) {
      const vertexCount = src.count;
      for (let i = 0; i < vertexCount; i++) {
        for (let c = 0; c < itemSize; c++) {
          target.setComponent(i + targetOffset, c, src.getComponent(i, c));
        }
      }
    } else {
      target.array.set(src.array, targetOffset * itemSize);
    }
    target.needsUpdate = true;
  }
  var BatchedMesh = class extends Mesh {
    get maxGeometryCount() {
      return this._maxGeometryCount;
    }
    constructor(maxGeometryCount, maxVertexCount, maxIndexCount = maxVertexCount * 2, material) {
      super(new BufferGeometry(), material);
      this.isBatchedMesh = true;
      this.perObjectFrustumCulled = true;
      this.sortObjects = true;
      this.boundingBox = null;
      this.boundingSphere = null;
      this.customSort = null;
      this._drawRanges = [];
      this._reservedRanges = [];
      this._visibility = [];
      this._active = [];
      this._bounds = [];
      this._maxGeometryCount = maxGeometryCount;
      this._maxVertexCount = maxVertexCount;
      this._maxIndexCount = maxIndexCount;
      this._geometryInitialized = false;
      this._geometryCount = 0;
      this._multiDrawCounts = new Int32Array(maxGeometryCount);
      this._multiDrawStarts = new Int32Array(maxGeometryCount);
      this._multiDrawCount = 0;
      this._visibilityChanged = true;
      this._matricesTexture = null;
      this._initMatricesTexture();
    }
    _initMatricesTexture() {
      let size = Math.sqrt(this._maxGeometryCount * 4);
      size = Math.ceil(size / 4) * 4;
      size = Math.max(size, 4);
      const matricesArray = new Float32Array(size * size * 4);
      const matricesTexture = new DataTexture(matricesArray, size, size, RGBAFormat, FloatType);
      this._matricesTexture = matricesTexture;
    }
    _initializeGeometry(reference) {
      const geometry = this.geometry;
      const maxVertexCount = this._maxVertexCount;
      const maxGeometryCount = this._maxGeometryCount;
      const maxIndexCount = this._maxIndexCount;
      if (this._geometryInitialized === false) {
        for (const attributeName in reference.attributes) {
          const srcAttribute = reference.getAttribute(attributeName);
          const { array, itemSize, normalized } = srcAttribute;
          const dstArray = new array.constructor(maxVertexCount * itemSize);
          const dstAttribute = new srcAttribute.constructor(dstArray, itemSize, normalized);
          dstAttribute.setUsage(srcAttribute.usage);
          geometry.setAttribute(attributeName, dstAttribute);
        }
        if (reference.getIndex() !== null) {
          const indexArray = maxVertexCount > 65536 ? new Uint32Array(maxIndexCount) : new Uint16Array(maxIndexCount);
          geometry.setIndex(new BufferAttribute(indexArray, 1));
        }
        const idArray = maxGeometryCount > 65536 ? new Uint32Array(maxVertexCount) : new Uint16Array(maxVertexCount);
        geometry.setAttribute(ID_ATTR_NAME, new BufferAttribute(idArray, 1));
        this._geometryInitialized = true;
      }
    }
    // Make sure the geometry is compatible with the existing combined geometry atributes
    _validateGeometry(geometry) {
      if (geometry.getAttribute(ID_ATTR_NAME)) {
        throw new Error(`BatchedMesh: Geometry cannot use attribute "${ID_ATTR_NAME}"`);
      }
      const batchGeometry = this.geometry;
      if (Boolean(geometry.getIndex()) !== Boolean(batchGeometry.getIndex())) {
        throw new Error('BatchedMesh: All geometries must consistently have "index".');
      }
      for (const attributeName in batchGeometry.attributes) {
        if (attributeName === ID_ATTR_NAME) {
          continue;
        }
        if (!geometry.hasAttribute(attributeName)) {
          throw new Error(`BatchedMesh: Added geometry missing "${attributeName}". All geometries must have consistent attributes.`);
        }
        const srcAttribute = geometry.getAttribute(attributeName);
        const dstAttribute = batchGeometry.getAttribute(attributeName);
        if (srcAttribute.itemSize !== dstAttribute.itemSize || srcAttribute.normalized !== dstAttribute.normalized) {
          throw new Error("BatchedMesh: All attributes must have a consistent itemSize and normalized value.");
        }
      }
    }
    setCustomSort(func) {
      this.customSort = func;
      return this;
    }
    computeBoundingBox() {
      if (this.boundingBox === null) {
        this.boundingBox = new Box3();
      }
      const geometryCount = this._geometryCount;
      const boundingBox = this.boundingBox;
      const active = this._active;
      boundingBox.makeEmpty();
      for (let i = 0; i < geometryCount; i++) {
        if (active[i] === false) continue;
        this.getMatrixAt(i, _matrix);
        this.getBoundingBoxAt(i, _box$1).applyMatrix4(_matrix);
        boundingBox.union(_box$1);
      }
    }
    computeBoundingSphere() {
      if (this.boundingSphere === null) {
        this.boundingSphere = new Sphere();
      }
      const geometryCount = this._geometryCount;
      const boundingSphere = this.boundingSphere;
      const active = this._active;
      boundingSphere.makeEmpty();
      for (let i = 0; i < geometryCount; i++) {
        if (active[i] === false) continue;
        this.getMatrixAt(i, _matrix);
        this.getBoundingSphereAt(i, _sphere$2).applyMatrix4(_matrix);
        boundingSphere.union(_sphere$2);
      }
    }
    addGeometry(geometry, vertexCount = -1, indexCount = -1) {
      this._initializeGeometry(geometry);
      this._validateGeometry(geometry);
      if (this._geometryCount >= this._maxGeometryCount) {
        throw new Error("BatchedMesh: Maximum geometry count reached.");
      }
      const reservedRange = {
        vertexStart: -1,
        vertexCount: -1,
        indexStart: -1,
        indexCount: -1
      };
      let lastRange = null;
      const reservedRanges = this._reservedRanges;
      const drawRanges = this._drawRanges;
      const bounds = this._bounds;
      if (this._geometryCount !== 0) {
        lastRange = reservedRanges[reservedRanges.length - 1];
      }
      if (vertexCount === -1) {
        reservedRange.vertexCount = geometry.getAttribute("position").count;
      } else {
        reservedRange.vertexCount = vertexCount;
      }
      if (lastRange === null) {
        reservedRange.vertexStart = 0;
      } else {
        reservedRange.vertexStart = lastRange.vertexStart + lastRange.vertexCount;
      }
      const index = geometry.getIndex();
      const hasIndex = index !== null;
      if (hasIndex) {
        if (indexCount === -1) {
          reservedRange.indexCount = index.count;
        } else {
          reservedRange.indexCount = indexCount;
        }
        if (lastRange === null) {
          reservedRange.indexStart = 0;
        } else {
          reservedRange.indexStart = lastRange.indexStart + lastRange.indexCount;
        }
      }
      if (reservedRange.indexStart !== -1 && reservedRange.indexStart + reservedRange.indexCount > this._maxIndexCount || reservedRange.vertexStart + reservedRange.vertexCount > this._maxVertexCount) {
        throw new Error("BatchedMesh: Reserved space request exceeds the maximum buffer size.");
      }
      const visibility = this._visibility;
      const active = this._active;
      const matricesTexture = this._matricesTexture;
      const matricesArray = this._matricesTexture.image.data;
      visibility.push(true);
      active.push(true);
      const geometryId = this._geometryCount;
      this._geometryCount++;
      _identityMatrix.toArray(matricesArray, geometryId * 16);
      matricesTexture.needsUpdate = true;
      reservedRanges.push(reservedRange);
      drawRanges.push({
        start: hasIndex ? reservedRange.indexStart : reservedRange.vertexStart,
        count: -1
      });
      bounds.push({
        boxInitialized: false,
        box: new Box3(),
        sphereInitialized: false,
        sphere: new Sphere()
      });
      const idAttribute = this.geometry.getAttribute(ID_ATTR_NAME);
      for (let i = 0; i < reservedRange.vertexCount; i++) {
        idAttribute.setX(reservedRange.vertexStart + i, geometryId);
      }
      idAttribute.needsUpdate = true;
      this.setGeometryAt(geometryId, geometry);
      return geometryId;
    }
    setGeometryAt(id, geometry) {
      if (id >= this._geometryCount) {
        throw new Error("BatchedMesh: Maximum geometry count reached.");
      }
      this._validateGeometry(geometry);
      const batchGeometry = this.geometry;
      const hasIndex = batchGeometry.getIndex() !== null;
      const dstIndex = batchGeometry.getIndex();
      const srcIndex = geometry.getIndex();
      const reservedRange = this._reservedRanges[id];
      if (hasIndex && srcIndex.count > reservedRange.indexCount || geometry.attributes.position.count > reservedRange.vertexCount) {
        throw new Error("BatchedMesh: Reserved space not large enough for provided geometry.");
      }
      const vertexStart = reservedRange.vertexStart;
      const vertexCount = reservedRange.vertexCount;
      for (const attributeName in batchGeometry.attributes) {
        if (attributeName === ID_ATTR_NAME) {
          continue;
        }
        const srcAttribute = geometry.getAttribute(attributeName);
        const dstAttribute = batchGeometry.getAttribute(attributeName);
        copyAttributeData(srcAttribute, dstAttribute, vertexStart);
        const itemSize = srcAttribute.itemSize;
        for (let i = srcAttribute.count, l = vertexCount; i < l; i++) {
          const index = vertexStart + i;
          for (let c = 0; c < itemSize; c++) {
            dstAttribute.setComponent(index, c, 0);
          }
        }
        dstAttribute.needsUpdate = true;
      }
      if (hasIndex) {
        const indexStart = reservedRange.indexStart;
        for (let i = 0; i < srcIndex.count; i++) {
          dstIndex.setX(indexStart + i, vertexStart + srcIndex.getX(i));
        }
        for (let i = srcIndex.count, l = reservedRange.indexCount; i < l; i++) {
          dstIndex.setX(indexStart + i, vertexStart);
        }
        dstIndex.needsUpdate = true;
      }
      const bound = this._bounds[id];
      if (geometry.boundingBox !== null) {
        bound.box.copy(geometry.boundingBox);
        bound.boxInitialized = true;
      } else {
        bound.boxInitialized = false;
      }
      if (geometry.boundingSphere !== null) {
        bound.sphere.copy(geometry.boundingSphere);
        bound.sphereInitialized = true;
      } else {
        bound.sphereInitialized = false;
      }
      const drawRange = this._drawRanges[id];
      const posAttr = geometry.getAttribute("position");
      drawRange.count = hasIndex ? srcIndex.count : posAttr.count;
      this._visibilityChanged = true;
      return id;
    }
    deleteGeometry(geometryId) {
      const active = this._active;
      if (geometryId >= active.length || active[geometryId] === false) {
        return this;
      }
      active[geometryId] = false;
      this._visibilityChanged = true;
      return this;
    }
    // get bounding box and compute it if it doesn't exist
    getBoundingBoxAt(id, target) {
      const active = this._active;
      if (active[id] === false) {
        return this;
      }
      const bound = this._bounds[id];
      const box = bound.box;
      const geometry = this.geometry;
      if (bound.boxInitialized === false) {
        box.makeEmpty();
        const index = geometry.index;
        const position = geometry.attributes.position;
        const drawRange = this._drawRanges[id];
        for (let i = drawRange.start, l = drawRange.start + drawRange.count; i < l; i++) {
          let iv = i;
          if (index) {
            iv = index.getX(iv);
          }
          box.expandByPoint(_vector$5.fromBufferAttribute(position, iv));
        }
        bound.boxInitialized = true;
      }
      target.copy(box);
      return target;
    }
    // get bounding sphere and compute it if it doesn't exist
    getBoundingSphereAt(id, target) {
      const active = this._active;
      if (active[id] === false) {
        return this;
      }
      const bound = this._bounds[id];
      const sphere = bound.sphere;
      const geometry = this.geometry;
      if (bound.sphereInitialized === false) {
        sphere.makeEmpty();
        this.getBoundingBoxAt(id, _box$1);
        _box$1.getCenter(sphere.center);
        const index = geometry.index;
        const position = geometry.attributes.position;
        const drawRange = this._drawRanges[id];
        let maxRadiusSq = 0;
        for (let i = drawRange.start, l = drawRange.start + drawRange.count; i < l; i++) {
          let iv = i;
          if (index) {
            iv = index.getX(iv);
          }
          _vector$5.fromBufferAttribute(position, iv);
          maxRadiusSq = Math.max(maxRadiusSq, sphere.center.distanceToSquared(_vector$5));
        }
        sphere.radius = Math.sqrt(maxRadiusSq);
        bound.sphereInitialized = true;
      }
      target.copy(sphere);
      return target;
    }
    setMatrixAt(geometryId, matrix) {
      const active = this._active;
      const matricesTexture = this._matricesTexture;
      const matricesArray = this._matricesTexture.image.data;
      const geometryCount = this._geometryCount;
      if (geometryId >= geometryCount || active[geometryId] === false) {
        return this;
      }
      matrix.toArray(matricesArray, geometryId * 16);
      matricesTexture.needsUpdate = true;
      return this;
    }
    getMatrixAt(geometryId, matrix) {
      const active = this._active;
      const matricesArray = this._matricesTexture.image.data;
      const geometryCount = this._geometryCount;
      if (geometryId >= geometryCount || active[geometryId] === false) {
        return null;
      }
      return matrix.fromArray(matricesArray, geometryId * 16);
    }
    setVisibleAt(geometryId, value) {
      const visibility = this._visibility;
      const active = this._active;
      const geometryCount = this._geometryCount;
      if (geometryId >= geometryCount || active[geometryId] === false || visibility[geometryId] === value) {
        return this;
      }
      visibility[geometryId] = value;
      this._visibilityChanged = true;
      return this;
    }
    getVisibleAt(geometryId) {
      const visibility = this._visibility;
      const active = this._active;
      const geometryCount = this._geometryCount;
      if (geometryId >= geometryCount || active[geometryId] === false) {
        return false;
      }
      return visibility[geometryId];
    }
    raycast(raycaster, intersects2) {
      const visibility = this._visibility;
      const active = this._active;
      const drawRanges = this._drawRanges;
      const geometryCount = this._geometryCount;
      const matrixWorld = this.matrixWorld;
      const batchGeometry = this.geometry;
      _mesh.material = this.material;
      _mesh.geometry.index = batchGeometry.index;
      _mesh.geometry.attributes = batchGeometry.attributes;
      if (_mesh.geometry.boundingBox === null) {
        _mesh.geometry.boundingBox = new Box3();
      }
      if (_mesh.geometry.boundingSphere === null) {
        _mesh.geometry.boundingSphere = new Sphere();
      }
      for (let i = 0; i < geometryCount; i++) {
        if (!visibility[i] || !active[i]) {
          continue;
        }
        const drawRange = drawRanges[i];
        _mesh.geometry.setDrawRange(drawRange.start, drawRange.count);
        this.getMatrixAt(i, _mesh.matrixWorld).premultiply(matrixWorld);
        this.getBoundingBoxAt(i, _mesh.geometry.boundingBox);
        this.getBoundingSphereAt(i, _mesh.geometry.boundingSphere);
        _mesh.raycast(raycaster, _batchIntersects);
        for (let j = 0, l = _batchIntersects.length; j < l; j++) {
          const intersect = _batchIntersects[j];
          intersect.object = this;
          intersect.batchId = i;
          intersects2.push(intersect);
        }
        _batchIntersects.length = 0;
      }
      _mesh.material = null;
      _mesh.geometry.index = null;
      _mesh.geometry.attributes = {};
      _mesh.geometry.setDrawRange(0, Infinity);
    }
    copy(source) {
      super.copy(source);
      this.geometry = source.geometry.clone();
      this.perObjectFrustumCulled = source.perObjectFrustumCulled;
      this.sortObjects = source.sortObjects;
      this.boundingBox = source.boundingBox !== null ? source.boundingBox.clone() : null;
      this.boundingSphere = source.boundingSphere !== null ? source.boundingSphere.clone() : null;
      this._drawRanges = source._drawRanges.map((range) => ({ ...range }));
      this._reservedRanges = source._reservedRanges.map((range) => ({ ...range }));
      this._visibility = source._visibility.slice();
      this._active = source._active.slice();
      this._bounds = source._bounds.map((bound) => ({
        boxInitialized: bound.boxInitialized,
        box: bound.box.clone(),
        sphereInitialized: bound.sphereInitialized,
        sphere: bound.sphere.clone()
      }));
      this._maxGeometryCount = source._maxGeometryCount;
      this._maxVertexCount = source._maxVertexCount;
      this._maxIndexCount = source._maxIndexCount;
      this._geometryInitialized = source._geometryInitialized;
      this._geometryCount = source._geometryCount;
      this._multiDrawCounts = source._multiDrawCounts.slice();
      this._multiDrawStarts = source._multiDrawStarts.slice();
      this._matricesTexture = source._matricesTexture.clone();
      this._matricesTexture.image.data = this._matricesTexture.image.slice();
      return this;
    }
    dispose() {
      this.geometry.dispose();
      this._matricesTexture.dispose();
      this._matricesTexture = null;
      return this;
    }
    onBeforeRender(renderer, scene, camera, geometry, material) {
      if (!this._visibilityChanged && !this.perObjectFrustumCulled && !this.sortObjects) {
        return;
      }
      const index = geometry.getIndex();
      const bytesPerElement = index === null ? 1 : index.array.BYTES_PER_ELEMENT;
      const visibility = this._visibility;
      const multiDrawStarts = this._multiDrawStarts;
      const multiDrawCounts = this._multiDrawCounts;
      const drawRanges = this._drawRanges;
      const perObjectFrustumCulled = this.perObjectFrustumCulled;
      if (perObjectFrustumCulled) {
        _projScreenMatrix$2.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(this.matrixWorld);
        _frustum.setFromProjectionMatrix(
          _projScreenMatrix$2,
          renderer.isWebGPURenderer ? WebGPUCoordinateSystem : WebGLCoordinateSystem
        );
      }
      let count = 0;
      if (this.sortObjects) {
        _invMatrixWorld.copy(this.matrixWorld).invert();
        _vector$5.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(_invMatrixWorld);
        for (let i = 0, l = visibility.length; i < l; i++) {
          if (visibility[i]) {
            this.getMatrixAt(i, _matrix);
            this.getBoundingSphereAt(i, _sphere$2).applyMatrix4(_matrix);
            let culled = false;
            if (perObjectFrustumCulled) {
              culled = !_frustum.intersectsSphere(_sphere$2);
            }
            if (!culled) {
              const z = _vector$5.distanceTo(_sphere$2.center);
              _renderList.push(drawRanges[i], z);
            }
          }
        }
        const list = _renderList.list;
        const customSort = this.customSort;
        if (customSort === null) {
          list.sort(material.transparent ? sortTransparent : sortOpaque);
        } else {
          customSort.call(this, list, camera);
        }
        for (let i = 0, l = list.length; i < l; i++) {
          const item = list[i];
          multiDrawStarts[count] = item.start * bytesPerElement;
          multiDrawCounts[count] = item.count;
          count++;
        }
        _renderList.reset();
      } else {
        for (let i = 0, l = visibility.length; i < l; i++) {
          if (visibility[i]) {
            let culled = false;
            if (perObjectFrustumCulled) {
              this.getMatrixAt(i, _matrix);
              this.getBoundingSphereAt(i, _sphere$2).applyMatrix4(_matrix);
              culled = !_frustum.intersectsSphere(_sphere$2);
            }
            if (!culled) {
              const range = drawRanges[i];
              multiDrawStarts[count] = range.start * bytesPerElement;
              multiDrawCounts[count] = range.count;
              count++;
            }
          }
        }
      }
      this._multiDrawCount = count;
      this._visibilityChanged = false;
    }
    onBeforeShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial) {
      this.onBeforeRender(renderer, null, shadowCamera, geometry, depthMaterial);
    }
  };
  var LineBasicMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isLineBasicMaterial = true;
      this.type = "LineBasicMaterial";
      this.color = new Color(16777215);
      this.map = null;
      this.linewidth = 1;
      this.linecap = "round";
      this.linejoin = "round";
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.color.copy(source.color);
      this.map = source.map;
      this.linewidth = source.linewidth;
      this.linecap = source.linecap;
      this.linejoin = source.linejoin;
      this.fog = source.fog;
      return this;
    }
  };
  var _start$1 = /* @__PURE__ */ new Vector3();
  var _end$1 = /* @__PURE__ */ new Vector3();
  var _inverseMatrix$1 = /* @__PURE__ */ new Matrix4();
  var _ray$1 = /* @__PURE__ */ new Ray();
  var _sphere$1 = /* @__PURE__ */ new Sphere();
  var Line = class extends Object3D {
    constructor(geometry = new BufferGeometry(), material = new LineBasicMaterial()) {
      super();
      this.isLine = true;
      this.type = "Line";
      this.geometry = geometry;
      this.material = material;
      this.updateMorphTargets();
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.material = Array.isArray(source.material) ? source.material.slice() : source.material;
      this.geometry = source.geometry;
      return this;
    }
    computeLineDistances() {
      const geometry = this.geometry;
      if (geometry.index === null) {
        const positionAttribute = geometry.attributes.position;
        const lineDistances = [0];
        for (let i = 1, l = positionAttribute.count; i < l; i++) {
          _start$1.fromBufferAttribute(positionAttribute, i - 1);
          _end$1.fromBufferAttribute(positionAttribute, i);
          lineDistances[i] = lineDistances[i - 1];
          lineDistances[i] += _start$1.distanceTo(_end$1);
        }
        geometry.setAttribute("lineDistance", new Float32BufferAttribute(lineDistances, 1));
      } else {
        console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
      }
      return this;
    }
    raycast(raycaster, intersects2) {
      const geometry = this.geometry;
      const matrixWorld = this.matrixWorld;
      const threshold = raycaster.params.Line.threshold;
      const drawRange = geometry.drawRange;
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
      _sphere$1.copy(geometry.boundingSphere);
      _sphere$1.applyMatrix4(matrixWorld);
      _sphere$1.radius += threshold;
      if (raycaster.ray.intersectsSphere(_sphere$1) === false) return;
      _inverseMatrix$1.copy(matrixWorld).invert();
      _ray$1.copy(raycaster.ray).applyMatrix4(_inverseMatrix$1);
      const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
      const localThresholdSq = localThreshold * localThreshold;
      const vStart = new Vector3();
      const vEnd = new Vector3();
      const interSegment = new Vector3();
      const interRay = new Vector3();
      const step = this.isLineSegments ? 2 : 1;
      const index = geometry.index;
      const attributes = geometry.attributes;
      const positionAttribute = attributes.position;
      if (index !== null) {
        const start = Math.max(0, drawRange.start);
        const end = Math.min(index.count, drawRange.start + drawRange.count);
        for (let i = start, l = end - 1; i < l; i += step) {
          const a = index.getX(i);
          const b = index.getX(i + 1);
          vStart.fromBufferAttribute(positionAttribute, a);
          vEnd.fromBufferAttribute(positionAttribute, b);
          const distSq = _ray$1.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
          if (distSq > localThresholdSq) continue;
          interRay.applyMatrix4(this.matrixWorld);
          const distance = raycaster.ray.origin.distanceTo(interRay);
          if (distance < raycaster.near || distance > raycaster.far) continue;
          intersects2.push({
            distance,
            // What do we want? intersection point on the ray or on the segment??
            // point: raycaster.ray.at( distance ),
            point: interSegment.clone().applyMatrix4(this.matrixWorld),
            index: i,
            face: null,
            faceIndex: null,
            object: this
          });
        }
      } else {
        const start = Math.max(0, drawRange.start);
        const end = Math.min(positionAttribute.count, drawRange.start + drawRange.count);
        for (let i = start, l = end - 1; i < l; i += step) {
          vStart.fromBufferAttribute(positionAttribute, i);
          vEnd.fromBufferAttribute(positionAttribute, i + 1);
          const distSq = _ray$1.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
          if (distSq > localThresholdSq) continue;
          interRay.applyMatrix4(this.matrixWorld);
          const distance = raycaster.ray.origin.distanceTo(interRay);
          if (distance < raycaster.near || distance > raycaster.far) continue;
          intersects2.push({
            distance,
            // What do we want? intersection point on the ray or on the segment??
            // point: raycaster.ray.at( distance ),
            point: interSegment.clone().applyMatrix4(this.matrixWorld),
            index: i,
            face: null,
            faceIndex: null,
            object: this
          });
        }
      }
    }
    updateMorphTargets() {
      const geometry = this.geometry;
      const morphAttributes = geometry.morphAttributes;
      const keys = Object.keys(morphAttributes);
      if (keys.length > 0) {
        const morphAttribute = morphAttributes[keys[0]];
        if (morphAttribute !== void 0) {
          this.morphTargetInfluences = [];
          this.morphTargetDictionary = {};
          for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
            const name = morphAttribute[m].name || String(m);
            this.morphTargetInfluences.push(0);
            this.morphTargetDictionary[name] = m;
          }
        }
      }
    }
  };
  var _start = /* @__PURE__ */ new Vector3();
  var _end = /* @__PURE__ */ new Vector3();
  var LineSegments = class extends Line {
    constructor(geometry, material) {
      super(geometry, material);
      this.isLineSegments = true;
      this.type = "LineSegments";
    }
    computeLineDistances() {
      const geometry = this.geometry;
      if (geometry.index === null) {
        const positionAttribute = geometry.attributes.position;
        const lineDistances = [];
        for (let i = 0, l = positionAttribute.count; i < l; i += 2) {
          _start.fromBufferAttribute(positionAttribute, i);
          _end.fromBufferAttribute(positionAttribute, i + 1);
          lineDistances[i] = i === 0 ? 0 : lineDistances[i - 1];
          lineDistances[i + 1] = lineDistances[i] + _start.distanceTo(_end);
        }
        geometry.setAttribute("lineDistance", new Float32BufferAttribute(lineDistances, 1));
      } else {
        console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
      }
      return this;
    }
  };
  var LineLoop = class extends Line {
    constructor(geometry, material) {
      super(geometry, material);
      this.isLineLoop = true;
      this.type = "LineLoop";
    }
  };
  var PointsMaterial = class extends Material {
    constructor(parameters) {
      super();
      this.isPointsMaterial = true;
      this.type = "PointsMaterial";
      this.color = new Color(16777215);
      this.map = null;
      this.alphaMap = null;
      this.size = 1;
      this.sizeAttenuation = true;
      this.fog = true;
      this.setValues(parameters);
    }
    copy(source) {
      super.copy(source);
      this.color.copy(source.color);
      this.map = source.map;
      this.alphaMap = source.alphaMap;
      this.size = source.size;
      this.sizeAttenuation = source.sizeAttenuation;
      this.fog = source.fog;
      return this;
    }
  };
  var _inverseMatrix = /* @__PURE__ */ new Matrix4();
  var _ray = /* @__PURE__ */ new Ray();
  var _sphere = /* @__PURE__ */ new Sphere();
  var _position$2 = /* @__PURE__ */ new Vector3();
  var Points = class extends Object3D {
    constructor(geometry = new BufferGeometry(), material = new PointsMaterial()) {
      super();
      this.isPoints = true;
      this.type = "Points";
      this.geometry = geometry;
      this.material = material;
      this.updateMorphTargets();
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.material = Array.isArray(source.material) ? source.material.slice() : source.material;
      this.geometry = source.geometry;
      return this;
    }
    raycast(raycaster, intersects2) {
      const geometry = this.geometry;
      const matrixWorld = this.matrixWorld;
      const threshold = raycaster.params.Points.threshold;
      const drawRange = geometry.drawRange;
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
      _sphere.copy(geometry.boundingSphere);
      _sphere.applyMatrix4(matrixWorld);
      _sphere.radius += threshold;
      if (raycaster.ray.intersectsSphere(_sphere) === false) return;
      _inverseMatrix.copy(matrixWorld).invert();
      _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
      const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
      const localThresholdSq = localThreshold * localThreshold;
      const index = geometry.index;
      const attributes = geometry.attributes;
      const positionAttribute = attributes.position;
      if (index !== null) {
        const start = Math.max(0, drawRange.start);
        const end = Math.min(index.count, drawRange.start + drawRange.count);
        for (let i = start, il = end; i < il; i++) {
          const a = index.getX(i);
          _position$2.fromBufferAttribute(positionAttribute, a);
          testPoint(_position$2, a, localThresholdSq, matrixWorld, raycaster, intersects2, this);
        }
      } else {
        const start = Math.max(0, drawRange.start);
        const end = Math.min(positionAttribute.count, drawRange.start + drawRange.count);
        for (let i = start, l = end; i < l; i++) {
          _position$2.fromBufferAttribute(positionAttribute, i);
          testPoint(_position$2, i, localThresholdSq, matrixWorld, raycaster, intersects2, this);
        }
      }
    }
    updateMorphTargets() {
      const geometry = this.geometry;
      const morphAttributes = geometry.morphAttributes;
      const keys = Object.keys(morphAttributes);
      if (keys.length > 0) {
        const morphAttribute = morphAttributes[keys[0]];
        if (morphAttribute !== void 0) {
          this.morphTargetInfluences = [];
          this.morphTargetDictionary = {};
          for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
            const name = morphAttribute[m].name || String(m);
            this.morphTargetInfluences.push(0);
            this.morphTargetDictionary[name] = m;
          }
        }
      }
    }
  };
  function testPoint(point, index, localThresholdSq, matrixWorld, raycaster, intersects2, object) {
    const rayPointDistanceSq = _ray.distanceSqToPoint(point);
    if (rayPointDistanceSq < localThresholdSq) {
      const intersectPoint = new Vector3();
      _ray.closestPointToPoint(point, intersectPoint);
      intersectPoint.applyMatrix4(matrixWorld);
      const distance = raycaster.ray.origin.distanceTo(intersectPoint);
      if (distance < raycaster.near || distance > raycaster.far) return;
      intersects2.push({
        distance,
        distanceToRay: Math.sqrt(rayPointDistanceSq),
        point: intersectPoint,
        index,
        face: null,
        object
      });
    }
  }
  var VideoTexture = class extends Texture {
    constructor(video, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy) {
      super(video, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
      this.isVideoTexture = true;
      this.minFilter = minFilter !== void 0 ? minFilter : LinearFilter;
      this.magFilter = magFilter !== void 0 ? magFilter : LinearFilter;
      this.generateMipmaps = false;
      const scope = this;
      function updateVideo() {
        scope.needsUpdate = true;
        video.requestVideoFrameCallback(updateVideo);
      }
      if ("requestVideoFrameCallback" in video) {
        video.requestVideoFrameCallback(updateVideo);
      }
    }
    clone() {
      return new this.constructor(this.image).copy(this);
    }
    update() {
      const video = this.image;
      const hasVideoFrameCallback = "requestVideoFrameCallback" in video;
      if (hasVideoFrameCallback === false && video.readyState >= video.HAVE_CURRENT_DATA) {
        this.needsUpdate = true;
      }
    }
  };
  var FramebufferTexture = class extends Texture {
    constructor(width, height) {
      super({ width, height });
      this.isFramebufferTexture = true;
      this.magFilter = NearestFilter;
      this.minFilter = NearestFilter;
      this.generateMipmaps = false;
      this.needsUpdate = true;
    }
  };
  var CompressedTexture = class extends Texture {
    constructor(mipmaps, width, height, format, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, colorSpace) {
      super(null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace);
      this.isCompressedTexture = true;
      this.image = { width, height };
      this.mipmaps = mipmaps;
      this.flipY = false;
      this.generateMipmaps = false;
    }
  };
  var CompressedArrayTexture = class extends CompressedTexture {
    constructor(mipmaps, width, height, depth, format, type) {
      super(mipmaps, width, height, format, type);
      this.isCompressedArrayTexture = true;
      this.image.depth = depth;
      this.wrapR = ClampToEdgeWrapping;
    }
  };
  var CompressedCubeTexture = class extends CompressedTexture {
    constructor(images, format, type) {
      super(void 0, images[0].width, images[0].height, format, type, CubeReflectionMapping);
      this.isCompressedCubeTexture = true;
      this.isCubeTexture = true;
      this.image = images;
    }
  };
  var CanvasTexture = class extends Texture {
    constructor(canvas, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy) {
      super(canvas, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
      this.isCanvasTexture = true;
      this.needsUpdate = true;
    }
  };
  var Curve = class {
    constructor() {
      this.type = "Curve";
      this.arcLengthDivisions = 200;
    }
    // Virtual base class method to overwrite and implement in subclasses
    //	- t [0 .. 1]
    getPoint() {
      console.warn("THREE.Curve: .getPoint() not implemented.");
      return null;
    }
    // Get point at relative position in curve according to arc length
    // - u [0 .. 1]
    getPointAt(u, optionalTarget) {
      const t = this.getUtoTmapping(u);
      return this.getPoint(t, optionalTarget);
    }
    // Get sequence of points using getPoint( t )
    getPoints(divisions = 5) {
      const points = [];
      for (let d = 0; d <= divisions; d++) {
        points.push(this.getPoint(d / divisions));
      }
      return points;
    }
    // Get sequence of points using getPointAt( u )
    getSpacedPoints(divisions = 5) {
      const points = [];
      for (let d = 0; d <= divisions; d++) {
        points.push(this.getPointAt(d / divisions));
      }
      return points;
    }
    // Get total curve arc length
    getLength() {
      const lengths = this.getLengths();
      return lengths[lengths.length - 1];
    }
    // Get list of cumulative segment lengths
    getLengths(divisions = this.arcLengthDivisions) {
      if (this.cacheArcLengths && this.cacheArcLengths.length === divisions + 1 && !this.needsUpdate) {
        return this.cacheArcLengths;
      }
      this.needsUpdate = false;
      const cache = [];
      let current, last = this.getPoint(0);
      let sum = 0;
      cache.push(0);
      for (let p = 1; p <= divisions; p++) {
        current = this.getPoint(p / divisions);
        sum += current.distanceTo(last);
        cache.push(sum);
        last = current;
      }
      this.cacheArcLengths = cache;
      return cache;
    }
    updateArcLengths() {
      this.needsUpdate = true;
      this.getLengths();
    }
    // Given u ( 0 .. 1 ), get a t to find p. This gives you points which are equidistant
    getUtoTmapping(u, distance) {
      const arcLengths = this.getLengths();
      let i = 0;
      const il = arcLengths.length;
      let targetArcLength;
      if (distance) {
        targetArcLength = distance;
      } else {
        targetArcLength = u * arcLengths[il - 1];
      }
      let low = 0, high = il - 1, comparison;
      while (low <= high) {
        i = Math.floor(low + (high - low) / 2);
        comparison = arcLengths[i] - targetArcLength;
        if (comparison < 0) {
          low = i + 1;
        } else if (comparison > 0) {
          high = i - 1;
        } else {
          high = i;
          break;
        }
      }
      i = high;
      if (arcLengths[i] === targetArcLength) {
        return i / (il - 1);
      }
      const lengthBefore = arcLengths[i];
      const lengthAfter = arcLengths[i + 1];
      const segmentLength = lengthAfter - lengthBefore;
      const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;
      const t = (i + segmentFraction) / (il - 1);
      return t;
    }
    // Returns a unit vector tangent at t
    // In case any sub curve does not implement its tangent derivation,
    // 2 points a small delta apart will be used to find its gradient
    // which seems to give a reasonable approximation
    getTangent(t, optionalTarget) {
      const delta = 1e-4;
      let t1 = t - delta;
      let t2 = t + delta;
      if (t1 < 0) t1 = 0;
      if (t2 > 1) t2 = 1;
      const pt1 = this.getPoint(t1);
      const pt2 = this.getPoint(t2);
      const tangent = optionalTarget || (pt1.isVector2 ? new Vector2() : new Vector3());
      tangent.copy(pt2).sub(pt1).normalize();
      return tangent;
    }
    getTangentAt(u, optionalTarget) {
      const t = this.getUtoTmapping(u);
      return this.getTangent(t, optionalTarget);
    }
    computeFrenetFrames(segments, closed) {
      const normal = new Vector3();
      const tangents = [];
      const normals = [];
      const binormals = [];
      const vec = new Vector3();
      const mat = new Matrix4();
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        tangents[i] = this.getTangentAt(u, new Vector3());
      }
      normals[0] = new Vector3();
      binormals[0] = new Vector3();
      let min = Number.MAX_VALUE;
      const tx = Math.abs(tangents[0].x);
      const ty = Math.abs(tangents[0].y);
      const tz = Math.abs(tangents[0].z);
      if (tx <= min) {
        min = tx;
        normal.set(1, 0, 0);
      }
      if (ty <= min) {
        min = ty;
        normal.set(0, 1, 0);
      }
      if (tz <= min) {
        normal.set(0, 0, 1);
      }
      vec.crossVectors(tangents[0], normal).normalize();
      normals[0].crossVectors(tangents[0], vec);
      binormals[0].crossVectors(tangents[0], normals[0]);
      for (let i = 1; i <= segments; i++) {
        normals[i] = normals[i - 1].clone();
        binormals[i] = binormals[i - 1].clone();
        vec.crossVectors(tangents[i - 1], tangents[i]);
        if (vec.length() > Number.EPSILON) {
          vec.normalize();
          const theta = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1));
          normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
        }
        binormals[i].crossVectors(tangents[i], normals[i]);
      }
      if (closed === true) {
        let theta = Math.acos(clamp(normals[0].dot(normals[segments]), -1, 1));
        theta /= segments;
        if (tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0) {
          theta = -theta;
        }
        for (let i = 1; i <= segments; i++) {
          normals[i].applyMatrix4(mat.makeRotationAxis(tangents[i], theta * i));
          binormals[i].crossVectors(tangents[i], normals[i]);
        }
      }
      return {
        tangents,
        normals,
        binormals
      };
    }
    clone() {
      return new this.constructor().copy(this);
    }
    copy(source) {
      this.arcLengthDivisions = source.arcLengthDivisions;
      return this;
    }
    toJSON() {
      const data = {
        metadata: {
          version: 4.6,
          type: "Curve",
          generator: "Curve.toJSON"
        }
      };
      data.arcLengthDivisions = this.arcLengthDivisions;
      data.type = this.type;
      return data;
    }
    fromJSON(json) {
      this.arcLengthDivisions = json.arcLengthDivisions;
      return this;
    }
  };
  var EllipseCurve = class extends Curve {
    constructor(aX = 0, aY = 0, xRadius = 1, yRadius = 1, aStartAngle = 0, aEndAngle = Math.PI * 2, aClockwise = false, aRotation = 0) {
      super();
      this.isEllipseCurve = true;
      this.type = "EllipseCurve";
      this.aX = aX;
      this.aY = aY;
      this.xRadius = xRadius;
      this.yRadius = yRadius;
      this.aStartAngle = aStartAngle;
      this.aEndAngle = aEndAngle;
      this.aClockwise = aClockwise;
      this.aRotation = aRotation;
    }
    getPoint(t, optionalTarget) {
      const point = optionalTarget || new Vector2();
      const twoPi = Math.PI * 2;
      let deltaAngle = this.aEndAngle - this.aStartAngle;
      const samePoints = Math.abs(deltaAngle) < Number.EPSILON;
      while (deltaAngle < 0) deltaAngle += twoPi;
      while (deltaAngle > twoPi) deltaAngle -= twoPi;
      if (deltaAngle < Number.EPSILON) {
        if (samePoints) {
          deltaAngle = 0;
        } else {
          deltaAngle = twoPi;
        }
      }
      if (this.aClockwise === true && !samePoints) {
        if (deltaAngle === twoPi) {
          deltaAngle = -twoPi;
        } else {
          deltaAngle = deltaAngle - twoPi;
        }
      }
      const angle = this.aStartAngle + t * deltaAngle;
      let x = this.aX + this.xRadius * Math.cos(angle);
      let y = this.aY + this.yRadius * Math.sin(angle);
      if (this.aRotation !== 0) {
        const cos = Math.cos(this.aRotation);
        const sin = Math.sin(this.aRotation);
        const tx = x - this.aX;
        const ty = y - this.aY;
        x = tx * cos - ty * sin + this.aX;
        y = tx * sin + ty * cos + this.aY;
      }
      return point.set(x, y);
    }
    copy(source) {
      super.copy(source);
      this.aX = source.aX;
      this.aY = source.aY;
      this.xRadius = source.xRadius;
      this.yRadius = source.yRadius;
      this.aStartAngle = source.aStartAngle;
      this.aEndAngle = source.aEndAngle;
      this.aClockwise = source.aClockwise;
      this.aRotation = source.aRotation;
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.aX = this.aX;
      data.aY = this.aY;
      data.xRadius = this.xRadius;
      data.yRadius = this.yRadius;
      data.aStartAngle = this.aStartAngle;
      data.aEndAngle = this.aEndAngle;
      data.aClockwise = this.aClockwise;
      data.aRotation = this.aRotation;
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.aX = json.aX;
      this.aY = json.aY;
      this.xRadius = json.xRadius;
      this.yRadius = json.yRadius;
      this.aStartAngle = json.aStartAngle;
      this.aEndAngle = json.aEndAngle;
      this.aClockwise = json.aClockwise;
      this.aRotation = json.aRotation;
      return this;
    }
  };
  var ArcCurve = class extends EllipseCurve {
    constructor(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
      super(aX, aY, aRadius, aRadius, aStartAngle, aEndAngle, aClockwise);
      this.isArcCurve = true;
      this.type = "ArcCurve";
    }
  };
  function CubicPoly() {
    let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
    function init(x0, x1, t0, t1) {
      c0 = x0;
      c1 = t0;
      c2 = -3 * x0 + 3 * x1 - 2 * t0 - t1;
      c3 = 2 * x0 - 2 * x1 + t0 + t1;
    }
    return {
      initCatmullRom: function(x0, x1, x2, x3, tension) {
        init(x1, x2, tension * (x2 - x0), tension * (x3 - x1));
      },
      initNonuniformCatmullRom: function(x0, x1, x2, x3, dt0, dt1, dt2) {
        let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
        let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
        t1 *= dt1;
        t2 *= dt1;
        init(x1, x2, t1, t2);
      },
      calc: function(t) {
        const t2 = t * t;
        const t3 = t2 * t;
        return c0 + c1 * t + c2 * t2 + c3 * t3;
      }
    };
  }
  var tmp = /* @__PURE__ */ new Vector3();
  var px = /* @__PURE__ */ new CubicPoly();
  var py = /* @__PURE__ */ new CubicPoly();
  var pz = /* @__PURE__ */ new CubicPoly();
  var CatmullRomCurve3 = class extends Curve {
    constructor(points = [], closed = false, curveType = "centripetal", tension = 0.5) {
      super();
      this.isCatmullRomCurve3 = true;
      this.type = "CatmullRomCurve3";
      this.points = points;
      this.closed = closed;
      this.curveType = curveType;
      this.tension = tension;
    }
    getPoint(t, optionalTarget = new Vector3()) {
      const point = optionalTarget;
      const points = this.points;
      const l = points.length;
      const p = (l - (this.closed ? 0 : 1)) * t;
      let intPoint = Math.floor(p);
      let weight = p - intPoint;
      if (this.closed) {
        intPoint += intPoint > 0 ? 0 : (Math.floor(Math.abs(intPoint) / l) + 1) * l;
      } else if (weight === 0 && intPoint === l - 1) {
        intPoint = l - 2;
        weight = 1;
      }
      let p0, p3;
      if (this.closed || intPoint > 0) {
        p0 = points[(intPoint - 1) % l];
      } else {
        tmp.subVectors(points[0], points[1]).add(points[0]);
        p0 = tmp;
      }
      const p1 = points[intPoint % l];
      const p2 = points[(intPoint + 1) % l];
      if (this.closed || intPoint + 2 < l) {
        p3 = points[(intPoint + 2) % l];
      } else {
        tmp.subVectors(points[l - 1], points[l - 2]).add(points[l - 1]);
        p3 = tmp;
      }
      if (this.curveType === "centripetal" || this.curveType === "chordal") {
        const pow = this.curveType === "chordal" ? 0.5 : 0.25;
        let dt0 = Math.pow(p0.distanceToSquared(p1), pow);
        let dt1 = Math.pow(p1.distanceToSquared(p2), pow);
        let dt2 = Math.pow(p2.distanceToSquared(p3), pow);
        if (dt1 < 1e-4) dt1 = 1;
        if (dt0 < 1e-4) dt0 = dt1;
        if (dt2 < 1e-4) dt2 = dt1;
        px.initNonuniformCatmullRom(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
        py.initNonuniformCatmullRom(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
        pz.initNonuniformCatmullRom(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
      } else if (this.curveType === "catmullrom") {
        px.initCatmullRom(p0.x, p1.x, p2.x, p3.x, this.tension);
        py.initCatmullRom(p0.y, p1.y, p2.y, p3.y, this.tension);
        pz.initCatmullRom(p0.z, p1.z, p2.z, p3.z, this.tension);
      }
      point.set(
        px.calc(weight),
        py.calc(weight),
        pz.calc(weight)
      );
      return point;
    }
    copy(source) {
      super.copy(source);
      this.points = [];
      for (let i = 0, l = source.points.length; i < l; i++) {
        const point = source.points[i];
        this.points.push(point.clone());
      }
      this.closed = source.closed;
      this.curveType = source.curveType;
      this.tension = source.tension;
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.points = [];
      for (let i = 0, l = this.points.length; i < l; i++) {
        const point = this.points[i];
        data.points.push(point.toArray());
      }
      data.closed = this.closed;
      data.curveType = this.curveType;
      data.tension = this.tension;
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.points = [];
      for (let i = 0, l = json.points.length; i < l; i++) {
        const point = json.points[i];
        this.points.push(new Vector3().fromArray(point));
      }
      this.closed = json.closed;
      this.curveType = json.curveType;
      this.tension = json.tension;
      return this;
    }
  };
  function CatmullRom(t, p0, p1, p2, p3) {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
  }
  function QuadraticBezierP0(t, p) {
    const k = 1 - t;
    return k * k * p;
  }
  function QuadraticBezierP1(t, p) {
    return 2 * (1 - t) * t * p;
  }
  function QuadraticBezierP2(t, p) {
    return t * t * p;
  }
  function QuadraticBezier(t, p0, p1, p2) {
    return QuadraticBezierP0(t, p0) + QuadraticBezierP1(t, p1) + QuadraticBezierP2(t, p2);
  }
  function CubicBezierP0(t, p) {
    const k = 1 - t;
    return k * k * k * p;
  }
  function CubicBezierP1(t, p) {
    const k = 1 - t;
    return 3 * k * k * t * p;
  }
  function CubicBezierP2(t, p) {
    return 3 * (1 - t) * t * t * p;
  }
  function CubicBezierP3(t, p) {
    return t * t * t * p;
  }
  function CubicBezier(t, p0, p1, p2, p3) {
    return CubicBezierP0(t, p0) + CubicBezierP1(t, p1) + CubicBezierP2(t, p2) + CubicBezierP3(t, p3);
  }
  var CubicBezierCurve = class extends Curve {
    constructor(v0 = new Vector2(), v1 = new Vector2(), v2 = new Vector2(), v3 = new Vector2()) {
      super();
      this.isCubicBezierCurve = true;
      this.type = "CubicBezierCurve";
      this.v0 = v0;
      this.v1 = v1;
      this.v2 = v2;
      this.v3 = v3;
    }
    getPoint(t, optionalTarget = new Vector2()) {
      const point = optionalTarget;
      const v0 = this.v0, v1 = this.v1, v2 = this.v2, v3 = this.v3;
      point.set(
        CubicBezier(t, v0.x, v1.x, v2.x, v3.x),
        CubicBezier(t, v0.y, v1.y, v2.y, v3.y)
      );
      return point;
    }
    copy(source) {
      super.copy(source);
      this.v0.copy(source.v0);
      this.v1.copy(source.v1);
      this.v2.copy(source.v2);
      this.v3.copy(source.v3);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.v0 = this.v0.toArray();
      data.v1 = this.v1.toArray();
      data.v2 = this.v2.toArray();
      data.v3 = this.v3.toArray();
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.v0.fromArray(json.v0);
      this.v1.fromArray(json.v1);
      this.v2.fromArray(json.v2);
      this.v3.fromArray(json.v3);
      return this;
    }
  };
  var CubicBezierCurve3 = class extends Curve {
    constructor(v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3()) {
      super();
      this.isCubicBezierCurve3 = true;
      this.type = "CubicBezierCurve3";
      this.v0 = v0;
      this.v1 = v1;
      this.v2 = v2;
      this.v3 = v3;
    }
    getPoint(t, optionalTarget = new Vector3()) {
      const point = optionalTarget;
      const v0 = this.v0, v1 = this.v1, v2 = this.v2, v3 = this.v3;
      point.set(
        CubicBezier(t, v0.x, v1.x, v2.x, v3.x),
        CubicBezier(t, v0.y, v1.y, v2.y, v3.y),
        CubicBezier(t, v0.z, v1.z, v2.z, v3.z)
      );
      return point;
    }
    copy(source) {
      super.copy(source);
      this.v0.copy(source.v0);
      this.v1.copy(source.v1);
      this.v2.copy(source.v2);
      this.v3.copy(source.v3);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.v0 = this.v0.toArray();
      data.v1 = this.v1.toArray();
      data.v2 = this.v2.toArray();
      data.v3 = this.v3.toArray();
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.v0.fromArray(json.v0);
      this.v1.fromArray(json.v1);
      this.v2.fromArray(json.v2);
      this.v3.fromArray(json.v3);
      return this;
    }
  };
  var LineCurve = class extends Curve {
    constructor(v1 = new Vector2(), v2 = new Vector2()) {
      super();
      this.isLineCurve = true;
      this.type = "LineCurve";
      this.v1 = v1;
      this.v2 = v2;
    }
    getPoint(t, optionalTarget = new Vector2()) {
      const point = optionalTarget;
      if (t === 1) {
        point.copy(this.v2);
      } else {
        point.copy(this.v2).sub(this.v1);
        point.multiplyScalar(t).add(this.v1);
      }
      return point;
    }
    // Line curve is linear, so we can overwrite default getPointAt
    getPointAt(u, optionalTarget) {
      return this.getPoint(u, optionalTarget);
    }
    getTangent(t, optionalTarget = new Vector2()) {
      return optionalTarget.subVectors(this.v2, this.v1).normalize();
    }
    getTangentAt(u, optionalTarget) {
      return this.getTangent(u, optionalTarget);
    }
    copy(source) {
      super.copy(source);
      this.v1.copy(source.v1);
      this.v2.copy(source.v2);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.v1 = this.v1.toArray();
      data.v2 = this.v2.toArray();
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.v1.fromArray(json.v1);
      this.v2.fromArray(json.v2);
      return this;
    }
  };
  var LineCurve3 = class extends Curve {
    constructor(v1 = new Vector3(), v2 = new Vector3()) {
      super();
      this.isLineCurve3 = true;
      this.type = "LineCurve3";
      this.v1 = v1;
      this.v2 = v2;
    }
    getPoint(t, optionalTarget = new Vector3()) {
      const point = optionalTarget;
      if (t === 1) {
        point.copy(this.v2);
      } else {
        point.copy(this.v2).sub(this.v1);
        point.multiplyScalar(t).add(this.v1);
      }
      return point;
    }
    // Line curve is linear, so we can overwrite default getPointAt
    getPointAt(u, optionalTarget) {
      return this.getPoint(u, optionalTarget);
    }
    getTangent(t, optionalTarget = new Vector3()) {
      return optionalTarget.subVectors(this.v2, this.v1).normalize();
    }
    getTangentAt(u, optionalTarget) {
      return this.getTangent(u, optionalTarget);
    }
    copy(source) {
      super.copy(source);
      this.v1.copy(source.v1);
      this.v2.copy(source.v2);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.v1 = this.v1.toArray();
      data.v2 = this.v2.toArray();
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.v1.fromArray(json.v1);
      this.v2.fromArray(json.v2);
      return this;
    }
  };
  var QuadraticBezierCurve = class extends Curve {
    constructor(v0 = new Vector2(), v1 = new Vector2(), v2 = new Vector2()) {
      super();
      this.isQuadraticBezierCurve = true;
      this.type = "QuadraticBezierCurve";
      this.v0 = v0;
      this.v1 = v1;
      this.v2 = v2;
    }
    getPoint(t, optionalTarget = new Vector2()) {
      const point = optionalTarget;
      const v0 = this.v0, v1 = this.v1, v2 = this.v2;
      point.set(
        QuadraticBezier(t, v0.x, v1.x, v2.x),
        QuadraticBezier(t, v0.y, v1.y, v2.y)
      );
      return point;
    }
    copy(source) {
      super.copy(source);
      this.v0.copy(source.v0);
      this.v1.copy(source.v1);
      this.v2.copy(source.v2);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.v0 = this.v0.toArray();
      data.v1 = this.v1.toArray();
      data.v2 = this.v2.toArray();
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.v0.fromArray(json.v0);
      this.v1.fromArray(json.v1);
      this.v2.fromArray(json.v2);
      return this;
    }
  };
  var QuadraticBezierCurve3 = class extends Curve {
    constructor(v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3()) {
      super();
      this.isQuadraticBezierCurve3 = true;
      this.type = "QuadraticBezierCurve3";
      this.v0 = v0;
      this.v1 = v1;
      this.v2 = v2;
    }
    getPoint(t, optionalTarget = new Vector3()) {
      const point = optionalTarget;
      const v0 = this.v0, v1 = this.v1, v2 = this.v2;
      point.set(
        QuadraticBezier(t, v0.x, v1.x, v2.x),
        QuadraticBezier(t, v0.y, v1.y, v2.y),
        QuadraticBezier(t, v0.z, v1.z, v2.z)
      );
      return point;
    }
    copy(source) {
      super.copy(source);
      this.v0.copy(source.v0);
      this.v1.copy(source.v1);
      this.v2.copy(source.v2);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.v0 = this.v0.toArray();
      data.v1 = this.v1.toArray();
      data.v2 = this.v2.toArray();
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.v0.fromArray(json.v0);
      this.v1.fromArray(json.v1);
      this.v2.fromArray(json.v2);
      return this;
    }
  };
  var SplineCurve = class extends Curve {
    constructor(points = []) {
      super();
      this.isSplineCurve = true;
      this.type = "SplineCurve";
      this.points = points;
    }
    getPoint(t, optionalTarget = new Vector2()) {
      const point = optionalTarget;
      const points = this.points;
      const p = (points.length - 1) * t;
      const intPoint = Math.floor(p);
      const weight = p - intPoint;
      const p0 = points[intPoint === 0 ? intPoint : intPoint - 1];
      const p1 = points[intPoint];
      const p2 = points[intPoint > points.length - 2 ? points.length - 1 : intPoint + 1];
      const p3 = points[intPoint > points.length - 3 ? points.length - 1 : intPoint + 2];
      point.set(
        CatmullRom(weight, p0.x, p1.x, p2.x, p3.x),
        CatmullRom(weight, p0.y, p1.y, p2.y, p3.y)
      );
      return point;
    }
    copy(source) {
      super.copy(source);
      this.points = [];
      for (let i = 0, l = source.points.length; i < l; i++) {
        const point = source.points[i];
        this.points.push(point.clone());
      }
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.points = [];
      for (let i = 0, l = this.points.length; i < l; i++) {
        const point = this.points[i];
        data.points.push(point.toArray());
      }
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.points = [];
      for (let i = 0, l = json.points.length; i < l; i++) {
        const point = json.points[i];
        this.points.push(new Vector2().fromArray(point));
      }
      return this;
    }
  };
  var Curves = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    ArcCurve,
    CatmullRomCurve3,
    CubicBezierCurve,
    CubicBezierCurve3,
    EllipseCurve,
    LineCurve,
    LineCurve3,
    QuadraticBezierCurve,
    QuadraticBezierCurve3,
    SplineCurve
  });
  var CurvePath = class extends Curve {
    constructor() {
      super();
      this.type = "CurvePath";
      this.curves = [];
      this.autoClose = false;
    }
    add(curve) {
      this.curves.push(curve);
    }
    closePath() {
      const startPoint = this.curves[0].getPoint(0);
      const endPoint = this.curves[this.curves.length - 1].getPoint(1);
      if (!startPoint.equals(endPoint)) {
        const lineType = startPoint.isVector2 === true ? "LineCurve" : "LineCurve3";
        this.curves.push(new Curves[lineType](endPoint, startPoint));
      }
      return this;
    }
    // To get accurate point with reference to
    // entire path distance at time t,
    // following has to be done:
    // 1. Length of each sub path have to be known
    // 2. Locate and identify type of curve
    // 3. Get t for the curve
    // 4. Return curve.getPointAt(t')
    getPoint(t, optionalTarget) {
      const d = t * this.getLength();
      const curveLengths = this.getCurveLengths();
      let i = 0;
      while (i < curveLengths.length) {
        if (curveLengths[i] >= d) {
          const diff = curveLengths[i] - d;
          const curve = this.curves[i];
          const segmentLength = curve.getLength();
          const u = segmentLength === 0 ? 0 : 1 - diff / segmentLength;
          return curve.getPointAt(u, optionalTarget);
        }
        i++;
      }
      return null;
    }
    // We cannot use the default THREE.Curve getPoint() with getLength() because in
    // THREE.Curve, getLength() depends on getPoint() but in THREE.CurvePath
    // getPoint() depends on getLength
    getLength() {
      const lens = this.getCurveLengths();
      return lens[lens.length - 1];
    }
    // cacheLengths must be recalculated.
    updateArcLengths() {
      this.needsUpdate = true;
      this.cacheLengths = null;
      this.getCurveLengths();
    }
    // Compute lengths and cache them
    // We cannot overwrite getLengths() because UtoT mapping uses it.
    getCurveLengths() {
      if (this.cacheLengths && this.cacheLengths.length === this.curves.length) {
        return this.cacheLengths;
      }
      const lengths = [];
      let sums = 0;
      for (let i = 0, l = this.curves.length; i < l; i++) {
        sums += this.curves[i].getLength();
        lengths.push(sums);
      }
      this.cacheLengths = lengths;
      return lengths;
    }
    getSpacedPoints(divisions = 40) {
      const points = [];
      for (let i = 0; i <= divisions; i++) {
        points.push(this.getPoint(i / divisions));
      }
      if (this.autoClose) {
        points.push(points[0]);
      }
      return points;
    }
    getPoints(divisions = 12) {
      const points = [];
      let last;
      for (let i = 0, curves = this.curves; i < curves.length; i++) {
        const curve = curves[i];
        const resolution = curve.isEllipseCurve ? divisions * 2 : curve.isLineCurve || curve.isLineCurve3 ? 1 : curve.isSplineCurve ? divisions * curve.points.length : divisions;
        const pts = curve.getPoints(resolution);
        for (let j = 0; j < pts.length; j++) {
          const point = pts[j];
          if (last && last.equals(point)) continue;
          points.push(point);
          last = point;
        }
      }
      if (this.autoClose && points.length > 1 && !points[points.length - 1].equals(points[0])) {
        points.push(points[0]);
      }
      return points;
    }
    copy(source) {
      super.copy(source);
      this.curves = [];
      for (let i = 0, l = source.curves.length; i < l; i++) {
        const curve = source.curves[i];
        this.curves.push(curve.clone());
      }
      this.autoClose = source.autoClose;
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.autoClose = this.autoClose;
      data.curves = [];
      for (let i = 0, l = this.curves.length; i < l; i++) {
        const curve = this.curves[i];
        data.curves.push(curve.toJSON());
      }
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.autoClose = json.autoClose;
      this.curves = [];
      for (let i = 0, l = json.curves.length; i < l; i++) {
        const curve = json.curves[i];
        this.curves.push(new Curves[curve.type]().fromJSON(curve));
      }
      return this;
    }
  };
  var Path = class extends CurvePath {
    constructor(points) {
      super();
      this.type = "Path";
      this.currentPoint = new Vector2();
      if (points) {
        this.setFromPoints(points);
      }
    }
    setFromPoints(points) {
      this.moveTo(points[0].x, points[0].y);
      for (let i = 1, l = points.length; i < l; i++) {
        this.lineTo(points[i].x, points[i].y);
      }
      return this;
    }
    moveTo(x, y) {
      this.currentPoint.set(x, y);
      return this;
    }
    lineTo(x, y) {
      const curve = new LineCurve(this.currentPoint.clone(), new Vector2(x, y));
      this.curves.push(curve);
      this.currentPoint.set(x, y);
      return this;
    }
    quadraticCurveTo(aCPx, aCPy, aX, aY) {
      const curve = new QuadraticBezierCurve(
        this.currentPoint.clone(),
        new Vector2(aCPx, aCPy),
        new Vector2(aX, aY)
      );
      this.curves.push(curve);
      this.currentPoint.set(aX, aY);
      return this;
    }
    bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY) {
      const curve = new CubicBezierCurve(
        this.currentPoint.clone(),
        new Vector2(aCP1x, aCP1y),
        new Vector2(aCP2x, aCP2y),
        new Vector2(aX, aY)
      );
      this.curves.push(curve);
      this.currentPoint.set(aX, aY);
      return this;
    }
    splineThru(pts) {
      const npts = [this.currentPoint.clone()].concat(pts);
      const curve = new SplineCurve(npts);
      this.curves.push(curve);
      this.currentPoint.copy(pts[pts.length - 1]);
      return this;
    }
    arc(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
      const x0 = this.currentPoint.x;
      const y0 = this.currentPoint.y;
      this.absarc(
        aX + x0,
        aY + y0,
        aRadius,
        aStartAngle,
        aEndAngle,
        aClockwise
      );
      return this;
    }
    absarc(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
      this.absellipse(aX, aY, aRadius, aRadius, aStartAngle, aEndAngle, aClockwise);
      return this;
    }
    ellipse(aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation) {
      const x0 = this.currentPoint.x;
      const y0 = this.currentPoint.y;
      this.absellipse(aX + x0, aY + y0, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation);
      return this;
    }
    absellipse(aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation) {
      const curve = new EllipseCurve(aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation);
      if (this.curves.length > 0) {
        const firstPoint = curve.getPoint(0);
        if (!firstPoint.equals(this.currentPoint)) {
          this.lineTo(firstPoint.x, firstPoint.y);
        }
      }
      this.curves.push(curve);
      const lastPoint = curve.getPoint(1);
      this.currentPoint.copy(lastPoint);
      return this;
    }
    copy(source) {
      super.copy(source);
      this.currentPoint.copy(source.currentPoint);
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.currentPoint = this.currentPoint.toArray();
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.currentPoint.fromArray(json.currentPoint);
      return this;
    }
  };
  var LatheGeometry = class _LatheGeometry extends BufferGeometry {
    constructor(points = [new Vector2(0, -0.5), new Vector2(0.5, 0), new Vector2(0, 0.5)], segments = 12, phiStart = 0, phiLength = Math.PI * 2) {
      super();
      this.type = "LatheGeometry";
      this.parameters = {
        points,
        segments,
        phiStart,
        phiLength
      };
      segments = Math.floor(segments);
      phiLength = clamp(phiLength, 0, Math.PI * 2);
      const indices = [];
      const vertices = [];
      const uvs = [];
      const initNormals = [];
      const normals = [];
      const inverseSegments = 1 / segments;
      const vertex2 = new Vector3();
      const uv = new Vector2();
      const normal = new Vector3();
      const curNormal = new Vector3();
      const prevNormal = new Vector3();
      let dx = 0;
      let dy = 0;
      for (let j = 0; j <= points.length - 1; j++) {
        switch (j) {
          case 0:
            dx = points[j + 1].x - points[j].x;
            dy = points[j + 1].y - points[j].y;
            normal.x = dy * 1;
            normal.y = -dx;
            normal.z = dy * 0;
            prevNormal.copy(normal);
            normal.normalize();
            initNormals.push(normal.x, normal.y, normal.z);
            break;
          case points.length - 1:
            initNormals.push(prevNormal.x, prevNormal.y, prevNormal.z);
            break;
          default:
            dx = points[j + 1].x - points[j].x;
            dy = points[j + 1].y - points[j].y;
            normal.x = dy * 1;
            normal.y = -dx;
            normal.z = dy * 0;
            curNormal.copy(normal);
            normal.x += prevNormal.x;
            normal.y += prevNormal.y;
            normal.z += prevNormal.z;
            normal.normalize();
            initNormals.push(normal.x, normal.y, normal.z);
            prevNormal.copy(curNormal);
        }
      }
      for (let i = 0; i <= segments; i++) {
        const phi = phiStart + i * inverseSegments * phiLength;
        const sin = Math.sin(phi);
        const cos = Math.cos(phi);
        for (let j = 0; j <= points.length - 1; j++) {
          vertex2.x = points[j].x * sin;
          vertex2.y = points[j].y;
          vertex2.z = points[j].x * cos;
          vertices.push(vertex2.x, vertex2.y, vertex2.z);
          uv.x = i / segments;
          uv.y = j / (points.length - 1);
          uvs.push(uv.x, uv.y);
          const x = initNormals[3 * j + 0] * sin;
          const y = initNormals[3 * j + 1];
          const z = initNormals[3 * j + 0] * cos;
          normals.push(x, y, z);
        }
      }
      for (let i = 0; i < segments; i++) {
        for (let j = 0; j < points.length - 1; j++) {
          const base = j + i * points.length;
          const a = base;
          const b = base + points.length;
          const c = base + points.length + 1;
          const d = base + 1;
          indices.push(a, b, d);
          indices.push(c, d, b);
        }
      }
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    static fromJSON(data) {
      return new _LatheGeometry(data.points, data.segments, data.phiStart, data.phiLength);
    }
  };
  var CapsuleGeometry = class _CapsuleGeometry extends LatheGeometry {
    constructor(radius = 1, length = 1, capSegments = 4, radialSegments = 8) {
      const path = new Path();
      path.absarc(0, -length / 2, radius, Math.PI * 1.5, 0);
      path.absarc(0, length / 2, radius, 0, Math.PI * 0.5);
      super(path.getPoints(capSegments), radialSegments);
      this.type = "CapsuleGeometry";
      this.parameters = {
        radius,
        length,
        capSegments,
        radialSegments
      };
    }
    static fromJSON(data) {
      return new _CapsuleGeometry(data.radius, data.length, data.capSegments, data.radialSegments);
    }
  };
  var CircleGeometry = class _CircleGeometry extends BufferGeometry {
    constructor(radius = 1, segments = 32, thetaStart = 0, thetaLength = Math.PI * 2) {
      super();
      this.type = "CircleGeometry";
      this.parameters = {
        radius,
        segments,
        thetaStart,
        thetaLength
      };
      segments = Math.max(3, segments);
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      const vertex2 = new Vector3();
      const uv = new Vector2();
      vertices.push(0, 0, 0);
      normals.push(0, 0, 1);
      uvs.push(0.5, 0.5);
      for (let s = 0, i = 3; s <= segments; s++, i += 3) {
        const segment = thetaStart + s / segments * thetaLength;
        vertex2.x = radius * Math.cos(segment);
        vertex2.y = radius * Math.sin(segment);
        vertices.push(vertex2.x, vertex2.y, vertex2.z);
        normals.push(0, 0, 1);
        uv.x = (vertices[i] / radius + 1) / 2;
        uv.y = (vertices[i + 1] / radius + 1) / 2;
        uvs.push(uv.x, uv.y);
      }
      for (let i = 1; i <= segments; i++) {
        indices.push(i, i + 1, 0);
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
      return new _CircleGeometry(data.radius, data.segments, data.thetaStart, data.thetaLength);
    }
  };
  var CylinderGeometry = class _CylinderGeometry extends BufferGeometry {
    constructor(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2) {
      super();
      this.type = "CylinderGeometry";
      this.parameters = {
        radiusTop,
        radiusBottom,
        height,
        radialSegments,
        heightSegments,
        openEnded,
        thetaStart,
        thetaLength
      };
      const scope = this;
      radialSegments = Math.floor(radialSegments);
      heightSegments = Math.floor(heightSegments);
      const indices = [];
      const vertices = [];
      const normals = [];
      const uvs = [];
      let index = 0;
      const indexArray = [];
      const halfHeight = height / 2;
      let groupStart = 0;
      generateTorso();
      if (openEnded === false) {
        if (radiusTop > 0) generateCap(true);
        if (radiusBottom > 0) generateCap(false);
      }
      this.setIndex(indices);
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      function generateTorso() {
        const normal = new Vector3();
        const vertex2 = new Vector3();
        let groupCount = 0;
        const slope = (radiusBottom - radiusTop) / height;
        for (let y = 0; y <= heightSegments; y++) {
          const indexRow = [];
          const v = y / heightSegments;
          const radius = v * (radiusBottom - radiusTop) + radiusTop;
          for (let x = 0; x <= radialSegments; x++) {
            const u = x / radialSegments;
            const theta = u * thetaLength + thetaStart;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            vertex2.x = radius * sinTheta;
            vertex2.y = -v * height + halfHeight;
            vertex2.z = radius * cosTheta;
            vertices.push(vertex2.x, vertex2.y, vertex2.z);
            normal.set(sinTheta, slope, cosTheta).normalize();
            normals.push(normal.x, normal.y, normal.z);
            uvs.push(u, 1 - v);
            indexRow.push(index++);
          }
          indexArray.push(indexRow);
        }
        for (let x = 0; x < radialSegments; x++) {
          for (let y = 0; y < heightSegments; y++) {
            const a = indexArray[y][x];
            const b = indexArray[y + 1][x];
            const c = indexArray[y + 1][x + 1];
            const d = indexArray[y][x + 1];
            indices.push(a, b, d);
            indices.push(b, c, d);
            groupCount += 6;
          }
        }
        scope.addGroup(groupStart, groupCount, 0);
        groupStart += groupCount;
      }
      function generateCap(top) {
        const centerIndexStart = index;
        const uv = new Vector2();
        const vertex2 = new Vector3();
        let groupCount = 0;
        const radius = top === true ? radiusTop : radiusBottom;
        const sign2 = top === true ? 1 : -1;
        for (let x = 1; x <= radialSegments; x++) {
          vertices.push(0, halfHeight * sign2, 0);
          normals.push(0, sign2, 0);
          uvs.push(0.5, 0.5);
          index++;
        }
        const centerIndexEnd = index;
        for (let x = 0; x <= radialSegments; x++) {
          const u = x / radialSegments;
          const theta = u * thetaLength + thetaStart;
          const cosTheta = Math.cos(theta);
          const sinTheta = Math.sin(theta);
          vertex2.x = radius * sinTheta;
          vertex2.y = halfHeight * sign2;
          vertex2.z = radius * cosTheta;
          vertices.push(vertex2.x, vertex2.y, vertex2.z);
          normals.push(0, sign2, 0);
          uv.x = cosTheta * 0.5 + 0.5;
          uv.y = sinTheta * 0.5 * sign2 + 0.5;
          uvs.push(uv.x, uv.y);
          index++;
        }
        for (let x = 0; x < radialSegments; x++) {
          const c = centerIndexStart + x;
          const i = centerIndexEnd + x;
          if (top === true) {
            indices.push(i, i + 1, c);
          } else {
            indices.push(i + 1, i, c);
          }
          groupCount += 3;
        }
        scope.addGroup(groupStart, groupCount, top === true ? 1 : 2);
        groupStart += groupCount;
      }
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    static fromJSON(data) {
      return new _CylinderGeometry(data.radiusTop, data.radiusBottom, data.height, data.radialSegments, data.heightSegments, data.openEnded, data.thetaStart, data.thetaLength);
    }
  };
  var ConeGeometry = class _ConeGeometry extends CylinderGeometry {
    constructor(radius = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2) {
      super(0, radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength);
      this.type = "ConeGeometry";
      this.parameters = {
        radius,
        height,
        radialSegments,
        heightSegments,
        openEnded,
        thetaStart,
        thetaLength
      };
    }
    static fromJSON(data) {
      return new _ConeGeometry(data.radius, data.height, data.radialSegments, data.heightSegments, data.openEnded, data.thetaStart, data.thetaLength);
    }
  };
  var PolyhedronGeometry = class _PolyhedronGeometry extends BufferGeometry {
    constructor(vertices = [], indices = [], radius = 1, detail = 0) {
      super();
      this.type = "PolyhedronGeometry";
      this.parameters = {
        vertices,
        indices,
        radius,
        detail
      };
      const vertexBuffer = [];
      const uvBuffer = [];
      subdivide(detail);
      applyRadius(radius);
      generateUVs();
      this.setAttribute("position", new Float32BufferAttribute(vertexBuffer, 3));
      this.setAttribute("normal", new Float32BufferAttribute(vertexBuffer.slice(), 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvBuffer, 2));
      if (detail === 0) {
        this.computeVertexNormals();
      } else {
        this.normalizeNormals();
      }
      function subdivide(detail2) {
        const a = new Vector3();
        const b = new Vector3();
        const c = new Vector3();
        for (let i = 0; i < indices.length; i += 3) {
          getVertexByIndex(indices[i + 0], a);
          getVertexByIndex(indices[i + 1], b);
          getVertexByIndex(indices[i + 2], c);
          subdivideFace(a, b, c, detail2);
        }
      }
      function subdivideFace(a, b, c, detail2) {
        const cols = detail2 + 1;
        const v = [];
        for (let i = 0; i <= cols; i++) {
          v[i] = [];
          const aj = a.clone().lerp(c, i / cols);
          const bj = b.clone().lerp(c, i / cols);
          const rows = cols - i;
          for (let j = 0; j <= rows; j++) {
            if (j === 0 && i === cols) {
              v[i][j] = aj;
            } else {
              v[i][j] = aj.clone().lerp(bj, j / rows);
            }
          }
        }
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < 2 * (cols - i) - 1; j++) {
            const k = Math.floor(j / 2);
            if (j % 2 === 0) {
              pushVertex(v[i][k + 1]);
              pushVertex(v[i + 1][k]);
              pushVertex(v[i][k]);
            } else {
              pushVertex(v[i][k + 1]);
              pushVertex(v[i + 1][k + 1]);
              pushVertex(v[i + 1][k]);
            }
          }
        }
      }
      function applyRadius(radius2) {
        const vertex2 = new Vector3();
        for (let i = 0; i < vertexBuffer.length; i += 3) {
          vertex2.x = vertexBuffer[i + 0];
          vertex2.y = vertexBuffer[i + 1];
          vertex2.z = vertexBuffer[i + 2];
          vertex2.normalize().multiplyScalar(radius2);
          vertexBuffer[i + 0] = vertex2.x;
          vertexBuffer[i + 1] = vertex2.y;
          vertexBuffer[i + 2] = vertex2.z;
        }
      }
      function generateUVs() {
        const vertex2 = new Vector3();
        for (let i = 0; i < vertexBuffer.length; i += 3) {
          vertex2.x = vertexBuffer[i + 0];
          vertex2.y = vertexBuffer[i + 1];
          vertex2.z = vertexBuffer[i + 2];
          const u = azimuth(vertex2) / 2 / Math.PI + 0.5;
          const v = inclination(vertex2) / Math.PI + 0.5;
          uvBuffer.push(u, 1 - v);
        }
        correctUVs();
        correctSeam();
      }
      function correctSeam() {
        for (let i = 0; i < uvBuffer.length; i += 6) {
          const x0 = uvBuffer[i + 0];
          const x1 = uvBuffer[i + 2];
          const x2 = uvBuffer[i + 4];
          const max = Math.max(x0, x1, x2);
          const min = Math.min(x0, x1, x2);
          if (max > 0.9 && min < 0.1) {
            if (x0 < 0.2) uvBuffer[i + 0] += 1;
            if (x1 < 0.2) uvBuffer[i + 2] += 1;
            if (x2 < 0.2) uvBuffer[i + 4] += 1;
          }
        }
      }
      function pushVertex(vertex2) {
        vertexBuffer.push(vertex2.x, vertex2.y, vertex2.z);
      }
      function getVertexByIndex(index, vertex2) {
        const stride = index * 3;
        vertex2.x = vertices[stride + 0];
        vertex2.y = vertices[stride + 1];
        vertex2.z = vertices[stride + 2];
      }
      function correctUVs() {
        const a = new Vector3();
        const b = new Vector3();
        const c = new Vector3();
        const centroid = new Vector3();
        const uvA = new Vector2();
        const uvB = new Vector2();
        const uvC = new Vector2();
        for (let i = 0, j = 0; i < vertexBuffer.length; i += 9, j += 6) {
          a.set(vertexBuffer[i + 0], vertexBuffer[i + 1], vertexBuffer[i + 2]);
          b.set(vertexBuffer[i + 3], vertexBuffer[i + 4], vertexBuffer[i + 5]);
          c.set(vertexBuffer[i + 6], vertexBuffer[i + 7], vertexBuffer[i + 8]);
          uvA.set(uvBuffer[j + 0], uvBuffer[j + 1]);
          uvB.set(uvBuffer[j + 2], uvBuffer[j + 3]);
          uvC.set(uvBuffer[j + 4], uvBuffer[j + 5]);
          centroid.copy(a).add(b).add(c).divideScalar(3);
          const azi = azimuth(centroid);
          correctUV(uvA, j + 0, a, azi);
          correctUV(uvB, j + 2, b, azi);
          correctUV(uvC, j + 4, c, azi);
        }
      }
      function correctUV(uv, stride, vector, azimuth2) {
        if (azimuth2 < 0 && uv.x === 1) {
          uvBuffer[stride] = uv.x - 1;
        }
        if (vector.x === 0 && vector.z === 0) {
          uvBuffer[stride] = azimuth2 / 2 / Math.PI + 0.5;
        }
      }
      function azimuth(vector) {
        return Math.atan2(vector.z, -vector.x);
      }
      function inclination(vector) {
        return Math.atan2(-vector.y, Math.sqrt(vector.x * vector.x + vector.z * vector.z));
      }
    }
    copy(source) {
      super.copy(source);
      this.parameters = Object.assign({}, source.parameters);
      return this;
    }
    static fromJSON(data) {
      return new _PolyhedronGeometry(data.vertices, data.indices, data.radius, data.details);
    }
  };
  var DodecahedronGeometry = class _DodecahedronGeometry extends PolyhedronGeometry {
    constructor(radius = 1, detail = 0) {
      const t = (1 + Math.sqrt(5)) / 2;
      const r = 1 / t;
      const vertices = [
        // (±1, ±1, ±1)
        -1,
        -1,
        -1,
        -1,
        -1,
        1,
        -1,
        1,
        -1,
        -1,
        1,
        1,
        1,
        -1,
        -1,
        1,
        -1,
        1,
        1,
        1,
        -1,
        1,
        1,
        1,
        // (0, ±1/φ, ±φ)
        0,
        -r,
        -t,
        0,
        -r,
        t,
        0,
        r,
        -t,
        0,
        r,
        t,
        // (±1/φ, ±φ, 0)
        -r,
        -t,
        0,
        -r,
        t,
        0,
        r,
        -t,
        0,
        r,
        t,
        0,
        // (±φ, 0, ±1/φ)
        -t,
        0,
        -r,
        t,
        0,
        -r,
        -t,
        0,
        r,
        t,
        0,
        r
      ];
      const indices = [
        3,
        11,
        7,
        3,
        7,
        15,
        3,
        15,
        13,
        7,
        19,
        17,
        7,
        17,
        6,
        7,
        6,
        15,
        17,
        4,
        8,
        17,
        8,
        10,
        17,
        10,
        6,
        8,
        0,
        16,
        8,
        16,
        2,
        8,
        2,
        10,
        0,
        12,
        1,
        0,
        1,
        18,
        0,
        18,
        16,
        6,
        10,
        2,
        6,
        2,
        13,
        6,
        13,
        15,
        2,
        16,
        18,
        2,
        18,
        3,
        2,
        3,
        13,
        18,
        1,
        9,
        18,
        9,
        11,
        18,
        11,
        3,
        4,
        14,
        12,
        4,
        12,
        0,
        4,
        0,
        8,
        11,
        9,
        5,
        11,
        5,
        19,
        11,
        19,
        7,
        19,
        5,
        14,
        19,
        14,
        4,
        19,
        4,
        17,
        1,
        12,
        14,
        1,
        14,
        5,
        1,
        5,
        9
      ];
      super(vertices, indices, radius, detail);
      this.type = "DodecahedronGeometry";
      this.parameters = {
        radius,
        detail
      };
    }
    static fromJSON(data) {
      return new _DodecahedronGeometry(data.radius, data.detail);
    }
  };
  var _v0 = /* @__PURE__ */ new Vector3();
  var _v1$1 = /* @__PURE__ */ new Vector3();
  var _normal = /* @__PURE__ */ new Vector3();
  var _triangle = /* @__PURE__ */ new Triangle();
  var EdgesGeometry = class extends BufferGeometry {
    constructor(geometry = null, thresholdAngle = 1) {
      super();
      this.type = "EdgesGeometry";
      this.parameters = {
        geometry,
        thresholdAngle
      };
      if (geometry !== null) {
        const precisionPoints = 4;
        const precision = Math.pow(10, precisionPoints);
        const thresholdDot = Math.cos(DEG2RAD * thresholdAngle);
        const indexAttr = geometry.getIndex();
        const positionAttr = geometry.getAttribute("position");
        const indexCount = indexAttr ? indexAttr.count : positionAttr.count;
        const indexArr = [0, 0, 0];
        const vertKeys = ["a", "b", "c"];
        const hashes = new Array(3);
        const edgeData = {};
        const vertices = [];
        for (let i = 0; i < indexCount; i += 3) {
          if (indexAttr) {
            indexArr[0] = indexAttr.getX(i);
            indexArr[1] = indexAttr.getX(i + 1);
            indexArr[2] = indexAttr.getX(i + 2);
          } else {
            indexArr[0] = i;
            indexArr[1] = i + 1;
            indexArr[2] = i + 2;
          }
          const { a, b, c } = _triangle;
          a.fromBufferAttribute(positionAttr, indexArr[0]);
          b.fromBufferAttribute(positionAttr, indexArr[1]);
          c.fromBufferAttribute(positionAttr, indexArr[2]);
          _triangle.getNormal(_normal);
          hashes[0] = `${Math.round(a.x * precision)},${Math.round(a.y * precision)},${Math.round(a.z * precision)}`;
          hashes[1] = `${Math.round(b.x * precision)},${Math.round(b.y * precision)},${Math.round(b.z * precision)}`;
          hashes[2] = `${Math.round(c.x * precision)},${Math.round(c.y * precision)},${Math.round(c.z * precision)}`;
          if (hashes[0] === hashes[1] || hashes[1] === hashes[2] || hashes[2] === hashes[0]) {
            continue;
          }
          for (let j = 0; j < 3; j++) {
            const jNext = (j + 1) % 3;
            const vecHash0 = hashes[j];
            const vecHash1 = hashes[jNext];
            const v0 = _triangle[vertKeys[j]];
            const v1 = _triangle[vertKeys[jNext]];
            const hash = `${vecHash0}_${vecHash1}`;
            const reverseHash = `${vecHash1}_${vecHash0}`;
            if (reverseHash in edgeData && edgeData[reverseHash]) {
              if (_normal.dot(edgeData[reverseHash].normal) <= thresholdDot) {
                vertices.push(v0.x, v0.y, v0.z);
                vertices.push(v1.x, v1.y, v1.z);
              }
              edgeData[reverseHash] = null;
            } else if (!(hash in edgeData)) {
              edgeData[hash] = {
                index0: indexArr[j],
                index1: indexArr[jNext],
                normal: _normal.clone()
              };
            }
          }
        }
        for (const key in edgeData) {
          if (edgeData[key]) {
            const { index0, index1 } = edgeData[key];
            _v0.fromBufferAttribute(positionAttr, index0);
            _v1$1.fromBufferAttribute(positionAttr, index1);
            vertices.push(_v0.x, _v0.y, _v0.z);
            vertices.push(_v1$1.x, _v1$1.y, _v1$1.z);
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
  var Shape = class extends Path {
    constructor(points) {
      super(points);
      this.uuid = generateUUID();
      this.type = "Shape";
      this.holes = [];
    }
    getPointsHoles(divisions) {
      const holesPts = [];
      for (let i = 0, l = this.holes.length; i < l; i++) {
        holesPts[i] = this.holes[i].getPoints(divisions);
      }
      return holesPts;
    }
    // get points of shape and holes (keypoints based on segments parameter)
    extractPoints(divisions) {
      return {
        shape: this.getPoints(divisions),
        holes: this.getPointsHoles(divisions)
      };
    }
    copy(source) {
      super.copy(source);
      this.holes = [];
      for (let i = 0, l = source.holes.length; i < l; i++) {
        const hole = source.holes[i];
        this.holes.push(hole.clone());
      }
      return this;
    }
    toJSON() {
      const data = super.toJSON();
      data.uuid = this.uuid;
      data.holes = [];
      for (let i = 0, l = this.holes.length; i < l; i++) {
        const hole = this.holes[i];
        data.holes.push(hole.toJSON());
      }
      return data;
    }
    fromJSON(json) {
      super.fromJSON(json);
      this.uuid = json.uuid;
      this.holes = [];
      for (let i = 0, l = json.holes.length; i < l; i++) {
        const hole = json.holes[i];
        this.holes.push(new Path().fromJSON(hole));
      }
      return this;
    }
  };
  var Earcut = {
    triangulate: function(data, holeIndices, dim = 2) {
      const hasHoles = holeIndices && holeIndices.length;
      const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
      let outerNode = linkedList(data, 0, outerLen, dim, true);
      const triangles = [];
      if (!outerNode || outerNode.next === outerNode.prev) return triangles;
      let minX, minY, maxX, maxY, x, y, invSize;
      if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
      if (data.length > 80 * dim) {
        minX = maxX = data[0];
        minY = maxY = data[1];
        for (let i = dim; i < outerLen; i += dim) {
          x = data[i];
          y = data[i + 1];
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        invSize = Math.max(maxX - minX, maxY - minY);
        invSize = invSize !== 0 ? 32767 / invSize : 0;
      }
      earcutLinked(outerNode, triangles, dim, minX, minY, invSize, 0);
      return triangles;
    }
  };
  function linkedList(data, start, end, dim, clockwise) {
    let i, last;
    if (clockwise === signedArea(data, start, end, dim) > 0) {
      for (i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
    } else {
      for (i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
    }
    if (last && equals(last, last.next)) {
      removeNode(last);
      last = last.next;
    }
    return last;
  }
  function filterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;
    let p = start, again;
    do {
      again = false;
      if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
        removeNode(p);
        p = end = p.prev;
        if (p === p.next) break;
        again = true;
      } else {
        p = p.next;
      }
    } while (again || p !== end);
    return end;
  }
  function earcutLinked(ear, triangles, dim, minX, minY, invSize, pass) {
    if (!ear) return;
    if (!pass && invSize) indexCurve(ear, minX, minY, invSize);
    let stop = ear, prev, next;
    while (ear.prev !== ear.next) {
      prev = ear.prev;
      next = ear.next;
      if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
        triangles.push(prev.i / dim | 0);
        triangles.push(ear.i / dim | 0);
        triangles.push(next.i / dim | 0);
        removeNode(ear);
        ear = next.next;
        stop = next.next;
        continue;
      }
      ear = next;
      if (ear === stop) {
        if (!pass) {
          earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);
        } else if (pass === 1) {
          ear = cureLocalIntersections(filterPoints(ear), triangles, dim);
          earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);
        } else if (pass === 2) {
          splitEarcut(ear, triangles, dim, minX, minY, invSize);
        }
        break;
      }
    }
  }
  function isEar(ear) {
    const a = ear.prev, b = ear, c = ear.next;
    if (area(a, b, c) >= 0) return false;
    const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;
    const x0 = ax < bx ? ax < cx ? ax : cx : bx < cx ? bx : cx, y0 = ay < by ? ay < cy ? ay : cy : by < cy ? by : cy, x1 = ax > bx ? ax > cx ? ax : cx : bx > cx ? bx : cx, y1 = ay > by ? ay > cy ? ay : cy : by > cy ? by : cy;
    let p = c.next;
    while (p !== a) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
      p = p.next;
    }
    return true;
  }
  function isEarHashed(ear, minX, minY, invSize) {
    const a = ear.prev, b = ear, c = ear.next;
    if (area(a, b, c) >= 0) return false;
    const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;
    const x0 = ax < bx ? ax < cx ? ax : cx : bx < cx ? bx : cx, y0 = ay < by ? ay < cy ? ay : cy : by < cy ? by : cy, x1 = ax > bx ? ax > cx ? ax : cx : bx > cx ? bx : cx, y1 = ay > by ? ay > cy ? ay : cy : by > cy ? by : cy;
    const minZ = zOrder(x0, y0, minX, minY, invSize), maxZ = zOrder(x1, y1, minX, minY, invSize);
    let p = ear.prevZ, n = ear.nextZ;
    while (p && p.z >= minZ && n && n.z <= maxZ) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c && pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
      p = p.prevZ;
      if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c && pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
      n = n.nextZ;
    }
    while (p && p.z >= minZ) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c && pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
      p = p.prevZ;
    }
    while (n && n.z <= maxZ) {
      if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c && pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
      n = n.nextZ;
    }
    return true;
  }
  function cureLocalIntersections(start, triangles, dim) {
    let p = start;
    do {
      const a = p.prev, b = p.next.next;
      if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
        triangles.push(a.i / dim | 0);
        triangles.push(p.i / dim | 0);
        triangles.push(b.i / dim | 0);
        removeNode(p);
        removeNode(p.next);
        p = start = b;
      }
      p = p.next;
    } while (p !== start);
    return filterPoints(p);
  }
  function splitEarcut(start, triangles, dim, minX, minY, invSize) {
    let a = start;
    do {
      let b = a.next.next;
      while (b !== a.prev) {
        if (a.i !== b.i && isValidDiagonal(a, b)) {
          let c = splitPolygon(a, b);
          a = filterPoints(a, a.next);
          c = filterPoints(c, c.next);
          earcutLinked(a, triangles, dim, minX, minY, invSize, 0);
          earcutLinked(c, triangles, dim, minX, minY, invSize, 0);
          return;
        }
        b = b.next;
      }
      a = a.next;
    } while (a !== start);
  }
  function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];
    let i, len, start, end, list;
    for (i = 0, len = holeIndices.length; i < len; i++) {
      start = holeIndices[i] * dim;
      end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
      list = linkedList(data, start, end, dim, false);
      if (list === list.next) list.steiner = true;
      queue.push(getLeftmost(list));
    }
    queue.sort(compareX);
    for (i = 0; i < queue.length; i++) {
      outerNode = eliminateHole(queue[i], outerNode);
    }
    return outerNode;
  }
  function compareX(a, b) {
    return a.x - b.x;
  }
  function eliminateHole(hole, outerNode) {
    const bridge = findHoleBridge(hole, outerNode);
    if (!bridge) {
      return outerNode;
    }
    const bridgeReverse = splitPolygon(bridge, hole);
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
  }
  function findHoleBridge(hole, outerNode) {
    let p = outerNode, qx = -Infinity, m;
    const hx = hole.x, hy = hole.y;
    do {
      if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
        const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
        if (x <= hx && x > qx) {
          qx = x;
          m = p.x < p.next.x ? p : p.next;
          if (x === hx) return m;
        }
      }
      p = p.next;
    } while (p !== outerNode);
    if (!m) return null;
    const stop = m, mx = m.x, my = m.y;
    let tanMin = Infinity, tan;
    p = m;
    do {
      if (hx >= p.x && p.x >= mx && hx !== p.x && pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
        tan = Math.abs(hy - p.y) / (hx - p.x);
        if (locallyInside(p, hole) && (tan < tanMin || tan === tanMin && (p.x > m.x || p.x === m.x && sectorContainsSector(m, p)))) {
          m = p;
          tanMin = tan;
        }
      }
      p = p.next;
    } while (p !== stop);
    return m;
  }
  function sectorContainsSector(m, p) {
    return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
  }
  function indexCurve(start, minX, minY, invSize) {
    let p = start;
    do {
      if (p.z === 0) p.z = zOrder(p.x, p.y, minX, minY, invSize);
      p.prevZ = p.prev;
      p.nextZ = p.next;
      p = p.next;
    } while (p !== start);
    p.prevZ.nextZ = null;
    p.prevZ = null;
    sortLinked(p);
  }
  function sortLinked(list) {
    let i, p, q, e, tail, numMerges, pSize, qSize, inSize = 1;
    do {
      p = list;
      list = null;
      tail = null;
      numMerges = 0;
      while (p) {
        numMerges++;
        q = p;
        pSize = 0;
        for (i = 0; i < inSize; i++) {
          pSize++;
          q = q.nextZ;
          if (!q) break;
        }
        qSize = inSize;
        while (pSize > 0 || qSize > 0 && q) {
          if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) {
            e = p;
            p = p.nextZ;
            pSize--;
          } else {
            e = q;
            q = q.nextZ;
            qSize--;
          }
          if (tail) tail.nextZ = e;
          else list = e;
          e.prevZ = tail;
          tail = e;
        }
        p = q;
      }
      tail.nextZ = null;
      inSize *= 2;
    } while (numMerges > 1);
    return list;
  }
  function zOrder(x, y, minX, minY, invSize) {
    x = (x - minX) * invSize | 0;
    y = (y - minY) * invSize | 0;
    x = (x | x << 8) & 16711935;
    x = (x | x << 4) & 252645135;
    x = (x | x << 2) & 858993459;
    x = (x | x << 1) & 1431655765;
    y = (y | y << 8) & 16711935;
    y = (y | y << 4) & 252645135;
    y = (y | y << 2) & 858993459;
    y = (y | y << 1) & 1431655765;
    return x | y << 1;
  }
  function getLeftmost(start) {
    let p = start, leftmost = start;
    do {
      if (p.x < leftmost.x || p.x === leftmost.x && p.y < leftmost.y) leftmost = p;
      p = p.next;
    } while (p !== start);
    return leftmost;
  }
  function pointInTriangle(ax, ay, bx, by, cx, cy, px2, py2) {
    return (cx - px2) * (ay - py2) >= (ax - px2) * (cy - py2) && (ax - px2) * (by - py2) >= (bx - px2) * (ay - py2) && (bx - px2) * (cy - py2) >= (cx - px2) * (by - py2);
  }
  function isValidDiagonal(a, b) {
    return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) && // dones't intersect other edges
    (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && // locally visible
    (area(a.prev, a, b.prev) || area(a, b.prev, b)) || // does not create opposite-facing sectors
    equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0);
  }
  function area(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  }
  function equals(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
  }
  function intersects(p1, q1, p2, q2) {
    const o1 = sign(area(p1, q1, p2));
    const o2 = sign(area(p1, q1, q2));
    const o3 = sign(area(p2, q2, p1));
    const o4 = sign(area(p2, q2, q1));
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
  }
  function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  }
  function sign(num) {
    return num > 0 ? 1 : num < 0 ? -1 : 0;
  }
  function intersectsPolygon(a, b) {
    let p = a;
    do {
      if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersects(p, p.next, a, b)) return true;
      p = p.next;
    } while (p !== a);
    return false;
  }
  function locallyInside(a, b) {
    return area(a.prev, a, a.next) < 0 ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
  }
  function middleInside(a, b) {
    let p = a, inside = false;
    const px2 = (a.x + b.x) / 2, py2 = (a.y + b.y) / 2;
    do {
      if (p.y > py2 !== p.next.y > py2 && p.next.y !== p.y && px2 < (p.next.x - p.x) * (py2 - p.y) / (p.next.y - p.y) + p.x)
        inside = !inside;
      p = p.next;
    } while (p !== a);
    return inside;
  }
  function splitPolygon(a, b) {
    const a2 = new Node(a.i, a.x, a.y), b2 = new Node(b.i, b.x, b.y), an = a.next, bp = b.prev;
    a.next = b;
    b.prev = a;
    a2.next = an;
    an.prev = a2;
    b2.next = a2;
    a2.prev = b2;
    bp.next = b2;
    b2.prev = bp;
    return b2;
  }
  function insertNode(i, x, y, last) {
    const p = new Node(i, x, y);
    if (!last) {
      p.prev = p;
      p.next = p;
    } else {
      p.next = last.next;
      p.prev = last;
      last.next.prev = p;
      last.next = p;
    }
    return p;
  }
  function removeNode(p) {
    p.next.prev = p.prev;
    p.prev.next = p.next;
    if (p.prevZ) p.prevZ.nextZ = p.nextZ;
    if (p.nextZ) p.nextZ.prevZ = p.prevZ;
  }
  function Node(i, x, y) {
    this.i = i;
    this.x = x;
    this.y = y;
    this.prev = null;
    this.next = null;
    this.z = 0;
    this.prevZ = null;
    this.nextZ = null;
    this.steiner = false;
  }
  function signedArea(data, start, end, dim) {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) {
      sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
      j = i;
    }
    return sum;
  }
  var ShapeUtils = class _ShapeUtils {
    // calculate area of the contour polygon
    static area(contour) {
      const n = contour.length;
      let a = 0;
      for (let p = n - 1, q = 0; q < n; p = q++) {
        a += contour[p].x * contour[q].y - contour[q].x * contour[p].y;
      }
      return a * 0.5;
    }
    static isClockWise(pts) {
      return _ShapeUtils.area(pts) < 0;
    }
    static triangulateShape(contour, holes) {
      const vertices = [];
      const holeIndices = [];
      const faces = [];
      removeDupEndPts(contour);
      addContour(vertices, contour);
      let holeIndex = contour.length;
      holes.forEach(removeDupEndPts);
      for (let i = 0; i < holes.length; i++) {
        holeIndices.push(holeIndex);
        holeIndex += holes[i].length;
        addContour(vertices, holes[i]);
      }
      const triangles = Earcut.triangulate(vertices, holeIndices);
      for (let i = 0; i < triangles.length; i += 3) {
        faces.push(triangles.slice(i, i + 3));
      }
      return faces;
    }
  };
  function removeDupEndPts(points) {
    const l = points.length;
    if (l > 2 && points[l - 1].equals(points[0])) {
      points.pop();
    }
  }
  function addContour(vertices, contour) {
    for (let i = 0; i < contour.length; i++) {
      vertices.push(contour[i].x);
      vertices.push(contour[i].y);
    }
  }
  var ExtrudeGeometry = class _ExtrudeGeometry extends BufferGeometry {
    constructor(shapes = new Shape([new Vector2(0.5, 0.5), new Vector2(-0.5, 0.5), new Vector2(-0.5, -0.5), new Vector2(0.5, -0.5)]), options = {}) {
      super();
      this.type = "ExtrudeGeometry";
      this.parameters = {
        shapes,
        options
      };
      shapes = Array.isArray(shapes) ? shapes : [shapes];
      const scope = this;
      const verticesArray = [];
      const uvArray = [];
      for (let i = 0, l = shapes.length; i < l; i++) {
        const shape = shapes[i];
        addShape(shape);
      }
      this.setAttribute("position", new Float32BufferAttribute(verticesArray, 3));
      this.setAttribute("uv", new Float32BufferAttribute(uvArray, 2));
      this.computeVertexNormals();
      function addShape(shape) {
        const placeholder = [];
        const curveSegments = options.curveSegments !== void 0 ? options.curveSegments : 12;
        const steps = options.steps !== void 0 ? options.steps : 1;
        const depth = options.depth !== void 0 ? options.depth : 1;
        let bevelEnabled = options.bevelEnabled !== void 0 ? options.bevelEnabled : true;
        let bevelThickness = options.bevelThickness !== void 0 ? options.bevelThickness : 0.2;
        let bevelSize = options.bevelSize !== void 0 ? options.bevelSize : bevelThickness - 0.1;
        let bevelOffset = options.bevelOffset !== void 0 ? options.bevelOffset : 0;
        let bevelSegments = options.bevelSegments !== void 0 ? options.bevelSegments : 3;
        const extrudePath = options.extrudePath;
        const uvgen = options.UVGenerator !== void 0 ? options.UVGenerator : WorldUVGenerator;
        let extrudePts, extrudeByPath = false;
        let splineTube, binormal, normal, position2;
        if (extrudePath) {
          extrudePts = extrudePath.getSpacedPoints(steps);
          extrudeByPath = true;
          bevelEnabled = false;
          splineTube = extrudePath.computeFrenetFrames(steps, false);
          binormal = new Vector3();
          normal = new Vector3();
          position2 = new Vector3();
        }
        if (!bevelEnabled) {
          bevelSegments = 0;
          bevelThickness = 0;
          bevelSize = 0;
          bevelOffset = 0;
        }
        const shapePoints = shape.extractPoints(curveSegments);
        let vertices = shapePoints.shape;
        const holes = shapePoints.holes;
        const reverse = !ShapeUtils.isClockWise(vertices);
        if (reverse) {
          vertices = vertices.reverse();
          for (let h = 0, hl = holes.length; h < hl; h++) {
            const ahole = holes[h];
            if (ShapeUtils.isClockWise(ahole)) {
              holes[h] = ahole.reverse();
            }
          }
        }
        const faces = ShapeUtils.triangulateShape(vertices, holes);
        const contour = vertices;
        for (let h = 0, hl = holes.length; h < hl; h++) {
          const ahole = holes[h];
          vertices = vertices.concat(ahole);
        }
        function scalePt2(pt, vec, size) {
          if (!vec) console.error("THREE.ExtrudeGeometry: vec does not exist");
          return pt.clone().addScaledVector(vec, size);
        }
        const vlen = vertices.length, flen = faces.length;
        function getBevelVec(inPt, inPrev, inNext) {
          let v_trans_x, v_trans_y, shrink_by;
          const v_prev_x = inPt.x - inPrev.x, v_prev_y = inPt.y - inPrev.y;
          const v_next_x = inNext.x - inPt.x, v_next_y = inNext.y - inPt.y;
          const v_prev_lensq = v_prev_x * v_prev_x + v_prev_y * v_prev_y;
          const collinear0 = v_prev_x * v_next_y - v_prev_y * v_next_x;
          if (Math.abs(collinear0) > Number.EPSILON) {
            const v_prev_len = Math.sqrt(v_prev_lensq);
            const v_next_len = Math.sqrt(v_next_x * v_next_x + v_next_y * v_next_y);
            const ptPrevShift_x = inPrev.x - v_prev_y / v_prev_len;
            const ptPrevShift_y = inPrev.y + v_prev_x / v_prev_len;
            const ptNextShift_x = inNext.x - v_next_y / v_next_len;
            const ptNextShift_y = inNext.y + v_next_x / v_next_len;
            const sf = ((ptNextShift_x - ptPrevShift_x) * v_next_y - (ptNextShift_y - ptPrevShift_y) * v_next_x) / (v_prev_x * v_next_y - v_prev_y * v_next_x);
            v_trans_x = ptPrevShift_x + v_prev_x * sf - inPt.x;
            v_trans_y = ptPrevShift_y + v_prev_y * sf - inPt.y;
            const v_trans_lensq = v_trans_x * v_trans_x + v_trans_y * v_trans_y;
            if (v_trans_lensq <= 2) {
              return new Vector2(v_trans_x, v_trans_y);
            } else {
              shrink_by = Math.sqrt(v_trans_lensq / 2);
            }
          } else {
            let direction_eq = false;
            if (v_prev_x > Number.EPSILON) {
              if (v_next_x > Number.EPSILON) {
                direction_eq = true;
              }
            } else {
