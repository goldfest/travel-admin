import {
  createCity,
  createPoiType,
  deleteCity,
  deletePoiType,
  listCities,
  listPoiTypes,
  updateCity,
  updatePoiType,
} from "./adminApi";
import { formatDateTime } from "./apiClient";

function toBoolean(value) {
  return value === true || value === "true" || value === "Yes";
}

function mapCityToRecord(city) {
  return {
    id: city.id,
    name: city.name || "",
    country: city.country || "",
    countryCode: city.countryCode || "",
    slug: city.slug || "",
    description: city.description || "",
    centerLat: city.centerLat ?? "",
    centerLng: city.centerLng ?? "",
    isPopular: city.isPopular ? "Yes" : "No",
    updatedAt: formatDateTime(city.updatedAt),
  };
}

function mapCityToPayload(record) {
  return {
    name: record.name,
    country: record.country,
    description: record.description,
    centerLat: Number(record.centerLat),
    centerLng: Number(record.centerLng),
    isPopular: toBoolean(record.isPopular),
    slug: record.slug,
    countryCode: record.countryCode,
  };
}

function mapPoiTypeToRecord(item) {
  return {
    id: item.id,
    code: item.code || "",
    name: item.name || "",
    icon: item.icon || "",
    updatedAt: formatDateTime(item.updatedAt),
  };
}

export const cityEntityAdapter = {
  async fetchList() {
    const page = await listCities();
    return page.items.map(mapCityToRecord);
  },
  async save(record) {
    const payload = mapCityToPayload(record);
    const response = record.id ? await updateCity(record.id, payload) : await createCity(payload);
    return mapCityToRecord(response);
  },
  async delete(record) {
    await deleteCity(record.id);
  },
};

export const poiTypeEntityAdapter = {
  async fetchList() {
    const page = await listPoiTypes();
    return page.items.map(mapPoiTypeToRecord);
  },
  async save(record) {
    const payload = {
      code: record.code,
      name: record.name,
      icon: record.icon,
    };
    const response = record.id ? await updatePoiType(record.id, payload) : await createPoiType(payload);
    return mapPoiTypeToRecord(response);
  },
  async delete(record) {
    await deletePoiType(record.id);
  },
};
