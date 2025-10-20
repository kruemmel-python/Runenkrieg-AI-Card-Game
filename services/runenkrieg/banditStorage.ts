import { BanditPolicy, SerializedBanditPolicy } from './policy/BanditPolicy';

export interface BanditPolicySummary {
    contextCount: number;
    totalDecisions: number;
    fuseDecisions: number;
    skipDecisions: number;
}

const STORAGE_KEY = 'fusion-bandit-state-v1';

const hasLocalStorage = (): boolean =>
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const loadSerializedBanditPolicy = (): SerializedBanditPolicy | null => {
    if (!hasLocalStorage()) {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as SerializedBanditPolicy;
        if (!Array.isArray(parsed)) {
            return null;
        }
        return parsed;
    } catch (error) {
        console.warn('Fehler beim Laden des Bandit-Zustands:', error);
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore removal errors
        }
        return null;
    }
};

export const loadBanditPolicyFromStorage = (): BanditPolicy | null => {
    const serialized = loadSerializedBanditPolicy();
    if (!serialized) {
        return null;
    }
    return BanditPolicy.deserialize(serialized);
};

export const saveBanditPolicyToStorage = (policy: BanditPolicy): void => {
    if (!hasLocalStorage()) {
        return;
    }

    try {
        const serialized = policy.serialize();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
        console.error('Fehler beim Speichern des Bandit-Zustands:', error);
    }
};

export const readBanditPolicySummary = (): BanditPolicySummary => {
    const policy = loadBanditPolicyFromStorage();
    if (!policy) {
        return { contextCount: 0, totalDecisions: 0, fuseDecisions: 0, skipDecisions: 0 };
    }
    return policy.getSummary();
};

export const clearBanditPolicyStorage = () => {
    if (!hasLocalStorage()) {
        return;
    }
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Fehler beim Zurücksetzen des Bandit-Zustands:', error);
    }
};

export { STORAGE_KEY as BANDIT_STORAGE_KEY };
