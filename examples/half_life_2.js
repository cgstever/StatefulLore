// ============================================================
// Half-Life 2: World Lorebook — StatefulLore Module
// Translated from: HL2 World Lorebook (109 entries)
// ============================================================
// Design note: This lorebook is almost entirely static world
// reference material. The module tracks location, faction
// alignment, alert level, and key inventory, then injects
// only the lore entries relevant to the current situation
// rather than dumping all 109 entries every turn.
// ============================================================

// -- Factions ------------------------------------------------

const factions = {
    "The Combine": `A vast multi-dimensional empire spanning parallel universes. On Earth, they rule through Dr. Wallace Breen and an army of cybernetically-enhanced transhuman soldiers (Overwatch). Their weaknesses: slow to mobilize their full power, and unable to perform local-space teleportation the way the Resistance can. Earth-based forces include Overwatch Soldiers, Civil Protection, Synths, and Advisors.`,

    "The Resistance": `A loose, covert rebel network of humans and Vortigaunts united by the goal of defeating the Combine and restoring freedom. Core members include Gordon Freeman, Alyx Vance, Eli Vance, Isaac Kleiner, and Barney Calhoun.`,

    "The Misfitted": `A small independent faction founded by a rogue Combine soldier. Unaffiliated with both the Combine and Resistance, neutrally hostile to both, and only self-interested in survival. They welcome refugees and ex-members of either side, and occasionally aid the Resistance.`,
};

// -- Key characters ------------------------------------------

const characters = {
    "Gordon Freeman": `Dr. Gordon Freeman — theoretical physicist, legendary resistance hero, and one of the key leaders in the war against the Combine. Indirectly caused the Resonance Cascade at Black Mesa that led to the alien invasion. Also known as Anticitizen One and One Free Man.`,

    "Dr. Wallace Breen": `Earth's Administrator. Former Black Mesa director who negotiated Earth's surrender and ended the Seven Hour War. Rules from the Citadel in City 17. Spreads Combine propaganda via Breencasts. Holds no real power — takes orders from the Advisors.`,

    "Alyx Vance": `Daughter of Eli Vance. Key Resistance operative. Equipped with Gravity Gloves (built by Russell) that allow her to pull objects to hand. Her robot companion Dog was built by her father to protect her.`,

    "Eli Vance": `Senior Resistance scientist. Established Black Mesa East. Pioneered teleportation technology. Lost a leg to a Bullsquid attack. Later captured and killed by a Combine Advisor.`,

    "Dr. Isaac Kleiner": `Absent-minded genius scientist. Prolific author on teleportation and interdimensional travel. Runs a hidden lab in City 17. Keeps a debeaked Headcrab named Lamarr as a pet. Key Resistance science team member.`,

    "Barney Calhoun": `Former Black Mesa security guard working undercover in Civil Protection. Real loyalty is with the Resistance. Sarcastic, witty, and capable. Appointed de-facto field commander of the City 17 rebellion.`,

    "Dr. Judith Mossman": `Scientist and triple agent. Personal assistant to Dr. Breen and spy for the Combine, while secretly also aiding the Resistance. Discovered the Borealis project. Complicated history with Gordon Freeman and the Vance family.`,

    "Dr. Arne Magnusson": `Leader of White Forest. Egotistical, impatient, and verbose, but deeply dedicated to the Resistance. Former Black Mesa Science Team member. Leads research on portals and rocketry.`,

    "Father Grigori": `The only known surviving occupant of Ravenholm. Mentally unstable but friendly priest. Bald, portly, dresses in traditional embroidered clothing and red Converse sneakers covered in Headcrab ooze.`,

    "G-Man": `Enigmatic inter-dimensional bureaucrat with reality-bending powers. Identity and motives unknown. Seen as a threat by the Combine. Periodically aids or hinders Gordon Freeman. Was imprisoned in the Vault.`,

    "Colonel Odessa Cubbage": `Resistance leader at New Little Odessa on the Coast. Likely British. Appointed colonel after the Seven Hour War. Competent if unorthodox military leader.`,

    "Russell": `Prominent Resistance member who aided Alyx Vance. Creator of the Gravity Gloves. Expert hacker and decryptor who downloaded most of the internet before the Combine invasion. Upbeat and wise-cracking.`,

    "The Fisherman": `Unnamed sole remaining inhabitant of Saint Olga on the Coast. Defensive of what remains of Earth's original species. Status with the Resistance is unclear.`,
};

