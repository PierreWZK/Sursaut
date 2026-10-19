/*
 * 🔦 Pénombre — le réflexe de l'œil.
 * Une lueur s'allume un court instant dans le noir : cliquer là où elle était, vite et près.
 *
 * Épilepsie photosensible : jamais de flash plein écran, au plus une lueur par seconde, lueurs douces.
 */
import { nextFrame, now, wait } from '../core/clock.js';
import { buzz, createPresses } from '../core/input.js';
import { phaseOf } from '../core/random.js';
import { scorePenombre } from '../core/score.js';
import { phaseTracker, runTrials } from '../core/session.js';

const GLOWS = {
    ambre: '#ffc65c',
    cyan: '#5ce1ff',
};

/** Délai de réponse après l'allumage */
const ANSWER_MS = 2000;

function place(rng) {
    return { x: rng.float(0.1, 0.9), y: rng.float(0.14, 0.88) };
}

export default {
    id: 'penombre',
    name: 'Pénombre',
    emoji: '🔦',
    reflex: 'L\'œil',
    sense: 'Les yeux',
    tagline: 'Une lueur dans le noir : clique là où elle était.',
    rule: 'Une lueur s\'allume une fraction de seconde, n\'importe où, puis s\'éteint. Clique (ou touche) là où elle était, le plus vite et le plus près possible.',
    controls: 'Souris ou doigt (il faut viser)',
    freeCount: 20,
    phases: [
        { name: 'Franche', text: 'Une lueur bien visible.' },
        { name: 'Furtive', text: 'Plus courte, plus petite.' },
        { name: 'Pâle', text: 'À peine visible, sur un fond qui ondule.' },
        { name: 'Mirage', text: 'Deux lueurs : une seule est la bonne.' },
    ],
    score: scorePenombre,
    stats: (s) => [
        ['Temps moyen', s.meanRt === null ? '—' : `${s.meanRt} ms`],
        ['Meilleur temps', s.bestRt === null ? '—' : `${s.bestRt} ms`],
        ['Écart moyen', s.meanGap === null ? '—' : `${s.meanGap} % de l'écran`],
        ['Lueurs manquées', `${s.missed} / ${s.count}`],
        ['Mirages', String(s.decoys)],
    ],

    plan(rng, count, maxPhase) {
        const color = rng.pick(Object.keys(GLOWS));
        const decoyColor = Object.keys(GLOWS).find((name) => name !== color);
        const seen = {};

        return Array.from({ length: count }, (_, index) => {
            const phase = phaseOf(index, count, maxPhase);
            const step = seen[phase] = (seen[phase] ?? -1) + 1;
            const settings = [
                { duration: 250, size: 0.17, opacity: 1 },
                { duration: Math.max(80, 150 - 18 * step), size: 0.12, opacity: 1 },
                { duration: 90, size: 0.11, opacity: 0.5 },
                { duration: 130, size: 0.12, opacity: 0.95 },
            ][phase - 1];
            const position = place(rng);
            let decoy = null;
            if (phase === 4) {
                // Le leurre, assez loin de la vraie lueur pour qu'on ne les confonde pas en visant
                do {
                    decoy = place(rng);
                } while (Math.hypot(decoy.x - position.x, decoy.y - position.y) < 0.35);
            }

            return {
                phase,
                color,
                decoyColor,
                gap: rng.int(1000, 2500),
                ...settings,
                ...position,
                decoy,
            };
        });
    },

    async run(stage, specs) {
        const { color, decoyColor } = specs[0];
        const track = phaseTracker(stage, this.phases.map((phase, i) => ({
            ...phase,
            banner: i === 3
                ? { title: 'Mirage', text: `Deux lueurs : vise la ${color}, pas la ${decoyColor}.`, duration: 2200 }
                : { title: phase.name, text: phase.text },
        })));
        const presses = createPresses(stage.arena, { keyboard: false });
        stage.arena.classList.add('penombre-arena');

        const glow = (x, y, size, opacity, hex) => {
            const node = document.createElement('div');
            node.className = 'glow';
            node.style.left = `${x}px`;
            node.style.top = `${y}px`;
            node.style.width = `${size}px`;
            node.style.height = `${size}px`;
            node.style.opacity = String(opacity);
            node.style.setProperty('--glow', hex);
            stage.arena.append(node);

            return node;
        };
        const mark = (className, x, y) => {
            const node = document.createElement('div');
            node.className = `marker ${className}`;
            node.style.left = `${x}px`;
            node.style.top = `${y}px`;
            stage.arena.append(node);
            setTimeout(() => node.remove(), 900);
        };

        try {
            return await runTrials(stage, specs, async (spec, _index, signal) => {
                stage.arena.querySelectorAll('.glow').forEach((node) => node.remove());
                await track(spec.phase, signal);
                stage.arena.classList.toggle('is-drifting', spec.phase === 3);
                stage.setRule(spec.phase === 4 ? `Vise la lueur ${color}` : 'Clique là où la lueur s\'est allumée');

                let falseStarts = 0;
                const gapEnd = now() + spec.gap;
                for (let press; (press = await presses.next(gapEnd - now(), signal));) {
                    falseStarts++;
                    stage.feedback('Trop tôt !', 'bad');
                    buzz(60);
                }

                const { width, height } = stage.arena.getBoundingClientRect();
                const side = Math.min(width, height);
                const size = Math.max(28, spec.size * side);
                const target = { x: spec.x * width, y: spec.y * height };
                const decoy = spec.decoy ? { x: spec.decoy.x * width, y: spec.decoy.y * height } : null;

                const nodes = [glow(target.x, target.y, size, spec.opacity, GLOWS[color])];
                if (decoy) {
                    nodes.push(glow(decoy.x, decoy.y, size, spec.opacity, GLOWS[decoyColor]));
                }
                const onset = await nextFrame();
                const answer = presses.next(ANSWER_MS - (now() - onset), signal);

                // Extinction à la bonne image, ou dès que le joueur clique
                let lit = true;
                const switchOff = () => {
                    lit = false;
                    nodes.forEach((node) => node.remove());
                };
                (async () => {
                    while (lit && now() - onset < spec.duration - 4) {
                        await nextFrame();
                    }
                    switchOff();
                })();

                const press = await answer;
                switchOff();

                if (!press) {
                    stage.feedback('Manquée', 'bad');
                    mark('marker-target', target.x, target.y);
                    await wait(500, signal);

                    return { missed: true, decoy: false, rt: null, ratio: null, falseStarts };
                }

                const rt = press.t - onset;
                const distance = Math.hypot(press.x - target.x, press.y - target.y);
                const fooled = decoy !== null && Math.hypot(press.x - decoy.x, press.y - decoy.y) < distance;
                mark('marker-target', target.x, target.y);
                mark('marker-click', press.x, press.y);

                if (rt < 100) {
                    falseStarts++;
                    stage.feedback('Trop tôt !', 'bad');
                    await wait(500, signal);

                    return { missed: true, decoy: false, rt: null, ratio: null, falseStarts };
                }
                if (fooled) {
                    stage.feedback('Mirage !', 'bad');
                    buzz([40, 40, 40]);
                } else {
                    const ratio = distance / side;
                    stage.feedback(`${Math.round(rt)} ms · ${Math.round(distance)} px`, ratio < 0.06 ? 'good' : ratio < 0.15 ? 'mid' : 'bad');
                }
                await wait(600, signal);

                return { missed: false, decoy: fooled, rt, ratio: distance / side, falseStarts };
            });
        } finally {
            presses.dispose();
            stage.setRule(null);
            stage.arena.classList.remove('is-drifting');
        }
    },
};
