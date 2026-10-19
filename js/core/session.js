/*
 * La boucle des essais, commune aux quatre épreuves.
 *
 * Chaque essai reçoit un signal annulé si le joueur quitte (Quit) ou si la page passe en arrière-plan
 * (Interrupted) : dans ce cas l'essai n'est pas compté, et il est rejoué à l'identique après la pause.
 */
import { stopAll } from './audio.js';
import { Interrupted } from './input.js';

export async function runTrials(stage, specs, trial) {
    const results = [];

    for (let index = 0; index < specs.length;) {
        stage.setCount(index + 1, specs.length);
        const local = new AbortController();
        const onVisibility = () => {
            if (document.hidden) {
                local.abort(new Interrupted());
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        const signal = AbortSignal.any([stage.quitSignal, local.signal]);

        try {
            results.push(await trial(specs[index], index, signal));
            index++;
        } catch (error) {
            if (!(error instanceof Interrupted)) {
                throw error;
            }
            stopAll();
            await stage.waitResume();
        } finally {
            document.removeEventListener('visibilitychange', onVisibility);
        }
    }

    return results;
}

/** Annonce les changements de phase au fil de la manche */
export function phaseTracker(stage, phases, announce = true) {
    let current = 0;

    return async (phase, signal) => {
        if (phase === current) {
            return;
        }
        current = phase;
        const { name, banner } = phases[phase - 1];
        stage.setPhase(phase, name);
        if (announce && banner) {
            await stage.banner(banner.title, banner.text, banner.duration ?? 1600, signal);
        }
    };
}
