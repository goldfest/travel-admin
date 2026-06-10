import { useEffect, useMemo, useState } from "react";

const DAYS = [
  { value: 0, label: "Пн" },
  { value: 1, label: "Вт" },
  { value: 2, label: "Ср" },
  { value: 3, label: "Чт" },
  { value: 4, label: "Пт" },
  { value: 5, label: "Сб" },
  { value: 6, label: "Вс" },
];

const CUSTOM_FEATURE_VALUE = "__custom__";

const FEATURE_PRESETS = [
  { key: "avg_bill", label: "Средний чек", aliases: ["avg_bill", "average_bill", "средний чек", "среднии чек", "средний счёт", "среднии счет", "чек", "цена", "price"] },
  { key: "cuisine", label: "Кухня", aliases: ["cuisine", "кухня", "тип кухни", "кухни", "вид кухни"] },
  { key: "wifi", label: "Wi‑Fi", aliases: ["wifi", "wi-fi", "вайфай", "вай фай", "бесплатный wi-fi", "есть wi-fi"] },
  { key: "parking", label: "Парковка", aliases: ["parking", "парковка", "автопарковка", "стоянка", "парковочные места"] },
  { key: "delivery", label: "Доставка", aliases: ["delivery", "доставка", "есть доставка", "доставка еды"] },
  { key: "takeaway", label: "Навынос", aliases: ["takeaway", "навынос", "еда навынос", "с собой", "take away"] },
  { key: "breakfast", label: "Завтраки", aliases: ["breakfast", "завтрак", "завтраки", "подают завтраки"] },
  { key: "pet_friendly", label: "Можно с животными", aliases: ["pet_friendly", "pet friendly", "можно с животными", "с животными", "с собакой", "dog friendly"] },
  { key: "wheelchair_accessible", label: "Доступная среда", aliases: ["wheelchair_accessible", "доступная среда", "доступный вход", "для инвалидов", "пандус"] },
  { key: "stars", label: "Звёзды", aliases: ["stars", "звезды", "звёзды", "категория отеля", "класс отеля"] },
  { key: "veranda", label: "Летняя веранда", aliases: ["veranda", "веранда", "летняя веранда", "терраса"] },
  { key: "laptop", label: "Можно с ноутбуком", aliases: ["laptop", "с ноутбуком", "можно с ноутбуком", "работа за ноутбуком"] },
  { key: "seats", label: "Количество мест", aliases: ["seats", "мест", "места", "количество мест", "посадочные места"] },
  { key: "children", label: "Для детей", aliases: ["children", "детям", "для детей", "детская площадка", "детские площадки"] },
  { key: "business_lunch", label: "Бизнес-ланч", aliases: ["business_lunch", "бизнес ланч", "бизнес-ланч", "ланч"] },
  { key: "lunch_price", label: "Стоимость ланча", aliases: ["lunch_price", "цена ланча", "стоимость ланча", "ланч от"] },
  { key: "lunch_hours", label: "Время ланча", aliases: ["lunch_hours", "время ланча", "ланч 11", "ланч время"] },
  { key: "coffee_to_go", label: "Кофе с собой", aliases: ["coffee_to_go", "кофе с собой"] },
  { key: "tea_to_go", label: "Чай с собой", aliases: ["tea_to_go", "чай с собой"] },
  { key: "payment_methods", label: "Способы оплаты", aliases: ["payment_methods", "способы оплаты", "наличный расчёт", "наличный расчет", "оплата картой", "безналичный расчет", "безналичный расчёт"] },
];

function normalizeFeatureKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[\s_./\\:;()\[\]{}]+/g, " ")
    .trim();
}

function compactFeatureKey(value) {
  return normalizeFeatureKey(value).replace(/[^a-zа-я0-9]+/g, "");
}

function detectFeaturePreset(key) {
  const normalized = normalizeFeatureKey(key);
  const compact = compactFeatureKey(key);

  return FEATURE_PRESETS.find((preset) => {
    const variants = [preset.key, preset.label, ...(preset.aliases || [])];
    return variants.some((alias) => {
      const normalizedAlias = normalizeFeatureKey(alias);
      const compactAlias = compactFeatureKey(alias);
      return normalized === normalizedAlias || compact === compactAlias || normalized.includes(normalizedAlias) || compact.includes(compactAlias);
    });
  });
}

function stringifyFeatureValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => stringifyFeatureValue(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const preferred = value.value ?? value.name ?? value.label ?? value.title ?? value.text ?? value.description;
    if (preferred !== undefined && preferred !== null) {
      return stringifyFeatureValue(preferred);
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function parseFeatureInputValue(value) {
  const raw = String(value ?? "").trim();
  const normalized = raw.toLowerCase();

  if (normalized === "true" || normalized === "да") return true;
  if (normalized === "false" || normalized === "нет") return false;
  if (normalized === "null") return null;
  if (raw !== "" && /^-?\d+(?:[.,]\d+)?$/.test(raw)) return Number(raw.replace(",", "."));

  return raw;
}

function isBooleanLike(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "false" || normalized === "да" || normalized === "нет";
}

function cleanupRawFeaturePart(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, "")
    .trim();
}

function getRawFeatureLeaf(rawKey) {
  const key = String(rawKey || "").trim();
  if (!key) return "";
  const parts = key.split(/[.]/).map((part) => cleanupRawFeaturePart(part)).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : key;
}

function makeRecognizedFeature(presetKey, value, originalKey, originalValue = "", derivedFromKey = false) {
  return {
    key: presetKey,
    presetKey,
    value: stringifyFeatureValue(value),
    originalKey: originalKey || "",
    originalValue: stringifyFeatureValue(originalValue),
    originalRawValue: originalValue,
    derivedFromKey,
    dirty: false,
  };
}

function buildOriginalKeyWithLeaf(originalKey, nextLeaf) {
  const key = String(originalKey || "").trim();
  const leaf = getRawFeatureLeaf(key);
  const cleanedLeaf = cleanupRawFeaturePart(leaf);
  const cleanedNextLeaf = cleanupRawFeaturePart(nextLeaf);

  if (!key || !cleanedNextLeaf) return key;
  if (!cleanedLeaf || !key.endsWith(cleanedLeaf)) return cleanedNextLeaf;

  return `${key.slice(0, key.length - cleanedLeaf.length)}${cleanedNextLeaf}`;
}

function rebuildOriginalFeatureKey(row) {
  const value = cleanupRawFeaturePart(row.value);
  if (!row.originalKey || !value) return row.originalKey || row.key;

  switch (row.presetKey) {
    case "avg_bill":
      return buildOriginalKeyWithLeaf(row.originalKey, `Чек ${value}`);
    case "lunch_price":
      return buildOriginalKeyWithLeaf(row.originalKey, `Ланч ${value}`);
    case "lunch_hours":
      return buildOriginalKeyWithLeaf(row.originalKey, `Ланч ${value}`);
    case "cuisine":
    case "seats":
      return buildOriginalKeyWithLeaf(row.originalKey, value);
    default:
      return row.originalKey;
  }
}

function readOriginalFeatureValue(row) {
  if (Object.prototype.hasOwnProperty.call(row, "originalRawValue")) {
    return row.originalRawValue;
  }
  return parseFeatureInputValue(row.originalValue || "true");
}

function readEditedFeatureEntry(row) {
  const rowValue = String(row.value ?? "").trim();

  if (row.originalKey) {
    if (row.derivedFromKey && isBooleanLike(row.originalValue)) {
      return [rebuildOriginalFeatureKey(row), readOriginalFeatureValue(row)];
    }

    return [String(row.originalKey).trim(), rowValue ? parseFeatureInputValue(rowValue) : readOriginalFeatureValue(row)];
  }

  const key = String(row.key || "").trim();
  return [key, rowValue ? parseFeatureInputValue(rowValue) : true];
}

function parseTwoGisFeature(key, value) {
  const originalKey = String(key || "").trim();
  const leaf = getRawFeatureLeaf(originalKey);
  const normalizedLeaf = normalizeFeatureKey(leaf);
  const compactLeaf = compactFeatureKey(leaf);
  const stringValue = stringifyFeatureValue(value);
  const valueIsBoolean = isBooleanLike(stringValue);

  if (!originalKey) return null;

  const checkMatch = normalizedLeaf.match(/(?:средний\s+)?ч[её]к\s*(.*)$/i);
  if (checkMatch) {
    return makeRecognizedFeature("avg_bill", cleanupRawFeaturePart(checkMatch[1]) || stringValue, originalKey, stringValue, true);
  }

  const lunchPriceMatch = normalizedLeaf.match(/ланч\s*(от\s*)?(.+?₽|.+?руб\.?|\d+.*)$/i);
  if (lunchPriceMatch && /\d/.test(lunchPriceMatch[0]) && !/\d{1,2}:\d{2}/.test(lunchPriceMatch[0])) {
    return makeRecognizedFeature("lunch_price", cleanupRawFeaturePart(lunchPriceMatch[0].replace(/^ланч/i, "")) || leaf, originalKey, stringValue, true);
  }

  const lunchHoursMatch = normalizedLeaf.match(/ланч\s*([0-2]?\d:[0-5]\d\s*[-–—]\s*[0-2]?\d:[0-5]\d)/i);
  if (lunchHoursMatch) {
    return makeRecognizedFeature("lunch_hours", cleanupRawFeaturePart(lunchHoursMatch[1]), originalKey, stringValue, true);
  }

  if (/бизнес[-\s]?ланч/i.test(leaf)) {
    return makeRecognizedFeature("business_lunch", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/(?:до|от)?\s*\d+\s*(?:мест|посадочн)/i.test(leaf) || /количество\s+мест/i.test(leaf)) {
    return makeRecognizedFeature("seats", leaf, originalKey, stringValue, true);
  }

  if (/кухн/i.test(leaf) && !["кухня", "кухни", "тип кухни", "вид кухни"].includes(normalizedLeaf)) {
    return makeRecognizedFeature("cuisine", leaf, originalKey, stringValue, true);
  }

  if (/кофе\s+с\s+собой/i.test(leaf)) {
    return makeRecognizedFeature("coffee_to_go", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/чай\s+с\s+собой/i.test(leaf)) {
    return makeRecognizedFeature("tea_to_go", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/наличн|карт[ао]й|безнал|сбп|qr/i.test(leaf) || /способы\s+оплаты/i.test(normalizeFeatureKey(originalKey))) {
    return makeRecognizedFeature("payment_methods", leaf, originalKey, stringValue, true);
  }

  if (/доставка/i.test(leaf)) {
    return makeRecognizedFeature("delivery", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/навынос|с\s+собой/i.test(leaf)) {
    return makeRecognizedFeature("takeaway", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/wi[-\s]?fi|вай[-\s]?фай/i.test(leaf)) {
    return makeRecognizedFeature("wifi", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/парковк|стоянк/i.test(leaf)) {
    return makeRecognizedFeature("parking", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/летн.*веранд|террас/i.test(leaf)) {
    return makeRecognizedFeature("veranda", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/завтрак/i.test(leaf)) {
    return makeRecognizedFeature("breakfast", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/с\s+животн|с\s+собак|pet/i.test(leaf)) {
    return makeRecognizedFeature("pet_friendly", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  if (/доступн.*сред|пандус|инвалид|wheelchair/i.test(leaf)) {
    return makeRecognizedFeature("wheelchair_accessible", valueIsBoolean ? "true" : stringValue, originalKey, stringValue, false);
  }

  const preset = detectFeaturePreset(leaf) || detectFeaturePreset(originalKey);
  if (preset) {
    return makeRecognizedFeature(preset.key, valueIsBoolean ? stringValue : stringValue || leaf, originalKey, stringValue, false);
  }

  return {
    key: cleanupRawFeaturePart(leaf || originalKey),
    presetKey: CUSTOM_FEATURE_VALUE,
    value: stringValue,
    originalKey,
    originalValue: stringValue,
    originalRawValue: value,
    derivedFromKey: false,
    dirty: false,
  };
}

function extractFeatureEntries(features) {
  if (!features) return [];

  if (typeof features === "string") {
    try {
      return extractFeatureEntries(JSON.parse(features));
    } catch {
      return [];
    }
  }

  if (Array.isArray(features)) {
    return features
      .map((item) => {
        if (typeof item === "string") {
          return [item, "true"];
        }

        if (!item || typeof item !== "object") {
          return null;
        }

        const key = item.key ?? item.name ?? item.title ?? item.label ?? item.code ?? item.featureKey ?? item.feature_key;
        const value = item.value ?? item.featureValue ?? item.feature_value ?? item.enabled ?? item.available ?? item.text ?? true;

        if (!key) {
          const objectEntries = Object.entries(item);
          if (objectEntries.length === 1) return objectEntries[0];
          return null;
        }

        return [key, value];
      })
      .filter(Boolean);
  }

  if (typeof features === "object") {
    return Object.entries(features);
  }

  return [];
}

function normalizeFeatures(features) {
  const entries = extractFeatureEntries(features)
    .map(([key, value]) => parseTwoGisFeature(key, value))
    .filter(Boolean);

  return entries.length > 0 ? entries : [{ key: "", presetKey: CUSTOM_FEATURE_VALUE, value: "", originalKey: "", originalValue: "", originalRawValue: undefined, derivedFromKey: false, dirty: false }];
}

function normalizeSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return [{ sourceCode: "MANUAL", sourceUrl: "", externalId: "", confidenceScore: "0.9" }];
  }

  return sources.map((source) => ({
    sourceCode: source.sourceCode || "MANUAL",
    sourceUrl: source.sourceUrl || "",
    externalId: source.externalId || "",
    confidenceScore: source.confidenceScore ?? "0.9",
  }));
}

function normalizeHours(hours) {
  const byDay = new Map((Array.isArray(hours) ? hours : []).map((item) => [Number(item.dayOfWeek), item]));

  return DAYS.map((day) => {
    const existing = byDay.get(day.value);
    return {
      dayOfWeek: day.value,
      enabled: Boolean(existing),
      openTime: existing?.openTime || "09:00",
      closeTime: existing?.closeTime || "18:00",
      aroundTheClock: Boolean(existing?.aroundTheClock),
    };
  });
}

function parseTags(tagsText) {
  return String(tagsText || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsToText(value) {
  if (Array.isArray(value)) {
    return value.join("\n");
  }
  if (!value) {
    return "";
  }
  return String(value);
}

function buildFormState(initialRecord, initialCityId, poiTypes) {
  return {
    id: initialRecord?.id,
    name: initialRecord?.name || "",
    slug: initialRecord?.slug || "",
    cityId: initialRecord?.cityId || initialCityId || "",
    poiTypeId: initialRecord?.poiTypeId || (poiTypes[0]?.id ? String(poiTypes[0].id) : ""),
    latitude: initialRecord?.latitude ?? "",
    longitude: initialRecord?.longitude ?? "",
    address: initialRecord?.address || "",
    description: initialRecord?.description || "",
    phone: initialRecord?.phone || "",
    siteUrl: initialRecord?.siteUrl || "",
    priceLevel: initialRecord?.priceLevel ?? "",
    isVerified: initialRecord?.isVerified ?? "false",
    isClosed: initialRecord?.isClosed ?? "false",
    tagsText: tagsToText(initialRecord?.tagsText),
    mediaUrlsText: initialRecord?.mediaUrlsText || "",
  };
}

function readFeatures(featureRows) {
  return featureRows.reduce((accumulator, row) => {
    const [key, value] = row.originalKey && !row.dirty
      ? [String(row.originalKey).trim(), readOriginalFeatureValue(row)]
      : readEditedFeatureEntry(row);

    if (!key) return accumulator;

    if (Object.prototype.hasOwnProperty.call(accumulator, key) && value !== undefined && accumulator[key] !== value) {
      accumulator[key] = `${stringifyFeatureValue(accumulator[key])}, ${stringifyFeatureValue(value)}`;
    } else {
      accumulator[key] = value === undefined || value === "" ? true : value;
    }

    return accumulator;
  }, {});
}

function readHours(hourRows) {
  return hourRows
    .filter((row) => row.enabled)
    .map((row) => ({
      dayOfWeek: Number(row.dayOfWeek),
      openTime: row.aroundTheClock ? null : row.openTime,
      closeTime: row.aroundTheClock ? null : row.closeTime,
      aroundTheClock: Boolean(row.aroundTheClock),
    }));
}

function readSources(sourceRows) {
  return sourceRows
    .filter((row) => String(row.sourceCode || "").trim())
    .map((row) => ({
      sourceCode: String(row.sourceCode || "").trim().toUpperCase(),
      sourceUrl: String(row.sourceUrl || "").trim() || null,
      externalId: String(row.externalId || "").trim() || null,
      confidenceScore: row.confidenceScore === "" ? null : Number(row.confidenceScore),
    }));
}

function PoiFormModal({
  isOpen,
  title,
  initialRecord,
  initialCityId,
  cities,
  poiTypes,
  saving,
  getMediaUrl,
  onClose,
  onSubmit,
}) {
  const [formState, setFormState] = useState(() => buildFormState(initialRecord, initialCityId, poiTypes));
  const [featureRows, setFeatureRows] = useState(() => normalizeFeatures(initialRecord?.features || initialRecord?.featuresObject));
  const [hourRows, setHourRows] = useState(() => normalizeHours(initialRecord?.hours));
  const [sourceRows, setSourceRows] = useState(() => normalizeSources(initialRecord?.sources));
  const [adminFiles, setAdminFiles] = useState([]);

  const currentMedia = useMemo(() => (Array.isArray(initialRecord?.media) ? initialRecord.media : []), [initialRecord]);

  useEffect(() => {
    if (!isOpen) return;
    setFormState(buildFormState(initialRecord, initialCityId, poiTypes));
    setFeatureRows(normalizeFeatures(initialRecord?.features || initialRecord?.featuresObject));
    setHourRows(normalizeHours(initialRecord?.hours));
    setSourceRows(normalizeSources(initialRecord?.sources));
    setAdminFiles([]);
  }, [initialRecord, initialCityId, isOpen, poiTypes]);

  if (!isOpen) {
    return null;
  }

  const isEdit = Boolean(formState.id);

  const setField = (key, value) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const updateFeatureRow = (index, patch, markDirty = true) => {
    setFeatureRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch, dirty: markDirty ? true : row.dirty } : row)));
  };

  const updateHourRow = (index, patch) => {
    setHourRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const updateSourceRow = (index, patch) => {
    setSourceRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(
      {
        ...formState,
        tags: parseTags(formState.tagsText),
        features: readFeatures(featureRows),
        hours: readHours(hourRows),
        sources: readSources(sourceRows),
        mediaUrls: String(formState.mediaUrlsText || "")
          .split(/\r?\n|,/)
          .map((url) => url.trim())
          .filter(Boolean),
      },
      adminFiles,
    );
  };

  return (
    <div className="record-modal" onClick={onClose}>
      <div className="record-modal__dialog record-modal__dialog--wide p-4" onClick={(event) => event.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
          <div>
            <div className="section-title">Карточка POI</div>
            <h2 className="h4 mb-0">{title}</h2>
          </div>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="poi-form-tabs d-flex flex-column gap-4">
            <div className="surface-subcard p-3">
              <div className="section-title mb-3">Основная информация</div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Название</label>
                  <input className="form-control" value={formState.name} required onChange={(event) => setField("name", event.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Slug</label>
                  <input className="form-control" value={formState.slug} required onChange={(event) => setField("slug", event.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Город</label>
                  <select className="form-select" value={formState.cityId} required disabled={isEdit} onChange={(event) => setField("cityId", event.target.value)}>
                    <option value="">Выберите город</option>
                    {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Тип POI</label>
                  <select className="form-select" value={formState.poiTypeId} required onChange={(event) => setField("poiTypeId", event.target.value)}>
                    <option value="">Выберите тип</option>
                    {poiTypes.map((type) => <option key={type.id} value={type.id}>{type.name} ({type.code})</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Широта</label>
                  <input className="form-control" type="number" step="any" value={formState.latitude} required onChange={(event) => setField("latitude", event.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Долгота</label>
                  <input className="form-control" type="number" step="any" value={formState.longitude} required onChange={(event) => setField("longitude", event.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Уровень цены 0–4</label>
                  <input className="form-control" type="number" min="0" max="4" value={formState.priceLevel} onChange={(event) => setField("priceLevel", event.target.value)} />
                </div>
                <div className="col-12">
                  <label className="form-label">Адрес</label>
                  <input className="form-control" value={formState.address} onChange={(event) => setField("address", event.target.value)} />
                </div>
                <div className="col-12">
                  <label className="form-label">Описание</label>
                  <textarea className="form-control" rows="4" value={formState.description} onChange={(event) => setField("description", event.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Телефон</label>
                  <input className="form-control" value={formState.phone} onChange={(event) => setField("phone", event.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Сайт</label>
                  <input className="form-control" value={formState.siteUrl} onChange={(event) => setField("siteUrl", event.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Верификация</label>
                  <select className="form-select" value={formState.isVerified} onChange={(event) => setField("isVerified", event.target.value)}>
                    <option value="false">Не верифицирован</option>
                    <option value="true">Верифицирован</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Статус работы</label>
                  <select className="form-select" value={formState.isClosed} onChange={(event) => setField("isClosed", event.target.value)}>
                    <option value="false">Работает</option>
                    <option value="true">Закрыт</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Теги</label>
                  <textarea className="form-control" rows="2" placeholder="Каждый тег с новой строки или через запятую" value={formState.tagsText} onChange={(event) => setField("tagsText", event.target.value)} />
                </div>
              </div>
            </div>

            <div className="surface-subcard p-3">
              <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <div className="section-title">Features</div>
                  <div className="text-secondary small">Параметры объекта без ручного JSON: Wi‑Fi, кухня, средний чек, парковка и другие признаки.</div>
                </div>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setFeatureRows((current) => [...current, { key: "", presetKey: CUSTOM_FEATURE_VALUE, value: "", originalKey: "", originalValue: "", originalRawValue: undefined, derivedFromKey: false, dirty: true }])}>
                  <i className="bi bi-plus-lg me-1" />Добавить
                </button>
              </div>
              <div className="d-flex flex-column gap-2">
                {featureRows.map((row, index) => {
                  const isCustomFeature = !row.presetKey || row.presetKey === CUSTOM_FEATURE_VALUE;
                  const selectedPreset = FEATURE_PRESETS.find((preset) => preset.key === row.presetKey);

                  return (
                    <div className="row g-2 align-items-start" key={`${row.key || row.presetKey}-${index}`}>
                      <div className="col-md-3">
                        <select
                          className="form-select"
                          value={row.presetKey || CUSTOM_FEATURE_VALUE}
                          onChange={(event) => {
                            const presetKey = event.target.value;
                            if (presetKey === CUSTOM_FEATURE_VALUE) {
                              updateFeatureRow(index, { presetKey: CUSTOM_FEATURE_VALUE, key: row.presetKey && row.key === row.presetKey ? "" : row.key, originalKey: "", originalValue: "", derivedFromKey: false });
                              return;
                            }

                            updateFeatureRow(index, { presetKey, key: presetKey, originalKey: "", originalValue: "", derivedFromKey: false });
                          }}
                        >
                          <option value={CUSTOM_FEATURE_VALUE}>Свой ключ</option>
                          {FEATURE_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
                        </select>
                        {row.originalKey && row.originalKey !== row.key && (
                          <div className="form-text">
                            Из 2GIS: {row.originalKey}{row.dirty ? " • будет сохранено в исходном формате" : " • без изменений сохранится как есть"}
                          </div>
                        )}
                      </div>
                      <div className="col-md-4">
                        <input
                          className="form-control"
                          placeholder="Ключ: Wi-Fi, средний чек, кухня..."
                          value={isCustomFeature ? row.key : selectedPreset?.label || row.key}
                          disabled={!isCustomFeature}
                          onChange={(event) => updateFeatureRow(index, { key: event.target.value, presetKey: CUSTOM_FEATURE_VALUE, originalKey: "", originalValue: "", derivedFromKey: false })}
                        />
                      </div>
                      <div className="col-md-4">
                        <input className="form-control" placeholder="Значение: true, 800 ₽, русская кухня..." value={row.value} onChange={(event) => updateFeatureRow(index, { value: event.target.value })} />
                      </div>
                      <div className="col-md-1 d-grid">
                        <button type="button" className="btn btn-outline-danger" onClick={() => setFeatureRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} title="Удалить feature">
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="surface-subcard p-3">
              <div className="section-title mb-3">Часы работы</div>
              <div className="d-flex flex-column gap-2">
                {hourRows.map((row, index) => (
                  <div className="row g-2 align-items-center" key={row.dayOfWeek}>
                    <div className="col-md-2">
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" checked={row.enabled} onChange={(event) => updateHourRow(index, { enabled: event.target.checked })} id={`day-${row.dayOfWeek}`} />
                        <label className="form-check-label fw-semibold" htmlFor={`day-${row.dayOfWeek}`}>{DAYS[index].label}</label>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <input className="form-control" type="time" disabled={!row.enabled || row.aroundTheClock} value={row.openTime} onChange={(event) => updateHourRow(index, { openTime: event.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <input className="form-control" type="time" disabled={!row.enabled || row.aroundTheClock} value={row.closeTime} onChange={(event) => updateHourRow(index, { closeTime: event.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" disabled={!row.enabled} checked={row.aroundTheClock} onChange={(event) => updateHourRow(index, { aroundTheClock: event.target.checked })} id={`clock-${row.dayOfWeek}`} />
                        <label className="form-check-label" htmlFor={`clock-${row.dayOfWeek}`}>Круглосуточно</label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-subcard p-3">
              <div className="section-title mb-3">Медиа</div>
              <div className="row g-3">
                <div className="col-12 col-xl-5">
                  <label className="form-label">Внешние URL фотографий</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg"
                    value={formState.mediaUrlsText}
                    onChange={(event) => setField("mediaUrlsText", event.target.value)}
                    disabled={isEdit}
                  />
                  {isEdit && <div className="text-secondary small mt-2">URL-фото редактируются при создании. Для существующего POI загружай файлы ниже — они сразу станут APPROVED.</div>}

                  <label className="form-label mt-3">Загрузить фото с компьютера</label>
                  <input className="form-control" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => setAdminFiles(Array.from(event.target.files || []))} />
                  <div className="text-secondary small mt-2">После сохранения файлы будут отправлены через admin media endpoint.</div>
                </div>
                <div className="col-12 col-xl-7">
                  <div className="section-title mb-2">Текущие фотографии</div>
                  <div className="media-grid media-grid--compact">
                    {currentMedia.length > 0 ? currentMedia.map((media) => (
                      <a key={media.id || media.url} href={getMediaUrl(media.url)} target="_blank" rel="noreferrer" className="media-thumb">
                        <img src={getMediaUrl(media.url)} alt={media.originalFilename || media.mediaType || "POI media"} />
                        <span>{media.sourceType || media.mediaType || "media"}</span>
                      </a>
                    )) : <div className="text-secondary small">У объекта пока нет фотографий.</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="surface-subcard p-3">
              <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <div className="section-title">Источники</div>
                  <div className="text-secondary small">Источник данных, ссылка, внешний ID и confidence без ручного JSON.</div>
                </div>
                {!isEdit && (
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setSourceRows((current) => [...current, { sourceCode: "", sourceUrl: "", externalId: "", confidenceScore: "0.9" }])}>
                    <i className="bi bi-plus-lg me-1" />Добавить
                  </button>
                )}
              </div>

              {isEdit && <div className="alert alert-info py-2 small">Текущие источники отображаются для просмотра. Update endpoint POI сейчас не принимает изменение sources, поэтому источники заполняются при создании или импорте.</div>}

              <div className="d-flex flex-column gap-2">
                {sourceRows.map((row, index) => (
                  <div className="row g-2" key={`${row.sourceCode}-${index}`}>
                    <div className="col-md-2">
                      <input className="form-control" placeholder="TWO_GIS" value={row.sourceCode} disabled={isEdit} onChange={(event) => updateSourceRow(index, { sourceCode: event.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <input className="form-control" placeholder="URL источника" value={row.sourceUrl} disabled={isEdit} onChange={(event) => updateSourceRow(index, { sourceUrl: event.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <input className="form-control" placeholder="externalId" value={row.externalId} disabled={isEdit} onChange={(event) => updateSourceRow(index, { externalId: event.target.value })} />
                    </div>
                    <div className="col-md-2">
                      <input className="form-control" type="number" min="0" max="1" step="0.01" value={row.confidenceScore} disabled={isEdit} onChange={(event) => updateSourceRow(index, { confidenceScore: event.target.value })} />
                    </div>
                    {!isEdit && (
                      <div className="col-md-1 d-grid">
                        <button type="button" className="btn btn-outline-danger" onClick={() => setSourceRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PoiFormModal;
