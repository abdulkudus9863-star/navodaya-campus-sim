import * as THREE from "three";
import type { WorldEnvironment, WorldInteractable } from "../world/WorldEnvironment";

export class InteractionSystem {
  private active: WorldInteractable | null = null;
  private world: WorldEnvironment;

  constructor(world: WorldEnvironment) {
    this.world = world;
  }

  update(playerPosition: THREE.Vector3): WorldInteractable | null {
    let nearest: WorldInteractable | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const interactable of this.world.interactables) {
      if (interactable.active === false) continue;
      const dx = playerPosition.x - interactable.position.x;
      const dz = playerPosition.z - interactable.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= interactable.radius && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }
    this.active = nearest;
    return nearest;
  }

  get target(): WorldInteractable | null {
    return this.active;
  }

  promptFor(interactable: WorldInteractable): string {
    switch (interactable.kind) {
      case "npc":
        return "Talk to Meera";
      case "notice":
        return "Read the notice board";
      case "door":
        return interactable.door ? interactable.door.prompt : "Open the door";
      case "student":
        return `Talk to ${interactable.label}`;
      case "roommate":
        return "Talk to your roommate";
      case "garden":
        return `Pick ${interactable.label.toLowerCase()}`;
      default:
        return "Interact";
    }
  }

  clear(): void {
    this.active = null;
  }
}
