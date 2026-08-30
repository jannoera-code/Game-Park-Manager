/**
 * African Wildlife Reserve Management Game - Configuration & Data Structures
 */

const BASE_ANIMAL_SPECIES = [
    {
        speciesId: 'impala',
        name: 'Impala',
        icon: '🦌',
        image: 'assets/impala.png',
        baseCost: 250,
        baseAttraction: 15,
        enclosureTierReq: 1,
        upkeep: 5,
        maxAge: 12,
        description: 'A swift and graceful antelope native to eastern and southern Africa.'
    },
    {
        speciesId: 'zebra',
        name: 'Plains Zebra',
        icon: '🦓',
        image: 'assets/zebra.png',
        baseCost: 600,
        baseAttraction: 40,
        enclosureTierReq: 1,
        upkeep: 12,
        maxAge: 20,
        description: 'Iconic striped herbivore that attracts families and safari tourists.'
    },
    {
        speciesId: 'rhino',
        name: 'White Rhino',
        icon: '🦏',
        image: 'assets/rhino.png',
        baseCost: 1500,
        baseAttraction: 110,
        enclosureTierReq: 2,
        upkeep: 30,
        maxAge: 35,
        description: 'Heavy armored herbivore requiring reinforced perimeter fencing.'
    },
    {
        speciesId: 'lion',
        name: 'African Lion',
        icon: '🦁',
        image: 'assets/lion.png',
        baseCost: 3500,
        baseAttraction: 280,
        enclosureTierReq: 3,
        upkeep: 75,
        maxAge: 15,
        description: 'Apex predator and major tourist draw. Requires high-security electric fencing.'
    },
    {
        speciesId: 'elephant',
        name: 'African Elephant',
        icon: '🐘',
        image: 'assets/elephant.png',
        baseCost: 6000,
        baseAttraction: 500,
        enclosureTierReq: 3,
        upkeep: 120,
        maxAge: 60,
        description: 'The majestic giant of the savannah. Supreme attraction requiring top-tier security.'
    }
];

const RANGER_FIRST_NAMES = ['Kofi', 'Aminata', 'Tariq', 'Zola', 'Jabari', 'Nia', 'Kwame', 'Siti', 'Bakari', 'Fatima', 'Lethabo', 'Tendo'];
const RANGER_LAST_NAMES = ['Mensah', 'Diallo', 'Hassan', 'Ndlovu', 'Osei', 'Kamau', 'Traore', 'Mbeki', 'Abebe', 'Dlamini'];

const TRAITS_POOL = [
    { id: 'athletic', name: 'Athletic', type: 'good', description: '+15% Move Speed', effects: { moveSpeedMult: 1.15 } },
    { id: 'lazy', name: 'Lazy', type: 'bad', description: '-10% Work Speed', effects: { workSpeedMult: 0.90 } },
    { id: 'efficient', name: 'Efficient', type: 'good', description: '+20% Work Speed', effects: { workSpeedMult: 1.20 } },
    { id: 'veteran', name: 'Veteran', type: 'good', description: '+5 Base Capacity', effects: { capacityBonus: 5 } },
    { id: 'eagle_eye', name: 'Eagle Eye', type: 'good', description: '+25% Sight Radius', effects: { sightRadiusMult: 1.25 } },
    { id: 'thrifty', name: 'Thrifty', type: 'good', description: '-15% Daily Wage', effects: { wageMult: 0.85 } },
    { id: 'demanding', name: 'Demanding', type: 'bad', description: '+20% Daily Wage', effects: { wageMult: 1.20 } },
    { id: 'nature_lover', name: 'Nature Lover', type: 'good', description: '+10% Attraction Income', effects: { attractionMult: 1.10 } }
];

const BUFF_OPTIONS = [
    { id: 'speed', title: '⚡ Cheetah Boots', description: '+10% Movement Speed', effect: { moveSpeedMult: 0.10 } },
    { id: 'yield', title: '🪓 Heavy Axe', description: '+1 Harvest Yield', effect: { harvestYieldBonus: 1 } },
    { id: 'workSpeed', title: '⏱️ Quick Hands', description: '+10% Interaction Speed', effect: { workSpeedMult: 0.10 } },
    { id: 'income', title: '💰 Safari Promotion', description: '+15% Visitor Income', effect: { incomeMult: 0.15 } },
    { id: 'capacity', title: '🎪 Reserve Permit', description: '+5 Animal Capacity', effect: { capacityBonus: 5 } }
];

