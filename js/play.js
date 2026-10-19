/* Page d'une épreuve en jeu libre : règle, partie, résultat */
import { Quit } from './core/input.js';
import { createRng, randomSeed, todayKey } from './core/random.js';
import { getCalibration, headphonesChecked, load, saveResult } from './core/storage.js';
import { gameById, GAMES } from './games/index.js';
import { escape } from './ui/dom.js';
import { playGame, prepare } from './ui/launch.js';
import { renderResult } from './ui/result.js';

const app = document.getElementById('app');

/**
 * L'épreuve est dans le fragment de l'adresse (jouer.html#feinte) : contrairement à ?epreuve=…, il survit
 * aux redirections des serveurs qui retirent « .html » (npx serve, adresses « propres » de Netlify).
 * L'ancienne forme ?epreuve=… reste acceptée.
 */
const requested = () => decodeURIComponent(location.hash.slice(1)) || new URLSearchParams(location.search).get('epreuve');
let game = gameById(requested());
let playing = false;

const DURATIONS = { feinte: '1 min', contretemps: '2 min', penombre: '1 min', tympan: '1 min' };

function warnings() {
    if (game.id === 'penombre') {
        return `<p class="notice-inline">⚠️ <strong>Épilepsie photosensible</strong> : de brèves lueurs s'allument dans le noir (jamais de flash plein écran, au plus une par seconde). Si la lumière vous gêne, passez cette épreuve.</p>`;
    }
    if (game.id === 'tympan') {
        return `<p class="notice-inline">🎧 <strong>Casque conseillé</strong> : avec des haut-parleurs, gauche et droite se mélangent.${headphonesChecked() ? ' Casque testé sur cet appareil.' : ' Un test rapide se lance avant la partie.'}</p>`;
    }
    if (game.id === 'contretemps') {
        const calibration = getCalibration();

        return `<p class="notice-inline">🔊 <strong>Son activé</strong>, au casque de préférence. ${calibration === null
            ? 'Une calibration rapide se lance avant la première partie.'
            : `Calibration de cet appareil : ${calibration} ms.`}</p>`;
    }

    return '';
}

function extraActions() {
    if (game.id === 'contretemps' && getCalibration() !== null) {
        return '<button class="button button-ghost" type="button" data-action="calibrate">Recalibrer</button>';
    }
    if (game.id === 'tympan' && headphonesChecked()) {
        return '<button class="button button-ghost" type="button" data-action="headphones">Refaire le test du casque</button>';
    }

    return '';
}

function intro() {
    const record = load().records[game.id];
    const phases = game.phases
        .map((phase) => `<li><strong>${escape(phase.name)}</strong> ${escape(phase.text)}</li>`)
        .join('');

    app.innerHTML = `
        <div class="panel intro" data-game="${game.id}">
            <p class="eyebrow">${game.emoji} ${escape(game.reflex)} · ${escape(game.sense)}</p>
            <h1>${escape(game.name)}</h1>
            <p class="lede">${escape(game.tagline)}</p>
            <p>${escape(game.rule)}</p>
            <ol class="intro-phases">${phases}</ol>
            <ul class="intro-meta">
                <li>🕹️ ${escape(game.controls)}</li>
                <li>⏱️ ${game.freeCount} essais · environ ${DURATIONS[game.id]}</li>
                <li>🏆 ${record === undefined ? 'Pas encore de record' : `Record : ${record}/100`}</li>
            </ul>
            ${warnings()}
            <div class="actions">
                <button class="button button-primary" type="button" data-action="start">Commencer</button>
                ${extraActions()}
            </div>
        </div>`;

    app.querySelector('[data-action="start"]').addEventListener('click', start);
    app.querySelector('[data-action="start"]').focus();
    app.querySelector('[data-action="calibrate"]')?.addEventListener('click', async () => {
        await game.calibrate(app);
        intro();
    });
    app.querySelector('[data-action="headphones"]')?.addEventListener('click', async () => {
        await game.checkHeadphones(app);
        intro();
    });
}

async function start() {
    playing = true;
    try {
        const options = await prepare(game, app);
        const specs = game.plan(createRng(randomSeed()), game.freeCount, 4);
        const score = await playGame(app, game, specs, options);
        const previous = load().records[game.id] ?? null;
        const isRecord = saveResult(game.id, score.note, score, todayKey());
        showResult(score, isRecord, previous);
    } catch (error) {
        if (error instanceof Quit) {
            intro();

            return;
        }
        console.error(error);
        app.innerHTML = '<div class="panel"><h2>Oups</h2><p>La partie s\'est arrêtée sur une erreur. Rechargez la page pour recommencer.</p></div>';
    } finally {
        playing = false;
    }
}

function showResult(score, isRecord, previous) {
    renderResult(app, game, score, {
        isRecord,
        record: isRecord ? null : previous,
        actions: `
            <button class="button button-primary" type="button" data-action="again">Rejouer</button>
            <a class="button button-ghost" href="./#epreuves">Autres épreuves</a>
            <a class="button button-link" href="jour.html">⚡ Sursaut du jour</a>`,
    });
    const again = app.querySelector('[data-action="again"]');
    again.addEventListener('click', start);
    again.focus();
}

/** Adresse sans épreuve (ou inconnue) : on propose les quatre plutôt que de renvoyer ailleurs */
function chooser() {
    document.title = 'Épreuves · Sursaut';
    app.innerHTML = `
        <div class="panel intro">
            <p class="eyebrow">Jeu libre</p>
            <h1>Choisissez une épreuve</h1>
            <ol class="daily-steps">${GAMES.map((item) => `
                <li data-game="${item.id}"><span aria-hidden="true">${item.emoji}</span><a href="#${item.id}"><strong>${escape(item.name)}</strong></a> ${escape(item.tagline)}</li>`).join('')}
            </ol>
        </div>`;
}

function show() {
    document.querySelectorAll('.site-nav a').forEach((link) => link.toggleAttribute('aria-current', link.hash === `#${game?.id}`));
    if (!game) {
        chooser();

        return;
    }
    document.title = `${game.name} · Sursaut`;
    intro();
}

// Le menu change d'épreuve sans recharger la page (pas pendant une partie)
window.addEventListener('hashchange', () => {
    if (playing) {
        return;
    }
    game = gameById(requested());
    show();
});

show();
