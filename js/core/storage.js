/*
 * Ce qui reste sur l'appareil : records, historique, Sursauts du jour, calibration, test du casque.
 * Un seul objet JSON (clé sursaut.v1). Sans stockage (navigation privée), le jeu marche, sans records.
 */

const KEY = 'sursaut.v1';
const HISTORY_LIMIT = 200;

const empty = () => ({
    records: {},
    history: [],
    daily: {},
    calibration: { contretempsMs: null },
    headphonesChecked: false,
});

export function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) {
            return empty();
        }

        return { ...empty(), ...JSON.parse(raw) };
    } catch {
        return empty();
    }
}

function save(state) {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // Stockage refusé ou plein : la partie continue, sans être gardée
    }
}

function update(change) {
    const state = load();
    change(state);
    save(state);

    return state;
}

/** Enregistre une partie de jeu libre ; retourne true si c'est un nouveau record */
export function saveResult(gameId, note, detail, dayKey) {
    let isRecord = false;
    update((state) => {
        isRecord = note > (state.records[gameId] ?? -1);
        if (isRecord) {
            state.records[gameId] = note;
        }
        state.history.unshift({ date: dayKey, epreuve: gameId, note, detail });
        state.history.length = Math.min(state.history.length, HISTORY_LIMIT);
    });

    return isRecord;
}

/** La note du jour n'est gardée qu'à la première tentative */
export function saveDaily(dayKey, notes, title) {
    let saved = false;
    update((state) => {
        if (state.daily[dayKey]) {
            return;
        }
        state.daily[dayKey] = { notes, title };
        saved = true;
    });

    return saved;
}

export const getDaily = (dayKey) => load().daily[dayKey] ?? null;

/** Nombre de jours consécutifs joués, jusqu'à aujourd'hui (ou hier si aujourd'hui n'est pas encore joué) */
export function streak(todayKey) {
    const { daily } = load();
    const day = new Date(`${todayKey}T12:00:00Z`);
    if (!daily[todayKey]) {
        day.setUTCDate(day.getUTCDate() - 1);
    }
    let count = 0;
    while (daily[day.toISOString().slice(0, 10)]) {
        count++;
        day.setUTCDate(day.getUTCDate() - 1);
    }

    return count;
}

export const getCalibration = () => load().calibration.contretempsMs;

export function setCalibration(ms) {
    update((state) => {
        state.calibration.contretempsMs = Math.round(ms);
    });
}

export const headphonesChecked = () => load().headphonesChecked;

export function setHeadphonesChecked() {
    update((state) => {
        state.headphonesChecked = true;
    });
}
