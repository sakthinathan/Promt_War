<h1 align="center">🏟️ VenueFlow Chennai (GameDay Sync)</h1>
<p align="center"><i>Next-Generation Real-Time Crowd Navigation & Artificial Intelligence using Google Cloud Platform</i></p>

---

## 🎯 Chosen Vertical
**Smart Venues, Operations & Fan Experience (Sports/Entertainment Tech)**
When 40,000+ fans attend an Indian Premier League (IPL) game at MA Chidambaram Stadium (Chepauk), halftime congestion creates massive bottlenecks, safety hazards, and poor attendee experiences. Wait times for restrooms and food courts spike dynamically and unpredictably. Our vertical focuses on drastically optimizing physical venue operations through real-time data ingestion and predictive routing.

---

## 🧠 Approach and Logic
Our foundational logic dictates that static maps and generic signage are insufficient for dynamic, high-density crowd environments. We approached this problem by generating a mathematically calculated, real-time geographic digital twin of the stadium!

1. **Environmental Reality over Static Renderings**: Instead of arbitrary flat SVG drawings, we utilize the **Google Maps JavaScript Engine** to project Live Satellite layers natively over Chepauk's global coordinates (`13.0628, 80.2793`), mapping interactive DOM nodes specifically to existing food courts and restroom infrastructure.
2. **Algorithmic Pathfinding**: We utilize a custom execution of **Dijkstra's Shortest Path Algorithm**. However, we heavily modify the node edge-weights algorithmically based on the *live occupancy telemetry*. If a restroom evaluates over a 15-minute queue, our pathfinder dynamically penalizes paths intersecting it, explicitly routing attendees around clustered corridors via drawn `google.maps.Polyline` vectors.
3. **Contextual GenAI**: Natural Language Processing is useless if it lacks physical context. By binding our WebSocket payloads implicitly into the backend query, **Google Vertex AI (Gemini 2.5 Flash)** scans the physical crowd variables locally before answering user triage questions.

---

## ⚙️ How the Solution Works
VenueFlow securely operates concurrently across two distinct environments:

### 1. Attendee Operations (Client-Side)
- **Live Geography**: Fans view a Google Maps viewport rendering minimalist Red, Yellow, and Green queue markers indicating latency at Pavilion, C-Stand, J-Stand, and MAC-B zones. Clicking a tile physically activates Dijkstra pathfinding routes.
- **Environmental Tracking**: An async fetch loop dynamically proxies to the **Google Air Quality API** to post real-world environment variables naturally into the dashboard.
- **Vertex Assistant**: Natural text interactions ("Where should I go to avoid the lines?") ping `/api/chat`, receiving autonomous, highly contextual responses evaluated via Gemini.

### 2. Staff Command Center & Simulation (Administrative)
- **Triage Dashboard**: Security and catering logistics managers access an invisible endpoint (`/staff`) running isolated WebSocket security schemas.
- **Logarithmic Triage**: Listens aggressively for structural anomalies. If queues breach limit caps or if the Google API triggers "Poor" Air Quality flags, native Visual Alarms are deployed into the Staff Log.
- **Automated Stress Testing**: The staff portal can physically summon over 15,000 synthetic digital attendees into the backend mathematically via our `simulation.js` engine—rapidly spiking queues past 45-minute waits to aggressively validate the Triage thresholds natively during presentations.

---

## 🔍 Assumptions Made
During the architectural design of this prototype, several key operational assumptions were made:
- **Spatial Mapping Accuracy**: Because public Google Street View arrays do not physically map the enclosed internal hallways and staircases of Chepauk Stadium, we assumed that overlaying our own custom logical graph (combining Google Maps Polylines with Dijkstra calculations) was technically superior to routing via the official Google Directions API.
- **Event Flow Mechanics**: The backend simulation specifically parses time using standard T20 Cricket architecture. We assumed extreme mass congestion behaviors inherently trigger specifically during the "Innings Break" (at exactly `Overs: 20`).
- **Synthetic Load Scalability**: For the purposes of hackathon validation, we assume our custom `simulation.js` engine accurately replicates the biological flow metrics of humans converging on localized gates within a 5-minute event spike.

---

## 🚀 Quick Start Installation

```bash
# 1. Install dependencies
npm install

# 2. Inject Google Cloud Credentials to root .env
GEMINI_API_KEY="your-gemini-key"
GOOGLE_MAPS_API_KEY="your-google-maps-key"

# 3. Ignite the Platform
npm start
```
