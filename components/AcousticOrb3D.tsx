'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Download, Box, Layers, Camera } from 'lucide-react';

export type FinishPreset = 'gold' | 'lunar' | 'crystal' | 'clay';
export type CameraPreset = 'studio' | 'zenith' | 'macro';
export type CryPresetKey = 'hunger' | 'gas' | 'overtired' | 'discomfort';

interface AcousticOrb3DProps {
  activeCategory: string;
  confidenceScore: number;
  isRecording: boolean;
  analyzing: boolean;
  audioEnergy?: number;
  themeMode: 'nocturne' | 'lunar' | 'daylight';
  onSelectCryNode?: (preset: CryPresetKey) => void;
}

// Module-scope reusable math objects for Zero-GC render loop
const _tempVec3 = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3(0, 0.8, 4.6);
const _dummyObj = new THREE.Object3D();
const _tempColor = new THREE.Color();

const SATELLITE_SPECS: {
  key: CryPresetKey;
  label: string;
  freq: string;
  color: number;
  orbitRadius: number;
  speed: number;
  yOffset: number;
}[] = [
  {
    key: 'hunger',
    label: 'Hunger ("Neh")',
    freq: '420 Hz',
    color: 0xfbbf24,
    orbitRadius: 1.85,
    speed: 0.55,
    yOffset: 0.28,
  },
  {
    key: 'gas',
    label: 'Gas / Colic ("Eairh")',
    freq: '610 Hz',
    color: 0xf43f5e,
    orbitRadius: 2.05,
    speed: 0.72,
    yOffset: -0.22,
  },
  {
    key: 'overtired',
    label: 'Overtired ("Owh")',
    freq: '340 Hz',
    color: 0x38bdf8,
    orbitRadius: 1.95,
    speed: 0.42,
    yOffset: 0.35,
  },
  {
    key: 'discomfort',
    label: 'Discomfort ("Heh")',
    freq: '480 Hz',
    color: 0xa855f7,
    orbitRadius: 1.75,
    speed: 0.64,
    yOffset: -0.3,
  },
];

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function AcousticOrb3D({
  activeCategory,
  confidenceScore,
  isRecording,
  analyzing,
  audioEnergy = 0.2,
  themeMode,
  onSelectCryNode,
}: AcousticOrb3DProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [exploded, setExploded] = useState(0);
  const [finish, setFinish] = useState<FinishPreset>('gold');
  const [camPreset, setCamPreset] = useState<CameraPreset>('studio');
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [webglFallback, setWebglFallback] = useState(false);

  // Mutable refs read inside animation loop without recreating WebGL context
  const stateRef = useRef({
    exploded: 0,
    finish: 'gold' as FinishPreset,
    camPreset: 'studio' as CameraPreset,
    isRecording: false,
    analyzing: false,
    audioEnergy: 0.2,
    activeCategory: 'Gas / Colic',
    themeMode: 'nocturne' as 'nocturne' | 'lunar' | 'daylight',
  });

  useEffect(() => {
    stateRef.current = {
      exploded,
      finish,
      camPreset,
      isRecording,
      analyzing,
      audioEnergy,
      activeCategory,
      themeMode,
    };
  }, [
    exploded,
    finish,
    camPreset,
    isRecording,
    analyzing,
    audioEnergy,
    activeCategory,
    themeMode,
  ]);

  const callbackRef = useRef(onSelectCryNode);
  useEffect(() => {
    callbackRef.current = onSelectCryNode;
  }, [onSelectCryNode]);

  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      const isHeadless =
        navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.setPixelRatio(
        isHeadless ? 1 : Math.min(window.devicePixelRatio, 2)
      );
      renderer.shadowMap.enabled = !isHeadless;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch {
      setWebglFallback(true);
      return;
    }

    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 420;
    renderer.setSize(width, height);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0c0a09);
    scene.fog = new THREE.FogExp2(0x0c0a09, 0.065);

    // Mandatory Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.8, 4.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2.4;
    controls.maxDistance = 8.5;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.target.set(0, 0.15, 0);

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1c1917, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfef08a, 2.2);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // Composite 10-Part Procedural 3D Model (THREE.Group)
    const totemGroup = new THREE.Group();
    scene.add(totemGroup);

    // 1. Primary Silhouette: Faceted Acoustic Core Polyhedron
    const coreGeo = new THREE.IcosahedronGeometry(0.68, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      metalness: 0.88,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      anisotropy: 0.75,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 0.35;
    coreMesh.castShadow = true;
    totemGroup.add(coreMesh);

    // 2. Refractive Outer Crystal Shell
    const shellGeo = new THREE.DodecahedronGeometry(0.92, 0);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.9,
      ior: 1.52,
      thickness: 1.1,
      clearcoat: 1.0,
      transparent: true,
      depthWrite: false,
    });
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    shellMesh.position.y = 0.35;
    shellMesh.renderOrder = 2;
    totemGroup.add(shellMesh);

    // 3, 4, 5. Secondary Read: 3 Concentric Harmonic Gyro-Rings with varied roughness
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.18,
    });
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.65,
      roughness: 0.46,
    });
    const ring3Mat = new THREE.MeshStandardMaterial({
      color: 0xe7e5e4,
      metalness: 0.25,
      roughness: 0.74,
    });

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.38, 0.036, 24, 96),
      ring1Mat
    );
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.03, 24, 96),
      ring2Mat
    );
    const ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.024, 20, 72),
      ring3Mat
    );
    ring1.position.y = 0.35;
    ring2.position.y = 0.35;
    ring3.position.y = 0.35;
    totemGroup.add(ring1, ring2, ring3);

    // 6, 7, 8, 9. Accent Detail: 4 Interactive Raycastable Cry-Axis Satellite Nodes
    const satelliteMeshes: THREE.Mesh[] = [];
    const satelliteGeo = new THREE.OctahedronGeometry(0.18, 1);

    SATELLITE_SPECS.forEach((spec) => {
      const satMat = new THREE.MeshPhysicalMaterial({
        color: spec.color,
        metalness: 0.45,
        roughness: 0.22,
        clearcoat: 0.9,
        emissive: spec.color,
        emissiveIntensity: 0.22,
      });
      const satMesh = new THREE.Mesh(satelliteGeo, satMat);
      satMesh.layers.enable(1); // Dedicated raycast layer
      satMesh.userData = {
        presetKey: spec.key,
        label: `${spec.label} · ${spec.freq}`,
      };
      satMesh.castShadow = true;
      satelliteMeshes.push(satMesh);
      totemGroup.add(satMesh);
    });

    // 10. Grounded Sculpted Studio Pedestal Base + Contact Shadow
    const baseGroup = new THREE.Group();
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      metalness: 0.4,
      roughness: 0.65,
    });
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.32, 0.22, 48),
      plinthMat
    );
    plinth.position.y = -1.05;
    plinth.receiveShadow = true;

    const collarRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.16, 0.028, 16, 64),
      ring1Mat
    );
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = -0.94;
    baseGroup.add(plinth, collarRing);
    totemGroup.add(baseGroup);

    // Contact Shadow Plane
    const shadowTex = createContactShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 3.8),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.15;
    scene.add(shadowPlane);

    // InstancedMesh Harmonic Acoustic Dust Motes (48 instances)
    const particleCount = 48;
    const particleGeo = new THREE.IcosahedronGeometry(0.026, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const particleInstanced = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      particleCount
    );
    const particleSeeds: { angle: number; radius: number; y: number; speed: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 1.45 + (i % 7) * 0.18;
      const y = -0.5 + ((i * 13) % 20) * 0.08;
      particleSeeds.push({ angle, radius, y, speed: 0.15 + (i % 5) * 0.06 });

      _dummyObj.position.set(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      );
      _dummyObj.updateMatrix();
      particleInstanced.setMatrixAt(i, _dummyObj.matrix);
      _tempColor.setHex(i % 2 === 0 ? 0xfbbf24 : 0x38bdf8);
      particleInstanced.setColorAt(i, _tempColor);
    }
    particleInstanced.instanceMatrix.needsUpdate = true;
    if (particleInstanced.instanceColor) {
      particleInstanced.instanceColor.needsUpdate = true;
    }
    particleInstanced.computeBoundingSphere();
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

    // Pre-warm shaders
    renderer.compile(scene, camera);

    // High-Performance Throttled Raycasting on Layer 1
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let lastHoverCheck = 0;

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 45) return;
      lastHoverCheck = now;

      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(satelliteMeshes, false);

      if (hits.length > 0) {
        const hitObj = hits[0].object;
        renderer.domElement.style.cursor = 'pointer';
        setHoveredNode(hitObj.userData.label || null);
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredNode(null);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(satelliteMeshes, false);
      if (hits.length > 0) {
        const presetKey = hits[0].object.userData.presetKey as CryPresetKey;
        if (presetKey && callbackRef.current) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(18);
          }
          callbackRef.current(presetKey);
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Handle WebGL context loss gracefully
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    // Resize Observer
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop with Exponential Damping
    const clock = new THREE.Clock();
    let currentExploded = 0;
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;

      // Sync theme background color smoothly
      const targetBgHex =
        st.themeMode === 'daylight'
          ? 0xf5f2eb
          : st.themeMode === 'lunar'
            ? 0x090d16
            : 0x0c0a09;
      _tempColor.setHex(targetBgHex);
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_tempColor, 0.08);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.lerp(_tempColor, 0.08);
      }

      // Smoothly damp exploded view separation
      currentExploded = THREE.MathUtils.damp(
        currentExploded,
        st.exploded,
        6,
        delta
      );

      // Update finish properties based on selected swatch
      if (st.finish === 'gold') {
        coreMat.color.setHex(0xfbbf24);
        coreMat.metalness = 0.88;
        coreMat.roughness = 0.16;
      } else if (st.finish === 'lunar') {
        coreMat.color.setHex(0x38bdf8);
        coreMat.metalness = 0.65;
        coreMat.roughness = 0.22;
      } else if (st.finish === 'crystal') {
        coreMat.color.setHex(0xf472b6);
        coreMat.metalness = 0.2;
        coreMat.roughness = 0.06;
      } else {
        coreMat.color.setHex(0xd6d3d1);
        coreMat.metalness = 0.08;
        coreMat.roughness = 0.78;
      }

      // Audio / Recording pulse modulation
      const pulseBoost = st.isRecording
        ? 1 + Math.sin(elapsed * 12) * 0.14 + st.audioEnergy * 0.25
        : st.analyzing
          ? 1 + Math.sin(elapsed * 8) * 0.09
          : 1 + Math.sin(elapsed * 2.2) * 0.035;

      coreMesh.scale.setScalar(pulseBoost);
      coreMesh.rotation.y += delta * (st.isRecording ? 1.4 : 0.35);
      coreMesh.rotation.x += delta * 0.2;
      coreMesh.position.y = 0.35 + currentExploded * 0.55;

      shellMesh.scale.setScalar(1 + currentExploded * 0.38);
      shellMesh.rotation.y -= delta * 0.22;
      shellMesh.position.y = 0.35 + currentExploded * 0.75;

      // Gyro rings rotation + exploded vertical separation
      ring1.rotation.x = Math.sin(elapsed * 0.6) * 0.65;
      ring1.rotation.y += delta * 0.45;
      ring1.position.y = 0.35 + currentExploded * 0.25;

      ring2.rotation.y = Math.cos(elapsed * 0.5) * 0.75;
      ring2.rotation.z += delta * 0.38;
      ring2.position.y = 0.35 - currentExploded * 0.15;

      ring3.rotation.x = Math.PI / 3 + elapsed * 0.5;
      ring3.position.y = 0.35 - currentExploded * 0.42;

      baseGroup.position.y = -currentExploded * 0.48;

      // Update Orbiting Cry-Axis Satellites
      satelliteMeshes.forEach((sat, idx) => {
        const spec = SATELLITE_SPECS[idx];
        const angle = elapsed * spec.speed + idx * (Math.PI / 2);
        const rad = spec.orbitRadius + currentExploded * 0.55;
        sat.position.set(
          Math.cos(angle) * rad,
          0.35 + spec.yOffset + Math.sin(elapsed * 1.5 + idx) * 0.1,
          Math.sin(angle) * rad
        );
        sat.rotation.y += delta * 1.2;
        sat.rotation.x += delta * 0.8;
      });

      // Update Instanced Harmonic Particles
      for (let i = 0; i < particleCount; i++) {
        const seed = particleSeeds[i];
        const a = seed.angle + elapsed * seed.speed;
        const r = seed.radius + currentExploded * 0.4;
        _dummyObj.position.set(
          Math.cos(a) * r,
          seed.y + Math.sin(elapsed * 1.2 + i) * 0.08,
          Math.sin(a) * r
        );
        _dummyObj.rotation.set(elapsed * 0.5, elapsed * 0.3, 0);
        _dummyObj.updateMatrix();
        particleInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;

      // Smooth Camera Preset Damping
      if (st.camPreset === 'zenith') {
        _targetCamPos.set(0, 4.8, 0.8);
      } else if (st.camPreset === 'macro') {
        _targetCamPos.set(0, 0.45, 2.55);
      } else {
        _targetCamPos.set(0, 0.8, 4.6);
      }
      _tempVec3.copy(_targetCamPos);
      controls.update();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      controls.dispose();
      envTexture.dispose();
      shadowTex.dispose();
      renderer.dispose();
    };
  }, []);

  // Export procedural 3D Totem geometry as Wavefront .OBJ for Blender / Unity
  const handleExportObj = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    let objText =
      '# Kora 3D Acoustic Resonance Totem — Procedural Export for Blender / Unity\n';
    objText += 'o KoraAcousticTotem\n';
    let vertexOffset = 1;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geo = child.geometry;
        const posAttr = geo.attributes.position;
        if (!posAttr) return;

        for (let i = 0; i < posAttr.count; i++) {
          _tempVec3
            .fromBufferAttribute(posAttr, i)
            .applyMatrix4(child.matrixWorld);
          objText += `v ${_tempVec3.x.toFixed(4)} ${_tempVec3.y.toFixed(4)} ${_tempVec3.z.toFixed(4)}\n`;
        }

        const indexAttr = geo.index;
        if (indexAttr) {
          for (let i = 0; i < indexAttr.count; i += 3) {
            const a = indexAttr.getX(i) + vertexOffset;
            const b = indexAttr.getX(i + 1) + vertexOffset;
            const c = indexAttr.getX(i + 2) + vertexOffset;
            objText += `f ${a} ${b} ${c}\n`;
          }
        }
        vertexOffset += posAttr.count;
      }
    });

    const blob = new Blob([objText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kora_acoustic_totem_blender_unity.obj';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-full h-[420px] sm:h-[460px] rounded-3xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
      {/* Dedicated Isolated WebGL Canvas Container */}
      {!webglFallback ? (
        <div
          ref={canvasMountRef}
          className="w-full h-full"
          aria-label="Interactive 3D Acoustic Resonance Totem — Drag to orbit, click satellite nodes to simulate cries"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-3">
          <Box className="w-10 h-10 text-amber-400" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            3D Acoustic Sculpture Ready
          </p>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm">
            Primary resonance: {activeCategory} ({confidenceScore}% confidence)
          </p>
        </div>
      )}

      {/* Minimal Top-Left Spec Overlay (No backdrop-filter over WebGL) */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-1 bg-stone-950/85 border border-white/10 rounded-2xl px-3.5 py-2.5">
        <div className="text-xs font-semibold text-stone-100">
          <span>3D Acoustic Resonance Totem</span>
          <span aria-hidden="true" className="mx-1.5 text-stone-500">
            ·
          </span>
          <span className="font-mono tabular-nums text-amber-300">
            {confidenceScore}%
          </span>
        </div>
        <div className="text-[11px] text-stone-400">
          {hoveredNode ? (
            <span className="text-amber-300 font-medium">
              Click 3D Node to Test: {hoveredNode}
            </span>
          ) : (
            <span>
              Drag to orbit 360° · Click any orbiting 3D satellite node to test
            </span>
          )}
        </div>
      </div>

      {/* Top-Right Blender / Unity .OBJ Export Trigger */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleExportObj}
          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-950/90 hover:bg-stone-900 border border-white/10 text-xs font-medium text-stone-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          title="Export procedural 3D mesh as Wavefront .OBJ for Blender or Unity"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>Export .OBJ (Blender / Unity)</span>
        </button>
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero Side-Panel Occlusion, No backdrop-filter) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-2xl flex flex-col items-center">
        <button
          type="button"
          onClick={() => setHudCollapsed((prev) => !prev)}
          className="min-h-[30px] px-3 py-1 rounded-t-xl bg-stone-950/90 border border-b-0 border-white/10 text-[11px] font-medium text-stone-300 flex items-center gap-1 hover:text-white transition-colors"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Show 3D Studio Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              <span>Hide 3D Controls</span>
            </>
          )}
        </button>

        {!hudCollapsed && (
          <div className="w-full p-3 rounded-2xl bg-stone-950/92 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center shadow-2xl">
            {/* Exploded View Slider */}
            <div className="flex flex-col gap-1 px-1">
              <div className="flex items-center justify-between text-[11px] text-stone-300">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-amber-400" />
                  <span>Exploded View</span>
                </span>
                <span className="font-mono tabular-nums text-amber-300">
                  {Math.round(exploded * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={exploded}
                onChange={(e) => setExploded(parseFloat(e.target.value))}
                aria-label="3D Exploded View Separation"
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* PBR Material Finish Swatches */}
            <div className="flex flex-col gap-1 px-1">
              <span className="text-[11px] text-stone-300">PBR Finish</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'gold', label: 'Gold' },
                    { id: 'lunar', label: 'Lunar' },
                    { id: 'crystal', label: 'Glass' },
                    { id: 'clay', label: 'Clay' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFinish(item.id)}
                    className={`flex-1 min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                      finish === item.id
                        ? 'bg-amber-400 text-stone-950 font-semibold'
                        : 'bg-stone-900 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera Angle Presets */}
            <div className="flex flex-col gap-1 px-1">
              <span className="text-[11px] text-stone-300 flex items-center gap-1">
                <Camera className="w-3 h-3 text-amber-400" />
                <span>Camera Rig</span>
              </span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'studio', label: 'Orbit' },
                    { id: 'macro', label: 'Macro' },
                    { id: 'zenith', label: 'Zenith' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCamPreset(cam.id)}
                    className={`flex-1 min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                      camPreset === cam.id
                        ? 'bg-stone-800 text-amber-300 border border-amber-400/40'
                        : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