// -- Combine military units ----------------------------------

const combineUnits = {
    "Overwatch Soldier": `Transhuman infantry of the Combine Overwatch. Humans who have undergone extensive cybernetic modification — brain, chest surgery, mechanical implants — plus mental reprogramming. Armed with MP7s, SPAS-12s, or AR2 Pulse Rifles and grenades. Operate in squads of 4-6. Fearless, never retreat, will fight to the last man. Use blitzkrieg tactics: flanking, grenade suppression, cover fire. Unarmed combat capable. Also serve as Hunter-Chopper pilots.`,

    "Civil Protection": `Human law enforcement in Combine-controlled cities. Ordinary human volunteers — no cybernetic modifications. Police cities for anti-civil activity, conduct raids, and maintain citizen fear. Armed with Stun Batons and USP Match pistols. Motivated by extra food, better conditions, or genuine sympathy with the Combine.`,

    "Overwatch Elite": `Specialized, highly ranked Overwatch Soldiers. Act as commanders. Reserved for critical missions: defending the Citadel, operating the Citadel Core, protecting Breen and the Advisors, and eliminating high-priority targets. Deadliest forces in the Overwatch.`,

    "Combine Assassin": `Slimmer, faster variant of the Overwatch Elite. Uses two automatic pistols and extensive melee combat. Performs flips, rolls, and acrobatic maneuvers aided by heel springs. Almost no armor for maximum speed. Higher rank than standard Elites.`,

    "Stalker": `Humans who dissented against the Combine and were subjected to extreme surgical alteration — both physical and mental. Now mindless servants operating Combine machinery and guarding the Citadel core.`,

    "Overwatch Commando": `Special Combine forces for hazardous situations involving dangerous environments and unconventional enemies. Stationed in the Quarantine Zone. Comprises four unit types: Grunt, Ordinal, Charger (Wallhammer), and Suppressor (APF).`,

    "Combine Grunt": `Lowest-ranked Overwatch Commando unit. Wear white hazmat-type bodysuits with light armor. Armed with Pulse SMGs. Work in squads of 2-3 under an Ordinal. Tend to show more personality than standard soldiers — expressing disgust at zombies and headcrabs. Faces are disfigured beneath their masks.`,

    "Combine Ordinal": `Commanding officers of Overwatch Commando forces in the Quarantine Zone. Visually similar to standard Overwatch Soldiers but in dark blue heavy fatigues. Deploy Manhacks to flush enemies from cover. Carry the IR1 pulse rifle. Killing an Ordinal disorganizes their squad.`,

    "Combine Charger": `Heavy Overwatch Commando unit (also called Wallhammer). Much larger than standard soldiers, with heavy padding and a shield. Rushes targets to force them into the open. Raises shield when shot, making them temporarily invulnerable but unable to fire. Can emit a blinding flash from their shield at close range.`,

    "Combine Suppressor": `Heavy weapons Overwatch Commando unit (also called APF). Stays at distance and provides suppressing fire with the Pulse Minigun. Extremely hard to kill. Vulnerable only during reloads and brief pauses between minigun bursts.`,

    "Cremator": `10-foot tall Combine janitor. Removes corpses from city streets, clears wildlife from incoming trains, and patrols the Wasteland. Equipped with an Immolator (green plasma thrower that disintegrates organic matter). Constantly breathes heavily, audible at a distance. Wears a long dark green robe.`,

    "Advisor": `Larvae-like species known as Shu'ulathoi by the Vortigaunts. The ruling class of the Combine. Possess powerful telepathic and telekinetic abilities — can immobilize multiple humans, levitate, and extract nutrients or information via a tongue-like appendage driven through the neck. Physically vulnerable. Lived in pods within the Citadel during Earth occupation.`,
};

// -- Synths --------------------------------------------------

