/*
 * 🥁 Contretemps — le réflexe du silence.
 * Une boucle rythmique joue ; un temps finit par manquer : taper exactement là où il aurait dû tomber.
 *
 * Les temps sont programmés sur l'horloge audio. L'écart du tap est corrigé par la calibration
 * (latence propre à l'appareil : sortie audio, écran tactile), mesurée une fois et gardée sur l'appareil.
 */
import { audio, play, stopAll, toPerf } from '../core/audio.js';
import { now, wait } from '../core/clock.js';
import { createPresses } from '../core/input.js';
import { phaseOf } from '../core/random.js';
import { scoreContretemps } from '../core/score.js';
import { phaseTracker, runTrials } from '../core/session.js';
import { getCalibration, setCalibration } from '../core/storage.js';

/** Fenêtre d'acceptation autour du temps manquant */
const WINDOW_MS = 250;

/**
 * Les heures audio des temps joués, et celle du temps manquant.
 * Le tempo peut monter d'un temps à l'autre (accelerando, de spec.bpm à spec.bpmEnd) : chaque temps est placé
 * à la suite du précédent, et le silence tombe là où la courbe l'aurait mis.
 */
export function schedule(spec, start) {
    // Index (en temps) du temps manquant
    const total = spec.lead * spec.meter + spec.silent;
    const bpmAt = (beat) => (spec.bpmEnd ? spec.bpm + ((spec.bpmEnd - spec.bpm) * beat) / total : spec.bpm);
    const times = [start];
    for (let beat = 0; beat <= total; beat++) {
        times.push(times[beat] + 60 / bpmAt(beat));
    }
    // Heure d'une position en temps, y compris entre deux temps (syncope)
    const at = (position) => {
        const beat = Math.floor(position);

        return times[beat] + (position - beat) * (times[beat + 1] - times[beat]);
    };

    const events = [];
    if (spec.syncope) {
        // Temps forts de chaque mesure, et les « et » entre les temps : le silence tombe entre deux temps
        for (let measure = 0; measure <= spec.lead; measure++) {
            events.push({ at: at(measure * spec.meter), accent: true });
        }
        for (let beat = 0; beat < total; beat++) {
            events.push({ at: at(beat + 0.5), accent: false });
        }
        events.sort((a, b) => a.at - b.at);

        return { events, silentAt: at(total + 0.5) };
    }

    for (let beat = 0; beat < total; beat++) {
        events.push({ at: at(beat), accent: beat % spec.meter === 0 });
    }

    return { events, silentAt: at(total) };
}

/** Un pouls lumineux qui suit les temps joués, et ne montre rien du silence */
function pulseAt(element, events, timers) {
    for (const event of events) {
        timers.push(setTimeout(() => {
            element.classList.remove('is-beat', 'is-accent');
            void element.offsetWidth;
            element.classList.add('is-beat');
            element.classList.toggle('is-accent', event.accent);
        }, toPerf(event.at) - now()));
    }
}

function describe(error) {
    const rounded = Math.round(error);
    const abs = Math.abs(rounded);
    const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
    if (abs <= 15) return [`${sign}${abs} ms · pile !`, 'good'];
    const side = rounded < 0 ? 'en avance' : 'en retard';

    return [`${sign}${abs} ms · ${side}`, abs <= 60 ? 'mid' : 'bad'];
}

