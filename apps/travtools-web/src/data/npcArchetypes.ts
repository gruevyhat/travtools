import type { ArmourItem, RangeBand, Skill, Weapon } from '../types';
import { CORE_EQUIPMENT } from './equipment';

export interface CoreNpcArchetype {
  id: string;
  name: string;
  role: string;
  source: string;
  hits: number;
  initiativeDM: number;
  rangeBand: RangeBand;
  skills: Skill[];
  weapons: Weapon[];
  armour: ArmourItem[];
}

function coreWeapon(id: string, skill: string, fallback: Omit<Weapon, 'skill'>): Weapon {
  const item = CORE_EQUIPMENT.find(entry => entry.id === id);
  return {
    name: item?.name ?? fallback.name,
    skill,
    range: item?.range ?? fallback.range,
    damage: item?.damage ?? fallback.damage,
    traits: item?.traits ?? fallback.traits,
  };
}

function naturalWeapon(name: string, damage: string, traits = ''): Weapon {
  return { name, skill: 'Melee (Natural)', range: 'Melee', damage, traits };
}

function armour(name: string, protection: number, requiredSkill: string | null = null): ArmourItem {
  return { worn: true, name, protection, radiation: null, required_skill: requiredSkill };
}

const blade = coreWeapon('weapon-blade', 'Melee (Blade)', { name: 'Blade', range: 'Melee', damage: '2D', traits: '' });
const club = coreWeapon('weapon-club', 'Melee (Bludgeon)', { name: 'Club', range: 'Melee', damage: '2D', traits: '' });
const cutlass = coreWeapon('weapon-cutlass', 'Melee (Blade)', { name: 'Cutlass', range: 'Melee', damage: '3D', traits: '' });
const dagger = coreWeapon('weapon-dagger', 'Melee (Blade)', { name: 'Dagger', range: 'Melee', damage: '1D+2', traits: '' });
const autopistol = coreWeapon('weapon-autopistol', 'Gun Combat (Slug)', { name: 'Autopistol', range: '10m', damage: '3D-3', traits: '' });
const bodyPistol = coreWeapon('weapon-body-pistol', 'Gun Combat (Slug)', { name: 'Body Pistol', range: '5m', damage: '2D', traits: '' });
const snubPistol = coreWeapon('weapon-snub-pistol', 'Gun Combat (Slug)', { name: 'Snub Pistol', range: '5m', damage: '3D-3', traits: 'Zero-G' });
const stunner = coreWeapon('weapon-stunner-tl10', 'Gun Combat (Energy)', { name: 'Stunner (TL10)', range: '5m', damage: '2D+3', traits: 'Stun, Zero-G' });
const rifle = coreWeapon('weapon-rifle', 'Gun Combat (Slug)', { name: 'Rifle', range: '250m', damage: '3D', traits: '' });
const shotgun = coreWeapon('weapon-shotgun', 'Gun Combat (Slug)', { name: 'Shotgun', range: '50m', damage: '4D', traits: 'Bulky' });
const assaultRifle = coreWeapon('weapon-assault-rifle', 'Gun Combat (Slug)', { name: 'Assault Rifle', range: '200m', damage: '3D', traits: 'Auto 2' });
const acceleratorRifle = coreWeapon('weapon-accelerator-rifle', 'Gun Combat (Slug)', { name: 'Accelerator Rifle', range: '250m', damage: '3D', traits: 'Zero-G' });
const laserPistol = coreWeapon('weapon-laser-pistol-tl11', 'Gun Combat (Energy)', { name: 'Laser Pistol (TL11)', range: '30m', damage: '3D+3', traits: 'Zero-G' });

const quickCharacters = 'Core Rules quick characters/patrons, pp. 91-93; weapons and armour, pp. 100, 124-131';
const encounters = 'Core Rules encounters and dangers, pp. 84-95; weapons and armour, pp. 100, 124-131';

