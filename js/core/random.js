/*
 * Tirages reproductibles : une même graine redonne exactement la même partie.
 * Le Sursaut du jour part de la date (heure de Paris), le jeu libre d'une graine au hasard.
 */

/** Une chaîne → un entier 32 bits (variante de cyrb53, réduite à 32 bits) */
export function hashSeed(text) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ code, 2654435761);
        h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return (h1 ^ h2) >>> 0;
}

/** Générateur mulberry32 : rapide, 32 bits, largement suffisant pour un jeu */
export function mulberry32(seed) {
    let a = seed >>> 0;

    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createRng(seed) {
    const next = mulberry32(typeof seed === 'number' ? seed : hashSeed(String(seed)));

    const rng = {
        next,
        /** Réel dans [min, max[ */
        float: (min, max) => min + next() * (max - min),
        /** Entier dans [min, max] */
        int: (min, max) => min + Math.floor(next() * (max - min + 1)),
        pick: (items) => items[Math.floor(next() * items.length)],
        chance: (probability) => next() < probability,
        /** Un élément de la liste autre que `except` */
        other: (items, except) => {
            const rest = items.filter((item) => item !== except);

            return rest[Math.floor(next() * rest.length)];
        },
        shuffle: (items) => {
            const copy = [...items];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(next() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }

            return copy;
        },
    };

    return rng;
}

export function randomSeed() {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

/** La date du jour à Paris, au format AAAA-MM-JJ : un nouveau Sursaut chaque jour à minuit */
export function todayKey(date = new Date()) {
    return new Intl.DateTimeFormat('fr-CA', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

/** La graine d'une épreuve du Sursaut du jour : la même pour tout le monde ce jour-là */
export function dailySeed(dayKey, gameId) {
    return hashSeed(`sursaut:${dayKey}:${gameId}`);
}

/** La phase (1 à maxPhase) d'un essai, d'après sa place dans la manche */
export function phaseOf(index, count, maxPhase) {
    return Math.min(maxPhase, 1 + Math.floor((index * maxPhase) / count));
}
