import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const SAVES_DIR = path.join(__dirname, "saves");

// Ensure saves directory exists
if (!fs.existsSync(SAVES_DIR)) {
  fs.mkdirSync(SAVES_DIR, { recursive: true });
}

// Sanitize username to prevent directory traversal
function sanitizeUsername(username) {
  return username.replace(/[^a-zA-Z0-9_\-]/g, "").toLowerCase();
}

// Default save template matching the game's SaveData
const DEFAULT_SAVE = {
  unlockedLevel: 3, // Defaults to unlocking all levels per the game's original SaveState load code
  highScore: 0,
  muted: false,
  levelStars: [],
  bestTimes: [],
  bestCoins: [],
};

// GET endpoint to load save data for a user
app.get("/api/saves/:username", (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const filePath = path.join(SAVES_DIR, `${username}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return res.json(data);
    } catch (error) {
      console.error(`Error parsing save file for ${username}:`, error);
      return res.status(500).json({ error: "Failed to parse save data" });
    }
  } else {
    // New user, return default save template
    return res.json(DEFAULT_SAVE);
  }
});

// POST endpoint to store save data for a user
app.post("/api/saves/:username", (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const filePath = path.join(SAVES_DIR, `${username}.json`);

  try {
    const data = req.body;
    // Basic validation of keys to ensure safe write
    if (typeof data !== "object" || data === null) {
      return res.status(400).json({ error: "Invalid save data structure" });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`Save file updated for user: ${username}`);
    return res.json({ success: true });
  } catch (error) {
    console.error(`Error writing save file for ${username}:`, error);
    return res.status(500).json({ error: "Failed to persist save data" });
  }
});

// GET endpoint to calculate and retrieve the global leaderboard
app.get("/api/leaderboard", (req, res) => {
  const leaderboard = {
    0: [],
    1: [],
    2: [],
    3: []
  };

  try {
    const files = fs.readdirSync(SAVES_DIR);
    
    files.forEach(file => {
      if (!file.endsWith(".json")) return;
      
      const username = path.basename(file, ".json");
      const filePath = path.join(SAVES_DIR, file);
      
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        
        const bestTimes = data.bestTimes || [];
        const levelStars = data.levelStars || [];
        
        for (let i = 0; i < 4; i++) {
          const time = bestTimes[i] || 0;
          const stars = levelStars[i] || 0;
          
          if (time > 0) {
            leaderboard[i].push({
              username: username,
              time: time,
              stars: stars
            });
          }
        }
      } catch (e) {
        console.error(`Failed to process save file ${file} for leaderboard:`, e);
      }
    });

    // Sort each level's leaderboard by time (ascending) and take top 3
    for (let i = 0; i < 4; i++) {
      leaderboard[i].sort((a, b) => a.time - b.time);
      leaderboard[i] = leaderboard[i].slice(0, 3);
    }

    return res.json(leaderboard);
  } catch (error) {
    console.error("Failed to read saves for leaderboard:", error);
    return res.status(500).json({ error: "Failed to load leaderboard data" });
  }
});

// Serve built frontend assets in production
app.use(express.static(path.join(__dirname, "dist")));

// For all other routes, serve index.html (fallback for SPA routing)
app.use((req, res) => {
  const indexPath = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Game not built yet. Use 'npm run build' first to generate static files.");
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
