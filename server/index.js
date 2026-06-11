import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { createUser, findUserByUsername, getLists, saveLists } from "./db.js";
import { formatListValidationError, validateLists } from "../src/listValidation.js";

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST;
const JWT_SECRET = process.env.JWT_SECRET || "dex-keeper-dev-secret-change-in-production";

function corsOrigin() {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) return true;
  return origin.startsWith("http") ? origin : `https://${origin}`;
}

app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin: corsOrigin(),
  credentials: true,
}));

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
}

function validateCredentials(username, password) {
  const name = username?.trim();
  if (!name || name.length < 2 || name.length > 32) {
    return { error: "Trainer name must be 2–32 characters." };
  }
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    return { error: "Trainer name can only use letters, numbers, spaces, _ and -." };
  }
  if (!password || password.length < 4) {
    return { error: "Password must be at least 4 characters." };
  }
  return { username: name };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", async (req, res) => {
  const validated = validateCredentials(req.body.username, req.body.password);
  if (validated.error) return res.status(400).json({ error: validated.error });

  if (findUserByUsername(validated.username)) {
    return res.status(409).json({ error: "That trainer name is taken. Try logging in." });
  }

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const user = createUser(validated.username, passwordHash);
  const token = signToken(user);
  res.status(201).json({ token, username: user.username });
});

app.post("/api/auth/login", async (req, res) => {
  const validated = validateCredentials(req.body.username, req.body.password);
  if (validated.error) return res.status(400).json({ error: validated.error });

  const user = findUserByUsername(validated.username);
  if (!user) {
    return res.status(404).json({ error: "No trainer with that name. Sign up first." });
  }

  const ok = await bcrypt.compare(req.body.password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Wrong password." });
  }

  res.json({ token: signToken(user), username: user.username });
});

app.get("/api/lists", auth, (req, res) => {
  res.json({ lists: getLists(req.user.id) });
});

app.put("/api/lists", auth, (req, res) => {
  const validated = validateLists(req.body.lists);
  if (!validated.ok) {
    return res.status(400).json({ error: formatListValidationError(validated) });
  }
  if (!saveLists(req.user.id, validated.lists)) {
    return res.status(404).json({ error: "List storage was not found for this user" });
  }
  res.json({ ok: true });
});

app.listen(PORT, HOST, () => {
  console.log(`Dex Keeper API listening on ${HOST || "0.0.0.0"}:${PORT}`);
});