export const CORE_NPC_ARCHETYPES: CoreNpcArchetype[] = [
  {
    id: 'thug',
    name: 'Thug',
    role: 'street muscle',
    source: quickCharacters,
    hits: 14,
    initiativeDM: 0,
    rangeBand: 'close',
    skills: [
      { name: 'Melee (Unarmed)', level: 1 },
      { name: 'Streetwise', level: 1 },
      { name: 'Stealth', level: 0 },
    ],
    weapons: [club, dagger],
    armour: [armour('Jack', 1)],
  },
  {
    id: 'security-patrol',
    name: 'Security Patrol',
    role: 'starport or urban security',
    source: encounters,
    hits: 18,
    initiativeDM: 1,
    rangeBand: 'short',
    skills: [
      { name: 'Gun Combat (Slug)', level: 1 },
      { name: 'Melee (Unarmed)', level: 1 },
      { name: 'Recon', level: 1 },
      { name: 'Tactics (Military)', level: 0 },
    ],
    weapons: [autopistol, stunner],
    armour: [armour('Flak Jacket (TL8)', 5)],
  },
  {
    id: 'police-officer',
    name: 'Police Officer',
    role: 'law enforcement',
    source: quickCharacters,
    hits: 16,
    initiativeDM: 0,
    rangeBand: 'close',
    skills: [
      { name: 'Gun Combat (Energy)', level: 1 },
      { name: 'Investigate', level: 1 },
      { name: 'Recon', level: 1 },
    ],
    weapons: [stunner, autopistol],
    armour: [armour('Cloth (TL7)', 5)],
  },
  {
    id: 'marine',
    name: 'Marine',
    role: 'boarding troop',
    source: quickCharacters,
    hits: 24,
    initiativeDM: 1,
    rangeBand: 'short',
    skills: [
      { name: 'Gun Combat (Slug)', level: 2 },
      { name: 'Melee (Blade)', level: 1 },
      { name: 'Tactics (Military)', level: 1 },
      { name: 'Vacc Suit', level: 1 },
    ],
    weapons: [assaultRifle, blade],
    armour: [armour('Combat Armour (TL10)', 13, 'Vacc Suit 1')],
  },
  {
    id: 'mercenary',
    name: 'Mercenary',
    role: 'professional gunhand',
    source: quickCharacters,
    hits: 20,
    initiativeDM: 1,
    rangeBand: 'medium',
    skills: [
      { name: 'Gun Combat (Slug)', level: 2 },
      { name: 'Recon', level: 1 },
      { name: 'Tactics (Military)', level: 1 },
    ],
    weapons: [rifle, blade],
    armour: [armour('Cloth (TL7)', 5)],
  },
  {
    id: 'pirate-corsair',
    name: 'Pirate Corsair',
    role: 'ship raider',
    source: quickCharacters,
    hits: 18,
    initiativeDM: 1,
    rangeBand: 'short',
    skills: [
      { name: 'Gun Combat (Slug)', level: 1 },
      { name: 'Melee (Blade)', level: 1 },
      { name: 'Stealth', level: 1 },
      { name: 'Vacc Suit', level: 0 },
    ],
    weapons: [snubPistol, cutlass],
    armour: [armour('Cloth (TL7)', 5)],
  },
  {
    id: 'assassin',
    name: 'Assassin',
    role: 'covert killer',
    source: quickCharacters,
    hits: 16,
    initiativeDM: 2,
    rangeBand: 'close',
    skills: [
      { name: 'Gun Combat (Slug)', level: 2 },
      { name: 'Melee (Blade)', level: 1 },
      { name: 'Stealth', level: 2 },
      { name: 'Recon', level: 1 },
    ],
    weapons: [bodyPistol, dagger],
    armour: [armour('Ablat', 1)],
  },
  {
    id: 'smuggler',
    name: 'Smuggler',
    role: 'criminal courier',
    source: quickCharacters,
    hits: 14,
    initiativeDM: 1,
    rangeBand: 'close',
    skills: [
      { name: 'Gun Combat (Slug)', level: 1 },
      { name: 'Deception', level: 1 },
      { name: 'Stealth', level: 1 },
    ],
    weapons: [snubPistol, blade],
    armour: [armour('Jack', 1)],
  },
  {
    id: 'imperial-agent',
    name: 'Imperial Agent',
    role: 'state operative',
    source: quickCharacters,
    hits: 18,
    initiativeDM: 2,
    rangeBand: 'short',
    skills: [
      { name: 'Gun Combat (Energy)', level: 2 },
      { name: 'Recon', level: 1 },
      { name: 'Stealth', level: 1 },
      { name: 'Tactics (Military)', level: 1 },
    ],
    weapons: [laserPistol, stunner],
    armour: [armour('Cloth (TL10)', 8)],
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'frontier operator',
    source: quickCharacters,
    hits: 16,
    initiativeDM: 1,
    rangeBand: 'medium',
    skills: [
      { name: 'Gun Combat (Slug)', level: 1 },
      { name: 'Recon', level: 1 },
      { name: 'Survival', level: 1 },
      { name: 'Vacc Suit', level: 1 },
    ],
    weapons: [rifle, blade],
    armour: [armour('Vacc Suit (TL10)', 8, 'Vacc Suit 0')],
  },
  {
    id: 'revolutionary',
    name: 'Revolutionary',
    role: 'insurgent fighter',
    source: quickCharacters,
    hits: 16,
    initiativeDM: 0,
    rangeBand: 'medium',
    skills: [
      { name: 'Gun Combat (Slug)', level: 1 },
      { name: 'Explosives', level: 1 },
      { name: 'Stealth', level: 1 },
    ],
    weapons: [rifle, dagger],
    armour: [armour('Flak Jacket (TL7)', 3)],
  },
  {
    id: 'wild-animal-chaser',
    name: 'Wild Animal: Chaser',
    role: 'predator',
    source: encounters,
    hits: 18,
    initiativeDM: 1,
    rangeBand: 'adjacent',
    skills: [
      { name: 'Athletics (Dexterity)', level: 1 },
      { name: 'Melee (Natural)', level: 1 },
      { name: 'Survival', level: 1 },
    ],
    weapons: [naturalWeapon('Bite', '1D')],
    armour: [],
  },
  {
    id: 'large-beast',
    name: 'Large Beast',
    role: 'large animal',
    source: encounters,
    hits: 36,
    initiativeDM: -1,
    rangeBand: 'adjacent',
    skills: [
      { name: 'Athletics (Strength)', level: 2 },
      { name: 'Melee (Natural)', level: 1 },
      { name: 'Survival', level: 1 },
    ],
    weapons: [naturalWeapon('Trample', '3D'), naturalWeapon('Horns', '2D')],
    armour: [armour('Natural Armour', 2)],
  },
  {
    id: 'drunken-crew',
    name: 'Drunken Crew',
    role: 'bar fight trouble',
    source: encounters,
    hits: 14,
    initiativeDM: -1,
    rangeBand: 'adjacent',
    skills: [
      { name: 'Melee (Unarmed)', level: 1 },
      { name: 'Carouse', level: 1 },
    ],
    weapons: [club, naturalWeapon('Unarmed', '1D')],
    armour: [],
  },
  {
    id: 'hijacker',
    name: 'Hijacker',
    role: 'shipboard threat',
    source: encounters,
    hits: 16,
    initiativeDM: 1,
    rangeBand: 'close',
    skills: [
      { name: 'Gun Combat (Slug)', level: 1 },
      { name: 'Melee (Blade)', level: 1 },
      { name: 'Stealth', level: 1 },
    ],
    weapons: [shotgun, dagger],
    armour: [armour('Jack', 1)],
  },
  {
    id: 'free-trader-crew',
    name: 'Free Trader Crew',
    role: 'armed merchant crew',
    source: quickCharacters,
    hits: 14,
    initiativeDM: 0,
    rangeBand: 'short',
    skills: [
      { name: 'Gun Combat (Slug)', level: 0 },
      { name: 'Mechanic', level: 1 },
      { name: 'Vacc Suit', level: 0 },
    ],
    weapons: [acceleratorRifle, blade],
    armour: [armour('Vacc Suit (TL8)', 4, 'Vacc Suit 1')],
  },
];
