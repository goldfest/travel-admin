import { buildAbsoluteUrl, parseSpringPage, requestJson } from "./apiClient";
import { getAppSettings } from "./settingsService";

function getBaseUrl(key) {
  return getAppSettings().services[key];
}

export function login(payload) {
  return requestJson(getBaseUrl("auth"), "/auth/login", {
    method: "POST",
    body: payload,
    auth: false,
  });
}

export function getCurrentUser() {
  return requestJson(getBaseUrl("auth"), "/users/me");
}

export async function listUsers({ page = 0, size = 20 } = {}) {
  const payload = await requestJson(getBaseUrl("auth"), "/admin/users", {
    query: { page, size },
  });

  return parseSpringPage(payload);
}

export function blockUser(id) {
  return requestJson(getBaseUrl("auth"), `/admin/users/${id}/block`, { method: "PUT" });
}

export function unblockUser(id) {
  return requestJson(getBaseUrl("auth"), `/admin/users/${id}/unblock`, { method: "PUT" });
}

export function deleteUser(id) {
  return requestJson(getBaseUrl("auth"), `/admin/users/${id}`, { method: "DELETE" });
}

export async function listCities({ page = 0, size = 50, sort = "createdAt", direction = "DESC" } = {}) {
  const payload = await requestJson(getBaseUrl("city"), "/v1", {
    query: { page, size, sort, direction },
  });

  return parseSpringPage(payload);
}

export function createCity(payload) {
  return requestJson(getBaseUrl("city"), "/v1", {
    method: "POST",
    body: payload,
  });
}

export function updateCity(id, payload) {
  return requestJson(getBaseUrl("city"), `/v1/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteCity(id) {
  return requestJson(getBaseUrl("city"), `/v1/${id}`, { method: "DELETE" });
}

export function getCityLookup() {
  return requestJson(getBaseUrl("city"), "/v1/lookup");
}

export async function listPoiTypes({ page = 0, size = 50, sortBy = "code", sortDirection = "ASC" } = {}) {
  const payload = await requestJson(getBaseUrl("poi"), "/poi-types", {
    query: { page, size, sortBy, sortDirection },
  });

  return parseSpringPage(payload);
}

export function listAllPoiTypes() {
  return requestJson(getBaseUrl("poi"), "/poi-types/all");
}

export function createPoiType(payload) {
  return requestJson(getBaseUrl("poi"), "/poi-types", {
    method: "POST",
    body: payload,
  });
}

export function updatePoiType(id, payload) {
  return requestJson(getBaseUrl("poi"), `/poi-types/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function deletePoiType(id) {
  return requestJson(getBaseUrl("poi"), `/poi-types/${id}`, { method: "DELETE" });
}

export async function searchPois(payload) {
  const response = await requestJson(getBaseUrl("poi"), "/pois/search", {
    method: "POST",
    body: payload,
  });

  return parseSpringPage(response);
}

export function createPoi(payload) {
  return requestJson(getBaseUrl("poi"), "/pois", {
    method: "POST",
    body: payload,
  });
}

export function updatePoi(id, payload) {
  return requestJson(getBaseUrl("poi"), `/pois/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function deletePoi(id) {
  return requestJson(getBaseUrl("poi"), `/pois/${id}`, { method: "DELETE" });
}

export function verifyPoi(id) {
  return requestJson(getBaseUrl("poi"), `/pois/${id}/verify`, { method: "POST" });
}

export function unverifyPoi(id) {
  return requestJson(getBaseUrl("poi"), `/pois/${id}/unverify`, { method: "POST" });
}

export async function listUnverifiedPois({ page = 0, size = 50 } = {}) {
  const payload = await requestJson(getBaseUrl("poi"), "/pois/unverified", {
    query: { page, size },
  });

  return parseSpringPage(payload);
}

export async function listImportTasks({ page = 0, size = 20 } = {}) {
  const payload = await requestJson(getBaseUrl("poi"), "/import/tasks", {
    query: { page, size },
  });

  return parseSpringPage(payload);
}

export function startImportTask(payload) {
  return requestJson(getBaseUrl("poi"), "/import/start", {
    method: "POST",
    body: payload,
  });
}

export async function listReports({ page = 0, size = 50, status } = {}) {
  const path = status ? `/v1/reports/status/${status}` : "/v1/reports";
  const payload = await requestJson(getBaseUrl("review"), path, {
    query: { page, size, sort: "createdAt,desc" },
  });

  return parseSpringPage(payload);
}

export function getPendingReportsCount() {
  return requestJson(getBaseUrl("review"), "/v1/reports/stats/pending-count");
}

export function processReport(id, payload) {
  return requestJson(getBaseUrl("review"), `/v1/reports/${id}/process`, {
    method: "POST",
    body: payload,
  });
}

export async function listRoutes({ page = 0, size = 20, archived = false } = {}) {
  const path = archived ? "/v1/routes/archived" : "/v1/routes";
  const payload = await requestJson(getBaseUrl("route"), path, {
    query: { page, size },
  });

  return parseSpringPage(payload);
}

export function getRoute(id) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${id}`);
}

export function createRoute(payload) {
  return requestJson(getBaseUrl("route"), "/v1/routes", {
    method: "POST",
    body: payload,
  });
}

export function updateRoute(id, payload) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function archiveRoute(id) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${id}/archive`, {
    method: "POST",
  });
}

export function unarchiveRoute(id) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${id}/unarchive`, {
    method: "POST",
  });
}

