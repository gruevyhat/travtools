// Quick Characters tables — Core Rulebook pp.91–92

export interface AlliesEnemiesEntry {
  d66: number;
  archetype: string;
}

export interface QuirkEntry {
  d66: number;
  quirk: string;
}

export interface ExperienceLevel {
  id: string;
  label: string;
  combatant: boolean;
  skills: { name: string; level: number }[];
  charBonuses: number[]; // added to the highest N characteristics
}

export const ALLIES_ENEMIES: AlliesEnemiesEntry[] = [
  { d66: 11, archetype: 'Naval Officer' },
  { d66: 12, archetype: 'Imperial Diplomat' },
  { d66: 13, archetype: 'Crooked Trader' },
  { d66: 14, archetype: 'Medical Doctor' },
  { d66: 15, archetype: 'Eccentric Scientist' },
  { d66: 16, archetype: 'Mercenary' },
  { d66: 21, archetype: 'Famous Performer' },
  { d66: 22, archetype: 'Alien Thief' },
  { d66: 23, archetype: 'Free Trader' },
  { d66: 24, archetype: 'Explorer' },
  { d66: 25, archetype: 'Marine Captain' },
  { d66: 26, archetype: 'Corporate Executive' },
  { d66: 31, archetype: 'Researcher' },
  { d66: 32, archetype: 'Cultural Attaché' },
  { d66: 33, archetype: 'Religious Leader' },
  { d66: 34, archetype: 'Conspirator' },
  { d66: 35, archetype: 'Rich Noble' },
  { d66: 36, archetype: 'Artificial Intelligence' },
  { d66: 41, archetype: 'Bored Noble' },
  { d66: 42, archetype: 'Planetary Governor' },
  { d66: 43, archetype: 'Inveterate Gambler' },
  { d66: 44, archetype: 'Crusading Journalist' },
  { d66: 45, archetype: 'Doomsday Cultist' },
  { d66: 46, archetype: 'Corporate Agent' },
  { d66: 51, archetype: 'Criminal Syndicate' },
  { d66: 52, archetype: 'Military Governor' },
  { d66: 53, archetype: 'Army Quartermaster' },
  { d66: 54, archetype: 'Private Investigator' },
  { d66: 55, archetype: 'Starport Administrator' },
  { d66: 56, archetype: 'Retired Admiral' },
  { d66: 61, archetype: 'Alien Ambassador' },
  { d66: 62, archetype: 'Smuggler' },
  { d66: 63, archetype: 'Weapons Inspector' },
  { d66: 64, archetype: 'Elder Statesman' },
  { d66: 65, archetype: 'Planetary Warlord' },
  { d66: 66, archetype: 'Imperial Agent' },
];

export const CHARACTER_QUIRKS: QuirkEntry[] = [
  { d66: 11, quirk: 'Loyal' },
  { d66: 12, quirk: 'Distracted by other worries' },
  { d66: 13, quirk: 'In debt to criminals' },
  { d66: 14, quirk: 'Makes very bad jokes' },
  { d66: 15, quirk: 'Will betray characters' },
  { d66: 16, quirk: 'Aggressive' },
  { d66: 21, quirk: 'Has secret allies' },
  { d66: 22, quirk: 'Secret agatahic user' },
  { d66: 23, quirk: 'Looking for something' },
  { d66: 24, quirk: 'Helpful' },
  { d66: 25, quirk: 'Forgetful' },
  { d66: 26, quirk: 'Wants to hire the Travellers' },
  { d66: 31, quirk: 'Has useful contacts' },
  { d66: 32, quirk: 'Artistic' },
  { d66: 33, quirk: 'Easily confused' },
  { d66: 34, quirk: 'Unusually ugly' },
  { d66: 35, quirk: 'Worried about current situation' },
  { d66: 36, quirk: 'Shows pictures of their children' },
  { d66: 41, quirk: 'Humour-monger' },
  { d66: 42, quirk: 'Unusually provincial' },
  { d66: 43, quirk: 'Drunkard or drug addict' },
  { d66: 44, quirk: 'Government informant' },
  { d66: 45, quirk: 'Mistakes a Traveller for someone else' },
  { d66: 46, quirk: 'Possesses unusually advanced technology' },
  { d66: 51, quirk: 'Unusually handsome or beautiful' },
  { d66: 52, quirk: 'Spying on the Travellers' },
  { d66: 53, quirk: 'Possesses TAS membership' },
  { d66: 54, quirk: 'Is secretly hostile towards the Travellers' },
  { d66: 55, quirk: 'Wants to borrow money' },
  { d66: 56, quirk: 'Is convinced the Travellers are dangerous' },
  { d66: 61, quirk: 'Involved in political intrigue' },
  { d66: 62, quirk: 'Has a dangerous secret' },
  { d66: 63, quirk: 'Wants to get off planet as soon as possible' },
  { d66: 64, quirk: 'Attracted to a Traveller' },
  { d66: 65, quirk: 'From offworld' },
  { d66: 66, quirk: 'Possesses telepathy or other unusual quality' },
];

