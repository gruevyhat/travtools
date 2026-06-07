export type CoreEquipmentSection =
  | 'Armour'
  | 'Augment'
  | 'Communications'
  | 'Computer'
  | 'Software'
  | 'Medicine'
  | 'Drug'
  | 'Sensor'
  | 'Survival'
  | 'Toolkit'
  | 'Weapon'
  | 'Weapon Option';

export type InventoryEquipmentCategory =
  | 'Weapon'
  | 'Armour'
  | 'Equipment'
  | 'Medicine'
  | 'Electronics'
  | 'Survival'
  | 'Other';

export interface CoreEquipmentItem {
  id: string;
  name: string;
  section: CoreEquipmentSection;
  inventoryCategory: InventoryEquipmentCategory;
  page: number;
  techLevel: number | null;
  massKg: number | null;
  costCr: number | null;
  costLabel?: string;
  range?: string;
  damage?: string | null;
  magazine?: string;
  ammoCostLabel?: string;
  traits?: string;
  details?: string[];
}

export const CORE_EQUIPMENT: CoreEquipmentItem[] = [
  // Armour, Traveller Core Rules 2022, p.100.
  { id: 'armour-jack-tl1', name: 'Jack', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 1, massKg: 2, costCr: 50, details: ['Protection +1', 'Required skill: None'] },
  { id: 'armour-mesh-tl6', name: 'Mesh', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 6, massKg: 3, costCr: 150, details: ['Protection +2', 'Required skill: None'] },
  { id: 'armour-cloth-tl7', name: 'Cloth (TL7)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 7, massKg: 7, costCr: 250, details: ['Protection +5', 'Required skill: None'] },
  { id: 'armour-cloth-tl10', name: 'Cloth (TL10)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 10, massKg: 3, costCr: 500, details: ['Protection +8'] },
  { id: 'armour-flak-jacket-tl7', name: 'Flak Jacket (TL7)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 7, massKg: 8, costCr: 100, details: ['Protection +3', 'Required skill: None'] },
  { id: 'armour-flak-jacket-tl8', name: 'Flak Jacket (TL8)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 8, massKg: 6, costCr: 300, details: ['Protection +5'] },
  { id: 'armour-reflec-tl10', name: 'Reflec', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 10, massKg: 1, costCr: 1500, details: ['Protection +10 vs lasers only', 'Required skill: None'] },
  { id: 'armour-ablat-tl9', name: 'Ablat', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 9, massKg: 2, costCr: 75, details: ['Protection +1, or +6 vs lasers only', 'Required skill: None'] },
  { id: 'armour-combat-armour-tl10', name: 'Combat Armour (TL10)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 10, massKg: 20, costCr: 96000, details: ['Protection +13', 'Rad 85', 'Required skill: Vacc Suit 1'] },
  { id: 'armour-combat-armour-tl12', name: 'Combat Armour (TL12)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 12, massKg: 16, costCr: 88000, details: ['Protection +17', 'Rad 145', 'Required skill: Vacc Suit 0'] },
  { id: 'armour-combat-armour-tl14', name: 'Combat Armour (TL14)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 14, massKg: 12, costCr: 160000, details: ['Protection +19', 'Rad 180', 'Required skill: Vacc Suit 0'] },
  { id: 'armour-vacc-suit-tl8', name: 'Vacc Suit (TL8)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 8, massKg: 28, costCr: 12000, details: ['Protection +4', 'Rad 15', 'Required skill: Vacc Suit 1'] },
  { id: 'armour-vacc-suit-tl10', name: 'Vacc Suit (TL10)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 10, massKg: 12, costCr: 10000, details: ['Protection +8', 'Rad 60', 'Required skill: Vacc Suit 0'] },
  { id: 'armour-vacc-suit-tl12', name: 'Vacc Suit (TL12)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 12, massKg: 8, costCr: 20000, details: ['Protection +10', 'Rad 90', 'Required skill: Vacc Suit 0'] },
  { id: 'armour-hev-suit-tl9', name: 'Hostile Environment Vacc Suit (TL9)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 9, massKg: 40, costCr: 24000, details: ['Protection +8', 'Rad 75', 'Required skill: Vacc Suit 1'] },
  { id: 'armour-hev-suit-tl10', name: 'Hostile Environment Vacc Suit (TL10)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 10, massKg: 30, costCr: 20000, details: ['Protection +9', 'Rad 90', 'Required skill: Vacc Suit 1'] },
  { id: 'armour-hev-suit-tl13', name: 'Hostile Environment Vacc Suit (TL13)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 13, massKg: 20, costCr: 40000, details: ['Protection +14', 'Rad 170', 'Required skill: Vacc Suit 0'] },
  { id: 'armour-hev-suit-tl14', name: 'Hostile Environment Vacc Suit (TL14)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 14, massKg: 10, costCr: 60000, details: ['Protection +15', 'Rad 185', 'Required skill: Vacc Suit 0'] },
  { id: 'armour-battle-dress-tl13', name: 'Battle Dress (TL13)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 13, massKg: 100, costCr: 200000, details: ['Protection +22', 'Rad 245', 'Required skill: Vacc Suit 2', 'Powered armour supports its own mass while active'] },
  { id: 'armour-battle-dress-tl14', name: 'Battle Dress (TL14)', section: 'Armour', inventoryCategory: 'Armour', page: 100, techLevel: 14, massKg: 100, costCr: 220000, details: ['Protection +25', 'Rad 290', 'Required skill: Vacc Suit 1', 'Powered armour supports its own mass while active'] },

  // Armour options, pp.102-104.
  { id: 'armour-option-chameleon-ir', name: 'Chameleon IR Armour Option', section: 'Armour', inventoryCategory: 'Armour', page: 102, techLevel: 12, massKg: null, costCr: 5000, details: ['Full-body suit option', 'DM-4 to detect with IR sensors'] },
  { id: 'armour-option-chameleon-vislight', name: 'Chameleon Vislight Armour Option', section: 'Armour', inventoryCategory: 'Armour', page: 102, techLevel: 13, massKg: null, costCr: 50000, details: ['Full-body suit option', 'DM-4 to spot visually'] },
  { id: 'armour-option-computer-weave-tl10', name: 'Computer Weave (Computer/0)', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 10, massKg: null, costCr: 500, details: ['Adds Computer/0 to armour'] },
  { id: 'armour-option-computer-weave-tl11', name: 'Computer Weave (Computer/1)', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 11, massKg: null, costCr: 1000, details: ['Adds Computer/1 to armour'] },
  { id: 'armour-option-computer-weave-tl13', name: 'Computer Weave (Computer/2)', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 13, massKg: null, costCr: 5000, details: ['Adds Computer/2 to armour'] },
  { id: 'armour-option-extended-life-support', name: 'Extended Life Support Armour Option', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 10, massKg: null, costCr: 10000, details: ['Suit life support upgrade', '18 hours oxygen'] },
  { id: 'armour-option-eye-protection', name: 'Eye Protection Armour Option', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 6, massKg: null, costCr: 50, details: ['Included automatically in TL9+ armour'] },
  { id: 'armour-option-grav-assist-tl12', name: 'Grav Assist Armour Option (TL12)', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 12, massKg: null, costCr: 110000, details: ['Combat armour or battle dress only', 'Adds grav belt functionality'] },
  { id: 'armour-option-grav-assist-tl15', name: 'Grav Assist Armour Option (TL15)', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 15, massKg: null, costCr: 120000, details: ['Combat armour or battle dress only', 'Longer lasting version'] },
  { id: 'armour-option-magnetic-grapples', name: 'Magnetic Grapples Armour Option', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 8, massKg: null, costCr: 100, details: ['Magnetic boot plates for zero-g shipboard movement'] },
  { id: 'armour-option-medikit-tl10', name: 'Armour Medikit (TL10)', section: 'Armour', inventoryCategory: 'Medicine', page: 104, techLevel: 10, massKg: null, costCr: 5000, details: ['Internal medical scanner and drug injector', 'Treat as Medic 3 for automatic first aid'] },
  { id: 'armour-option-medikit-tl11', name: 'Armour Medikit (TL11)', section: 'Armour', inventoryCategory: 'Medicine', page: 104, techLevel: 11, massKg: null, costCr: 10000, details: ['Military version', 'Can inject combat drugs and metabolic accelerators'] },
  { id: 'armour-option-self-sealing', name: 'Self-Sealing Armour Option', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 11, massKg: null, costCr: 2000, details: ['Repairs minor breaches and rips', 'Not available for ablat'] },
  { id: 'armour-option-smart-fabric', name: 'Smart Fabric Armour Option', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 10, massKg: null, costCr: 1000, details: ['Self-cleaning fabric'] },
  { id: 'armour-option-thruster-pack-tl9', name: 'Thruster Pack Armour Option (TL9)', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 9, massKg: null, costCr: 2000, details: ['Short-distance zero-g manoeuvring'] },
  { id: 'armour-option-thruster-pack-tl12', name: 'Thruster Pack Armour Option (TL12)', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 12, massKg: null, costCr: 14000, details: ['0.1G acceleration for up to 48 hours'] },
  { id: 'armour-option-thruster-pack-tl14', name: 'Thruster Pack Armour Option (TL14)', section: 'Armour', inventoryCategory: 'Armour', page: 104, techLevel: 14, massKg: null, costCr: 20000, details: ['Grav-thruster long-range pack'] },

  // Augments, p.106.
  { id: 'augment-cognitive-1', name: 'Cognitive Augmentation +1', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 12, massKg: null, costCr: 500000, details: ['INT +1'] },
  { id: 'augment-cognitive-2', name: 'Cognitive Augmentation +2', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 14, massKg: null, costCr: 1000000, details: ['INT +2'] },
  { id: 'augment-cognitive-3', name: 'Cognitive Augmentation +3', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 16, massKg: null, costCr: 5000000, details: ['INT +3'] },
  { id: 'augment-dexterity-1', name: 'Dexterity Augmentation +1', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 11, massKg: null, costCr: 500000, details: ['DEX +1'] },
  { id: 'augment-dexterity-2', name: 'Dexterity Augmentation +2', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 12, massKg: null, costCr: 1000000, details: ['DEX +2'] },
  { id: 'augment-dexterity-3', name: 'Dexterity Augmentation +3', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 15, massKg: null, costCr: 5000000, details: ['DEX +3'] },
  { id: 'augment-endurance-1', name: 'Endurance Augmentation +1', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 11, massKg: null, costCr: 500000, details: ['END +1'] },
  { id: 'augment-endurance-2', name: 'Endurance Augmentation +2', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 12, massKg: null, costCr: 1000000, details: ['END +2'] },
  { id: 'augment-endurance-3', name: 'Endurance Augmentation +3', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 15, massKg: null, costCr: 5000000, details: ['END +3'] },
  { id: 'augment-enhanced-vision', name: 'Enhanced Vision', section: 'Augment', inventoryCategory: 'Electronics', page: 106, techLevel: 13, massKg: null, costCr: 25000, details: ['Binoculars, IR and light intensification'] },
  { id: 'augment-neural-comm-tl10', name: 'Neural Comm (TL10)', section: 'Augment', inventoryCategory: 'Electronics', page: 106, techLevel: 10, massKg: null, costCr: 1000, details: ['Audio only'] },
  { id: 'augment-neural-comm-tl12', name: 'Neural Comm (TL12)', section: 'Augment', inventoryCategory: 'Electronics', page: 106, techLevel: 12, massKg: null, costCr: 5000, details: ['Audio and visual', 'Computer/0'] },
  { id: 'augment-neural-comm-tl14', name: 'Neural Comm (TL14)', section: 'Augment', inventoryCategory: 'Electronics', page: 106, techLevel: 14, massKg: null, costCr: 20000, details: ['Multiple forms of data', 'Computer/1'] },
  { id: 'augment-skill', name: 'Skill Augmentation', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 12, massKg: null, costCr: 50000, details: ['Skill DM+1'] },
  { id: 'augment-strength-1', name: 'Strength Augmentation +1', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 11, massKg: null, costCr: 500000, details: ['STR +1'] },
  { id: 'augment-strength-2', name: 'Strength Augmentation +2', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 12, massKg: null, costCr: 1000000, details: ['STR +2'] },
  { id: 'augment-strength-3', name: 'Strength Augmentation +3', section: 'Augment', inventoryCategory: 'Equipment', page: 106, techLevel: 15, massKg: null, costCr: 5000000, details: ['STR +3'] },
  { id: 'augment-subdermal-armour-1', name: 'Subdermal Armour +1', section: 'Augment', inventoryCategory: 'Armour', page: 106, techLevel: 10, massKg: null, costCr: 50000, details: ['Protection +1'] },
  { id: 'augment-subdermal-armour-3', name: 'Subdermal Armour +3', section: 'Augment', inventoryCategory: 'Armour', page: 106, techLevel: 11, massKg: null, costCr: 100000, details: ['Protection +3'] },
  { id: 'augment-wafer-jack-4', name: 'Wafer Jack (Bandwidth/4)', section: 'Augment', inventoryCategory: 'Electronics', page: 106, techLevel: 12, massKg: null, costCr: 10000, details: ['Capacity Bandwidth/4'] },
  { id: 'augment-wafer-jack-8', name: 'Wafer Jack (Bandwidth/8)', section: 'Augment', inventoryCategory: 'Electronics', page: 106, techLevel: 13, massKg: null, costCr: 15000, details: ['Capacity Bandwidth/8'] },

  // Communications, pp.108-109.
  { id: 'comms-radio-tl5-5km', name: 'Radio Transceiver (TL5, 5km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 5, massKg: 20, costCr: 225, range: '5km' },
  { id: 'comms-radio-tl5-50km', name: 'Radio Transceiver (TL5, 50km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 5, massKg: 70, costCr: 750, range: '50km' },
  { id: 'comms-radio-tl5-500m', name: 'Radio Transceiver (TL5, 500m)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 5, massKg: 150, costCr: 1500, range: '500m' },
  { id: 'comms-radio-tl5-5000km', name: 'Radio Transceiver (TL5, 5000km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 5, massKg: 300, costCr: 15000, range: '5,000km' },
  { id: 'comms-radio-tl8-50km', name: 'Radio Transceiver (TL8, 50km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 8, massKg: null, costCr: 75, range: '50km' },
  { id: 'comms-radio-tl9-500km', name: 'Radio Transceiver (TL9, 500km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 9, massKg: null, costCr: 500, range: '500km' },
  { id: 'comms-radio-tl9-c0-2500km', name: 'Radio Transceiver (TL9, Computer/0, 2500km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 9, massKg: null, costCr: 5000, range: '2,500km', details: ['Computer/0'] },
  { id: 'comms-radio-tl10-c0-500km', name: 'Radio Transceiver (TL10, Computer/0, 500km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 10, massKg: null, costCr: 250, range: '500km', details: ['Computer/0'] },
  { id: 'comms-radio-tl12-c0-10000km', name: 'Radio Transceiver (TL12, Computer/0, 10000km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 12, massKg: 1, costCr: 1000, range: '10,000km', details: ['Computer/0'] },
  { id: 'comms-radio-tl13-c1-1000km', name: 'Radio Transceiver (TL13, Computer/1, 1000km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 13, massKg: null, costCr: 250, range: '1,000km', details: ['Computer/1'] },
  { id: 'comms-radio-tl14-c1-3000km', name: 'Radio Transceiver (TL14, Computer/1, 3000km)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 14, massKg: null, costCr: 500, range: '3,000km', details: ['Computer/1'] },
  { id: 'comms-laser-tl9', name: 'Laser Transceiver (TL9)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 9, massKg: 1.5, costCr: 2500, range: '500km', details: ['Computer/0'] },
  { id: 'comms-laser-tl11', name: 'Laser Transceiver (TL11)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 11, massKg: 0.5, costCr: 1500, range: '500km', details: ['Computer/0'] },
  { id: 'comms-laser-tl13', name: 'Laser Transceiver (TL13)', section: 'Communications', inventoryCategory: 'Electronics', page: 108, techLevel: 13, massKg: null, costCr: 500, range: '500km', details: ['Computer/1'] },
  { id: 'comms-bug-tl5', name: 'Bug (TL5)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 5, massKg: null, costCr: 50, details: ['Audio only'] },
  { id: 'comms-bug-tl7', name: 'Bug (TL7)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 7, massKg: null, costCr: 100, details: ['Audio or visual'] },
  { id: 'comms-bug-tl9', name: 'Bug (TL9)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 9, massKg: null, costCr: 200, details: ['Audio, visual or data'] },
  { id: 'comms-bug-tl11', name: 'Bug (TL11)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 11, massKg: null, costCr: 300, details: ['Audio, visual and data'] },
  { id: 'comms-bug-tl13', name: 'Bug (TL13)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 13, massKg: null, costCr: 400, details: ['Audio, visual, data and bioscan'] },
  { id: 'comms-bug-tl15', name: 'Bug (TL15)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 15, massKg: null, costCr: 500, details: ['Audio, visual, data, bioscan and Computer/1'] },
  { id: 'comms-commdot', name: 'Commdot', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 10, massKg: null, costCr: 10, details: ['Short range hands-free communicator'] },
  { id: 'comms-mobile-tl6', name: 'Mobile Comm (TL6)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 6, massKg: null, costCr: 50, details: ['Audio only'] },
  { id: 'comms-mobile-tl8', name: 'Mobile Comm (TL8)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 8, massKg: null, costCr: 150, details: ['Audio and visual', 'Computer/0'] },
  { id: 'comms-mobile-tl10', name: 'Mobile Comm (TL10)', section: 'Communications', inventoryCategory: 'Electronics', page: 109, techLevel: 10, massKg: null, costCr: 500, details: ['Multiple forms of data', 'Computer/1'] },

  // Computers and software, pp.111-112.
  { id: 'computer-terminal', name: 'Computer Terminal', section: 'Computer', inventoryCategory: 'Electronics', page: 111, techLevel: 7, massKg: 2, costCr: 200, details: ['Computer/0'] },
  { id: 'computer-portable-tl7', name: 'Portable Computer (TL7)', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 7, massKg: 5, costCr: 500, details: ['Computer/0'] },
  { id: 'computer-portable-tl8', name: 'Portable Computer (TL8)', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 8, massKg: 2, costCr: 250, details: ['Computer/1'] },
  { id: 'computer-portable-tl9', name: 'Portable Computer (TL9)', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 9, massKg: 1, costCr: 100, details: ['Computer/1'] },
  { id: 'computer-portable-tl10', name: 'Portable Computer (TL10)', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 10, massKg: 0.5, costCr: 500, details: ['Computer/2'] },
  { id: 'computer-portable-tl11', name: 'Portable Computer (TL11)', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 11, massKg: 0.5, costCr: 300, details: ['Computer/2'] },
  { id: 'computer-portable-tl12', name: 'Portable Computer (TL12)', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 12, massKg: 0.5, costCr: 1000, details: ['Computer/3'] },
  { id: 'computer-portable-tl13', name: 'Portable Computer (TL13)', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 13, massKg: 0.5, costCr: 1500, details: ['Computer/4'] },
  { id: 'computer-portable-tl14', name: 'Portable Computer (TL14)', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 14, massKg: 0.5, costCr: 5000, details: ['Computer/5'] },
  { id: 'computer-data-display-recorder', name: 'Data Display/Recorder', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 13, massKg: null, costCr: 500, details: ['Headpiece display for linked systems'] },
  { id: 'computer-data-wafer', name: 'Data Wafer', section: 'Computer', inventoryCategory: 'Electronics', page: 112, techLevel: 10, massKg: null, costCr: 5, details: ['Standard information storage medium'] },
  { id: 'software-interface-0', name: 'Interface/0 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 7, massKg: null, costCr: 0, costLabel: 'Included', details: ['Bandwidth 0', 'Displays data'] },
  { id: 'software-intelligent-interface-1', name: 'Intelligent Interface/1 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 11, massKg: null, costCr: 100, details: ['Bandwidth 1', 'Required for using Expert software'] },
  { id: 'software-security-0', name: 'Security/0 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 8, massKg: null, costCr: 0, costLabel: 'Included', details: ['Bandwidth 0', 'Average (8+) bypass'] },
  { id: 'software-security-1', name: 'Security/1 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 10, massKg: null, costCr: 200, details: ['Bandwidth 1', 'Difficult (10+) bypass'] },
  { id: 'software-security-2', name: 'Security/2 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 11, massKg: null, costCr: 1000, details: ['Bandwidth 2', 'Very Difficult (12+) bypass'] },
  { id: 'software-security-3', name: 'Security/3 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 12, massKg: null, costCr: 20000, details: ['Bandwidth 3', 'Formidable (14+) bypass'] },
  { id: 'software-intrusion-1', name: 'Intrusion/1 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 10, massKg: null, costCr: 1000, details: ['Bandwidth 1', 'Often illegal'] },
  { id: 'software-intrusion-2', name: 'Intrusion/2 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 11, massKg: null, costCr: 10000, details: ['Bandwidth 2', 'Often illegal'] },
  { id: 'software-intrusion-3', name: 'Intrusion/3 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 13, massKg: null, costCr: 100000, details: ['Bandwidth 3', 'Often illegal'] },
  { id: 'software-intrusion-4', name: 'Intrusion/4 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 15, massKg: null, costCr: 1000000, details: ['Bandwidth 4', 'Often illegal'] },
  { id: 'software-expert-1', name: 'Expert/1 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 11, massKg: null, costCr: 1000, details: ['Bandwidth 1', 'Mimics a skill'] },
  { id: 'software-expert-2', name: 'Expert/2 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 12, massKg: null, costCr: 10000, details: ['Bandwidth 2', 'Mimics a skill'] },
  { id: 'software-expert-3', name: 'Expert/3 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 13, massKg: null, costCr: 100000, details: ['Bandwidth 3', 'Mimics a skill'] },
  { id: 'software-translator-0', name: 'Translator/0 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 9, massKg: null, costCr: 50, details: ['Bandwidth 0', 'Near-real-time translation'] },
  { id: 'software-translator-1', name: 'Translator/1 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 10, massKg: null, costCr: 500, details: ['Bandwidth 1', 'Real-time translation'] },
  { id: 'software-database', name: 'Database Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 7, massKg: null, costCr: null, costLabel: 'Cr 10-10,000', details: ['Searchable information store'] },
  { id: 'software-agent-0', name: 'Agent/0 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 11, massKg: null, costCr: 500, details: ['Bandwidth 0', 'Electronics (computers) 0'] },
  { id: 'software-agent-1', name: 'Agent/1 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 12, massKg: null, costCr: 2000, details: ['Bandwidth 1', 'Electronics (computers) 1'] },
  { id: 'software-agent-2', name: 'Agent/2 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 13, massKg: null, costCr: 100000, details: ['Bandwidth 2', 'Electronics (computers) 2'] },
  { id: 'software-agent-3', name: 'Agent/3 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 14, massKg: null, costCr: 250000, details: ['Bandwidth 3', 'Electronics (computers) 3'] },
  { id: 'software-intellect-1', name: 'Intellect/1 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 12, massKg: null, costCr: 2000, details: ['Bandwidth 1', 'Can use Expert systems'] },
  { id: 'software-intellect-2', name: 'Intellect/2 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 13, massKg: null, costCr: 50000, details: ['Bandwidth 2', 'Can use Expert systems'] },
  { id: 'software-intellect-3', name: 'Intellect/3 Software', section: 'Software', inventoryCategory: 'Electronics', page: 111, techLevel: 14, massKg: null, costCr: 200000, details: ['Bandwidth 3', 'Can use Expert systems'] },

  // Medical supplies and drugs, pp.114-115.
  { id: 'medicine-cryoberth', name: 'Cryoberth', section: 'Medicine', inventoryCategory: 'Medicine', page: 114, techLevel: 10, massKg: 200, costCr: 50000, details: ['Fast-freezing emergency stasis berth'] },
  { id: 'medicine-medikit-tl8', name: 'Medikit (TL8)', section: 'Medicine', inventoryCategory: 'Medicine', page: 114, techLevel: 8, massKg: 1, costCr: 1000, details: ['Field diagnostic and treatment kit'] },
  { id: 'medicine-medikit-tl10', name: 'Medikit (TL10)', section: 'Medicine', inventoryCategory: 'Medicine', page: 114, techLevel: 10, massKg: 1, costCr: 1500, details: ['DM+1 on Medic checks for first aid'] },
  { id: 'medicine-medikit-tl12', name: 'Medikit (TL12)', section: 'Medicine', inventoryCategory: 'Medicine', page: 114, techLevel: 12, massKg: 1, costCr: 5000, details: ['DM+2 on Medic checks for first aid'] },
  { id: 'medicine-medikit-tl14', name: 'Medikit (TL14)', section: 'Medicine', inventoryCategory: 'Medicine', page: 114, techLevel: 14, massKg: 0, costCr: 10000, details: ['DM+3 on Medic checks for first aid'] },
  { id: 'drug-anagathics', name: 'Anagathics', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 15, massKg: null, costCr: 20000, costLabel: 'Cr 20,000/dose', details: ['Monthly dose slows ageing'] },
  { id: 'drug-anti-rad', name: 'Anti-rad', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 8, massKg: null, costCr: 1000, costLabel: 'Cr 1,000/dose', details: ['Absorbs up to 100 rads per dose'] },
  { id: 'drug-combat-drugs', name: 'Combat Drugs', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 10, massKg: null, costCr: 1000, costLabel: 'Cr 1,000/dose', details: ['DM+4 Initiative, one free Reaction, damage -2'] },
  { id: 'drug-fast-drug', name: 'Fast Drug', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 10, massKg: null, costCr: 200, costLabel: 'Cr 200/dose', details: ['Slows metabolism 60:1'] },
  { id: 'drug-medicinal-drugs', name: 'Medicinal Drugs', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 5, massKg: null, costCr: null, costLabel: 'Cr 5+', details: ['Vaccines, antitoxins and antibiotics'] },
  { id: 'drug-metabolic-accelerator', name: 'Metabolic Accelerator', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 10, massKg: null, costCr: 500, costLabel: 'Cr 500/dose', details: ['DM+8 Initiative and two free Reactions'] },
  { id: 'drug-panaceas', name: 'Panaceas', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 8, massKg: null, costCr: 200, costLabel: 'Cr 200/dose', details: ['Allows Medic check as Medic 0 for infection or disease'] },
  { id: 'drug-slow-drug', name: 'Slow Drug', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 11, massKg: null, costCr: 500, costLabel: 'Cr 500/dose', details: ['Medical-facility healing accelerator'] },
  { id: 'drug-stims', name: 'Stims', section: 'Drug', inventoryCategory: 'Medicine', page: 115, techLevel: 8, massKg: null, costCr: 50, costLabel: 'Cr 50/dose', details: ['Removes Fatigue, with damage cost'] },

  // Sensors, pp.116-117.
  { id: 'sensor-binoculars-tl3', name: 'Binoculars (TL3)', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 3, massKg: 1, costCr: 75, details: ['See further'] },
  { id: 'sensor-binoculars-tl8', name: 'Binoculars (TL8)', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 8, massKg: 1, costCr: 750, details: ['Image capture and light intensification'] },
  { id: 'sensor-binoculars-tl12', name: 'Binoculars (TL12)', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 12, massKg: 1, costCr: 3500, details: ['Portable Radiation Imaging System'] },
  { id: 'sensor-bioscanner', name: 'Bioscanner', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 15, massKg: 3.5, costCr: 350000, details: ['Organic molecule and chemical analyser'] },
  { id: 'sensor-densitometer', name: 'Densitometer', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 14, massKg: 5, costCr: 20000, details: ['Remote density imaging'] },
  { id: 'sensor-em-probe', name: 'EM Probe', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 10, massKg: 1, costCr: 1000, details: ['Detects electromagnetic emissions'] },
  { id: 'sensor-geiger-counter-tl5', name: 'Geiger Counter (TL5)', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 5, massKg: 2, costCr: 250, details: ['Detects radiation'] },
  { id: 'sensor-geiger-counter-tl10', name: 'Geiger Counter (TL10)', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 10, massKg: null, costCr: 150, details: ['Detects radiation'] },
  { id: 'sensor-ir-goggles', name: 'IR Goggles', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 6, massKg: null, costCr: 500, details: ['See heat-emitting sources in darkness'] },
  { id: 'sensor-light-intensifier-tl7', name: 'Light Intensifier Goggles (TL7)', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 7, massKg: 1, costCr: 500, details: ['See in less than total darkness'] },
  { id: 'sensor-light-intensifier-tl9', name: 'Light Intensifier Goggles (TL9)', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 9, massKg: null, costCr: 1250, details: ['Combines light intensifier and IR goggles'] },
  { id: 'sensor-nas', name: 'Neural Activity Scanner', section: 'Sensor', inventoryCategory: 'Electronics', page: 116, techLevel: 15, massKg: 10, costCr: 35000, details: ['Detects neural activity up to 500m'] },

  // Survival gear and structure options, pp.118-120.
  { id: 'survival-artificial-gill', name: 'Artificial Gill', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 8, massKg: 4, costCr: 4000, details: ['Extracts oxygen from water on breathable-atmosphere worlds'] },
  { id: 'survival-breather-mask-tl8', name: 'Breather Mask (TL8)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 8, massKg: null, costCr: 150, details: ['Combined filter and respirator'] },
  { id: 'survival-breather-mask-tl10', name: 'Breather Mask (TL10)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 10, massKg: null, costCr: 2000, details: ['Miniaturised combined filter and respirator'] },
  { id: 'survival-climbing-kit-tl4', name: 'Climbing Kit (TL4)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 4, massKg: 4, costCr: 100, details: ['DM+1 to climb rock surfaces'] },
  { id: 'survival-climbing-kit-tl8', name: 'Climbing Kit (TL8)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 8, massKg: 2, costCr: 500, details: ['DM+2 to climb rock surfaces'] },
  { id: 'survival-environment-suit', name: 'Environment Suit', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 8, massKg: 1, costCr: 500, details: ['Protects from extreme cold or heat'] },
  { id: 'survival-filter-mask', name: 'Filter Mask', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 7, massKg: null, costCr: 100, details: ['Filters harmful air elements'] },
  { id: 'survival-grav-belt', name: 'Grav Belt', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 12, massKg: 6, costCr: 100000, details: ['Allows wearer to fly at Medium speed'] },
  { id: 'survival-habitat-module-tl8', name: 'Habitat Module (TL8)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 8, massKg: 1000, costCr: 10000, details: ['Unpressurised quarters for six', 'One week rations and battery power'] },
  { id: 'survival-habitat-module-tl10', name: 'Habitat Module (TL10)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 10, massKg: 500, costCr: 20000, details: ['Pressurised quarters for six', 'One week life support'] },
  { id: 'survival-portable-fusion-generator', name: 'Portable Fusion Generator', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 10, massKg: 20, costCr: 500000, details: ['Light-duty generator for recharging equipment'] },
  { id: 'survival-radiation-suit', name: 'Radiation Suit', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 6, massKg: 10, costCr: 5000, details: ['Reduces radiation exposure by 100 rads'] },
  { id: 'survival-rescue-bubble', name: 'Rescue Bubble', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 9, massKg: 2, costCr: 600, details: ['Emergency bubble with two person-hours life support'] },
  { id: 'survival-respirator-tl6', name: 'Respirator (TL6)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 6, massKg: null, costCr: 100, details: ['For thin atmospheres'] },
  { id: 'survival-respirator-tl10', name: 'Respirator (TL10)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 10, massKg: null, costCr: 2000, details: ['Miniaturised respirator'] },
  { id: 'survival-tent-tl3', name: 'Tent (TL3)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 3, massKg: 6, costCr: 200, details: ['Weather shelter for two'] },
  { id: 'survival-tent-tl7', name: 'Tent (TL7)', section: 'Survival', inventoryCategory: 'Survival', page: 118, techLevel: 7, massKg: 5, costCr: 2000, details: ['Pressurisable shelter for two'] },
  { id: 'survival-option-climate-controlled', name: 'Climate Controlled Structure Option', section: 'Survival', inventoryCategory: 'Survival', page: 120, techLevel: 10, massKg: null, costCr: 500, details: ['Temperature and comfort control for structures'] },
  { id: 'survival-option-self-assembling', name: 'Self-Assembling Structure Option', section: 'Survival', inventoryCategory: 'Survival', page: 120, techLevel: 11, massKg: null, costCr: 5000, details: ['Shelter setup reduced to one man-hour'] },
  { id: 'survival-option-self-sealing', name: 'Self-Sealing Structure Option', section: 'Survival', inventoryCategory: 'Survival', page: 120, techLevel: 13, massKg: null, costCr: 2000, details: ['Repairs small breaches and rips'] },

  // Toolkits, pp.120-123.
  { id: 'toolkit-electronics', name: 'Electronics Toolkit', section: 'Toolkit', inventoryCategory: 'Equipment', page: 120, techLevel: 7, massKg: 2, costCr: 2000, details: ['For Electronics repairs and installation'] },
  { id: 'toolkit-engineering', name: 'Engineering Toolkit', section: 'Toolkit', inventoryCategory: 'Equipment', page: 120, techLevel: 12, massKg: 12, costCr: 4000, details: ['For Engineering repairs and installation'] },
  { id: 'toolkit-forensics', name: 'Forensics Toolkit', section: 'Toolkit', inventoryCategory: 'Equipment', page: 120, techLevel: 8, massKg: 12, costCr: 2000, details: ['For crime scene investigation and sample testing'] },
  { id: 'toolkit-mechanical', name: 'Mechanical Toolkit', section: 'Toolkit', inventoryCategory: 'Equipment', page: 120, techLevel: 5, massKg: 12, costCr: 1000, details: ['For repairs and construction'] },
  { id: 'toolkit-scientific', name: 'Scientific Toolkit', section: 'Toolkit', inventoryCategory: 'Equipment', page: 120, techLevel: 5, massKg: 8, costCr: 2000, details: ['For scientific testing and analysis'] },
  { id: 'toolkit-surveying', name: 'Surveying Toolkit', section: 'Toolkit', inventoryCategory: 'Equipment', page: 120, techLevel: 6, massKg: 12, costCr: 1000, details: ['For planetary surveys or mapping'] },
  { id: 'toolkit-science-archaeology', name: 'Science Toolkit (Archaeology)', section: 'Toolkit', inventoryCategory: 'Equipment', page: 123, techLevel: 12, massKg: 8, costCr: 2000, details: ['DM+2 to Science checks for the speciality'] },
  { id: 'toolkit-science-cybernetics', name: 'Science Toolkit (Cybernetics)', section: 'Toolkit', inventoryCategory: 'Equipment', page: 123, techLevel: 12, massKg: 8, costCr: 2000, details: ['DM+2 to Science checks for the speciality'] },
  { id: 'toolkit-science-life', name: 'Science Toolkit (Life Sciences)', section: 'Toolkit', inventoryCategory: 'Equipment', page: 123, techLevel: 12, massKg: 8, costCr: 2000, details: ['DM+2 to Science checks for the speciality'] },
  { id: 'toolkit-science-physical', name: 'Science Toolkit (Physical Sciences)', section: 'Toolkit', inventoryCategory: 'Equipment', page: 123, techLevel: 12, massKg: 8, costCr: 2000, details: ['DM+2 to Science checks for the speciality'] },
  { id: 'toolkit-science-planetology', name: 'Science Toolkit (Planetology)', section: 'Toolkit', inventoryCategory: 'Equipment', page: 123, techLevel: 12, massKg: 8, costCr: 2000, details: ['DM+2 to Science checks for the speciality'] },
  { id: 'toolkit-science-psionicology', name: 'Science Toolkit (Psionicology)', section: 'Toolkit', inventoryCategory: 'Equipment', page: 123, techLevel: 12, massKg: 8, costCr: 2000, details: ['DM+2 to Science checks for the speciality', 'Often contraband where psionics are prohibited'] },
  { id: 'toolkit-science-robotics', name: 'Science Toolkit (Robotics)', section: 'Toolkit', inventoryCategory: 'Equipment', page: 123, techLevel: 12, massKg: 8, costCr: 2000, details: ['DM+2 to Science checks for the speciality'] },
  { id: 'toolkit-science-space', name: 'Science Toolkit (Space Sciences)', section: 'Toolkit', inventoryCategory: 'Equipment', page: 123, techLevel: 12, massKg: 8, costCr: 2000, details: ['DM+2 to Science checks for the speciality'] },
  { id: 'toolkit-science-expert-package', name: 'Science Expert Package', section: 'Toolkit', inventoryCategory: 'Electronics', page: 123, techLevel: 12, massKg: 1, costCr: 2000, details: ['DM+2 to checks in the speciality'] },

  // Melee weapons, p.124.
  { id: 'weapon-blade', name: 'Blade', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 2, massKg: 1, costCr: 100, range: 'Melee', damage: '2D' },
  { id: 'weapon-broadsword', name: 'Broadsword', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 2, massKg: 2, costCr: 500, range: 'Melee', damage: '4D', traits: 'Bulky' },
  { id: 'weapon-club', name: 'Club', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 1, massKg: 2, costCr: null, range: 'Melee', damage: '2D' },
  { id: 'weapon-cutlass', name: 'Cutlass', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 2, massKg: 0.5, costCr: 200, range: 'Melee', damage: '3D' },
  { id: 'weapon-dagger', name: 'Dagger', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 1, massKg: 0.5, costCr: 10, range: 'Melee', damage: '1D+2' },
  { id: 'weapon-improvised', name: 'Improvised Weapon', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: null, massKg: null, costCr: null, range: 'Melee', damage: '2D-2' },
  { id: 'weapon-rapier', name: 'Rapier', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 3, massKg: 0.5, costCr: 200, range: 'Melee', damage: '2D', details: ['DM+1 for parrying'] },
  { id: 'weapon-shield', name: 'Shield', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 1, massKg: 2, costCr: 150, range: 'Melee', damage: '1D', details: ['Increases effective Melee skill by +1 when parrying'] },
  { id: 'weapon-staff', name: 'Staff', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 1, massKg: 2, costCr: null, range: 'Melee', damage: '2D' },
  { id: 'weapon-stunstick', name: 'Stunstick', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: 8, massKg: 0.5, costCr: 300, range: 'Melee', damage: '2D', traits: 'Stun' },
  { id: 'weapon-unarmed', name: 'Unarmed', section: 'Weapon', inventoryCategory: 'Weapon', page: 124, techLevel: null, massKg: null, costCr: null, range: 'Melee', damage: '1D' },

  // Slug throwers, p.126.
  { id: 'weapon-antique-pistol', name: 'Antique Pistol', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 2, massKg: 0.5, costCr: 100, range: '5m', damage: '2D-3', magazine: '1', ammoCostLabel: 'Cr 5' },
  { id: 'weapon-autopistol', name: 'Autopistol', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 5, massKg: 1, costCr: 200, range: '10m', damage: '3D-3', magazine: '15', ammoCostLabel: 'Cr 10' },
  { id: 'weapon-body-pistol', name: 'Body Pistol', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 8, massKg: null, costCr: 500, range: '5m', damage: '2D', magazine: '6', ammoCostLabel: 'Cr 10', details: ['DM-4 to detect with Electronics (sensors)'] },
  { id: 'weapon-gauss-pistol', name: 'Gauss Pistol', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 13, massKg: 1, costCr: 500, range: '20m', damage: '3D', magazine: '40', ammoCostLabel: 'Cr 20', traits: 'AP 3, Auto 2' },
  { id: 'weapon-revolver', name: 'Revolver', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 4, massKg: 0.5, costCr: 150, range: '10m', damage: '3D-3', magazine: '6', ammoCostLabel: 'Cr 5' },
  { id: 'weapon-snub-pistol', name: 'Snub Pistol', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 8, massKg: null, costCr: 150, range: '5m', damage: '3D-3', magazine: '6', ammoCostLabel: 'Cr 10', traits: 'Zero-G' },
  { id: 'weapon-accelerator-rifle', name: 'Accelerator Rifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 9, massKg: 2, costCr: 900, range: '250m', damage: '3D', magazine: '15', ammoCostLabel: 'Cr 30', traits: 'Zero-G' },
  { id: 'weapon-advanced-combat-rifle', name: 'Advanced Combat Rifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 10, massKg: 3, costCr: 1000, range: '450m', damage: '3D', magazine: '40', ammoCostLabel: 'Cr 15', traits: 'Auto 3, Scope' },
  { id: 'weapon-40mm-grenade', name: '40mm Grenade', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: null, massKg: null, costCr: null, range: '250m', damage: 'Grenade', magazine: '1', ammoCostLabel: 'As grenade' },
  { id: 'weapon-antique-rifle', name: 'Antique Rifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 2, massKg: 3, costCr: 150, range: '25m', damage: '3D-3', magazine: '1', ammoCostLabel: 'Cr 10' },
  { id: 'weapon-assault-rifle', name: 'Assault Rifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 7, massKg: 4, costCr: 500, range: '200m', damage: '3D', magazine: '30', ammoCostLabel: 'Cr 15', traits: 'Auto 2' },
  { id: 'weapon-autorifle', name: 'Autorifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 6, massKg: 5, costCr: 750, range: '300m', damage: '3D', magazine: '20', ammoCostLabel: 'Cr 10', traits: 'Auto 2' },
  { id: 'weapon-gauss-rifle', name: 'Gauss Rifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 12, massKg: 4, costCr: 1500, range: '600m', damage: '4D', magazine: '80', ammoCostLabel: 'Cr 40', traits: 'AP 5, Auto 3, Scope' },
  { id: 'weapon-rifle', name: 'Rifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 5, massKg: 3, costCr: 200, range: '250m', damage: '3D', magazine: '5', ammoCostLabel: 'Cr 10' },
  { id: 'weapon-shotgun', name: 'Shotgun', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 4, massKg: 4, costCr: 200, range: '50m', damage: '4D', magazine: '6', ammoCostLabel: 'Cr 10', traits: 'Bulky' },
  { id: 'weapon-submachine-gun', name: 'Submachine Gun', section: 'Weapon', inventoryCategory: 'Weapon', page: 126, techLevel: 6, massKg: 3, costCr: 400, range: '25m', damage: '3D', magazine: '20', ammoCostLabel: 'Cr 10', traits: 'Auto 3' },

  // Energy weapons, p.129.
  { id: 'weapon-laser-pistol-tl9', name: 'Laser Pistol (TL9)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 9, massKg: 2, costCr: 2000, range: '20m', damage: '3D', magazine: '100', ammoCostLabel: 'Power pack Cr 1,000', traits: 'Zero-G' },
  { id: 'weapon-laser-pistol-tl11', name: 'Laser Pistol (TL11)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 11, massKg: 1, costCr: 3000, range: '30m', damage: '3D+3', magazine: '100', ammoCostLabel: 'Power pack Cr 1,200', traits: 'Zero-G' },
  { id: 'weapon-stunner-tl8', name: 'Stunner (TL8)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 8, massKg: 0.5, costCr: 500, range: '5m', damage: '2D', magazine: '100', ammoCostLabel: 'Power pack Cr 200', traits: 'Stun, Zero-G' },
  { id: 'weapon-stunner-tl10', name: 'Stunner (TL10)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 10, massKg: null, costCr: 750, range: '5m', damage: '2D+3', magazine: '100', ammoCostLabel: 'Power pack Cr 200', traits: 'Stun, Zero-G' },
  { id: 'weapon-stunner-tl12', name: 'Stunner (TL12)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 12, massKg: null, costCr: 1000, range: '10m', damage: '3D', magazine: '100', ammoCostLabel: 'Power pack Cr 200', traits: 'Stun, Zero-G' },
  { id: 'weapon-laser-carbine-tl9', name: 'Laser Carbine (TL9)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 9, massKg: 4, costCr: 2500, range: '150m', damage: '4D', magazine: '50', ammoCostLabel: 'Power pack Cr 1,000', traits: 'Zero-G' },
  { id: 'weapon-laser-carbine-tl11', name: 'Laser Carbine (TL11)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 11, massKg: 2, costCr: 4000, range: '200m', damage: '4D+3', magazine: '50', ammoCostLabel: 'Power pack Cr 3,000', traits: 'Zero-G' },
  { id: 'weapon-laser-rifle-tl9', name: 'Laser Rifle (TL9)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 9, massKg: 5, costCr: 3500, range: '200m', damage: '5D', magazine: '100', ammoCostLabel: 'Power pack Cr 1,500', traits: 'Zero-G' },
  { id: 'weapon-laser-rifle-tl11', name: 'Laser Rifle (TL11)', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 11, massKg: 3, costCr: 8000, range: '400m', damage: '5D+3', magazine: '100', ammoCostLabel: 'Power pack Cr 3,500', traits: 'Zero-G' },
  { id: 'weapon-laser-sniper-rifle', name: 'Laser Sniper Rifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 12, massKg: 4, costCr: 9000, range: '600m', damage: '5D+3', magazine: '6', ammoCostLabel: 'Power pack Cr 250', traits: 'Scope, Zero-G' },
  { id: 'weapon-plasma-rifle', name: 'Plasma Rifle', section: 'Weapon', inventoryCategory: 'Weapon', page: 129, techLevel: 16, massKg: 4, costCr: 100000, range: '300m', damage: '6D', magazine: 'Unlimited' },

  // Grenades, p.131.
  { id: 'weapon-grenade-aerosol', name: 'Aerosol Grenade', section: 'Weapon', inventoryCategory: 'Weapon', page: 131, techLevel: 9, massKg: 0.5, costCr: 15, range: '20m', damage: null, traits: 'Blast 9', details: ['Reduces laser damage through mist by -10'] },
  { id: 'weapon-grenade-frag', name: 'Frag Grenade', section: 'Weapon', inventoryCategory: 'Weapon', page: 131, techLevel: 6, massKg: 0.5, costCr: 30, range: '20m', damage: '5D', traits: 'Blast 9' },
  { id: 'weapon-grenade-smoke', name: 'Smoke Grenade', section: 'Weapon', inventoryCategory: 'Weapon', page: 131, techLevel: 6, massKg: 0.5, costCr: 15, range: '20m', damage: null, traits: 'Blast 9', details: ['Smoke imposes DM-2 to attacks on targets in cloud'] },
  { id: 'weapon-grenade-stun', name: 'Stun Grenade', section: 'Weapon', inventoryCategory: 'Weapon', page: 131, techLevel: 7, massKg: 0.5, costCr: 30, range: '20m', damage: '3D', traits: 'Blast 9, Stun' },

  // Heavy weapons, p.132.
  { id: 'weapon-fghp-14', name: 'FGHP-14', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 14, massKg: 12, costCr: 100000, range: '450m', damage: '2DD', traits: 'Radiation, Very Bulky' },
  { id: 'weapon-fghp-15', name: 'FGHP-15', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 15, massKg: 12, costCr: 400000, range: '450m', damage: '2DD', traits: 'Bulky, Radiation' },
  { id: 'weapon-fghp-16', name: 'FGHP-16', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 16, massKg: 15, costCr: 500000, range: '450m', damage: '2DD', traits: 'Radiation' },
  { id: 'weapon-grenade-launcher', name: 'Grenade Launcher', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 7, massKg: 6, costCr: 400, range: '100m', damage: 'As grenade', magazine: '6', ammoCostLabel: 'As grenades', traits: 'Bulky' },
  { id: 'weapon-machinegun', name: 'Machinegun', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 6, massKg: 10, costCr: 1500, range: '500m', damage: '3D', magazine: '60', ammoCostLabel: 'Cr 100', traits: 'Auto 4' },
  { id: 'weapon-pghp-12', name: 'PGHP-12', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 12, massKg: 10, costCr: 20000, range: '250m', damage: '1DD', traits: 'Very Bulky' },
  { id: 'weapon-pghp-13', name: 'PGHP-13', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 13, massKg: 10, costCr: 65000, range: '450m', damage: '1DD', traits: 'Bulky' },
  { id: 'weapon-pghp-14', name: 'PGHP-14', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 14, massKg: 10, costCr: 100000, range: '450m', damage: '1DD' },
  { id: 'weapon-ram-grenade-launcher', name: 'RAM Grenade Launcher', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 8, massKg: 2, costCr: 800, range: '250m', damage: 'As grenade', magazine: '6', ammoCostLabel: 'As grenades', traits: 'Auto 3, Bulky' },
  { id: 'weapon-rocket-launcher-tl6', name: 'Rocket Launcher (TL6)', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 6, massKg: 8, costCr: 2000, range: '120m', damage: '4D', magazine: '1', ammoCostLabel: 'Cr 300', traits: 'Blast 6' },
  { id: 'weapon-rocket-launcher-tl7', name: 'Rocket Launcher (TL7)', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 7, massKg: 8, costCr: 2000, range: '150m', damage: '4D+3', magazine: '1', ammoCostLabel: 'Cr 400', traits: 'Blast 6, Smart' },
  { id: 'weapon-rocket-launcher-tl8', name: 'Rocket Launcher (TL8)', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 8, massKg: 8, costCr: 2000, range: '200m', damage: '5D', magazine: '2', ammoCostLabel: 'Cr 600', traits: 'Blast 6, Scope, Smart' },
  { id: 'weapon-rocket-launcher-tl9', name: 'Rocket Launcher (TL9)', section: 'Weapon', inventoryCategory: 'Weapon', page: 132, techLevel: 9, massKg: 8, costCr: 2000, range: '250m', damage: '5D+6', magazine: '2', ammoCostLabel: 'Cr 800', traits: 'Blast 6, Scope, Smart' },

  // Explosives and weapon options, pp.134-135.
  { id: 'weapon-explosive-plastic', name: 'Plastic Explosive', section: 'Weapon', inventoryCategory: 'Weapon', page: 134, techLevel: 6, massKg: null, costCr: 200, damage: '3D', traits: 'Blast 9' },
  { id: 'weapon-explosive-pocket-nuke', name: 'Pocket Nuke', section: 'Weapon', inventoryCategory: 'Weapon', page: 134, techLevel: 12, massKg: 4, costCr: 250000, damage: '6DD', traits: 'Blast 1000, Radiation' },
  { id: 'weapon-explosive-tdx', name: 'TDX Explosive', section: 'Weapon', inventoryCategory: 'Weapon', page: 134, techLevel: 12, massKg: null, costCr: 1000, damage: '4D', traits: 'Blast 15' },
  { id: 'weapon-option-aux-grenade-launcher', name: 'Auxiliary Grenade Launcher', section: 'Weapon Option', inventoryCategory: 'Weapon', page: 135, techLevel: 7, massKg: null, costCr: 1000, details: ['Underslung rifle launcher', 'Magazine 1 grenade'] },
  { id: 'weapon-option-gyrostabiliser', name: 'Gyrostabiliser', section: 'Weapon Option', inventoryCategory: 'Weapon', page: 135, techLevel: 9, massKg: null, costCr: 500, details: ['Removes Bulky trait from eligible weapons'] },
  { id: 'weapon-option-intelligent-weapon-tl11', name: 'Intelligent Weapon Option (Computer/0)', section: 'Weapon Option', inventoryCategory: 'Weapon', page: 135, techLevel: 11, massKg: null, costCr: 1000, details: ['Adds Computer/0 to a weapon'] },
  { id: 'weapon-option-intelligent-weapon-tl13', name: 'Intelligent Weapon Option (Computer/1)', section: 'Weapon Option', inventoryCategory: 'Weapon', page: 135, techLevel: 13, massKg: null, costCr: 5000, details: ['Adds Computer/1 to a weapon'] },
  { id: 'weapon-option-laser-sight', name: 'Laser Sight', section: 'Weapon Option', inventoryCategory: 'Weapon', page: 135, techLevel: 8, massKg: null, costCr: 200, details: ['DM+1 to attacks under 50m'] },
  { id: 'weapon-option-scope', name: 'Scope', section: 'Weapon Option', inventoryCategory: 'Weapon', page: 135, techLevel: 5, massKg: null, costCr: 50, traits: 'Scope', details: ['Adds Scope trait to rifle or heavy weapon'] },
  { id: 'weapon-option-secure-weapon', name: 'Secure Weapon', section: 'Weapon Option', inventoryCategory: 'Weapon', page: 135, techLevel: 10, massKg: null, costCr: 250, details: ['Requires authentication before firing'] },
  { id: 'weapon-option-suppressor', name: 'Suppressor', section: 'Weapon Option', inventoryCategory: 'Weapon', page: 135, techLevel: 8, massKg: null, costCr: 250, details: ['For non-automatic slug throwers'] },
];

export const CORE_EQUIPMENT_SECTIONS: CoreEquipmentSection[] = [
  'Armour',
  'Augment',
  'Communications',
  'Computer',
  'Software',
  'Medicine',
  'Drug',
  'Sensor',
  'Survival',
  'Toolkit',
  'Weapon',
  'Weapon Option',
];

export function formatEquipmentCost(item: Pick<CoreEquipmentItem, 'costCr' | 'costLabel'>): string {
  if (item.costLabel) return item.costLabel;
  if (item.costCr === null) return '--';
  if (item.costCr >= 1000000) {
    return `MCr ${(item.costCr / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `Cr ${item.costCr.toLocaleString()}`;
}

export function formatEquipmentMass(massKg: number | null): string {
  if (massKg === null) return '--';
  if (massKg === 0) return '0 kg';
  return `${massKg.toLocaleString()} kg`;
}

export function equipmentInventoryNotes(item: CoreEquipmentItem): string {
  const parts = [`Core Rules p.${item.page}`];
  if (item.techLevel !== null) parts.push(`TL${item.techLevel}`);
  if (item.range) parts.push(`Range ${item.range}`);
  if (item.damage) parts.push(`Damage ${item.damage}`);
  if (item.magazine) parts.push(`Magazine ${item.magazine}`);
  if (item.traits) parts.push(`Traits ${item.traits}`);
  if (item.details?.[0]) parts.push(item.details[0]);
  return parts.join('; ');
}

export function searchCoreEquipment(query: string, section: CoreEquipmentSection | ''): CoreEquipmentItem[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return CORE_EQUIPMENT.filter(item => {
    if (section && item.section !== section) return false;
    if (terms.length === 0) return true;
    const haystack = [
      item.name,
      item.section,
      item.inventoryCategory,
      item.techLevel === null ? '' : `tl${item.techLevel}`,
      item.range,
      item.damage,
      item.magazine,
      item.traits,
      item.costLabel,
      item.ammoCostLabel,
      ...(item.details ?? []),
    ].join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}
