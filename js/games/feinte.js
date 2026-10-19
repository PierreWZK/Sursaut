/*
 * 🎭 Feinte — le réflexe de ne pas réagir.
 * Une consigne, puis des signaux : appuyer sur ceux qui la respectent, rester immobile devant les leurres.
 *
 * Chaque phase ajoute un piège différent :
 * 1. Couleur    : touche la bonne couleur (chaque couleur a sa forme).
 * 2. Mot        : le mot compte, pas sa couleur (effet Stroop).
 * 3. Son        : un bip de départ retentit juste AVANT certains signaux, surtout les leurres.
 * 4. Volte-face : la consigne s'inverse, puis se rétablit, plusieurs fois et sans prévenir.
 */
import { play } from '../core/audio.js';
import { nextFrame, now, wait } from '../core/clock.js';
import { buzz, createPresses } from '../core/input.js';
import { phaseOf } from '../core/random.js';
import { scoreFeinte } from '../core/score.js';
import { phaseTracker, runTrials } from '../core/session.js';

/** Chaque couleur a aussi sa forme : la phase 1 reste lisible sans distinguer les couleurs */
const COLORS = {
    rouge: { label: 'ROUGE', hex: '#ff4d5e', shape: 'cercle' },
    bleu: { label: 'BLEU', hex: '#4d8dff', shape: 'carré' },
    vert: { label: 'VERT', hex: '#2fd67a', shape: 'triangle' },
    jaune: { label: 'JAUNE', hex: '#ffd23d', shape: 'losange' },
};
const IDS = Object.keys(COLORS);

const SHAPES = {
    cercle: '<circle cx="50" cy="50" r="42"/>',
    carré: '<rect x="10" y="10" width="80" height="80" rx="6"/>',
    triangle: '<polygon points="50,6 95,90 5,90"/>',
    losange: '<polygon points="50,4 96,50 50,96 4,50"/>',
};

const SIGNAL_MS = 1200;
/** Le bip de la phase 3 part avant le signal, comme le « top » d'un starter */
const BIP_LEAD_MS = 150;

function ruleText(phase, rule, inverted = false) {
    const { label, shape } = COLORS[rule];
    if (phase === 1) return `Touche quand c'est ${label} (${shape})`;
    if (inverted) return `Touche quand le mot ne dit PAS ${label}`;

    return `Touche quand le MOT dit ${label}`;
}

/** Un signal « mot » : vrai ou leurre, avec le piège classique d'un autre mot écrit dans la couleur de la consigne */
function wordSignal(rng, rule, target, inverted) {
    const wanted = !inverted;
    // En consigne normale le vrai signal est le mot de la consigne ; inversée, c'est tout autre mot
    const isRuleWord = target === wanted;
    if (isRuleWord) {
        return { word: rule, ink: rng.chance(0.7) ? rng.other(IDS, rule) : rule };
    }
    const word = rng.other(IDS, rule);

    return { word, ink: rng.chance(0.7) ? rule : rng.other(IDS, word) };
}