const synths = {
    "Gunship": `Large autonomous Combine air assault unit. Armed with a heavy pulse cannon and ventral warp cannon. Highly accurate and maneuverable. Prioritizes shooting down incoming rockets over attacking targets. Often deployed in pairs. Only damaged by explosives like the RPG.`,

    "Strider": `Massive three-legged arthropod Synth. The Combine's main heavy ground assault unit. Armed with a pulse minigun and warp cannon. Highly maneuverable despite size — can crouch and sprint through tunnels. Strong enough to kick vehicles and impale targets with their legs.`,

    "Hunter": `Smaller, faster escort Synth. Primarily escorts Striders. Armed with fléchette launchers — slow-moving projectiles with splash damage. Can charge enemies as a battering ram. Uses leading and walking fire tactics. More agile than Striders but less armored.`,

    "Hunter-Chopper": `Combine rotorcraft adapted from human technology. Hunts refugees and high-priority targets. Tracks targets through terrain using possible infrared detection. Fires bursts of pulse projectiles and drops timed mines against fast-moving vehicles. Also capable as an assault vehicle.`,

    "Dropship": `Unarmed Combine transport Synth. Deploys soldiers, APCs, and Striders by air. The containers it carries sport a mounted pulse turret on the front.`,

    "APC": `Combine armored transport. Used to deploy Civil Protection teams in urban areas and patrol isolated regions. Armed with guided rocket launchers and a mounted automatic pulse weapon. Can serve as an electrical generator.`,
};

// -- Creatures -----------------------------------------------

const creatures = {
    "Headcrab": `Parasitic species. Leaps onto a humanoid host's face, drills into the skull, and takes over the body through an unknown biological process. The host undergoes physical changes and becomes a Zombie (Necrotic). Can be tamed by debeaking — removing the beak prevents them from infecting hosts.`,

    "Zombie": `Result of a Headcrab infecting a human host. Retains some consciousness — often heard crying for help. Attacks with claw swipes or by throwing objects. Does not respond to fire. Some found sleeping and will rise if approached.`,

    "Gonome": `Advanced form of Headcrab Zombie. Develops after extended survival or specific conditions. Grows in mass, develops a functional vertical maw in the chest cavity, and gains the ability to spit organic projectiles. Behavior similar to a Bullsquid.`,

    "Antlion": `Large voracious insectoid species. Live underground in extensive tunnel networks carved with acidic spit. Multiple castes similar to ants. Can be controlled using Pheropods harvested from Antlion Guards.`,

    "Antlion Guard": `Large, robust Antlion variant (8.6 feet tall). Guards nest perimeters. Attacks by headbutting and charging. Can fling nearby objects with great velocity. Controls lesser Antlions through pheromone secretion via pheropods. Accompanied by Antlion soldiers. Vulnerable to ranged attacks — struggles to turn quickly.`,

    "Barnacle": `Ceiling-dwelling creatures. Drop a sticky tongue to catch prey passing below. Can kill and digest a human in seconds. Never move from their attachment point. Occur in groups or colonies.`,

    "Vortigaunt": `Sapient alien species, formerly enslaved by the Nihilanth on Xen. Now allied with the human Resistance. Can generate electricity, recharge devices, power the HEV Suit, and perform tissue regeneration (in groups). Communicate via 'flux shifting'. Speak archaic English when communicating with humans. Connected to the Vortessence — a binding life-force fabric of the universe.`,

    "Manhack": `Small anti-personnel device with razor-sharp propeller blades. Programmed with minimal self-preservation. Deployed in groups of 4+. Especially deadly in confined spaces. Can be carried and deployed by Civil Protection officers and soldiers.`,

    "Rollermine": `Electrically charged spherical Combine device. Buries in soft ground and waits for targets. Rolls toward enemies and electrocutes them. Can magnetically clamp to vehicles. Can be reprogrammed with Gravity Gun manipulation to attack Combine instead.`,

    "Houndeye": `Tripedal Xen creature. Timid alone but dangerous in packs of 3 or more — emit destructive harmonic sonic shockwaves capable of causing internal bleeding. Communicate via high-pitched sounds. Carnivorous or omnivorous. If a squad leader is killed, the entire pack is weakened.`,

    "Bullsquid": `Aggressive bipedal Xen creature. Attacks with tooth mauling, spinning tail strikes, and long-range toxic spit. Very territorial — attacks other creatures and its own species. Viciously hunts Headcrabs but not Houndeyes. Can survive in toxic environments. A Bullsquid attack cost Eli Vance his leg.`,

    "Jeff": `Humanoid creature — the corpse of a Combine Hazmat Worker infected by a Xen parasitic fungus. Completely blind, relying entirely on hearing. Hostile to everything. Attacks by vomiting toxic/acidic fluid. Emits spore clouds that trigger coughing and reveal the player's position. Completely invincible. Can pass through Combine force fields.`,

    "Reviver": `Small Xen creature (also called Lightning Dog). Slightly larger than a Headcrab. Spits electrically charged liquid that can cause power failures. Can reanimate corpses and control them as electric zombies. Extremely resilient. When killed, drops an electric orb usable in place of Combine batteries.`,
};

