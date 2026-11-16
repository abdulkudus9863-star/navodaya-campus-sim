import type { NoticeView } from "../core/types";

/**
 * Stable interior identifiers. Coordinates are the centre of each room in
 * world space and are shared by the geometry, interaction prompts and future
 * multiplayer/room-state code. The campus is interpretive, not a survey.
 */
export interface CampusRoomDefinition {
  id: string;
  building: string;
  floor: number;
  name: string;
  x: number;
  z: number;
  radius: number;
  provenance: "interpretive" | "fictional";
}

export const CAMPUS_ROOMS: readonly CampusRoomDefinition[] = [
  {
    id: "gate-cabin",
    building: "main-gate",
    floor: 0,
    name: "Security cabin",
    x: -10.5,
    z: 44.5,
    radius: 3,
    provenance: "interpretive",
  },
  {
    id: "library-reading-room",
    building: "library",
    floor: 0,
    name: "Reading room",
    x: -36,
    z: -30,
    radius: 12,
    provenance: "interpretive",
  },
  {
    id: "library-quiet-room",
    building: "library",
    floor: 0,
    name: "Quiet reading section",
    x: -40.5,
    z: -24.5,
    radius: 4,
    provenance: "interpretive",
  },
  {
    id: "academic-corridor-gf",
    building: "academic-block",
    floor: 0,
    name: "Ground-floor corridor",
    x: -26,
    z: 0,
    radius: 10,
    provenance: "interpretive",
  },
  {
    id: "academic-classroom-101",
    building: "academic-block",
    floor: 0,
    name: "Room 101",
    x: -30.5,
    z: -7,
    radius: 5,
    provenance: "interpretive",
  },
  {
    id: "academic-washroom",
    building: "academic-block",
    floor: 0,
    name: "Washroom",
    x: -39.5,
    z: -8.5,
    radius: 3,
    provenance: "interpretive",
  },
  {
    id: "academic-corridor-ff",
    building: "academic-block",
    floor: 1,
    name: "First-floor corridor",
    x: -26,
    z: 0,
    radius: 10,
    provenance: "interpretive",
  },
  {
    id: "academic-classroom-201",
    building: "academic-block",
    floor: 1,
    name: "Room 201",
    x: -30.5,
    z: -7,
    radius: 5,
    provenance: "interpretive",
  },
  {
    id: "academic-staff-room",
    building: "academic-block",
    floor: 1,
    name: "Staff room",
    x: -21,
    z: 6,
    radius: 4,
    provenance: "interpretive",
  },
  {
    id: "block-b-corridor",
    building: "academic-block-b",
    floor: 0,
    name: "Block B corridor",
    x: 34,
    z: -20.5,
    radius: 10,
    provenance: "interpretive",
  },
  {
    id: "computer-lab",
    building: "academic-block-b",
    floor: 0,
    name: "Computer laboratory",
    x: 29.5,
    z: -25.2,
    radius: 5,
    provenance: "interpretive",
  },
  {
    id: "indoor-sports-hall",
    building: "indoor-sports-hall",
    floor: 0,
    name: "Indoor sports hall",
    x: 49.3,
    z: -18,
    radius: 8,
    provenance: "interpretive",
  },
  {
    id: "science-lab-main",
    building: "science-labs",
    floor: 0,
    name: "Practical laboratory",
    x: 36,
    z: -38,
    radius: 10,
    provenance: "interpretive",
  },
  {
    id: "admin-reception",
    building: "administration",
    floor: 0,
    name: "Reception",
    x: 12.4,
    z: 40.8,
    radius: 3,
    provenance: "interpretive",
  },
  {
    id: "admin-principal-office",
    building: "administration",
    floor: 0,
    name: "Principal's office",
    x: 16.4,
    z: 45.2,
    radius: 3,
    provenance: "interpretive",
  },
  {
    id: "admin-staff-room",
    building: "administration",
    floor: 0,
    name: "Staff room",
    x: 9.8,
    z: 45.2,
    radius: 3,
    provenance: "interpretive",
  },
  {
    id: "dining-hall",
    building: "dining-hall",
    floor: 0,
    name: "Dining hall",
    x: 2,
    z: -38,
    radius: 15,
    provenance: "interpretive",
  },
  {
    id: "dining-service",
    building: "dining-hall",
    floor: 0,
    name: "Serving counter",
    x: 2,
    z: -43,
    radius: 5,
    provenance: "interpretive",
  },
] as const;