export default {
    id: 'feinte',
    name: 'Feinte',
    emoji: '🎭',
    reflex: 'L\'inhibition',
    sense: 'Les yeux (et le son, en phase 3)',
    tagline: 'Vite sur le vrai signal, immobile devant les leurres.',
    rule: 'Une consigne s\'affiche, puis des signaux défilent. Appuie seulement sur ceux qui respectent la consigne : les autres sont des feintes.',
    controls: 'Clic, toucher ou Espace',
    freeCount: 20,
    phases: [
        { name: 'Couleur', text: 'Touche la bonne couleur.' },
        { name: 'Mot', text: 'Le mot compte, pas sa couleur.' },
        { name: 'Son', text: 'Un bip de départ sonne juste avant certains signaux : il ment souvent.' },
        { name: 'Volte-face', text: 'La consigne s\'inverse et se rétablit, plusieurs fois, sans prévenir.' },
    ],
    score: scoreFeinte,
    stats: (s) => [
        ['Temps moyen', s.meanRt === null ? '—' : `${s.meanRt} ms`],
        ['Meilleur temps', s.bestRt === null ? '—' : `${s.bestRt} ms`],
        ['Feintes évitées', `${s.avoided} / ${s.lures}`],
        ['Signaux ratés', `${s.missed} / ${s.targets}`],
        ['Faux départs', String(s.falseStarts)],
    ],

    /** Le tirage de la manche : 40 % de vrais signaux, des leurres pensés pour tromper */
    plan(rng, count, maxPhase) {
        const rule = rng.pick(IDS);
        let inverted = false;
        let sinceSwitch = 0;

        return Array.from({ length: count }, (_, index) => {
            const phase = phaseOf(index, count, maxPhase);
            const target = rng.chance(0.4);
            const gap = rng.int(800, 2500);
            let bip = false;

            if (phase === 1) {
                return { phase, rule, inverted: false, target, gap, word: null, ink: target ? rule : rng.other(IDS, rule), bip };
            }

            if (phase === 4) {
                // Première volte-face en entrant dans la phase, puis des bascules au moins tous les deux signaux
                if (!inverted && sinceSwitch === 0) {
                    inverted = true;
                } else if (sinceSwitch >= 3 || (sinceSwitch >= 2 && rng.chance(0.45))) {
                    inverted = !inverted;
                    sinceSwitch = 0;
                }
                sinceSwitch++;
            }

            if (phase === 3) {
                // Le bip pousse à appuyer : il accompagne surtout les leurres
                bip = target ? rng.chance(0.3) : rng.chance(0.6);
            } else if (phase === 4) {
                bip = rng.chance(0.25);
            }

            return { phase, rule, inverted, target, gap, ...wordSignal(rng, rule, target, inverted), bip };
        });
    },

    async run(stage, specs) {
        const rule = specs[0].rule;
        const fixation = document.createElement('div');
        fixation.className = 'feinte-fixation';
        fixation.textContent = '+';
        const signalEl = document.createElement('div');
        signalEl.className = 'feinte-signal';
        signalEl.hidden = true;
        stage.arena.append(fixation, signalEl);

        const banners = [
            { title: 'Consigne', text: ruleText(1, rule) },
            { title: 'Nouvelle consigne', text: `${ruleText(2, rule)}. Pas sa couleur !` },
            { title: 'Attention au bip', text: 'Un bip de départ sonne juste avant certains signaux. Ne pars pas au son : lis le mot !' },
            { title: 'Volte-face !', text: `${ruleText(4, rule, true)}. Et ça peut changer à tout moment…` },
        ];
        const track = phaseTracker(stage, this.phases.map((phase, i) => ({ ...phase, banner: { ...banners[i], duration: 2400 } })));
        const presses = createPresses(stage.arena);
        let wasInverted = false;

        const show = (spec) => {
            const { hex, label, shape } = COLORS[spec.ink];
            signalEl.style.setProperty('--signal', hex);
            if (spec.word === null) {
                signalEl.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${SHAPES[shape]}</svg>`;
                signalEl.setAttribute('aria-label', `${shape} ${label.toLowerCase()}`);
            } else {
                signalEl.textContent = COLORS[spec.word].label;
                signalEl.removeAttribute('aria-label');
            }
            signalEl.hidden = false;
            fixation.hidden = true;
        };
        const hide = () => {
            signalEl.hidden = true;
            fixation.hidden = false;
        };

        try {
            return await runTrials(stage, specs, async (spec, _index, signal) => {
                hide();
                const enteringPhase = stage.element.dataset.phase !== String(spec.phase);
                stage.element.dataset.phase = String(spec.phase);
                await track(spec.phase, signal);
                // Volte-face en pleine phase : on le crie, et le bandeau change de couleur
                if (!enteringPhase && spec.inverted !== wasInverted) {
                    await stage.banner('Volte-face !', ruleText(spec.phase, rule, spec.inverted), 1300, signal);
                }
                wasInverted = spec.inverted;
                stage.setRule(ruleText(spec.phase, rule, spec.inverted), spec.inverted);

                // Avant le signal, tout appui est un faux départ
                let falseStarts = 0;
                const gapEnd = now() + spec.gap;
                for (let press; (press = await presses.next(gapEnd - now(), signal));) {
                    falseStarts++;
                    stage.feedback('Trop tôt !', 'bad');
                    buzz(60);
                }

                // Le bip part avant le signal : appuyer au son, c'est se faire avoir
                if (spec.bip) {
                    play('bip', { gain: 0.7 });
                    stage.element.classList.remove('is-bip');
                    void stage.element.offsetWidth;
                    stage.element.classList.add('is-bip');
                    const fooled = await presses.next(BIP_LEAD_MS, signal);
                    if (fooled) {
                        falseStarts++;
                        stage.feedback('Le bip t\'a eu !', 'bad');
                        buzz([40, 40, 40]);
                        await wait(BIP_LEAD_MS - (now() - fooled.t), signal);
                    }
                }

                show(spec);
                const onset = await nextFrame();
                const press = await presses.next(SIGNAL_MS - (now() - onset), signal);
                hide();

                let outcome;
                let rt = null;
                if (press) {
                    rt = press.t - onset;
                    if (rt < 100) {
                        // Plus rapide que l'œil : l'appui était parti avant le signal
                        falseStarts++;
                        outcome = spec.target ? 'miss' : 'trap';
                    } else {
                        outcome = spec.target ? 'hit' : 'trap';
                    }
                } else {
                    outcome = spec.target ? 'miss' : 'avoid';
                }

                if (outcome === 'hit') {
                    stage.feedback(`${Math.round(rt)} ms`, rt < 400 ? 'good' : 'mid');
                } else if (outcome === 'trap') {
                    stage.feedback('Feinte !', 'bad');
                    buzz([40, 40, 40]);
                } else if (outcome === 'miss') {
                    stage.feedback('Raté', 'bad');
                } else {
                    stage.feedback('Bien vu', 'good', 600);
                }
                await wait(350, signal);

                return { target: spec.target, outcome, rt: outcome === 'hit' ? rt : null, falseStarts };
            });
        } finally {
            presses.dispose();
            stage.setRule(null);
        }
    },
};
