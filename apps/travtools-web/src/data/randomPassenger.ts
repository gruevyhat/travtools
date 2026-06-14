export interface RandomPassenger {
  d66: number;
  passenger: string;
}

export const RANDOM_PASSENGERS: RandomPassenger[] = [
  { d66: 11, passenger: 'Political refugee' },
  { d66: 12, passenger: 'Economic refugee' },
  { d66: 13, passenger: 'Starting a new life offworld' },
  { d66: 14, passenger: 'Mercenary' },
  { d66: 15, passenger: 'Spy' },
  { d66: 16, passenger: 'Corporate executive' },
  { d66: 21, passenger: 'Out to see the universe' },
  { d66: 22, passenger: 'Tourist' },
  { d66: 23, passenger: 'Wide-eyed yokel' },
  { d66: 24, passenger: 'Adventurer' },
  { d66: 25, passenger: 'Explorer' },
  { d66: 26, passenger: 'Claustrophobic' },
  { d66: 31, passenger: 'Expectant mother' },
  { d66: 32, passenger: 'Stowaway or would-be crew' },
  { d66: 33, passenger: 'Carrying something dangerous or illegal' },
  { d66: 34, passenger: 'Causes trouble' },
  { d66: 35, passenger: 'Strikingly attractive passenger' },
  { d66: 36, passenger: 'Engineer' },
  { d66: 41, passenger: 'Ex-Scout' },
  { d66: 42, passenger: 'Wanderer' },
  { d66: 43, passenger: 'Thief or other criminal' },
  { d66: 44, passenger: 'Scientist' },
  { d66: 45, passenger: 'Journalist or researcher' },
  { d66: 46, passenger: 'Entertainer' },
  { d66: 51, passenger: 'Gambler' },
  { d66: 52, passenger: 'Complaining rich noble' },
  { d66: 53, passenger: 'Eccentric rich noble' },
  { d66: 54, passenger: 'Raconteur rich noble' },
  { d66: 55, passenger: 'Diplomat on a mission' },
  { d66: 56, passenger: 'Agent on a mission' },
  { d66: 61, passenger: 'Patron' },
  { d66: 62, passenger: 'Alien' },
  { d66: 63, passenger: 'Bounty hunter' },
  { d66: 64, passenger: 'On the run' },
  { d66: 65, passenger: 'Wants to be on board for a reason' },
  { d66: 66, passenger: 'Hijacker or pirate agent' },
];

export function lookupRandomPassenger(d66: number): RandomPassenger | undefined {
  return RANDOM_PASSENGERS.find(row => row.d66 === d66);
}
