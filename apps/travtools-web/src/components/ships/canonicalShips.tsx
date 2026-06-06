import React from 'react';

const AMBER = '#D4A017';
const CYAN = '#1FB8CD';
const HULL_BG = '#0D1F35';
const ENG_BG = '#0A1F2E';
const CARGO_BG = '#0A1828';
const GRID = '#1E3A5F';

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke={GRID} strokeWidth="0.5" opacity="0.6" />
      </pattern>
      <filter id={`${id}-glow`}>
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

interface RoomProps {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  label: string;
  sublabel?: string;
  id: string;
  rotate?: boolean;
}

function Room({ x, y, w, h, fill = HULL_BG, stroke = AMBER, label, sublabel, id, rotate }: RoomProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth="1.5" />
      {rotate ? (
        <>
          <text
            x={cx} y={cy - 4} textAnchor="middle" fill={stroke} fontSize="10"
            fontFamily="'Share Tech Mono', monospace"
            transform={`rotate(-90, ${cx}, ${cy})`}
          >{label}</text>
          {sublabel && (
            <text
              x={cx} y={cy + 10} textAnchor="middle" fill={CYAN} fontSize="9"
              fontFamily="'Share Tech Mono', monospace"
              transform={`rotate(-90, ${cx}, ${cy + 10})`}
            >{sublabel}</text>
          )}
        </>
      ) : (
        <>
          <text x={cx} y={sublabel ? cy - 5 : cy + 4} textAnchor="middle" fill={stroke} fontSize="10"
            fontFamily="'Share Tech Mono', monospace" filter={`url(#${id}-glow)`}
          >{label}</text>
          {sublabel && (
            <text x={cx} y={cy + 10} textAnchor="middle" fill={CYAN} fontSize="9"
              fontFamily="'Share Tech Mono', monospace"
            >{sublabel}</text>
          )}
        </>
      )}
    </g>
  );
}

/* ── Type-S Scout/Courier (100t) ────────────────────────────────────── */
export function ScoutCourierSVG() {
  const id = 'sc';
  return (
    <svg viewBox="0 0 820 310" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <Defs id={id} />
      <rect width="820" height="310" fill="#080C14" />
      <rect width="820" height="310" fill={`url(#${id}-grid)`} />

      {/* Title */}
      <text x="410" y="18" textAnchor="middle" fill={AMBER} fontSize="13"
        fontFamily="'Share Tech Mono', monospace" fontWeight="bold">
        TYPE-S SCOUT/COURIER — 100 DISPLACEMENT TONS
      </text>
      <text x="410" y="34" textAnchor="middle" fill={CYAN} fontSize="10"
        fontFamily="'Share Tech Mono', monospace">
        DECK PLAN · SCALE APPROXIMATE · CLASS: SURVEY
      </text>

      {/* Hull outer */}
      <path d="M 30 55 L 30 265 L 620 265 L 770 160 L 620 55 Z"
        fill="none" stroke={AMBER} strokeWidth="2.5" filter={`url(#${id}-glow)`} />

      {/* FUEL TANKS (stern, wrapping aft section) */}
      <rect x="30" y="55" width="140" height="210" fill="#091520" stroke={AMBER} strokeWidth="1" />
      <text x="100" y="148" textAnchor="middle" fill={AMBER} fontSize="10"
        fontFamily="'Share Tech Mono', monospace">FUEL</text>
      <text x="100" y="163" textAnchor="middle" fill={CYAN} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">40t</text>

      {/* ENGINEERING */}
      <Room id={id} x={170} y={55} w={130} h={130} fill={ENG_BG} stroke={CYAN}
        label="ENGINEERING" sublabel="J-DRIVE / M-DRIVE" />
      <text x="235" y="205" textAnchor="middle" fill={CYAN} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">26t</text>

      {/* POWER PLANT (lower engineering) */}
      <Room id={id} x={170} y={185} w={130} h={80} fill={ENG_BG} stroke={CYAN}
        label="POWER PLANT" sublabel="4t" />

      {/* CARGO */}
      <Room id={id} x={300} y={65} w={120} h={180} fill={CARGO_BG} label="CARGO" sublabel="6t" />

      {/* COMMON AREA */}
      <Room id={id} x={420} y={85} w={100} h={140} label="COMMON" sublabel="4t" />

      {/* STATEROOM 1 */}
      <Room id={id} x={520} y={65} w={90} h={100} label="STATEROOM 1" sublabel="4t" />

      {/* STATEROOM 2 */}
      <Room id={id} x={520} y={165} w={90} h={100} label="STATEROOM 2" sublabel="4t" />

      {/* AIRLOCK / FRESHER */}
      <rect x="610" y="100" width="30" height="120" fill="#091828" stroke={AMBER} strokeWidth="1" />
      <text x="625" y="160" textAnchor="middle" fill={AMBER} fontSize="8"
        fontFamily="'Share Tech Mono', monospace"
        transform="rotate(-90, 625, 160)">LOCK</text>

      {/* BRIDGE (tapered bow) */}
      <path d="M 640 65 L 640 255 L 770 160 Z" fill="#0A2040" stroke={AMBER} strokeWidth="1.5" />
      <text x="696" y="155" textAnchor="middle" fill={AMBER} fontSize="11"
        fontFamily="'Share Tech Mono', monospace">BRIDGE</text>
      <text x="696" y="170" textAnchor="middle" fill={CYAN} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">4t</text>

      {/* Direction labels */}
      <text x="100" y="290" textAnchor="middle" fill={GRID} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">◄ AFT / STERN</text>
      <text x="760" y="290" textAnchor="middle" fill={GRID} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">FORE / BOW ►</text>
    </svg>
  );
}

