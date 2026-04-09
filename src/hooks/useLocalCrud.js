import { useEffect, useState } from "react";
import { deleteEntityRecord, getEntityRecords, upsertEntityRecord } from "../services/storage";

export function useLocalCrud(key) {
  const [records, setRecords] = useState([]);

  const refresh = () => {
    setRecords(getEntityRecords(key));
  };

  useEffect(() => {
    refresh();
  }, [key]);

  const saveRecord = (payload) => {
    const result = upsertEntityRecord(key, payload);
    refresh();
    return result;
  };

  const removeRecord = (id) => {
    deleteEntityRecord(key, id);
    refresh();
  };

  return {
    records,
    refresh,
    saveRecord,
    removeRecord,
  };
}
