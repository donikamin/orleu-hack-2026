import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';
import type { ClassRow, AttemptRow, ClassTask } from './db';
import type { TaskLookup } from './pack';
import type { StudentSummary } from './analytics';

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export interface ClassContext {
  cls: ClassRow;
  attempts: AttemptRow[];
  classTasks: ClassTask[];
  lookup: TaskLookup;
  students: StudentSummary[];
}

export function useClass() {
  return useOutletContext<ClassContext>();
}