export const INTERIOR_CONTENT = {
  securityLog: {
    title: "Gate Log",
    subtitle: "Security Cabin · Main Gate · Visitor Register",
    items: [
      {
        heading: "Visitors",
        body: "Parents and guardians sign in here. Hostel visitors report to the office first and leave by 5:00 PM.",
      },
      {
        heading: "After 6:00 PM",
        body: "No pupil leaves the campus without the principal's written slip. The gate is locked after lights-out.",
      },
      {
        heading: "Campus",
        body: "The guard cabin faces the drive. Emergency numbers and the night-duty roster are pinned above the desk.",
      },
    ],
  },
  libraryShelf: {
    title: "The Shelf List",
    subtitle: "Gyan Mandir · Reading Room · Fiction & Reference",
    items: [
      {
        heading: "The Long Walk Home",
        body: "A slim novel about a village bus stop. Somebody has underlined the last page in pencil.",
      },
      {
        heading: "Atlas of the North-East",
        body: "Dog-eared, repaired with tape, and still the most argued-over book in the reading room.",
      },
      {
        heading: "Practical Botany",
        body: "A class VII copy. The margin notes are in three different hands, and one of them is yours.",
      },
    ],
  },
  libraryCatalogue: {
    title: "Card Catalogue",
    subtitle: "Gyan Mandir · Librarian's Counter",
    items: [
      {
        heading: "Borrowing",
        body: "Two books at a time, fourteen days each. Reference books stay in the reading room.",
      },
      {
        heading: "Reading room",
        body: "Open until 8:00 PM. Bags at the counter, silence past the second table, no ink near the atlases.",
      },
      {
        heading: "Returns",
        body: "Returned books go in the tray, not on the shelf. The librarian notices these things.",
      },
    ],
  },
  labSafety: {
    title: "Laboratory Notice",
    subtitle: "Vigyan Bhavan · Practical Science · Class VII",
    items: [
      {
        heading: "Before the practical",
        body: "Wear the apron. Tie back long hair. Read the whole instruction before lighting the burner.",
      },
      {
        heading: "Bench rules",
        body: "Acid bottles stay in the tray. Broken glass goes in the red bin, never in the sink.",
      },
      {
        heading: "Today's practical",
        body: "Testing leaf starch. The iodine is already prepared; ask the lab assistant for the test tubes.",
      },
    ],
  },
  adminNotice: {
    title: "Office Notices",
    subtitle: "Prashasan · Reception · This Week",
    items: [
      {
        heading: "House meetings",
        body: "House captains meet the principal after assembly on Thursday. Bring the attendance register.",
      },
      {
        heading: "Leave applications",
        body: "Collect the form from reception, have it signed by the house master, and return it before lunch.",
      },
      {
        heading: "Visitors",
        body: "Parents may visit the staff room between 3:00 PM and 4:30 PM. No hostel visits without a pass.",
      },
    ],
  },
  principalDesk: {
    title: "The Principal's Desk",
    subtitle: "Prashasan · Principal's Office",
    items: [
      {
        heading: "Notice to Class VII",
        body: "Report to Room 12 after assembly. Bring your geography notebook and the library book you have not returned.",
      },
      {
        heading: "The campus",
        body: "The new house flag order is on the wall: Aravali blue, Nilgiri green, Shivalik red, Udaygiri yellow.",
      },
      {
        heading: "A visitor",
        body: "A framed photograph of the first graduating batch sits beside the lamp. The glass is spotless.",
      },
    ],
  },
  messMenu: {
    title: "Mess Menu",
    subtitle: "Annapoorna · Dining Hall · Term II",
    items: [
      {
        heading: "Breakfast",
        body: "Poha, boiled egg, banana, milk. The queue starts at 6:50 AM.",
      },
      {
        heading: "Lunch",
        body: "Rice, dal, seasonal vegetable, curd and pickle. Second helpings after the senior houses.",
      },
      {
        heading: "Dinner",
        body: "Chapati, rajma, rice and fruit. The mess committee meets by the counter on Sunday.",
      },
    ],
  },
  washArea: {
    title: "Wash Area",
    subtitle: "Annapoorna · Dining Hall",
    items: [
      {
        heading: "Before meals",
        body: "Rinse your plate at the sink, not at the drinking tap. The dining hall closes twenty minutes after the bell.",
      },
      {
        heading: "Water",
        body: "Drinking water is from the marked tap only. The garden tap is for the plants.",
      },
    ],
  },
  classroomNotice: {
    title: "Room 101 Notices",
    subtitle: "Academic Block A · Ground Floor · Class VII A",
    items: [
      {
        heading: "This week",
        body: "Geography maps due Thursday. Bring the atlas from the library, not the one from the staff room.",
      },
      {
        heading: "First floor",
        body: "Class VIII is upstairs in Rooms 201 and 202. Use the west staircase; the balcony door is for the senior section only.",
      },
      {
        heading: "House duty",
        body: "Aravali has the corridor sweep this week. Nilgiri takes the notice boards on Friday.",
      },
    ],
  },
  computerLab: {
    title: "Computer Lab Rota",
    subtitle: "Abhyas Bhavan · Academic Block B",
    items: [
      {
        heading: "Practical slots",
        body: "Class VII A — Tuesday, second period. Log in with your roll number, not your nickname.",
      },
      {
        heading: "Care of equipment",
        body: "Shut down the monitor after use. Food and water stay outside the lab. Report a loose cable before switching on.",
      },
      {
        heading: "Typing practice",
        body: "The teacher has left a new set of passages in the shared folder. No games until the exercise is finished.",
      },
    ],
  },
  indoorSports: {
    title: "Indoor Games Board",
    subtitle: "Khel Kshetra · Indoor Sports Hall",
    items: [
      {
        heading: "After prep",
        body: "Badminton doubles from 5:00 PM. Table tennis is open until the dinner bell. Sign the register at the equipment room.",
      },
      {
        heading: "House fixtures",
        body: "The inter-house badminton draw is on the board. Shivalik and Udaygiri play the opening match.",
      },
      {
        heading: "Equipment",
        body: "Rackets go back in the cupboard, not on the court. The shutter is locked after 6:30 PM.",
      },
    ],
  },
} satisfies Record<string, NoticeView>;
