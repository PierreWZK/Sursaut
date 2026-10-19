/*
 * Les appuis du joueur : souris, doigt ou clavier, lus dès l'enfoncement (pointerdown, keydown).
 * Leur date est event.timeStamp, sur la même horloge que performance.now() et requestAnimationFrame.
 */

/** La partie est interrompue (page en arrière-plan) : l'essai en cours est rejoué */
export class Interrupted extends Error {}

/** Le joueur a quitté la partie */
export class Quit extends Error {}

const PRESS_KEYS = [' ', 'Enter'];

const LEFT_KEYS = ['ArrowLeft', 'q', 'Q', 'a', 'A'];
const RIGHT_KEYS = ['ArrowRight', 'd', 'D'];

/** Clavier de Tympan : flèches, Q/A à gauche, D à droite */
export function sideKey(event) {
    if (LEFT_KEYS.includes(event.key)) return 'left';
    if (RIGHT_KEYS.includes(event.key)) return 'right';

    return null;
}

/** Clavier des autres épreuves : Espace ou Entrée */
export function pressKey(event) {
    return PRESS_KEYS.includes(event.key) ? 'press' : null;
}

/**
 * Écoute les appuis sur `area` (et le clavier) ; next() attend le prochain.
 * Les éléments marqués [data-ui] (bouton Quitter…) ne comptent pas comme des appuis.
 */
export function createPresses(area, { mapKey = pressKey, keyboard = true } = {}) {
    let waiter = null;

    const emit = (press) => {
        if (!waiter) {
            return;
        }
        const { resolve, cleanup } = waiter;
        waiter = null;
        cleanup();
        resolve(press);
    };

    const onPointer = (event) => {
        if (event.button > 0 || event.target.closest('[data-ui]')) {
            return;
        }
        event.preventDefault();
        const rect = area.getBoundingClientRect();
        const x = event.clientX - rect.left;
        emit({
            t: event.timeStamp,
            x,
            y: event.clientY - rect.top,
            width: rect.width,
            height: rect.height,
            side: x < rect.width / 2 ? 'left' : 'right',
            source: 'pointer',
        });
    };

    const onKey = (event) => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        const key = mapKey(event);
        if (!key) {
            return;
        }
        event.preventDefault();
        emit({ t: event.timeStamp, key, side: key === 'left' || key === 'right' ? key : null, source: 'keyboard' });
    };

    area.addEventListener('pointerdown', onPointer);
    if (keyboard) {
        window.addEventListener('keydown', onKey);
    }

    return {
        /** Le prochain appui, ou null au bout de `timeout` ms */
        next(timeout, signal) {
            return new Promise((resolve, reject) => {
                if (signal?.aborted) {
                    reject(signal.reason);

                    return;
                }
                const timer = setTimeout(() => {
                    waiter = null;
                    cleanup();
                    resolve(null);
                }, Math.max(0, timeout));
                const onAbort = () => {
                    waiter = null;
                    cleanup();
                    reject(signal.reason);
                };
                const cleanup = () => {
                    clearTimeout(timer);
                    signal?.removeEventListener('abort', onAbort);
                };
                signal?.addEventListener('abort', onAbort, { once: true });
                waiter = { resolve, cleanup };
            });
        },
        dispose() {
            area.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onKey);
            if (waiter) {
                waiter.cleanup();
                waiter = null;
            }
        },
    };
}

/** Un retour au toucher sur mobile, quand le navigateur le permet */
export function buzz(pattern) {
    try {
        navigator.vibrate?.(pattern);
    } catch {
        // Vibration refusée : sans importance
    }
}
