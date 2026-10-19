/*
 * Horloges. Tous les temps du jeu sont en millisecondes sur l'horloge de performance.now(),
 * la même que celle des événements (event.timeStamp) et de requestAnimationFrame.
 */

export const now = () => performance.now();

/** La prochaine image : sa date est celle de l'image qui affichera les changements faits juste avant */
export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Attend `ms`, ou s'arrête si le signal est annulé (partie quittée, page en arrière-plan) */
export function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason);

            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, Math.max(0, ms));
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/** Attend jusqu'à l'instant `at` (horloge performance.now) */
export const waitUntil = (at, signal) => wait(at - now(), signal);