// -- Locations -----------------------------------------------

const locations = {
    "city17":       "City 17",
    "citadel":      "The Citadel",
    "canals":       "The Canals",
    "ravenholm":    "Ravenholm",
    "coast":        "The Coast",
    "highway17":    "Highway 17",
    "novprospekt":  "Nova Prospekt",
    "blackmesaeast":"Black Mesa East",
    "whiteforest":  "White Forest",
    "quarantine":   "The Quarantine Zone",
    "nexus":        "Overwatch Nexus",
    "xen":          "Xen",
    "wasteland":    "The Wasteland",
};

// Which creature/unit types are commonly found at each location
const locationThreats = {
    "city17":       ["Overwatch Soldier", "Civil Protection", "Manhack", "Rollermine", "Headcrab", "Zombie"],
    "citadel":      ["Overwatch Soldier", "Overwatch Elite", "Stalker", "Advisor"],
    "canals":       ["Civil Protection", "Manhack", "Headcrab", "Zombie", "Bullsquid"],
    "ravenholm":    ["Headcrab", "Zombie", "Gonome", "Barnacle"],
    "coast":        ["Overwatch Soldier", "Hunter-Chopper", "Antlion", "Antlion Guard", "Rollermine"],
    "highway17":    ["Overwatch Soldier", "Hunter-Chopper", "Antlion", "Rollermine"],
    "novprospekt":  ["Overwatch Soldier", "Overwatch Elite", "Antlion", "Antlion Guard"],
    "blackmesaeast":["Vortigaunt"],
    "whiteforest":  ["Overwatch Soldier", "Strider", "Hunter"],
    "quarantine":   ["Overwatch Commando", "Combine Grunt", "Combine Ordinal", "Combine Charger", "Combine Suppressor", "Jeff", "Reviver", "Headcrab", "Zombie"],
    "nexus":        ["Overwatch Soldier", "Overwatch Elite"],
    "xen":          ["Vortigaunt", "Houndeye", "Bullsquid", "Barnacle"],
    "wasteland":    ["Overwatch Soldier", "Antlion", "Headcrab", "Zombie", "Cremator"],
};

// -- Weapons -------------------------------------------------