export function deleteRoute(id) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${id}`, {
    method: "DELETE",
  });
}

export function duplicateRoute(id, newName) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${id}/duplicate`, {
    method: "POST",
    query: { newName },
  });
}

export function optimizeRoute(id, optimizationMode = "TIME") {
  return requestJson(getBaseUrl("route"), `/v1/routes/${id}/optimize`, {
    method: "POST",
    query: { optimizationMode },
  });
}

export function generateRoute(payload) {
  return requestJson(getBaseUrl("route"), "/v1/routes/generate", {
    method: "POST",
    body: payload,
  });
}

export function addRoutePoint(routeId, payload) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${routeId}/points`, {
    method: "POST",
    body: payload,
  });
}

export function removeRoutePoint(routeId, routePointId) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${routeId}/points/${routePointId}`, {
    method: "DELETE",
  });
}

export function reorderRouteDayPoints(routeId, dayId, routePointIdsInOrder) {
  return requestJson(getBaseUrl("route"), `/v1/routes/${routeId}/days/${dayId}/reorder`, {
    method: "POST",
    body: { routePointIdsInOrder },
  });
}

export function countRoutes() {
  return requestJson(getBaseUrl("route"), "/v1/routes/count");
}

export function getRouteHealth() {
  return requestJson(getBaseUrl("route"), "/v1/health");
}

export function getRouteReadiness() {
  return requestJson(getBaseUrl("route"), "/v1/health/ready");
}

export function getRouteVersion() {
  return requestJson(getBaseUrl("route"), "/v1/health/version");
}

export function startGraphImport(payload) {
  return requestJson(getBaseUrl("graphImport"), "/internal/graph-import", {
    method: "POST",
    body: payload,
    auth: false,
  });
}

export function getGraphImportStats(cityId) {
  return requestJson(getBaseUrl("graphImport"), `/internal/graph-import/cities/${cityId}/stats`, {
    auth: false,
  });
}

export function getPoi(id) {
  return requestJson(getBaseUrl("poi"), `/pois/${id}`);
}

export function getApprovedPoiMedia(poiId) {
  return requestJson(getBaseUrl("poi"), `/pois/${poiId}/media`);
}

export async function listPendingPoiMedia({ page = 0, size = 50 } = {}) {
  const payload = await requestJson(getBaseUrl("poi"), "/pois/media/pending", {
    query: { page, size },
  });
  return parseSpringPage(payload);
}

export function uploadAdminPoiMedia(poiId, files) {
  const formData = new FormData();
  Array.from(files || []).forEach((file) => formData.append("files", file));

  return requestJson(getBaseUrl("poi"), `/pois/${poiId}/media/admin`, {
    method: "POST",
    body: formData,
  });
}

export function approvePoiMedia(poiId, mediaId) {
  return requestJson(getBaseUrl("poi"), `/pois/${poiId}/media/${mediaId}/approve`, { method: "POST" });
}

export function rejectPoiMedia(poiId, mediaId, reason = "") {
  return requestJson(getBaseUrl("poi"), `/pois/${poiId}/media/${mediaId}/reject`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function deletePoiMedia(poiId, mediaId) {
  return requestJson(getBaseUrl("poi"), `/pois/${poiId}/media/${mediaId}`, { method: "DELETE" });
}

export async function listPendingReviews({ page = 0, size = 50 } = {}) {
  const payload = await requestJson(getBaseUrl("review"), "/v1/reviews/moderation/pending", {
    query: { page, size, sort: "createdAt,desc" },
  });
  return parseSpringPage(payload);
}

export function approveReview(id, moderationComment = "") {
  return requestJson(getBaseUrl("review"), `/v1/reviews/${id}/approve`, {
    method: "POST",
    query: moderationComment ? { moderationComment } : {},
  });
}

export function rejectReview(id, moderationComment = "") {
  return requestJson(getBaseUrl("review"), `/v1/reviews/${id}/reject`, {
    method: "POST",
    query: moderationComment ? { moderationComment } : {},
  });
}

export function getReviewMediaUrl(path) {
  return buildAbsoluteUrl(getBaseUrl("review"), path);
}

export function getPoiMediaUrl(path) {
  return buildAbsoluteUrl(getBaseUrl("poi"), path);
}
