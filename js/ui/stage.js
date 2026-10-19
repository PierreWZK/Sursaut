/*
 * La scène d'une partie : bandeau (épreuve, phase, consigne, compteur, Quitter), zone de jeu, retour
 * après chaque essai, et les écrans posés par-dessus (compte à rebours, annonces, pause).
 */
import { wait } from '../core/clock.js';
import { Quit } from '../core/input.js';

const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;

    return node;
};

export function createStage(root, game) {
    root.replaceChildren();
    const stage = el('div', 'stage');
    stage.dataset.game = game.id;

    const hud = el('header', 'hud');
    hud.dataset.ui = '';
    const name = el('span', 'hud-name', `${game.emoji} ${game.name}`);
    const phase = el('span', 'hud-phase');
    const count = el('span', 'hud-count');
    const quit = el('button', 'hud-quit', 'Quitter');
    quit.type = 'button';
    hud.append(name, phase, count, quit);

    const rule = el('p', 'hud-rule');
    rule.hidden = true;

    const arena = el('div', 'arena');
    const feedback = el('p', 'feedback');
    feedback.setAttribute('aria-live', 'polite');
    const overlay = el('div', 'overlay');
    overlay.hidden = true;

    stage.append(hud, rule, arena, feedback, overlay);
    root.append(stage);

    const quitter = new AbortController();
    quit.addEventListener('click', () => quitter.abort(new Quit()));

    let feedbackTimer = null;

    return {
        element: stage,
        arena,
        quitSignal: quitter.signal,

        setPhase(number, label) {
            phase.textContent = `Phase ${number} · ${label}`;
        },
        setCount(index, total) {
            count.textContent = `${index} / ${total}`;
        },
        /** La consigne en cours, toujours visible pendant la partie (Feinte, Pénombre) ; en rouge si inversée */
        setRule(text, inverted = false) {
            rule.hidden = !text;
            rule.textContent = text ?? '';
            rule.classList.toggle('is-inverted', inverted);
        },
        feedback(text, tone = '', duration = 900) {
            clearTimeout(feedbackTimer);
            feedback.textContent = text;
            feedback.dataset.tone = tone;
            feedback.classList.remove('is-shown');
            // Relance l'animation même si le texte ne change pas
            void feedback.offsetWidth;
            feedback.classList.add('is-shown');
            feedbackTimer = setTimeout(() => feedback.classList.remove('is-shown'), duration);
        },
        /** Une annonce plein écran (nouvelle phase, volte-face…) */
        async banner(title, subtitle = '', duration = 1600, signal = quitter.signal) {
            overlay.replaceChildren(el('p', 'overlay-title', title), el('p', 'overlay-text', subtitle));
            overlay.hidden = false;
            try {
                await wait(duration, signal);
            } finally {
                overlay.hidden = true;
            }
        },
        async countdown(signal = quitter.signal) {
            for (const step of ['3', '2', '1']) {
                overlay.replaceChildren(el('p', 'overlay-count', step));
                overlay.hidden = false;
                await wait(600, signal);
            }
            overlay.hidden = true;
        },
        /** Page revenue au premier plan : le joueur reprend quand il est prêt */
        waitResume() {
            return new Promise((resolve, reject) => {
                const button = el('button', 'button button-primary', 'Reprendre');
                button.type = 'button';
                button.dataset.ui = '';
                overlay.replaceChildren(
                    el('p', 'overlay-title', 'Pause'),
                    el('p', 'overlay-text', 'La page est passée en arrière-plan : l\'essai en cours sera rejoué.'),
                    button,
                );
                overlay.hidden = false;
                const onQuit = () => reject(quitter.signal.reason);
                quitter.signal.addEventListener('abort', onQuit, { once: true });
                button.addEventListener('click', () => {
                    quitter.signal.removeEventListener('abort', onQuit);
                    overlay.hidden = true;
                    resolve();
                }, { once: true });
                button.focus();
            });
        },
        destroy() {
            clearTimeout(feedbackTimer);
            if (!quitter.signal.aborted) {
                quitter.abort(new Quit());
            }
            root.replaceChildren();
        },
    };
}
