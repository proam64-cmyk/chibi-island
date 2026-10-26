/**
 * Main road network traced from the official map (REF-04). World meters, origin = Chibi Town plaza, north = −Z.
 * Each road is a smooth curve through its waypoints; where it crosses water it becomes a bridge.
 */
export interface RoadDef { id: string; width: number; points: Array<[number, number]> }

/** Steepest grade a road may have (rise / run). Roads are cut into the terrain to respect it where possible. */
export const MAX_ROAD_GRADE = 0.12;

export const roads: RoadDef[] = [
  // Chibi Town → west across the river → Volcano Cliffs
  { id: 'west', width: 7, points: [[0, 0], [-120, -20], [-250, -47], [-360, -70], [-469, -94], [-580, -110], [-672, -125], [-745, -140]] },
  // fork → Sunset Beach
  { id: 'beach', width: 7, points: [[-250, -47], [-300, 30], [-344, 94], [-410, 150], [-469, 188], [-540, 205], [-600, 215]] },
  // fork → Lumi Forest
  { id: 'forest', width: 6, points: [[-469, -94], [-490, -160], [-520, -230], [-570, -290], [-609, -330]] },
  // Chibi Town → stadium (south meadow)
  { id: 'stadium', width: 7, points: [[0, 0], [15, 80], [31, 156], [35, 220], [35, 278]] },
  // Chibi Town → Harbor Bay
  { id: 'harbor', width: 7, points: [[0, 0], [90, 10], [188, 31], [260, 60], [313, 94], [380, 140], [440, 190]] },
  // Chibi Town → Sky Terrace (north-east)
  { id: 'skyterrace', width: 6, points: [[90, 10], [140, -40], [188, -78], [260, -130], [344, -188], [420, -230], [500, -262], [600, -280], [660, -284]] },
  // Chibi Town → Lantern Street → switchbacks up the south face of Crystal Peak to Winter Atelier (≈ 88 m climb)
  { id: 'winter', width: 6, points: [[0, 0], [0, -70], [0, -133], [-15, -200], [150, -255], [160, -275], [-150, -320], [-160, -340], [150, -380], [160, -400], [-120, -430], [-60, -462]] },
];
