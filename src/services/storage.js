import { seedData } from "../data/seedData";

const STORAGE_KEY = "travel-admin-db";
const trackedCollections = ["users", "cities", "places", "poiTypes", "complaints", "moderationItems"];
const clone = (value) => JSON.parse(JSON.stringify(value));
const today = () => new Date().toISOString().slice(0, 10);

function buildCounters(database) {
  return trackedCollections.reduce((accumulator, key) => {
    const ids = (database[key] || []).map((record) => Number(record.id) || 0);
    accumulator[key] = (Math.max(0, ...ids) || 0) + 1;
    return accumulator;
  }, {});
}

function buildInitialDatabase() {
  const database = clone(seedData);
  database.counters = buildCounters(database);
  return database;
}

function ensureDatabase() {
  if (typeof window === "undefined") {
    return buildInitialDatabase();
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    const initial = buildInitialDatabase();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed.counters) {
      parsed.counters = buildCounters(parsed);
    }
    return parsed;
  } catch {
    const initial = buildInitialDatabase();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function saveDatabase(database) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  }
}

function nextId(database, key) {
  const current = database.counters[key] || 1;
  database.counters[key] = current + 1;
  return current;
}

export function resetDatabase() {
  const initial = buildInitialDatabase();
  saveDatabase(initial);
  return initial;
}

export function getEntityRecords(key) {
  const database = ensureDatabase();
  return clone(database[key] || []);
}

export function upsertEntityRecord(key, payload) {
  const database = ensureDatabase();
  const collection = database[key] || [];
  const now = today();

  if (payload.id) {
    const nextCollection = collection.map((record) =>
      Number(record.id) === Number(payload.id)
        ? {
            ...record,
            ...payload,
            updatedAt: now,
          }
        : record,
    );

    database[key] = nextCollection;
    saveDatabase(database);
    return clone(nextCollection.find((record) => Number(record.id) === Number(payload.id)));
  }

  const nextRecord = {
    ...payload,
    id: nextId(database, key),
    createdAt: payload.createdAt || now,
    updatedAt: now,
  };

  database[key] = [nextRecord, ...collection];
  saveDatabase(database);
  return clone(nextRecord);
}

export function deleteEntityRecord(key, id) {
  const database = ensureDatabase();
  database[key] = (database[key] || []).filter((record) => Number(record.id) !== Number(id));
  saveDatabase(database);
}

export function getDashboardSnapshot() {
  const database = ensureDatabase();

  return {
    totalUsers: database.users.length,
    totalCities: database.cities.length,
    totalPlaces: database.places.length,
    pendingComplaints: database.complaints.filter((item) => item.status === "Pending").length,
    moderationQueue: database.moderationItems.filter((item) =>
      ["Pending", "Queued", "Needs Revision"].includes(item.status),
    ).length,
    recentComplaints: clone(database.complaints.slice(0, 4)),
    recentModeration: clone(database.moderationItems.slice(0, 4)),
  };
}

export function updateComplaint(id, changes) {
  const currentComplaint = getEntityRecords("complaints").find((record) => Number(record.id) === Number(id));

  if (!currentComplaint) {
    return null;
  }

  return upsertEntityRecord("complaints", {
    ...currentComplaint,
    ...changes,
  });
}

export function updateModerationItem(id, changes) {
  const currentItem = getEntityRecords("moderationItems").find((record) => Number(record.id) === Number(id));

  if (!currentItem) {
    return null;
  }

  return upsertEntityRecord("moderationItems", {
    ...currentItem,
    ...changes,
  });
}

export function escalateComplaintToModeration(complaintId) {
  const complaint = getEntityRecords("complaints").find((record) => Number(record.id) === Number(complaintId));

  if (!complaint) {
    return null;
  }

  const existingItem = getEntityRecords("moderationItems").find(
    (item) => item.title === `Жалоба: ${complaint.subjectName}`,
  );

  if (existingItem) {
    return existingItem;
  }

  updateComplaint(complaintId, { status: "Escalated" });

  return upsertEntityRecord("moderationItems", {
    title: `Жалоба: ${complaint.subjectName}`,
    type: complaint.subjectType,
    source: "REPORT",
    status: "Queued",
    qualityScore: complaint.priority === "High" ? "0.55" : "0.71",
    assignee: "Анна Соколова",
    note: complaint.reason,
  });
}

export function ingestMlDraft(response) {
  if (!response?.poi_draft) {
    return { createdPlace: null, moderationItem: null };
  }

  const place = response.poi_draft;
  const statusRecommendation = response.status_recommendation;
  const qualityScore = response.quality?.quality_score ?? 0;
  const city = getEntityRecords("cities").find((record) => Number(record.id) === Number(place.city_id));

  const createdPlace = upsertEntityRecord("places", {
    name: place.name,
    slug: place.slug,
    city: city?.name || `City #${place.city_id}`,
    type: place.poi_type_code,
    status: statusRecommendation === "AUTO_PUBLISH" ? "Published" : "Review",
    source: place.sources?.[0]?.source_code || "ML",
    verified: statusRecommendation === "AUTO_PUBLISH" ? "Yes" : "No",
    rating: String((qualityScore * 5).toFixed(1)),
  });

  let moderationItem = null;

  if (statusRecommendation !== "AUTO_PUBLISH") {
    moderationItem = upsertEntityRecord("moderationItems", {
      title: `ML draft: ${place.name}`,
      type: "POI",
      source: "ML",
      status: statusRecommendation === "REJECTED" ? "Rejected" : "Pending",
      qualityScore: String(qualityScore.toFixed(2)),
      assignee: "Илья Орлов",
      note: response.quality?.warnings?.join("; ") || "Создано из ML Lab",
    });
  }

  return {
    createdPlace,
    moderationItem,
  };
}