/* ── Type-A Free Trader / Beowulf (200t) ────────────────────────────── */
export function FreeTrderSVG() {
  const id = 'ft';
  return (
    <svg viewBox="0 0 920 360" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <Defs id={id} />
      <rect width="920" height="360" fill="#080C14" />
      <rect width="920" height="360" fill={`url(#${id}-grid)`} />

      {/* Title */}
      <text x="460" y="18" textAnchor="middle" fill={AMBER} fontSize="13"
        fontFamily="'Share Tech Mono', monospace" fontWeight="bold">
        TYPE-A FREE TRADER (BEOWULF CLASS) — 200 DISPLACEMENT TONS
      </text>
      <text x="460" y="34" textAnchor="middle" fill={CYAN} fontSize="10"
        fontFamily="'Share Tech Mono', monospace">
        DECK PLAN · SCALE APPROXIMATE · CLASS: MERCHANT
      </text>

      {/* Hull outer */}
      <path d="M 30 55 L 30 310 L 700 310 L 870 182 L 700 55 Z"
        fill="none" stroke={AMBER} strokeWidth="2.5" filter={`url(#${id}-glow)`} />

      {/* FUEL TANKS (port/starboard stern) */}
      <rect x="30" y="55" width="120" height="255" fill="#091520" stroke={AMBER} strokeWidth="1" />
      <text x="90" y="178" textAnchor="middle" fill={AMBER} fontSize="10"
        fontFamily="'Share Tech Mono', monospace">FUEL</text>
      <text x="90" y="193" textAnchor="middle" fill={CYAN} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">40t</text>

      {/* ENGINEERING (J-1 drive) */}
      <Room id={id} x={150} y={55} w={140} h={140} fill={ENG_BG} stroke={CYAN}
        label="ENGINEERING" sublabel="J-DRIVE / M-DRIVE" />
      <text x="220" y="215" textAnchor="middle" fill={CYAN} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">30t</text>

      {/* POWER PLANT */}
      <Room id={id} x={150} y={195} w={140} h={115} fill={ENG_BG} stroke={CYAN}
        label="POWER PLANT" sublabel="6t" />

      {/* MAIN CARGO (82t) */}
      <rect x="290" y="65" width="160" height="230" fill={CARGO_BG} stroke={AMBER} strokeWidth="1.5" />
      <text x="370" y="170" textAnchor="middle" fill={AMBER} fontSize="12"
        fontFamily="'Share Tech Mono', monospace">CARGO</text>
      <text x="370" y="188" textAnchor="middle" fill={CYAN} fontSize="10"
        fontFamily="'Share Tech Mono', monospace">82t</text>

      {/* COMMON AREA */}
      <Room id={id} x={450} y={125} w={100} h={115} label="COMMON" sublabel="4t" />

      {/* CREW STATEROOMS (×4) */}
      <Room id={id} x={550} y={65} w={90} h={65} label="CREW 1" sublabel="4t" />
      <Room id={id} x={550} y={130} w={90} h={65} label="CREW 2" sublabel="4t" />
      <Room id={id} x={550} y={195} w={90} h={65} label="CREW 3" sublabel="4t" />
      <Room id={id} x={550} y={260} w={90} h={50} label="CREW 4" sublabel="4t" />

      {/* PASSENGER STATEROOMS (×4 low passage) */}
      <Room id={id} x={450} y={65} w={100} h={60} label="PASSENGER 1" sublabel="4t" />
      <Room id={id} x={450} y={240} w={100} h={70} label="PASSENGER 2" sublabel="4t" />

      {/* AIRLOCK */}
      <rect x="640" y="130" width="30" height="130" fill="#091828" stroke={AMBER} strokeWidth="1" />
      <text x="655" y="195" textAnchor="middle" fill={AMBER} fontSize="8"
        fontFamily="'Share Tech Mono', monospace"
        transform="rotate(-90, 655, 195)">LOCK</text>

      {/* BRIDGE */}
      <path d="M 670 65 L 670 310 L 870 182 Z" fill="#0A2040" stroke={AMBER} strokeWidth="1.5" />
      <text x="742" y="177" textAnchor="middle" fill={AMBER} fontSize="11"
        fontFamily="'Share Tech Mono', monospace">BRIDGE</text>
      <text x="742" y="193" textAnchor="middle" fill={CYAN} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">20t</text>

      {/* Direction labels */}
      <text x="90" y="340" textAnchor="middle" fill={GRID} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">◄ AFT / STERN</text>
      <text x="860" y="340" textAnchor="middle" fill={GRID} fontSize="9"
        fontFamily="'Share Tech Mono', monospace">FORE / BOW ►</text>
    </svg>
  );
}

export interface CanonicalShip {
  id: string;
  name: string;
  ship_class: string;
  tonnage: number;
  Component: React.FC;
}

export const CANONICAL_SHIPS: CanonicalShip[] = [
  {
    id: 'type-s',
    name: 'Scout/Courier',
    ship_class: 'Type-S',
    tonnage: 100,
    Component: ScoutCourierSVG,
  },
  {
    id: 'type-a',
    name: 'Free Trader (Beowulf)',
    ship_class: 'Type-A',
    tonnage: 200,
    Component: FreeTrderSVG,
  },
];
