import React from 'react';

const AMBER = '#D4A017';
const CYAN = '#1FB8CD';
const HULL_BG = '#0D1F35';
const ENG_BG = '#0A1F2E';
const CARGO_BG = '#0A1828';
const LIFE_BG = '#10243A';
const GRID = '#1E3A5F';

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke={GRID} strokeWidth="0.5" opacity="0.55" />
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
  label: string;
  id: string;
  fill?: string;
  stroke?: string;
  sublabel?: string;
  fontSize?: number;
}

function Room({ x, y, w, h, label, sublabel, id, fill = HULL_BG, stroke = AMBER, fontSize = 10 }: RoomProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth="1.4" />
      <text
        x={cx}
        y={sublabel ? cy - 4 : cy + 4}
        textAnchor="middle"
        fill={stroke}
        fontSize={fontSize}
        fontFamily="'Share Tech Mono', monospace"
        filter={`url(#${id}-glow)`}
      >
        {label}
      </text>
      {sublabel && (
        <text x={cx} y={cy + 10} textAnchor="middle" fill={CYAN} fontSize="8.5" fontFamily="'Share Tech Mono', monospace">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function DeckTitle({ x, y, title }: { x: number; y: number; title: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" fill={CYAN} fontSize="11" fontFamily="'Share Tech Mono', monospace">
      {title}
    </text>
  );
}

function LowBerthGrid({ x, y, cols, rows, id }: { x: number; y: number; cols: number; rows: number; id: string }) {
  const cells = [];
  const w = 22;
  const h = 16;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={x + col * (w + 3)}
          y={y + row * (h + 3)}
          width={w}
          height={h}
          fill="#091828"
          stroke={CYAN}
          strokeWidth="0.8"
          filter={`url(#${id}-glow)`}
        />
      );
    }
  }
  return <g>{cells}</g>;
}

/* Type-S Scout/Courier: 2 decks. Main deck has bridge, workshop, 4 staterooms,
   probe drone bay, airlock, iris valves, fuel/drives. Upper deck has cargo bay. */
export function ScoutCourierSVG() {
  const id = 'sc';
  return (
    <svg
      viewBox="0 0 980 470"
      xmlns="http://www.w3.org/2000/svg"
      className="block w-full h-auto"
      role="img"
      aria-label="Type-S Scout/Courier deck plan"
    >
      <Defs id={id} />
      <rect width="980" height="470" fill="#080C14" />
      <rect width="980" height="470" fill={`url(#${id}-grid)`} />

      <text x="490" y="22" textAnchor="middle" fill={AMBER} fontSize="14" fontFamily="'Share Tech Mono', monospace" fontWeight="bold">
        TYPE-S SCOUT/COURIER - 100 DISPLACEMENT TONS
      </text>

      <DeckTitle x={250} y={50} title="DECK 2 - MAIN" />
      <path d="M 35 78 L 35 305 L 475 305 L 600 190 L 475 78 Z" fill="none" stroke={AMBER} strokeWidth="2.4" filter={`url(#${id}-glow)`} />
      <Room id={id} x={55} y={95} w={95} h={190} fill="#091520" label="FUEL" sublabel="TANKAGE" />
      <Room id={id} x={150} y={95} w={95} h={92} fill={ENG_BG} stroke={CYAN} label="DRIVES" sublabel="J/M" />
      <Room id={id} x={150} y={187} w={95} h={98} fill={ENG_BG} stroke={CYAN} label="POWER" sublabel="PLANT" />
      <Room id={id} x={245} y={95} w={95} h={82} label="WORKSHOP" />
      <Room id={id} x={245} y={177} w={95} h={108} fill={CARGO_BG} label="PROBE" sublabel="DRONE BAY" />
      <Room id={id} x={340} y={95} w={65} h={60} label="SR 1" sublabel="4t" />
      <Room id={id} x={405} y={95} w={65} h={60} label="SR 2" sublabel="4t" />
      <Room id={id} x={340} y={155} w={65} h={60} label="SR 3" sublabel="4t" />
      <Room id={id} x={405} y={155} w={65} h={60} label="SR 4" sublabel="4t" />
      <Room id={id} x={340} y={215} w={130} h={70} fill={LIFE_BG} label="COMMON" sublabel="FRESHER" />
      <Room id={id} x={470} y={128} w={38} h={124} label="LOCK" fontSize={8} />
      <path d="M 508 95 L 508 285 L 592 190 Z" fill="#0A2040" stroke={AMBER} strokeWidth="1.5" />
      <text x="542" y="185" textAnchor="middle" fill={AMBER} fontSize="11" fontFamily="'Share Tech Mono', monospace">BRIDGE</text>
      <text x="542" y="202" textAnchor="middle" fill={CYAN} fontSize="8.5" fontFamily="'Share Tech Mono', monospace">4t</text>
      {[
        [330, 88], [470, 88], [330, 291], [470, 291],
      ].map(([x, y], i) => (
        <text key={i} x={x} y={y} textAnchor="middle" fill={CYAN} fontSize="9" fontFamily="'Share Tech Mono', monospace">IRIS</text>
      ))}
      <circle cx="505" cy="58" r="12" fill="none" stroke={AMBER} strokeWidth="1.3" />
      <text x="505" y="61" textAnchor="middle" fill={AMBER} fontSize="8" fontFamily="'Share Tech Mono', monospace">TURRET</text>

      <DeckTitle x={755} y={50} title="DECK 1 - UPPER" />
      <path d="M 650 118 L 650 272 L 835 272 L 930 195 L 835 118 Z" fill="none" stroke={AMBER} strokeWidth="2.4" filter={`url(#${id}-glow)`} />
      <Room id={id} x={680} y={145} w={185} h={100} fill={CARGO_BG} label="CARGO BAY" sublabel="DECK 1" fontSize={12} />
      <text x="865" y="116" textAnchor="middle" fill={CYAN} fontSize="9" fontFamily="'Share Tech Mono', monospace">HATCH TO MAIN</text>
    </svg>
  );
}

