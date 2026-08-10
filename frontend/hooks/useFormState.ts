"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Form state with an explicit baseline, so a screen can tell whether it holds
 * unsaved changes. Powers the single "unsaved changes" bar per settings tab
 * (instead of one save button per card).
 */
export function useFormState<T extends object>(initial: T) {
    const [baseline, setBaseline] = useState<T>(initial);
    const [values, setValues] = useState<T>(initial);

    const isDirty = useMemo(
        () => JSON.stringify(values) !== JSON.stringify(baseline),
        [values, baseline]
    );

    // Lets `commit()` read the latest values from an event handler without
    // nesting one setState call inside another updater.
    const valuesRef = useRef(values);
    useEffect(() => {
        valuesRef.current = values;
    }, [values]);

    /** Load server data as the new baseline, discarding any local edits. */
    const hydrate = useCallback((next: T) => {
        valuesRef.current = next;
        setBaseline(next);
        setValues(next);
    }, []);

    /** Accept the current (optionally patched) values as saved. */
    const commit = useCallback((patch?: Partial<T>) => {
        const merged = patch ? { ...valuesRef.current, ...patch } : valuesRef.current;
        valuesRef.current = merged;
        setBaseline(merged);
        setValues(merged);
    }, []);

    const reset = useCallback(() => setValues(baseline), [baseline]);

    const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setValues((current) => ({ ...current, [key]: value }));
    }, []);

    return { values, setField, setValues, isDirty, hydrate, commit, reset };
}
