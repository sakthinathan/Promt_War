/**
 * GameDay Sync - Real-time Stadium Crowd Management System
 * Enhanced with security, validation, and error handling
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Security & Middleware
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

// Custom middleware & utilities
const { generalLimiter, checkoutLimiter } = require('./middleware/rate-limit');
const { validateCheckout, handleValidationErrors } = require('./middleware/validation');
const { errorHandler, asyncHandler } = require('./utils/errorHandler');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { triggerStressTest, haltStressTest } = require('./simulation');

// Initialize Gemini 2.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "fallback_key");
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(generalLimiter);

// ============================================================================
// BODY PARSER & STATIC FILES
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '.')));

// ============================================================================
// STADIUM STATE & SIMULATION
// ============================================================================

/**
 * Stadium state object - contains all sector information
 */
const stadiumState = {
  restroom: {
    pavilion: { name: 'Pavilion Restrooms', waitTime: 5, currentCrowd: 15, capacity: 50, x: 100, y: 100 },
    cstand: { name: 'C-Stand Restrooms', waitTime: 8, currentCrowd: 25, capacity: 50, x: 300, y: 100 },
    jstand: { name: 'J-Stand Restrooms', waitTime: 6, currentCrowd: 20, capacity: 50, x: 50, y: 250 },
    macb: { name: 'MAC B Stand Restrooms', waitTime: 14, currentCrowd: 45, capacity: 50, x: 800, y: 250 },
  },
  food: {
    pavilion: { name: 'Anna Pavilion Concessions', waitTime: 12, currentCrowd: 40, capacity: 80, x: 500, y: 100 },
    cstand: { name: 'Marina C-Stand Food', waitTime: 10, currentCrowd: 35, capacity: 80, x: 700, y: 100 },
    jstand: { name: 'J-Stand Biryani Center', waitTime: 18, currentCrowd: 65, capacity: 80, x: 350, y: 250 },
    macb: { name: 'MAC B Premium Filter Coffee', waitTime: 5, currentCrowd: 18, capacity: 80, x: 500, y: 250 },
  },
  game: {
    innings: 1,
    overs: 0,
    isInningsBreak: false,
  }
};

/**
 * Simulates crowd movement based on game state
 * During halftime: increases wait times significantly
 * Otherwise: gradually decreases wait times
 */
function simulateStadiumTraffic() {
  const isInningsBreak = stadiumState.game.innings === 1 && stadiumState.game.overs >= 20;

  // Update all sectors
  Object.values(stadiumState.restroom).forEach(sector => {
    if (isInningsBreak) {
      sector.currentCrowd = Math.min(sector.capacity, sector.currentCrowd + Math.random() * 15);
      sector.waitTime = Math.round((sector.currentCrowd / sector.capacity) * 30);
    } else {
      sector.currentCrowd = Math.max(0, sector.currentCrowd * 0.95);
      sector.waitTime = Math.max(2, Math.round((sector.currentCrowd / sector.capacity) * 20));
    }
  });

  Object.values(stadiumState.food).forEach(sector => {
    if (isInningsBreak) {
      sector.currentCrowd = Math.min(sector.capacity, sector.currentCrowd + Math.random() * 20);
      sector.waitTime = Math.round((sector.currentCrowd / sector.capacity) * 40);
    } else {
      sector.currentCrowd = Math.max(0, sector.currentCrowd * 0.93);
      sector.waitTime = Math.max(3, Math.round((sector.currentCrowd / sector.capacity) * 25));
    }
  });

  // Update game state
  stadiumState.game.overs += 1;
  if (stadiumState.game.overs > 20) {
    stadiumState.game.overs = 0;
    stadiumState.game.innings += 1;
    if (stadiumState.game.innings > 2) {
      stadiumState.game.innings = 1;
    }
  }

  stadiumState.game.isInningsBreak = isInningsBreak;
}

// ============================================================================
// SOCKET.IO REAL-TIME COMMUNICATION
// ============================================================================

