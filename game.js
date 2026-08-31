/**
 * African Wildlife Reserve Manager - RPG Progression, Living AI & Tactical Game Engine
 */

// Helper deterministic pseudo-random generator based on seed
function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// Helper simple string hash for seed generation
function hashCoordinates(x, y) {
    let hash = 17;
    hash = hash * 31 + x;
    hash = hash * 31 + y;
    return Math.abs(hash);
}

/**
 * AudioManager Class
 * Handles preloading MP3 tracks, chaining music play, and Web Audio procedural SFX synthesis.
 */
class AudioManager {
    constructor() {
        this.ctx = null;
        this.sfxGain = null;
        this.music1 = new Audio('Savanna-music1.mp3');
        this.music2 = new Audio('Savanna-music2.mp3');

        this.musicVolume = 0.5;
        this.sfxVolume = 0.5;
        this.isStarted = false;

        // Load stored volume preferences if available
        const savedPref = localStorage.getItem('savanna_audio_settings');
        if (savedPref) {
            try {
                const parsed = JSON.parse(savedPref);
                if (typeof parsed.musicVolume === 'number') this.musicVolume = parsed.musicVolume;
                if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
            } catch (e) {}
        }

        this.music1.volume = this.musicVolume;
        this.music2.volume = this.musicVolume;

        // Music loop logic: track 1 ends -> track 2 plays continuously
        this.music1.addEventListener('ended', () => {
            this.music2.currentTime = 0;
            this.music2.loop = true;
            this.music2.play().catch(() => {});
        });

        this.music2.addEventListener('ended', () => {
            this.music2.currentTime = 0;
            this.music2.play().catch(() => {});
        });
    }

    initAudioContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = this.sfxVolume;
                this.sfxGain.connect(this.ctx.destination);
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startAudio() {
        this.initAudioContext();
        if (!this.isStarted) {
            this.isStarted = true;
            this.music1.currentTime = 0;
            this.music1.play().catch(e => {
                this.isStarted = false;
            });
        }
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        this.music1.volume = this.musicVolume;
        this.music2.volume = this.musicVolume;
        this.savePreferences();
    }

    setSfxVolume(vol) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.sfxVolume;
        }
        this.savePreferences();
    }

    savePreferences() {
        localStorage.setItem('savanna_audio_settings', JSON.stringify({
            musicVolume: this.musicVolume,
            sfxVolume: this.sfxVolume
        }));
    }

    playSound(type) {
        if (!this.ctx) this.initAudioContext();
        if (!this.ctx || this.sfxVolume <= 0) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.sfxGain);

        if (type === 'hit') {
            // Low-pitched square wave (for chopping/mining)
            osc.type = 'square';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'click') {
            // Short, high-pitched sine wave (UI clicks)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'eat') {
            // Ascending frequency sweep (eating/drinking)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.linearRampToValueAtTime(660, now + 0.25);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        }
    }
}

// Global helper for procedural sound synthesis
function playProceduralSound(type) {
    if (window.game && window.game.audioManager) {
        window.game.audioManager.playSound(type);
    }
}

/**
 * SaveManager Class
 * Handles full state serialization, localStorage save slots, and class re-instantiation deserialization.
 */
class SaveManager {
    static getSlotKey(slotId) {
        return `savanna_save_slot_${slotId}`;
    }

    static getSlotMetadata(slotId) {
        const raw = localStorage.getItem(SaveManager.getSlotKey(slotId));
        if (!raw) return { slotId, exists: false };
        try {
            const data = JSON.parse(raw);
            return {
                slotId,
                exists: true,
                day: data.economy?.day || 1,
                week: data.economy?.week || 1,
                funds: data.economy?.funds || 0,
                timestamp: data.timestamp || Date.now()
            };
        } catch (e) {
            return { slotId, exists: false };
        }
    }

    static serialize(game) {
        return {
            timestamp: Date.now(),
            player: {
                x: game.player.x,
                y: game.player.y,
                hp: game.player.hp,
                maxHp: game.player.maxHp,
                thirst: game.player.thirst,
                maxThirst: game.player.maxThirst,
                hunger: game.player.hunger,
                maxHunger: game.player.maxHunger,
                speedMult: game.player.speedMult
            },
            inventory: {
                slots: game.inventory.slots
            },
            worldState: {
                revealedChunks: Array.from(game.revealedChunks),
                placedBuildings: game.state.placedBuildings,
                furnaces: game.furnaces.map(f => ({
                    id: f.id, x: f.x, y: f.y, width: f.width, height: f.height,
                    fuelWood: f.fuelWood, rawStone: f.rawStone, processedStone: f.processedStone,
                    isSmelting: f.isSmelting, smeltTimer: f.smeltTimer
                })),
                braais: game.braais.map(b => ({
                    id: b.id, x: b.x, y: b.y, width: b.width, height: b.height,
                    braaiWood: b.braaiWood, rawMeat: b.rawMeat, cookedMeat: b.cookedMeat,
                    isCooking: b.isCooking, cookTimer: b.cookTimer
                })),
                droppedItems: game.droppedItems.map(d => ({
                    id: d.id, type: d.type, amount: d.amount, x: d.x, y: d.y
                })),
                plantedSaplings: game.plantedSaplings.map(s => ({
                    id: s.id, x: s.x, y: s.y, growthTime: s.growthTime, stage: s.stage, isMature: s.isMature
                }))
            },
            aiState: {
                ownedAnimals: game.state.ownedAnimals,
                renderedAnimals: game.renderedAnimals.map(a => ({
                    speciesId: a.speciesId, name: a.name, icon: a.icon, image: a.image,
                    x: a.x, y: a.y, thirst: a.thirst, state: a.state,
                    targetX: a.targetX, targetY: a.targetY, drinkTimer: a.drinkTimer,
                    reserveBounds: a.reserveBounds
                })),
                hiredRangers: game.state.hiredRangers,
                rangers: game.rangers.map(r => ({
                    id: r.id, name: r.name, hutX: r.hutX, hutY: r.hutY, x: r.x, y: r.y,
                    traits: r.traits, image: r.image, state: r.state,
                    targetX: r.targetX, targetY: r.targetY, taskTimer: r.taskTimer,
                    fenceWaypointIndex: r.fenceWaypointIndex, reserveBounds: r.reserveBounds
                })),
                jock: game.dogJock ? {
                    x: game.dogJock.x,
                    y: game.dogJock.y,
                    state: game.dogJock.state,
                    thirst: game.dogJock.thirst,
                    hunger: game.dogJock.hunger,
                    scoutModeEnabled: game.dogJock.scoutModeEnabled,
                    hasScoutedToday: game.dogJock.hasScoutedToday,
                    targetX: game.dogJock.targetX,
                    targetY: game.dogJock.targetY
                } : null
            },
            economy: {
                funds: game.state.funds,
                dosh: game.state.dosh || 0,
                day: game.state.day,
                week: game.week,
                timeElapsedInDay: game.timeElapsedInDay,
                campTier: game.state.campTier,
                fenceTier: game.state.fenceTier,
                weeklyStats: game.weeklyStats,
                buffs: game.buffs,
                isCreativeMode: game.state.isCreativeMode,
                tutorialIndex: game.state.tutorialIndex || 0,
                tutorialEvents: game.state.tutorialEvents || {}
            }
        };
    }

    static saveGame(game, slotId) {
        const data = SaveManager.serialize(game);
        localStorage.setItem(SaveManager.getSlotKey(slotId), JSON.stringify(data));
        return true;
    }

    static deserialize(game, data) {
        if (!data) return false;

        // Restore Player State
        if (data.player) {
            game.player.x = data.player.x;
            game.player.y = data.player.y;
            game.player.hp = data.player.hp;
            game.player.maxHp = data.player.maxHp;
            game.player.thirst = data.player.thirst;
            game.player.maxThirst = data.player.maxThirst;
            game.player.hunger = data.player.hunger;
            game.player.maxHunger = data.player.maxHunger;
            if (data.player.speedMult) game.player.speedMult = data.player.speedMult;
        }

        // Restore Inventory
        if (data.inventory && data.inventory.slots) {
            game.inventory.slots = data.inventory.slots;
        }

        // Restore Economy & Time
        if (data.economy) {
            game.state.funds = data.economy.funds ?? 1000;
            game.state.dosh = data.economy.dosh ?? 0;
            game.state.day = data.economy.day ?? 1;
            game.week = data.economy.week ?? 1;
            game.timeElapsedInDay = data.economy.timeElapsedInDay ?? 0;
            game.state.dayProgress = (game.timeElapsedInDay / game.dayDuration) * 100;
            game.state.campTier = data.economy.campTier ?? 1;
            game.state.fenceTier = data.economy.fenceTier ?? 1;
            game.state.isCreativeMode = !!data.economy.isCreativeMode;
            game.state.tutorialIndex = data.economy.tutorialIndex ?? 0;
            game.state.tutorialEvents = data.economy.tutorialEvents || {};
            if (data.economy.weeklyStats) game.weeklyStats = data.economy.weeklyStats;
            if (data.economy.buffs) game.buffs = data.economy.buffs;
        }

        // Restore World State
        if (data.worldState) {
            if (data.worldState.revealedChunks) {
                game.revealedChunks = new Set(data.worldState.revealedChunks);
            }
            if (data.worldState.placedBuildings) {
                game.state.placedBuildings = data.worldState.placedBuildings;
            }

            // Re-instantiate Furnaces
            game.furnaces = [];
            if (data.worldState.furnaces) {
                data.worldState.furnaces.forEach(f => {
                    const furnace = new Furnace(f.id, f.x, f.y, f.width, f.height);
                    furnace.fuelWood = f.fuelWood;
                    furnace.rawStone = f.rawStone;
                    furnace.processedStone = f.processedStone;
                    furnace.isSmelting = f.isSmelting;
                    furnace.smeltTimer = f.smeltTimer;
                    game.furnaces.push(furnace);
                });
            }

            // Re-instantiate Braais
            game.braais = [];
            if (data.worldState.braais) {
                data.worldState.braais.forEach(b => {
                    const braai = new Braai(b.id, b.x, b.y, b.width, b.height);
                    braai.braaiWood = b.braaiWood;
                    braai.rawMeat = b.rawMeat;
                    braai.cookedMeat = b.cookedMeat;
                    braai.isCooking = b.isCooking;
                    braai.cookTimer = b.cookTimer;
                    game.braais.push(braai);
                });
            }

            // Re-instantiate DroppedItems
            game.droppedItems = [];
            if (data.worldState.droppedItems) {
                data.worldState.droppedItems.forEach(d => {
                    game.droppedItems.push(new DroppedItem(d.id, d.type, d.amount, d.x, d.y));
                });
            }

            // Re-instantiate PlantedSaplings
            game.plantedSaplings = [];
            if (data.worldState.plantedSaplings) {
                data.worldState.plantedSaplings.forEach(s => {
                    const sap = new PlantedSapling(s.id, s.x, s.y);
                    sap.growthTime = s.growthTime;
                    sap.stage = s.stage;
                    sap.isMature = s.isMature;
                    game.plantedSaplings.push(sap);
                });
            }
        }

        // Restore AI State
        if (data.aiState) {
            if (data.aiState.ownedAnimals) {
                game.state.ownedAnimals = data.aiState.ownedAnimals;
            }

            // Re-instantiate Animals
            game.renderedAnimals = [];
            if (data.aiState.renderedAnimals) {
                data.aiState.renderedAnimals.forEach(aData => {
                    const animal = new Animal(
                        { speciesId: aData.speciesId, name: aData.name, icon: aData.icon, image: aData.image },
                        aData.x, aData.y, aData.reserveBounds || game.reserve
                    );
                    animal.thirst = aData.thirst;
                    animal.state = aData.state;
                    animal.targetX = aData.targetX;
                    animal.targetY = aData.targetY;
                    animal.drinkTimer = aData.drinkTimer || 0;
                    game.renderedAnimals.push(animal);
                });
            }

            if (data.aiState.hiredRangers) {
                game.state.hiredRangers = data.aiState.hiredRangers;
            }

            // Re-instantiate Rangers
            game.rangers = [];
            if (data.aiState.rangers) {
                data.aiState.rangers.forEach(rData => {
                    const ranger = new Ranger(
                        { id: rData.id, name: rData.name, traits: rData.traits, image: rData.image },
                        rData.hutX, rData.hutY, rData.reserveBounds || game.reserve
                    );
                    ranger.x = rData.x;
                    ranger.y = rData.y;
                    ranger.state = rData.state;
                    ranger.targetX = rData.targetX;
                    ranger.targetY = rData.targetY;
                    ranger.taskTimer = rData.taskTimer;
                    ranger.fenceWaypointIndex = rData.fenceWaypointIndex;
                    game.rangers.push(ranger);
                });
            }

            if (data.aiState.jock && game.dogJock) {
                game.dogJock.x = data.aiState.jock.x;
                game.dogJock.y = data.aiState.jock.y;
                game.dogJock.state = data.aiState.jock.state;
                game.dogJock.thirst = data.aiState.jock.thirst;
                game.dogJock.hunger = data.aiState.jock.hunger;
                game.dogJock.scoutModeEnabled = !!data.aiState.jock.scoutModeEnabled;
                game.dogJock.hasScoutedToday = !!data.aiState.jock.hasScoutedToday;
                game.dogJock.targetX = data.aiState.jock.targetX;
                game.dogJock.targetY = data.aiState.jock.targetY;
            }
        }

        game.updateUI();
        return true;
    }

    static loadGame(game, slotId) {
        const raw = localStorage.getItem(SaveManager.getSlotKey(slotId));
        if (!raw) return false;
        try {
            const data = JSON.parse(raw);
            return SaveManager.deserialize(game, data);
        } catch (e) {
            console.error("Failed to load save data:", e);
            return false;
        }
    }
}

/**
 * Dedicated Inventory Class
 * Manages 25 slot objects (20 Backpack + 5 Hotbar) with max stack limit of 100 per resource type and spillover logic.
 */
class Inventory {
    constructor(slotCount = 25, maxStack = 100) {
        this.slotCount = slotCount;
        this.maxStack = maxStack;
        this.slots = Array.from({ length: slotCount }, () => ({ type: null, count: 0 }));
    }

    /**
     * Attempts to add an amount of item type to the inventory.
     * Uses stacking up to maxStack and spills over into empty slots.
     * Returns true if all items were added, false if inventory is full.
     */
    addItem(type, amount, name = null) {
        let remaining = amount;

        // 1. Fill existing slots with matching type under maxStack
        for (let slot of this.slots) {
            if (slot.type === type && slot.count < this.maxStack) {
                const available = this.maxStack - slot.count;
                const toAdd = Math.min(remaining, available);
                slot.count += toAdd;
                if (name && !slot.name) slot.name = name;
                remaining -= toAdd;
                if (remaining <= 0) return true;
            }
        }

        // 2. Spill over into next available empty slots
        for (let slot of this.slots) {
            if (slot.type === null || slot.count === 0) {
                slot.type = type;
                slot.name = name;
                const toAdd = Math.min(remaining, this.maxStack);
                slot.count = toAdd;
                remaining -= toAdd;
                if (remaining <= 0) return true;
            }
        }

        return remaining < amount; // Partial or full addition
    }

    /**
     * Checks if inventory can accommodate amount of type.
     */
    canAddItem(type, amount) {
        let capacity = 0;
        for (let slot of this.slots) {
            if (slot.type === type && slot.count < this.maxStack) {
                capacity += (this.maxStack - slot.count);
            } else if (slot.type === null || slot.count === 0) {
                capacity += this.maxStack;
            }
        }
        return capacity >= amount;
    }

    /**
     * Gets total count of a specific item type.
     */
    getItemCount(type) {
        return this.slots
            .filter(slot => slot.type === type)
            .reduce((sum, slot) => sum + slot.count, 0);
    }

    /**
     * Swaps or stacks items between two slot indices.
     */
    swapOrStackSlots(fromIdx, toIdx) {
        if (fromIdx < 0 || fromIdx >= this.slotCount || toIdx < 0 || toIdx >= this.slotCount) return;
        if (fromIdx === toIdx) return;

        const from = this.slots[fromIdx];
        const to = this.slots[toIdx];

        if (!from || from.count <= 0) return;

        if (to && to.count > 0 && to.type === from.type && to.count < this.maxStack) {
            const space = this.maxStack - to.count;
            const transfer = Math.min(from.count, space);
            to.count += transfer;
            from.count -= transfer;
            if (from.count <= 0) {
                this.slots[fromIdx] = { type: null, count: 0 };
            }
        } else {
            const temp = { ...this.slots[fromIdx] };
            this.slots[fromIdx] = { ...this.slots[toIdx] };
            this.slots[toIdx] = temp;
        }
    }

    /**
     * Consumes an amount of item type.
     */
    consumeItem(type, amount) {
        let remaining = amount;
        for (let slot of this.slots) {
            if (slot.type === type) {
                const toTake = Math.min(remaining, slot.count);
                slot.count -= toTake;
                remaining -= toTake;
                if (slot.count <= 0) {
                    slot.type = null;
                    slot.count = 0;
                }
                if (remaining <= 0) return true;
            }
        }
        return remaining === 0;
    }
}

/**
 * Shrub Entity Class
 * Smaller, skinny grass patches with sine-wave wind sway animation
 */
class Shrub {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.phaseOffset = Math.random() * Math.PI * 2;
        this.bladeHeights = [10, 15, 13, 17, 11];
        this.bladeOffsets = [-7, -3, 0, 4, 7];
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Sine-wave sway animation for natural wind motion
        const time = performance.now() / 500;

        // Subtle ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Render skinny grass blades
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        for (let i = 0; i < this.bladeHeights.length; i++) {
            const bx = this.bladeOffsets[i];
            const h = this.bladeHeights[i];
            const bladeSway = Math.sin(time + this.phaseOffset + i * 0.3) * (h * 0.25);

            ctx.beginPath();
            ctx.moveTo(bx, 0);
            ctx.quadraticCurveTo(bx + bladeSway * 0.5, -h * 0.5, bx + bladeSway, -h);
            ctx.strokeStyle = i % 2 === 0 ? '#68a129' : '#8ac736';
            ctx.stroke();
        }

        ctx.restore();
    }
}

/**
 * PlantedSapling Class
 * Ecological growth state machine: Sprout -> Young Tree -> Mature Tree
 */
class PlantedSapling {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.growthTime = 0;
        this.stage = 'sprout'; // 'sprout' (0-10s), 'young' (10-25s), 'mature' (25s+)
        this.isMature = false;
    }

    update(dt) {
        if (this.isMature) return;

        this.growthTime += dt;
        if (this.growthTime >= 25) {
            this.stage = 'mature';
            this.isMature = true;
        } else if (this.growthTime >= 10) {
            this.stage = 'young';
        }
    }

    render(ctx, images) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.stage === 'sprout') {
            ctx.fillStyle = '#2ecc71';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🌱', 0, 0);
        } else if (this.stage === 'young') {
            ctx.fillStyle = '#27ae60';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🌿', 0, 0);
        } else {
            // Render full tree
            const treeImg = images['tree.png'];
            if (treeImg && treeImg.complete) {
                const drawSize = 22 * 2.8;
                ctx.drawImage(treeImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
            } else {
                ctx.fillStyle = '#1e5e27';
                ctx.beginPath();
                ctx.arc(0, 0, 22, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}

/**
 * Diseased Corpse Entity Class
 * Spawned randomly across the savanna, contains Raw Meat.
 */
class DiseasedCorpse {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.looted = false;
        this.rawMeatCount = Math.floor(2 + Math.random() * 4); // 2-5 raw meat
    }

    render(ctx, images) {
        if (this.looted) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(2, 12, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Corpse shape / icon
        ctx.fillStyle = '#4a3728';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 10, 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠️', 0, -2);

        ctx.restore();
    }
}

/**
 * DroppedItem Entity Class
 * Physical Entity item spawned on the ground with bounce physics when resource nodes are harvested.
 */
class DroppedItem {
    constructor(id, type, amount, x, y) {
        this.id = id;
        this.type = type; // 'wood', 'stone', 'sapling', 'scraps'
        this.amount = amount;
        this.x = x;
        this.y = y;
        this.radius = 14;

        // Bounce physics parameters
        this.vz = 70 + Math.random() * 30;
        this.z = 0;
        this.gravity = 250;
        this.bounceFactor = 0.4;
        this.bounces = 0;
        this.isGround = false;

        this.floatTimer = Math.random() * 10;
    }

    update(dt) {
        if (!this.isGround) {
            this.z += this.vz * dt;
            this.vz -= this.gravity * dt;
            if (this.z <= 0) {
                this.z = 0;
                if (Math.abs(this.vz) > 15 && this.bounces < 2) {
                    this.vz = -this.vz * this.bounceFactor;
                    this.bounces++;
                } else {
                    this.vz = 0;
                    this.isGround = true;
                }
            }
        }
        this.floatTimer += dt * 3;
    }

    render(ctx) {
        ctx.save();
        const floatOffset = this.isGround ? Math.sin(this.floatTimer) * 3 : 0;
        const renderY = this.y - this.z - floatOffset;
        ctx.translate(this.x, renderY);

        // Shadow on ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, this.z + 8, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        const iconMap = { wood: '🪵', stone: '🪨', sapling: '🌱', scraps: '🍖' };
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(iconMap[this.type] || '📦', 0, 0);

        if (this.amount > 1) {
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(`x${this.amount}`, 10, 8);
        }

        ctx.restore();
    }
}

/**
 * DogBowl Structure Class
 */
class DogBowl {
    constructor(id, x, y, width = 40, height = 40) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.meals = 0;
        this.maxMeals = 5;
    }

    addMeal(amount = 1) {
        const added = Math.min(amount, this.maxMeals - this.meals);
        this.meals += added;
        return added;
    }

    eatMeal() {
        if (this.meals > 0) {
            this.meals--;
            return true;
        }
        return false;
    }

    render(ctx, rotation = 0) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (rotation) ctx.rotate((rotation * Math.PI) / 180);

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 10, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.meals > 0) {
            ctx.fillStyle = '#e67e22';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🥣', 0, -1);

        ctx.restore();
    }
}

/**
 * Crate Entity Class
 * Represents Forgotten Ranger Crates spawning in world chunks.
 */
class Crate {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = 18;
        this.looted = false;
        this.contents = []; // Will hold raw meat when opened
    }

    render(ctx, images) {
        if (this.looted) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(2, 14, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        const chestImg = images ? images['old-ranger-chest.png'] : null;
        if (chestImg && chestImg.complete) {
            const size = 38;
            ctx.drawImage(chestImg, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = '#8e5a2b';
            ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
            ctx.strokeStyle = '#523315';
            ctx.lineWidth = 3;
            ctx.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        }

        ctx.restore();
    }
}

/**
 * ResourceNode Class
 */
class ResourceNode {
    constructor(id, type, x, y) {
        this.id = id;
        this.type = type; // 'wood' or 'stone'
        this.x = x;
        this.y = y;
        this.hp = 10;
        this.maxHp = 10;
        this.radius = type === 'wood' ? 22 : 18;
        this.yieldAmount = type === 'wood' ? 5 : 3;
        this.hitFlashTimer = 0;
    }

    hit(damage = 1, bonusYield = 0) {
        this.hp = Math.max(0, this.hp - damage);
        this.hitFlashTimer = 0.15;
        const isDestroyed = this.hp <= 0;
        return {
            destroyed: isDestroyed,
            type: this.type,
            yieldAmount: isDestroyed ? (this.yieldAmount + bonusYield) : 0,
            hp: this.hp
        };
    }

    update(dt) {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
        }
    }

    render(ctx, images) {
        ctx.save();
        ctx.translate(this.x, this.y);

        let scale = 1;
        if (this.hitFlashTimer > 0) {
            scale = 1.15;
        }
        ctx.scale(scale, scale);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        if (this.type === 'wood') {
            ctx.ellipse(2, this.radius - 2, this.radius * 0.9, this.radius * 0.3, 0, 0, Math.PI * 2);
        } else {
            ctx.ellipse(3, this.radius * 0.4, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2);
        }
        ctx.fill();

        const imgKey = this.type === 'wood' ? 'tree.png' : 'rock.png';
        const img = images[imgKey];

        if (img && img.complete) {
            const drawSize = this.type === 'wood' ? this.radius * 2.8 : this.radius * 2.4;
            ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        } else {
            ctx.fillStyle = this.type === 'wood' ? '#1e5e27' : '#7f8c8d';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.hitFlashTimer > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.hp < this.maxHp) {
            const barW = 30;
            const barH = 5;
            const barX = -barW / 2;
            const barY = -this.radius - 12;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

            const hpRatio = this.hp / this.maxHp;
            ctx.fillStyle = hpRatio > 0.4 ? '#2ecc71' : '#e74c3c';
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
        }

        ctx.restore();
    }
}

/**
 * Chunk Class
 */
class Chunk {
    constructor(chunkX, chunkY, chunkSize, reserveBounds) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.chunkSize = chunkSize;
        this.worldX = chunkX * chunkSize;
        this.worldY = chunkY * chunkSize;
        this.resourceNodes = [];
        this.crates = [];
        this.diseasedCorpses = [];

        this.generate(reserveBounds);
    }

    generate(reserveBounds) {
        const seed = hashCoordinates(this.chunkX, this.chunkY);
        let localSeed = seed;

        const isInsideReserve = (x, y, margin = 50) => {
            return (
                x >= reserveBounds.x - margin &&
                x <= reserveBounds.x + reserveBounds.width + margin &&
                y >= reserveBounds.y - margin &&
                y <= reserveBounds.y + reserveBounds.height + margin
            );
        };

        const nodeCount = Math.floor(12 + seededRandom(localSeed++) * 10);

        for (let i = 0; i < nodeCount; i++) {
            const nodeX = this.worldX + seededRandom(localSeed++) * this.chunkSize;
            const nodeY = this.worldY + seededRandom(localSeed++) * this.chunkSize;

            if (isInsideReserve(nodeX, nodeY, 40)) {
                continue;
            }

            const type = seededRandom(localSeed++) > 0.4 ? 'wood' : 'stone';
            const nodeRadius = type === 'wood' ? 22 : 18;

            // Ensure trees and stones never overlap with existing nodes
            let overlaps = false;
            for (const existingNode of this.resourceNodes) {
                const dist = Math.hypot(nodeX - existingNode.x, nodeY - existingNode.y);
                if (dist < nodeRadius + existingNode.radius + 12) {
                    overlaps = true;
                    break;
                }
            }
            if (overlaps) continue;

            const nodeId = `node_${this.chunkX}_${this.chunkY}_${i}`;
            this.resourceNodes.push(new ResourceNode(nodeId, type, nodeX, nodeY));
        }

        // Rare chance (25% per chunk) to spawn a Forgotten Ranger Crate
        if (seededRandom(localSeed++) < 0.25) {
            const crateX = this.worldX + seededRandom(localSeed++) * (this.chunkSize - 100) + 50;
            const crateY = this.worldY + seededRandom(localSeed++) * (this.chunkSize - 100) + 50;
            if (!isInsideReserve(crateX, crateY, 20)) {
                const crateId = `crate_${this.chunkX}_${this.chunkY}`;
                this.crates.push(new Crate(crateId, crateX, crateY));
            }
        }

        // Rare chance (20% per chunk) to spawn a Diseased Corpse
        if (seededRandom(localSeed++) < 0.20) {
            const corpseX = this.worldX + seededRandom(localSeed++) * (this.chunkSize - 120) + 60;
            const corpseY = this.worldY + seededRandom(localSeed++) * (this.chunkSize - 120) + 60;
            if (!isInsideReserve(corpseX, corpseY, 30)) {
                const corpseId = `corpse_${this.chunkX}_${this.chunkY}`;
                this.diseasedCorpses.push(new DiseasedCorpse(corpseId, corpseX, corpseY));
            }
        }
    }

    update(dt) {
        this.resourceNodes.forEach(node => node.update(dt));
    }

    render(ctx, images, viewBounds) {
        this.resourceNodes.forEach(node => {
            if (
                node.x + node.radius >= viewBounds.minX &&
                node.x - node.radius <= viewBounds.maxX &&
                node.y + node.radius >= viewBounds.minY &&
                node.y - node.radius <= viewBounds.maxY
            ) {
                node.render(ctx, images);
            }
        });

        this.crates.forEach(crate => {
            if (
                crate.x + crate.radius >= viewBounds.minX &&
                crate.x - crate.radius <= viewBounds.maxX &&
                crate.y + crate.radius >= viewBounds.minY &&
                crate.y - crate.radius <= viewBounds.maxY
            ) {
                crate.render(ctx, images);
            }
        });

        this.diseasedCorpses.forEach(corpse => {
            if (
                corpse.x + corpse.radius >= viewBounds.minX &&
                corpse.x - corpse.radius <= viewBounds.maxX &&
                corpse.y + corpse.radius >= viewBounds.minY &&
                corpse.y - corpse.radius <= viewBounds.maxY
            ) {
                corpse.render(ctx, images);
            }
        });
    }
}

