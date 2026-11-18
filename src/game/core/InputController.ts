/**
 * Keyboard / mouse / touch input. Gameplay code polls this; nothing here
 * touches React or the DOM overlay controls (those call the public methods).
 */
export class InputController {
  private keys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private zoomSteps = 0;
  private joystick = { x: 0, y: 0 };
  private jumpQueued = false;
  private interactQueued = false;
  private touchRunning = false;
  private enabled = true;
  private element: HTMLElement | null = null;
  private dragging = false;
  private isTouch = false;

  pointerLocked = false;
  onPointerLockChange: ((locked: boolean) => void) | null = null;

  constructor(isTouch: boolean) {
    this.isTouch = isTouch;
  }

  attach(element: HTMLElement): void {
    this.element = element;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("pointerlockchange", this.handlePointerLock);
    element.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointermove", this.handlePointerMove);
    element.addEventListener("contextmenu", this.handleContextMenu);
    // The mobile look overlay sits above the canvas, so listen at window level.
    window.addEventListener("wheel", this.handleWheel, { passive: false });
  }

  detach(): void {
    const element = this.element;
    if (element) {
      element.removeEventListener("pointerdown", this.handlePointerDown);
      element.removeEventListener("contextmenu", this.handleContextMenu);
    }
    window.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    document.removeEventListener("pointerlockchange", this.handlePointerLock);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointermove", this.handlePointerMove);
    this.element = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.joystick.x = 0;
      this.joystick.y = 0;
      this.jumpQueued = false;
      this.interactQueued = false;
      this.touchRunning = false;
      this.lookX = 0;
      this.lookY = 0;
      this.zoomSteps = 0;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  reset(): void {
    this.keys.clear();
    this.lookX = 0;
    this.lookY = 0;
    this.joystick.x = 0;
    this.joystick.y = 0;
    this.jumpQueued = false;
    this.interactQueued = false;
    this.touchRunning = false;
    this.zoomSteps = 0;
  }

  setTouchRunning(running: boolean): void {
    if (!this.enabled) {
      this.touchRunning = false;
      return;
    }
    this.touchRunning = running;
  }

  requestPointerLock(): void {
    if (this.isTouch || !this.element) return;
    if (document.pointerLockElement === this.element) return;
    if (typeof this.element.requestPointerLock !== "function") return;
    try {
      const request = this.element.requestPointerLock();
      if (request && typeof request.catch === "function") request.catch(() => undefined);
    } catch {
      /* Embedded previews may deny pointer lock; drag-to-look still works. */
    }
  }

  releasePointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setJoystick(x: number, y: number): void {
    if (!this.enabled) return;
    this.joystick.x = Math.max(-1, Math.min(1, x));
    this.joystick.y = Math.max(-1, Math.min(1, y));
    // y is expected in screen space (up = negative)
    this.joystick.y = -this.joystick.y;
  }

  queueJump(): void {
    if (!this.enabled) return;
    this.jumpQueued = true;
  }

  queueInteract(): void {
    if (!this.enabled) return;
    this.interactQueued = true;
  }

  addLook(dx: number, dy: number): void {
    if (!this.enabled) return;
    this.lookX += dx;
    this.lookY += dy;
  }

  addZoom(steps: number): void {
    if (!this.enabled || !Number.isFinite(steps)) return;
    this.zoomSteps += Math.max(-2, Math.min(2, steps));
  }

  consumeZoom(): number {
    const value = this.zoomSteps;
    this.zoomSteps = 0;
    return value;
  }

  consumeLook(): { x: number; y: number } {
    const result = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return result;
  }

  consumeJump(): boolean {
    const value = this.jumpQueued;
    this.jumpQueued = false;
    return value;
  }

  consumeInteract(): boolean {
    const value = this.interactQueued;
    this.interactQueued = false;
    return value;
  }

  /** Move vector in local space: x = strafe, y = forward. */
  getMove(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = this.joystick.x;
    let y = this.joystick.y;
    // A small radial dead zone removes thumb tremor, then an expo curve gives
    // finer control near the centre and full speed at the rim.
    const stickMagnitude = Math.hypot(x, y);
    if (stickMagnitude > 0 && stickMagnitude < 0.12) {
      x = 0;
      y = 0;
    } else if (stickMagnitude > 0) {
      const response = Math.pow(Math.min(1, (stickMagnitude - 0.12) / 0.88), 1.25) / stickMagnitude;
      x *= response;
      y *= response;
    }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y -= 1;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  get running(): boolean {
    return (
      this.touchRunning ||
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight")
    );
  }

  get isMoving(): boolean {
    const move = this.getMove();
    return Math.hypot(move.x, move.y) > 0.08;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) this.jumpQueued = true;
      return;
    }
    if (event.code === "KeyE") {
      if (!event.repeat) this.interactQueued = true;
      return;
    }
    if (event.code === "Equal" || event.code === "NumpadAdd") {
      if (!event.repeat) this.addZoom(-1);
      return;
    }
    if (event.code === "Minus" || event.code === "NumpadSubtract") {
      if (!event.repeat) this.addZoom(1);
      return;
    }
    this.keys.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.joystick.x = 0;
    this.joystick.y = 0;
  };

  private handlePointerLock = (): void => {
    this.pointerLocked = document.pointerLockElement === this.element;
    this.onPointerLockChange?.(this.pointerLocked);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || this.isTouch) return;
    if (event.pointerType === "touch") return;
    this.dragging = true;
    if (!this.pointerLocked && this.element) {
      this.requestPointerLock();
    }
  };

  private handlePointerUp = (): void => {
    this.dragging = false;
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || this.isTouch) return;
    if (this.pointerLocked || this.dragging) {
      this.lookX += event.movementX;
      this.lookY += event.movementY;
    }
  };

  private handleContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private handleWheel = (event: WheelEvent): void => {
    if (!this.enabled) return;
    event.preventDefault();
    this.addZoom(Math.sign(event.deltaY));
  };
}
