/**
 * GameDay Sync - Enhanced Client-side Application
 * Real-time stadium crowd management with AI chatbot and analytics dashboard
 */

// ============================================================================
// SOCKET.IO CONNECTION
// ============================================================================

const socket = io();

socket.on('stadiumUpdate', (data) => {
    updateStadiumMap(data);
    updateDashboard(data);
});

socket.on('orderConfirmed', (order) => {
    showOrderConfirmation(order);
});

socket.on('connect', () => {
    console.log('Connected to stadium system');
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = '🟢 Connected';
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from stadium system');
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = '🔴 Disconnected';
    }
});

// ============================================================================
// GLOBAL STATE
// ============================================================================

const appState = {
    currentSector: null,
    cartItems: [],
    stadiumData: {},
    selectedSeat: null,
};

// ============================================================================
// GOOGLE MAPS INTEGRATION
// ============================================================================

let mapInstance = null;
const mapMarkers = {};

const chepaukPings = {
    'restroom-pavilion': { lat: 13.0631, lng: 80.2789 },
    'restroom-cstand': { lat: 13.0625, lng: 80.2798 },
    'food-pavilion': { lat: 13.0633, lng: 80.2791 },
    'food-cstand': { lat: 13.0621, lng: 80.2795 },
    'restroom-jstand': { lat: 13.0618, lng: 80.2785 },
    'restroom-macb': { lat: 13.0635, lng: 80.2801 },
    'food-jstand': { lat: 13.0615, lng: 80.2788 },
    'food-macb': { lat: 13.0638, lng: 80.2795 }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.mapsKey) {
            window.initMap = function() {
                const mapContainer = document.getElementById('google-map-container');
                if(!mapContainer) return;

                mapInstance = new google.maps.Map(mapContainer, {
                    zoom: 18,
                    center: { lat: 13.0628, lng: 80.2793 },
                    mapTypeId: 'satellite',
                    disableDefaultUI: true,
                    zoomControl: true,
                });
            };
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${data.mapsKey}&callback=initMap`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
    } catch(e) {
        console.error('Google Maps Load Error:', e);
    }

    // Launch Environmental Triggers
    pollAirQuality();
    setInterval(pollAirQuality, 300000); // 5 minutes refresh
});

/**
 * Pings backend proxy to retrieve Google Air Quality API Payload
 */
async function pollAirQuality() {
    try {
        const res = await fetch('/api/air-quality');
        if(!res.ok) throw new Error('Network error');
        
        const data = await res.json();
        const aqiValEl = document.getElementById('aqi-value');
        
        if (data.indexes && data.indexes.length > 0) {
            const index = data.indexes[0];
            const color = index.color ? `rgb(${index.color.red||0}, ${index.color.green||0}, ${index.color.blue||0})` : '#10b981';
            
            if(aqiValEl) {
                aqiValEl.textContent = `AQI: ${index.aqiDisplay}`;
                aqiValEl.style.color = color;
            }
        }
    } catch(e) {
        console.error("AQI Telemetry failed", e);
    }
}

// ============================================================================
// TAB SWITCHING
// ============================================================================

/**
 * Switches between tabs (home, map, orders)
 * @param {string} tabName - Name of tab to switch to
 */
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all nav buttons
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const tabElement = document.getElementById(`${tabName}-tab`);
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Activate nav button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    announceToScreenReader(`Switched to ${tabName} tab`);
}

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

/**
 * Updates the home page dashboard with stadium analytics
 * @param {object} data - Stadium state from server
 */
function updateDashboard(data) {
    appState.stadiumData = data;
    
    // Calculate average wait times
    const allWaitTimes = [];
    
    if (data.restroom) {
        Object.values(data.restroom).forEach(sector => {
            allWaitTimes.push(sector.waitTime);
        });
    }
    
    if (data.food) {
        Object.values(data.food).forEach(sector => {
            allWaitTimes.push(sector.waitTime);
        });
    }
    
    const avgWaitTime = allWaitTimes.length > 0
        ? Math.round(allWaitTimes.reduce((a, b) => a + b, 0) / allWaitTimes.length)
        : 0;
    
    // Update average wait time
    const avgWaitElement = document.getElementById('avg-wait-time');
    if (avgWaitElement) {
        avgWaitElement.textContent = `${avgWaitTime} min`;
    }
    
    // Calculate total occupancy
    let totalCrowd = 0;
    let totalCapacity = 0;
    
    if (data.restroom) {
        Object.values(data.restroom).forEach(sector => {
            totalCrowd += sector.currentCrowd;
            totalCapacity += sector.capacity;
        });
    }
    
    if (data.food) {
        Object.values(data.food).forEach(sector => {
            totalCrowd += sector.currentCrowd;
            totalCapacity += sector.capacity;
        });
    }
    
    const occupancyPercent = totalCapacity > 0
        ? Math.round((totalCrowd / totalCapacity) * 100)
        : 0;
    
    const occupancyElement = document.getElementById('occupancy-percent');
    if (occupancyElement) {
        occupancyElement.textContent = `${occupancyPercent}%`;
    }
    
    // Find busiest sector
    const allSectors = [
        ...(data.restroom ? Object.values(data.restroom) : []),
        ...(data.food ? Object.values(data.food) : [])
    ];
    
    const busiestSector = allSectors.reduce((max, current) =>
        (current.waitTime || 0) > (max.waitTime || 0) ? current : max
    , allSectors[0]);
    
    const busiestElement = document.getElementById('busiest-sector');
    if (busiestElement && busiestSector) {
        busiestElement.textContent = `${busiestSector.name} (${busiestSector.waitTime}m)`;
    }
    
    // Update game status
    if (data.game) {
        const quarterElement = document.getElementById('game-quarter');
        const timeElement = document.getElementById('game-time');
        
        if (quarterElement) {
            quarterElement.textContent = data.game.isInningsBreak ? 'INNINGS BREAK' : `Innings ${data.game.innings}`;
        }
        
        if (timeElement) {
            timeElement.textContent = `${data.game.overs}.0 Overs`;
        }
    }
    
    // Update queue summary
    updateQueueSummary(data);
    
    // Update recommendations
    updateRecommendations(data);
    
    // Update chatbot context
    if (typeof updateChatbotStadiumData === 'function') {
        updateChatbotStadiumData(data);
    }
}

/**
 * Updates queue summary display
 * @param {object} data - Stadium state
 */
function updateQueueSummary(data) {
    const queueSummary = document.getElementById('queue-summary');
    if (!queueSummary) return;
    
    let html = '<div class="queue-grid" style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">';
    
    const tileStyle = `
        text-align: left; 
        background: var(--surface); 
        border: 2px solid var(--border); 
        padding: 1rem; 
        border-radius: 8px; 
        cursor: pointer; 
        width: 100%; 
        transition: transform 0.2s, border-color 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--text-primary);
    `;

    // Add restrooms
    if (data.restroom) {
        html += '<div style="grid-column: 1 / -1;"><h4 style="margin: 0 0 0.5rem 0; color: #10b981;">🚻 Restroom Zones</h4></div>';
        Object.entries(data.restroom).forEach(([key, sector]) => {
            const statusColor = sector.waitTime > 15 ? '#ef4444' : sector.waitTime > 10 ? '#f59e0b' : '#10b981';
            html += `<button 
                onclick="switchTab('map'); window.handleSectorSelection('restroom-${key}')" 
                style="${tileStyle}"
                onmouseover="this.style.borderColor='${statusColor}'; this.style.transform='translateY(-2px)';" 
                onmouseout="this.style.borderColor='var(--border)'; this.style.transform='translateY(0)';"
            >
                <div style="display: flex; flex-direction: column;">
                    <strong style="font-size: 1.1rem;">${sector.name}</strong>
                    <span style="font-size: 0.9rem; color: var(--text-secondary);">Click to locate on Map</span>
                </div>
                <div style="background: ${statusColor}20; border: 2px solid ${statusColor}; color: ${statusColor}; padding: 0.5rem; border-radius: 8px; font-weight: bold; text-align: center; min-width: 60px;">
                    ${sector.waitTime}m
                </div>
            </button>`;
        });
    }
    
    // Add food courts
    if (data.food) {
        html += '<div style="grid-column: 1 / -1; margin-top: 1rem;"><h4 style="margin: 0 0 0.5rem 0; color: #FDB913;">🍔 Food Courts</h4></div>';
        Object.entries(data.food).forEach(([key, sector]) => {
            const statusColor = sector.waitTime > 15 ? '#ef4444' : sector.waitTime > 10 ? '#f59e0b' : '#10b981';
            html += `<button 
                onclick="switchTab('map'); window.handleSectorSelection('food-${key}')" 
                style="${tileStyle}"
                onmouseover="this.style.borderColor='${statusColor}'; this.style.transform='translateY(-2px)';" 
                onmouseout="this.style.borderColor='var(--border)'; this.style.transform='translateY(0)';"
            >
                <div style="display: flex; flex-direction: column;">
                    <strong style="font-size: 1.1rem;">${sector.name}</strong>
                    <span style="font-size: 0.9rem; color: var(--text-secondary);">Click to locate on Map</span>
                </div>
                <div style="background: ${statusColor}20; border: 2px solid ${statusColor}; color: ${statusColor}; padding: 0.5rem; border-radius: 8px; font-weight: bold; text-align: center; min-width: 60px;">
                    ${sector.waitTime}m
                </div>
            </button>`;
        });
    }
    
    html += '</div>';
    queueSummary.innerHTML = html;
}

/**
 * Updates recommendations based on current data
 * @param {object} data - Stadium state
 */
function updateRecommendations(data) {
    const allSectors = [
        ...(data.restroom ? Object.values(data.restroom) : []),
        ...(data.food ? Object.values(data.food) : [])
    ];
    
    // Find shortest wait overall
    const shortestWait = allSectors.reduce((min, current) =>
        (current.waitTime || Infinity) < (min.waitTime || Infinity) ? current : min
    );
    
    // Find shortest restroom
    const restrooms = data.restroom ? Object.values(data.restroom) : [];
    const shortestRestroom = restrooms.reduce((min, current) =>
        (current.waitTime || Infinity) < (min.waitTime || Infinity) ? current : min
    );
    
    // Find least busy food court
    const foodCourts = data.food ? Object.values(data.food) : [];
    const leastBusyFood = foodCourts.reduce((min, current) =>
        (current.waitTime || Infinity) < (min.waitTime || Infinity) ? current : min
    );
    
    if (document.getElementById('rec-shortest')) {
        document.getElementById('rec-shortest').textContent = 
            `${shortestWait?.name || 'Loading...'} (${shortestWait?.waitTime || '?'} min)`;
    }
    
    if (document.getElementById('rec-best-food') && leastBusyFood) {
        document.getElementById('rec-best-food').textContent = 
            `${leastBusyFood.name} (${leastBusyFood.waitTime} min)`;
    }
    
    if (document.getElementById('rec-quick-restroom') && shortestRestroom) {
        document.getElementById('rec-quick-restroom').textContent = 
            `${shortestRestroom.name} (${shortestRestroom.waitTime} min)`;
    }
}

// ============================================================================
// STADIUM MAP UPDATES
// ============================================================================

/**
 * Updates stadium SVG map with real-time queue data
 * @param {object} data - Stadium state
 */
function updateStadiumMap(data) {
    if (!mapInstance) return;

    if (data.restroom) {
        Object.entries(data.restroom).forEach(([key, sector]) => {
            updateGoogleMapMarker(`restroom-${key}`, sector);
        });
    }

    if (data.food) {
        Object.entries(data.food).forEach(([key, sector]) => {
            updateGoogleMapMarker(`food-${key}`, sector);
        });
    }

    if (data.game) {
        updateGameStatus(data.game);
    }
}

/**
 * Places or updates a visual marker hovering securely over satellite view
 */
function updateGoogleMapMarker(sectorId, sectorData) {
    if (!mapInstance) return;
    const location = chepaukPings[sectorId];
    if (!location) return;

    let color = '#10b981';
    if (sectorData.waitTime >= 20) { color = '#dc2626'; }
    else if (sectorData.waitTime >= 15) { color = '#f97316'; }
    else if (sectorData.waitTime >= 10) { color = '#eab308'; }

    // If marker doesn't exist, instantiate it
    if (!mapMarkers[sectorId]) {
        mapMarkers[sectorId] = new google.maps.Marker({
            position: location,
            map: mapInstance,
            title: sectorData.name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 3,
                strokeColor: '#ffffff'
            }
        });

        // Expose handle binding internally to map instance
        window.handleSectorSelection = handleSectorSelection;
        mapMarkers[sectorId].addListener('click', () => {
            window.handleSectorSelection(sectorId);
        });
    } else {
        // Update marker color if instantiated
        mapMarkers[sectorId].setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: color,
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: '#ffffff'
        });
    }
}

/**
 * Updates game status display
 * @param {object} gameData - Game state
 */
function updateGameStatus(gameData) {
    const statusDiv = document.getElementById('game-status');
    if (!statusDiv) return;

    if (gameData.isInningsBreak) {
        statusDiv.innerHTML = `
            <div class="game-status halftime">
                <h3>⏸️ INNINGS BREAK</h3>
                <p>High crowd alert!</p>
            </div>
        `;
    } else {
        statusDiv.innerHTML = `
            <div class="game-status in-game">
                <h3>Innings ${gameData.innings} - ${gameData.overs}.0 Overs</h3>
                <p>Match in progress</p>
            </div>
        `;
    }
}

// ============================================================================
// SECTOR SELECTION & DETAILS
// ============================================================================

/**
 * Handles sector selection
 * @param {string} sectorId - Sector ID
 */
function handleSectorSelection(sectorId) {
    appState.currentSector = sectorId;
    const [type, key] = sectorId.split('-');

    let sectorData;
    if (type === 'restroom' && appState.stadiumData.restroom) {
        sectorData = appState.stadiumData.restroom[key];
    } else if (type === 'food' && appState.stadiumData.food) {
        sectorData = appState.stadiumData.food[key];
    }

    if (sectorData) {
        showSectorDetails(sectorId, sectorData);
    }
}

/**
 * Shows sector details panel
 * @param {string} sectorId - Sector ID
 * @param {object} sectorData - Sector info
 */
function showSectorDetails(sectorId, sectorData) {
    const detailsPanel = document.getElementById('sector-details');
    if (!detailsPanel) return;

    const [type, _] = sectorId.split('-');
    const typeLabel = type === 'restroom' ? 'Restroom' : 'Food Court';

    detailsPanel.innerHTML = `
        <div class="details-header">
            <h3>${typeLabel}: ${sectorData.name}</h3>
            <button onclick="closeSectorDetails()" aria-label="Close details">✕</button>
        </div>
        <div class="details-content">
            <div class="detail-row">
                <span class="label">Current Wait Time:</span>
                <span class="value">${sectorData.waitTime} minutes</span>
            </div>
            <div class="detail-row">
                <span class="label">Current Crowd:</span>
                <span class="value">${Math.round(sectorData.currentCrowd)} people</span>
            </div>
            <div class="detail-row">
                <span class="label">Capacity:</span>
                <span class="value">${sectorData.capacity} people</span>
            </div>
            <div class="detail-row">
                <span class="label">Occupancy:</span>
                <span class="value">${Math.round((sectorData.currentCrowd / sectorData.capacity) * 100)}%</span>
            </div>
            
            <button onclick="window.drawRoute('${sectorId}')" class="btn active" style="width:100%; margin-top: 1.5rem; padding: 12px; background: #0081E9; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">🗺️ Navigate to Sector</button>
        </div>
    `;

    detailsPanel.style.display = 'block';
    document.querySelector('#map-tab').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Closes sector details
 */
function closeSectorDetails() {
    const detailsPanel = document.getElementById('sector-details');
    if (detailsPanel) {
        detailsPanel.style.display = 'none';
        if(currentPolyline) currentPolyline.setMap(null);
    }
}

// ============================================================================
// CONGESTION ROUTING (DIJKSTRA ALGORITHM)
// ============================================================================

let currentPolyline = null;

function calculateDijkstraRoute(startNode, endNode, stadiumData) {
    const graph = {
        'Gate_A': { 'Concourse_N': 5, 'Concourse_W': 6 },
        'Concourse_N': { 'Gate_A': 5, 'restroom-pavilion': 2, 'food-pavilion': 3, 'Concourse_E': 8 },
        'Concourse_S': { 'Gate_B': 4, 'restroom-jstand': 2, 'food-jstand': 3, 'Concourse_W': 7 },
        'Concourse_E': { 'food-cstand': 2, 'restroom-cstand': 3, 'Concourse_S': 6 },
        'Concourse_W': { 'food-macb': 2, 'restroom-macb': 3, 'Concourse_N': 6, 'Concourse_S': 7 },
        
        'restroom-pavilion': { 'Concourse_N': 2 },
        'food-pavilion': { 'Concourse_N': 3 },
        'restroom-jstand': { 'Concourse_S': 2 },
        'food-jstand': { 'Concourse_S': 3 },
        'food-cstand': { 'Concourse_E': 2 },
        'restroom-cstand': { 'Concourse_E': 3 },
        'food-macb': { 'Concourse_W': 2 },
        'restroom-macb': { 'Concourse_W': 3 },
        'Gate_B': { 'Concourse_S': 4 }
    };

    if(stadiumData) {
        Object.keys(stadiumData).forEach(type => {
            Object.entries(stadiumData[type] || {}).forEach(([id, payload]) => {
                const nodeStr = `${type}-${id}`;
                if(graph[nodeStr] && payload.waitTime > 15) {
                    for(let neighbor in graph) {
                        if(graph[neighbor][nodeStr]) {
                            graph[neighbor][nodeStr] += payload.waitTime; // Dynamic penalty!
                        }
                    }
                }
            });
        });
    }

    const distances = {};
    const previous = {};
    const queue = new Set(Object.keys(graph));

    for (let vertex of queue) {
        distances[vertex] = Infinity;
        previous[vertex] = null;
    }
    distances[startNode] = 0;

    while (queue.size > 0) {
        let minDistance = Infinity;
        let u = null;
        for (let vertex of queue) {
            if (distances[vertex] < minDistance) {
                minDistance = distances[vertex];
                u = vertex;
            }
        }
        if (u === null) break;
        queue.delete(u);

        if (u === endNode) break;

        for (let v in graph[u]) {
            let alt = distances[u] + graph[u][v];
            if (alt < distances[v] && queue.has(v)) {
                distances[v] = alt;
                previous[v] = u;
            }
        }
    }

    const path = [];
    let u = endNode;
    while (previous[u]) {
        path.unshift(u);
        u = previous[u];
    }
    if(path.length) path.unshift(startNode);
    return path;
}

window.drawRoute = function(targetSectorId) {
    if(!mapInstance) return;
    
    if(currentPolyline) {
        currentPolyline.setMap(null);
    }

    const coordPings = {
        'Gate_A': { lat: 13.0645, lng: 80.2790 },
        'Gate_B': { lat: 13.0610, lng: 80.2790 },
        'Concourse_N': { lat: 13.0633, lng: 80.2785 },
        'Concourse_S': { lat: 13.0618, lng: 80.2785 },
        'Concourse_E': { lat: 13.0625, lng: 80.2795 },
        'Concourse_W': { lat: 13.0635, lng: 80.2795 },
        ...chepaukPings
    };

    const optimalPathNodes = calculateDijkstraRoute('Gate_A', targetSectorId, appState.stadiumData);
    
    if(optimalPathNodes.length === 0) return;

    const pathCoordinates = optimalPathNodes.map(n => coordPings[n]).filter(Boolean);

    currentPolyline = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#0081E9',
        strokeOpacity: 1.0,
        strokeWeight: 6,
    });

    currentPolyline.setMap(mapInstance);
    
    // Auto query Gemini Assistant to describe the route!
    if(window.askChatbot) {
        const routeString = optimalPathNodes.join(' -> ');
        window.askChatbot(`Generate walking directions for this exact logical graph path: ${routeString}`);
    }
};

// ============================================================================
// CART & CHECKOUT
// ============================================================================

/**
 * Adds item to cart
 * @param {string} itemId - Item ID
 */
function addToCart(itemId) {
    appState.cartItems.push({ id: itemId, timestamp: Date.now() });
    updateCartDisplay();
    announceToScreenReader(`Item added to cart. Cart now has ${appState.cartItems.length} items.`);
}

/**
 * Updates cart display
 */
function updateCartDisplay() {
    const cartElement = document.getElementById('cart-count');
    if (cartElement) {
        cartElement.textContent = appState.cartItems.length;
    }
    
    const cartCountElement = document.getElementById('cart-items-count');
    if (cartCountElement) {
        cartCountElement.textContent = appState.cartItems.length;
        const deliveryTime = 5 + (appState.cartItems.length * 2);
        document.getElementById('delivery-time').textContent = `${deliveryTime} minutes`;
    }
}

/**
 * Calculates delivery time
 * @param {number} itemCount - Number of items
 * @returns {number} Delivery time in minutes
 */
function calculateDeliveryTime(itemCount) {
    return 5 + (itemCount * 2);
}

/**
 * Handles checkout submission
 */
async function handleCheckout() {
    if (appState.cartItems.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    const seatInput = document.getElementById('seat-number');
    const emailInput = document.getElementById('email');

    const seatNumber = seatInput?.value?.trim() || '';
    const email = emailInput?.value?.trim() || '';

    if (seatNumber && !/^[A-Z]\d{1,3}$/.test(seatNumber)) {
        alert('Invalid seat number format');
        return;
    }

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId: 'combo-order',
                quantity: appState.cartItems.length,
                seatNumber: seatNumber || undefined,
                email: email || undefined,
            }),
        });

        if (!response.ok) throw new Error('Checkout failed');

        const order = await response.json();
        appState.cartItems = [];
        updateCartDisplay();
        showOrderConfirmation(order.order);
        announceToScreenReader(`Order confirmed. Estimated delivery: ${order.order.estimatedDeliveryTime} minutes.`);
    } catch (error) {
        console.error('Checkout error:', error);
        alert(`Error: ${error.message}`);
    }
}

/**
 * Shows order confirmation
 * @param {object} order - Order object
 */
function showOrderConfirmation(order) {
    const confirmationDiv = document.getElementById('order-confirmation');
    if (!confirmationDiv) return;

    confirmationDiv.innerHTML = `
        <div class="confirmation-message success">
            <h3>✓ Order Confirmed!</h3>
            <p><strong>Order ID:</strong> ${order.orderId}</p>
            <p><strong>Estimated Delivery:</strong> ${order.estimatedDeliveryTime} minutes</p>
            <p><strong>Seat:</strong> ${order.seatNumber || 'Not specified'}</p>
        </div>
    `;

    confirmationDiv.style.display = 'block';
    setTimeout(() => {
        confirmationDiv.style.display = 'none';
    }, 5000);
}

// ============================================================================
// ACCESSIBILITY
// ============================================================================

/**
 * Announces message to screen readers
 * @param {string} message - Message text
 */
function announceToScreenReader(message) {
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) {
        liveRegion.textContent = message;
    }
}

/**
 * Keyboard navigation
 */
document.addEventListener('keydown', (e) => {
    const focused = document.activeElement;

    if ((e.key === 'Enter' || e.key === ' ') && focused?.getAttribute('role') === 'button') {
        e.preventDefault();
        const sectorId = focused.id;
        if (sectorId && sectorId.startsWith('restroom') || sectorId.startsWith('food')) {
            handleSectorSelection(sectorId);
        }
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('GameDay Sync - Application initialized');
    
    // Set up robust Global Event Delegation for SVG Map interactions
    document.addEventListener('click', (e) => {
        const sectorNode = e.target.closest('.sector');
        if (sectorNode && sectorNode.id) {
            handleSectorSelection(sectorNode.id);
        }
    });

    const checkoutButton = document.getElementById('checkout-button');
    if (checkoutButton) {
        checkoutButton.addEventListener('click', handleCheckout);
    }

    updateCartDisplay();
    announceToScreenReader('GameDay Sync application ready. Navigate using the tabs at the top.');
});
