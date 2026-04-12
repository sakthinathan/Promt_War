/**
 * GameDay Sync - Load Simulation Engine
 * Artificially saturates venue queues to demonstrate stress-testing and triage alerts.
 */

// Global simulation daemon intervals
let simulationIntervals = [];

/**
 * Triggers a massive algorithmic crowd spike.
 * Pushes queues past the 20-minute threshold to explicitly trigger
 * Vertex AI and Staff Dashboard triage warnings.
 */
function triggerStressTest(stadiumState, io) {
    if (simulationIntervals.length > 0) return; // Simulation already running

    console.log("🔥 [SYSTEM MESSAGE] Initiating GameDay Stress Simulation...");
    console.log("🔥 Spawning 15,000 synthetic attendees into the environment...");

    // Set Game to Innings Break explicitly to authorize massive surges
    stadiumState.game.isInningsBreak = true;

    // Immediately spike MAC-B properties to Critical levels
    if(stadiumState.food && stadiumState.food.macb) {
        stadiumState.food.macb.waitTime = 34; // Critical
        stadiumState.food.macb.currentCrowd = 120;
    }
    if(stadiumState.restroom && stadiumState.restroom.macb) {
        stadiumState.restroom.macb.waitTime = 22; // Critical
        stadiumState.restroom.macb.currentCrowd = 85; 
    }

    // Launch a daemon to randomly mutate values aggressively every 5 seconds
    const interval = setInterval(() => {
        // Randomly target zones
        const targetKeys = ['restroom', 'food'];
        
        targetKeys.forEach(tKey => {
            const zones = Object.keys(stadiumState[tKey]);
            zones.forEach(zone => {
                // Random flux - drastically increase queues
                const surge = Math.floor(Math.random() * 8); 
                stadiumState[tKey][zone].waitTime += surge;
                stadiumState[tKey][zone].currentCrowd += (surge * 3);

                // Add a ceiling limit so it doesn't break limits
                if(stadiumState[tKey][zone].waitTime > 45) {
                    stadiumState[tKey][zone].waitTime = 45;
                }
            });
        });

        // Broadcast to clients aggressively
        io.emit('stadiumUpdate', stadiumState);
        io.to('admin').emit('adminGridUpdate', stadiumState); // Send explicitly to staff dashboard

    }, 3000);

    simulationIntervals.push(interval);
    
    // Broadcast initial strike
    io.emit('stadiumUpdate', stadiumState);
}

/**
 * Gracefully shuts down the simulation framework
 */
function haltStressTest(stadiumState, io) {
    console.log("🛑 [SYSTEM MESSAGE] Halting Simulation Variables...");
    
    simulationIntervals.forEach(clearInterval);
    simulationIntervals = [];

    // Reset game logic
    stadiumState.game.isInningsBreak = false;

    // Return to normative traffic parameters gracefully
    ['restroom', 'food'].forEach(tKey => {
        const zones = Object.keys(stadiumState[tKey]);
        zones.forEach(zone => {
            stadiumState[tKey][zone].waitTime = Math.floor(Math.random() * 7) + 3; // 3 to 10 min
            stadiumState[tKey][zone].currentCrowd = Math.floor(Math.random() * 20) + 5;
        });
    });

    io.emit('stadiumUpdate', stadiumState);
}

module.exports = {
    triggerStressTest,
    haltStressTest
};
