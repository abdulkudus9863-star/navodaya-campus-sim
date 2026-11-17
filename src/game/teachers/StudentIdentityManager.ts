import { getHouse } from "../data/houses";
import { getStudent } from "../data/students";
import type { PlayerProfileSave } from "../core/types";

export interface StudentIdentity {
  studentId: string;
  fullName: string;
  firstName: string;
  className: string;
  classLabel: string;
  rollNumber: number | null;
  houseId: string;
  houseName: string;
  houseShortName: string;
  houseColor: string;
  gender: "male" | "female" | "unspecified";
}

/**
 * The only identity source teachers read. It resolves the actual saved
 * character and house instead of hard-coding a name into dialogue. ARV-001 is
 * the authored Abdul Kuddus / Class 10 / Roll 34 identity.
 */
export class StudentIdentityManager {
  fromProfile(profile: PlayerProfileSave | null): StudentIdentity | null {
    if (!profile) return null;
    const student = getStudent(profile.characterId);
    const house = getHouse(profile.houseId);
    if (!student || !house) return null;
    const parts = student.displayName.trim().split(/\s+/);
    return {
      studentId: student.id,
      fullName: student.displayName,
      firstName: parts[0] ?? student.displayName,
      className: student.className,
      classLabel: `Class ${student.className}`,
      rollNumber: student.rollNumber,
      houseId: house.id,
      houseName: house.name,
      houseShortName: house.shortName,
      houseColor: house.color,
      gender: student.id === "ARV-001" ? "male" : "unspecified",
    };
  }
}
