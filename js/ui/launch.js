/*
 * Lancer une épreuve, en jeu libre comme dans le Sursaut du jour :
 * les vérifications préalables (test du casque, calibration), puis la partie en plein écran.
 */
import { audio } from '../core/audio.js';
import { getCalibration, headphonesChecked } from '../core/storage.js';
import { createStage } from './stage.js';

/** Test du casque (Tympan) et calibration (Contretemps), une seule fois par appareil */
export async function prepare(game, root) {
    audio();
    let withoutHeadphones = false;
    if (game.id === 'tympan' && !headphonesChecked()) {
        withoutHeadphones = (await game.checkHeadphones(root)) === 'skip';
    }
    if (game.id === 'contretemps' && getCalibration() === null) {
        await game.calibrate(root);
    }

    return { withoutHeadphones };
}

/** Joue la manche `specs` ; retourne la note détaillée. Lève Quit si le joueur quitte. */
export async function playGame(root, game, specs, { withoutHeadphones = false } = {}) {
    audio();
    document.body.classList.add('is-playing');
    const stage = createStage(root, game);
    try {
        if (withoutHeadphones) {
            await stage.banner('Sans casque', 'Avec des haut-parleurs, gauche et droite se mélangent : la note sera faussée.', 2400);
        }
        await stage.countdown();
        const trials = await game.run(stage, specs);

        return game.score(trials);
    } finally {
        stage.destroy();
        document.body.classList.remove('is-playing');
    }
}