io.on('connection', (socket) => {
  console.log(`[Socket.IO] New connection: ${socket.id}`);

  // Send initial stadium state to client
  socket.emit('stadiumUpdate', stadiumState);

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Connection closed: ${socket.id}`);
  });

  // Handle custom events
  socket.on('getSectorInfo', (sectorId) => {
    const sectorData = getSectorData(sectorId);
    if (sectorData) {
      socket.emit('sectorInfo', { sector: sectorId, data: sectorData });
    }
  });

  // Secure Staff Alert Channel Subscription
  socket.on('joinAdmin', () => {
    socket.join('admin');
    console.log(`[Socket.IO] ${socket.id} joined secure channel: admin`);
    socket.emit('adminGridUpdate', stadiumState);
  });
});

/**
 * Helper function to get sector data by ID
 * @param {string} sectorId - The sector identifier (e.g., 'restroom-a', 'food-1')
 * @returns {object} Sector data or null if not found
 */
function getSectorData(sectorId) {
  const [type, id] = sectorId.split('-');
  if (type === 'restroom' && stadiumState.restroom[id]) {
    return stadiumState.restroom[id];
  }
  if (type === 'food' && stadiumState.food[id]) {
    return stadiumState.food[id];
  }
  return null;
}

// Broadcast stadium updates every 2 seconds
setInterval(() => {
  simulateStadiumTraffic();
  io.emit('stadiumUpdate', stadiumState);
}, 2000);

// ============================================================================
// API ROUTES - HEALTH CHECK
// ============================================================================

/**
 * Health check endpoint
 * @route GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================================================
// API ROUTES - QUEUE INFORMATION
// ============================================================================

/**
 * Get all sector information
 * @route GET /api/sectors
 */
app.get('/api/sectors', (req, res) => {
  try {
    const sectors = {
      restrooms: Object.values(stadiumState.restroom),
      foodCourts: Object.values(stadiumState.food),
    };
    res.json(sectors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

/**
 * Get specific sector information
 * @route GET /api/sectors/:sectorId
 */
app.get('/api/sectors/:sectorId', (req, res) => {
  try {
    const sectorData = getSectorData(req.params.sectorId);
    if (sectorData) {
      res.json(sectorData);
    } else {
      res.status(404).json({ error: 'Sector not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sector' });
  }
});

// ============================================================================
// API ROUTES - CHECKOUT (WITH VALIDATION & RATE LIMITING)
// ============================================================================

/**
 * Process checkout request
 * @route POST /api/checkout
 * @middleware checkoutLimiter - Prevents abuse
 * @middleware validateCheckout - Validates input
 * @middleware handleValidationErrors - Formats errors
 */
app.post('/api/checkout',
  checkoutLimiter,
  validateCheckout,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { itemId, quantity, seatNumber, email } = req.body;

    // Calculate delivery time based on cart size
    const baseTime = 5; // 5 minutes base
    const timePerItem = 2; // 2 minutes per item
    const estimatedDeliveryTime = baseTime + (quantity * timePerItem);

    // Process the order (your existing logic)
    const order = {
      orderId: `ORDER-${Date.now()}`,
      itemId,
      quantity,
      seatNumber: seatNumber || 'TBD',
      email: email || 'not-provided',
      estimatedDeliveryTime,
      status: 'confirmed',
      timestamp: new Date().toISOString(),
    };

    // Emit order confirmation via WebSocket
    io.emit('orderConfirmed', order);

    // Send response
    res.status(201).json({
      success: true,
      message: 'Order confirmed',
      order,
    });
  })
);

// ============================================================================
// API ROUTES - CONFIG & ADMIN (GEMINI 2.5 & SIMULATION)
// ============================================================================

app.get('/staff', (req, res) => {
  res.sendFile(path.join(__dirname, 'staff.html'));
});

app.get('/api/config', (req, res) => {
  res.json({ mapsKey: process.env.GOOGLE_MAPS_API_KEY });
});

app.get('/api/air-quality', async (req, res) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if(!key) return res.status(500).json({ error: 'Missing AQI API Key' });

    // Ping the official Google Maps Air Quality API centered natively over Chepauk
    const response = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: 13.0628, longitude: 80.2793 }
      })
    });
    
    if(!response.ok) {
      console.error(await response.text());
      return res.status(response.status).json({ error: "Air Quality API Failed" });
    }

    const data = await response.json();
    res.json(data);
  } catch(error) {
    console.error('AQI Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch environmental telemetry' });
  }
});

// Admin Panel Simulation Triggers
app.post('/api/admin/start-simulation', (req, res) => {
  triggerStressTest(stadiumState, io);
  res.json({ status: 'Running', message: 'Massive Crowd Load Synthesized.' });
});

app.post('/api/admin/stop-simulation', (req, res) => {
  haltStressTest(stadiumState, io);
  res.json({ status: 'Halted', message: 'Variables normalized.' });
});

app.post('/api/chat', express.json(), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const systemContext = `You are the VenueFlow AI Assistant for MA Chidambaram Stadium (Chepauk) in Chennai. 
    Help the user navigate and find the best food or restrooms. Keep answers short, fun, and human. 
    Here is the exact LIVE real-time venue queue data: ${JSON.stringify(stadiumState)}`;

    const result = await aiModel.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemContext }] },
        { role: 'user', parts: [{ text: message }] }
      ]
    });
    
    res.json({ reply: result.response.text() });
  } catch (error) {
    console.error('Gemini AI Error:', error);
    res.status(500).json({ error: 'Google Vertex AI Assistant is busy. Try again momentarily.' });
  }
});

// ============================================================================
// API ROUTES - GAME STATUS
// ============================================================================

/**
 * Get current game status
 * @route GET /api/game-status
 */
app.get('/api/game-status', (req, res) => {
  try {
    res.json({
      innings: stadiumState.game.innings,
      overs: stadiumState.game.overs,
      isInningsBreak: stadiumState.game.isInningsBreak,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game status' });
  }
});

// ============================================================================
// API ROUTES - ANALYTICS
// ============================================================================

/**
 * Get stadium analytics
 * @route GET /api/analytics
 */
app.get('/api/analytics', (req, res) => {
  try {
    const restrooms = Object.values(stadiumState.restroom);
    const foodCourts = Object.values(stadiumState.food);

    const analytics = {
      restroomAverageWait: Math.round(
        restrooms.reduce((sum, r) => sum + r.waitTime, 0) / restrooms.length
      ),
      foodAverageWait: Math.round(
        foodCourts.reduce((sum, f) => sum + f.waitTime, 0) / foodCourts.length
      ),
      totalCrowd: restrooms.reduce((sum, r) => sum + r.currentCrowd, 0) +
                  foodCourts.reduce((sum, f) => sum + f.currentCrowd, 0),
      timestamp: new Date().toISOString(),
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============================================================================
// 404 HANDLER
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
  });
});

// ============================================================================
// ERROR HANDLER (MUST BE LAST)
// ============================================================================

app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     GameDay Sync - Stadium Manager     ║
║        Real-time Optimization          ║
╚════════════════════════════════════════╝

✓ Server running on port ${PORT}
✓ Security headers enabled (Helmet)
✓ Rate limiting active
✓ Compression enabled
✓ Socket.IO listening

Access at: http://localhost:${PORT}
WebSocket: ws://localhost:${PORT}

Game Status:
├─ Innings: ${stadiumState.game.innings}
├─ Overs: ${stadiumState.game.overs}
└─ Innings Break: ${stadiumState.game.isInningsBreak}

API Endpoints:
├─ GET  /health              (Health check)
├─ GET  /api/sectors         (All sectors)
├─ GET  /api/sectors/:id     (Specific sector)
├─ GET  /api/game-status     (Game info)
├─ GET  /api/analytics       (Analytics)
└─ POST /api/checkout        (Process order)
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
