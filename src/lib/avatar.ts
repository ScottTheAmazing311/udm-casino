// SVG-based avatar maker - face shapes, eyes, mouths, accessories, colors

export interface AvatarConfig {
  skinColor: string;
  faceShape: number;
  eyes: number;
  mouth: number;
  hair: number;
  accessory: number;
  bgColor: string;
}

export const SKIN_COLORS = [
  "#FFDBB4", "#EDB98A", "#D08B5B", "#AE5D29", "#614335", "#F8D9C0",
];

export const BG_COLORS = [
  "#FF6B6B", "#A78BFA", "#F59E0B", "#34D399", "#60A5FA", "#F472B6",
  "#FB923C", "#4ADE80", "#C084FC", "#FBBF24", "#38BDF8", "#FB7185",
];

// Face shape paths (outlines)
export const FACE_SHAPES = [
  // Round
  "M50,15 C72,15 85,35 85,55 C85,78 72,90 50,90 C28,90 15,78 15,55 C15,35 28,15 50,15Z",
  // Oval
  "M50,10 C75,10 82,30 82,50 C82,75 72,92 50,92 C28,92 18,75 18,50 C18,30 25,10 50,10Z",
  // Square
  "M22,18 C22,18 78,18 78,18 C82,18 85,22 85,28 L85,75 C85,82 82,88 75,88 L25,88 C18,88 15,82 15,75 L15,28 C15,22 18,18 22,18Z",
  // Heart
  "M50,88 C25,70 10,55 10,40 C10,25 22,15 35,15 C42,15 48,20 50,25 C52,20 58,15 65,15 C78,15 90,25 90,40 C90,55 75,70 50,88Z",
];

// Eye variations (drawn relative to eye position)
export type EyeStyle =
  | { type: "circle"; r: number; happy?: never }
  | { type: "arc"; happy: boolean; r?: never };

export const EYE_STYLES: EyeStyle[] = [
  { type: "circle", r: 4 },
  { type: "circle", r: 2.5 },
  { type: "arc", happy: true },
  { type: "circle", r: 5 },
  { type: "arc", happy: false },
];

// Mouth variations
export const MOUTH_STYLES = [
  // Smile
  "M38,65 Q50,75 62,65",
  // Big smile
  "M35,62 Q50,78 65,62",
  // Straight
  "M38,66 L62,66",
  // O mouth
  "M45,64 Q50,72 55,64 Q50,68 45,64",
  // Smirk
  "M38,66 Q50,70 62,64",
];

// Hair styles (SVG paths)
export const HAIR_STYLES = [
  // None
  "",
  // Short top
  "M20,30 Q25,8 50,8 Q75,8 80,30 L75,28 Q72,14 50,14 Q28,14 25,28Z",
  // Side swept
  "M15,35 Q18,10 50,8 Q80,6 88,30 L82,25 Q75,12 50,14 Q30,16 22,30Z",
  // Spiky
  "M25,30 L30,5 L38,25 L45,2 L52,22 L60,4 L65,25 L72,8 L75,30 Q70,15 50,12 Q30,15 25,30Z",
  // Mohawk
  "M42,30 Q42,5 50,2 Q58,5 58,30 Q55,12 50,10 Q45,12 42,30Z",
];

// Accessories
export const ACCESSORY_STYLES = [
  // None
  "none",
  // Glasses
  "glasses",
  // Sunglasses
  "sunglasses",
  // Hat
  "hat",
  // Bandana
  "bandana",
];

export const DEFAULT_AVATAR: AvatarConfig = {
  skinColor: SKIN_COLORS[0],
  faceShape: 0,
  eyes: 0,
  mouth: 0,
  hair: 1,
  accessory: 0,
  bgColor: BG_COLORS[0],
};

export function getRandomAvatar(bgColor: string): AvatarConfig {
  return {
    skinColor: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
    faceShape: Math.floor(Math.random() * FACE_SHAPES.length),
    eyes: Math.floor(Math.random() * EYE_STYLES.length),
    mouth: Math.floor(Math.random() * MOUTH_STYLES.length),
    hair: Math.floor(Math.random() * HAIR_STYLES.length),
    accessory: Math.floor(Math.random() * ACCESSORY_STYLES.length),
    bgColor,
  };
}
