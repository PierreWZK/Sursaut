/*
 * Tous les sons du jeu, générés par Web Audio (aucun fichier audio).
 *
 * Les sons sont programmés sur l'horloge audio (AudioContext.currentTime), la seule assez stable pour un
 * rythme à la milliseconde. toPerf() convertit une heure audio en heure performance.now(), pour la comparer
 * aux appuis du joueur.
 */

let context = null;
const playing = new Set();

/** Le contexte audio, créé (ou réveillé) au premier geste du joueur */
export function audio() {
    context ??= new AudioContext({ latencyHint: 'interactive' });
    if (context.state === 'suspended') {
        context.resume();
    }

    return context;
}

/** Heure audio (s) → heure performance.now() (ms), latence de sortie comprise quand le navigateur la connaît */
export function toPerf(audioTime) {
    const ctx = audio();
    const stamp = ctx.getOutputTimestamp?.();
    if (stamp && stamp.performanceTime > 0) {
        return stamp.performanceTime + (audioTime - stamp.contextTime) * 1000;
    }

    return performance.now() + (audioTime - ctx.currentTime) * 1000 + (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
}

/** Coupe tous les sons programmés (partie quittée ou interrompue) */
export function stopAll() {
    for (const node of playing) {
        try {
            node.stop();
        } catch {
            // Déjà terminé
        }
    }
    playing.clear();
}

function track(node, start, stop) {
    playing.add(node);
    node.onended = () => playing.delete(node);
    node.start(start);
    node.stop(stop);
}

/** Une chaîne volume → panoramique → sortie ; pan peut glisser de `pan` à `panTo` */
function output(ctx, at, { gain = 0.5, pan = 0, panTo = null, duration = 0.2 }) {
    const volume = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, at);
    if (panTo !== null) {
        panner.pan.linearRampToValueAtTime(panTo, at + duration);
    }
    volume.gain.value = gain;
    volume.connect(panner).connect(ctx.destination);

    return volume;
}

/** Une enveloppe brève : attaque de 3 ms, puis décroissance exponentielle */
function envelope(ctx, at, decay, peak = 1) {
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(peak, at + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + decay);

    return amp;
}

function oscillator(ctx, type, frequency, at, stop, destination, glideTo = null, glideTime = 0) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (glideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(glideTo, at + glideTime);
    }
    osc.connect(destination);
    track(osc, at, stop);
}

const SOUNDS = {
    /** Métronome : un « tic » boisé, plus aigu sur le temps fort */
    tick(ctx, at, out, { accent = false } = {}) {
        const amp = envelope(ctx, at, 0.06, accent ? 1 : 0.7);
        amp.connect(out);
        oscillator(ctx, 'triangle', accent ? 1760 : 1180, at, at + 0.08, amp);
        oscillator(ctx, 'sine', accent ? 880 : 590, at, at + 0.08, amp);
    },
    /** Un clic sec */
    click(ctx, at, out) {
        const amp = envelope(ctx, at, 0.05);
        amp.connect(out);
        oscillator(ctx, 'square', 2400, at, at + 0.06, amp, 900, 0.04);
    },
    /** Une goutte qui tombe */
    drop(ctx, at, out) {
        const amp = envelope(ctx, at, 0.18);
        amp.connect(out);
        oscillator(ctx, 'sine', 1400, at, at + 0.2, amp, 380, 0.14);
    },
    /** Une petite cloche */
    bell(ctx, at, out) {
        const amp = envelope(ctx, at, 0.5, 0.8);
        amp.connect(out);
        oscillator(ctx, 'sine', 988, at, at + 0.52, amp);
        oscillator(ctx, 'sine', 988 * 2.76, at, at + 0.3, amp);
    },
    /** Le « bip » qui ment, dans Feinte */
    bip(ctx, at, out) {
        const amp = envelope(ctx, at, 0.12, 0.5);
        amp.connect(out);
        oscillator(ctx, 'square', 660, at, at + 0.13, amp);
    },
    /** Un son tenu, pour les sons qui se déplacent (Tympan) */
    tone(ctx, at, out, { duration = 0.5 } = {}) {
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0.0001, at);
        amp.gain.exponentialRampToValueAtTime(0.7, at + 0.02);
        amp.gain.setValueAtTime(0.7, at + duration - 0.06);
        amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        amp.connect(out);
        oscillator(ctx, 'triangle', 620, at, at + duration + 0.01, amp);
        oscillator(ctx, 'sine', 1240, at, at + duration + 0.01, amp);
    },
};

export const TIMBRES = ['click', 'drop', 'bell'];

/**
 * Joue un son à l'heure audio `at` (par défaut : dans 50 ms).
 * Retourne l'heure audio du début.
 */
export function play(name, { at, pan = 0, panTo = null, gain = 0.5, duration = 0.5, accent = false } = {}) {
    const ctx = audio();
    const start = at ?? ctx.currentTime + 0.05;
    const out = output(ctx, start, { gain, pan, panTo, duration });
    SOUNDS[name](ctx, start, out, { accent, duration });

    return start;
}
