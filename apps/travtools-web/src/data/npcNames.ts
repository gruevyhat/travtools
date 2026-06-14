// Traveller-flavoured name pools for quick NPC generation.

const HUMAN_FIRST: string[] = [
  'Adar', 'Aiko', 'Alev', 'Arlen', 'Beatrix', 'Bram', 'Britta', 'Casimir',
  'Clea', 'Dara', 'Dion', 'Ekke', 'Emre', 'Erin', 'Faye', 'Fiona',
  'Gareth', 'Goro', 'Hana', 'Hild', 'Idris', 'Issa', 'Ivan', 'Jessa',
  'Jorn', 'Kael', 'Kira', 'Lars', 'Lena', 'Lora', 'Miro', 'Muna',
  'Neda', 'Nils', 'Oskar', 'Petra', 'Quinn', 'Raia', 'Reva', 'Shan',
  'Sven', 'Tara', 'Thane', 'Ulrik', 'Vanya', 'Wren', 'Yuri', 'Zola',
];

const HUMAN_LAST: string[] = [
  'Ashford', 'Braun', 'Chandler', 'Duvall', 'Eriksen', 'Farrow', 'Guzman',
  'Harlow', 'Inoue', 'Jansen', 'Kessler', 'Lund', 'Marchetti', 'Navarro',
  'Novak', 'Okafor', 'Petrov', 'Ramirez', 'Strauss', 'Tanaka', 'Ueda',
  'Vance', 'Webb', 'Yamamoto', 'Zelenko', 'Gusova', 'Moreau', 'Singh',
  'Okonkwo', 'Reyes', 'Lindqvist', 'Ferretti', 'Kowalski', 'Nakamura',
];

const ALIEN_NAMES: Record<string, string[]> = {
  Aslan: [
    'Ahroay', 'Akhaukh', 'Eakhau', 'Fteairl', 'Htyai', 'Iawyao',
    'Khtakhfe', 'Rrahtrl', 'Sahkukh', 'Tralyeah', 'Wyakh', 'Yeahrr',
  ],
  Vargr: [
    'Aegzue', 'Dhaegzue', 'Faengh', 'Gaekhu', 'Kfan', 'Naegz',
    'Rraek', 'Surrgh', 'Urzaeng', 'Zaegh', 'Aekhu', 'Gvurrdon',
  ],
  Zhodani: [
    'Chiavr', 'Cteniatl', 'Freniltia', 'Iavr', 'Prieviatl',
    'Rontiatl', 'Shtenchiavr', 'Tliani', 'Vreschiavr', 'Zhdantle',
  ],
  Droyne: [
    'Aay', 'Bleuu', 'Cree', 'Droa', 'Eey',
    'Frau', 'Gree', 'Hloo', 'Iay', 'Jrau',
  ],
  "K'Kree": [
    "G'naak", "K'aak", "Kr'kree", "Ll'kree", "Rr'uun",
    "Ss'rr", "T'kree", "Uu'kl", "Xx'aak", "Zz'rr",
  ],
  Hiver: [
    'Clustering-of-Stars', 'Gentle-Curiosity', 'Patient-Observer',
    'Seeking-New-Data', 'Thoughtful-Diplomat', 'Watching-From-Afar',
  ],
  Other: [
    'Xaa-Khet', 'Brruul', 'Yssath', 'Omnivek', 'Tzolaar',
    'Hverak', 'Nssuru', 'Qua-Vel', 'Drethis', 'Umbraal',
  ],
};

export const RACES: Array<{ label: string; weight: number }> = [
  { label: 'Human',   weight: 90   },
  { label: 'Vargr',   weight: 3    },
  { label: 'Aslan',   weight: 2.5  },
  { label: 'Zhodani', weight: 1.5  },
  { label: "K'Kree",  weight: 1    },
  { label: 'Hiver',   weight: 1    },
  { label: 'Droyne',  weight: 0.5  },
  { label: 'Other',   weight: 0.5  },
];

const RACE_TOTAL = RACES.reduce((s, r) => s + r.weight, 0);

export function randomRace(roller?: () => number): string {
  const r = roller ?? Math.random;
  let pick = r() * RACE_TOTAL;
  for (const race of RACES) {
    pick -= race.weight;
    if (pick <= 0) return race.label;
  }
  return 'Human';
}

export function randomName(race: string, roller?: () => number): string {
  const r = roller ?? Math.random;
  const pick = (arr: string[]) => arr[Math.floor(r() * arr.length)];
  if (race === 'Human' || race === 'Zhodani') {
    return `${pick(HUMAN_FIRST)} ${pick(HUMAN_LAST)}`;
  }
  const pool = ALIEN_NAMES[race] ?? ALIEN_NAMES['Other'];
  return pick(pool);
}