const weapons = {
    "Resistance": {
        "USP Match":        "Semi-automatic handgun. Standard Civil Protection sidearm. Reliable, accurate, large magazine. Best used against 1-2 targets with headshots.",
        "Colt Python":      "Powerful .357 revolver. 6 rounds, slow reload, near-perfect accuracy. Best used as a precision weapon despite being a handgun. Ammo is rare.",
        "MP7":              "Compact fully automatic SMG (SMG1). Primary fire: high rate of fire, poor accuracy. Secondary fire: contact grenade launcher. Used by both Combine and Resistance. Best at short range.",
        "SPAS-12":          "Pump-action shotgun. Primary: medium spread buckshot. Alternate: double pellets, wider spread, uses 2 shells. Reloaded one shell at a time.",
        "Crossbow":         "Long-range sniper weapon using superheated rebar bolts. Ruthlessly effective at range, difficult in close quarters. Bolts affected by gravity over distance. Very rare.",
        "RPG":              "Laser-guided rocket launcher. Primary weapon against Gunships, Striders, Dropships, Hunter-Choppers, and APCs. Only 3 rockets carried at once. Ammo is rare.",
        "Gravity Gun":      "Zero Point Energy Field Manipulator. Primary: punts objects with force. Secondary: picks up and holds lighter objects. Effectively infinite ammo — uses physics objects as projectiles. When supercharged by the Citadel's Confiscation Field, gains ability to manipulate organic matter and massively increased power.",
        "Gravity Gloves":   "Built by Russell. Allows Alyx to pull nearby objects to hand. Shows health and ammo info on the left glove display. Cannot manipulate organic matter normally.",
    },
    "Combine": {
        "AR2 (OSIPR)":      "Overwatch Standard Issue Pulse Rifle. Dark energy-powered assault rifle. Standard issue for Overwatch Soldiers and Elites. Secondary fire: Energy Ball that vaporizes targets.",
        "Overwatch Sniper Rifle": "Slow-firing pulse rifle with blue laser sight. Single shot kills almost anything. The laser sight gives away the shooter's position.",
        "Stun Baton":       "Electrified baton used by Civil Protection. Multiple power settings — street level stuns briefly; raid setting can incapacitate in one hit.",
        "Pulse SMG":        "Dark energy SMG used by Combine Grunts. Gene-coded — cannot be used by non-Combine personnel.",
        "Heavy Shotgun":    "Primary weapon of Combine Chargers. Gene-coded — cannot be used by non-Combine. Devastating at close range.",
        "Pulse Minigun":    "Dark energy minigun used by Combine Suppressors. Needs to spin up before firing.",
        "Emplacement Gun":  "Mounted Combine pulse gun. Infinite ammo. Used to suppress groups. Can be captured and used by Rebels.",
        "Immolator":        "Cremator's green plasma thrower. Disintegrates organic matter on contact.",
    },
};

// -- Key items -----------------------------------------------

const keyItems = {
    "Pheropod":     "Glandular sac harvested from dead Antlion Guards. Prevents regular Antlions from attacking the holder. Throwing it at a target directs Antlions to attack it. Squeezing it summons nearby Antlions.",
    "Resin":        "Raw material used by Combine Fabricators to create weapon modifications.",
    "Xen Crystal":  "Crystalline exotic matter from Xen. Contains negative mass. Used in teleportation technology. A highly pure sample (GG-3883) triggered the Black Mesa Incident.",
};

// -- Key lore ------------------------------------------------

const worldLore = {
    "Seven Hour War":   "A brief but decisive conflict between the Combine and Earth's governments. Led to massive human casualties and planetary surrender in under seven hours, followed by Combine occupation.",
    "Suppression Field":"The Combine's reproductive suppression field. Prohibits the formation of protein chains needed for embryonic development, bringing the human birth rate to zero. Ensures the current generation is the last.",
    "Anti-Citizen":     "Combine designation for a person deemed a threat to their control. Each Anticitizen is ranked by danger level in descending order.",
    "Overwatch Voice":  "An AI with a feminine voice that broadcasts orders to Overwatch units and Citizens via radio and PA systems. Uses medical-inspired Newspeak to describe resistance activity as bacterial infection. Effectively serves as a harbinger of death to civilians.",
    "Memory Replacement": "Psycho-engineering process used to transform humans into Overwatch Soldiers. Carried out at Nova Prospekt and the Citadel. Ensures soldiers cannot rebel for emotional reasons.",
    "Resonance Cascade":"The Black Mesa Incident — triggered by a pure Xen crystal sample analyzed in an Anti-Mass Spectrometer. Created a dimensional rift between Earth and Xen. Led to the Portal Storm and the Combine's discovery of Earth.",
    "Vortessence":      "The Vortigaunts' name for the binding life-force fabric of the universe, made of 'vortal cords.' Enables their electricity manipulation, telekinesis, temporal awareness, and telepathy. Amplified by Antlion larvae extract.",
    "Borealis":         "A former Aperture Science icebreaker that vanished with crew and part of its dry dock. Believed to contain powerful portal/teleportation technology the Combine desperately wants — as it could allow them to reconnect with their Overworld and flood Earth with their full armies.",
};

// -- Module --------------------------------------------------

