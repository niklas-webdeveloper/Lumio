import express from "express";
import cors from "cors";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { WebSocketServer } from "ws";

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

// Number of levels the leaderboard tracks (level-01 .. level-09, incl. bosses).
const LEVEL_COUNT = 9;

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

// ---------------------------------------------------------------------------
// Online duel: two players race the same level live over WebSockets.
// The server is only a lobby + relay — all physics stays client-side. One
// player creates a room and gets a short code, the friend joins with it, the
// server matches them, starts the race and relays position frames so each
// client can draw the opponent as a live ghost. Times are measured locally
// from each client's GO; the lower reported time wins.
// ---------------------------------------------------------------------------

// Room codes: no easily-confused characters (I/O/0/1).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const MAX_ROOMS = 200;
const ROOM_TTL_MS = 30 * 60 * 1000;

/** code -> { code, level, createdAt, state, players: [{ws,name,char,...}] } */
const duelRooms = new Map();

function makeRoomCode() {
  for (let attempt = 0; attempt < 64; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!duelRooms.has(code)) return code;
  }
  return null;
}

function wsSend(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function duelPlayer(ws, msg) {
  return {
    ws,
    name: String(msg.name || "Spieler").slice(0, 15),
    char: String(msg.char || "lumio").slice(0, 32),
    ready: false,
    finished: false,
    time: 0,
    deaths: 0,
    rematch: false,
  };
}

const playerOf = (room, ws) => room.players.find((p) => p.ws === ws);
const opponentOf = (room, ws) => room.players.find((p) => p.ws !== ws);

/** Remove a socket from its room; the one left behind is told and freed. */
function leaveDuelRoom(ws) {
  const room = ws.duelRoom;
  if (!room) return;
  ws.duelRoom = null;
  room.players = room.players.filter((p) => p.ws !== ws);
  duelRooms.delete(room.code);
  for (const p of room.players) {
    p.ws.duelRoom = null;
    wsSend(p.ws, { type: "opponent-left" });
  }
}

/** Both players reported their time: announce the winner to each side. */
function finishDuel(room) {
  room.state = "finished";
  for (const p of room.players) {
    const opp = opponentOf(room, p.ws);
    const winner =
      p.time < opp.time ? "you" : p.time > opp.time ? "opponent" : "draw";
    wsSend(p.ws, {
      type: "result",
      winner,
      you: { name: p.name, time: p.time, deaths: p.deaths },
      opponent: { name: opp.name, time: opp.time, deaths: opp.deaths },
    });
  }
}

function handleDuelMessage(ws, msg) {
  switch (msg.type) {
    case "create": {
      leaveDuelRoom(ws);
      if (duelRooms.size >= MAX_ROOMS) {
        return wsSend(ws, { type: "error", message: "Der Server ist gerade voll — versuch es gleich nochmal." });
      }
      const code = makeRoomCode();
      if (!code) {
        return wsSend(ws, { type: "error", message: "Kein freier Raumcode — versuch es gleich nochmal." });
      }
      const level = Number.isInteger(msg.level) && msg.level >= 0 && msg.level < 32 ? msg.level : 0;
      const room = {
        code,
        level,
        createdAt: Date.now(),
        state: "waiting",
        players: [duelPlayer(ws, msg)],
      };
      duelRooms.set(code, room);
      ws.duelRoom = room;
      wsSend(ws, { type: "created", code });
      break;
    }

    case "join": {
      leaveDuelRoom(ws);
      const code = String(msg.code || "").trim().toUpperCase();
      const room = duelRooms.get(code);
      if (!room) {
        return wsSend(ws, { type: "error", message: "Raum nicht gefunden — prüf den Code!" });
      }
      if (room.players.length >= 2) {
        return wsSend(ws, { type: "error", message: "Dieser Raum ist schon voll." });
      }
      room.players.push(duelPlayer(ws, msg));
      ws.duelRoom = room;
      room.state = "matched";
      const [host, guest] = room.players;
      wsSend(host.ws, { type: "matched", level: room.level, opponent: { name: guest.name, char: guest.char } });
      wsSend(guest.ws, { type: "matched", level: room.level, opponent: { name: host.name, char: host.char } });
      break;
    }

    // Both scenes are loaded: the race may start (each client runs its own
    // 3-2-1 countdown after GO, times are measured from the local GO).
    case "ready": {
      const room = ws.duelRoom;
      if (!room || room.state !== "matched" || room.players.length < 2) return;
      playerOf(room, ws).ready = true;
      if (room.players.every((p) => p.ready)) {
        room.state = "racing";
        for (const p of room.players) wsSend(p.ws, { type: "go" });
      }
      break;
    }

    // Position frame for the live ghost — relay straight to the opponent.
    case "pos": {
      const room = ws.duelRoom;
      if (!room || room.state !== "racing") return;
      const opp = opponentOf(room, ws);
      if (opp) {
        wsSend(opp.ws, {
          type: "pos",
          t: Number(msg.t) || 0,
          x: Number(msg.x) || 0,
          y: Number(msg.y) || 0,
          f: msg.f ? 1 : 0,
        });
      }
      break;
    }

    case "finish": {
      const room = ws.duelRoom;
      if (!room || room.state !== "racing") return;
      const me = playerOf(room, ws);
      if (me.finished) return;
      me.finished = true;
      me.time = Math.max(0, Number(msg.time) || 0);
      me.deaths = Math.max(0, msg.deaths | 0);
      const opp = opponentOf(room, ws);
      if (opp) wsSend(opp.ws, { type: "opponent-finished", time: me.time });
      if (room.players.every((p) => p.finished)) finishDuel(room);
      break;
    }

    // Rematch: both must agree, then the ready/GO cycle runs again.
    case "rematch": {
      const room = ws.duelRoom;
      if (!room || room.state !== "finished" || room.players.length < 2) return;
      playerOf(room, ws).rematch = true;
      const opp = opponentOf(room, ws);
      if (opp && !opp.rematch) wsSend(opp.ws, { type: "rematch-requested" });
      if (room.players.every((p) => p.rematch)) {
        room.state = "matched";
        for (const p of room.players) {
          Object.assign(p, { ready: false, finished: false, time: 0, deaths: 0, rematch: false });
        }
        for (const p of room.players) wsSend(p.ws, { type: "rematch-start", level: room.level });
      }
      break;
    }

    case "leave":
      leaveDuelRoom(ws);
      break;

    default:
      break;
  }
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/duel" });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.duelRoom = null;
  ws.on("pong", () => (ws.isAlive = true));
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg && typeof msg === "object") handleDuelMessage(ws, msg);
  });
  ws.on("close", () => leaveDuelRoom(ws));
  ws.on("error", () => leaveDuelRoom(ws));
});

// Heartbeat (drops dead connections, keeps Render's idle timeout away) and
// stale-room sweep in one timer.
setInterval(() => {
  for (const client of wss.clients) {
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
  const now = Date.now();
  for (const [code, room] of duelRooms) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      for (const p of room.players) {
        p.ws.duelRoom = null;
        wsSend(p.ws, { type: "error", message: "Der Raum ist abgelaufen." });
      }
      duelRooms.delete(code);
    }
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
