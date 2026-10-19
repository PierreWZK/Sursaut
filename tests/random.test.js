import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng, dailySeed, hashSeed, phaseOf, todayKey } from '../js/core/random.js';

test('une même graine redonne exactement la même suite', () => {
    const a = createRng('sursaut');
    const b = createRng('sursaut');
    const c = createRng('autre');
    const draw = (rng) => Array.from({ length: 20 }, () => rng.next());

    const first = draw(a);
    assert.deepEqual(first, draw(b));
    assert.notDeepEqual(first, draw(c));
    assert.ok(first.every((value) => value >= 0 && value < 1));
});

test('les tirages restent dans leurs bornes', () => {
    const rng = createRng(42);
    for (let i = 0; i < 500; i++) {
        const n = rng.int(800, 2500);
        assert.ok(Number.isInteger(n) && n >= 800 && n <= 2500);
        assert.notEqual(rng.other(['a', 'b', 'c'], 'b'), 'b');
    }
});

test('la date du jour est celle de Paris, au format AAAA-MM-JJ', () => {
    // 23 h 30 UTC le 19 octobre = 1 h 30 à Paris le 20 octobre
    assert.equal(todayKey(new Date('2026-10-19T23:30:00Z')), '2026-10-20');
    assert.equal(todayKey(new Date('2026-10-19T10:00:00Z')), '2026-10-19');
});

test('le Sursaut du jour est le même pour tous, différent chaque jour et pour chaque épreuve', () => {
    assert.equal(dailySeed('2026-10-19', 'feinte'), dailySeed('2026-10-19', 'feinte'));
    assert.notEqual(dailySeed('2026-10-19', 'feinte'), dailySeed('2026-10-20', 'feinte'));
    assert.notEqual(dailySeed('2026-10-19', 'feinte'), dailySeed('2026-10-19', 'tympan'));
    assert.equal(hashSeed('abc'), hashSeed('abc'));
});

test('les phases montent régulièrement au fil de la manche', () => {
    const phases = Array.from({ length: 20 }, (_, i) => phaseOf(i, 20, 4));
    assert.deepEqual(phases, [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4]);
    // Sursaut du jour : 8 essais, phases 1 à 3
    assert.deepEqual(Array.from({ length: 8 }, (_, i) => phaseOf(i, 8, 3)), [1, 1, 1, 2, 2, 2, 3, 3]);
});