/* Type-A Free Trader: main deck has bridge, cargo bay, 20 low berths and drives/fuel.
   Upper deck has 10 staterooms and common area. */
export function FreeTraderSVG() {
  const id = 'ft';
  return (
    <svg
      viewBox="0 0 1060 500"
      xmlns="http://www.w3.org/2000/svg"
      className="block w-full h-auto"
      role="img"
      aria-label="Type-A Free Trader deck plan"
    >
      <Defs id={id} />
      <rect width="1060" height="500" fill="#080C14" />
      <rect width="1060" height="500" fill={`url(#${id}-grid)`} />

      <text x="530" y="22" textAnchor="middle" fill={AMBER} fontSize="14" fontFamily="'Share Tech Mono', monospace" fontWeight="bold">
        TYPE-A FREE TRADER - 200 DISPLACEMENT TONS
      </text>

      <DeckTitle x={295} y={50} title="DECK 1 - MAIN" />
      <path d="M 35 78 L 35 318 L 500 318 L 625 198 L 500 78 Z" fill="none" stroke={AMBER} strokeWidth="2.4" filter={`url(#${id}-glow)`} />
      <Room id={id} x={55} y={96} w={90} h={200} fill="#091520" label="FUEL" sublabel="40t" />
      <Room id={id} x={145} y={96} w={105} h={100} fill={ENG_BG} stroke={CYAN} label="DRIVES" sublabel="J/M" />
      <Room id={id} x={145} y={196} w={105} h={100} fill={ENG_BG} stroke={CYAN} label="POWER" sublabel="PLANT" />
      <Room id={id} x={250} y={96} w={130} h={200} fill={CARGO_BG} label="CARGO BAY" sublabel="82t" fontSize={12} />
      <Room id={id} x={380} y={96} w={116} h={132} fill={LIFE_BG} stroke={CYAN} label="20 LOW" sublabel="BERTHS" />
      <LowBerthGrid x={391} y={134} cols={4} rows={5} id={id} />
      <Room id={id} x={380} y={228} w={116} h={68} label="LOCK" sublabel="LIFT" />
      <path d="M 496 96 L 496 296 L 616 198 Z" fill="#0A2040" stroke={AMBER} strokeWidth="1.5" />
      <text x="548" y="193" textAnchor="middle" fill={AMBER} fontSize="11" fontFamily="'Share Tech Mono', monospace">BRIDGE</text>
      <text x="548" y="209" textAnchor="middle" fill={CYAN} fontSize="8.5" fontFamily="'Share Tech Mono', monospace">MAIN</text>

      <DeckTitle x={820} y={50} title="DECK 2 - UPPER" />
      <path d="M 685 88 L 685 335 L 955 335 L 1025 210 L 955 88 Z" fill="none" stroke={AMBER} strokeWidth="2.4" filter={`url(#${id}-glow)`} />
      {Array.from({ length: 10 }, (_, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        return (
          <Room
            key={i}
            id={id}
            x={710 + col * 78}
            y={108 + row * 42}
            w={78}
            h={42}
            label={`SR ${i + 1}`}
            sublabel="4t"
            fontSize={8.5}
          />
        );
      })}
      <Room id={id} x={875} y={130} w={92} h={118} fill={LIFE_BG} label="COMMON" sublabel="GALLEY" />
      <Room id={id} x={875} y={248} w={92} h={58} label="FRESHERS" />
    </svg>
  );
}

