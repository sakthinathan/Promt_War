🚀 **Excited to unveil VenueFlow Chennai (GameDay Sync)!** 🏏

For our latest hackathon project, we tackled one of the biggest logistical nightmares in sports: halftime stadium congestion at MA Chidambaram (Chepauk). When 40,000+ Chennai Super Kings fans move simultaneously, standard static maps fail. 

Rather than building just another basic food ordering app, my team and I built a real-time, mathematically-driven digital twin of the stadium natively powered by **Google Cloud Platform**. 

Here is what we engineered under the hood:
🔹 **Live WebSockets**: We threw out static data. Our node backend streams real-time queue occupancies (Restrooms & Food Courts) continuously.
🔹 **Dijkstra’s Algorithm via Google Maps**: We integrated the Google Maps JS API and built a custom Dijkstra graph over Chepauk. If a corridor is congested, the algorithm physically recalculates edge weights and draws visual vectors steering fans *away* from the dense crowds!
🔹 **Google Air Quality API**: We built a private Triage Dashboard for security staff that passively polls local open-air anomalies utilizing Google's environmental metrics arrays, dispatching native alarms if the Air Quality Index hits dangerous thresholds.
🔹 **Vertex AI (Gemini 2.5 Flash)**: Instead of a rigid chatbot, we implicitly pass the physical live variables of the stadium into the Gemini context window via `@google/generative-ai`, yielding a hyper-aware assistant that knows exactly what queues to avoid at any given over.

We even built a synthetic load simulator capable of spawning 15,000 concurrent digital attendees just to aggressively stress-test the environment's limit thresholds! 🔥

Check out the full Open-Source architectural breakdown natively on our GitHub: 
👉 [Insert GitHub Link Here]

#GoogleCloud #VertexAI #NodeJS #Hackathon #SportsTech #WebSockets #Algorithms #CSK #SoftwareEngineering