/**
 * ChunkManager Class
 */
class ChunkManager {
    constructor(chunkSize = 1000, renderRadius = 2) {
        this.chunkSize = chunkSize;
        this.renderRadius = renderRadius;
        this.loadedChunks = new Map();
    }

    getChunkKey(cx, cy) {
        return `${cx},${cy}`;
    }

    update(playerX, playerY, reserveBounds, dt) {
        const currentChunkX = Math.floor(playerX / this.chunkSize);
        const currentChunkY = Math.floor(playerY / this.chunkSize);

        const activeKeys = new Set();

        for (let dx = -this.renderRadius; dx <= this.renderRadius; dx++) {
            for (let dy = -this.renderRadius; dy <= this.renderRadius; dy++) {
                const cx = currentChunkX + dx;
                const cy = currentChunkY + dy;
                const key = this.getChunkKey(cx, cy);
                activeKeys.add(key);

                if (!this.loadedChunks.has(key)) {
                    this.loadedChunks.set(key, new Chunk(cx, cy, this.chunkSize, reserveBounds));
                }
            }
        }

        for (const [key, chunk] of this.loadedChunks.entries()) {
            if (!activeKeys.has(key)) {
                this.loadedChunks.delete(key);
            } else {
                chunk.update(dt);
            }
        }
    }

    getAllResourceNodes() {
        const nodes = [];
        for (const chunk of this.loadedChunks.values()) {
            nodes.push(...chunk.resourceNodes);
        }
        return nodes;
    }

    getAllCrates() {
        const crates = [];
        for (const chunk of this.loadedChunks.values()) {
            crates.push(...chunk.crates);
        }
        return crates;
    }

    getAllDiseasedCorpses() {
        const corpses = [];
        for (const chunk of this.loadedChunks.values()) {
            corpses.push(...chunk.diseasedCorpses);
        }
        return corpses;
    }

    removeResourceNode(nodeId) {
        for (const chunk of this.loadedChunks.values()) {
            const idx = chunk.resourceNodes.findIndex(n => n.id === nodeId);
            if (idx !== -1) {
                chunk.resourceNodes.splice(idx, 1);
                return true;
            }
        }
        return false;
    }

    render(ctx, images, viewBounds) {
        for (const chunk of this.loadedChunks.values()) {
            chunk.render(ctx, images, viewBounds);
        }
    }
}