const game = {
    id: 'contretemps',
    name: 'Contretemps',
    emoji: '🥁',
    reflex: 'Le rythme',
    sense: 'Les oreilles',
    tagline: 'Taper pile sur le temps qui manque.',
    rule: 'Une boucle rythmique joue. Un temps finit par manquer : tape exactement là où il aurait dû tomber. Les temps joués ne comptent pas, seul le silence compte.',
    controls: 'Clic, toucher ou Espace',
    freeCount: 10,
    phases: [
        { name: 'Régulier', text: '4 temps, un tempo stable qui change d\'une boucle à l\'autre.' },
        { name: 'Accelerando', text: 'Le tempo accélère pendant la boucle : le silence tombe sur la courbe.' },
        { name: 'Boiteux', text: 'Mesures à 3, puis 5 temps.' },
        { name: 'Syncopé', text: 'Le silence tombe entre deux temps.' },
    ],
    score: scoreContretemps,
    stats: (s) => [
        ['Écart moyen', s.meanGap === null ? '—' : `${s.meanGap} ms`],
        ['Meilleur écart', s.bestGap === null ? '—' : `${s.bestGap} ms`],
        ['En avance / en retard', `${s.early} / ${s.late}`],
        ['Silences manqués', `${s.missed} / ${s.count}`],
    ],

    plan(rng, count, maxPhase) {
        const seen = {};

        return Array.from({ length: count }, (_, index) => {
            const phase = phaseOf(index, count, maxPhase);
            const step = seen[phase] = (seen[phase] ?? -1) + 1;
            const settings = [
                // Tempo stable, mais différent à chaque boucle : impossible de garder le précédent en tête
                { bpm: [84, 112, 96, 124][step % 4], meter: 4, syncope: false },
                // Accelerando : de ~90 à ~130 bpm pendant la boucle elle-même
                { bpm: 88 + 4 * step, bpmEnd: Math.min(135, 124 + 4 * step), meter: 4, syncope: false },
                { bpm: 100, meter: step % 2 === 0 ? 3 : 5, syncope: false },
                { bpm: 92, meter: 4, syncope: true },
            ][phase - 1];
            const lead = rng.int(2, 3);
            const silent = settings.syncope ? rng.int(0, settings.meter - 1) : rng.int(1, settings.meter - 1);

            return { phase, ...settings, lead, silent };
        });
    },

    async run(stage, specs) {
        const pulse = document.createElement('div');
        pulse.className = 'beat-pulse';
        const tempo = document.createElement('p');
        tempo.className = 'beat-tempo';
        stage.arena.append(pulse, tempo);

        const track = phaseTracker(stage, this.phases.map((phase) => ({ ...phase, banner: { title: phase.name, text: phase.text, duration: 2200 } })));
        const presses = createPresses(stage.arena);
        const calibration = getCalibration() ?? 0;

        try {
            return await runTrials(stage, specs, async (spec, _index, signal) => {
                await track(spec.phase, signal);
                tempo.textContent = spec.bpmEnd
                    ? `${spec.bpm} → ${spec.bpmEnd} bpm · ça accélère`
                    : `${spec.bpm} bpm · ${spec.meter} temps${spec.syncope ? ' · contretemps' : ''}`;

                const ctx = audio();
                const { events, silentAt } = schedule(spec, ctx.currentTime + 0.3);
                for (const event of events) {
                    play('tick', { at: event.at, accent: event.accent, gain: 0.55 });
                }
                const timers = [];
                pulseAt(pulse, events, timers);

                try {
                    const expected = toPerf(silentAt);
                    let error = null;
                    // Les taps « avec la musique » arrivent avant la fenêtre : ils sont ignorés
                    for (;;) {
                        const remaining = expected + WINDOW_MS + calibration - now();
                        if (remaining <= 0) break;
                        const press = await presses.next(remaining, signal);
                        if (!press) break;
                        const tap = press.t - calibration;
                        if (tap < expected - WINDOW_MS) continue;
                        error = tap - expected;
                        break;
                    }

                    if (error === null) {
                        stage.feedback('Silence manqué', 'bad');
                    } else {
                        stage.feedback(...describe(error));
                    }
                    await wait(800, signal);

                    return { error };
                } finally {
                    timers.forEach(clearTimeout);
                }
            });
        } finally {
            presses.dispose();
            stopAll();
        }
    },

    /**
     * Calibration : quatre temps pour se caler, puis huit à suivre. La médiane des écarts devient le
     * décalage de l'appareil. Retourne ce décalage, ou null si le joueur passe.
     */
    calibrate(root) {
        return new Promise((resolve, reject) => {
            root.innerHTML = `
                <div class="panel calibration">
                    <p class="eyebrow">Calibration · une fois pour toutes</p>
                    <h2>Tape sur chaque temps</h2>
                    <p>Ton appareil met quelques millisecondes à jouer un son et à sentir ton doigt. On mesure ce décalage pour le corriger : écoute quatre temps, puis tape sur les huit suivants (clic, toucher ou Espace).</p>
                    <div class="calibration-pad">
                        <div class="beat-pulse"></div>
                    </div>
                    <p class="calibration-status" aria-live="polite"></p>
                    <div class="actions" data-ui>
                        <button class="button button-primary" type="button" data-action="start">Commencer</button>
                        <button class="button button-ghost" type="button" data-action="skip">Plus tard</button>
                    </div>
                </div>`;
            const pad = root.querySelector('.calibration-pad');
            const pulse = root.querySelector('.beat-pulse');
            const status = root.querySelector('.calibration-status');
            const startButton = root.querySelector('[data-action="start"]');
            const skipButton = root.querySelector('[data-action="skip"]');

            skipButton.addEventListener('click', () => {
                stopAll();
                resolve(null);
            });

            startButton.addEventListener('click', async () => {
                startButton.disabled = true;
                status.textContent = 'Écoute…';
                const presses = createPresses(pad);
                const timers = [];
                try {
                    const ctx = audio();
                    const period = 0.6;
                    const start = ctx.currentTime + 0.4;
                    const events = Array.from({ length: 12 }, (_, i) => ({ at: start + i * period, accent: i % 4 === 0 }));
                    events.forEach((event) => play('tick', { at: event.at, accent: event.accent, gain: 0.55 }));
                    pulseAt(pulse, events, timers);
                    timers.push(setTimeout(() => { status.textContent = 'À toi : tape sur chaque temps !'; }, toPerf(events[4].at) - now() - 200));

                    const beats = events.slice(4).map((event) => toPerf(event.at));
                    const taps = [];
                    const end = beats.at(-1) + 400;
                    for (let press; (press = await presses.next(end - now()));) {
                        taps.push(press.t);
                    }

                    const offsets = beats
                        .map((beat) => taps.map((tap) => tap - beat).filter((gap) => Math.abs(gap) <= 300)
                            .sort((a, b) => Math.abs(a) - Math.abs(b))[0])
                        .filter((gap) => gap !== undefined)
                        .sort((a, b) => a - b);

                    if (offsets.length < 5) {
                        status.textContent = 'Pas assez de taps en rythme : on recommence ?';
                        startButton.disabled = false;
                        startButton.textContent = 'Recommencer';

                        return;
                    }
                    const median = offsets[Math.floor(offsets.length / 2)];
                    setCalibration(median);
                    status.textContent = `Décalage mesuré : ${Math.round(median)} ms. Il sera corrigé.`;
                    await wait(1400);
                    resolve(median);
                } catch (error) {
                    reject(error);
                } finally {
                    presses.dispose();
                    timers.forEach(clearTimeout);
                }
            });
        });
    },
};

export default game;
