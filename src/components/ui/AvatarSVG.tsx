"use client";

import {
  AvatarConfig,
  FACE_SHAPES,
  EYE_STYLES,
  MOUTH_STYLES,
  HAIR_STYLES,
  ACCESSORY_STYLES,
} from "@/lib/avatar";

interface AvatarSVGProps {
  config: AvatarConfig;
  size?: number;
}

export default function AvatarSVG({ config, size = 48 }: AvatarSVGProps) {
  const facePath = FACE_SHAPES[config.faceShape] || FACE_SHAPES[0];
  const eyeStyle = EYE_STYLES[config.eyes] || EYE_STYLES[0];
  const mouthPath = MOUTH_STYLES[config.mouth] || MOUTH_STYLES[0];
  const hairPath = HAIR_STYLES[config.hair] || "";
  const accessory = ACCESSORY_STYLES[config.accessory] || "none";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}
    >
      {/* Background */}
      <rect width="100" height="100" fill={config.bgColor} opacity="0.2" />

      {/* Face */}
      <path d={facePath} fill={config.skinColor} />

      {/* Eyes */}
      {eyeStyle.type === "circle" ? (
        <>
          <circle cx="38" cy="48" r={eyeStyle.r!} fill="#2d2d3d" />
          <circle cx="62" cy="48" r={eyeStyle.r!} fill="#2d2d3d" />
          {(eyeStyle.r ?? 0) >= 4 && (
            <>
              <circle cx={39} cy={46.5} r={1.2} fill="#fff" />
              <circle cx={63} cy={46.5} r={1.2} fill="#fff" />
            </>
          )}
        </>
      ) : eyeStyle.happy ? (
        <>
          <path d="M33,48 Q38,43 43,48" fill="none" stroke="#2d2d3d" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57,48 Q62,43 67,48" fill="none" stroke="#2d2d3d" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M33,48 Q38,52 43,48" fill="none" stroke="#2d2d3d" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57,48 Q62,52 67,48" fill="none" stroke="#2d2d3d" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {/* Mouth */}
      <path d={mouthPath} fill="none" stroke="#2d2d3d" strokeWidth="2" strokeLinecap="round" />

      {/* Hair */}
      {hairPath && <path d={hairPath} fill="#2d2d3d" />}

      {/* Accessories */}
      {accessory === "glasses" && (
        <>
          <circle cx="38" cy="48" r="9" fill="none" stroke="#333" strokeWidth="2" />
          <circle cx="62" cy="48" r="9" fill="none" stroke="#333" strokeWidth="2" />
          <line x1="47" y1="48" x2="53" y2="48" stroke="#333" strokeWidth="2" />
          <line x1="29" y1="48" x2="15" y2="45" stroke="#333" strokeWidth="1.5" />
          <line x1="71" y1="48" x2="85" y2="45" stroke="#333" strokeWidth="1.5" />
        </>
      )}
      {accessory === "sunglasses" && (
        <>
          <rect x="28" y="41" width="18" height="13" rx="3" fill="#1a1a2e" />
          <rect x="54" y="41" width="18" height="13" rx="3" fill="#1a1a2e" />
          <line x1="46" y1="47" x2="54" y2="47" stroke="#333" strokeWidth="2" />
          <line x1="28" y1="45" x2="15" y2="42" stroke="#333" strokeWidth="2" />
          <line x1="72" y1="45" x2="85" y2="42" stroke="#333" strokeWidth="2" />
          {/* Glare */}
          <rect x="30" y="43" width="5" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
          <rect x="56" y="43" width="5" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
        </>
      )}
      {accessory === "hat" && (
        <>
          <ellipse cx="50" cy="20" rx="35" ry="6" fill="#333" />
          <rect x="30" y="5" width="40" height="18" rx="8" fill="#333" />
        </>
      )}
      {accessory === "bandana" && (
        <>
          <path d="M15,32 Q50,22 85,32 L85,38 Q50,28 15,38Z" fill={config.bgColor} />
          <circle cx="75" cy="38" r="3" fill={config.bgColor} />
        </>
      )}
    </svg>
  );
}
