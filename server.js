const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
// Bind to all interfaces by default so the API is reachable when deployed.
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 4000;
// Allow overriding storage location in production (e.g., a mounted persistent disk).
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data', 'db.json');

const seed = { inventory: [], requests: [], hospitals: [], sessions: [] };

const ensureStore = () => {
  // Create parent folders and seed the file if it does not exist.
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(seed, null, 2), 'utf-8');
  }
};

const readStore = () => {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
};

const writeStore = (data) => {
  ensureStore();
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/state', (_req, res) => {
  res.json(readStore());
});

app.post('/api/inventory', (req, res) => {
  const data = readStore();
  const record = {
    ...req.body,
    id: req.body.id || `don-${Date.now()}`,
    createdAt: req.body.createdAt || new Date().toISOString(),
  };
  data.inventory = [record, ...(data.inventory || [])].slice(0, 200);
  writeStore(data);
  res.status(201).json({ record });
});

app.post('/api/requests', (req, res) => {
  const data = readStore();
  const record = {
    ...req.body,
    id: req.body.id || `req-${Date.now()}`,
    createdAt: req.body.createdAt || new Date().toISOString(),
  };
  data.requests = [record, ...(data.requests || [])].slice(0, 200);
  writeStore(data);
  res.status(201).json({ record });
});

app.post('/api/inventory/consume', (req, res) => {
  const data = readStore();
  const { id } = req.body;
  data.inventory = (data.inventory || []).filter((item) => item.id !== id);
  writeStore(data);
  res.json({ inventory: data.inventory });
});

app.post('/api/session', (req, res) => {
  const data = readStore();
  const record = { ...req.body, id: req.body.id || `user-${Date.now()}` };
  data.sessions = [record, ...(data.sessions || [])].slice(0, 50);
  writeStore(data);
  res.status(201).json({ record });
});

app.listen(PORT, HOST, () => {
  console.log(`API running at http://${HOST}:${PORT}`);
});