const SELLER_RESERVES = [
    'Kruger East',
    'Zambezi Plains',
    'Baobab Sanctuary',
    'Serengeti North',
    'Ngorongoro Rim',
    'Okavango Basin',
    'Tsavo Valley',
    'Chobe Ridge'
];

/**
 * Dynamic Animal Listing Generator
 */
function generateAnimalListings(count = 6) {
    const listings = [];
    for (let i = 0; i < count; i++) {
        const species = BASE_ANIMAL_SPECIES[Math.floor(Math.random() * BASE_ANIMAL_SPECIES.length)];
        const gender = Math.random() < 0.5 ? 'Male' : 'Female';
        const age = Math.floor(1 + Math.random() * species.maxAge);
        const sellerReserve = SELLER_RESERVES[Math.floor(Math.random() * SELLER_RESERVES.length)];

        // Prime adult age factor (e.g. middle age is highest value)
        const primeAge = Math.floor(species.maxAge * 0.4);
        const ageDiff = Math.abs(age - primeAge);
        const ageFactor = Math.max(0.6, 1.3 - (ageDiff / species.maxAge) * 0.8);

        const cost = Math.round(species.baseCost * ageFactor);
        const attractionScore = Math.round(species.baseAttraction * ageFactor);

        listings.push({
            id: `listing_animal_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
            speciesId: species.speciesId,
            name: species.name,
            icon: species.icon,
            image: species.image,
            age: age,
            gender: gender,
            cost: cost,
            attractionScore: attractionScore,
            enclosureTierReq: species.enclosureTierReq,
            upkeep: species.upkeep,
            sellerReserve: sellerReserve,
            description: `${species.description} (${gender}, ${age} yrs old)`
        });
    }
    return listings;
}

/**
 * Dynamic Ranger Listing Generator
 * Generates Rangers with random age, gender, and exactly 3 random traits.
 */
function generateRangerListings(count = 6) {
    const listings = [];
    for (let i = 0; i < count; i++) {
        const fname = RANGER_FIRST_NAMES[Math.floor(Math.random() * RANGER_FIRST_NAMES.length)];
        const lname = RANGER_LAST_NAMES[Math.floor(Math.random() * RANGER_LAST_NAMES.length)];
        const fullName = `${fname} ${lname}`;
        const gender = Math.random() < 0.5 ? 'Male' : 'Female';
        const age = Math.floor(20 + Math.random() * 38);
        const baseWage = 25 + Math.floor(Math.random() * 35);
        const image = Math.random() < 0.5 ? 'assets/ranger1.png' : 'assets/ranger2.png';

        // Pick 3 unique traits
        const shuffledTraits = [...TRAITS_POOL].sort(() => 0.5 - Math.random());
        const selectedTraits = shuffledTraits.slice(0, 3);

        let wageMult = 1.0;
        selectedTraits.forEach(t => {
            if (t.effects.wageMult) wageMult *= t.effects.wageMult;
        });

        const dailyWage = Math.round(baseWage * wageMult);

        listings.push({
            id: `ranger_gen_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
            name: fullName,
            age: age,
            gender: gender,
            dailyWage: dailyWage,
            capacityBonus: 5,
            traits: selectedTraits,
            image: image
        });
    }
    return listings;
}

const BUILDINGS_DATA = [
    {
        id: 'workbench',
        name: 'Workbench',
        icon: '🛠️',
        woodCost: 10,
        stoneCost: 0,
        processedStoneCost: 0,
        width: 60,
        height: 60,
        description: 'Crafting bench that unlocks tools, structures, fences, and processing stations.'
    }
];

