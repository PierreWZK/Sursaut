import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    globalNote, grade, linear, profileTitle, scoreContretemps, scoreFeinte, scorePenombre, scoreTympan,
} from '../js/core/score.js';

test('linear : pleine note au niveau « bon », nulle au niveau « mauvais »', () => {
    assert.equal(linear(200, 250, 900), 1);
    assert.equal(linear(250, 250, 900), 1);
    assert.equal(linear(575, 250, 900), 0.5);
    assert.equal(linear(1000, 250, 900), 0);
});

test('Feinte : vitesse sur les vrais signaux et feintes évitées', () => {
    const perfect = [
        { target: true, outcome: 'hit', rt: 240, falseStarts: 0 },
        { target: false, outcome: 'avoid', rt: null, falseStarts: 0 },
    ];
    assert.equal(scoreFeinte(perfect).note, 100);

    // Rapide mais piégé par tous les leurres : 60 au mieux
    const fooled = [
        { target: true, outcome: 'hit', rt: 240, falseStarts: 0 },
        { target: false, outcome: 'trap', rt: null, falseStarts: 0 },
    ];
    assert.equal(scoreFeinte(fooled).note, 60);

    // Immobile : aucune feinte encaissée, mais tous les vrais signaux ratés
    const frozen = [
        { target: true, outcome: 'miss', rt: null, falseStarts: 0 },
        { target: false, outcome: 'avoid', rt: null, falseStarts: 0 },
    ];
    const score = scoreFeinte(frozen);
    assert.equal(score.note, 40);
    assert.equal(score.missed, 1);
    assert.equal(score.meanRt, null);

    // Chaque faux départ coûte 5 points
    assert.equal(scoreFeinte([{ ...perfect[0], falseStarts: 2 }, perfect[1]]).note, 90);
});

test('Contretemps : pleine note sous 15 ms, rien à 200 ms ou sans tap', () => {
    assert.equal(scoreContretemps([{ error: 10 }, { error: -15 }]).note, 100);
    assert.equal(scoreContretemps([{ error: 10 }, { error: null }]).note, 50);
    assert.equal(scoreContretemps([{ error: 250 }]).note, 0);

    const detail = scoreContretemps([{ error: -20 }, { error: 40 }, { error: null }]);
    assert.equal(detail.early, 1);
    assert.equal(detail.late, 1);
    assert.equal(detail.missed, 1);
    assert.equal(detail.meanGap, 30);
});

test('Pénombre : précision et vitesse, le leurre et la lueur manquée valent 0', () => {
    assert.equal(scorePenombre([{ rt: 250, ratio: 0.02, decoy: false, missed: false, falseStarts: 0 }]).note, 100);
    assert.equal(scorePenombre([{ rt: 250, ratio: 0.02, decoy: true, missed: false, falseStarts: 0 }]).note, 0);
    assert.equal(scorePenombre([{ rt: null, ratio: null, decoy: false, missed: true, falseStarts: 0 }]).note, 0);
    // Précis mais lent : seulement la part précision
    assert.equal(scorePenombre([{ rt: 1500, ratio: 0.01, decoy: false, missed: false, falseStarts: 0 }]).note, 60);
});

test('Tympan : bonnes réponses et vitesse des bonnes réponses', () => {
    assert.equal(scoreTympan([{ correct: true, rt: 200, falseStarts: 0 }]).note, 100);
    assert.equal(scoreTympan([{ correct: false, rt: null, falseStarts: 0 }]).note, 0);
    // Une bonne réponse lente sur deux essais : 50 % de bonnes réponses, 0 pour la vitesse
    const score = scoreTympan([{ correct: true, rt: 1200, falseStarts: 0 }, { correct: null, rt: null, falseStarts: 0 }]);
    assert.equal(score.note, 25);
    assert.equal(score.missed, 1);
});

test('les notes restent entre 0 et 100', () => {
    const many = Array.from({ length: 10 }, () => ({ target: true, outcome: 'miss', rt: null, falseStarts: 3 }));
    assert.equal(scoreFeinte(many).note, 0);
});

test('le titre du profil suit les quatre notes', () => {
    assert.equal(profileTitle({ feinte: 90, contretemps: 88, penombre: 92, tympan: 86 }), 'Le chat');
    assert.equal(profileTitle({ feinte: 10, contretemps: 20, penombre: 25, tympan: 30 }), 'La marmotte');
    assert.equal(profileTitle({ feinte: 60, contretemps: 65, penombre: 62, tympan: 58 }), 'L\'équilibriste');
    assert.equal(profileTitle({ feinte: 40, contretemps: 85, penombre: 50, tympan: 45 }), 'Le métronome');
    assert.equal(profileTitle({ feinte: 40, contretemps: 35, penombre: 50, tympan: 90 }), 'La chauve-souris');
    assert.equal(globalNote({ feinte: 82, contretemps: 64, penombre: 71, tympan: 90 }), 77);
});

test('chaque note a son mot', () => {
    assert.equal(grade(95), 'Fulgurant');
    assert.equal(grade(80), 'Vif');
    assert.equal(grade(10), 'En hibernation');
});
