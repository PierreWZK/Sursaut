/*
 * Les notes sur 100 de chaque épreuve, et le titre du profil.
 * Fonctions pures, sans navigateur : testées avec node --test (tests/score.test.js).
 */

/** 1 si la valeur est au niveau « bon » ou mieux, 0 au niveau « mauvais » ou pire, linéaire entre les deux */
export function linear(value, good, bad) {
    const ratio = (bad - value) / (bad - good);

    return Math.min(1, Math.max(0, ratio));
}

const clampNote = (note) => Math.min(100, Math.max(0, Math.round(note)));
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const min = (values) => (values.length ? Math.min(...values) : null);
const sum = (values) => values.reduce((total, value) => total + value, 0);

/** Pénalité par faux départ (appui avant le signal, ou moins de 100 ms après) */
export const FALSE_START_PENALTY = 5;

/**
 * 🎭 Feinte. Un essai : { target, outcome: hit | miss | trap | avoid, rt, falseStarts }.
 * 60 % : vitesse sur les vrais signaux (pleine note jusqu'à 250 ms, nulle à 900 ms, un raté vaut 0).
 * 40 % : part des leurres évités.
 */
export function scoreFeinte(trials) {
    const targets = trials.filter((trial) => trial.target);
    const lures = trials.filter((trial) => !trial.target);
    const hits = targets.filter((trial) => trial.outcome === 'hit');
    const avoided = lures.filter((trial) => trial.outcome === 'avoid').length;
    const falseStarts = sum(trials.map((trial) => trial.falseStarts ?? 0));

    const speed = targets.length ? sum(hits.map((trial) => linear(trial.rt, 250, 900))) / targets.length : 1;
    const inhibition = lures.length ? avoided / lures.length : 1;
    const rts = hits.map((trial) => trial.rt);

    return {
        note: clampNote(100 * (0.6 * speed + 0.4 * inhibition) - FALSE_START_PENALTY * falseStarts),
        hits: hits.length,
        targets: targets.length,
        missed: targets.length - hits.length,
        traps: lures.length - avoided,
        avoided,
        lures: lures.length,
        meanRt: rts.length ? Math.round(mean(rts)) : null,
        bestRt: rts.length ? Math.round(min(rts)) : null,
        falseStarts,
    };
}

/**
 * 🥁 Contretemps. Un essai : { error } en ms (négatif = en avance), null si manqué.
 * Pleine note jusqu'à 15 ms d'écart, nulle à 200 ms.
 */
export function scoreContretemps(trials) {
    const played = trials.filter((trial) => trial.error !== null);
    const gaps = played.map((trial) => Math.abs(trial.error));

    return {
        note: clampNote(100 * mean(trials.map((trial) => (trial.error === null ? 0 : linear(Math.abs(trial.error), 15, 200))))),
        meanGap: gaps.length ? Math.round(mean(gaps)) : null,
        bestGap: gaps.length ? Math.round(min(gaps)) : null,
        early: played.filter((trial) => trial.error < 0).length,
        late: played.filter((trial) => trial.error >= 0).length,
        missed: trials.length - played.length,
        count: trials.length,
    };
}

/**
 * 🔦 Pénombre. Un essai : { rt, ratio, decoy, missed, falseStarts }.
 * ratio = écart / plus petit côté de la zone de jeu.
 * 60 % : précision (pleine note sous 4 %, nulle à 25 %). 40 % : vitesse (pleine note à 300 ms, nulle à 1 s).
 * Un essai manqué, ou un clic sur le leurre, vaut 0.
 */
export function scorePenombre(trials) {
    const valid = trials.filter((trial) => !trial.missed && !trial.decoy);
    const falseStarts = sum(trials.map((trial) => trial.falseStarts ?? 0));
    const perTrial = trials.map((trial) => (trial.missed || trial.decoy
        ? 0
        : 0.6 * linear(trial.ratio, 0.04, 0.25) + 0.4 * linear(trial.rt, 300, 1000)));

    return {
        note: clampNote(100 * mean(perTrial) - FALSE_START_PENALTY * falseStarts),
        meanRt: valid.length ? Math.round(mean(valid.map((trial) => trial.rt))) : null,
        bestRt: valid.length ? Math.round(min(valid.map((trial) => trial.rt))) : null,
        meanGap: valid.length ? Math.round(100 * mean(valid.map((trial) => trial.ratio))) : null,
        missed: trials.filter((trial) => trial.missed).length,
        decoys: trials.filter((trial) => trial.decoy).length,
        falseStarts,
        count: trials.length,
    };
}

/**
 * 🎧 Tympan. Un essai : { correct } (null si pas de réponse), { rt, falseStarts }.
 * 50 % : bonnes réponses. 50 % : vitesse des bonnes réponses (pleine note à 250 ms, nulle à 1 s).
 */
export function scoreTympan(trials) {
    const good = trials.filter((trial) => trial.correct === true);
    const count = trials.length || 1;
    const falseStarts = sum(trials.map((trial) => trial.falseStarts ?? 0));
    const speed = sum(good.map((trial) => linear(trial.rt, 250, 1000))) / count;
    const rts = good.map((trial) => trial.rt);

    return {
        note: clampNote(100 * (0.5 * (good.length / count) + 0.5 * speed) - FALSE_START_PENALTY * falseStarts),
        correct: good.length,
        wrong: trials.filter((trial) => trial.correct === false).length,
        missed: trials.filter((trial) => trial.correct === null).length,
        meanRt: rts.length ? Math.round(mean(rts)) : null,
        bestRt: rts.length ? Math.round(min(rts)) : null,
        falseStarts,
        count: trials.length,
    };
}

export const SCORERS = {
    feinte: scoreFeinte,
    contretemps: scoreContretemps,
    penombre: scorePenombre,
    tympan: scoreTympan,
};

/** Le mot qui accompagne une note */
export function grade(note) {
    if (note >= 90) return 'Fulgurant';
    if (note >= 75) return 'Vif';
    if (note >= 55) return 'Alerte';
    if (note >= 35) return 'Engourdi';

    return 'En hibernation';
}

const SPECIALISTS = {
    feinte: 'Le sphinx',
    contretemps: 'Le métronome',
    penombre: 'Le guetteur',
    tympan: 'La chauve-souris',
};

/** Le titre du profil d'après les quatre notes { feinte, contretemps, penombre, tympan } */
export function profileTitle(notes) {
    const entries = Object.entries(notes);
    const values = entries.map(([, note]) => note);
    const average = mean(values);
    const spread = Math.max(...values) - Math.min(...values);

    if (average >= 85) return 'Le chat';
    if (average < 30) return 'La marmotte';
    if (spread <= 12) return 'L\'équilibriste';

    const [best] = entries.reduce((top, entry) => (entry[1] > top[1] ? entry : top));

    return SPECIALISTS[best];
}

export const TITLE_DESCRIPTIONS = {
    'Le chat': 'Des réflexes partout, sans point faible.',
    'La marmotte': 'Pas encore réveillé ? Demain sera meilleur.',
    'L\'équilibriste': 'Aussi bon des yeux que des oreilles.',
    'Le sphinx': 'Impassible devant les leurres.',
    'Le métronome': 'Le rythme dans la peau.',
    'Le guetteur': 'Rien n\'échappe à votre regard.',
    'La chauve-souris': 'Une oreille qui voit dans le noir.',
};

export function globalNote(notes) {
    return clampNote(mean(Object.values(notes)));
}
