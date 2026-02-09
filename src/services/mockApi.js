const STORAGE_KEY = 'lifeline-blood-center';
const SESSION_KEY = `${STORAGE_KEY}-session`;
const DONATION_LOCK_KEY = `${STORAGE_KEY}-donated`;
const API_BASE = process.env.REACT_APP_API_BASE || '/api';

// Empty seed so we never auto-populate demo rows; data must come from API or user input.
const seedData = {
  inventory: [],
  requests: [],
  hospitals: [],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const writeStore = (store) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
};

const readDonationLocks = () => {
  const raw = localStorage.getItem(DONATION_LOCK_KEY);
  return raw ? JSON.parse(raw) : {};
};

const writeDonationLocks = (locks) => localStorage.setItem(DONATION_LOCK_KEY, JSON.stringify(locks));

const readStore = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  // No seed fallback; start empty so data always comes from the API or user input.
  return clone(seedData);
};

export const bootstrapStore = () => {
  const store = readStore();
  return store;
};

export const syncFromBackend = async () => {
  try {
    const res = await fetch(`${API_BASE}/state`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    writeStore({
      inventory: data.inventory || [],
      requests: data.requests || [],
      hospitals: data.hospitals || [],
    });
    return data;
  } catch (err) {
    return null;
  }
};

export const getInventory = () => readStore().inventory;

export const getRequests = () => readStore().requests;

export const getHospitals = () => readStore().hospitals;

export const getSession = () => {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const hasDonated = (session) => {
  const locks = readDonationLocks();
  const donorId = session?.id || 'guest';
  return Boolean(locks[donorId]);
};

export const saveSession = ({ name, email, role, organization, contact, hospitalAccess }) => {
  const session = {
    id: `user-${Date.now()}`,
    name,
    email,
    role,
    organization,
    contact,
    hospitalAccess: role === 'Hospital' ? hospitalAccess ?? true : Boolean(hospitalAccess),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  }).catch(() => {});
  return session;
};

export const isCompatible = (available, needed) => {
  const compatibility = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+'],
  };

  return compatibility[available]?.includes(needed) ?? false;
};

export const addDonation = (payload, actor) => {
  const donorId = actor?.id || 'guest';
  const locks = readDonationLocks();
  if (locks[donorId]) {
    const err = new Error('already-donated');
    err.code = 'already-donated';
    throw err;
  }

  const store = readStore();
  const record = {
    id: `don-${Date.now()}`,
    bloodType: payload.bloodType,
    units: Number(payload.units ?? 1) || 1,
    city: payload.city,
    hospital: payload.hospital || actor?.organization || actor?.name || 'Verified donor',
    readyIn: payload.readyIn || 'Available',
    contact: payload.contact || actor?.email || 'On file',
    addedBy: actor ? `${actor.name} (${actor.role})` : 'Guest',
    createdAt: new Date().toISOString(),
    status: payload.status || 'Ready',
  };

  store.inventory = [record, ...store.inventory].slice(0, 50);
  writeStore(store);
  writeDonationLocks({ ...locks, [donorId]: true });
  fetch(`${API_BASE}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  }).catch(() => {});

  return { inventory: store.inventory, record };
};

export const consumeDonation = (id) => {
  const store = readStore();
  store.inventory = store.inventory.filter((item) => item.id !== id);
  writeStore(store);
  fetch(`${API_BASE}/inventory/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).catch(() => {});
  return store.inventory;
};

export const addRequest = (payload, actor) => {
  const store = readStore();
  const record = {
    id: `req-${Date.now()}`,
    bloodType: payload.bloodType,
    units: Number(payload.units),
    city: payload.city,
    urgency: payload.urgency,
    clinicalReason: payload.clinicalReason,
    requestedBy: payload.requestedBy || actor?.organization || actor?.name || 'Hospital team',
    contact: payload.contact || actor?.email || 'Verified contact',
    createdAt: new Date().toISOString(),
  };

  store.requests = [record, ...store.requests].slice(0, 50);
  writeStore(store);
  fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  }).catch(() => {});

  return { requests: store.requests, record };
};

export const findMatches = (neededType) => {
  const store = readStore();
  return store.inventory.filter((item) => isCompatible(item.bloodType, neededType));
};

export const findHospitalsByType = (neededType) => {
  const store = readStore();
  if (!neededType) return store.hospitals || [];
  return (store.hospitals || []).filter((hospital) =>
    hospital.readyTypes?.some((type) => isCompatible(type, neededType)),
  );
};
