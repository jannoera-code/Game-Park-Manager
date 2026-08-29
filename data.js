/**
 * African Wildlife Reserve Management Game - Configuration & Data Structures
 */

const ANIMALS_DATA = [
    {
        id: 'impala',
        name: 'Impala',
        icon: '🦌',
        image: 'impala.png',
        cost: 250,
        attractionScore: 15,
        enclosureTierReq: 1,
        upkeep: 5,
        description: 'A swift and graceful antelope native to eastern and southern Africa.'
    },
    {
        id: 'zebra',
        name: 'Plains Zebra',
        icon: '🦓',
        image: 'zebra.png',
        cost: 600,
        attractionScore: 40,
        enclosureTierReq: 1,
        upkeep: 12,
        description: 'Iconic striped herbivore that attracts families and safari tourists.'
    },
    {
        id: 'rhino',
        name: 'White Rhino',
        icon: '🦏',
        image: 'rhino.png',
        cost: 1500,
        attractionScore: 110,
        enclosureTierReq: 2,
        upkeep: 30,
        description: 'Heavy armored herbivore requiring reinforced perimeter fencing.'
    },
    {
        id: 'lion',
        name: 'African Lion',
        icon: '🦁',
        image: 'lion.png',
        cost: 3500,
        attractionScore: 280,
        enclosureTierReq: 3,
        upkeep: 75,
        description: 'Apex predator and major tourist draw. Requires high-security electric fencing.'
    },
    {
        id: 'elephant',
        name: 'African Elephant',
        icon: '🐘',
        image: 'elephant.png',
        cost: 6000,
        attractionScore: 500,
        enclosureTierReq: 3,
        upkeep: 120,
        description: 'The majestic giant of the savannah. Supreme attraction requiring top-tier security.'
    }
];

const RANGERS_DATA = [
    {
        id: 'ranger_kofi',
        name: 'Kofi Mensah',
        dailyWage: 30,
        capacityBonus: 5,
        traits: [
            { name: 'Tracker', type: 'good', description: '+10% visitor satisfaction' },
            { name: 'Heavy Sleeper', type: 'bad', description: 'Slightly higher risk during night patrols' }
        ]
    },
    {
        id: 'ranger_aminata',
        name: 'Aminata Diallo',
        dailyWage: 45,
        capacityBonus: 8,
        traits: [
            { name: 'Veteran', type: 'good', description: '+20% fence upkeep efficiency' },
            { name: 'Strict', type: 'good', description: 'Prevents poaching events' }
        ]
    },
    {
        id: 'ranger_tariq',
        name: 'Tariq Hassan',
        dailyWage: 25,
        capacityBonus: 4,
        traits: [
            { name: 'Mechanic', type: 'good', description: 'Reduces camp maintenance costs' }
        ]
    },
    {
        id: 'ranger_zola',
        name: 'Zola Ndlovu',
        dailyWage: 60,
        capacityBonus: 12,
        traits: [
            { name: 'Zoologist', type: 'good', description: '+15% animal breeding rate bonus' },
            { name: 'High Wage', type: 'bad', description: 'Demands regular raises' }
        ]
    }
];

const BUILDINGS_DATA = [
    {
        id: 'ranger_hut',
        name: 'Ranger Hut',
        icon: '🏠',
        woodCost: 20,
        stoneCost: 10,
        processedStoneCost: 0,
        width: 80,
        height: 80,
        description: 'Provides a operational staging post for hired rangers to spawn and patrol.'
    },
    {
        id: 'furnace',
        name: 'Smelting Furnace',
        icon: '🧱',
        woodCost: 15,
        stoneCost: 25,
        processedStoneCost: 0,
        width: 70,
        height: 70,
        description: 'Consumes Wood fuel to smelt Stone into Processed Stone over time.'
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
    ownedAnimals: [
        { id: 'impala', count: 2 }
    ],
    hiredRangers: [
        { id: 'ranger_kofi' }
    ],
    campTier: 1,
    fenceTier: 1,
    placedBuildings: []
};
