import { SerializedRunenkriegModel, SerializedChessModel, SerializedShooterModel } from '../types';

const RUNENKRIEG_MODEL_STORAGE_KEY = 'runenkrieg-trained-model-v1';
const CHESS_MODEL_STORAGE_KEY = 'runenkrieg-chess-trained-model-v1';
const SHOOTER_MODEL_STORAGE_KEY = 'runenkrieg-shooter-trained-model-v1';

type StoreOptions = {
    triggerDownload?: boolean;
};

const isBrowserEnvironment = () =>
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = <T>(raw: string | null): T | null => {
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as T;
    } catch (error) {
        console.warn('Konnte gespeichertes Modell nicht parsen:', error);
        return null;
    }
};

const triggerDownload = (filename: string, data: unknown) => {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
        return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

export const storeRunenkriegModel = (
    serialized: SerializedRunenkriegModel,
    options: StoreOptions = {}
) => {
    if (!isBrowserEnvironment()) {
        return;
    }

    try {
        window.localStorage.setItem(
            RUNENKRIEG_MODEL_STORAGE_KEY,
            JSON.stringify(serialized)
        );
    } catch (error) {
        console.warn('Konnte Runenkrieg-Modell nicht im LocalStorage speichern:', error);
    }

    if (options.triggerDownload === false) {
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    triggerDownload(`runenkrieg-modell-${timestamp}.json`, serialized);
};

export const loadStoredRunenkriegModel = (): SerializedRunenkriegModel | null => {
    if (!isBrowserEnvironment()) {
        return null;
    }
    const raw = window.localStorage.getItem(RUNENKRIEG_MODEL_STORAGE_KEY);
    return safeParse<SerializedRunenkriegModel>(raw);
};

export const storeChessModel = (
    serialized: SerializedChessModel,
    options: StoreOptions = {}
) => {
    if (!isBrowserEnvironment()) {
        return;
    }

    try {
        window.localStorage.setItem(CHESS_MODEL_STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
        console.warn('Konnte Schach-Modell nicht im LocalStorage speichern:', error);
    }

    if (options.triggerDownload === false) {
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    triggerDownload(`schach-modell-${timestamp}.json`, serialized);
};

export const loadStoredChessModel = (): SerializedChessModel | null => {
    if (!isBrowserEnvironment()) {
        return null;
    }
    const raw = window.localStorage.getItem(CHESS_MODEL_STORAGE_KEY);
    return safeParse<SerializedChessModel>(raw);
};

export const storeShooterModel = (
    serialized: SerializedShooterModel,
    options: StoreOptions = {}
) => {
    if (!isBrowserEnvironment()) {
        return;
    }

    try {
        window.localStorage.setItem(SHOOTER_MODEL_STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
        console.warn('Konnte Arcade-Shooter-Modell nicht im LocalStorage speichern:', error);
    }

    if (options.triggerDownload === false) {
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    triggerDownload(`arcade-shooter-modell-${timestamp}.json`, serialized);
};

export const loadStoredShooterModel = (): SerializedShooterModel | null => {
    if (!isBrowserEnvironment()) {
        return null;
    }
    const raw = window.localStorage.getItem(SHOOTER_MODEL_STORAGE_KEY);
    return safeParse<SerializedShooterModel>(raw);
};