const WORKBENCH_CRAFTABLES = [
    {
        id: 'torch',
        type: 'building',
        name: 'Torch',
        icon: '🔦',
        woodCost: 1,
        stoneCost: 0,
        processedStoneCost: 0,
        saplingCost: 1,
        width: 30,
        height: 30,
        description: 'Placeable light source that illuminates the surrounding area during the night phase.'
    },
    {
        id: 'ranger_hut',
        type: 'building',
        name: 'Ranger Hut',
        icon: '🏠',
        woodCost: 20,
        stoneCost: 10,
        processedStoneCost: 0,
        width: 96,
        height: 96,
        description: 'Provides operational staging post for hired rangers to spawn, rest, and patrol.'
    },
    {
        id: 'furnace',
        type: 'building',
        name: 'Smelting Furnace',
        icon: '🧱',
        woodCost: 15,
        stoneCost: 25,
        processedStoneCost: 0,
        width: 70,
        height: 70,
        description: 'Consumes Wood fuel to smelt Stone into Processed Stone over time.'
    },
    {
        id: 'fence_tier1',
        type: 'building',
        name: 'Fence Tier 1',
        icon: '🪵',
        image: 'assets/fence-tier1.png',
        woodCost: 10,
        stoneCost: 0,
        processedStoneCost: 0,
        width: 60,
        height: 60,
        description: 'Basic wooden perimeter fence segment.'
    },
    {
        id: 'fence_gate',
        type: 'building',
        name: 'Employee Gate',
        icon: '🚪',
        image: 'assets/fence-tier1-employee-gate.png',
        woodCost: 15,
        stoneCost: 5,
        processedStoneCost: 0,
        width: 70,
        height: 70,
        description: 'Secure access gate for staff entrance and exit.'
    },
    {
        id: 'wood_chopping_station',
        type: 'building',
        name: 'Wood Chopping Station',
        icon: '🪓',
        woodCost: 25,
        stoneCost: 10,
        processedStoneCost: 0,
        width: 70,
        height: 70,
        description: 'Converts raw Wood into Braai Wood fuel.'
    },
    {
        id: 'braai',
        type: 'building',
        name: 'Braai Grill',
        icon: '🥩',
        image: 'assets/braai.png',
        woodCost: 15,
        stoneCost: 20,
        processedStoneCost: 5,
        width: 70,
        height: 70,
        description: 'African BBQ grill that cooks Raw Meat using Braai Wood.'
    },
    {
        id: 'stone-axe',
        type: 'item',
        name: 'Stone Axe',
        icon: '🪓',
        image: 'assets/stone-axe.png',
        woodCost: 5,
        processedStoneCost: 3,
        description: 'Crafted tool for rapid tree harvesting and auto-gathering.'
    },
    {
        id: 'stone-pickaxe',
        type: 'item',
        name: 'Stone Pickaxe',
        icon: '⛏️',
        image: 'assets/stone-pickaxe.png',
        woodCost: 5,
        processedStoneCost: 3,
        description: 'Crafted tool for rapid rock mining and auto-gathering.'
    },
    {
        id: 'stone-shovel',
        type: 'item',
        name: 'Stone Shovel',
        icon: '🪵',
        image: 'assets/stone-shovel.png',
        woodCost: 5,
        processedStoneCost: 3,
        description: 'Crafted shovel tool for multi-purpose earthwork.'
    }
];

const CAMP_TIERS_DATA = [
    {
        tier: 1,
        name: 'Basic Outpost',
        cost: 0,
        woodCost: 0,
        stoneCost: 0,
        processedStoneCost: 0,
        baseCapacity: 5,
        description: 'A minimal tented ranger post with basic supplies.'
    },
    {
        tier: 2,
        name: 'Ranger Station',
        cost: 1200,
        woodCost: 50,
        stoneCost: 30,
        processedStoneCost: 10,
        baseCapacity: 12,
        description: 'Wooden lodge with communications gear and vehicle storage.'
    },
    {
        tier: 3,
        name: 'Reserve HQ',
        cost: 4000,
        woodCost: 150,
        stoneCost: 100,
        processedStoneCost: 30,
        baseCapacity: 25,
        description: 'Comprehensive operations center with satellite tracking and veterinary hub.'
    }
];

const FENCE_TIERS_DATA = [
    {
        tier: 1,
        name: 'Wooden Fence',
        cost: 0,
        woodCost: 0,
        stoneCost: 0,
        processedStoneCost: 0,
        securityRating: 'Low',
        maxAnimalTier: 1,
        description: 'Simple wooden posts and wire. Suitable for small herbivores.'
    },
    {
        tier: 2,
        name: 'Reinforced Steel Mesh',
        cost: 1500,
        woodCost: 40,
        stoneCost: 25,
        processedStoneCost: 15,
        securityRating: 'Medium',
        maxAnimalTier: 2,
        description: 'Heavy duty steel fencing to hold large herbivores like giraffes.'
    },
    {
        tier: 3,
        name: 'Electric Perimeter Guard',
        cost: 4500,
        woodCost: 80,
        stoneCost: 60,
        processedStoneCost: 40,
        securityRating: 'High',
        maxAnimalTier: 3,
        description: 'High voltage security enclosure required for big cats and elephants.'
    }
];

const INITIAL_GAME_STATE = {
    funds: 1000,
    day: 1,
    dayProgress: 0, // 0 to 100 percentage
    wood: 30,
    stone: 15,
    processedStone: 0,
    ownedAnimals: [],
    hiredRangers: [],
    campTier: 1,
    fenceTier: 1,
    placedBuildings: []
};
