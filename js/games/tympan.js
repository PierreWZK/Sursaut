/*
 * 🎧 Tympan — le réflexe de l'oreille.
 * Au casque, sans rien voir : un son part à gauche ou à droite, il faut choisir le bon côté.
 */
import { audio, play, stopAll, TIMBRES, toPerf } from '../core/audio.js';
import { now, wait } from '../core/clock.js';
import { buzz, createPresses, sideKey } from '../core/input.js';
import { phaseOf } from '../core/random.js';
import { scoreTympan } from '../core/score.js';
import { phaseTracker, runTrials } from '../core/session.js';
import { setHeadphonesChecked } from '../core/storage.js';

const ANSWER_MS = 1500;
const MOVE_SECONDS = 0.5;
const SIDE_LABEL = { left: 'gauche', right: 'droite' };

export default {
    id: 'tympan',
    name: 'Tympan',
    emoji: '🎧',
    reflex: 'L\'oreille',
    sense: 'Les oreilles (casque)',
    tagline: 'Gauche ou droite ? À l\'oreille, sans rien voir.',
    rule: 'Mets ton casque. Un son part à gauche ou à droite : choisis le bon côté, le plus vite possible. L\'écran ne t\'aidera pas.',
    controls: '← → (ou Q et D), ou toucher la moitié gauche ou droite',
    freeCount: 20,
    phases: [
        { name: 'Net', text: 'Tout à gauche ou tout à droite.' },
        { name: 'Proche', text: 'Les sons se rapprochent du centre.' },
        { name: 'Écho', text: 'Un écho répond de l\'autre côté : le premier son a raison.' },
        { name: 'Croisé', text: 'Le son se déplace : c\'est là où il finit qui compte.' },
    ],
    score: scoreTympan,
    stats: (s) => [
        ['Bonnes réponses', `${s.correct} / ${s.count}`],
        ['Temps moyen', s.meanRt === null ? '—' : `${s.meanRt} ms`],
        ['Meilleur temps', s.bestRt === null ? '—' : `${s.bestRt} ms`],
        ['Mauvais côté', String(s.wrong)],
        ['Sans réponse', String(s.missed)],
    ],

    plan(rng, count, maxPhase) {
        const seen = {};
        const phaseLength = {};
        for (let i = 0; i < count; i++) {
            const phase = phaseOf(i, count, maxPhase);
            phaseLength[phase] = (phaseLength[phase] ?? 0) + 1;
        }

        return Array.from({ length: count }, (_, index) => {
            const phase = phaseOf(index, count, maxPhase);
            const step = seen[phase] = (seen[phase] ?? -1) + 1;
            const span = Math.max(1, phaseLength[phase] - 1);
            const base = {
                phase,
                gap: rng.int(1000, 2500),
                side: rng.pick(['left', 'right']),
                timbre: rng.pick(TIMBRES),
            };

            if (phase === 1) return { ...base, mode: 'plain', amount: 1 };
            // Du côté franc vers le centre, jusqu'à 15 %
            if (phase === 2) return { ...base, mode: 'plain', amount: 0.7 - (0.55 * step) / span };
            if (phase === 3) return { ...base, mode: 'echo', amount: 0.8, echoMs: rng.int(80, 140) };

            return { ...base, mode: 'move', amount: 0.9 };
        });
    },

    async run(stage, specs) {
        stage.arena.classList.add('tympan-arena');
        stage.arena.innerHTML = `
            <div class="tympan-half" aria-hidden="true"><span>←</span><small>Q</small></div>
            <div class="tympan-ear" aria-hidden="true">🎧</div>
            <div class="tympan-half" aria-hidden="true"><span>→</span><small>D</small></div>`;
        const ear = stage.arena.querySelector('.tympan-ear');

        const track = phaseTracker(stage, this.phases.map((phase) => ({ ...phase, banner: { title: phase.name, text: phase.text } })));
        const presses = createPresses(stage.arena, { mapKey: sideKey });

        try {
            return await runTrials(stage, specs, async (spec, _index, signal) => {
                await track(spec.phase, signal);

                let falseStarts = 0;
                const gapEnd = now() + spec.gap;
                for (let press; (press = await presses.next(gapEnd - now(), signal));) {
                    falseStarts++;
                    stage.feedback('Trop tôt !', 'bad');
                    buzz(60);
                }

                const ctx = audio();
                const at = ctx.currentTime + 0.06;
                const pan = spec.side === 'left' ? -spec.amount : spec.amount;
                let heardAt = at;
                if (spec.mode === 'move') {
                    play('tone', { at, pan: -pan, panTo: pan, duration: MOVE_SECONDS, gain: 0.45 });
                    // On répond quand le son a fini sa course
                    heardAt = at + MOVE_SECONDS;
                } else {
                    play(spec.timbre, { at, pan, gain: 0.6 });
                    if (spec.mode === 'echo') {
                        play(spec.timbre, { at: at + spec.echoMs / 1000, pan: -pan, gain: 0.38 });
                    }
                }
                const onset = toPerf(heardAt);
                setTimeout(() => {
                    ear.classList.remove('is-on');
                    void ear.offsetWidth;
                    ear.classList.add('is-on');
                }, toPerf(at) - now());

                const press = await presses.next(onset + ANSWER_MS - now(), signal);
                const label = SIDE_LABEL[spec.side];

                if (!press) {
                    stage.feedback(`Trop tard · c'était à ${label}`, 'bad');
                    await wait(600, signal);

                    return { correct: null, rt: null, falseStarts };
                }
                const rt = press.t - onset;
                if (rt < 100) {
                    falseStarts++;
                    stage.feedback('Trop tôt !', 'bad');
                    await wait(600, signal);

                    return { correct: false, rt: null, falseStarts };
                }
                const correct = press.side === spec.side;
                if (correct) {
                    stage.feedback(`✓ ${label} · ${Math.round(rt)} ms`, rt < 450 ? 'good' : 'mid');
                } else {
                    stage.feedback(`✗ c'était à ${label}`, 'bad');
                    buzz([40, 40, 40]);
                }
                await wait(450, signal);

                return { correct, rt: correct ? rt : null, falseStarts };
            });
        } finally {
            presses.dispose();
            stopAll();
        }
    },

    /** Test du casque : un son à gauche, un son à droite. Retourne 'ok' ou 'skip'. */
    checkHeadphones(root) {
        return new Promise((resolve) => {
            root.innerHTML = `
                <div class="panel headphones">
                    <p class="eyebrow">Test du casque</p>
                    <h2>D'où vient le son ?</h2>
                    <p>Deux sons vont partir, l'un après l'autre. Pour chacun, dis de quel côté tu l'entends.</p>
                    <p class="headphones-step" aria-live="polite"></p>
                    <div class="actions headphones-answers" hidden>
                        <button class="button button-ghost" type="button" data-side="left">← Gauche</button>
                        <button class="button button-ghost" type="button" data-side="right">Droite →</button>
                    </div>
                    <div class="actions">
                        <button class="button button-primary" type="button" data-action="start">Écouter</button>
                        <button class="button button-link" type="button" data-action="skip">Jouer sans casque</button>
                    </div>
                </div>`;
            const step = root.querySelector('.headphones-step');
            const answers = root.querySelector('.headphones-answers');
            const startButton = root.querySelector('[data-action="start"]');

            root.querySelector('[data-action="skip"]').addEventListener('click', () => resolve('skip'));

            const ask = (side) => new Promise((done) => {
                play('bell', { pan: side === 'left' ? -1 : 1, gain: 0.6 });
                answers.hidden = false;
                answers.querySelectorAll('button').forEach((button) => {
                    button.onclick = () => {
                        answers.hidden = true;
                        done(button.dataset.side);
                    };
                });
            });

            startButton.addEventListener('click', async () => {
                startButton.hidden = true;
                step.textContent = 'Premier son…';
                const first = await ask('left');
                step.textContent = 'Second son…';
                await wait(300);
                const second = await ask('right');

                if (first === 'left' && second === 'right') {
                    setHeadphonesChecked();
                    step.textContent = 'Parfait, ton casque est prêt.';
                    await wait(900);
                    resolve('ok');
                } else {
                    step.textContent = first === 'right' && second === 'left'
                        ? 'Les côtés sont inversés : ton casque est peut-être à l\'envers. Retourne-le et recommence.'
                        : 'Ce n\'est pas clair : vérifie que le son est bien en stéréo, puis recommence.';
                    startButton.hidden = false;
                    startButton.textContent = 'Recommencer';
                }
            });
        });
    },
};
