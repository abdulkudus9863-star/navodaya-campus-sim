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
      if (distance > interactable.radius) continue;
      // Doors must be operable from either side. Their target sits outside the
      // closed leaf, so a strict sight test would lock the player in a room.
      if (
        interactable.kind !== "door" &&
        !this.world.hasLineOfSight(
          playerPosition.x,
          playerPosition.z,
          interactable.position.x,
          interactable.position.z,
        )
      ) {
        continue;
      }
      if (distance < nearestDistance) {
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
        return `Talk to ${interactable.label}`;
      case "notice":
        return interactable.id === "notice-board"
          ? "Read the notice board"
          : `Read ${interactable.label}`;
      case "book":
        return `Look at ${interactable.label}`;
      case "door":
        return interactable.door ? interactable.door.prompt : "Open the door";
      case "student":
      case "teacher":
        return `Talk to ${interactable.label}`;
      case "roommate":
        return "Talk to your roommate";
      case "garden":
        return `${interactable.verb ?? "Pick"} ${interactable.label.toLowerCase()}`;
      default:
        return "Interact";
    }
  }

  clear(): void {
    this.active = null;
  }
}
