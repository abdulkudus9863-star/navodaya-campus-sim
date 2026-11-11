import * as THREE from "three";

export interface CharacterRig {
  group: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  hair: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  vest: THREE.Mesh;
  sleeveMaterial: THREE.MeshStandardMaterial;
  skinMaterial: THREE.MeshStandardMaterial;
}

const SKIN_SHIRT = "#e9e5d8";
const TROUSER = "#3f3e3c";
const SHOE = "#1d1c1a";
const HAIR = "#171412";

function standard(color: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadowed(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Builds a small, readable humanoid out of primitives (no external models). */
export function createCharacter(options: {
  uniform: string;
  skin: string;
  senior?: boolean;
}): CharacterRig {
  const group = new THREE.Group();
  const skinMaterial = standard(options.skin, 0.72);
  const sleeveMaterial = standard(options.uniform, 0.86);
  const shirtMaterial = standard(SKIN_SHIRT, 0.9);
  const trouserMaterial = standard(TROUSER, 0.92);
  const shoeMaterial = standard(SHOE, 0.6);
  const hairMaterial = standard(HAIR, 0.82);
  const vestMaterial = standard(options.uniform, 0.82);
  const brassMaterial = standard("#b39255", 0.4, 0.55);

  const torso = new THREE.Group();
  torso.position.y = 1.02;
  group.add(torso);

  const chest = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.24), shirtMaterial));
  chest.position.y = 0.06;
  torso.add(chest);

  const vest = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.27), vestMaterial));
  vest.position.set(0, 0.02, 0);
  torso.add(vest);

  const collar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.08, 0.26), shirtMaterial));
  collar.position.set(0, 0.32, 0.01);
  torso.add(collar);

  const lanyard = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.015), brassMaterial));
  lanyard.position.set(0.08, 0.16, 0.145);
  torso.add(lanyard);
  const idCard = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.012), standard("#e8e1cd", 0.5)));
  idCard.position.set(0.08, 0.0, 0.15);
  torso.add(idCard);

  const head = new THREE.Group();
  head.position.y = 1.52;
  group.add(head);
  const neck = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 10), skinMaterial));
  neck.position.y = -0.09;
  head.add(neck);
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), skinMaterial));
  skull.position.y = 0.02;
  skull.scale.set(0.94, 1.06, 0.96);
  head.add(skull);

  const hair = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.152, 20, 14), hairMaterial));
  hair.position.set(0, 0.055, -0.012);
  hair.scale.set(0.98, 0.86, 1.02);
  if (options.senior) {
    hair.scale.set(1.02, 0.92, 1.08);
  }
  head.add(hair);

  if (options.senior) {
    const braid = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.24, 4, 8), hairMaterial));
    braid.position.set(0, -0.14, -0.12);
    head.add(braid);
  }

  const eyeMaterial = standard("#231c18", 0.35);
  [-0.052, 0.052].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), eyeMaterial);
    eye.position.set(x, 0.02, 0.132);
    head.add(eye);
  });

  const nose = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 8), skinMaterial));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.02, 0.14);
  head.add(nose);

  const makeArm = (side: number): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.27, 1.32, 0);
    const sleeve = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.38, 4, 10), sleeveMaterial));
    sleeve.position.y = -0.26;
    arm.add(sleeve);
    const cuff = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.1, 10), shirtMaterial));
    cuff.position.y = -0.45;
    arm.add(cuff);
    const hand = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), skinMaterial));
    hand.position.y = -0.52;
    hand.scale.set(0.9, 1.1, 0.8);
    arm.add(hand);
    return arm;
  };

  const makeLeg = (side: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.115, 0.78, 0);
    const thigh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.58, 4, 10), trouserMaterial));
    thigh.position.y = -0.31;
    leg.add(thigh);
    const shoe = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.26), shoeMaterial));
    shoe.position.set(0, -0.73, 0.045);
    leg.add(shoe);
    return leg;
  };

  const leftArm = makeArm(1);
  const rightArm = makeArm(-1);
  const leftLeg = makeLeg(1);
  const rightLeg = makeLeg(-1);
  group.add(leftArm, rightArm, leftLeg, rightLeg);

  return {
    group,
    torso,
    head,
    hair,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    vest,
    sleeveMaterial,
    skinMaterial,
  };
}

export function setRigUniform(rig: CharacterRig, color: string): void {
  rig.sleeveMaterial.color.set(color);
  const vestMaterial = rig.vest.material as THREE.MeshStandardMaterial;
  vestMaterial.color.set(color);
}

export function setRigSkin(rig: CharacterRig, color: string): void {
  rig.skinMaterial.color.set(color);
}