/* Type-K Safari Ship: added as a third canonical option for a distinctive
   200t expedition vessel with lounge and animal/environment spaces. */
export function SafariShipSVG() {
  const id = 'sf';
  return (
    <svg
      viewBox="0 0 1060 470"
      xmlns="http://www.w3.org/2000/svg"
      className="block w-full h-auto"
      role="img"
      aria-label="Type-K Safari Ship deck plan"
    >
      <Defs id={id} />
      <rect width="1060" height="470" fill="#080C14" />
      <rect width="1060" height="470" fill={`url(#${id}-grid)`} />
      <text x="530" y="22" textAnchor="middle" fill={AMBER} fontSize="14" fontFamily="'Share Tech Mono', monospace" fontWeight="bold">
        TYPE-K SAFARI SHIP - 200 DISPLACEMENT TONS
      </text>
      <text x="530" y="40" textAnchor="middle" fill={CYAN} fontSize="10" fontFamily="'Share Tech Mono', monospace">
        EXPEDITION / HUNTING VESSEL - WIDE HULL
      </text>

      <path d="M 55 90 L 155 60 L 835 60 L 1005 230 L 835 400 L 155 400 L 55 370 Z" fill="none" stroke={AMBER} strokeWidth="2.5" filter={`url(#${id}-glow)`} />
      <Room id={id} x={80} y={135} w={95} h={190} fill="#091520" label="FUEL" sublabel="TANKS" />
      <Room id={id} x={175} y={105} w={115} h={115} fill={ENG_BG} stroke={CYAN} label="DRIVES" sublabel="J/M" />
      <Room id={id} x={175} y={220} w={115} h={115} fill={ENG_BG} stroke={CYAN} label="POWER" sublabel="PLANT" />
      <Room id={id} x={290} y={95} w={150} h={115} fill={LIFE_BG} label="TROPHY" sublabel="LOUNGE" fontSize={12} />
      <Room id={id} x={290} y={210} w={150} h={130} fill={CARGO_BG} label="CARGO" sublabel="EXPEDITION GEAR" />
      <Room id={id} x={440} y={95} w={120} h={245} fill="#092116" stroke={CYAN} label="ANIMAL" sublabel="HABITAT" />
      <Room id={id} x={560} y={95} w={120} h={245} fill="#10243A" stroke={CYAN} label="ENVIRONMENT" sublabel="MODULES" />
      {Array.from({ length: 8 }, (_, i) => (
        <Room
          key={i}
          id={id}
          x={690 + (i % 2) * 78}
          y={92 + Math.floor(i / 2) * 54}
          w={78}
          h={54}
          label={i < 2 ? `CREW ${i + 1}` : `GUEST ${i - 1}`}
          sublabel="SR"
          fontSize={8}
        />
      ))}
      <Room id={id} x={848} y={150} w={64} h={160} label="LOCK" sublabel="LIFT" />
      <path d="M 912 115 L 912 345 L 995 230 Z" fill="#0A2040" stroke={AMBER} strokeWidth="1.5" />
      <text x="948" y="226" textAnchor="middle" fill={AMBER} fontSize="11" fontFamily="'Share Tech Mono', monospace">BRIDGE</text>
      <text x="948" y="242" textAnchor="middle" fill={CYAN} fontSize="8.5" fontFamily="'Share Tech Mono', monospace">SURVEY</text>
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
    Component: FreeTraderSVG,
  },
  {
    id: 'type-k',
    name: 'Safari Ship',
    ship_class: 'Type-K',
    tonnage: 200,
    Component: SafariShipSVG,
  },
];
