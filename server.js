import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

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
  unlockedLevel: 0, // progression is earned — clearing a level unlocks the next
  highScore: 0,
  muted: false,
  levelStars: [],
  bestTimes: [],
  bestCoins: [],
  bestMarathon: null, // { time, coins, deaths } — fastest full-run clear
  totalCoins: 0, // account coin balance (collected minus shop purchases)
  ownedCharacters: ["lumio"], // shop unlocks; Lumio is the free starter
  selectedCharacter: "lumio",
};

// Number of levels the leaderboard tracks (level-01 .. level-06).
const LEVEL_COUNT = 6;

// Collect one player's save into the leaderboard accumulator (per-level times
// under numeric keys, marathon runs under "marathon").
function accumulateLeaderboard(leaderboard, username, data) {
  const bestTimes = data?.bestTimes || [];
  const levelStars = data?.levelStars || [];

  for (let i = 0; i < LEVEL_COUNT; i++) {
    const time = bestTimes[i] || 0;
    const stars = levelStars[i] || 0;

    if (time > 0) {
      leaderboard[i].push({ username, time, stars });
    }
  }

  const marathon = data?.bestMarathon;
  if (marathon && marathon.time > 0) {
    leaderboard.marathon.push({
      username,
      time: marathon.time,
      coins: marathon.coins || 0,
      deaths: marathon.deaths || 0,
    });
  }
}

// Sort every board by time (ascending) and keep the top 3.
function finalizeLeaderboard(leaderboard) {
  for (const key of Object.keys(leaderboard)) {
    leaderboard[key].sort((a, b) => a.time - b.time);
    leaderboard[key] = leaderboard[key].slice(0, 3);
  }
}

// Fresh empty leaderboard: one board per level plus the marathon board.
function emptyLeaderboard() {
  const board = { marathon: [] };
  for (let i = 0; i < LEVEL_COUNT; i++) board[i] = [];
  return board;
}

// MongoDB setup
let db = null;
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  console.log("Found MONGODB_URI, attempting to connect...");
  MongoClient.connect(MONGODB_URI)
    .then((client) => {
      db = client.db("lumios_leap");
      console.log("Connected to MongoDB persistently!");
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB:", err);
    });
} else {
  console.log("No MONGODB_URI environment variable found. Using local filesystem saves fallback.");
}

// GET endpoint to load save data for a user
app.get("/api/saves/:username", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ error: "Invalid username" });
  }

  // Use MongoDB if available
  if (db) {
    try {
      const save = await db.collection("saves").findOne({ username });
      if (save) {
        return res.json(save.data);
      } else {
        return res.json(DEFAULT_SAVE);
      }
    } catch (error) {
      console.error(`MongoDB error loading save for ${username}:`, error);
      return res.status(500).json({ error: "Database load failed" });
    }
  }

  // Fallback to local files
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
    return res.json(DEFAULT_SAVE);
  }
});

// POST endpoint to store save data for a user
app.post("/api/saves/:username", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const data = req.body;
  if (typeof data !== "object" || data === null) {
    return res.status(400).json({ error: "Invalid save data structure" });
  }

  // Use MongoDB if available
  if (db) {
    try {
      await db.collection("saves").updateOne(
        { username },
        { $set: { username, data, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log(`Save file updated in MongoDB for user: ${username}`);
      return res.json({ success: true });
    } catch (error) {
      console.error(`MongoDB error saving for ${username}:`, error);
      return res.status(500).json({ error: "Database save failed" });
    }
  }

  // Fallback to local files
  const filePath = path.join(SAVES_DIR, `${username}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`Save file updated locally for user: ${username}`);
    return res.json({ success: true });
  } catch (error) {
    console.error(`Error writing save file for ${username}:`, error);
    return res.status(500).json({ error: "Failed to persist save data" });
  }
});

// GET endpoint to calculate and retrieve the global leaderboard
app.get("/api/leaderboard", async (req, res) => {
  const leaderboard = emptyLeaderboard();

  // Use MongoDB if available
  if (db) {
    try {
      const docs = await db.collection("saves").find().toArray();
      docs.forEach((doc) => {
        accumulateLeaderboard(leaderboard, doc.username, doc.data);
      });

      finalizeLeaderboard(leaderboard);
      return res.json(leaderboard);
    } catch (error) {
      console.error("MongoDB error fetching leaderboard:", error);
      return res.status(500).json({ error: "Database leaderboard load failed" });
    }
  }

  // Fallback to local files
  try {
    const files = fs.readdirSync(SAVES_DIR);

    files.forEach(file => {
      if (!file.endsWith(".json")) return;

      const username = path.basename(file, ".json");
      const filePath = path.join(SAVES_DIR, file);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        accumulateLeaderboard(leaderboard, username, data);
      } catch (e) {
        console.error(`Failed to process save file ${file} for leaderboard:`, e);
      }
    });

    finalizeLeaderboard(leaderboard);
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