export const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  {
    id: 'green-noncombatant',
    label: 'Green Non-combatant',
    combatant: false,
    skills: [{ name: 'Drive', level: 0 }],
    charBonuses: [],
  },
  {
    id: 'green-combatant',
    label: 'Green Combatant',
    combatant: true,
    skills: [
      { name: 'Drive', level: 0 },
      { name: 'Gun Combat', level: 0 },
      { name: 'Melee', level: 0 },
    ],
    charBonuses: [],
  },
  {
    id: 'average-noncombatant',
    label: 'Average Non-combatant',
    combatant: false,
    skills: [
      { name: 'Drive', level: 1 },
      { name: 'Profession', level: 1 },
    ],
    charBonuses: [1],
  },
  {
    id: 'average-combatant',
    label: 'Average Combatant',
    combatant: true,
    skills: [
      { name: 'Drive', level: 1 },
      { name: 'Gun Combat', level: 1 },
      { name: 'Melee', level: 1 },
      { name: 'Recon', level: 1 },
    ],
    charBonuses: [1],
  },
  {
    id: 'experienced-noncombatant',
    label: 'Experienced Non-combatant',
    combatant: false,
    skills: [
      { name: 'Admin', level: 2 },
      { name: 'Drive', level: 2 },
      { name: 'Profession', level: 2 },
    ],
    charBonuses: [1, 2],
  },
  {
    id: 'experienced-combatant',
    label: 'Experienced Combatant',
    combatant: true,
    skills: [
      { name: 'Drive', level: 2 },
      { name: 'Gun Combat', level: 2 },
      { name: 'Heavy Weapons', level: 2 },
      { name: 'Melee', level: 2 },
      { name: 'Recon', level: 2 },
    ],
    charBonuses: [1, 2],
  },
  {
    id: 'elite-noncombatant',
    label: 'Elite Non-combatant',
    combatant: false,
    skills: [
      { name: 'Admin', level: 3 },
      { name: 'Drive', level: 3 },
      { name: 'Investigate', level: 3 },
      { name: 'Profession', level: 3 },
    ],
    charBonuses: [1, 2, 3],
  },
  {
    id: 'elite-combatant',
    label: 'Elite Combatant',
    combatant: true,
    skills: [
      { name: 'Drive', level: 3 },
      { name: 'Gun Combat', level: 3 },
      { name: 'Heavy Weapons', level: 3 },
      { name: 'Melee', level: 3 },
      { name: 'Recon', level: 3 },
      { name: 'Tactics', level: 3 },
    ],
    charBonuses: [1, 2, 3],
  },
];

export function lookupD66<T extends { d66: number }>(table: T[], d66: number): T | undefined {
  return table.find(entry => entry.d66 === d66);
}
