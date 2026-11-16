import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SKIN_TONES, type CharacterSettings } from "../core/types";
import {
  applyCharacterOptions,
  characterOptions,
  createCharacter,
  type CharacterOptions,
  type CharacterRig,
} from "../world/CharacterFactory";

const MIN_DISTANCE = 2.6;
const MAX_DISTANCE = 5.4;

/**
 * Small local Three.js preview. It uses the same modular rig as the game, but
 * its own renderer so orbit/zoom cannot disturb the campus camera.
 */
export function CharacterPreview3D({
  character,
  houseColor,
  className = "",
}: {
  character: CharacterSettings;
  houseColor: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<CharacterRig | null>(null);
  const optionsRef = useRef<CharacterOptions>(
    characterOptions(character, houseColor, SKIN_TONES[character.skin], "high"),
  );
  const yawRef = useRef(0.25);
  const targetYawRef = useRef(0.25);
  const distanceRef = useRef(3.7);
  const targetDistanceRef = useRef(3.7);
  const dragRef = useRef<{ id: number; x: number } | null>(null);
  const pinchRef = useRef<{ distance: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());

  // Keep the live rig in sync with the creator state without rebuilding it.
  useEffect(() => {
    optionsRef.current = characterOptions(character, houseColor, SKIN_TONES[character.skin], "high");
    if (rigRef.current) applyCharacterOptions(rigRef.current, optionsRef.current);
  }, [character, houseColor]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 1.15, 3.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const rig = createCharacter(optionsRef.current);
    rigRef.current = rig;
    rig.group.position.y = 0.02;
    scene.add(rig.group);

    scene.add(new THREE.HemisphereLight(0xfff2db, 0x2d4a3a, 1.5));
    const key = new THREE.DirectionalLight(0xffe6bd, 2.4);
    key.position.set(2.2, 4.4, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -1;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa8ccb0, 1.1);
    rim.position.set(-2.5, 2.2, -2);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 32),
      new THREE.MeshStandardMaterial({ color: "#172019", roughness: 0.94, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.18, 48),
      new THREE.MeshBasicMaterial({ color: "#b39255", transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);

    let frame = 0;
    let last = performance.now();
    let idleTimer = 0;
    const size = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(host);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      idleTimer += dt;

      if (!dragRef.current && !pinchRef.current && idleTimer > 4) {
        targetYawRef.current += dt * 0.18;
      }
      yawRef.current += (targetYawRef.current - yawRef.current) * Math.min(1, dt * 9);
      distanceRef.current += (targetDistanceRef.current - distanceRef.current) * Math.min(1, dt * 7);

      rig.group.rotation.y = yawRef.current;
      const breathe = Math.sin(now * 0.0017) * 0.006;
      rig.torso.position.y = 1.02 + breathe;
      rig.head.rotation.y = Math.sin(now * 0.0006) * 0.08;
      rig.leftArm.rotation.z = 0.03 + Math.sin(now * 0.0013) * 0.012;
      rig.rightArm.rotation.z = -0.03 - Math.sin(now * 0.0013) * 0.012;

      const distance = distanceRef.current;
      camera.position.set(0, 1.08 + Math.sin(yawRef.current * 0.5) * 0.04, distance);
      camera.lookAt(0, 0.98, 0);
      renderer.render(scene, camera);
    };
    animate();

    const pointerSpan = () => {
      const points = Array.from(pointersRef.current.values());
      if (points.length < 2) return null;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };

    const onPointerDown = (event: PointerEvent) => {
      host.setPointerCapture(event.pointerId);
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      idleTimer = 0;
      if (pointersRef.current.size >= 2) {
        pinchRef.current = { distance: pointerSpan() ?? 0 };
        dragRef.current = null;
        return;
      }
      dragRef.current = { id: event.pointerId, x: event.clientX };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      idleTimer = 0;
      if (pointersRef.current.size >= 2) {
        const span = pointerSpan();
        if (span && pinchRef.current?.distance) {
          const factor = pinchRef.current.distance / span;
          targetDistanceRef.current = THREE.MathUtils.clamp(
            targetDistanceRef.current * factor,
            MIN_DISTANCE,
            MAX_DISTANCE,
          );
        }
        pinchRef.current = { distance: span ?? 0 };
        return;
      }
      if (dragRef.current?.id === event.pointerId) {
        targetYawRef.current += (event.clientX - dragRef.current.x) * 0.012;
        dragRef.current.x = event.clientX;
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      pointersRef.current.delete(event.pointerId);
      if (dragRef.current?.id === event.pointerId) dragRef.current = null;
      if (pointersRef.current.size < 2) pinchRef.current = null;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      idleTimer = 0;
      targetDistanceRef.current = THREE.MathUtils.clamp(
        targetDistanceRef.current + Math.sign(event.deltaY) * 0.24,
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    };

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
      host.removeEventListener("wheel", onWheel);
      rigRef.current = null;
      rig.group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="Real-time 3D student character preview. Drag to rotate, pinch or scroll to zoom."
      data-testid="character-preview-3d"
      className={`relative touch-none overflow-hidden rounded-sm border border-foreground/15 bg-[radial-gradient(65%_60%_at_50%_35%,#29372b_0%,#111610_65%,#090c09_100%)] ${className}`}
    >
      <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap font-ui text-[8px] uppercase tracking-[0.18em] text-foreground/35">
        Drag to rotate · pinch to zoom
      </span>
    </div>
  );
}
