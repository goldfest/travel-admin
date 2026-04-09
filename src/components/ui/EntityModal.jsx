import { useEffect, useMemo, useState } from "react";

function buildInitialState(fields, initialRecord) {
  return fields.reduce(
    (accumulator, field) => ({
      ...accumulator,
      [field.key]: initialRecord?.[field.key] ?? field.defaultValue ?? "",
    }),
    { id: initialRecord?.id },
  );
}

function normalizeOption(option) {
  if (typeof option === "string") {
    return {
      value: option,
      label: option,
    };
  }

  return option;
}

function EntityModal({ isOpen, title, fields, initialRecord, onClose, onSubmit }) {
  const initialState = useMemo(() => buildInitialState(fields, initialRecord), [fields, initialRecord]);
  const [formState, setFormState] = useState(initialState);

  useEffect(() => {
    setFormState(initialState);
  }, [initialState]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (key, value) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formState);
  };

  return (
    <div className="record-modal" onClick={onClose}>
      <div className="record-modal__dialog p-4" onClick={(event) => event.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
          <div>
            <div className="section-title">Редактирование</div>
            <h2 className="h4 mb-0">{title}</h2>
          </div>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            {fields.map((field) => (
              <div key={field.key} className={field.type === "textarea" ? "col-12" : "col-md-6"}>
                <label className="form-label">{field.label}</label>
                {field.type === "select" ? (
                  <select
                    className="form-select"
                    value={formState[field.key]}
                    required={field.required}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                  >
                    <option value="">Выберите значение</option>
                    {field.options.map((rawOption) => {
                      const option = normalizeOption(rawOption);

                      return (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      );
                    })}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    className="form-control"
                    rows={field.rows || 4}
                    value={formState[field.key]}
                    required={field.required}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    className="form-control"
                    type={field.type || "text"}
                    value={formState[field.key]}
                    required={field.required}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EntityModal;