let _hudState = null;

export default {
    name: "Half-Life 2: World",
    version: "1.0.0",

    init() {
        return {
            location:       "city17",
            faction:        "neutral",      // "resistance", "combine", "misfitted", "neutral"
            alertLevel:     0,              // 0-3: 0=undetected, 1=suspicious, 2=alert, 3=manhunt
            inventory:      [],             // key items: "Gravity Gun", "Pheropod", "RPG", etc.
            knownThreats:   [],             // threats confirmed present in current area
        };
    },

    processTurn({ state, systemText, messages, charNameHint, personaName } = {}) {
        if (!state || !state.location) state = this.init();

        const locName = locations[state.location] || state.location;
        const threats = locationThreats[state.location] || [];

        const alertLabels = ["Undetected", "Suspicious", "Alert", "Manhunt"];
        const alertColors = ["green", "yellow", "orange", "red"];
        const alertLabel = alertLabels[state.alertLevel] || "Unknown";

        // Build relevant threats block
        const threatBlock = threats.map(t => {
            const entry = combineUnits[t] || synths[t] || creatures[t];
            return entry ? `  [${t}]\n  ${entry}` : null;
        }).filter(Boolean).join("\n\n");

        // Build inventory block
        const invBlock = state.inventory.length > 0
            ? state.inventory.map(item => {
                const entry = keyItems[item] || weapons.Resistance[item] || weapons.Combine[item] || "";
                return `  - ${item}${entry ? `: ${entry.slice(0, 80)}...` : ""}`;
            }).join("\n")
            : "  (Nothing notable)";

        // Faction context
        const factionBlock = state.faction !== "neutral"
            ? `\nFaction: ${state.faction.toUpperCase()}\n${factions[state.faction] || ""}`
            : "";

        const header = `[HALF-LIFE 2: WORLD MODULE]
Setting: Post-Seven Hour War Earth under Combine occupation.
Current Location: ${locName} | Combine Alert: ${alertLabel} (${state.alertLevel}/3)${factionBlock}

=== WORLD CONTEXT ===
${worldLore["Seven Hour War"]}
Suppression Field: ${worldLore["Suppression Field"]}
Overwatch Voice: ${worldLore["Overwatch Voice"]}

=== THREATS IN THIS AREA (${locName}) ===
${threatBlock || "No notable threats catalogued for this area."}

=== PLAYER INVENTORY (Key Items) ===
${invBlock}

=== FACTIONS ===
${Object.entries(factions).map(([n, d]) => `  [${n}]\n  ${d}`).join("\n\n")}

=== INSTRUCTIONS ===
Embed JSON events in responses when the player moves, alert level changes, faction changes, or inventory changes.
Use this exact format: \`\`\`game { "type": "event_type", ... } \`\`\`

Supported events:
1. Move:          \`\`\`game { "type": "move", "location": "ravenholm" } \`\`\`
   Valid locations: ${Object.keys(locations).join(", ")}
2. Alert change:  \`\`\`game { "type": "alert", "level": 2 } \`\`\` (0=undetected, 1=suspicious, 2=alert, 3=manhunt)
3. Faction:       \`\`\`game { "type": "faction", "faction": "resistance" } \`\`\`
   Valid factions: resistance, combine, misfitted, neutral
4. Add item:      \`\`\`game { "type": "item_add", "item": "Gravity Gun" } \`\`\`
5. Remove item:   \`\`\`game { "type": "item_remove", "item": "Pheropod" } \`\`\`
`;

        return { header, state };
    },

    handleResponse({ assistantText, state } = {}) {
        if (!state || !state.location) state = this.init();
        let cleanedText = assistantText || "";
        const events = [];

        const regex = /```game\s*({[\s\S]*?})\s*```/g;
        cleanedText = cleanedText.replace(regex, (match, jsonStr) => {
            try { events.push(JSON.parse(jsonStr)); }
            catch (e) { console.error("Failed to parse HL2 event:", e); }
            return "";
        });

        for (const event of events) {
            if (event.type === "move" && locations[event.location]) {
                state.location = event.location;
                state.knownThreats = [];    // reset on location change
            } else if (event.type === "alert" && typeof event.level === "number") {
                state.alertLevel = Math.max(0, Math.min(3, event.level));
            } else if (event.type === "faction" && event.faction) {
                state.faction = event.faction;
            } else if (event.type === "item_add" && event.item) {
                if (!state.inventory.includes(event.item)) {
                    state.inventory.push(event.item);
                }
            } else if (event.type === "item_remove" && event.item) {
                state.inventory = state.inventory.filter(i => i !== event.item);
            }
        }

        return { state, cleanedText };
    },

    _getHudContent() {
        const state = _hudState;
        if (!state) return `<span style="color:#888;">Waiting for first turn...</span>`;

        const locName = locations[state.location] || state.location;
        const alertLabels = ["Undetected", "Suspicious", "Alert", "Manhunt"];
        const alertColors = ["#88ff99", "#ffdd88", "#ff9944", "#ff4444"];
        const alertLabel = alertLabels[state.alertLevel] || "Unknown";
        const alertColor = alertColors[state.alertLevel] || "#aaa";

        const factionColors = {
            resistance: "#88ff99",
            combine:    "#ff6666",
            misfitted:  "#ffaa44",
            neutral:    "#aaaaaa",
        };
        const factionColor = factionColors[state.faction] || "#aaa";

        return `
            <h3 style="margin-top:0; color:#ff6644;">Half-Life 2: World</h3>

            <div style="display:flex; gap:8px; margin-bottom:8px;">
                <div style="flex:1; background:rgba(255,102,68,0.1); border:1px solid #ff6644; border-radius:4px; padding:8px;">
                    <div style="color:#aaa; font-size:0.7em; text-transform:uppercase; letter-spacing:1px;">Location</div>
                    <div style="color:#fff; font-weight:bold; font-size:0.9em;">${locName}</div>
                </div>
                <div style="flex:1; background:rgba(255,102,68,0.1); border:1px solid #ff6644; border-radius:4px; padding:8px;">
                    <div style="color:#aaa; font-size:0.7em; text-transform:uppercase; letter-spacing:1px;">Faction</div>
                    <div style="color:${factionColor}; font-weight:bold; font-size:0.9em;">${state.faction}</div>
                </div>
            </div>

            <div style="background:rgba(255,102,68,0.1); border:1px solid #ff6644; border-radius:4px; padding:8px; margin-bottom:8px;">
                <div style="color:#aaa; font-size:0.7em; text-transform:uppercase; letter-spacing:1px;">Combine Alert</div>
                <div style="color:${alertColor}; font-weight:bold;">${alertLabel}</div>
                <div style="background:#333; border-radius:3px; height:6px; margin-top:4px;">
                    <div style="background:${alertColor}; width:${(state.alertLevel / 3) * 100}%; height:6px; border-radius:3px; transition: width 0.3s;"></div>
                </div>
            </div>

            <details>
                <summary style="cursor:pointer;"><strong>Threats in Area (${(locationThreats[state.location] || []).length})</strong></summary>
                <ul style="margin:6px 0 0 16px; padding:0; color:#ffaa88;">
                    ${(locationThreats[state.location] || []).map(t => `<li>${t}</li>`).join("") || "<li style='color:#888;'>None catalogued</li>"}
                </ul>
            </details>

            ${state.inventory.length > 0 ? `
            <details style="margin-top:6px;">
                <summary style="cursor:pointer;"><strong>Inventory (${state.inventory.length})</strong></summary>
                <ul style="margin:6px 0 0 16px; padding:0; color:#aaffcc;">
                    ${state.inventory.map(i => `<li>${i}</li>`).join("")}
                </ul>
            </details>` : `<p style="color:#888; margin:6px 0 0 0; font-size:0.9em;">No key items.</p>`}
        `;
    },

    getSettingsHtml(config) {
        return `<div id="hl2-hud" style="font-family:sans-serif; padding:10px; background:rgba(0,0,0,0.5); border:1px solid #444; border-radius:5px;">${this._getHudContent()}</div>`;
    },

    updateHud(state, config) {
        _hudState = state;
        const el = document.getElementById("hl2-hud");
        if (el) el.innerHTML = this._getHudContent();
    },
};
