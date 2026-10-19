/*
 * Les tirages des épreuves : reproductibles (Sursaut du jour), et fidèles aux règles du cahier des charges.
 * Les modules des épreuves n'utilisent le navigateur qu'en jouant : plan() se teste avec Node.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../js/core/random.js';
import contretemps, { schedule } from '../js/games/contretemps.js';
import feinte from '../js/games/feinte.js';
import penombre from '../js/games/penombre.js';
import tympan from '../js/games/tympan.js';

const GAMES = [feinte, contretemps, penombre, tympan];

test('une même graine donne la même manche, pour chaque épreuve', () => {
    for (const game of GAMES) {
        assert.deepEqual(game.plan(createRng('2026-10-19'), 20, 4), game.plan(createRng('2026-10-19'), 20, 4), game.id);
    }
});

test('Feinte : environ 40 % de vrais signaux, des leurres qui respectent les phases', () => {
    const specs = feinte.plan(createRng(7), 400, 4);
    const share = specs.filter((spec) => spec.target).length / specs.length;
    assert.ok(share > 0.3 && share < 0.5, `part de vrais signaux : ${share}`);

    for (const spec of specs) {
        assert.ok(spec.gap >= 800 && spec.gap <= 2500);
        if (spec.phase === 1) {
            assert.equal(spec.word, null);
            assert.equal(spec.target, spec.ink === spec.rule);
        } else if (spec.inverted) {
            // Consigne inversée : le vrai signal est tout mot sauf celui de la consigne
            assert.equal(spec.target, spec.word !== spec.rule);
        } else {
            assert.equal(spec.target, spec.word === spec.rule);
        }
        if (spec.phase < 4) {
            assert.equal(spec.inverted, false);
        }
        if (spec.phase < 3) {
            assert.equal(spec.bip, false);
        }
    }
});

test('Feinte phase 3 : le bip accompagne surtout les leurres', () => {
    const phase3 = feinte.plan(createRng(9), 800, 4).filter((spec) => spec.phase === 3);
    const rate = (list) => list.filter((spec) => spec.bip).length / list.length;
    assert.ok(rate(phase3.filter((spec) => !spec.target)) > rate(phase3.filter((spec) => spec.target)) + 0.15);
});

test('Feinte phase 4 : la consigne s\'inverse d\'entrée, puis se rétablit au moins une fois', () => {
    for (let seed = 0; seed < 50; seed++) {
        const phase4 = feinte.plan(createRng(seed), 20, 4).filter((spec) => spec.phase === 4);
        assert.equal(phase4[0].inverted, true, `graine ${seed}`);
        assert.ok(phase4.some((spec) => !spec.inverted), `graine ${seed} : jamais rétablie`);
    }
});

test('Contretemps : le silence ne tombe jamais sur le temps fort, sauf en syncope', () => {
    for (const spec of contretemps.plan(createRng(3), 10, 4)) {
        assert.ok(spec.lead >= 2 && spec.lead <= 3);
        assert.ok(spec.silent < spec.meter);
        if (!spec.syncope) {
            assert.ok(spec.silent >= 1);
        }
    }
    const specs = contretemps.plan(createRng(3), 10, 4);
    // Phase « boiteuse » : 3 temps, puis 5, puis 3…
    assert.deepEqual(specs.filter((spec) => spec.phase === 3).map((spec) => spec.meter), [3, 5, 3]);
    assert.ok(specs.every((spec) => spec.bpm <= 135 && (spec.bpmEnd ?? 0) <= 135));
    // Phase 1 : un tempo stable qui change d'une boucle à l'autre ; phase 2 : un accelerando
    const phase1 = specs.filter((spec) => spec.phase === 1);
    assert.ok(new Set(phase1.map((spec) => spec.bpm)).size === phase1.length);
    assert.ok(specs.filter((spec) => spec.phase === 2).every((spec) => spec.bpmEnd > spec.bpm + 25));
});

test('Contretemps : le silence tombe à sa place, tempo stable, accelerando ou syncope', () => {
    // Tempo stable : 120 bpm (0,5 s), 2 mesures de 4 temps, silence sur le 3e temps de la mesure suivante
    const steady = schedule({ bpm: 120, meter: 4, lead: 2, silent: 2 }, 10);
    assert.equal(steady.events.length, 10);
    assert.ok(Math.abs(steady.silentAt - (10 + 10 * 0.5)) < 1e-9);
    assert.equal(steady.events.filter((event) => event.accent).length, 3);

    // Accelerando : les intervalles raccourcissent, et le silence suit la courbe
    const faster = schedule({ bpm: 90, bpmEnd: 130, meter: 4, lead: 2, silent: 1 }, 0);
    const gaps = faster.events.slice(1).map((event, i) => event.at - faster.events[i].at);
    assert.ok(gaps.every((gap, i) => i === 0 || gap < gaps[i - 1]));
    const lastGap = faster.silentAt - faster.events.at(-1).at;
    assert.ok(lastGap < gaps.at(-1) && lastGap > 60 / 131);

    // Syncope : le silence tombe entre deux temps
    const offbeat = schedule({ bpm: 100, meter: 4, lead: 2, silent: 1, syncope: true }, 0);
    assert.ok(Math.abs(offbeat.silentAt - 9.5 * 0.6) < 1e-9);
    assert.ok(offbeat.events.every((event) => Math.abs(event.at - offbeat.silentAt) > 0.25));
});

test('Pénombre : une lueur au plus par seconde, le mirage loin de la vraie lueur', () => {
    for (const spec of penombre.plan(createRng(11), 40, 4)) {
        assert.ok(spec.gap >= 1000);
        assert.ok(spec.duration >= 80 && spec.duration <= 250);
        if (spec.phase === 4) {
            assert.ok(Math.hypot(spec.decoy.x - spec.x, spec.decoy.y - spec.y) >= 0.35);
        } else {
            assert.equal(spec.decoy, null);
        }
    }
});

test('Tympan : les sons se rapprochent du centre en phase 2, jusqu\'à 15 %', () => {
    const amounts = tympan.plan(createRng(5), 20, 4).filter((spec) => spec.phase === 2).map((spec) => spec.amount);
    assert.equal(amounts[0], 0.7);
    assert.ok(Math.abs(amounts.at(-1) - 0.15) < 1e-9);
    assert.ok(amounts.every((amount, i) => i === 0 || amount < amounts[i - 1]));
});
