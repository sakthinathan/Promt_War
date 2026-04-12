/**
 * GameDay Sync - AI Chatbot Assistant
 * Powered by Google AI (Integrated)
 * Provides directions, wait times, recommendations, and general stadium information
 */

// ============================================================================
// CHATBOT STATE & CONFIGURATION
// ============================================================================

const chatbotState = {
    isOpen: false,
    conversationHistory: [],
    sectorData: {},
    userLocation: null,
};

// Stadium knowledge base
const stadiumKnowledge = {
    restrooms: {
        'restroom-a': { name: 'Restroom A', location: 'North End', type: 'restroom' },
        'restroom-b': { name: 'Restroom B', location: 'South End', type: 'restroom' },
        'restroom-c': { name: 'Restroom C', location: 'West Side', type: 'restroom' },
        'restroom-d': { name: 'Restroom D', location: 'East Side', type: 'restroom' },
    },
    foodCourts: {
        'food-1': { name: 'Food Court 1', location: 'North Plaza', cuisine: 'American', type: 'food' },
        'food-2': { name: 'Food Court 2', location: 'South Plaza', cuisine: 'International', type: 'food' },
        'food-3': { name: 'Food Court 3', location: 'West Plaza', cuisine: 'Mexican', type: 'food' },
        'food-4': { name: 'Food Court 4', location: 'East Plaza', cuisine: 'Asian', type: 'food' },
    },
    rules: {
        maxOrder: 15,
        estimatedDeliveryBase: 5,
        estimatedDeliveryPerItem: 2,
        gameStartTime: '19:00',
        gameHalfTimeStart: '20:15',
        gameHalfTimeDuration: 20,
    }
};

// ============================================================================
// CHATBOT UI FUNCTIONS
// ============================================================================

/**
 * Toggles chatbot panel visibility
 */
function toggleChatbot() {
    const panel = document.getElementById('chatbot-panel');
    const toggle = document.getElementById('chatbot-toggle');
    
    if (chatbotState.isOpen) {
        panel.style.display = 'none';
        chatbotState.isOpen = false;
    } else {
        panel.style.display = 'flex';
        chatbotState.isOpen = true;
        // Focus on input when opened
        setTimeout(() => {
            document.getElementById('chatbot-input').focus();
        }, 100);
    }
}

/**
 * Sends message from user and processes chatbot response
 */
async function sendChatbotMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Clear input
    input.value = '';
    
    // Add user message to display
    addChatbotMessage(message, 'user');

    // Display temporary typing indicator
    const messagesContainer = document.getElementById('chatbot-messages');
    const typingId = `typing-${Date.now()}`;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.id = typingId;
    typingDiv.innerHTML = '<p>✨ Gemini is thinking...</p>';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        if (data.reply) {
            addChatbotMessage(data.reply, 'bot');
        } else {
            addChatbotMessage("⚠️ Gemini is currently unavailable.", 'bot');
        }
    } catch (error) {
        console.error('Chat AI Error:', error);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        addChatbotMessage("⚠️ Network error reaching the Vertex AI server.", 'bot');
    }
}

/**
 * Handles quick action button clicks
 */
function askChatbot(question) {
    document.getElementById('chatbot-input').value = question;
    sendChatbotMessage();
}

/**
 * Handles Enter key in chatbot input
 */
function handleChatbotKeypress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendChatbotMessage();
    }
}

/**
 * Adds message to chatbot display
 * @param {string} text - Message text
 * @param {string} role - 'user' or 'bot'
 */
function addChatbotMessage(text, role) {
    const messagesContainer = document.getElementById('chatbot-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const messageText = document.createElement('p');
    messageText.textContent = text;
    
    messageDiv.appendChild(messageText);
    messagesContainer.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Store in history
    chatbotState.conversationHistory.push({
        role,
        message: text,
        timestamp: new Date()
    });
}

// ============================================================================
// NATURAL LANGUAGE PROCESSING & INTELLIGENCE
// ============================================================================

// ============================================================================
// NATURAL LANGUAGE PROCESSING
// ============================================================================
// Notice: The previous 350-line mock switch-statement intelligence engine 
// has been entirely deleted. All logic is now autonomously handled 
// natively via the Vertex AI Cloud backend inside server.js.

// ============================================================================
// EXPORT FOR USE IN APP.JS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        toggleChatbot,
        sendChatbotMessage,
        askChatbot,
        addChatbotMessage,
        updateChatbotStadiumData
    };
}