/**
 * Player Class
 */
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 16;
        this.baseSpeed = 240;
        this.speedMult = 1.0;
        this.image = Math.random() < 0.5 ? 'ranger1.png' : 'ranger2.png';
        this.bobTimer = 0;
        this.bobY = 0;
        this.wobbleAngle = 0;
        this.facingLeft = false;
        this.screenShakeTimer = 0;
        this.screenShakeIntensity = 0;
        this.isMovementLocked = false;

        // Player Survival Stats
        this.baseMaxHp = 100;
        this.hp = 100;
        this.maxHp = 100;
        this.thirst = 100;
        this.maxThirst = 100;
        this.hunger = 100;
        this.maxHunger = 100;
        this.thirstDepleteRate = 0.6; // Halved Thirst depletion rate
        this.hungerDepleteRate = 0.3; // Hunger trickles down even slower than Thirst
        this.starveHpDepleteRate = 2.5; // HP loss per second when Thirst or Hunger is 0

        // Tiered Survival Timers (in seconds)
        this.starvingTimer = 0;
        this.dehydratedTimer = 0;

        // Base speed multiplier (modified by buffs)
        this.buffSpeedMult = 1.0;
        this.speedPenaltyMult = 1.0;
    }

    get speedMult() {
        return this.buffSpeedMult * this.speedPenaltyMult;
    }

    set speedMult(val) {
        this.buffSpeedMult = val;
    }

    get speed() {
        return this.baseSpeed * this.speedMult;
    }

    triggerScreenShake(intensity = 6, duration = 0.15) {
        this.screenShakeIntensity = intensity;
        this.screenShakeTimer = duration;
    }

    getScreenShakeOffset() {
        if (this.screenShakeTimer > 0) {
            const rx = (Math.random() - 0.5) * 2 * this.screenShakeIntensity;
            const ry = (Math.random() - 0.5) * 2 * this.screenShakeIntensity;
            return { x: rx, y: ry };
        }
        return { x: 0, y: 0 };
    }

    checkCollision(px, py, resourceNodes, placedBuildings, hqBounds = null) {
        const r = this.radius;

        for (const node of resourceNodes) {
            const dist = Math.hypot(px - node.x, py - node.y);
            if (dist < r + node.radius * 0.7) return true;
        }

        if (hqBounds) {
            const hx1 = hqBounds.x;
            const hx2 = hqBounds.x + hqBounds.width;
            const hy1 = hqBounds.y;
            const hy2 = hqBounds.y + hqBounds.height;

            const closestHqX = Math.max(hx1, Math.min(px, hx2));
            const closestHqY = Math.max(hy1, Math.min(py, hy2));
            const distHqX = px - closestHqX;
            const distHqY = py - closestHqY;

            if ((distHqX * distHqX + distHqY * distHqY) < r * r) {
                return true;
            }
        }

        for (const b of placedBuildings) {
            // Player may only pass through explicitly placed "fence gate" entities
            if (b.type === 'fence_gate') {
                continue;
            }

            const rot = b.rotation || 0;
            const isRotated = (rot === 90 || rot === 270);
            const bw = isRotated ? b.height : b.width;
            const bh = isRotated ? b.width : b.height;

            const bx1 = b.x - bw / 2;
            const bx2 = b.x + bw / 2;
            const by1 = b.y - bh / 2;
            const by2 = b.y + bh / 2;

            const closestX = Math.max(bx1, Math.min(px, bx2));
            const closestY = Math.max(by1, Math.min(py, by2));
            const distX = px - closestX;
            const distY = py - closestY;

            if ((distX * distX + distY * distY) < r * r) {
                return true;
            }
        }

        return false;
    }

    update(dt, keys, resourceNodes, placedBuildings, hqBounds = null) {
        if (this.screenShakeTimer > 0) {
            this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
        }

        // Creative Mode Survival Bypass
        if (window.game && window.game.state.isCreativeMode) {
            this.hp = 100;
            this.maxHp = 100;
            this.thirst = 100;
            this.maxThirst = 100;
            this.hunger = 100;
            this.maxHunger = 100;
            this.speedPenaltyMult = 1.0;
            this.starvingTimer = 0;
            this.dehydratedTimer = 0;
        } else {
            // Pause Hunger and Thirst depletion if player is sleeping or in cabin/HQ menu or morning recap
            const isCabinMenuOpen = window.game && (
                !document.getElementById('hq-modal')?.classList.contains('hidden') ||
                !document.getElementById('morning-recap-modal')?.classList.contains('hidden') ||
                window.game.isSleeping
            );

            if (!isCabinMenuOpen) {
                this.thirst = Math.max(0, this.thirst - this.thirstDepleteRate * dt);
                this.hunger = Math.max(0, this.hunger - this.hungerDepleteRate * dt);
            }

            // Track time spent in base starving/dehydrated states
            if (this.hunger <= 0) {
                this.starvingTimer += dt;
            } else {
                this.starvingTimer = 0;
            }

            if (this.thirst <= 0) {
                this.dehydratedTimer += dt;
            } else {
                this.dehydratedTimer = 0;
            }

            // Determine critical status threshold: 2 in-game days = 2 * 300s = 600s
            const criticalThreshold = 600;

            let maxHpPenalty = 0;
            let speedPenalty = 0;

            if (this.hunger <= 0) {
                if (this.starvingTimer >= criticalThreshold) {
                    maxHpPenalty += 0.50;
                    speedPenalty += 0.20;
                } else {
                    maxHpPenalty += 0.25;
                    speedPenalty += 0.10;
                }
            }

            if (this.thirst <= 0) {
                if (this.dehydratedTimer >= criticalThreshold) {
                    maxHpPenalty += 0.50;
                    speedPenalty += 0.20;
                } else {
                    maxHpPenalty += 0.25;
                    speedPenalty += 0.10;
                }
            }

            this.maxHp = Math.max(0, Math.round(this.baseMaxHp * (1 - maxHpPenalty)));
            this.speedPenaltyMult = Math.max(0, 1 - speedPenalty);
            this.hp = Math.min(this.hp, this.maxHp);

            if (this.thirst <= 0 || this.hunger <= 0) {
                this.hp = Math.max(0, this.hp - this.starveHpDepleteRate * dt);
            }

            // Trigger Death Sequence if HP <= 0 or Max HP <= 0
            if (this.hp <= 0 || this.maxHp <= 0) {
                if (window.game) {
                    window.game.handlePlayerDeath();
                }
            }
        }

        if (this.isMovementLocked) {
            this.bobY += (0 - this.bobY) * Math.min(1, dt * 10);
            this.wobbleAngle += (0 - this.wobbleAngle) * Math.min(1, dt * 10);
            return;
        }

        let dx = 0;
        let dy = 0;

        if (keys.w || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.ArrowDown) dy += 1;
        if (keys.a || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.ArrowRight) dx += 1;

        const len = Math.hypot(dx, dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }

        const totalDist = Math.hypot(dx * this.speed * dt, dy * this.speed * dt);
        const subSteps = Math.max(1, Math.ceil(totalDist / 6));
        const subDt = dt / subSteps;

        for (let step = 0; step < subSteps; step++) {
            const stepX = dx * this.speed * subDt;
            const stepY = dy * this.speed * subDt;

            let movedX = false;
            let movedY = false;

            if (stepX !== 0) {
                const newX = this.x + stepX;
                if (!this.checkCollision(newX, this.y, resourceNodes, placedBuildings, hqBounds)) {
                    this.x = newX;
                    movedX = true;
                }
            }

            if (stepY !== 0) {
                const newY = this.y + stepY;
                if (!this.checkCollision(this.x, newY, resourceNodes, placedBuildings, hqBounds)) {
                    this.y = newY;
                    movedY = true;
                }
            }

            // Corner nudging if movement along desired axis was blocked by a corner tip
            if (!movedX && stepX !== 0 && !movedY) {
                for (const nudgeY of [2, -2, 4, -4]) {
                    if (!this.checkCollision(this.x + stepX, this.y + nudgeY, resourceNodes, placedBuildings, hqBounds)) {
                        this.x += stepX;
                        this.y += nudgeY * 0.5;
                        break;
                    }
                }
            }
            if (!movedY && stepY !== 0 && !movedX) {
                for (const nudgeX of [2, -2, 4, -4]) {
                    if (!this.checkCollision(this.x + nudgeX, this.y + stepY, resourceNodes, placedBuildings, hqBounds)) {
                        this.x += nudgeX * 0.5;
                        this.y += stepY;
                        break;
                    }
                }
            }
        }

        const isMoving = (dx !== 0 || dy !== 0);
        if (dx < 0) this.facingLeft = true;
        else if (dx > 0) this.facingLeft = false;

        if (isMoving) {
            this.bobTimer += dt * 14;
            this.bobY = Math.sin(this.bobTimer) * 4;
            this.wobbleAngle = Math.sin(this.bobTimer * 0.5) * (6 * Math.PI / 180);
        } else {
            this.bobY += (0 - this.bobY) * Math.min(1, dt * 10);
            this.wobbleAngle += (0 - this.wobbleAngle) * Math.min(1, dt * 10);
        }
    }

    render(ctx, images) {
        const playerImg = images[this.image];
        ctx.save();
        ctx.translate(this.x, this.y + this.bobY);
        ctx.rotate(this.wobbleAngle);

        if (this.facingLeft) {
            ctx.scale(-1, 1);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 18, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (playerImg && playerImg.complete) {
            const size = 48;
            ctx.drawImage(playerImg, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = '#d35400';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * DogJock Class
 * Dog Jock entity wandering aimlessly around Reserve HQ area.
 */
class DogJock {
    constructor(hqX, hqY) {
        this.name = 'Jock';
        this.hqX = hqX;
        this.hqY = hqY;
        this.x = hqX + 20;
        this.y = hqY + 20;
        this.baseSpeed = 50;
        this.scoutSpeed = 120;
        this.targetX = this.x;
        this.targetY = this.y;
        this.state = 'wandering'; // 'wandering', 'thirsty', 'drinking', 'hungry', 'eating', 'scouting', 'returning_hq'

        this.scoutModeEnabled = false;
        this.hasScoutedToday = false;
        this.scoutTargetChunk = null;

        this.hp = 100;
        this.maxHp = 100;
        this.thirst = 90;
        this.maxThirst = 100;
        this.hunger = 90;
        this.maxHunger = 100;

        this.drinkTimer = 0;
        this.eatTimer = 0;

        this.pickNewTarget();

        this.bobTimer = Math.random() * 10;
        this.bobY = 0;
        this.wobbleAngle = 0;
        this.facingLeft = false;
    }

    get speed() {
        return (this.state === 'scouting' || this.state === 'returning_hq') ? this.scoutSpeed : this.baseSpeed;
    }

    pickNewTarget() {
        const radius = 120;
        this.targetX = this.hqX + (Math.random() - 0.5) * radius * 2;
        this.targetY = this.hqY + (Math.random() - 0.5) * radius * 2;
    }

    recallToHQ() {
        this.state = 'returning_hq';
        this.scoutTargetChunk = null;
        this.targetX = this.hqX + 20;
        this.targetY = this.hqY + 20;
    }

    update(dt, waterhole, dogBowls = [], game = null) {
        // Actively deplete thirst and hunger over time; deplete faster while scouting
        const isScouting = (this.state === 'scouting');
        const thirstRate = isScouting ? 2.5 : 0.8;
        const hungerRate = isScouting ? 2.0 : 0.5;

        this.thirst = Math.max(0, this.thirst - dt * thirstRate);
        this.hunger = Math.max(0, this.hunger - dt * hungerRate);

        // Check daily scout initiation if Scout Mode active and not yet scouted today
        if (this.scoutModeEnabled && !this.hasScoutedToday && this.state !== 'scouting' && this.state !== 'returning_hq') {
            if (this.thirst > 20 && this.hunger > 20 && game) {
                const targetChunk = game.findNearestUnrevealedChunk();
                if (targetChunk) {
                    this.state = 'scouting';
                    this.hasScoutedToday = true;
                    this.scoutTargetChunk = targetChunk;
                    this.targetX = targetChunk.x;
                    this.targetY = targetChunk.y;
                }
            }
        }

        if (this.state === 'scouting') {
            if (this.thirst <= 10 || this.hunger <= 10) {
                this.recallToHQ();
            } else {
                this.moveTowardsTarget(dt);
                if (game) {
                    // Reveal Fog of War chunks along walking path
                    const currentChunkX = Math.floor(this.x / 1000);
                    const currentChunkY = Math.floor(this.y / 1000);
                    game.revealedChunks.add(`${currentChunkX},${currentChunkY}`);
                }

                const distToTarget = Math.hypot(this.targetX - this.x, this.targetY - this.y);
                if (distToTarget < 20) {
                    if (game && this.scoutTargetChunk) {
                        game.revealedChunks.add(`${this.scoutTargetChunk.chunkX},${this.scoutTargetChunk.chunkY}`);
                    }
                    this.recallToHQ();
                }
            }
        } else if (this.state === 'returning_hq') {
            this.targetX = this.hqX + 20;
            this.targetY = this.hqY + 20;
            this.moveTowardsTarget(dt);
            if (game) {
                const currentChunkX = Math.floor(this.x / 1000);
                const currentChunkY = Math.floor(this.y / 1000);
                game.revealedChunks.add(`${currentChunkX},${currentChunkY}`);
            }

            const distToHq = Math.hypot(this.hqX + 20 - this.x, this.hqY + 20 - this.y);
            if (distToHq < 25) {
                this.state = 'wandering';
                this.pickNewTarget();
            }
        } else if (this.state === 'wandering') {
            if (this.thirst <= 40) {
                this.state = 'thirsty';
            } else if (this.hunger <= 40) {
                this.state = 'hungry';
            } else {
                this.moveTowardsTarget(dt);
                const distToTarget = Math.hypot(this.targetX - this.x, this.targetY - this.y);
                if (distToTarget < 10) {
                    if (Math.random() < 0.02) this.pickNewTarget();
                }
            }
        } else if (this.state === 'thirsty') {
            this.targetX = waterhole.x;
            this.targetY = waterhole.y;
            this.moveTowardsTarget(dt);

            const distToWaterhole = Math.hypot(waterhole.x - this.x, waterhole.y - this.y);
            if (distToWaterhole < waterhole.radiusY + 20) {
                this.state = 'drinking';
                this.drinkTimer = 3.0;
            }
        } else if (this.state === 'drinking') {
            this.drinkTimer -= dt;
            waterhole.drink(dt * 4);
            this.thirst = Math.min(this.maxThirst, this.thirst + dt * 25);

            if (this.drinkTimer <= 0 || this.thirst >= this.maxThirst) {
                this.state = 'wandering';
                this.pickNewTarget();
            }
        } else if (this.state === 'hungry') {
            // Find filled dog bowl
            const filledBowl = dogBowls.find(b => b.meals > 0);
            if (filledBowl) {
                this.targetX = filledBowl.x;
                this.targetY = filledBowl.y;
                this.moveTowardsTarget(dt);

                const distToBowl = Math.hypot(filledBowl.x - this.x, filledBowl.y - this.y);
                if (distToBowl < 25) {
                    if (filledBowl.eatMeal()) {
                        this.state = 'eating';
                        this.eatTimer = 3.0;
                    }
                }
            } else {
                // If no filled bowl, stay wandering
                this.state = 'wandering';
                this.pickNewTarget();
            }
        } else if (this.state === 'eating') {
            this.eatTimer -= dt;
            this.hunger = Math.min(this.maxHunger, this.hunger + dt * 25);

            if (this.eatTimer <= 0 || this.hunger >= this.maxHunger) {
                this.state = 'wandering';
                this.pickNewTarget();
            }
        }
    }

    moveTowardsTarget(dt) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 3) {
            if (dx < 0) this.facingLeft = true;
            else if (dx > 0) this.facingLeft = false;

            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;

            this.bobTimer += dt * 10;
            this.bobY = Math.sin(this.bobTimer) * 3;
            this.wobbleAngle = Math.sin(this.bobTimer * 0.5) * (5 * Math.PI / 180);
        } else {
            this.bobY += (0 - this.bobY) * Math.min(1, dt * 10);
            this.wobbleAngle += (0 - this.wobbleAngle) * Math.min(1, dt * 10);
        }
    }

    render(ctx, images) {
        ctx.save();
        ctx.translate(this.x, this.y + this.bobY);
        ctx.rotate(this.wobbleAngle);

        if (this.facingLeft) {
            ctx.scale(-1, 1);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        const dogImg = images['dog-jock.png'];
        if (dogImg && dogImg.complete) {
            const size = 36;
            ctx.drawImage(dogImg, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = '#e67e22';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * Waterhole Entity Class
 */
class Waterhole {
    constructor(x, y, radiusX = 140, radiusY = 80) {
        this.x = x;
        this.y = y;
        this.radiusX = radiusX;
        this.radiusY = radiusY;
        this.waterLevel = 100; // 0 to 100
        this.maxWater = 100;
    }

    drink(amount = 5) {
        const drank = Math.min(this.waterLevel, amount);
        this.waterLevel -= drank;
        return drank;
    }

    refill(amount = 20) {
        this.waterLevel = Math.min(this.maxWater, this.waterLevel + amount);
    }

    render(ctx, images) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Water level ratio affects inner color/size
        const waterRatio = Math.max(0.2, this.waterLevel / this.maxWater);

        const waterImg = images ? images['waterhole.png'] : null;
        if (waterImg && waterImg.complete) {
            const drawW = this.radiusX * 2.2;
            const drawH = this.radiusY * 2.2;
            ctx.drawImage(waterImg, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
            // Outer Mud Ring
            ctx.fillStyle = '#3a2717';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radiusX + 15, this.radiusY + 10, Math.PI / 6, 0, Math.PI * 2);
            ctx.fill();

            // Water Pool
            ctx.fillStyle = waterRatio < 0.3 ? '#5c4328' : '#1f4866';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radiusX * waterRatio, this.radiusY * waterRatio, Math.PI / 6, 0, Math.PI * 2);
            ctx.fill();

            // Inner Shimmer
            ctx.fillStyle = waterRatio < 0.3 ? '#82633f' : '#295b80';
            ctx.beginPath();
            ctx.ellipse(-10, -5, (this.radiusX - 30) * waterRatio, (this.radiusY - 20) * waterRatio, Math.PI / 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Waterhole Water Bar Label
        const barW = 80;
        const barH = 8;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-barW / 2 - 1, -this.radiusY - 21, barW + 2, barH + 2);

        ctx.fillStyle = waterRatio < 0.3 ? '#e74c3c' : '#3498db';
        ctx.fillRect(-barW / 2, -this.radiusY - 20, barW * waterRatio, barH);

        ctx.fillStyle = '#f0f4f8';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Water: ${Math.round(this.waterLevel)}%`, 0, -this.radiusY - 25);

        ctx.restore();
    }
}

/**
 * Living Ecosystem: Animal AI State Machine
 * States: 'wandering', 'thirsty', 'drinking'
 */
class Animal {
    constructor(speciesData, x, y, reserveBounds) {
        this.speciesId = speciesData.speciesId;
        this.name = speciesData.name;
        this.icon = speciesData.icon;
        this.image = speciesData.image;
        this.x = x;
        this.y = y;
        this.reserveBounds = reserveBounds;

        this.hp = 100;
        this.maxHp = 100;
        this.hunger = 80 + Math.random() * 20; // 0 to 100
        this.maxHunger = 100;
        this.thirst = 80 + Math.random() * 20; // 100 (full) to 0 (thirsty)
        this.maxThirst = 100;

        this.speed = 25 + Math.random() * 20;
        this.state = 'wandering'; // 'wandering', 'thirsty', 'drinking', 'grazing'
        this.drinkTimer = 0;
        this.grazeTimer = 0;

        this.targetX = x;
        this.targetY = y;
        this.pickNewWanderTarget();

        this.bobTimer = Math.random() * 10;
        this.bobY = 0;
        this.wobbleAngle = 0;
        this.facingLeft = false;
    }

    pickNewWanderTarget() {
        const margin = 50;
        const minX = this.reserveBounds.x + margin;
        const maxX = this.reserveBounds.x + this.reserveBounds.width - margin;
        const minY = this.reserveBounds.y + margin;
        const maxY = this.reserveBounds.y + this.reserveBounds.height - margin;

        this.targetX = minX + Math.random() * (maxX - minX);
        this.targetY = minY + Math.random() * (maxY - minY);
    }

    isHerbivore() {
        return ['impala', 'zebra', 'elephant', 'rhino'].includes(this.speciesId);
    }

    update(dt, waterhole) {
        // Deplete thirst and hunger over time
        this.thirst = Math.max(0, this.thirst - dt * 1.5);
        this.hunger = Math.max(0, this.hunger - dt * 1.0);

        // AI State Machine Logic
        if (this.state === 'wandering') {
            if (this.thirst <= 30) {
                this.state = 'thirsty';
            } else if (this.isHerbivore() && this.hunger <= 50) {
                this.state = 'grazing';
                this.grazeTimer = 5.0; // Graze for 5 seconds
            } else {
                this.moveTowardsTarget(dt);
                const distToTarget = Math.hypot(this.targetX - this.x, this.targetY - this.y);
                if (distToTarget < 15) {
                    this.pickNewWanderTarget();
                }
            }
        } else if (this.state === 'thirsty') {
            // Pathfind to Waterhole
            this.targetX = waterhole.x;
            this.targetY = waterhole.y;
            this.moveTowardsTarget(dt);

            const distToWaterhole = Math.hypot(waterhole.x - this.x, waterhole.y - this.y);
            if (distToWaterhole < waterhole.radiusY + 20) {
                this.state = 'drinking';
                this.drinkTimer = 4.0; // Drink for 4 seconds
            }
        } else if (this.state === 'drinking') {
            this.drinkTimer -= dt;
            waterhole.drink(dt * 3);
            this.thirst = Math.min(this.maxThirst, this.thirst + dt * 25);

            if (this.drinkTimer <= 0 || this.thirst >= this.maxThirst) {
                this.state = 'wandering';
                this.pickNewWanderTarget();
            }
        } else if (this.state === 'grazing') {
            this.grazeTimer -= dt;
            this.hunger = Math.min(this.maxHunger, this.hunger + dt * 15);

            if (this.grazeTimer <= 0 || this.hunger >= this.maxHunger) {
                this.state = 'wandering';
                this.pickNewWanderTarget();
            }
        }
    }

    moveTowardsTarget(dt) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 2) {
            if (dx < 0) this.facingLeft = true;
            else if (dx > 0) this.facingLeft = false;

            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;

            this.bobTimer += dt * 8;
            this.bobY = Math.sin(this.bobTimer) * 3;
            this.wobbleAngle = Math.sin(this.bobTimer * 0.5) * (5 * Math.PI / 180);
        } else {
            this.bobY += (0 - this.bobY) * Math.min(1, dt * 10);
            this.wobbleAngle += (0 - this.wobbleAngle) * Math.min(1, dt * 10);
        }
    }

    render(ctx, images) {
        const animalImg = images[this.image];
        ctx.save();
        ctx.translate(this.x, this.y + this.bobY);
        ctx.rotate(this.wobbleAngle);

        if (this.facingLeft) {
            ctx.scale(-1, 1);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        if (animalImg && animalImg.complete) {
            const size = 48;
            ctx.drawImage(animalImg, -size / 2, -size / 2, size, size);
        } else {
            ctx.font = '28px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.icon, 0, 0);
        }

        // State indicator badge (e.g. Thirsty/Drinking)
        if (this.state === 'thirsty') {
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('💧', 0, -25);
        } else if (this.state === 'drinking') {
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('💦', 0, -25);
        }

        ctx.restore();
    }
}

/**
 * Camp Chest Class
 * Shared resource container located next to Reserve HQ.
 */
class CampChest {
    constructor(id, x, y, width = 44, height = 44) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.radius = 22;
        this.inventory = new Inventory(20, 100);
    }

    render(ctx, images) {
        const chestImg = images ? images['old-ranger-chest.png'] : null;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 14, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (chestImg && chestImg.complete) {
            ctx.drawImage(chestImg, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            ctx.fillStyle = '#8e44ad';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
        ctx.restore();
    }
}

/**
 * Living Ecosystem: Ranger Class with AI State Machine & Traits
 * Autonomous Tasks: Patrolling, Refilling Waterhole, Maintaining Fences.
 */
class Ranger {
    constructor(data, hutX, hutY, reserveBounds) {
        this.id = data.id;
        this.name = data.name;
        this.hutX = hutX;
        this.hutY = hutY;
        this.x = hutX + (Math.random() - 0.5) * 30;
        this.y = hutY + (Math.random() - 0.5) * 30;
        this.reserveBounds = reserveBounds;

        this.traits = data.traits || [];
        this.image = data.image || 'ranger1.png';

        this.assignedBuilding = data.assignedBuilding || null;
        this.job = data.job || null; // 'Gatherer', 'Forager'
        this.buff = data.buff || null;
        this.carryInventory = new Inventory(5, 50);

        this.hp = 100;
        this.maxHp = 100;
        this.hunger = 85 + Math.random() * 15;
        this.maxHunger = 100;
        this.thirst = 85 + Math.random() * 15;
        this.maxThirst = 100;

        // Apply Trait & Buff Modifiers
        let speedMult = 1.0;
        let workMult = 1.0;
        this.traits.forEach(t => {
            if (t.effects && t.effects.moveSpeedMult) speedMult *= t.effects.moveSpeedMult;
            if (t.effects && t.effects.workSpeedMult) workMult *= t.effects.workSpeedMult;
        });
        if (this.buff && this.buff.effect) {
            if (this.buff.effect.moveSpeedMult) speedMult *= this.buff.effect.moveSpeedMult;
            if (this.buff.effect.workSpeedMult) workMult *= this.buff.effect.workSpeedMult;
        }

        this.baseSpeed = 45 * speedMult;
        this.workSpeedMult = workMult;

        this.state = 'patrolling'; // 'patrolling', 'refilling_water', 'maintaining_fences', 'seeking_water', 'drinking'
        this.targetX = this.x;
        this.targetY = this.y;
        this.taskTimer = 0;
        this.fenceWaypointIndex = 0;

        this.bobTimer = Math.random() * 10;
        this.bobY = 0;
        this.wobbleAngle = 0;
        this.facingLeft = false;
    }

    getFenceWaypoints() {
        const b = this.reserveBounds;
        return [
            { x: b.x + 20, y: b.y + 20 },
            { x: b.x + b.width - 20, y: b.y + 20 },
            { x: b.x + b.width - 20, y: b.y + b.height - 20 },
            { x: b.x + 20, y: b.y + b.height - 20 }
        ];
    }

    update(dt, waterhole, gameInstance = null) {
        // Universal Thirst & Hunger AI Decay
        this.thirst = Math.max(0, this.thirst - dt * 0.8);
        this.hunger = Math.max(0, this.hunger - dt * 0.4);

        if (this.hunger <= 0) this.starvingTimer = (this.starvingTimer || 0) + dt;
        else this.starvingTimer = 0;

        if (this.thirst <= 0) this.dehydratedTimer = (this.dehydratedTimer || 0) + dt;
        else this.dehydratedTimer = 0;

        // Needs & Penalties (No Death):
        // 0 Hunger or 0 Thirst applies Base Penalty (-25% Max HP, -15% move/work speed)
        // After 2 days (600s), applies Critical Penalty (-50% Max HP, -30% move/work speed)
        // Hard-caps at -75% Max HP, -60% move/work speed
        let maxHpPenalty = 0;
        let speedPenalty = 0;

        if (this.hunger <= 0) {
            maxHpPenalty += (this.starvingTimer >= 600) ? 0.50 : 0.25;
            speedPenalty += (this.starvingTimer >= 600) ? 0.30 : 0.15;
        }
        if (this.thirst <= 0) {
            maxHpPenalty += (this.dehydratedTimer >= 600) ? 0.50 : 0.25;
            speedPenalty += (this.dehydratedTimer >= 600) ? 0.30 : 0.15;
        }

        maxHpPenalty = Math.min(0.75, maxHpPenalty);
        speedPenalty = Math.min(0.60, speedPenalty);

        this.maxHp = Math.round(100 * (1 - maxHpPenalty));
        this.hp = Math.max(1, Math.min(this.hp, this.maxHp)); // NO DEATH: hard-capped at 1 HP minimum

        let speedMult = 1.0;
        let workMult = 1.0;
        this.traits.forEach(t => {
            if (t.effects && t.effects.moveSpeedMult) speedMult *= t.effects.moveSpeedMult;
            if (t.effects && t.effects.workSpeedMult) workMult *= t.effects.workSpeedMult;
        });
        if (this.buff && this.buff.effect) {
            if (this.buff.effect.moveSpeedMult) speedMult *= this.buff.effect.moveSpeedMult;
            if (this.buff.effect.workSpeedMult) workMult *= this.buff.effect.workSpeedMult;
        }

        this.baseSpeed = 45 * speedMult * (1 - speedPenalty);
        this.workSpeedMult = workMult * (1 - speedPenalty);

        // Task Interruption Threshold: Must finish current action cycle before checking water. Force job interruption ONLY if Thirst strictly drops below 50%.
        const isBusyInCycle = (this.taskTimer > 0);
        if (!isBusyInCycle && this.thirst < 50 && this.state !== 'seeking_water' && this.state !== 'drinking') {
            this.savedStateBeforeThirst = this.state;
            this.state = 'seeking_water';
        }

        if (this.state === 'seeking_water') {
            const dist = Math.hypot(waterhole.x - this.x, waterhole.y - this.y);
            if (dist < waterhole.radiusY + 30) {
                this.state = 'drinking';
            } else {
                this.moveTowards(waterhole.x, waterhole.y, dt);
            }
            return;
        }

        if (this.state === 'drinking') {
            this.thirst = Math.min(100, this.thirst + dt * 35);
            if (this.thirst >= 100) {
                this.state = this.savedStateBeforeThirst || 'patrolling';
                this.savedStateBeforeThirst = null;
            }
            return;
        }

        // Night Sleeping Need
        if (gameInstance && gameInstance.isNight()) {
            const distToHousing = Math.hypot(this.hutX - this.x, this.hutY - this.y);
            if (distToHousing < 25) {
                this.state = 'sleeping';
            } else {
                this.moveTowards(this.hutX, this.hutY, dt);
            }
            return;
        } else if (this.state === 'sleeping') {
            this.state = 'patrolling';
        }

        // Job Routines execution if gameInstance is available
        if (gameInstance && this.job) {
            this.updateJobRoutine(dt, gameInstance);
            return;
        }

        // Default Patrolling / Refilling / Maintenance behavior
        if (this.state === 'patrolling') {
            const dist = Math.hypot(this.targetX - this.x, this.targetY - this.y);
            if (dist < 15) {
                const rand = Math.random();
                if (waterhole.waterLevel < 60 && rand < 0.4) {
                    this.state = 'refilling_water';
                } else if (rand < 0.7) {
                    this.state = 'maintaining_fences';
                    this.fenceWaypointIndex = Math.floor(Math.random() * 4);
                } else {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * 140;
                    this.targetX = this.hutX + Math.cos(angle) * r;
                    this.targetY = this.hutY + Math.sin(angle) * r;
                }
            } else {
                this.moveTowards(this.targetX, this.targetY, dt);
            }
        } else if (this.state === 'refilling_water') {
            const dist = Math.hypot(waterhole.x - this.x, waterhole.y - this.y);
            if (dist < waterhole.radiusY + 30) {
                this.taskTimer += dt * this.workSpeedMult;
                waterhole.refill(dt * 15 * this.workSpeedMult);

                if (waterhole.waterLevel >= waterhole.maxWater || this.taskTimer >= 5.0) {
                    this.state = 'patrolling';
                    this.taskTimer = 0;
                }
            } else {
                this.moveTowards(waterhole.x, waterhole.y, dt);
            }
        } else if (this.state === 'maintaining_fences') {
            const waypoints = this.getFenceWaypoints();
            const wp = waypoints[this.fenceWaypointIndex];
            const dist = Math.hypot(wp.x - this.x, wp.y - this.y);

            if (dist < 20) {
                this.taskTimer += dt * this.workSpeedMult;
                if (this.taskTimer >= 3.0) {
                    this.fenceWaypointIndex = (this.fenceWaypointIndex + 1) % 4;
                    this.taskTimer = 0;

                    if (Math.random() < 0.5) {
                        this.state = 'patrolling';
                    }
                }
            } else {
                this.moveTowards(wp.x, wp.y, dt);
            }
        }
    }

    updateJobRoutine(dt, gameInstance) {
        if (this.job === 'Gatherer') {
            this.runGathererRoutine(dt, gameInstance);
        } else if (this.job === 'Forager') {
            this.runForagerRoutine(dt, gameInstance);
        }
    }

    runGathererRoutine(dt, gameInstance) {
        const campChest = gameInstance.campChest;
        // Check if carry inventory is full or has resources to deposit
        const carryTotal = this.carryInventory.slots.reduce((sum, s) => sum + s.count, 0);

        if (carryTotal >= 20 || (this.targetNode === null && carryTotal > 0)) {
            // Pathfind to Camp Chest to deposit
            const dist = Math.hypot(campChest.x - this.x, campChest.y - this.y);
            if (dist < campChest.radius + 20) {
                // Deposit resources into Camp Chest
                this.carryInventory.slots.forEach(slot => {
                    if (slot.type && slot.count > 0) {
                        campChest.inventory.addItem(slot.type, slot.count, slot.name);
                        slot.type = null;
                        slot.count = 0;
                        slot.name = null;
                    }
                });
                gameInstance.addFloatingText('📦 Deposited Resources!', campChest.x, campChest.y - 20, '#2ecc71');
                this.targetNode = null;
            } else {
                this.moveTowards(campChest.x, campChest.y, dt);
            }
            return;
        }

        // Find nearest Wood tree or Stone rock node
        if (!this.targetNode || this.targetNode.hp <= 0) {
            const nodes = gameInstance.chunkManager.getAllResourceNodes();
            let nearest = null;
            let minDist = Infinity;
            nodes.forEach(n => {
                if (n.hp > 0) {
                    const d = Math.hypot(n.x - this.x, n.y - this.y);
                    if (d < minDist) {
                        minDist = d;
                        nearest = n;
                    }
                }
            });
            this.targetNode = nearest;
        }

        if (this.targetNode) {
            const dist = Math.hypot(this.targetNode.x - this.x, this.targetNode.y - this.y);
            if (dist < this.targetNode.radius + 20) {
                this.taskTimer += dt * this.workSpeedMult;
                if (this.taskTimer >= 1.0) {
                    this.taskTimer = 0;
                    this.targetNode.hp -= 2;
                    const resType = this.targetNode.type; // 'wood' or 'stone'
                    const resName = resType === 'wood' ? 'Wood' : 'Stone';
                    this.carryInventory.addItem(resType, 2, resName);
                    gameInstance.addFloatingText(`+2 ${resName}`, this.x, this.y - 15, '#f1c40f');

                    if (this.targetNode.hp <= 0) {
                        gameInstance.chunkManager.removeResourceNode(this.targetNode.id);
                        this.targetNode = null;
                    }
                }
            } else {
                this.moveTowards(this.targetNode.x, this.targetNode.y, dt);
            }
        } else {
            // Idle near Camp Chest if no resource nodes exist
            this.moveTowards(campChest.x + 30, campChest.y + 30, dt);
        }
    }

    runForagerRoutine(dt, gameInstance) {
        const campChest = gameInstance.campChest;

        // Scout reveal: as Forager moves, permanently reveal map chunks in a radius around them
        const currentChunkX = Math.floor(this.x / 1000);
        const currentChunkY = Math.floor(this.y / 1000);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                gameInstance.revealedChunks.add(`${currentChunkX + dx},${currentChunkY + dy}`);
            }
        }

        const carryTotal = this.carryInventory.slots.reduce((sum, s) => sum + s.count, 0);

        if (carryTotal >= 15 || (this.targetForage === null && carryTotal > 0)) {
            // Return to Camp Chest to deposit
            const dist = Math.hypot(campChest.x - this.x, campChest.y - this.y);
            if (dist < campChest.radius + 20) {
                this.carryInventory.slots.forEach(slot => {
                    if (slot.type && slot.count > 0) {
                        campChest.inventory.addItem(slot.type, slot.count, slot.name);
                        slot.type = null;
                        slot.count = 0;
                        slot.name = null;
                    }
                });
                gameInstance.addFloatingText('📦 Loot Deposited!', campChest.x, campChest.y - 20, '#e67e22');
                this.targetForage = null;
            } else {
                this.moveTowards(campChest.x, campChest.y, dt);
            }
            return;
        }

        // Find nearest Crates or Diseased Corpses
        if (!this.targetForage || this.targetForage.looted) {
            const crates = gameInstance.chunkManager.getAllCrates().filter(c => !c.looted);
            const corpses = gameInstance.chunkManager.getAllDiseasedCorpses().filter(dc => !dc.looted);
            const targets = [...crates, ...corpses];

            let nearest = null;
            let minDist = Infinity;
            targets.forEach(t => {
                const d = Math.hypot(t.x - this.x, t.y - this.y);
                if (d < minDist) {
                    minDist = d;
                    nearest = t;
                }
            });
            this.targetForage = nearest;
        }

        if (this.targetForage) {
            const dist = Math.hypot(this.targetForage.x - this.x, this.targetForage.y - this.y);
            if (dist < (this.targetForage.radius || 20) + 20) {
                this.taskTimer += dt * this.workSpeedMult;
                if (this.taskTimer >= 1.5) {
                    this.taskTimer = 0;
                    this.targetForage.looted = true;
                    if (this.targetForage instanceof DiseasedCorpse) {
                        const meatCount = this.targetForage.rawMeatCount || 3;
                        this.carryInventory.addItem('raw_meat', meatCount, 'Raw Meat');
                        gameInstance.addFloatingText(`🥩 Scavenged +${meatCount} Raw Meat!`, this.x, this.y - 15, '#e74c3c');
                    } else if (this.targetForage instanceof Crate) {
                        const meatCount = Math.floor(2 + Math.random() * 3);
                        this.carryInventory.addItem('raw_meat', meatCount, 'Raw Meat');
                        gameInstance.addFloatingText(`📦 Looted Crate +${meatCount} Raw Meat!`, this.x, this.y - 15, '#f39c12');
                    }
                    this.targetForage = null;
                }
            } else {
                this.moveTowards(this.targetForage.x, this.targetForage.y, dt);
            }
        } else {
            // Idle near Camp Chest
            this.moveTowards(campChest.x - 30, campChest.y + 30, dt);
        }
    }


    moveTowards(tx, ty, dt) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 2) {
            if (dx < 0) this.facingLeft = true;
            else if (dx > 0) this.facingLeft = false;

            this.x += (dx / dist) * this.baseSpeed * dt;
            this.y += (dy / dist) * this.baseSpeed * dt;

            this.bobTimer += dt * 8;
            this.bobY = Math.sin(this.bobTimer) * 3;
            this.wobbleAngle = Math.sin(this.bobTimer * 0.5) * (4 * Math.PI / 180);
        }
    }

    render(ctx, images) {
        const rangerImg = images[this.image];
        ctx.save();
        ctx.translate(this.x, this.y + this.bobY);
        ctx.rotate(this.wobbleAngle);

        if (this.facingLeft) {
            ctx.scale(-1, 1);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (rangerImg && rangerImg.complete) {
            const size = 44;
            ctx.drawImage(rangerImg, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = '#2980b9';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
        }

        // Task badge
        if (this.state === 'seeking_water' || this.state === 'drinking') {
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('💧', 0, -22);
        } else if (this.job === 'Gatherer') {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('🪓', 0, -22);
        } else if (this.job === 'Forager') {
            ctx.fillStyle = '#e67e22';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('🎒', 0, -22);
        } else if (this.state === 'refilling_water') {
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('🪣', 0, -22);
        } else if (this.state === 'maintaining_fences') {
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('🔧', 0, -22);
        }

        ctx.restore();
    }
}

/**
 * Braai Structure Class
 */
class Braai {
    constructor(id, x, y, width = 70, height = 70) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.braaiWood = 0;
        this.maxFuel = 10;
        this.rawMeat = 0;
        this.maxMeat = 10;
        this.cookedMeat = 0;

        this.isCooking = false;
        this.cookTimer = 0;
        this.cookDuration = 4.0;
    }

    addFuel(amount) {
        const added = Math.min(amount, this.maxFuel - this.braaiWood);
        this.braaiWood += added;
        return added;
    }

    addMeat(amount) {
        const added = Math.min(amount, this.maxMeat - this.rawMeat);
        this.rawMeat += added;
        return added;
    }

    collectOutput() {
        const collected = this.cookedMeat;
        this.cookedMeat = 0;
        return collected;
    }

    update(dt) {
        if (this.braaiWood > 0 && this.rawMeat > 0) {
            this.isCooking = true;
            this.cookTimer += dt;

            if (this.cookTimer >= this.cookDuration) {
                this.cookTimer = 0;
                this.braaiWood -= 1;
                this.rawMeat -= 1;
                this.cookedMeat += 1;
            }
        } else {
            this.isCooking = false;
            this.cookTimer = 0;
        }
    }

    render(ctx, images, rotation = 0) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (rotation) ctx.rotate((rotation * Math.PI) / 180);

        const braaiImg = images ? images['braai.png'] : null;
        if (braaiImg && braaiImg.complete) {
            ctx.drawImage(braaiImg, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.fillStyle = this.isCooking ? '#e67e22' : '#7f8c8d';
            ctx.fillText('BRAAI', 0, 0);
        }

        ctx.restore();
    }
}

/**
 * Furnace Class
 */
class Furnace {
    constructor(id, x, y, width = 70, height = 70) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.fuelWood = 0;
        this.maxFuel = 20;
        this.rawStone = 0;
        this.maxMaterial = 20;
        this.processedStone = 0;

        this.isSmelting = false;
        this.smeltTimer = 0;
        this.smeltDuration = 3.0;
    }

    addFuel(amount) {
        const added = Math.min(amount, this.maxFuel - this.fuelWood);
        this.fuelWood += added;
        return added;
    }

    addMaterial(amount) {
        const added = Math.min(amount, this.maxMaterial - this.rawStone);
        this.rawStone += added;
        return added;
    }

    collectOutput() {
        const collected = this.processedStone;
        this.processedStone = 0;
        return collected;
    }

    update(dt) {
        if (this.fuelWood > 0 && this.rawStone > 0) {
            this.isSmelting = true;
            this.smeltTimer += dt;

            if (this.smeltTimer >= this.smeltDuration) {
                this.smeltTimer = 0;
                this.fuelWood -= 1;
                this.rawStone -= 1;
                this.processedStone += 1;
            }
        } else {
            this.isSmelting = false;
            this.smeltTimer = 0;
        }
    }

    render(ctx, rotation = 0) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (rotation) ctx.rotate((rotation * Math.PI) / 180);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, this.height / 2 - 4, this.width * 0.5, this.height * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.strokeStyle = '#2c2c2c';
        ctx.lineWidth = 3;
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, 0);
        ctx.lineTo(this.width / 2, 0);
        ctx.stroke();

        ctx.fillStyle = this.isSmelting ? '#e67e22' : '#1a1a1a';
        ctx.beginPath();
        ctx.arc(0, this.height / 4, 12, Math.PI, 0, false);
        ctx.fill();

        if (this.isSmelting) {
            const glow = 2 + Math.sin(performance.now() / 150) * 2;
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(0, this.height / 4, 6 + glow, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#f0f4f8';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FURNACE', 0, -this.height / 4);

        ctx.restore();
    }
}

/**
 * Main ReserveGame Manager Class
 */
class ReserveGame {
    constructor() {
        this.state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
        this.dayDuration = 300;
        this.tickInterval = 100;
        this.timeElapsedInDay = 0;
        this.isPaused = false;
        this.week = 1;
        this.weeklyStats = {
            income: 0,
            expenses: 0,
            wagesSpent: 0,
            animalsBought: 0,
            buildingsBuilt: 0,
            upgradesSpent: 0
        };

        // Reserve Fixed Coordinate Zone
        this.reserve = { x: 500, y: 500, width: 1000, height: 1000 };

        // Structure Scaling: Reserve HQ scaled significantly (288x288, roughly 4x watering hole / 2x Ranger Hut footprint)
        const hqWidth = 288;
        const hqHeight = 288;

        // Waterhole Placement
        this.waterhole = new Waterhole(this.reserve.x + 650, this.reserve.y + 650);

        // Spawn Prevention: Strict coordinate collision check during world generation
        let proposedHqX = this.reserve.x + 80;
        let proposedHqY = this.reserve.y + 80;

        const checkOverlap = (hx, hy, hw, hh, wh) => {
            const hqBox = { minX: hx - 20, maxX: hx + hw + 20, minY: hy - 20, maxY: hy + hh + 20 };
            const whBox = {
                minX: wh.x - wh.radiusX - 20,
                maxX: wh.x + wh.radiusX + 20,
                minY: wh.y - wh.radiusY - 20,
                maxY: wh.y + wh.radiusY + 20
            };
            return !(hqBox.maxX < whBox.minX || hqBox.minX > whBox.maxX || hqBox.maxY < whBox.minY || hqBox.minY > whBox.maxY);
        };

        if (checkOverlap(proposedHqX, proposedHqY, hqWidth, hqHeight, this.waterhole)) {
            proposedHqX = this.reserve.x + 80;
            proposedHqY = this.reserve.y + this.reserve.height - hqHeight - 80;
        }

        this.hq = { x: proposedHqX, y: proposedHqY, width: hqWidth, height: hqHeight };
        this.campChest = new CampChest('camp_chest_init', this.hq.x + this.hq.width + 30, this.hq.y + 144);
        this.activeRangerHut = null;
        this.gridSize = 20;

        // Overseer Camera System
        this.camera = {
            x: this.hq.x + this.hq.width / 2,
            y: this.hq.y + this.hq.height / 2,
            scale: 0.65,
            speed: 700
        };

        // Selection & Command System
        this.selectedRanger = null;
        this.selectedEntity = null;

        // Fog of War & Minimap Systems
        this.revealedChunks = new Set();
        // Reveal initial 4x4 chunk area surrounding Reserve HQ
        for (let cx = -1; cx <= 2; cx++) {
            for (let cy = -1; cy <= 2; cy++) {
                this.revealedChunks.add(`${cx},${cy}`);
            }
        }
        this.fogSightRadius = 450;
        this.minimapZoom = 1.0;
        this.minMinimapZoom = 0.5;
        this.maxMinimapZoom = 2.5;

        // RPG Buff Modifiers
        this.buffs = {
            harvestYieldBonus: 0,
            workSpeedMult: 1.0,
            incomeMult: 1.0,
            capacityBonus: 0
        };

        // OOP Managers & Audio Systems
        this.audioManager = new AudioManager();
        this.inventory = this.campChest.inventory; // Camp Chest as sole global storage
        this.inventory.addItem('wood', 30, 'Wood');
        this.inventory.addItem('stone', 15, 'Stone');
        this.activeHotbarIndex = 0;
        this.chunkManager = new ChunkManager(1000, 2);
        this.player = new Player(1000, 1060);
        this.dogJock = new DogJock(this.hq.x + 144, this.hq.y + 144);
        this.jockAssignedBuilding = 'hq'; // 'hq' or rangerHut.id

        this.droppedItems = [];
        this.plantedSaplings = [];
        this.shrubs = [];
        this.initShrubs();
        this.rangers = [];
        this.furnaces = [];
        this.braais = [];
        this.dogBowls = [];
        this.renderedAnimals = [];
        this.floatingTexts = [];
        this.activeDogBowl = null;

        // Marketplace Dynamic Listings
        this.animalMarketListings = generateAnimalListings(6);
        this.rangerListings = generateRangerListings(6);

        // Building Blueprint Placement Mode
        this.placementMode = {
            active: false,
            buildingDef: null,
            gridX: 0,
            gridY: 0,
            valid: false
        };

        this.activeFurnace = null;
        this.activeBraai = null;
        this.activeCrate = null;

        this.dayBaseline = null;

        // Tutorial state
        this.tutorialState = {
            woodCollected: false,
            workbenchPlaced: false,
            enclosureComplete: false,
            completed: false
        };

        // Asset Preloading
        this.images = {};
        this.preloadAssets();

        // Canvas Elements
        this.canvas = document.getElementById('reserveCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

        // Inputs
        this.keys = {
            w: false, a: false, s: false, d: false,
            ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
        };
        this.mouse = {
            screenX: 0,
            screenY: 0,
            worldX: 0,
            worldY: 0,
            isDown: false,
            holdGatherTimer: 0
        };

        this.lastFrameTime = performance.now();

        this.init();
    }

    preloadAssets() {
        const assetFiles = [
            'stone-axe.png', 'stone-pickaxe.png', 'stone-shovel.png',
            'elephant.png', 'impala.png', 'lion.png', 'ranger1.png',
            'ranger2.png', 'rhino.png', 'rock.png', 'reserve-hq.png',
            'waterhole.png', 'braai.png', 'furnace.png', 'dog-jock.png',
            'ranger-hut.png', 'fence-tier1.png', 'old-ranger-chest.png',
            'fence-tier1-employee-gate.png', 'tree.png', 'zebra.png'
        ];
        assetFiles.forEach(file => {
            const img = new Image();
            img.src = `./assets/${file}`;
            this.images[file] = img;
            this.images[`./assets/${file}`] = img;
            this.images[`assets/${file}`] = img;
        });
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.recordDayBaseline();
        this.setupUIControls();
        this.setupInputListeners();
        this.setupMainMenuAndPauseControls();
        this.initVisualAnimals();
        this.syncRangersWithInfrastructure();
        this.updateUI();

        this.startBackgroundLoop();
        this.startRenderLoop();
    }

    handlePlayerDeath() {
        const deathX = this.player.x;
        const deathY = this.player.y;

        // Empty player inventory array and spawn items as ground entities at death X/Y coordinates
        if (this.inventory && this.inventory.slots) {
            this.inventory.slots.forEach((slot, idx) => {
                if (slot.type && slot.count > 0) {
                    const dropX = deathX + (Math.random() - 0.5) * 40;
                    const dropY = deathY + (Math.random() - 0.5) * 40;
                    this.droppedItems.push(new DroppedItem(`drop_death_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`, slot.type, slot.count, dropX, dropY));
                    slot.type = null;
                    slot.count = 0;
                    slot.name = null;
                }
            });
        }

        // Reset player stats/states
        this.player.hunger = 100;
        this.player.thirst = 100;
        this.player.starvingTimer = 0;
        this.player.dehydratedTimer = 0;
        this.player.baseMaxHp = 100;
        this.player.maxHp = 100;
        this.player.hp = 100;
        this.player.speedPenaltyMult = 1.0;

        // Reset player movement lock and active key states
        this.player.isMovementLocked = false;
        for (const k in this.keys) {
            this.keys[k] = false;
        }

        // Teleport coordinates to spawn point (1000, 1060)
        this.player.x = 1000;
        this.player.y = 1060;

        this.showNotification("You collapsed! Items dropped on ground and respawned at spawn point.");
        this.updateUI();
    }

    findNearestUnrevealedChunk() {
        const hqChunkX = Math.floor((this.hq.x + this.hq.width / 2) / 1000);
        const hqChunkY = Math.floor((this.hq.y + this.hq.height / 2) / 1000);

        let nearest = null;
        let minDistSq = Infinity;

        // Search outward in a radius of chunks
        const maxRadius = 8;
        for (let r = 1; r <= maxRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const cx = hqChunkX + dx;
                    const cy = hqChunkY + dy;
                    const key = `${cx},${cy}`;

                    if (!this.revealedChunks.has(key)) {
                        const distSq = dx * dx + dy * dy;
                        if (distSq < minDistSq) {
                            minDistSq = distSq;
                            nearest = {
                                chunkX: cx,
                                chunkY: cy,
                                x: cx * 1000 + 500,
                                y: cy * 1000 + 500
                            };
                        }
                    }
                }
            }
            if (nearest) break;
        }

        return nearest;
    }

    recordDayBaseline() {
        this.dayBaseline = {
            wood: this.inventory.getItemCount('wood') + this.inventory.getItemCount('braai_wood'),
            stone: this.inventory.getItemCount('stone') + this.inventory.getItemCount('processedStone'),
            meat: this.inventory.getItemCount('raw_meat') + this.inventory.getItemCount('cooked_meat'),
            funds: this.state.funds,
            staffCount: this.state.hiredRangers.length,
            animalCount: this.state.ownedAnimals.length
        };
    }

    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (k in this.keys) {
                this.keys[k] = true;
            }
            if (['1', '2', '3', '4', '5'].includes(e.key)) {
                this.activeHotbarIndex = parseInt(e.key, 10) - 1;
                this.updateHotbarUI();
            }
            if (e.key === 'r' || e.key === 'R') {
                if (this.placementMode.active) {
                    this.placementMode.rotation = ((this.placementMode.rotation || 0) + 90) % 360;
                    this.updatePlacementCursor();
                }
            }
            if (e.key === 'e' || e.key === 'E') {
                this.toggleInventoryModal();
            }
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (k in this.keys) {
                this.keys[k] = false;
            }
        });

        // Global sound & audio initiation on interaction
        document.addEventListener('click', (e) => {
            if (this.audioManager) {
                this.audioManager.startAudio();
            }
            if (e.target.closest('button, .action-btn, .hotbar-slot, .inventory-slot, .close-btn, .crate-choice-card, .menu-btn')) {
                playProceduralSound('click');
            }
        });

        if (this.canvas) {
            this.canvas.addEventListener('mousemove', (e) => {
                this.mouse.screenX = e.clientX;
                this.mouse.screenY = e.clientY;

                const scale = this.camera ? this.camera.scale : 0.65;
                const camX = this.camera ? this.camera.x : 1000;
                const camY = this.camera ? this.camera.y : 1000;

                this.mouse.worldX = (e.clientX - this.canvas.width / 2) / scale + camX;
                this.mouse.worldY = (e.clientY - this.canvas.height / 2) / scale + camY;

                this.updatePlacementCursor();
                this.updateHoverTooltip(e);
            });

            this.canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    this.mouse.isDown = true;
                    this.mouse.holdGatherTimer = 0;
                    if (this.placementMode.active) {
                        this.tryPlaceBuilding();
                    } else {
                        this.handleLeftClickSelection();
                    }
                }
            });

            this.canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.handleRightClickCommand();
            });

            window.addEventListener('mouseup', (e) => {
                if (e.button === 0) {
                    this.mouse.isDown = false;
                }
            });
        }
    }

    handleEscapeKey() {
        let closedSomething = false;

        if (this.placementMode.active) {
            this.cancelPlacement();
            closedSomething = true;
        }

        const modalsToClose = [
            'furnace-modal', 'braai-modal', 'workbench-modal', 'inventory-modal',
            'container-modal', 'crate-modal', 'load-game-modal', 'save-game-modal',
            'weekly-recap-modal', 'hq-modal', 'ranger-hut-modal', 'morning-recap-modal',
            'dog-bowl-modal'
        ];

        modalsToClose.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.classList.contains('hidden')) {
                el.classList.add('hidden');
                closedSomething = true;
            }
        });

        if (closedSomething) {
            this.player.isMovementLocked = false;
        }

        if (!closedSomething) {
            const mainMenu = document.getElementById('main-menu-overlay');
            if (mainMenu && !mainMenu.classList.contains('hidden')) return;

            this.togglePauseModal();
        }
    }

    setupMainMenuAndPauseControls() {
        const startNewBtn = document.getElementById('start-new-game-btn');
        if (startNewBtn) {
            startNewBtn.addEventListener('click', () => {
                this.startNewGame();
            });
        }

        const openLoadBtn = document.getElementById('open-load-menu-btn');
        if (openLoadBtn) {
            openLoadBtn.addEventListener('click', () => {
                const loadModal = document.getElementById('load-game-modal');
                if (loadModal) {
                    loadModal.classList.remove('hidden');
                    this.renderLoadSlotsUI();
                }
            });
        }

        const closeLoadBtn = document.getElementById('close-load-menu-btn');
        if (closeLoadBtn) {
            closeLoadBtn.addEventListener('click', () => {
                const loadModal = document.getElementById('load-game-modal');
                if (loadModal) loadModal.classList.add('hidden');
            });
        }

        const resumeBtn = document.getElementById('resume-game-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                this.togglePauseModal(false);
            });
        }

        const openSaveBtn = document.getElementById('open-save-menu-btn');
        if (openSaveBtn) {
            openSaveBtn.addEventListener('click', () => {
                const saveModal = document.getElementById('save-game-modal');
                if (saveModal) {
                    saveModal.classList.remove('hidden');
                    this.renderSaveSlotsUI();
                }
            });
        }

        const closeSaveBtn = document.getElementById('close-save-menu-btn');
        if (closeSaveBtn) {
            closeSaveBtn.addEventListener('click', () => {
                const saveModal = document.getElementById('save-game-modal');
                if (saveModal) saveModal.classList.add('hidden');
            });
        }

        const returnMainBtn = document.getElementById('return-main-menu-btn');
        if (returnMainBtn) {
            returnMainBtn.addEventListener('click', () => {
                this.togglePauseModal(false);
                const mainMenu = document.getElementById('main-menu-overlay');
                if (mainMenu) mainMenu.classList.remove('hidden');
            });
        }

        const musicSlider = document.getElementById('music-volume-slider');
        const musicText = document.getElementById('music-volume-text');
        if (musicSlider) {
            musicSlider.value = this.audioManager.musicVolume;
            if (musicText) musicText.textContent = `${Math.round(this.audioManager.musicVolume * 100)}%`;
            musicSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.audioManager.setMusicVolume(val);
                if (musicText) musicText.textContent = `${Math.round(val * 100)}%`;
            });
        }

        const sfxSlider = document.getElementById('sfx-volume-slider');
        const sfxText = document.getElementById('sfx-volume-text');
        if (sfxSlider) {
            sfxSlider.value = this.audioManager.sfxVolume;
            if (sfxText) sfxText.textContent = `${Math.round(this.audioManager.sfxVolume * 100)}%`;
            sfxSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.audioManager.setSfxVolume(val);
                if (sfxText) sfxText.textContent = `${Math.round(val * 100)}%`;
            });
        }
    }

    togglePauseModal(forceState = null) {
        const modal = document.getElementById('pause-modal');
        if (!modal) return;

        if (forceState !== null) {
            this.isPaused = forceState;
        } else {
            this.isPaused = !this.isPaused;
        }

        if (this.isPaused) {
            modal.classList.remove('hidden');
            const musicSlider = document.getElementById('music-volume-slider');
            const musicText = document.getElementById('music-volume-text');
            if (musicSlider) {
                musicSlider.value = this.audioManager.musicVolume;
                if (musicText) musicText.textContent = `${Math.round(this.audioManager.musicVolume * 100)}%`;
            }

            const sfxSlider = document.getElementById('sfx-volume-slider');
            const sfxText = document.getElementById('sfx-volume-text');
            if (sfxSlider) {
                sfxSlider.value = this.audioManager.sfxVolume;
                if (sfxText) sfxText.textContent = `${Math.round(this.audioManager.sfxVolume * 100)}%`;
            }
        } else {
            modal.classList.add('hidden');
        }
    }

    renderSaveSlotsUI() {
        const container = document.getElementById('save-slots-container');
        if (!container) return;
        container.innerHTML = '';

        for (let slotId = 1; slotId <= 3; slotId++) {
            const meta = SaveManager.getSlotMetadata(slotId);
            const slotCard = document.createElement('div');
            slotCard.className = `save-slot-card ${meta.exists ? '' : 'save-slot-empty'}`;

            const dateStr = meta.exists ? new Date(meta.timestamp).toLocaleDateString() : '';

            slotCard.innerHTML = `
                <div class="save-slot-info">
                    <h4>Slot ${slotId} ${meta.exists ? '💾' : '📁 (Empty)'}</h4>
                    <p>${meta.exists ? `Day ${meta.day} (Week ${meta.week}) | Funds: $${meta.funds.toLocaleString()} | ${dateStr}` : 'Click to save game in this slot'}</p>
                </div>
                <button class="action-btn small-btn" style="width: auto; padding: 6px 14px;">Save Slot ${slotId}</button>
            `;

            slotCard.querySelector('button').addEventListener('click', () => {
                SaveManager.saveGame(this, slotId);
                this.showNotification(`Game Saved Successfully in Slot ${slotId}!`);
                const saveModal = document.getElementById('save-game-modal');
                if (saveModal) saveModal.classList.add('hidden');
                this.renderSaveSlotsUI();
            });

            container.appendChild(slotCard);
        }
    }

    renderLoadSlotsUI() {
        const container = document.getElementById('load-slots-container');
        if (!container) return;
        container.innerHTML = '';

        for (let slotId = 1; slotId <= 3; slotId++) {
            const meta = SaveManager.getSlotMetadata(slotId);
            const slotCard = document.createElement('div');
            slotCard.className = `save-slot-card ${meta.exists ? '' : 'save-slot-empty'}`;

            const dateStr = meta.exists ? new Date(meta.timestamp).toLocaleDateString() : '';

            slotCard.innerHTML = `
                <div class="save-slot-info">
                    <h4>Slot ${slotId} ${meta.exists ? '💾' : '📁 (Empty)'}</h4>
                    <p>${meta.exists ? `Day ${meta.day} (Week ${meta.week}) | Funds: $${meta.funds.toLocaleString()} | ${dateStr}` : 'No save data available'}</p>
                </div>
                <button class="action-btn small-btn" ${!meta.exists ? 'disabled' : ''} style="width: auto; padding: 6px 14px;">
                    ${meta.exists ? 'Load Slot' : 'Empty'}
                </button>
            `;

            if (meta.exists) {
                const loadBtn = slotCard.querySelector('button');
                const handleLoad = (e) => {
                    e.stopPropagation();
                    if (SaveManager.loadGame(this, slotId)) {
                        this.showNotification(`Game Loaded Successfully from Slot ${slotId}!`);
                        const loadModal = document.getElementById('load-game-modal');
                        if (loadModal) loadModal.classList.add('hidden');
                        const mainMenu = document.getElementById('main-menu-overlay');
                        if (mainMenu) mainMenu.classList.add('hidden');
                        this.isPaused = false;
                        this.player.isMovementLocked = false;
                        if (this.audioManager) this.audioManager.startAudio();
                    } else {
                        this.showNotification('Failed to load save data!');
                    }
                };
                slotCard.addEventListener('click', handleLoad);
                if (loadBtn) {
                    loadBtn.addEventListener('click', handleLoad);
                }
            }

            container.appendChild(slotCard);
        }
    }

    setupUIControls() {
        const zoomInBtn = document.getElementById('minimap-zoom-in');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimapZoom = Math.min(this.maxMinimapZoom, this.minimapZoom + 0.25);
            });
        }

        const zoomOutBtn = document.getElementById('minimap-zoom-out');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimapZoom = Math.max(this.minMinimapZoom, this.minimapZoom - 0.25);
            });
        }

        const minimapContainer = document.querySelector('.minimap-container');
        if (minimapContainer) {
            minimapContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY < 0) {
                    this.minimapZoom = Math.min(this.maxMinimapZoom, this.minimapZoom + 0.15);
                } else {
                    this.minimapZoom = Math.max(this.minMinimapZoom, this.minimapZoom - 0.15);
                }
            }, { passive: false });
        }

        const startStoryBtn = document.getElementById('start-story-btn');
        if (startStoryBtn) {
            startStoryBtn.addEventListener('click', () => {
                const storyModal = document.getElementById('intro-story-modal');
                if (storyModal) storyModal.classList.add('hidden');
                this.isPaused = false;
                this.player.isMovementLocked = false;
            });
        }

        const confirmParkBtn = document.getElementById('confirm-park-name-btn');
        if (confirmParkBtn) {
            confirmParkBtn.addEventListener('click', () => {
                const input = document.getElementById('park-name-input');
                const customName = (input && input.value.trim()) ? input.value.trim() : 'Serengeti Reserve';
                const hudName = document.getElementById('hud-park-name');
                if (hudName) {
                    hudName.textContent = `🌍 ${customName}`;
                }
                const celebModal = document.getElementById('celebration-modal');
                if (celebModal) celebModal.classList.add('hidden');
                this.isPaused = false;
                this.player.isMovementLocked = false;
                this.showNotification(`Welcome to ${customName}!`);
            });
        }

        // Management Category Sidebar Triggers
        const sidebarCategoryBtns = document.querySelectorAll('.sidebar-category-btn');
        sidebarCategoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                this.openManagementModal(category);
            });
        });

        const closeManagementBtn = document.getElementById('close-management-modal-btn');
        if (closeManagementBtn) {
            closeManagementBtn.addEventListener('click', () => this.closeManagementModal());
        }

        const closeWorkbenchBtn = document.getElementById('close-workbench-btn');
        if (closeWorkbenchBtn) {
            closeWorkbenchBtn.addEventListener('click', () => this.closeWorkbenchModal());
        }

        const closeBraaiBtn = document.getElementById('close-braai-btn');
        if (closeBraaiBtn) {
            closeBraaiBtn.addEventListener('click', () => this.closeBraaiModal());
        }

        const closeHqBtn = document.getElementById('close-hq-btn');
        if (closeHqBtn) {
            closeHqBtn.addEventListener('click', () => this.closeHqModal());
        }

        const jockScoutToggle = document.getElementById('jock-scout-toggle');
        if (jockScoutToggle) {
            jockScoutToggle.addEventListener('change', (e) => {
                if (this.dogJock) {
                    this.dogJock.scoutModeEnabled = e.target.checked;
                    this.showNotification(
                        this.dogJock.scoutModeEnabled
                            ? "Jock's Scout Mode Enabled! He will scout unrevealed chunks once per day."
                            : "Jock's Scout Mode Disabled."
                    );
                    this.updateHqModalUI();
                }
            });
        }

        const recallJockBtn = document.getElementById('recall-jock-btn');
        if (recallJockBtn) {
            recallJockBtn.addEventListener('click', () => {
                if (this.dogJock) {
                    this.dogJock.recallToHQ();
                    this.showNotification("Recall order sent! Jock is returning directly to Reserve HQ.");
                    this.updateHqModalUI();
                }
            });
        }

        const togglePlayerHqBtn = document.getElementById('toggle-player-hq-assignment-btn');
        if (togglePlayerHqBtn) {
            togglePlayerHqBtn.addEventListener('click', () => this.togglePlayerHqAssignment());
        }

        const sleepBtn = document.getElementById('sleep-till-morning-btn');
        if (sleepBtn) {
            sleepBtn.addEventListener('click', () => this.sleepTillMorning());
        }

        const startDayBtn = document.getElementById('start-day-btn');
        if (startDayBtn) {
            startDayBtn.addEventListener('click', () => this.startNewDayFromRecap());
        }

        const closeWorkerModalBtn = document.getElementById('close-worker-modal-btn');
        if (closeWorkerModalBtn) {
            closeWorkerModalBtn.addEventListener('click', () => this.closeWorkerManagementModal());
        }

        const closeRangerHutBtn = document.getElementById('close-ranger-hut-btn');
        if (closeRangerHutBtn) {
            closeRangerHutBtn.addEventListener('click', () => this.closeRangerHutModal());
        }

        const assignRangerHutBtn = document.getElementById('assign-ranger-hut-btn');
        if (assignRangerHutBtn) {
            assignRangerHutBtn.addEventListener('click', () => this.assignRangerToActiveHut());
        }

        const unassignRangerHutBtn = document.getElementById('unassign-ranger-hut-btn');
        if (unassignRangerHutBtn) {
            unassignRangerHutBtn.addEventListener('click', () => this.unassignRangerFromActiveHut());
        }

        const addBraaiFuelBtn = document.getElementById('add-braai-fuel-btn');
        if (addBraaiFuelBtn) {
            addBraaiFuelBtn.addEventListener('click', () => {
                if (this.activeBraai && this.inventory.getItemCount('braai_wood') >= 1) {
                    const added = this.activeBraai.addFuel(1);
                    this.inventory.consumeItem('braai_wood', added);
                    this.updateUI();
                    this.updateBraaiModalUI();
                } else if (this.activeBraai) {
                    this.showNotification('No Braai Wood in inventory! Convert raw Wood at a Wood Chopping Station.');
                }
            });
        }

        const addBraaiMeatBtn = document.getElementById('add-braai-meat-btn');
        if (addBraaiMeatBtn) {
            addBraaiMeatBtn.addEventListener('click', () => {
                if (this.activeBraai && this.inventory.getItemCount('raw_meat') >= 1) {
                    const added = this.activeBraai.addMeat(1);
                    this.inventory.consumeItem('raw_meat', added);
                    this.updateUI();
                    this.updateBraaiModalUI();
                } else if (this.activeBraai) {
                    this.showNotification('No Raw Meat in inventory! Loot Forgotten Ranger Chests.');
                }
            });
        }

        const collectBraaiBtn = document.getElementById('collect-braai-output-btn');
        if (collectBraaiBtn) {
            collectBraaiBtn.addEventListener('click', () => {
                if (this.activeBraai) {
                    const collected = this.activeBraai.collectOutput();
                    if (collected > 0) {
                        this.recordTutorialEvent('cookedFood');
                        if (this.inventory.canAddItem('cooked_meat', collected)) {
                            this.inventory.addItem('cooked_meat', collected);
                            this.showNotification(`Collected +${collected} Cooked Meat!`);
                        } else {
                            this.activeBraai.cookedMeat += collected;
                            this.showNotification('Backpack Full!');
                        }
                    }
                    this.updateUI();
                    this.updateBraaiModalUI();
                }
            });
        }

        const boilWaterBtn = document.getElementById('boil-water-btn');
        if (boilWaterBtn) {
            boilWaterBtn.addEventListener('click', () => {
                if (this.activeFurnace) {
                    if (this.activeFurnace.fuelWood >= 1) {
                        this.activeFurnace.fuelWood -= 1;
                        this.recordTutorialEvent('boiledWater');
                        this.showNotification('Boiled Water using Furnace fuel!');
                        this.updateUI();
                        this.updateFurnaceModalUI();
                    } else {
                        this.showNotification('Furnace needs Wood fuel to boil water!');
                    }
                }
            });
        }

        const closeFurnaceBtn = document.getElementById('close-furnace-btn');
        if (closeFurnaceBtn) {
            closeFurnaceBtn.addEventListener('click', () => this.closeFurnaceModal());
        }

        const closeDogBowlBtn = document.getElementById('close-dog-bowl-btn');
        if (closeDogBowlBtn) {
            closeDogBowlBtn.addEventListener('click', () => this.closeDogBowlModal());
        }

        const insertDogMealBtn = document.getElementById('insert-dog-meal-btn');
        if (insertDogMealBtn) {
            insertDogMealBtn.addEventListener('click', () => {
                if (this.activeDogBowl) {
                    if (this.inventory.getItemCount('dog_meal') >= 1) {
                        if (this.activeDogBowl.meals < this.activeDogBowl.maxMeals) {
                            this.inventory.consumeItem('dog_meal', 1);
                            this.activeDogBowl.addMeal(1);
                            this.updateDogBowlModalUI();
                            this.updateUI();
                            this.showNotification('Inserted 1 Dog Meal into Dog Bowl!');
                        } else {
                            this.showNotification('Dog Bowl is full!');
                        }
                    } else {
                        this.showNotification('No Dog Meal in inventory! Craft at Workbench.');
                    }
                }
            });
        }

        const closeContainerBtn = document.getElementById('close-container-btn');
        if (closeContainerBtn) {
            closeContainerBtn.addEventListener('click', () => this.closeContainerModal());
        }

        const lootAllBtn = document.getElementById('loot-all-btn');
        if (lootAllBtn) {
            lootAllBtn.addEventListener('click', () => this.lootAllContainerContents());
        }

        const closeInvBtn = document.getElementById('close-inventory-btn');
        if (closeInvBtn) {
            closeInvBtn.addEventListener('click', () => this.closeInventoryModal());
        }

        const addFuelBtn = document.getElementById('add-fuel-btn');
        if (addFuelBtn) {
            addFuelBtn.addEventListener('click', () => {
                if (this.activeFurnace && this.inventory.getItemCount('wood') >= 5) {
                    const added = this.activeFurnace.addFuel(5);
                    this.inventory.consumeItem('wood', added);
                    this.updateUI();
                    this.updateFurnaceModalUI();
                }
            });
        }

        const addMatBtn = document.getElementById('add-material-btn');
        if (addMatBtn) {
            addMatBtn.addEventListener('click', () => {
                if (this.activeFurnace && this.inventory.getItemCount('stone') >= 5) {
                    const added = this.activeFurnace.addMaterial(5);
                    this.inventory.consumeItem('stone', added);
                    this.updateUI();
                    this.updateFurnaceModalUI();
                }
            });
        }

        const collectBtn = document.getElementById('collect-output-btn');
        if (collectBtn) {
            collectBtn.addEventListener('click', () => {
                if (this.activeFurnace) {
                    const collected = this.activeFurnace.collectOutput();
                    if (collected > 0) {
                        if (this.inventory.canAddItem('processedStone', collected)) {
                            this.inventory.addItem('processedStone', collected);
                            this.showNotification(`Collected +${collected} Processed Stone!`);
                        } else {
                            this.activeFurnace.processedStone += collected; // return back
                            this.showNotification('Backpack Full! Empty space to collect.');
                        }
                    }
                    this.updateUI();
                    this.updateFurnaceModalUI();
                }
            });
        }
    }

    handleLeftClickSelection() {
        const mx = this.mouse.worldX;
        const my = this.mouse.worldY;

        // Check if clicked Reserve HQ
        if (mx >= this.hq.x && mx <= this.hq.x + this.hq.width &&
            my >= this.hq.y && my <= this.hq.y + this.hq.height) {
            this.openHqModal();
            return;
        }

        // Check if clicked Camp Chest
        if (this.campChest) {
            const distChest = Math.hypot(mx - this.campChest.x, my - this.campChest.y);
            if (distChest <= this.campChest.radius + 20) {
                this.toggleInventoryModal();
                return;
            }
        }

        // Check if clicked a Ranger
        let foundRanger = null;
        for (const r of this.rangers) {
            const dist = Math.hypot(mx - r.x, my - r.y);
            if (dist <= 25) {
                foundRanger = r;
                break;
            }
        }

        if (foundRanger) {
            this.selectedRanger = foundRanger;
            this.recordTutorialEvent('clickedWorker');
            this.openWorkerManagementModal(foundRanger);
            return;
        }

        // Check Placed Buildings / Blueprints
        for (const b of this.state.placedBuildings) {
            const halfW = b.width / 2;
            const halfH = b.height / 2;
            if (mx >= b.x - halfW && mx <= b.x + halfW &&
                my >= b.y - halfH && my <= b.y + halfH) {
                if (b.type === 'workbench') {
                    this.openWorkbenchModal();
                    return;
                }
                if (b.type === 'furnace') {
                    const furnaceObj = this.furnaces.find(f => f.id === b.id);
                    if (furnaceObj) this.openFurnaceModal(furnaceObj);
                    return;
                }
                if (b.type === 'braai') {
                    const braaiObj = this.braais.find(br => br.id === b.id);
                    if (braaiObj) this.openBraaiModal(braaiObj);
                    return;
                }
                if (b.type === 'dog_bowl') {
                    const bowlObj = this.dogBowls.find(db => db.id === b.id);
                    if (bowlObj) this.openDogBowlModal(bowlObj);
                    return;
                }
                if (b.type === 'ranger_hut') {
                    this.openRangerHutModal(b);
                    return;
                }
            }
        }

        // Deselect if clicked empty ground
        if (this.selectedRanger) {
            this.selectedRanger = null;
            this.showNotification('Deselected Ranger.');
        }
    }

    handleRightClickCommand() {
        if (!this.selectedRanger) {
            this.showNotification('No Ranger selected. Left-click a Ranger first to issue commands.');
            return;
        }

        const mx = this.mouse.worldX;
        const my = this.mouse.worldY;

        // Check if right clicked a resource node
        const allNodes = this.chunkManager.getAllResourceNodes();
        let targetNode = null;
        for (const node of allNodes) {
            const dist = Math.hypot(mx - node.x, my - node.y);
            if (dist <= node.radius + 15) {
                targetNode = node;
                break;
            }
        }

        if (targetNode) {
            this.selectedRanger.state = 'gathering';
            this.selectedRanger.targetX = targetNode.x;
            this.selectedRanger.targetY = targetNode.y;
            this.selectedRanger.targetNode = targetNode;
            this.showNotification(`${this.selectedRanger.name} commanded to harvest ${targetNode.type}.`);
            return;
        }

        // Default: Command Ranger to move to clicked coordinate
        this.selectedRanger.state = 'moving';
        this.selectedRanger.targetX = mx;
        this.selectedRanger.targetY = my;
        this.showNotification(`${this.selectedRanger.name} moving to target location.`);
    }

    showNotification(msg) {
        const banner = document.getElementById('status-banner');
        if (!banner) return;
        banner.textContent = msg;
        banner.classList.remove('hidden');
        clearTimeout(this.notifTimeout);
        this.notifTimeout = setTimeout(() => {
            banner.classList.add('hidden');
        }, 3000);
    }

    updateHoverTooltip(e) {
        const tooltip = document.getElementById('entity-hover-tooltip');
        if (!tooltip) return;

        const mx = this.mouse.worldX;
        const my = this.mouse.worldY;

        let hoveredEntity = null;
        let isJock = false;

        const formatStatus = (stateStr) => {
            const mapping = {
                wandering: 'Idle',
                grazing: 'Grazing',
                drinking: 'Drinking',
                hungry: 'Hungry',
                eating: 'Eating',
                thirsty: 'Thirsty',
                scouting: 'Scouting',
                returning_hq: 'Returning',
                patrolling: 'Patrolling',
                refilling_water: 'Refilling Water',
                maintaining_fences: 'Maintaining Fences',
                sleeping: 'Sleeping'
            };
            return mapping[stateStr] || 'Active';
        };

        // Check Jock
        if (this.dogJock) {
            const jDist = Math.hypot(mx - this.dogJock.x, my - this.dogJock.y);
            if (jDist <= 24) {
                hoveredEntity = {
                    title: 'Jock',
                    status: formatStatus(this.dogJock.state),
                    hp: this.dogJock.hp, maxHp: this.dogJock.maxHp,
                    hunger: this.dogJock.hunger, maxHunger: this.dogJock.maxHunger,
                    thirst: this.dogJock.thirst, maxThirst: this.dogJock.maxThirst
                };
                isJock = true;
            }
        }

        // Check Hired Rangers
        if (!hoveredEntity) {
            for (const r of this.rangers) {
                const rDist = Math.hypot(mx - r.x, my - r.y);
                if (rDist <= 22) {
                    hoveredEntity = {
                        title: `Ranger: ${r.name}`,
                        status: formatStatus(r.state),
                        hp: r.hp || 100, maxHp: r.maxHp || 100,
                        hunger: r.hunger || 100, maxHunger: r.maxHunger || 100,
                        thirst: r.thirst || 100, maxThirst: r.maxThirst || 100
                    };
                    break;
                }
            }
        }

        // Check Animals
        if (!hoveredEntity) {
            for (const a of this.renderedAnimals) {
                const aDist = Math.hypot(mx - a.x, my - a.y);
                if (aDist <= 24) {
                    hoveredEntity = {
                        title: a.name,
                        status: formatStatus(a.state),
                        hp: a.hp || 100, maxHp: a.maxHp || 100,
                        hunger: a.hunger || 100, maxHunger: a.maxHunger || 100,
                        thirst: a.thirst || 100, maxThirst: a.maxThirst || 100
                    };
                    break;
                }
            }
        }

        if (hoveredEntity) {
            tooltip.classList.remove('hidden');
            tooltip.style.left = `${e.clientX + 15}px`;
            tooltip.style.top = `${e.clientY + 15}px`;

            const jockHeader = document.getElementById('tooltip-jock-header');
            if (jockHeader) {
                if (isJock) jockHeader.classList.remove('hidden');
                else jockHeader.classList.add('hidden');
            }

            const titleEl = document.getElementById('tooltip-entity-title');
            if (titleEl) titleEl.textContent = hoveredEntity.title;

            const statusEl = document.getElementById('tooltip-entity-status');
            if (statusEl) statusEl.textContent = `Status: ${hoveredEntity.status}`;

            const hpFill = document.getElementById('tooltip-hp-fill');
            const hpText = document.getElementById('tooltip-hp-text');
            if (hpFill && hpText) {
                const pct = Math.max(0, Math.min(100, (hoveredEntity.hp / hoveredEntity.maxHp) * 100));
                hpFill.style.width = `${pct}%`;
                hpText.textContent = `${Math.round(hoveredEntity.hp)}/${Math.round(hoveredEntity.maxHp)}`;
            }

            const hungerFill = document.getElementById('tooltip-hunger-fill');
            const hungerText = document.getElementById('tooltip-hunger-text');
            if (hungerFill && hungerText) {
                const pct = Math.max(0, Math.min(100, (hoveredEntity.hunger / hoveredEntity.maxHunger) * 100));
                hungerFill.style.width = `${pct}%`;
                hungerText.textContent = `${Math.round(hoveredEntity.hunger)}/${Math.round(hoveredEntity.maxHunger)}`;
            }

            const thirstFill = document.getElementById('tooltip-thirst-fill');
            const thirstText = document.getElementById('tooltip-thirst-text');
            if (thirstFill && thirstText) {
                const pct = Math.max(0, Math.min(100, (hoveredEntity.thirst / hoveredEntity.maxThirst) * 100));
                thirstFill.style.width = `${pct}%`;
                thirstText.textContent = `${Math.round(hoveredEntity.thirst)}/${Math.round(hoveredEntity.maxThirst)}`;
            }
        } else {
            tooltip.classList.add('hidden');
        }
    }

    // World Clicks: Planting Saplings, Harvesting, Waterhole, Furnace, and Crates
    handleWorldClick() {
        const mx = this.mouse.worldX;
        const my = this.mouse.worldY;

        // 0. Check Cooked Meat Consumption from Hotbar
        const activeItemSlot = this.getActiveHotbarItem();
        if (activeItemSlot && activeItemSlot.type === 'cooked_meat') {
            if (this.player.hunger >= this.player.maxHunger && this.player.hp >= this.player.maxHp) {
                this.showNotification('Hunger & HP are already full!');
                return;
            }
            this.inventory.consumeItem('cooked_meat', 1);
            this.player.hunger = Math.min(this.player.maxHunger, this.player.hunger + 40);
            if (this.player.hp < this.player.maxHp) {
                this.recordTutorialEvent('healedDamage');
            }
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);

            // Drop Scraps on the ground at player position
            this.droppedItems.push(new DroppedItem(`scraps_${Date.now()}`, 'scraps', 1, this.player.x + (Math.random() - 0.5) * 20, this.player.y + (Math.random() - 0.5) * 20));

            playProceduralSound('eat');
            this.addFloatingText('🍖 Ate Cooked Meat! (+40 Hunger)', this.player.x, this.player.y - 20, '#f39c12');
            this.showNotification('Ate Cooked Meat! Dropped Scraps for Jock\'s meal.');
            this.updateUI();
            return;
        }

        // 0b. Check Sapling Planting (Ecological Cycle)
        if (activeItemSlot && activeItemSlot.type === 'sapling') {
            const isInsideReserve = (
                mx >= this.reserve.x &&
                mx <= this.reserve.x + this.reserve.width &&
                my >= this.reserve.y &&
                my <= this.reserve.y + this.reserve.height
            );

            if (isInsideReserve) {
                this.showNotification('Saplings can only be planted in the wild outside the reserve!');
                return;
            }

            const distToPlayer = Math.hypot(this.player.x - mx, this.player.y - my);
            if (distToPlayer > 150) {
                this.showNotification('Move closer to plant the sapling!');
                return;
            }

            // Consume 1 sapling and plant
            this.inventory.consumeItem('sapling', 1);
            this.plantedSaplings.push(new PlantedSapling(`sapling_${Date.now()}`, mx, my));
            this.addFloatingText('🌱 Planted Sapling!', mx, my - 15, '#2ecc71');
            this.showNotification('Planted a Sapling! It will grow into a mature tree over time.');
            this.updateUI();
            return;
        }

        // 1. Check Crate Interactivity
        const allCrates = this.chunkManager.getAllCrates();
        for (const crate of allCrates) {
            if (crate.looted) continue;
            const dist = Math.hypot(this.player.x - crate.x, this.player.y - crate.y);
            const clickDist = Math.hypot(mx - crate.x, my - crate.y);
            if (clickDist <= crate.radius + 15) {
                if (dist <= 120) {
                    this.openCrateModal(crate);
                    return;
                } else {
                    this.showNotification('Move closer to loot the Forgotten Ranger Crate!');
                    return;
                }
            }
        }

        // 2. Check Waterhole Click & Interaction (Replenish Thirst & HP)
        const distToWaterhole = Math.hypot(this.player.x - this.waterhole.x, this.player.y - this.waterhole.y);
        const clickDistToWaterhole = Math.hypot(mx - this.waterhole.x, my - this.waterhole.y);

        if (clickDistToWaterhole <= this.waterhole.radiusX + 20) {
            if (distToWaterhole <= this.waterhole.radiusX + 60) {
                if (this.player.thirst >= this.player.maxThirst && this.player.hp >= this.player.maxHp) {
                    this.showNotification('Thirst & Health are already full!');
                    return;
                }
                if (this.waterhole.waterLevel <= 0) {
                    this.showNotification('Waterhole is empty! Wait for rain or ranger refill.');
                    return;
                }

                // Transfer water to player
                const neededThirst = this.player.maxThirst - this.player.thirst;
                const drank = this.waterhole.drink(Math.min(neededThirst > 0 ? neededThirst : 20, 25));

                this.recordTutorialEvent('drankWater');
                this.player.thirst = Math.min(this.player.maxThirst, this.player.thirst + drank);
                if (this.player.hp < this.player.maxHp) {
                    this.recordTutorialEvent('healedDamage');
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + drank * 0.5);
                }

                playProceduralSound('eat');
                this.addFloatingText(`+${Math.round(drank)} Water`, this.player.x, this.player.y - 20, '#3498db');
                this.showNotification('Replenished thirst from the Reserve Waterhole!');
                return;
            } else {
                this.showNotification('Move closer to the Waterhole to drink!');
                return;
            }
        }

        // Check Reserve HQ click
        if (mx >= this.hq.x && mx <= this.hq.x + this.hq.width &&
            my >= this.hq.y && my <= this.hq.y + this.hq.height) {
            const hqCenterX = this.hq.x + this.hq.width / 2;
            const hqCenterY = this.hq.y + this.hq.height / 2;
            const dist = Math.hypot(this.player.x - hqCenterX, this.player.y - hqCenterY);
            if (dist > 180) {
                this.showNotification("Move closer to Reserve HQ!");
                return;
            }
            this.openHqModal();
            return;
        }

        // 3. Check Placed Building Clicks (Workbench, Furnace, Ranger Hut, etc.)
        for (const b of this.state.placedBuildings) {
            const halfW = b.width / 2;
            const halfH = b.height / 2;
            if (mx >= b.x - halfW && mx <= b.x + halfW &&
                my >= b.y - halfH && my <= b.y + halfH) {
                const dist = Math.hypot(this.player.x - b.x, this.player.y - b.y);
                if (dist > 150) {
                    this.showNotification(`Move closer to ${b.name}!`);
                    return;
                }
                if (b.type === 'workbench') {
                    this.openWorkbenchModal();
                    return;
                }
                if (b.type === 'furnace') {
                    const furnaceObj = this.furnaces.find(f => f.id === b.id);
                    if (furnaceObj) this.openFurnaceModal(furnaceObj);
                    return;
                }
                if (b.type === 'braai') {
                    const braaiObj = this.braais.find(br => br.id === b.id);
                    if (braaiObj) this.openBraaiModal(braaiObj);
                    return;
                }
                if (b.type === 'dog_bowl') {
                    const bowlObj = this.dogBowls.find(db => db.id === b.id);
                    if (bowlObj) this.openDogBowlModal(bowlObj);
                    return;
                }
                if (b.type === 'ranger_hut') {
                    this.openRangerHutModal(b);
                    return;
                }
                if (b.type === 'wood_chopping_station') {
                    if (this.inventory.getItemCount('wood') >= 1) {
                        if (this.inventory.canAddItem('braai_wood', 1)) {
                            this.inventory.consumeItem('wood', 1);
                            this.inventory.addItem('braai_wood', 1);
                            this.addFloatingText('🪓 Converted 1 Wood -> 1 Braai Wood!', b.x, b.y - 20, '#f1c40f');
                            this.showNotification('Converted 1 raw Wood into 1 Braai Wood!');
                            this.updateUI();
                        } else {
                            this.showNotification('Backpack Full!');
                        }
                    } else {
                        this.showNotification('Requires raw Wood to chop into Braai Wood!');
                    }
                    return;
                }
            }
        }

        // 3. Check Resource Node Harvesting (5-Hit HP System)
        const reach = 80;
        const allNodes = this.chunkManager.getAllResourceNodes();

        let targetNode = null;
        let minDist = reach;

        for (const node of allNodes) {
            const distToClick = Math.hypot(mx - node.x, my - node.y);
            const distToPlayer = Math.hypot(this.player.x - node.x, this.player.y - node.y);

            if (distToClick <= node.radius + 15 && distToPlayer <= reach) {
                if (distToClick < minDist) {
                    minDist = distToClick;
                    targetNode = node;
                }
            }
        }

        if (targetNode) {
            this.hitResourceNode(targetNode);
        }
    }

    hitResourceNode(node) {
        const activeTool = this.getActiveHotbarItem();
        let dmg = 1;
        if (activeTool) {
            if (activeTool.type === 'stone-axe' && node.type === 'wood') dmg = 3;
            else if (activeTool.type === 'stone-pickaxe' && node.type === 'stone') dmg = 3;
            else if (['stone-axe', 'stone-pickaxe', 'stone-shovel'].includes(activeTool.type)) dmg = 2;
        }

        playProceduralSound('hit');
        const result = node.hit(dmg, this.buffs.harvestYieldBonus);
        this.player.triggerScreenShake(5, 0.12);

        if (result.destroyed) {
            this.chunkManager.removeResourceNode(node.id);

            // Spawn physical entity drops on ground instead of directly giving items
            if (result.type === 'wood') {
                this.droppedItems.push(new DroppedItem(`drop_${Date.now()}_w`, 'wood', result.yieldAmount, node.x, node.y));
                if (Math.random() < 0.7) {
                    this.droppedItems.push(new DroppedItem(`drop_${Date.now()}_s`, 'sapling', 1, node.x + (Math.random() - 0.5) * 20, node.y + (Math.random() - 0.5) * 20));
                }
            } else {
                this.droppedItems.push(new DroppedItem(`drop_${Date.now()}_st`, 'stone', result.yieldAmount, node.x, node.y));
            }

            this.addFloatingText(`Destroyed!`, node.x, node.y - 10, '#f1c40f');
        } else {
            this.addFloatingText(`Hit! (${result.hp}/${node.maxHp})`, node.x, node.y - 10, '#e74c3c');
        }
    }

    // Inventory Modal Toggle ('E' Key)
    toggleInventoryModal() {
        const modal = document.getElementById('inventory-modal');
        if (!modal) return;
        if (modal.classList.contains('hidden')) {
            this.player.isMovementLocked = true;
            modal.classList.remove('hidden');
            this.renderInventoryGrid();
        } else {
            this.player.isMovementLocked = false;
            modal.classList.add('hidden');
        }
    }

    closeInventoryModal() {
        this.player.isMovementLocked = false;
        const modal = document.getElementById('inventory-modal');
        if (modal) modal.classList.add('hidden');
    }

    updateHotbarUI() {
        const iconMap = {
            wood: '🪵',
            stone: '🪨',
            processedStone: '🧱',
            sapling: '🌱',
            'stone-axe': '🪓',
            'stone-pickaxe': '⛏️',
            'stone-shovel': '🪵',
            raw_meat: '🥩',
            cooked_meat: '🍖',
            scraps: '🍖',
            dog_meal: '🍖',
            dog_bowl: '🥣'
        };

        const imageMap = {
            'stone-axe': 'assets/stone-axe.png',
            'stone-pickaxe': 'assets/stone-pickaxe.png',
            'stone-shovel': 'assets/stone-shovel.png'
        };

        const container = document.getElementById('hotbar-container');
        if (!container) return;

        const slotEls = container.querySelectorAll('.hotbar-slot');
        slotEls.forEach((slotEl, i) => {
            const isSelected = (i === this.activeHotbarIndex);
            slotEl.className = `hotbar-slot ${isSelected ? 'active' : ''}`;
            const globalSlotIdx = 20 + i;
            slotEl.setAttribute('draggable', 'true');
            slotEl.dataset.slotIndex = globalSlotIdx;

            const itemSlot = this.inventory.slots[globalSlotIdx]; // Slots 20..24 are hotbar
            const iconDiv = slotEl.querySelector('.hotbar-icon');
            const countSpan = slotEl.querySelector('.hotbar-count');

            if (itemSlot && itemSlot.count > 0 && itemSlot.type) {
                const imgPath = imageMap[itemSlot.type];
                if (imgPath && iconDiv) {
                    iconDiv.innerHTML = `<img src="${imgPath}" style="width:24px;height:24px;object-fit:contain;">`;
                } else if (iconDiv) {
                    iconDiv.textContent = iconMap[itemSlot.type] || '📦';
                }
                if (countSpan) countSpan.textContent = itemSlot.count;
            } else {
                if (iconDiv) iconDiv.textContent = '';
                if (countSpan) countSpan.textContent = '';
            }

            slotEl.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', globalSlotIdx.toString());
            };
            slotEl.ondragover = (e) => e.preventDefault();
            slotEl.ondrop = (e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (!isNaN(fromIdx)) {
                    this.inventory.swapOrStackSlots(fromIdx, globalSlotIdx);
                    this.updateUI();
                    this.renderInventoryGrid();
                }
            };
        });
    }

    getActiveHotbarItem() {
        const slot = this.inventory.slots[20 + this.activeHotbarIndex];
        if (slot && slot.count > 0) {
            return slot;
        }
        return null;
    }

    renderInventoryGrid() {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const iconMap = {
            wood: '🪵',
            stone: '🪨',
            processedStone: '🧱',
            sapling: '🌱',
            'stone-axe': '🪓',
            'stone-pickaxe': '⛏️',
            'stone-shovel': '🪵',
            braai_wood: '🪵',
            raw_meat: '🥩',
            cooked_meat: '🍖',
            scraps: '🍖',
            dog_meal: '🍖',
            dog_bowl: '🥣'
        };

        const nameMap = {
            wood: 'Wood',
            stone: 'Stone',
            processedStone: 'P-Stone',
            sapling: 'Sapling',
            'stone-axe': 'Stone Axe',
            'stone-pickaxe': 'Pickaxe',
            'stone-shovel': 'Shovel',
            braai_wood: 'Braai Wood',
            raw_meat: 'Raw Meat',
            cooked_meat: 'Cooked Meat',
            scraps: 'Scraps',
            dog_meal: 'Dog Meal',
            dog_bowl: 'Dog Bowl'
        };

        const imageMap = {
            'stone-axe': 'assets/stone-axe.png',
            'stone-pickaxe': 'assets/stone-pickaxe.png',
            'stone-shovel': 'assets/stone-shovel.png'
        };

        this.inventory.slots.forEach((slot, index) => {
            const isHotbarSlot = index >= 20;
            const slotEl = document.createElement('div');
            slotEl.className = `inventory-slot ${slot.count === 0 ? 'empty' : ''} ${isHotbarSlot ? 'hotbar-slot-marker' : ''}`;
            slotEl.setAttribute('draggable', 'true');
            slotEl.dataset.slotIndex = index;

            const labelText = isHotbarSlot ? `H${index - 19}` : `${index + 1}`;

            if (slot.count > 0 && slot.type) {
                const imgPath = imageMap[slot.type];
                const displayName = slot.name || nameMap[slot.type] || slot.type;
                const iconHTML = imgPath
                    ? `<img src="${imgPath}" style="width:32px;height:32px;object-fit:contain;">`
                    : (iconMap[slot.type] || '📦');

                slotEl.innerHTML = `
                    <div class="slot-icon">${iconHTML}</div>
                    <div class="slot-item-name" style="font-size:0.6rem; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%;">${displayName}</div>
                    <div class="slot-count-badge">${slot.count}</div>
                `;
            } else {
                slotEl.innerHTML = `<span style="font-size:0.7rem; color:var(--text-muted);">${labelText}</span>`;
            }

            slotEl.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', index.toString());
            };
            slotEl.ondragover = (e) => e.preventDefault();
            slotEl.ondrop = (e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (!isNaN(fromIdx)) {
                    this.inventory.swapOrStackSlots(fromIdx, index);
                    this.updateUI();
                    this.renderInventoryGrid();
                }
            };

            grid.appendChild(slotEl);
        });
    }

    // Forgotten Ranger Crate Interactivity (2-Step Event)
    openCrateModal(crate) {
        this.player.isMovementLocked = true;
        this.activeCrate = crate;

        // Initialize crate raw meat loot if not done yet
        if (!crate.contents || crate.contents.length === 0) {
            const meatNames = ['Raw Kudu Meat', 'Raw Warthog Meat', 'Raw Impala Meat', 'Raw Zebra Meat', 'Raw Springbok Meat'];
            const count = Math.floor(2 + Math.random() * 4); // 2 to 5
            crate.contents = [];
            for (let i = 0; i < count; i++) {
                const randomName = meatNames[Math.floor(Math.random() * meatNames.length)];
                crate.contents.push({
                    type: 'raw_meat',
                    name: randomName,
                    count: 1
                });
            }
        }

        // Step 1: Offer RPG buff modal if buff not chosen for this crate yet
        if (!crate.buffChosen) {
            const modal = document.getElementById('crate-modal');
            const container = document.getElementById('crate-buff-choices');
            if (!modal || !container) return;

            const shuffled = [...BUFF_OPTIONS].sort(() => 0.5 - Math.random());
            const choices = shuffled.slice(0, 3);

            container.innerHTML = '';
            choices.forEach(buff => {
                const card = document.createElement('div');
                card.className = 'crate-choice-card';
                card.innerHTML = `
                    <div class="crate-choice-title">${buff.title}</div>
                    <div class="crate-choice-desc">${buff.description}</div>
                `;
                card.addEventListener('click', () => this.applyCrateBuff(buff));
                container.appendChild(card);
            });

            modal.classList.remove('hidden');
        } else {
            // Step 2: Directly open container UI
            this.openContainerModal();
        }
    }

    applyCrateBuff(buff) {
        if (buff.effect.moveSpeedMult) {
            this.player.speedMult += buff.effect.moveSpeedMult;
        }
        if (buff.effect.harvestYieldBonus) {
            this.buffs.harvestYieldBonus += buff.effect.harvestYieldBonus;
        }
        if (buff.effect.workSpeedMult) {
            this.buffs.workSpeedMult += buff.effect.workSpeedMult;
        }
        if (buff.effect.incomeMult) {
            this.buffs.incomeMult += buff.effect.incomeMult;
        }
        if (buff.effect.capacityBonus) {
            this.buffs.capacityBonus += buff.effect.capacityBonus;
        }

        if (this.activeCrate) {
            this.activeCrate.buffChosen = true;
        }

        this.showNotification(`Acquired Buff: ${buff.title}!`);
        const modal = document.getElementById('crate-modal');
        if (modal) modal.classList.add('hidden');

        // Transition to Step 2: Open Container UI
        this.openContainerModal();
        this.updateUI();
    }

    // Container UI Modal
    openContainerModal() {
        this.player.isMovementLocked = true;
        const modal = document.getElementById('container-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.renderContainerUI();
        }
    }

    closeContainerModal() {
        this.player.isMovementLocked = false;
        const modal = document.getElementById('container-modal');
        if (modal) modal.classList.add('hidden');
    }

    renderContainerUI() {
        const chestGrid = document.getElementById('chest-contents-grid');
        const playerGrid = document.getElementById('container-player-grid');
        if (!chestGrid || !playerGrid || !this.activeCrate) return;

        chestGrid.innerHTML = '';
        playerGrid.innerHTML = '';

        const iconMap = {
            raw_meat: '🥩',
            cooked_meat: '🍖',
            wood: '🪵',
            stone: '🪨',
            processedStone: '🧱',
            sapling: '🌱'
        };

        // Render Chest Contents
        this.activeCrate.contents.forEach((item, index) => {
            const slotEl = document.createElement('div');
            slotEl.className = 'inventory-slot';
            slotEl.setAttribute('draggable', 'true');
            slotEl.dataset.chestIndex = index;

            slotEl.innerHTML = `
                <div class="slot-icon">${iconMap[item.type] || '📦'}</div>
                <div class="slot-item-name" style="font-size:0.55rem; text-align:center;">${item.name}</div>
                <div class="slot-count-badge">${item.count}</div>
            `;

            slotEl.addEventListener('click', () => {
                if (this.inventory.canAddItem(item.type, item.count)) {
                    this.inventory.addItem(item.type, item.count, item.name);
                    this.activeCrate.contents.splice(index, 1);
                    if (this.activeCrate.contents.length === 0) {
                        this.activeCrate.looted = true;
                    }
                    this.updateUI();
                    this.renderContainerUI();
                } else {
                    this.showNotification('Backpack Full!');
                }
            });

            chestGrid.appendChild(slotEl);
        });

        // Render Player Inventory in Container UI
        this.inventory.slots.forEach((slot, index) => {
            const isHotbarSlot = index >= 20;
            const slotEl = document.createElement('div');
            slotEl.className = `inventory-slot ${slot.count === 0 ? 'empty' : ''} ${isHotbarSlot ? 'hotbar-slot-marker' : ''}`;
            slotEl.setAttribute('draggable', 'true');
            slotEl.dataset.slotIndex = index;

            if (slot.count > 0 && slot.type) {
                slotEl.innerHTML = `
                    <div class="slot-icon">${iconMap[slot.type] || '📦'}</div>
                    <div class="slot-item-name" style="font-size:0.55rem; text-align:center;">${slot.name || slot.type}</div>
                    <div class="slot-count-badge">${slot.count}</div>
                `;
            } else {
                slotEl.innerHTML = `<span style="font-size:0.65rem; color:var(--text-muted);">${isHotbarSlot ? 'H' + (index - 19) : index + 1}</span>`;
            }

            playerGrid.appendChild(slotEl);
        });
    }

    lootAllContainerContents() {
        if (!this.activeCrate) return;

        let lootedAny = false;
        for (let i = this.activeCrate.contents.length - 1; i >= 0; i--) {
            const item = this.activeCrate.contents[i];
            if (this.inventory.canAddItem(item.type, item.count)) {
                this.inventory.addItem(item.type, item.count, item.name);
                this.activeCrate.contents.splice(i, 1);
                lootedAny = true;
            } else {
                this.showNotification('Backpack Full!');
                break;
            }
        }

        if (this.activeCrate.contents.length === 0) {
            this.activeCrate.looted = true;
            this.closeContainerModal();
        }

        this.updateUI();
        this.renderContainerUI();
    }

    isNight() {
        const totalHours = ((this.timeElapsedInDay / this.dayDuration) * 24 + 6) % 24;
        return totalHours < 6 || totalHours >= 18;
    }

    openHqModal() {
        this.player.isMovementLocked = true;
        const modal = document.getElementById('hq-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateHqModalUI();
        }
    }

    closeHqModal() {
        this.player.isMovementLocked = false;
        const modal = document.getElementById('hq-modal');
        if (modal) modal.classList.add('hidden');
    }

    updateHqModalUI() {
        const humanContainer = document.getElementById('hq-human-slots');
        const petContainer = document.getElementById('hq-pet-slots');
        const sleepBox = document.getElementById('hq-sleep-container');

        // Human Resident Slot (1 Max - Player)
        if (humanContainer) {
            humanContainer.innerHTML = '';
            const slotCard = document.createElement('div');
            slotCard.className = `slot-card ${this.isPlayerAssignedToHQ ? 'filled' : 'empty'}`;

            if (this.isPlayerAssignedToHQ) {
                slotCard.innerHTML = `
                    <div class="slot-icon">🤠</div>
                    <div class="slot-title">Player (Assigned)</div>
                    <div class="slot-sub">Reserve Commander</div>
                    <button class="action-btn small-btn" style="background: var(--accent-red); color: white; margin-top: 6px;">Unassign</button>
                `;
                slotCard.querySelector('button').addEventListener('click', () => {
                    this.isPlayerAssignedToHQ = false;
                    this.showNotification('Unassigned Player from Reserve HQ.');
                    this.updateHqModalUI();
                });
            } else {
                slotCard.innerHTML = `
                    <div class="slot-icon" style="opacity: 0.4;">👤</div>
                    <div class="slot-title" style="color: var(--text-muted);">Empty Human Slot</div>
                    <div class="slot-sub">Reserve Commander</div>
                    <button class="action-btn small-btn positive-btn" style="margin-top: 6px;">Assign Player</button>
                `;
                slotCard.querySelector('button').addEventListener('click', () => {
                    this.isPlayerAssignedToHQ = true;
                    this.recordTutorialEvent('assignedCabin');
                    this.showNotification('Assigned Player to Reserve HQ!');
                    this.updateHqModalUI();
                });
            }
            humanContainer.appendChild(slotCard);
        }

        // Pet Companion Slot (1 Max - Dog Jock)
        if (petContainer) {
            petContainer.innerHTML = '';
            const isJockHere = (this.jockAssignedBuilding === 'hq');
            const petCard = document.createElement('div');
            petCard.className = `slot-card ${isJockHere ? 'filled' : 'empty'}`;

            if (isJockHere) {
                petCard.innerHTML = `
                    <div class="slot-icon">🐕</div>
                    <div class="slot-title">Jock (Assigned)</div>
                    <div class="slot-sub">Companion Dog</div>
                    <button class="action-btn small-btn" style="background: var(--accent-red); color: white; margin-top: 6px;">Unassign</button>
                `;
                petCard.querySelector('button').addEventListener('click', () => {
                    this.jockAssignedBuilding = null;
                    this.showNotification('Unassigned Jock from Reserve HQ.');
                    this.updateHqModalUI();
                });
            } else {
                petCard.innerHTML = `
                    <div class="slot-icon" style="opacity: 0.4;">🐾</div>
                    <div class="slot-title" style="color: var(--text-muted);">Empty Pet Slot</div>
                    <div class="slot-sub">Companion Dog</div>
                    <button class="action-btn small-btn positive-btn" style="margin-top: 6px;">Assign Jock</button>
                `;
                petCard.querySelector('button').addEventListener('click', () => {
                    this.jockAssignedBuilding = 'hq';
                    this.recordTutorialEvent('assignedJobOrPet');
                    this.showNotification('Assigned Jock to Reserve HQ!');
                    this.updateHqModalUI();
                });
            }
            petContainer.appendChild(petCard);
        }

        if (sleepBox) {
            const hqCenterX = this.hq.x + this.hq.width / 2;
            const hqCenterY = this.hq.y + this.hq.height / 2;
            const dist = Math.hypot(this.player.x - hqCenterX, this.player.y - hqCenterY);
            const isNearHq = dist <= 200;

            if (this.isPlayerAssignedToHQ && this.isNight() && isNearHq) {
                sleepBox.classList.remove('hidden');
            } else {
                sleepBox.classList.add('hidden');
            }
        }

        // Update Jock Scout Toggle & Status Badge
        const scoutToggle = document.getElementById('jock-scout-toggle');
        const statusBadge = document.getElementById('jock-status-badge');
        if (scoutToggle && this.dogJock) {
            scoutToggle.checked = this.dogJock.scoutModeEnabled;
        }
        if (statusBadge && this.dogJock) {
            const stateLabels = {
                wandering: 'Idle',
                thirsty: 'Thirsty',
                drinking: 'Drinking',
                hungry: 'Hungry',
                eating: 'Eating',
                scouting: 'Scouting',
                returning_hq: 'Returning'
            };
            statusBadge.textContent = stateLabels[this.dogJock.state] || 'Idle';
        }
    }

    togglePlayerHqAssignment() {
        this.isPlayerAssignedToHQ = !this.isPlayerAssignedToHQ;
        if (this.isPlayerAssignedToHQ) {
            this.recordTutorialEvent('assignedCabin');
        }
        this.showNotification(
            this.isPlayerAssignedToHQ
                ? "Assigned to Reserve HQ!"
                : "Unassigned from Reserve HQ."
        );
        this.updateHqModalUI();
    }

    sleepTillMorning() {
        if (!this.isNight() || !this.isPlayerAssignedToHQ) return;

        this.closeHqModal();
        this.timeElapsedInDay = 0;
        this.processNewDay(true);
    }

    showMorningRecapModal() {
        this.isPaused = true;
        this.player.isMovementLocked = true;

        const modal = document.getElementById('morning-recap-modal');
        if (!modal) return;

        const dayNumEl = document.getElementById('morning-day-num');
        const woodChangeEl = document.getElementById('morning-wood-change');
        const stoneChangeEl = document.getElementById('morning-stone-change');
        const meatChangeEl = document.getElementById('morning-meat-change');
        const fundsChangeEl = document.getElementById('morning-funds-change');
        const staffAcquiredEl = document.getElementById('morning-staff-acquired');
        const animalsAcquiredEl = document.getElementById('morning-animals-acquired');

        if (dayNumEl) dayNumEl.textContent = this.state.day;

        if (this.dayBaseline) {
            const currentWood = this.inventory.getItemCount('wood') + this.inventory.getItemCount('braai_wood');
            const currentStone = this.inventory.getItemCount('stone') + this.inventory.getItemCount('processedStone');
            const currentMeat = this.inventory.getItemCount('raw_meat') + this.inventory.getItemCount('cooked_meat');
            const currentFunds = this.state.funds;
            const currentStaff = this.state.hiredRangers.length;
            const currentAnimals = this.state.ownedAnimals.length;

            const dWood = currentWood - this.dayBaseline.wood;
            const dStone = currentStone - this.dayBaseline.stone;
            const dMeat = currentMeat - this.dayBaseline.meat;
            const dFunds = currentFunds - this.dayBaseline.funds;
            const dStaff = Math.max(0, currentStaff - this.dayBaseline.staffCount);
            const dAnimals = Math.max(0, currentAnimals - this.dayBaseline.animalCount);

            if (woodChangeEl) woodChangeEl.textContent = `${dWood >= 0 ? '+' : ''}${dWood}`;
            if (stoneChangeEl) stoneChangeEl.textContent = `${dStone >= 0 ? '+' : ''}${dStone}`;
            if (meatChangeEl) meatChangeEl.textContent = `${dMeat >= 0 ? '+' : ''}${dMeat}`;
            if (fundsChangeEl) fundsChangeEl.textContent = `${dFunds >= 0 ? '+' : ''}$${dFunds.toLocaleString()}`;
            if (staffAcquiredEl) staffAcquiredEl.textContent = `+${dStaff}`;
            if (animalsAcquiredEl) animalsAcquiredEl.textContent = `+${dAnimals}`;
        }

        modal.classList.remove('hidden');
    }

    startNewDayFromRecap() {
        const modal = document.getElementById('morning-recap-modal');
        if (modal) modal.classList.add('hidden');

        this.recordDayBaseline();
        this.isPaused = false;
        this.player.isMovementLocked = false;
        this.showNotification(`Day ${this.state.day} started!`);
    }

    openWorkerManagementModal(rangerEntity) {
        this.player.isMovementLocked = true;
        const modal = document.getElementById('worker-management-modal');
        if (!modal) return;

        const hiredData = this.state.hiredRangers.find(r => r.id === rangerEntity.id);
        if (!hiredData) return;

        const nameEl = document.getElementById('worker-modal-name');
        const statusEl = document.getElementById('worker-modal-status');
        const housingSelect = document.getElementById('worker-housing-select');
        const jobSelect = document.getElementById('worker-job-select');
        const buffSelect = document.getElementById('worker-buff-select');

        if (nameEl) nameEl.textContent = hiredData.name;
        if (statusEl) statusEl.textContent = `Status: ${rangerEntity.state} | Job: ${hiredData.job || 'None'}`;

        // Populate Housing Options
        if (housingSelect) {
            housingSelect.innerHTML = '';
            // HQ Option
            const hqCount = this.state.hiredRangers.filter(r => r.assignedBuilding === 'reserve_hq').length;
            const hqAvailable = hqCount < 2 || hiredData.assignedBuilding === 'reserve_hq';
            const hqOpt = document.createElement('option');
            hqOpt.value = 'reserve_hq';
            hqOpt.textContent = `Reserve HQ (${hqCount}/2 capacity)`;
            if (!hqAvailable) hqOpt.disabled = true;
            housingSelect.appendChild(hqOpt);

            // Ranger Huts Options
            const huts = this.state.placedBuildings.filter(b => b.type === 'ranger_hut');
            huts.forEach((hut, idx) => {
                const hutCount = this.state.hiredRangers.filter(r => r.assignedBuilding === hut.id).length;
                const hutAvailable = hutCount < 2 || hiredData.assignedBuilding === hut.id;
                const opt = document.createElement('option');
                opt.value = hut.id;
                opt.textContent = `Ranger Hut #${idx + 1} (${hutCount}/2 capacity)`;
                if (!hutAvailable) opt.disabled = true;
                housingSelect.appendChild(opt);
            });

            housingSelect.value = hiredData.assignedBuilding || 'reserve_hq';
        }

        // Job Option
        if (jobSelect) {
            jobSelect.value = hiredData.job || '';
        }

        // Buff Options
        if (buffSelect) {
            buffSelect.innerHTML = '';
            const noBuffOpt = document.createElement('option');
            noBuffOpt.value = '';
            noBuffOpt.textContent = '-- Select Permanent Buff --';
            buffSelect.appendChild(noBuffOpt);

            if (typeof WORKER_BUFF_OPTIONS !== 'undefined') {
                WORKER_BUFF_OPTIONS.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.textContent = `${b.title} (${b.description})`;
                    buffSelect.appendChild(opt);
                });
            }

            buffSelect.value = hiredData.buff ? hiredData.buff.id : '';
            if (hiredData.buff) {
                buffSelect.disabled = true; // Permanent once selected
            } else {
                buffSelect.disabled = false;
            }
        }

        modal.classList.remove('hidden');

        // Save Button Handler
        const saveBtn = document.getElementById('save-worker-assignment-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const chosenHousing = housingSelect ? housingSelect.value : null;
                const chosenJob = jobSelect ? jobSelect.value : null;
                const chosenBuffId = buffSelect ? buffSelect.value : null;

                hiredData.assignedBuilding = chosenHousing;
                hiredData.job = chosenJob;

                if (chosenHousing === 'reserve_hq') {
                    this.recordTutorialEvent('assignedWorkerHQ');
                }
                if (chosenJob) {
                    this.recordTutorialEvent('assignedJobOrPet');
                }

                if (chosenBuffId && !hiredData.buff) {
                    const buffDef = WORKER_BUFF_OPTIONS.find(b => b.id === chosenBuffId);
                    if (buffDef) {
                        hiredData.buff = buffDef;
                    }
                }

                this.syncRangersWithInfrastructure();
                this.showNotification(`Updated assignment for ${hiredData.name}!`);
                this.closeWorkerManagementModal();
                this.updateUI();
            };
        }
    }

    closeWorkerManagementModal() {
        const modal = document.getElementById('worker-management-modal');
        if (modal) modal.classList.add('hidden');
        this.player.isMovementLocked = false;
    }

    openRangerHutModal(hutBuilding) {
        this.player.isMovementLocked = true;
        this.activeRangerHut = hutBuilding;
        const modal = document.getElementById('ranger-hut-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateRangerHutModalUI();
        }
    }

    closeRangerHutModal() {
        this.player.isMovementLocked = false;
        this.activeRangerHut = null;
        const modal = document.getElementById('ranger-hut-modal');
        if (modal) modal.classList.add('hidden');
    }

    updateRangerHutModalUI() {
        if (!this.activeRangerHut) return;

        const humanContainer = document.getElementById('ranger-hut-human-slots');
        const petContainer = document.getElementById('ranger-hut-pet-slots');

        if (!this.activeRangerHut.assignedRangerIds) {
            this.activeRangerHut.assignedRangerIds = [];
            // Migrate legacy single assignedRangerId if exists
            if (this.activeRangerHut.assignedRangerId) {
                this.activeRangerHut.assignedRangerIds.push(this.activeRangerHut.assignedRangerId);
            }
        }

        const currentAssignedIds = this.activeRangerHut.assignedRangerIds;

        // Render 2 Ranger Slots
        if (humanContainer) {
            humanContainer.innerHTML = '';
            for (let i = 0; i < 2; i++) {
                const assignedRangerId = currentAssignedIds[i];
                const assignedRanger = this.state.hiredRangers.find(r => r.id === assignedRangerId);

                const slotCard = document.createElement('div');
                slotCard.className = `slot-card ${assignedRanger ? 'filled' : 'empty'}`;

                if (assignedRanger) {
                    slotCard.innerHTML = `
                        <div class="slot-icon">🤠</div>
                        <div class="slot-title">${assignedRanger.name}</div>
                        <div class="slot-sub">Ranger Slot ${i + 1}</div>
                        <button class="action-btn small-btn" style="background: var(--accent-red); color: white; margin-top: 6px;">Unassign</button>
                    `;
                    slotCard.querySelector('button').addEventListener('click', () => {
                        this.activeRangerHut.assignedRangerIds.splice(i, 1);
                        this.syncRangersWithInfrastructure();
                        this.updateRangerHutModalUI();
                        this.showNotification(`Unassigned ${assignedRanger.name} from Ranger Hut.`);
                    });
                } else {
                    const availableRangers = this.state.hiredRangers.filter(r => {
                        const isAssignedToThisHut = currentAssignedIds.includes(r.id);
                        const isAssignedElsewhere = this.state.placedBuildings.some(
                            b => b.type === 'ranger_hut' && b.id !== this.activeRangerHut.id && b.assignedRangerIds?.includes(r.id)
                        );
                        return !isAssignedToThisHut && !isAssignedElsewhere;
                    });

                    if (availableRangers.length > 0) {
                        const selectOptions = availableRangers.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
                        slotCard.innerHTML = `
                            <div class="slot-icon" style="opacity: 0.4;">🤠</div>
                            <div class="slot-title" style="color: var(--text-muted);">Empty Ranger Slot</div>
                            <select class="ranger-slot-select" style="padding: 4px; border-radius: 4px; background: #1a252c; color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.75rem; width: 100%; margin-top: 4px;">
                                ${selectOptions}
                            </select>
                            <button class="action-btn small-btn positive-btn" style="margin-top: 6px;">Assign Ranger</button>
                        `;
                        slotCard.querySelector('button').addEventListener('click', () => {
                            const selectEl = slotCard.querySelector('.ranger-slot-select');
                            if (selectEl && selectEl.value) {
                                this.activeRangerHut.assignedRangerIds.push(selectEl.value);
                                this.syncRangersWithInfrastructure();
                                this.updateRangerHutModalUI();
                                const hired = this.state.hiredRangers.find(r => r.id === selectEl.value);
                                this.showNotification(`Assigned ${hired ? hired.name : 'Ranger'} to Ranger Hut!`);
                            }
                        });
                    } else {
                        slotCard.innerHTML = `
                            <div class="slot-icon" style="opacity: 0.4;">🤠</div>
                            <div class="slot-title" style="color: var(--text-muted);">Empty Ranger Slot</div>
                            <div class="slot-sub">No Hired Staff Available</div>
                        `;
                    }
                }

                humanContainer.appendChild(slotCard);
            }
        }

        // Render 1 Pet Slot (Dog Jock)
        if (petContainer) {
            petContainer.innerHTML = '';
            const isJockHere = (this.jockAssignedBuilding === this.activeRangerHut.id);

            const petCard = document.createElement('div');
            petCard.className = `slot-card ${isJockHere ? 'filled' : 'empty'}`;

            if (isJockHere) {
                petCard.innerHTML = `
                    <div class="slot-icon">🐕</div>
                    <div class="slot-title">Jock (Assigned)</div>
                    <div class="slot-sub">Companion Dog</div>
                    <button class="action-btn small-btn" style="background: var(--accent-red); color: white; margin-top: 6px;">Unassign</button>
                `;
                petCard.querySelector('button').addEventListener('click', () => {
                    this.jockAssignedBuilding = null;
                    this.showNotification('Unassigned Jock from Ranger Hut.');
                    this.updateRangerHutModalUI();
                });
            } else {
                petCard.innerHTML = `
                    <div class="slot-icon" style="opacity: 0.4;">🐾</div>
                    <div class="slot-title" style="color: var(--text-muted);">Empty Pet Slot</div>
                    <div class="slot-sub">Companion Dog</div>
                    <button class="action-btn small-btn positive-btn" style="margin-top: 6px;">Assign Jock</button>
                `;
                petCard.querySelector('button').addEventListener('click', () => {
                    this.jockAssignedBuilding = this.activeRangerHut.id;
                    this.showNotification('Assigned Jock to Ranger Hut!');
                    this.updateRangerHutModalUI();
                });
            }

            petContainer.appendChild(petCard);
        }
    }

    assignRangerToActiveHut() {
        if (!this.activeRangerHut) return;
        const selectEl = document.getElementById('ranger-hut-select');
        if (!selectEl || !selectEl.value) return;

        const rangerId = selectEl.value;
        const ranger = this.state.hiredRangers.find(r => r.id === rangerId);
        if (ranger) {
            this.activeRangerHut.assignedRangerId = rangerId;
            this.syncRangersWithInfrastructure();
            this.showNotification(`Assigned ${ranger.name} to Ranger Hut!`);
            this.updateRangerHutModalUI();
        }
    }

    unassignRangerFromActiveHut() {
        if (!this.activeRangerHut) return;
        this.activeRangerHut.assignedRangerId = null;
        this.syncRangersWithInfrastructure();
        this.showNotification("Unassigned Ranger from Hut.");
        this.updateRangerHutModalUI();
    }

    // Braai Modal
    openBraaiModal(braai) {
        this.player.isMovementLocked = true;
        this.activeBraai = braai;
        const modal = document.getElementById('braai-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateBraaiModalUI();
        }
    }

    closeBraaiModal() {
        this.player.isMovementLocked = false;
        this.activeBraai = null;
        const modal = document.getElementById('braai-modal');
        if (modal) modal.classList.add('hidden');
    }

    updateBraaiModalUI() {
        if (!this.activeBraai) return;

        const statusText = document.getElementById('braai-status-text');
        const fillBar = document.getElementById('braai-progress-fill');
        const fuelCount = document.getElementById('braai-fuel-count');
        const meatCount = document.getElementById('braai-meat-count');
        const outputCount = document.getElementById('braai-output-count');

        if (statusText) statusText.textContent = this.activeBraai.isCooking ? '🔥 Sizzling...' : 'Idle';
        if (fillBar) {
            const pct = (this.activeBraai.cookTimer / this.activeBraai.cookDuration) * 100;
            fillBar.style.width = `${pct}%`;
        }
        if (fuelCount) fuelCount.textContent = `${this.activeBraai.braaiWood} / ${this.activeBraai.maxFuel}`;
        if (meatCount) meatCount.textContent = `${this.activeBraai.rawMeat} / ${this.activeBraai.maxMeat}`;
        if (outputCount) outputCount.textContent = `${this.activeBraai.cookedMeat} Cooked Meat`;
    }

    // Dog Bowl Modal
    openDogBowlModal(dogBowl) {
        this.player.isMovementLocked = true;
        this.activeDogBowl = dogBowl;
        const modal = document.getElementById('dog-bowl-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateDogBowlModalUI();
        }
    }

    closeDogBowlModal() {
        this.player.isMovementLocked = false;
        this.activeDogBowl = null;
        const modal = document.getElementById('dog-bowl-modal');
        if (modal) modal.classList.add('hidden');
    }

    updateDogBowlModalUI() {
        if (!this.activeDogBowl) return;
        const countEl = document.getElementById('dog-bowl-meals-count');
        if (countEl) {
            countEl.textContent = `${this.activeDogBowl.meals} / ${this.activeDogBowl.maxMeals}`;
        }
    }

    // Furnace Modal
    openFurnaceModal(furnace) {
        this.player.isMovementLocked = true;
        this.activeFurnace = furnace;
        const modal = document.getElementById('furnace-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateFurnaceModalUI();
        }
    }

    closeFurnaceModal() {
        this.player.isMovementLocked = false;
        this.activeFurnace = null;
        const modal = document.getElementById('furnace-modal');
        if (modal) modal.classList.add('hidden');
    }

    updateFurnaceModalUI() {
        if (!this.activeFurnace) return;

        const statusText = document.getElementById('furnace-status-text');
        const fillBar = document.getElementById('furnace-progress-fill');
        const fuelCount = document.getElementById('furnace-fuel-count');
        const matCount = document.getElementById('furnace-material-count');
        const outputCount = document.getElementById('furnace-output-count');

        if (statusText) statusText.textContent = this.activeFurnace.isSmelting ? '🔥 Smelting...' : 'Idle';
        if (fillBar) {
            const pct = (this.activeFurnace.smeltTimer / this.activeFurnace.smeltDuration) * 100;
            fillBar.style.width = `${pct}%`;
        }
        if (fuelCount) fuelCount.textContent = `${this.activeFurnace.fuelWood} / ${this.activeFurnace.maxFuel} Wood`;
        if (matCount) matCount.textContent = `${this.activeFurnace.rawStone} / ${this.activeFurnace.maxMaterial} Stone`;
        if (outputCount) outputCount.textContent = `${this.activeFurnace.processedStone} Processed Stone`;
    }

    // Half-Screen Management Modal System
    openManagementModal(category = 'animals') {
        this.player.isMovementLocked = true;
        const modal = document.getElementById('management-modal');
        const titleEl = document.getElementById('management-modal-title');

        const titleMap = {
            animals: '🦁 Marketplace Animals',
            rangers: '🤠 Recruit Rangers',
            building: '🔨 Crafting & Building',
            upgrades: '🏗️ Reserve Upgrades'
        };

        if (titleEl) titleEl.textContent = titleMap[category] || '📋 Management';

        const tabs = ['animals', 'rangers', 'building', 'upgrades'];
        tabs.forEach(tab => {
            const contentEl = document.getElementById(`management-modal-content-${tab}`);
            if (contentEl) {
                if (tab === category) {
                    contentEl.classList.remove('hidden');
                } else {
                    contentEl.classList.add('hidden');
                }
            }
        });

        if (modal) {
            modal.classList.remove('hidden');
            this.updateUI();
        }
    }

    closeManagementModal() {
        this.player.isMovementLocked = false;
        const modal = document.getElementById('management-modal');
        if (modal) modal.classList.add('hidden');
    }

    // Workbench Modal System
    openWorkbenchModal() {
        this.player.isMovementLocked = true;
        const modal = document.getElementById('workbench-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.renderWorkbenchModal();
        }
    }

    closeWorkbenchModal() {
        this.player.isMovementLocked = false;
        const modal = document.getElementById('workbench-modal');
        if (modal) modal.classList.add('hidden');
    }

    renderWorkbenchModal() {
        const grid = document.getElementById('workbench-crafting-grid');
        if (!grid) return;
        grid.innerHTML = '';

        WORKBENCH_CRAFTABLES.forEach(itemDef => {
            const woodCount = this.inventory.getItemCount('wood');
            const stoneCount = this.inventory.getItemCount('stone');
            const pStoneCount = this.inventory.getItemCount('processedStone');
            const saplingCount = this.inventory.getItemCount('sapling');
            const scrapsCount = this.inventory.getItemCount('scraps');

            const canAfford = this.state.isCreativeMode || (
                              woodCount >= (itemDef.woodCost || 0) &&
                              stoneCount >= (itemDef.stoneCost || 0) &&
                              pStoneCount >= (itemDef.processedStoneCost || 0) &&
                              saplingCount >= (itemDef.saplingCost || 0) &&
                              scrapsCount >= (itemDef.scrapsCost || 0));

            const card = document.createElement('div');
            card.className = 'item-card';

            const iconHTML = itemDef.image
                ? `<img src="${itemDef.image}" class="card-thumb-img" alt="${itemDef.name}">`
                : itemDef.icon;

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">${iconHTML}</div>
                    <div class="card-title-group">
                        <h4>${itemDef.name}</h4>
                        <span class="card-sub">${itemDef.type === 'item' ? 'Tool / Item' : 'Structure'}</span>
                    </div>
                </div>
                <p class="card-body">${itemDef.description}</p>
                <div class="card-stats">
                    ${itemDef.woodCost ? `<span class="badge">Wood: ${itemDef.woodCost}</span>` : ''}
                    ${itemDef.stoneCost ? `<span class="badge">Stone: ${itemDef.stoneCost}</span>` : ''}
                    ${itemDef.processedStoneCost ? `<span class="badge">P-Stone: ${itemDef.processedStoneCost}</span>` : ''}
                    ${itemDef.saplingCost ? `<span class="badge">Sapling: ${itemDef.saplingCost}</span>` : ''}
                    ${itemDef.scrapsCost ? `<span class="badge">Scraps: ${itemDef.scrapsCost}</span>` : ''}
                </div>
                <button class="action-btn" ${!canAfford ? 'disabled' : ''}>
                    ${!canAfford ? 'Insufficient Resources' : (itemDef.type === 'item' ? `Craft ${itemDef.name}` : `Build ${itemDef.name}`)}
                </button>
            `;

            const btn = card.querySelector('.action-btn');
            if (btn && canAfford) {
                btn.addEventListener('click', () => {
                    if (itemDef.type === 'item') {
                        if (this.inventory.canAddItem(itemDef.id, 1)) {
                            if (!this.state.isCreativeMode) {
                                this.inventory.consumeItem('wood', itemDef.woodCost || 0);
                                this.inventory.consumeItem('stone', itemDef.stoneCost || 0);
                                this.inventory.consumeItem('processedStone', itemDef.processedStoneCost || 0);
                                if (itemDef.saplingCost) this.inventory.consumeItem('sapling', itemDef.saplingCost);
                                if (itemDef.scrapsCost) this.inventory.consumeItem('scraps', itemDef.scrapsCost);
                            }
                            this.inventory.addItem(itemDef.id, 1);
                            this.showNotification(`Crafted 1x ${itemDef.name}!`);
                            this.updateUI();
                            this.renderWorkbenchModal();
                        } else {
                            this.showNotification('Backpack Full!');
                        }
                    } else {
                        this.closeWorkbenchModal();
                        this.startPlacementMode(itemDef);
                    }
                });
            }

            grid.appendChild(card);
        });
    }

    startNewGame() {
        this.state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
        const creativeCheckbox = document.getElementById('creative-mode-checkbox');
        if (creativeCheckbox) {
            this.state.isCreativeMode = creativeCheckbox.checked;
        }
        this.campChest = new CampChest('camp_chest_init', this.hq.x + this.hq.width + 30, this.hq.y + 72);
        this.inventory = this.campChest.inventory;
        this.inventory.addItem('wood', 30, 'Wood');
        this.inventory.addItem('stone', 15, 'Stone');

        this.rangers = [];
        this.furnaces = [];
        this.braais = [];
        this.renderedAnimals = [];
        this.plantedSaplings = [];
        this.droppedItems = [];

        this.tutorialState = {
            woodCollected: false,
            workbenchPlaced: false,
            enclosureComplete: false,
            completed: false
        };

        const taskWood = document.getElementById('task-wood');
        const taskWorkbench = document.getElementById('task-workbench');
        const taskEnclosure = document.getElementById('task-enclosure');
        [taskWood, taskWorkbench, taskEnclosure].forEach(el => {
            if (el) {
                el.classList.remove('completed');
                const cb = el.querySelector('.checkbox');
                if (cb) cb.textContent = '[ ]';
            }
        });

        const mainMenu = document.getElementById('main-menu-overlay');
        if (mainMenu) mainMenu.classList.add('hidden');

        const storyModal = document.getElementById('intro-story-modal');
        if (storyModal) storyModal.classList.remove('hidden');

        this.isPaused = true;
        this.player.isMovementLocked = true;
        if (this.audioManager) this.audioManager.startAudio();

        this.updateUI();
    }

    checkEnclosure() {
        const fences = this.state.placedBuildings.filter(b => b.type === 'fence_tier1' || b.type === 'fence_gate');
        if (fences.length === 0) return false;

        const CELL = 20;
        const margin = 200;

        const minX = Math.floor((this.reserve.x - margin) / CELL) * CELL;
        const maxX = Math.ceil((this.reserve.x + this.reserve.width + margin) / CELL) * CELL;
        const minY = Math.floor((this.reserve.y - margin) / CELL) * CELL;
        const maxY = Math.ceil((this.reserve.y + this.reserve.height + margin) / CELL) * CELL;

        const cols = Math.floor((maxX - minX) / CELL) + 1;
        const rows = Math.floor((maxY - minY) / CELL) + 1;

        const grid = new Array(cols * rows).fill(false);

        fences.forEach(f => {
            const fMinX = f.x - f.width / 2;
            const fMaxX = f.x + f.width / 2;
            const fMinY = f.y - f.height / 2;
            const fMaxY = f.y + f.height / 2;

            const startCol = Math.max(0, Math.floor((fMinX - minX) / CELL));
            const endCol = Math.min(cols - 1, Math.floor((fMaxX - minX) / CELL));
            const startRow = Math.max(0, Math.floor((fMinY - minY) / CELL));
            const endRow = Math.min(rows - 1, Math.floor((fMaxY - minY) / CELL));

            for (let c = startCol; c <= endCol; c++) {
                for (let r = startRow; r <= endRow; r++) {
                    grid[c + r * cols] = true;
                }
            }
        });

        const visited = new Array(cols * rows).fill(false);
        const queue = [];

        for (let c = 0; c < cols; c++) {
            let idx = c + 0 * cols;
            if (!grid[idx]) { visited[idx] = true; queue.push([c, 0]); }
            idx = c + (rows - 1) * cols;
            if (!grid[idx] && !visited[idx]) { visited[idx] = true; queue.push([c, rows - 1]); }
        }
        for (let r = 0; r < rows; r++) {
            let idx = 0 + r * cols;
            if (!grid[idx] && !visited[idx]) { visited[idx] = true; queue.push([0, r]); }
            idx = (cols - 1) + r * cols;
            if (!grid[idx] && !visited[idx]) { visited[idx] = true; queue.push([cols - 1, r]); }
        }

        let head = 0;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        while (head < queue.length) {
            const [c, r] = queue[head++];
            for (const [dc, dr] of dirs) {
                const nc = c + dc;
                const nr = r + dr;
                if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                    const nIdx = nc + nr * cols;
                    if (!grid[nIdx] && !visited[nIdx]) {
                        visited[nIdx] = true;
                        queue.push([nc, nr]);
                    }
                }
            }
        }

        const isReachableFromOutside = (rectMinX, rectMaxX, rectMinY, rectMaxY) => {
            const startCol = Math.max(0, Math.floor((rectMinX - minX) / CELL));
            const endCol = Math.min(cols - 1, Math.floor((rectMaxX - minX) / CELL));
            const startRow = Math.max(0, Math.floor((rectMinY - minY) / CELL));
            const endRow = Math.min(rows - 1, Math.floor((rectMaxY - minY) / CELL));

            for (let c = startCol; c <= endCol; c++) {
                for (let r = startRow; r <= endRow; r++) {
                    if (visited[c + r * cols]) {
                        return true;
                    }
                }
            }
            return false;
        };

        const hqReachable = isReachableFromOutside(this.hq.x, this.hq.x + this.hq.width, this.hq.y, this.hq.y + this.hq.height);

        const whMinX = this.waterhole.x - this.waterhole.radiusX;
        const whMaxX = this.waterhole.x + this.waterhole.radiusX;
        const whMinY = this.waterhole.y - this.waterhole.radiusY;
        const whMaxY = this.waterhole.y + this.waterhole.radiusY;
        const whReachable = isReachableFromOutside(whMinX, whMaxX, whMinY, whMaxY);

        return !hqReachable && !whReachable;
    }

    recordTutorialEvent(eventKey) {
        if (!this.state.tutorialEvents) this.state.tutorialEvents = {};
        this.state.tutorialEvents[eventKey] = true;
        this.updateTutorialChecklist();
    }

    updateTutorialChecklist() {
        if (typeof TUTORIAL_CHECKLISTS === 'undefined') return;

        const tutorialUI = document.getElementById('tutorial-checklist');
        const titleEl = document.getElementById('tutorial-title');
        const itemsEl = document.getElementById('tutorial-items');

        if (!tutorialUI || !titleEl || !itemsEl) return;

        const currentIndex = this.state.tutorialIndex || 0;

        if (currentIndex >= TUTORIAL_CHECKLISTS.length) {
            tutorialUI.style.display = 'none';
            return;
        }

        tutorialUI.style.display = 'flex';
        const activeChecklist = TUTORIAL_CHECKLISTS[currentIndex];
        titleEl.textContent = activeChecklist.title;

        // Check hunger/thirst experience event
        if (this.player.hunger <= 80 || this.player.thirst <= 80) {
            if (!this.state.tutorialEvents) this.state.tutorialEvents = {};
            this.state.tutorialEvents['experiencedHungerThirst'] = true;
        }

        itemsEl.innerHTML = '';
        let allCompleted = true;

        activeChecklist.tasks.forEach(task => {
            let isTaskDone = false;

            if (task.type === 'item_count') {
                const count = this.inventory.getItemCount(task.item);
                isTaskDone = count >= task.target;
            } else if (task.type === 'building_placed') {
                isTaskDone = this.state.placedBuildings.some(b => b.type === task.buildingType);
            } else if (task.type === 'building_count') {
                const count = this.state.placedBuildings.filter(b => b.type === task.buildingType).length;
                isTaskDone = count >= task.target;
            } else if (task.type === 'event') {
                isTaskDone = !!(this.state.tutorialEvents && this.state.tutorialEvents[task.eventKey]);
            }

            if (!isTaskDone) allCompleted = false;

            const li = document.createElement('li');
            li.className = `checklist-item ${isTaskDone ? 'completed' : ''}`;
            li.innerHTML = `<span class="checkbox">${isTaskDone ? '[✓]' : '[ ]'}</span> ${task.text}`;
            itemsEl.appendChild(li);
        });

        if (allCompleted) {
            const reward = activeChecklist.reward;
            this.state.dosh = (this.state.dosh || 0) + reward;
            this.showNotification(`Completed ${activeChecklist.title}! Awarded +${reward} Dosh!`);
            this.highlightDoshCounter();

            this.state.tutorialIndex = currentIndex + 1;

            if (this.state.tutorialIndex >= TUTORIAL_CHECKLISTS.length) {
                // Final Completion Bonus
                const finalBonus = 2000;
                this.state.dosh += finalBonus;
                this.showNotification(`🎉 All Tutorial Checklists Completed! Bonus: +${finalBonus} Dosh!`);
                tutorialUI.style.display = 'none';
            } else {
                this.updateTutorialChecklist();
            }
        }
    }

    triggerCelebrationModal() {
        this.isPaused = true;
        this.player.isMovementLocked = true;
        const modal = document.getElementById('celebration-modal');
        if (!modal) return;
        this.createConfetti();
        modal.classList.remove('hidden');
    }

    createConfetti() {
        const container = document.getElementById('confetti-container');
        if (!container) return;
        container.innerHTML = '';
        const colors = ['#f39c12', '#2ecc71', '#e74c3c', '#3498db', '#9b59b6', '#f1c40f'];
        for (let i = 0; i < 70; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = (Math.random() * 2.5) + 's';
            piece.style.animationDuration = (2.5 + Math.random() * 2) + 's';
            container.appendChild(piece);
        }
    }

    // Building Placement System
    startPlacementMode(buildingDef) {
        this.placementMode = {
            active: true,
            buildingDef: buildingDef,
            gridX: 0,
            gridY: 0,
            rotation: buildingDef.rotation || 0,
            valid: false
        };
        this.showNotification(`Placing ${buildingDef.name}. Click inside Reserve to build, [R] to rotate, ESC to cancel.`);
    }

    cancelPlacement() {
        if (this.placementMode.active) {
            this.placementMode.active = false;
            this.placementMode.buildingDef = null;
            this.showNotification('Placement cancelled.');
        }
    }

    updatePlacementCursor() {
        if (!this.placementMode.active || !this.placementMode.buildingDef) return;

        const bDef = this.placementMode.buildingDef;
        const rot = this.placementMode.rotation || 0;
        const isRotated = (rot === 90 || rot === 270);
        const bw = isRotated ? bDef.height : bDef.width;
        const bh = isRotated ? bDef.width : bDef.height;

        const gx = Math.floor(this.mouse.worldX / this.gridSize) * this.gridSize + bw / 2;
        const gy = Math.floor(this.mouse.worldY / this.gridSize) * this.gridSize + bh / 2;

        this.placementMode.gridX = gx;
        this.placementMode.gridY = gy;

        const halfW = bw / 2;
        const halfH = bh / 2;

        const insideReserve = (
            gx - halfW >= this.reserve.x &&
            gx + halfW <= this.reserve.x + this.reserve.width &&
            gy - halfH >= this.reserve.y &&
            gy + halfH <= this.reserve.y + this.reserve.height
        );

        let overlap = false;
        for (const b of this.state.placedBuildings) {
            const bRot = b.rotation || 0;
            const bRotated = (bRot === 90 || bRot === 270);
            const b_bw = bRotated ? b.height : b.width;
            const b_bh = bRotated ? b.width : b.height;

            if (Math.abs(b.x - gx) < (b_bw + bw) / 2 &&
                Math.abs(b.y - gy) < (b_bh + bh) / 2) {
                overlap = true;
                break;
            }
        }

        this.placementMode.valid = insideReserve && !overlap;
    }

    tryPlaceBuilding() {
        if (!this.placementMode.active || !this.placementMode.valid) {
            this.showNotification('Invalid placement! Must be inside Reserve bounds.');
            return;
        }

        const bDef = this.placementMode.buildingDef;

        const woodCount = this.inventory.getItemCount('wood');
        const stoneCount = this.inventory.getItemCount('stone');
        const pStoneCount = this.inventory.getItemCount('processedStone');
        const saplingCount = this.inventory.getItemCount('sapling');

        if (this.state.isCreativeMode || (
            woodCount >= bDef.woodCost &&
            stoneCount >= bDef.stoneCost &&
            pStoneCount >= (bDef.processedStoneCost || 0) &&
            saplingCount >= (bDef.saplingCost || 0))) {

            if (!this.state.isCreativeMode) {
                this.inventory.consumeItem('wood', bDef.woodCost);
                this.inventory.consumeItem('stone', bDef.stoneCost);
                this.inventory.consumeItem('processedStone', bDef.processedStoneCost || 0);
                if (bDef.saplingCost) {
                    this.inventory.consumeItem('sapling', bDef.saplingCost);
                }
            }

            const buildingObj = {
                id: `${bDef.id}_${Date.now()}`,
                type: bDef.id,
                name: bDef.name,
                x: this.placementMode.gridX,
                y: this.placementMode.gridY,
                width: bDef.width,
                height: bDef.height,
                rotation: this.placementMode.rotation || 0
            };

            this.state.placedBuildings.push(buildingObj);

            if (bDef.id === 'furnace') {
                this.furnaces.push(new Furnace(buildingObj.id, buildingObj.x, buildingObj.y, bDef.width, bDef.height));
            } else if (bDef.id === 'braai') {
                this.braais.push(new Braai(buildingObj.id, buildingObj.x, buildingObj.y, bDef.width, bDef.height));
            } else if (bDef.id === 'dog_bowl') {
                this.dogBowls.push(new DogBowl(buildingObj.id, buildingObj.x, buildingObj.y, bDef.width, bDef.height));
            } else if (bDef.id === 'ranger_hut') {
                this.syncRangersWithInfrastructure();
            }

            this.showNotification(`${bDef.name} constructed!`);
            this.placementMode.active = false;
            this.placementMode.buildingDef = null;
            this.updateUI();
        } else {
            this.showNotification('Insufficient resources in backpack to build!');
        }
    }

    // Infrastructure & Housing Warning Checks
    syncRangersWithInfrastructure() {
        const rangerHuts = this.state.placedBuildings.filter(b => b.type === 'ranger_hut');
        const unhousedWorkers = this.state.hiredRangers.filter(r => !r.assignedBuilding);

        // Housing Warning Badge Logic
        const warningBadge = document.getElementById('housing-warning-badge');
        const warningText = document.getElementById('housing-warning-text');

        if (unhousedWorkers.length > 0) {
            if (warningBadge) warningBadge.classList.remove('hidden');
            if (warningText) warningText.textContent = `Staff Unhoused (${unhousedWorkers.length} workers unassigned)`;
        } else {
            if (warningBadge) warningBadge.classList.add('hidden');
        }

        const existingMap = new Map();
        (this.rangers || []).forEach(r => existingMap.set(r.id, r));

        this.rangers = [];
        this.state.hiredRangers.forEach(hired => {
            let spawnX = this.hq.x + 72;
            let spawnY = this.hq.y + 72;
            if (hired.assignedBuilding && hired.assignedBuilding.startsWith('hut_')) {
                const hut = rangerHuts.find(b => b.id === hired.assignedBuilding);
                if (hut) {
                    spawnX = hut.x;
                    spawnY = hut.y;
                }
            }
            let ranger = existingMap.get(hired.id);
            if (ranger) {
                ranger.assignedBuilding = hired.assignedBuilding;
                ranger.job = hired.job;
                ranger.buff = hired.buff;
                ranger.hutX = spawnX;
                ranger.hutY = spawnY;
            } else {
                ranger = new Ranger(hired, spawnX, spawnY, this.reserve);
            }
            this.rangers.push(ranger);
        });
    }

    // Floating Text Helpers
    addFloatingText(text, x, y, color = '#ffffff') {
        this.floatingTexts.push({
            text: text,
            x: x,
            y: y,
            color: color,
            alpha: 1.0,
            life: 1.0
        });
    }

    updateDroppedItems(dt) {
        for (let i = this.droppedItems.length - 1; i >= 0; i--) {
            const item = this.droppedItems[i];
            item.update(dt);

            // Pickup Collision check with player
            const dist = Math.hypot(this.player.x - item.x, this.player.y - item.y);
            if (dist <= this.player.radius + item.radius) {
                if (this.inventory.canAddItem(item.type, item.amount)) {
                    this.inventory.addItem(item.type, item.amount);
                    const label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
                    this.addFloatingText(`+${item.amount} ${label}`, item.x, item.y - 15, '#2ecc71');
                    this.droppedItems.splice(i, 1);
                    this.updateUI();
                } else {
                    this.showNotification('Backpack Full! Cannot pickup item.');
                }
            }
        }
    }

    updatePlantedSaplings(dt) {
        for (let i = this.plantedSaplings.length - 1; i >= 0; i--) {
            const sapling = this.plantedSaplings[i];
            sapling.update(dt);

            if (sapling.isMature) {
                // Convert mature sapling into full harvestable ResourceNode in active chunk
                const chunkX = Math.floor(sapling.x / 1000);
                const chunkY = Math.floor(sapling.y / 1000);
                const chunkKey = `${chunkX},${chunkY}`;
                const chunk = this.chunkManager.loadedChunks.get(chunkKey);
                if (chunk) {
                    chunk.resourceNodes.push(new ResourceNode(`node_grown_${Date.now()}_${i}`, 'wood', sapling.x, sapling.y));
                }
                this.plantedSaplings.splice(i, 1);
                this.addFloatingText('🌳 Tree Fully Grown!', sapling.x, sapling.y - 20, '#2ecc71');
            }
        }
    }

    updateFloatingTexts(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life -= dt;
            ft.y -= 25 * dt;
            ft.alpha = Math.max(0, ft.life);
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    // Animal Ecosystem Engine
    initShrubs() {
        this.shrubs = [];
        const seedCount = 60;
        for (let i = 0; i < seedCount; i++) {
            const sx = this.reserve.x + 30 + Math.random() * (this.reserve.width - 60);
            const sy = this.reserve.y + 30 + Math.random() * (this.reserve.height - 60);

            // Avoid spawning inside HQ or waterhole
            const hqDist = Math.hypot(sx - (this.hq.x + this.hq.width / 2), sy - (this.hq.y + this.hq.height / 2));
            const whDist = Math.hypot(sx - this.waterhole.x, sy - this.waterhole.y);
            if (hqDist > 160 && whDist > 120) {
                this.shrubs.push(new Shrub(`shrub_${i}`, sx, sy));
            }
        }
    }

    initVisualAnimals() {
        this.renderedAnimals = [];
    }

    addVisualAnimal(animalListing) {
        const margin = 50;
        const startX = this.reserve.x + margin + Math.random() * (this.reserve.width - margin * 2);
        const startY = this.reserve.y + margin + Math.random() * (this.reserve.height - margin * 2);

        this.renderedAnimals.push(new Animal(animalListing, startX, startY, this.reserve));
    }

    // Calculations & Economy
    getTotalCapacity() {
        const campConfig = CAMP_TIERS_DATA.find(c => c.tier === this.state.campTier) || CAMP_TIERS_DATA[0];
        let total = campConfig.baseCapacity + this.buffs.capacityBonus;

        this.state.hiredRangers.forEach(hired => {
            if (hired.capacityBonus) {
                total += hired.capacityBonus;
            }
            if (hired.traits) {
                hired.traits.forEach(t => {
                    if (t.effects && t.effects.capacityBonus) total += t.effects.capacityBonus;
                });
            }
        });
        return total;
    }

    getCurrentAnimalCount() {
        return this.state.ownedAnimals.length;
    }

    getDailyAttractionIncome() {
        let totalIncome = 0;
        this.state.ownedAnimals.forEach(animal => {
            let animalAttr = animal.attractionScore * 2 - animal.upkeep;
            // Ranger Nature Lover trait check
            this.state.hiredRangers.forEach(r => {
                if (r.traits) {
                    r.traits.forEach(t => {
                        if (t.effects && t.effects.attractionMult) animalAttr *= t.effects.attractionMult;
                    });
                }
            });
            totalIncome += animalAttr;
        });
        return Math.max(0, Math.round(totalIncome * this.buffs.incomeMult));
    }

    getDailyRangerWages() {
        let totalWages = 0;
        this.state.hiredRangers.forEach(r => {
            totalWages += r.dailyWage;
        });
        return totalWages;
    }

    getNetDailyIncome() {
        return this.getDailyAttractionIncome() - this.getDailyRangerWages();
    }

    // Main Game Loops
    startBackgroundLoop() {
        setInterval(() => {
            if (this.isPaused) return;
            const deltaSec = this.tickInterval / 1000;
            this.timeElapsedInDay += deltaSec;
            this.state.dayProgress = (this.timeElapsedInDay / this.dayDuration) * 100;

            if (this.timeElapsedInDay >= this.dayDuration) {
                this.timeElapsedInDay = 0;
                this.processNewDay();
            }

            this.furnaces.forEach(f => f.update(deltaSec));
            if (this.activeFurnace) {
                this.updateFurnaceModalUI();
            }

            this.braais.forEach(b => b.update(deltaSec));
            if (this.activeBraai) {
                this.updateBraaiModalUI();
            }

            this.updateProgressBar();
            this.renderedAnimals.forEach(a => a.update(deltaSec, this.waterhole));
            if (this.dogJock) this.dogJock.update(deltaSec, this.waterhole, this.dogBowls, this);
        }, this.tickInterval);
    }

    updateSurvivalHUD() {
        const hpFill = document.getElementById('player-hp-fill');
        const thirstFill = document.getElementById('player-thirst-fill');
        const hungerFill = document.getElementById('player-hunger-fill');

        if (hpFill) {
            const hpPct = Math.max(0, Math.min(100, (this.player.hp / this.player.maxHp) * 100));
            hpFill.style.width = `${hpPct}%`;
        }
        if (thirstFill) {
            const thirstPct = Math.max(0, Math.min(100, (this.player.thirst / this.player.maxThirst) * 100));
            thirstFill.style.width = `${thirstPct}%`;
        }
        if (hungerFill) {
            const hungerPct = Math.max(0, Math.min(100, (this.player.hunger / this.player.maxHunger) * 100));
            hungerFill.style.width = `${hungerPct}%`;
        }
    }

    startRenderLoop() {
        const frame = (timestamp) => {
            const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
            this.lastFrameTime = timestamp;

            if (this.isPaused) {
                requestAnimationFrame(frame);
                return;
            }

            // Overseer Camera WASD / Arrow Keys / Screen-Edge Movement
            const camSpeed = this.camera ? this.camera.speed : 700;
            if (this.keys.w || this.keys.ArrowUp || this.mouse.screenY < 20) {
                this.camera.y -= camSpeed * dt;
            }
            if (this.keys.s || this.keys.ArrowDown || (this.canvas && this.mouse.screenY > this.canvas.height - 20)) {
                this.camera.y += camSpeed * dt;
            }
            if (this.keys.a || this.keys.ArrowLeft || this.mouse.screenX < 20) {
                this.camera.x -= camSpeed * dt;
            }
            if (this.keys.d || this.keys.ArrowRight || (this.canvas && this.mouse.screenX > this.canvas.width - 20)) {
                this.camera.x += camSpeed * dt;
            }

            // Fog of War exploration tracking around camera
            const chunkX = Math.floor(this.camera.x / 1000);
            const chunkY = Math.floor(this.camera.y / 1000);
            this.revealedChunks.add(`${chunkX},${chunkY}`);

            const resourceNodes = this.chunkManager.getAllResourceNodes();
            this.chunkManager.update(this.camera.x, this.camera.y, this.reserve, dt);

            // Hold-to-mine logic when tool equipped
            if (this.mouse.isDown) {
                const activeTool = this.getActiveHotbarItem();
                if (activeTool && ['stone-axe', 'stone-pickaxe', 'stone-shovel'].includes(activeTool.type)) {
                    this.mouse.holdGatherTimer += dt;
                    if (this.mouse.holdGatherTimer >= 0.25) { // continuous hit every 0.25s
                        this.mouse.holdGatherTimer = 0;
                        const reach = 80;
                        const allNodes = this.chunkManager.getAllResourceNodes();
                        let targetNode = null;
                        let minDist = reach;
                        for (const node of allNodes) {
                            const distToClick = Math.hypot(this.mouse.worldX - node.x, this.mouse.worldY - node.y);
                            const distToPlayer = Math.hypot(this.player.x - node.x, this.player.y - node.y);
                            if (distToClick <= node.radius + 15 && distToPlayer <= reach) {
                                if (distToClick < minDist) {
                                    minDist = distToClick;
                                    targetNode = node;
                                }
                            }
                        }
                        if (targetNode) {
                            this.hitResourceNode(targetNode);
                        }
                    }
                }
            }

            this.rangers.forEach(r => r.update(dt, this.waterhole, this));
            this.updateDroppedItems(dt);
            this.updatePlantedSaplings(dt);
            this.updateFloatingTexts(dt);
            this.updateSurvivalHUD();

            this.render();
            this.renderMinimap();

            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    processNewDay(isFastForward = false) {
        const dailyIncome = this.getDailyAttractionIncome();
        const dailyWages = this.getDailyRangerWages();
        const dailyNet = dailyIncome - dailyWages;

        this.state.funds += dailyNet;
        this.weeklyStats.income += dailyIncome;
        this.weeklyStats.wagesSpent += dailyWages;
        this.weeklyStats.expenses += dailyWages;

        // Refresh Marketplace Listings
        this.animalMarketListings = generateAnimalListings(6);
        this.rangerListings = generateRangerListings(6);

        // Reset Jock's daily scouting flag
        if (this.dogJock) {
            this.dogJock.hasScoutedToday = false;
        }

        this.state.day += 1;

        if (isFastForward) {
            this.showMorningRecapModal();
        } else {
            if ((this.state.day - 1) % 7 === 0) {
                this.triggerWeeklyRecapModal();
            } else {
                this.showNotification(`Day ${this.state.day} started! Daily net income: ${dailyNet >= 0 ? '+' : ''}$${dailyNet}`);
            }
        }

        this.updateUI();
    }

    triggerWeeklyRecapModal() {
        this.isPaused = true;

        const modal = document.getElementById('weekly-recap-modal');
        if (!modal) return;

        const elWeek = document.getElementById('recap-week-num');
        const elNextWeek = document.getElementById('recap-next-week-num');
        const elIncome = document.getElementById('recap-total-income');
        const elExpenses = document.getElementById('recap-total-expenses');
        const elProfit = document.getElementById('recap-net-profit');
        const elWages = document.getElementById('recap-wages-spent');
        const elAnimals = document.getElementById('recap-animals-spent');
        const elUpgrades = document.getElementById('recap-upgrades-spent');

        if (elWeek) elWeek.textContent = this.week;
        if (elNextWeek) elNextWeek.textContent = this.week + 1;
        if (elIncome) elIncome.textContent = `+$${this.weeklyStats.income.toLocaleString()}`;
        if (elExpenses) elExpenses.textContent = `-$${this.weeklyStats.expenses.toLocaleString()}`;

        const netProfit = this.weeklyStats.income - this.weeklyStats.expenses;
        if (elProfit) {
            elProfit.textContent = `${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString()}`;
            elProfit.style.color = netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        }

        if (elWages) elWages.textContent = `$${this.weeklyStats.wagesSpent.toLocaleString()}`;
        if (elAnimals) elAnimals.textContent = `$${this.weeklyStats.animalsBought.toLocaleString()}`;
        if (elUpgrades) elUpgrades.textContent = `$${this.weeklyStats.upgradesSpent.toLocaleString()}`;

        modal.classList.remove('hidden');

        const btn = document.getElementById('start-next-week-btn');
        if (btn) {
            btn.onclick = () => this.startNextWeek();
        }
    }

    startNextWeek() {
        const modal = document.getElementById('weekly-recap-modal');
        if (modal) modal.classList.add('hidden');

        this.week += 1;
        this.state.day += 1;

        // Reset weekly statistics
        this.weeklyStats = {
            income: 0,
            expenses: 0,
            wagesSpent: 0,
            animalsBought: 0,
            buildingsBuilt: 0,
            upgradesSpent: 0
        };

        this.isPaused = false;
        this.showNotification(`Week ${this.week} started! Good luck running Serengeti Reserve.`);
        this.updateUI();
    }

    // UI Rendering & Sync
    updateProgressBar() {
        const progressBar = document.getElementById('day-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, this.state.dayProgress))}%`;
        }
    }

    getFormattedTime() {
        const totalHours = ((this.timeElapsedInDay / this.dayDuration) * 24 + 6) % 24;
        const hours = Math.floor(totalHours);
        const minutes = Math.floor((totalHours % 1) * 60);
        const isNight = hours < 6 || hours >= 18;
        const icon = isNight ? '🌙' : '☀️';
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${icon}`;
    }

    getNightDarknessAlpha() {
        const t = this.timeElapsedInDay; // 0 to 300s (Day starts at 06:00 AM = 0s)
        const maxAlpha = 0.85;

        // 0 to 150s: 06:00 to 18:00 (Daylight)
        // 150 to 168.75s: 18:00 to 19:30 (Dusk)
        // 168.75 to 281.25s: 19:30 to 04:30 (Full Night)
        // 281.25 to 300s: 04:30 to 06:00 (Dawn)
        if (t >= 150 && t < 168.75) {
            return ((t - 150) / 18.75) * maxAlpha;
        } else if (t >= 168.75 && t < 281.25) {
            return maxAlpha;
        } else if (t >= 281.25 && t <= 300) {
            return maxAlpha * (1 - (t - 281.25) / 18.75);
        } else {
            return 0;
        }
    }

    updateUI() {
        const elFunds = document.getElementById('stat-funds');
        if (elFunds) elFunds.textContent = `$${this.state.funds.toLocaleString()}`;

        const elDosh = document.getElementById('stat-dosh');
        if (elDosh) elDosh.textContent = (this.state.dosh || 0).toLocaleString();

        const elClock = document.getElementById('digital-clock');
        if (elClock) elClock.textContent = this.getFormattedTime();

        const dayInWeek = ((this.state.day - 1) % 7) + 1;
        const elDay = document.getElementById('stat-day');
        if (elDay) elDay.textContent = dayInWeek;

        const elWeek = document.getElementById('stat-week');
        if (elWeek) elWeek.textContent = this.week;

        const netInc = this.getNetDailyIncome();
        const elNetInc = document.getElementById('stat-net-income');
        if (elNetInc) {
            elNetInc.textContent = `${netInc >= 0 ? '+' : ''}$${netInc.toLocaleString()}/d`;
            elNetInc.className = `stat-value ${netInc >= 0 ? 'positive' : 'negative'}`;
        }

        const elCap = document.getElementById('stat-capacity');
        if (elCap) elCap.textContent = `${this.getCurrentAnimalCount()} / ${this.getTotalCapacity()}`;

        const elPStone = document.getElementById('stat-pstone');
        if (elPStone) elPStone.textContent = this.inventory.getItemCount('processedStone');

        this.updateTutorialChecklist();
        this.updateHotbarUI();
        this.syncRangersWithInfrastructure();
        this.renderAnimalMarket();
        this.renderRangerHiring();
        this.renderCraftingMenu();
        this.renderUpgrades();
    }

    renderAnimalMarket() {
        const grid = document.getElementById('animal-market-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const currentFence = FENCE_TIERS_DATA.find(f => f.tier === this.state.fenceTier) || FENCE_TIERS_DATA[0];

        this.animalMarketListings.forEach(animal => {
            const canAfford = this.state.funds >= animal.cost;
            const hasCapacity = this.getCurrentAnimalCount() < this.getTotalCapacity();
            const meetFenceReq = currentFence.maxAnimalTier >= animal.enclosureTierReq;

            const card = document.createElement('div');
            card.className = 'item-card';

            let disableReason = '';
            if (!canAfford) disableReason = 'Insufficient Funds';
            else if (!hasCapacity) disableReason = 'Max Capacity Reached';
            else if (!meetFenceReq) disableReason = `Requires Tier ${animal.enclosureTierReq} Fence`;

            const iconHTML = animal.image
                ? `<img src="${animal.image}" alt="${animal.name}" class="card-thumb-img">`
                : animal.icon;

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">${iconHTML}</div>
                    <div class="card-title-group">
                        <h4>${animal.name} (${animal.gender}, ${animal.age}y)</h4>
                        <span class="card-sub">From: <strong>${animal.sellerReserve || 'Wild Reserve'}</strong></span>
                    </div>
                </div>
                <p class="card-body">${animal.description}</p>
                <div class="card-stats">
                    <span class="badge">Tier ${animal.enclosureTierReq} Fence</span>
                    <span class="badge">Cost: $${animal.cost}</span>
                    <span class="badge badge-good">+${animal.attractionScore} Attr</span>
                </div>
                <button class="action-btn" ${(!canAfford || !hasCapacity || !meetFenceReq) ? 'disabled' : ''}>
                    ${disableReason ? disableReason : `Buy ($${animal.cost})`}
                </button>
            `;

            const btn = card.querySelector('.action-btn');
            if (btn && !disableReason) {
                btn.addEventListener('click', () => this.buyAnimal(animal));
            }

            grid.appendChild(card);
        });
    }

    buyAnimal(animal) {
        if (this.state.funds >= animal.cost && this.getCurrentAnimalCount() < this.getTotalCapacity()) {
            this.state.funds -= animal.cost;
            this.weeklyStats.animalsBought += animal.cost;
            this.weeklyStats.expenses += animal.cost;
            this.state.ownedAnimals.push(animal);

            // Remove from marketplace listing
            const idx = this.animalMarketListings.findIndex(l => l.id === animal.id);
            if (idx !== -1) this.animalMarketListings.splice(idx, 1);

            this.addVisualAnimal(animal);
            this.updateUI();
        }
    }

    renderRangerHiring() {
        const grid = document.getElementById('ranger-hiring-grid');
        if (!grid) return;
        grid.innerHTML = '';

        this.rangerListings.forEach(ranger => {
            const card = document.createElement('div');
            card.className = 'item-card';

            const traitsHTML = ranger.traits.map(t =>
                `<span class="badge ${t.type === 'good' ? 'badge-good' : 'badge-bad'}" title="${t.description}">${t.name}</span>`
            ).join(' ');

            const iconHTML = ranger.image
                ? `<img src="${ranger.image}" alt="${ranger.name}" class="card-thumb-img">`
                : '🤠';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">${iconHTML}</div>
                    <div class="card-title-group">
                        <h4>${ranger.name} (${ranger.gender}, ${ranger.age}y)</h4>
                        <span class="card-sub">Wage: $${ranger.dailyWage}/d</span>
                    </div>
                </div>
                <div>${traitsHTML}</div>
                <button class="action-btn">
                    Hire ($${ranger.dailyWage}/d)
                </button>
            `;

            const btn = card.querySelector('.action-btn');
            if (btn) {
                btn.addEventListener('click', () => this.hireRanger(ranger));
            }

            grid.appendChild(card);
        });
    }

    hireRanger(ranger) {
        this.state.hiredRangers.push(ranger);

        // Remove from listings
        const idx = this.rangerListings.findIndex(l => l.id === ranger.id);
        if (idx !== -1) this.rangerListings.splice(idx, 1);

        this.syncRangersWithInfrastructure();
        this.updateUI();
    }

    renderCraftingMenu() {
        const grid = document.getElementById('crafting-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const allCraftables = [...BUILDINGS_DATA, ...WORKBENCH_CRAFTABLES];

        allCraftables.forEach(itemDef => {
            const woodCount = this.inventory.getItemCount('wood');
            const stoneCount = this.inventory.getItemCount('stone');
            const pStoneCount = this.inventory.getItemCount('processedStone');
            const saplingCount = this.inventory.getItemCount('sapling');
            const scrapsCount = this.inventory.getItemCount('scraps');

            const canAfford = this.state.isCreativeMode || (
                              woodCount >= (itemDef.woodCost || 0) &&
                              stoneCount >= (itemDef.stoneCost || 0) &&
                              pStoneCount >= (itemDef.processedStoneCost || 0) &&
                              saplingCount >= (itemDef.saplingCost || 0) &&
                              scrapsCount >= (itemDef.scrapsCost || 0));

            const card = document.createElement('div');
            card.className = 'item-card';

            const iconHTML = itemDef.image
                ? `<img src="${itemDef.image}" class="card-thumb-img" alt="${itemDef.name}">`
                : itemDef.icon;

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">${iconHTML}</div>
                    <div class="card-title-group">
                        <h4>${itemDef.name}</h4>
                        <span class="card-sub">${itemDef.type === 'item' ? 'Tool / Item' : 'Structure'}</span>
                    </div>
                </div>
                <p class="card-body">${itemDef.description}</p>
                <div class="card-stats">
                    ${itemDef.woodCost ? `<span class="badge">Wood: ${itemDef.woodCost}</span>` : ''}
                    ${itemDef.stoneCost ? `<span class="badge">Stone: ${itemDef.stoneCost}</span>` : ''}
                    ${itemDef.processedStoneCost ? `<span class="badge">P-Stone: ${itemDef.processedStoneCost}</span>` : ''}
                    ${itemDef.saplingCost ? `<span class="badge">Sapling: ${itemDef.saplingCost}</span>` : ''}
                    ${itemDef.scrapsCost ? `<span class="badge">Scraps: ${itemDef.scrapsCost}</span>` : ''}
                </div>
                <button class="action-btn" ${!canAfford ? 'disabled' : ''}>
                    ${!canAfford ? 'Insufficient Resources' : (itemDef.type === 'item' ? `Craft ${itemDef.name}` : `Place ${itemDef.name}`)}
                </button>
            `;

            const btn = card.querySelector('.action-btn');
            if (btn && canAfford) {
                btn.addEventListener('click', () => {
                    if (itemDef.type === 'item') {
                        if (this.inventory.canAddItem(itemDef.id, 1)) {
                            if (!this.state.isCreativeMode) {
                                this.inventory.consumeItem('wood', itemDef.woodCost || 0);
                                this.inventory.consumeItem('stone', itemDef.stoneCost || 0);
                                this.inventory.consumeItem('processedStone', itemDef.processedStoneCost || 0);
                                if (itemDef.saplingCost) this.inventory.consumeItem('sapling', itemDef.saplingCost);
                                if (itemDef.scrapsCost) this.inventory.consumeItem('scraps', itemDef.scrapsCost);
                            }
                            this.inventory.addItem(itemDef.id, 1);
                            this.showNotification(`Crafted 1x ${itemDef.name}!`);
                            this.updateUI();
                        } else {
                            this.showNotification('Backpack Full!');
                        }
                    } else {
                        this.closeManagementModal();
                        this.startPlacementMode(itemDef);
                    }
                });
            }

            grid.appendChild(card);
        });
    }

    renderUpgrades() {
        const grid = document.getElementById('upgrades-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const nextCamp = CAMP_TIERS_DATA.find(c => c.tier === this.state.campTier + 1);
        const currentCamp = CAMP_TIERS_DATA.find(c => c.tier === this.state.campTier);

        const campCard = document.createElement('div');
        campCard.className = 'item-card';

        if (nextCamp) {
            const canAfford = this.state.isCreativeMode || (
                              this.state.funds >= nextCamp.cost &&
                              this.inventory.getItemCount('wood') >= nextCamp.woodCost &&
                              this.inventory.getItemCount('stone') >= (nextCamp.stoneCost || 0) &&
                              this.inventory.getItemCount('processedStone') >= (nextCamp.processedStoneCost || 0));

            campCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🏕️</div>
                    <div class="card-title-group">
                        <h4>Upgrade Camp: ${nextCamp.name}</h4>
                        <span class="card-sub">Current: Tier ${currentCamp.tier}</span>
                    </div>
                </div>
                <p class="card-body">${nextCamp.description}</p>
                <div class="card-stats">
                    <span class="badge">Cost: $${nextCamp.cost}</span>
                    <span class="badge">Wood: ${nextCamp.woodCost}</span>
                    <span class="badge">Stone: ${nextCamp.stoneCost || 0}</span>
                </div>
                <button class="action-btn" ${!canAfford ? 'disabled' : ''}>
                    ${!canAfford ? 'Insufficient Resources' : `Upgrade to ${nextCamp.name}`}
                </button>
            `;
            const btn = campCard.querySelector('.action-btn');
            if (btn && canAfford) {
                btn.addEventListener('click', () => {
                    if (!this.state.isCreativeMode) {
                        this.state.funds -= nextCamp.cost;
                        this.weeklyStats.upgradesSpent += nextCamp.cost;
                        this.weeklyStats.expenses += nextCamp.cost;
                        this.inventory.consumeItem('wood', nextCamp.woodCost);
                        this.inventory.consumeItem('stone', nextCamp.stoneCost || 0);
                        this.inventory.consumeItem('processedStone', nextCamp.processedStoneCost || 0);
                    }
                    this.state.campTier += 1;
                    this.updateUI();
                });
            }
        } else {
            campCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🏛️</div>
                    <div class="card-title-group">
                        <h4>Camp Tier: ${currentCamp.name}</h4>
                        <span class="card-sub">Max Level</span>
                    </div>
                </div>
                <p class="card-body">${currentCamp.description}</p>
            `;
        }
        grid.appendChild(campCard);

        const nextFence = FENCE_TIERS_DATA.find(f => f.tier === this.state.fenceTier + 1);
        const currentFence = FENCE_TIERS_DATA.find(f => f.tier === this.state.fenceTier);

        const fenceCard = document.createElement('div');
        fenceCard.className = 'item-card';

        if (nextFence) {
            const canAfford = this.state.isCreativeMode || (
                              this.state.funds >= nextFence.cost &&
                              this.inventory.getItemCount('wood') >= nextFence.woodCost &&
                              this.inventory.getItemCount('stone') >= (nextFence.stoneCost || 0) &&
                              this.inventory.getItemCount('processedStone') >= (nextFence.processedStoneCost || 0));

            fenceCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🛡️</div>
                    <div class="card-title-group">
                        <h4>Upgrade Fence: ${nextFence.name}</h4>
                        <span class="card-sub">Current: Tier ${currentFence.tier}</span>
                    </div>
                </div>
                <p class="card-body">${nextFence.description}</p>
                <div class="card-stats">
                    <span class="badge">Cost: $${nextFence.cost}</span>
                    <span class="badge">Wood: ${nextFence.woodCost}</span>
                    <span class="badge">Stone: ${nextFence.stoneCost || 0}</span>
                </div>
                <button class="action-btn" ${!canAfford ? 'disabled' : ''}>
                    ${!canAfford ? 'Insufficient Resources' : `Upgrade to ${nextFence.name}`}
                </button>
            `;
            const btn = fenceCard.querySelector('.action-btn');
            if (btn && canAfford) {
                btn.addEventListener('click', () => {
                    if (!this.state.isCreativeMode) {
                        this.state.funds -= nextFence.cost;
                        this.weeklyStats.upgradesSpent += nextFence.cost;
                        this.weeklyStats.expenses += nextFence.cost;
                        this.inventory.consumeItem('wood', nextFence.woodCost);
                        this.inventory.consumeItem('stone', nextFence.stoneCost || 0);
                        this.inventory.consumeItem('processedStone', nextFence.processedStoneCost || 0);
                    }
                    this.state.fenceTier += 1;
                    this.updateUI();
                });
            }
        } else {
            fenceCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">⚡</div>
                    <div class="card-title-group">
                        <h4>Fence Tier: ${currentFence.name}</h4>
                        <span class="card-sub">Max Level</span>
                    </div>
                </div>
                <p class="card-body">${currentFence.description}</p>
            `;
        }
        grid.appendChild(fenceCard);
    }

    // Circular Minimap Renderer (Tracking Player, Jock, Reserve, Unlooted Crates, Zoom, and Off-Screen HQ Indicator)
    renderMinimap() {
        if (!this.minimapCtx || !this.minimapCanvas) return;
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        // Clip to circular map
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
        ctx.clip();

        const centerX = w / 2;
        const centerY = h / 2;
        const baseScale = 0.045;
        const scale = baseScale * this.minimapZoom;

        const camX = this.camera ? this.camera.x : (this.player ? this.player.x : 1000);
        const camY = this.camera ? this.camera.y : (this.player ? this.player.y : 1000);

        // Minimap Savanna Background
        ctx.fillStyle = '#5c4a2a';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-camX, -camY);

        // Render Reserve Enclosure Bounds Ground on Minimap
        ctx.fillStyle = '#4a6830';
        ctx.fillRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 3 / scale;
        ctx.strokeRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);

        // Render Waterhole on Minimap
        if (this.waterhole) {
            ctx.fillStyle = '#2980b9';
            ctx.beginPath();
            ctx.ellipse(this.waterhole.x, this.waterhole.y, this.waterhole.radiusX, this.waterhole.radiusY, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Render Reserve HQ on Minimap
        ctx.fillStyle = '#d35400';
        ctx.fillRect(this.hq.x, this.hq.y, this.hq.width, this.hq.height);

        // Render Unlooted Forgotten Ranger Chests
        const crates = this.chunkManager.getAllCrates();
        crates.forEach(crate => {
            if (crate.looted) return;
            const cx = Math.floor(crate.x / 1000);
            const cy = Math.floor(crate.y / 1000);
            if (this.revealedChunks.has(`${cx},${cy}`)) {
                ctx.fillStyle = '#ffd700'; // Bright Gold
                ctx.beginPath();
                ctx.arc(crate.x, crate.y, 8 / scale, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Render Animals on Minimap
        (this.renderedAnimals || []).forEach(a => {
            ctx.fillStyle = '#f1c40f'; // Yellow dot
            ctx.beginPath();
            ctx.arc(a.x, a.y, 6 / scale, 0, Math.PI * 2);
            ctx.fill();
        });

        // Render Jock on Minimap
        if (this.dogJock) {
            ctx.fillStyle = '#ff7700'; // Bright Orange/Gold
            ctx.beginPath();
            ctx.arc(this.dogJock.x, this.dogJock.y, 8 / scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / scale;
            ctx.stroke();
        }

        // Render Rangers on Minimap
        (this.rangers || []).forEach(r => {
            ctx.fillStyle = '#2ecc71'; // Bright Green
            ctx.beginPath();
            ctx.arc(r.x, r.y, 7 / scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 / scale;
            ctx.stroke();
        });

        // Render Player on Minimap
        if (this.player) {
            ctx.fillStyle = '#3498db'; // Bright Blue
            ctx.beginPath();
            ctx.arc(this.player.x, this.player.y, 9 / scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / scale;
            ctx.stroke();
        }

        // Draw Overseer Camera Viewport Rectangle on Minimap
        if (this.canvas) {
            const screenW = this.canvas.width;
            const screenH = this.canvas.height;
            const camScale = this.camera ? this.camera.scale : 0.65;
            const viewWorldW = screenW / camScale;
            const viewWorldH = screenH / camScale;
            const viewMinX = camX - viewWorldW / 2;
            const viewMinY = camY - viewWorldH / 2;

            ctx.strokeStyle = '#00ffff'; // Cyan highlight rectangle for viewport
            ctx.lineWidth = 2.5 / scale;
            ctx.strokeRect(viewMinX, viewMinY, viewWorldW, viewWorldH);
        }

        ctx.restore(); // Restore context transformation back to screen coordinates

        // Check Reserve HQ Off-Screen Status and Render Directional Indicator Arrow
        const hqWorldX = this.hq.x + this.hq.width / 2;
        const hqWorldY = this.hq.y + this.hq.height / 2;
        const hqScreenX = centerX + (hqWorldX - camX) * scale;
        const hqScreenY = centerY + (hqWorldY - camY) * scale;

        const radiusMap = w / 2 - 10;
        const distFromCenter = Math.hypot(hqScreenX - centerX, hqScreenY - centerY);

        if (distFromCenter > radiusMap) {
            const angle = Math.atan2(hqScreenY - centerY, hqScreenX - centerX);
            const arrowX = centerX + Math.cos(angle) * radiusMap;
            const arrowY = centerY + Math.sin(angle) * radiusMap;

            ctx.save();
            ctx.translate(arrowX, arrowY);
            ctx.rotate(angle);

            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-6, -6);
            ctx.lineTo(-3, 0);
            ctx.lineTo(-6, 6);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        ctx.restore();
    }

    renderSavannahBackground(viewBounds) {
        // Base ground fill for visible viewport (Smoothly blended Savannah green)
        this.ctx.fillStyle = '#557a2b';
        this.ctx.fillRect(
            viewBounds.minX - 100,
            viewBounds.minY - 100,
            (viewBounds.maxX - viewBounds.minX) + 200,
            (viewBounds.maxY - viewBounds.minY) + 200
        );

        // Reserve interior natural lush grass fill
        this.ctx.fillStyle = '#466826';
        this.ctx.fillRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);

        // Organic smoothly blended grass patches across reserve terrain
        this.ctx.save();
        const grassColors = ['#527835', '#415e2a', '#365222', '#5b823b', '#48682e'];
        const patchCount = 28;
        for (let i = 0; i < patchCount; i++) {
            const px = this.reserve.x + 80 + (i * 317) % (this.reserve.width - 160);
            const py = this.reserve.y + 80 + (i * 223) % (this.reserve.height - 160);
            const rx = 60 + (i * 17) % 50;
            const ry = 40 + (i * 13) % 40;
            const rot = (i * 0.4);

            this.ctx.fillStyle = grassColors[i % grassColors.length];
            this.ctx.beginPath();
            this.ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();

        // Reserve Perimeter Border Line
        this.ctx.strokeStyle = '#3d2b17';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);
    }

    // World Canvas Renderer
    render() {
        if (!this.ctx || !this.canvas) return;

        const screenW = this.canvas.width;
        const screenH = this.canvas.height;

        this.ctx.clearRect(0, 0, screenW, screenH);

        const scale = this.camera ? this.camera.scale : 0.65;
        const camX = this.camera ? this.camera.x : 1000;
        const camY = this.camera ? this.camera.y : 1000;

        this.ctx.save();
        this.ctx.translate(screenW / 2, screenH / 2);
        this.ctx.scale(scale, scale);
        this.ctx.translate(-camX, -camY);

        const viewBounds = {
            minX: camX - (screenW / 2) / scale - 100,
            maxX: camX + (screenW / 2) / scale + 100,
            minY: camY - (screenH / 2) / scale - 100,
            maxY: camY + (screenH / 2) / scale + 100
        };

        // 1. Savannah Biome Background
        this.renderSavannahBackground(viewBounds);

        // Small shrub entities with subtle sine-wave sway animation (wind effect)
        this.shrubs.forEach(shrub => shrub.render(this.ctx));

        // Waterhole
        this.waterhole.render(this.ctx, this.images);

        // Reserve HQ (Scaled structure)
        const hqImg = this.images['reserve-hq.png'];
        if (hqImg && hqImg.complete) {
            this.ctx.drawImage(hqImg, this.hq.x, this.hq.y, this.hq.width, this.hq.height);
        } else {
            this.ctx.fillStyle = '#5c4028';
            this.ctx.fillRect(this.hq.x, this.hq.y, this.hq.width, this.hq.height);
            this.ctx.strokeStyle = '#3a2717';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(this.hq.x, this.hq.y, this.hq.width, this.hq.height);

            this.ctx.fillStyle = '#f39c12';
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`RESERVE HQ T${this.state.campTier}`, this.hq.x + this.hq.width / 2, this.hq.y + this.hq.height / 2);
        }

        // Camp Chest next to Reserve HQ
        if (this.campChest) {
            this.campChest.render(this.ctx, this.images);
        }

        // Dog Jock
        if (this.dogJock) {
            this.dogJock.render(this.ctx, this.images);
        }

        // Reserve Perimeter Fences & Gate
        const fenceImg = this.images['fence-tier1.png'];
        const gateImg = this.images['fence-tier1-employee-gate.png'];

        const fenceColor = this.state.fenceTier === 3 ? '#3498db' : (this.state.fenceTier === 2 ? '#bdc3c7' : '#8e44ad');
        this.ctx.strokeStyle = fenceColor;
        this.ctx.lineWidth = 6;
        this.ctx.strokeRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);

        // Gate rendering at bottom center of reserve bounds
        const gateX = this.reserve.x + this.reserve.width / 2;
        const gateY = this.reserve.y + this.reserve.height;
        if (gateImg && gateImg.complete) {
            this.ctx.drawImage(gateImg, gateX - 30, gateY - 15, 60, 30);
        }

        if (this.state.fenceTier === 3) {
            const pulse = 4 + Math.sin(performance.now() / 200) * 4;
            this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
            this.ctx.lineWidth = 6 + pulse;
            this.ctx.strokeRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);
        }

        // Corner Posts
        this.ctx.fillStyle = '#f39c12';
        const corners = [
            [this.reserve.x, this.reserve.y],
            [this.reserve.x + this.reserve.width, this.reserve.y],
            [this.reserve.x, this.reserve.y + this.reserve.height],
            [this.reserve.x + this.reserve.width, this.reserve.y + this.reserve.height]
        ];
        corners.forEach(([cx, cy]) => {
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // 3. Render Infinite Procedural Chunks
        this.chunkManager.render(this.ctx, this.images, viewBounds);

        // Render Physical Dropped Ground Items
        this.droppedItems.forEach(item => {
            if (item.x + item.radius >= viewBounds.minX && item.x - item.radius <= viewBounds.maxX &&
                item.y + item.radius >= viewBounds.minY && item.y - item.radius <= viewBounds.maxY) {
                item.render(this.ctx);
            }
        });

        // Render Planted Saplings
        this.plantedSaplings.forEach(sapling => {
            if (sapling.x + 20 >= viewBounds.minX && sapling.x - 20 <= viewBounds.maxX &&
                sapling.y + 20 >= viewBounds.minY && sapling.y - 20 <= viewBounds.maxY) {
                sapling.render(this.ctx, this.images);
            }
        });

        // 4. Render Placed Buildings & Furnaces & Braai & Chopping Station & Dog Bowl
        this.state.placedBuildings.forEach(b => {
            const rot = b.rotation || 0;
            if (b.type === 'furnace') {
                const furnaceObj = this.furnaces.find(f => f.id === b.id);
                if (furnaceObj) {
                    furnaceObj.render(this.ctx, rot);
                }
            } else if (b.type === 'braai') {
                const braaiObj = this.braais.find(br => br.id === b.id);
                if (braaiObj) {
                    braaiObj.render(this.ctx, this.images, rot);
                }
            } else if (b.type === 'dog_bowl') {
                const bowlObj = this.dogBowls.find(db => db.id === b.id);
                if (bowlObj) {
                    bowlObj.render(this.ctx, rot);
                }
            } else if (b.type === 'wood_chopping_station') {
                this.ctx.save();
                this.ctx.translate(b.x, b.y);
                if (rot) this.ctx.rotate((rot * Math.PI) / 180);

                this.ctx.fillStyle = '#6e4f34';
                this.ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
                this.ctx.strokeStyle = '#3d2b1c';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(-b.width / 2, -b.height / 2, b.width, b.height);

                this.ctx.fillStyle = '#f1c40f';
                this.ctx.font = 'bold 20px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('🪓', 0, 0);

                this.ctx.restore();
            } else if (b.type === 'torch') {
                this.ctx.save();
                this.ctx.translate(b.x, b.y);
                if (rot) this.ctx.rotate((rot * Math.PI) / 180);

                this.ctx.fillStyle = '#5c4028';
                this.ctx.fillRect(-3, -10, 6, 20);

                const flick = 2 + Math.sin(performance.now() / 100) * 1.5;
                this.ctx.fillStyle = '#f39c12';
                this.ctx.beginPath();
                this.ctx.arc(0, -12, 6 + flick, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.fillStyle = '#f1c40f';
                this.ctx.beginPath();
                this.ctx.arc(0, -12, 3 + flick * 0.5, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.restore();
            } else if (b.type === 'workbench') {
                this.ctx.save();
                this.ctx.translate(b.x, b.y);
                if (rot) this.ctx.rotate((rot * Math.PI) / 180);

                this.ctx.fillStyle = '#8e5a2b';
                this.ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
                this.ctx.strokeStyle = '#523315';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(-b.width / 2, -b.height / 2, b.width, b.height);

                this.ctx.fillStyle = '#f1c40f';
                this.ctx.font = 'bold 20px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('🛠️', 0, 0);

                this.ctx.restore();
            } else if (b.type === 'ranger_hut') {
                this.ctx.save();
                this.ctx.translate(b.x, b.y);
                if (rot) this.ctx.rotate((rot * Math.PI) / 180);

                const hutImg = this.images['ranger-hut.png'];
                if (hutImg && hutImg.complete) {
                    this.ctx.drawImage(hutImg, -b.width / 2, -b.height / 2, b.width, b.height);
                } else {
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    this.ctx.fillRect(-b.width / 2 + 4, -b.height / 2 + 4, b.width, b.height);

                    this.ctx.fillStyle = '#6e4f34';
                    this.ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
                    this.ctx.strokeStyle = '#3d2b1c';
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeRect(-b.width / 2, -b.height / 2, b.width, b.height);

                    this.ctx.fillStyle = '#2ecc71';
                    this.ctx.font = 'bold 12px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('RANGER HUT', 0, 0);
                }

                this.ctx.restore();
            } else if (b.type === 'fence_tier1') {
                this.ctx.save();
                this.ctx.translate(b.x, b.y);
                if (rot) this.ctx.rotate((rot * Math.PI) / 180);

                const fImg = this.images['fence-tier1.png'];
                if (fImg && fImg.complete) {
                    this.ctx.drawImage(fImg, -b.width / 2, -b.height / 2, b.width, b.height);
                } else {
                    this.ctx.fillStyle = '#8e44ad';
                    this.ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
                }

                this.ctx.restore();
            } else if (b.type === 'fence_gate') {
                this.ctx.save();
                this.ctx.translate(b.x, b.y);
                if (rot) this.ctx.rotate((rot * Math.PI) / 180);

                const gImg = this.images['fence-tier1-employee-gate.png'];
                if (gImg && gImg.complete) {
                    this.ctx.drawImage(gImg, -b.width / 2, -b.height / 2, b.width, b.height);
                } else {
                    this.ctx.fillStyle = '#f39c12';
                    this.ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
                }

                this.ctx.restore();
            }
        });

        // 5. Render Blueprint Cursor in Placement Mode
        if (this.placementMode.active && this.placementMode.buildingDef) {
            const bDef = this.placementMode.buildingDef;
            const gx = this.placementMode.gridX;
            const gy = this.placementMode.gridY;
            const rot = this.placementMode.rotation || 0;

            this.ctx.save();
            this.ctx.translate(gx, gy);
            if (rot) this.ctx.rotate((rot * Math.PI) / 180);

            this.ctx.fillStyle = this.placementMode.valid ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)';
            this.ctx.fillRect(-bDef.width / 2, -bDef.height / 2, bDef.width, bDef.height);

            this.ctx.strokeStyle = this.placementMode.valid ? '#2ecc71' : '#e74c3c';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-bDef.width / 2, -bDef.height / 2, bDef.width, bDef.height);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(bDef.name, 0, 0);

            this.ctx.restore();
        }

        // 6. Render Reserve Animals
        this.renderedAnimals.forEach(animal => animal.render(this.ctx, this.images));

        // 7. Render Rangers
        this.rangers.forEach(ranger => ranger.render(this.ctx, this.images));


        // 9. Dynamic Lighting Overlay for Night Phase
        const nightAlpha = this.getNightDarknessAlpha();
        if (nightAlpha > 0) {
            if (!this.lightingCanvas) {
                this.lightingCanvas = document.createElement('canvas');
                this.lightingCtx = this.lightingCanvas.getContext('2d');
            }
            if (this.lightingCanvas.width !== screenW || this.lightingCanvas.height !== screenH) {
                this.lightingCanvas.width = screenW;
                this.lightingCanvas.height = screenH;
            }

            const lCtx = this.lightingCtx;
            lCtx.clearRect(0, 0, screenW, screenH);

            lCtx.fillStyle = `rgba(5, 10, 25, ${nightAlpha})`;
            lCtx.fillRect(0, 0, screenW, screenH);

            lCtx.globalCompositeOperation = 'destination-out';

            const drawLightPool = (worldX, worldY, radius) => {
                const screenX = (worldX - camX) * scale + screenW / 2;
                const screenY = (worldY - camY) * scale + screenH / 2;
                const screenRadius = radius * scale;

                if (screenX + screenRadius < 0 || screenX - screenRadius > screenW ||
                    screenY + screenRadius < 0 || screenY - screenRadius > screenH) return;

                const grad = lCtx.createRadialGradient(screenX, screenY, screenRadius * 0.1, screenX, screenY, screenRadius);
                grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                lCtx.fillStyle = grad;
                lCtx.beginPath();
                lCtx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
                lCtx.fill();
            };

            // Rangers, Player & Overseer camera light pools
            this.rangers.forEach(r => drawLightPool(r.x, r.y, 180));
            if (this.player) drawLightPool(this.player.x, this.player.y, 220);
            drawLightPool(this.camera.x, this.camera.y, 260);

            // Placed buildings light pools (Torches, Furnaces, Braais)
            this.state.placedBuildings.forEach(b => {
                if (b.type === 'torch') {
                    const flick = Math.sin(performance.now() / 150) * 8;
                    drawLightPool(b.x, b.y, 200 + flick);
                } else if (b.type === 'furnace') {
                    const furnaceObj = this.furnaces.find(f => f.id === b.id);
                    if (furnaceObj && furnaceObj.isSmelting) {
                        drawLightPool(b.x, b.y, 180);
                    } else {
                        drawLightPool(b.x, b.y, 90);
                    }
                } else if (b.type === 'braai') {
                    const braaiObj = this.braais.find(br => br.id === b.id);
                    if (braaiObj && braaiObj.isCooking) {
                        drawLightPool(b.x, b.y, 180);
                    } else {
                        drawLightPool(b.x, b.y, 90);
                    }
                }
            });

            lCtx.globalCompositeOperation = 'source-over';

            const screenWorldW = screenW / scale;
            const screenWorldH = screenH / scale;
            this.ctx.drawImage(this.lightingCanvas, camX - screenWorldW / 2, camY - screenWorldH / 2, screenWorldW, screenWorldH);
        }

        // 10. Fog of War Overlay (Pitch Black Outside Revealed Radius & Reserve)
        this.renderFogOfWar(camX, camY, screenW, screenH);

        // 10. Render Floating Feedback Texts
        this.ctx.font = 'bold 15px sans-serif';
        this.ctx.textAlign = 'center';
        this.floatingTexts.forEach(ft => {
            this.ctx.fillStyle = ft.color;
            this.ctx.globalAlpha = ft.alpha;
            this.ctx.fillText(ft.text, ft.x, ft.y);
            this.ctx.globalAlpha = 1.0;
        });

        this.ctx.restore();
    }

    highlightDoshCounter() {
        const badge = document.getElementById('dosh-badge-container');
        if (badge) {
            badge.style.transform = 'scale(1.35)';
            badge.style.backgroundColor = 'rgba(46, 204, 113, 0.8)';
            setTimeout(() => {
                badge.style.transform = 'scale(1)';
                badge.style.backgroundColor = 'rgba(107, 62, 16, 0.2)';
            }, 800);
        }
    }

    /**
     * Fog of War System
     * Render a semi-transparent dark overlay (fillStyle = "rgba(0, 0, 0, 0.7)") over unrevealed map.
     * Clears fog overlay in radius around Forager rangers using globalCompositeOperation = 'destination-out'.
     */
    renderFogOfWar(camX, camY, screenW, screenH) {
        const scale = this.camera ? this.camera.scale : 0.65;

        if (!this.fogCanvas) {
            this.fogCanvas = document.createElement('canvas');
            this.fogCtx = this.fogCanvas.getContext('2d');
        }
        if (this.fogCanvas.width !== screenW || this.fogCanvas.height !== screenH) {
            this.fogCanvas.width = screenW;
            this.fogCanvas.height = screenH;
        }

        const fCtx = this.fogCtx;
        fCtx.clearRect(0, 0, screenW, screenH);

        // Render semi-transparent dark overlay over entire unrevealed screen
        fCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        fCtx.fillRect(0, 0, screenW, screenH);

        fCtx.globalCompositeOperation = 'destination-out';

        const worldToScreen = (wx, wy) => {
            return {
                x: (wx - camX) * scale + screenW / 2,
                y: (wy - camY) * scale + screenH / 2
            };
        };

        // Clear fog over Reserve HQ enclosure area
        const reserveTL = worldToScreen(this.reserve.x, this.reserve.y);
        const reserveBR = worldToScreen(this.reserve.x + this.reserve.width, this.reserve.y + this.reserve.height);
        fCtx.fillRect(reserveTL.x, reserveTL.y, reserveBR.x - reserveTL.x, reserveBR.y - reserveTL.y);

        // Clear fog over permanently revealed chunks
        const startChunkX = Math.floor((camX - (screenW / 2) / scale - 1000) / 1000);
        const endChunkX = Math.floor((camX + (screenW / 2) / scale + 1000) / 1000);
        const startChunkY = Math.floor((camY - (screenH / 2) / scale - 1000) / 1000);
        const endChunkY = Math.floor((camY + (screenH / 2) / scale + 1000) / 1000);

        for (let cx = startChunkX; cx <= endChunkX; cx++) {
            for (let cy = startChunkY; cy <= endChunkY; cy++) {
                const key = `${cx},${cy}`;
                if (this.revealedChunks.has(key)) {
                    const chunkTL = worldToScreen(cx * 1000, cy * 1000);
                    const chunkBR = worldToScreen((cx + 1) * 1000, (cy + 1) * 1000);
                    fCtx.fillRect(chunkTL.x, chunkTL.y, chunkBR.x - chunkTL.x, chunkBR.y - chunkTL.y);
                }
            }
        }

        // Clear fog in a radius around Rangers with Forager job as they move
        this.rangers.forEach(ranger => {
            if (ranger.job === 'Forager') {
                const pos = worldToScreen(ranger.x, ranger.y);
                const radius = 220 * scale;
                fCtx.beginPath();
                fCtx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
                fCtx.fill();
            }
        });

        fCtx.globalCompositeOperation = 'source-over';

        // Draw fog overlay onto main canvas in screen coordinates
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.drawImage(this.fogCanvas, 0, 0);
        this.ctx.restore();
    }
}

// Initialize Game Engine on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ReserveGame();
});
