/*
 * Le Sursaut du jour : les quatre épreuves en version courte (8 essais, phases 1 à 3), avec les mêmes
 * tirages pour tout le monde ce jour-là. Seule la première tentative est gardée.
 */
import { Quit } from './core/input.js';
import { createRng, dailySeed, todayKey } from './core/random.js';
import { globalNote, profileTitle, TITLE_DESCRIPTIONS } from './core/score.js';
import { getDaily, saveDaily, streak } from './core/storage.js';
import { GAMES } from './games/index.js';
import { countUp, escape, formatDay } from './ui/dom.js';
import { playGame, prepare } from './ui/launch.js';
import { radar } from './ui/radar.js';

const DAILY_TRIALS = 8;
const DAILY_PHASES = 3;

const app = document.getElementById('app');
const day = todayKey();

function intro() {
    const done = getDaily(day);
    if (done) {
        showFinal(done.notes, done.title, { saved: false, already: true });

        return;
    }
    const steps = GAMES
        .map((game) => `<li data-game="${game.id}"><span aria-hidden="true">${game.emoji}</span><strong>${escape(game.name)}</strong> ${escape(game.tagline)}</li>`)
        .join('');

    app.innerHTML = `
        <div class="panel intro daily-intro">
            <p class="eyebrow">⚡ Le Sursaut du ${escape(formatDay(day))}</p>
            <h1>Quatre réflexes, trois minutes</h1>
            <p class="lede">Le même tirage pour tout le monde aujourd'hui. Seule votre première tentative compte.</p>
            <ol class="daily-steps">${steps}</ol>
            <ul class="intro-meta">
                <li>⏱️ ${DAILY_TRIALS} essais par épreuve</li>
                <li>🎧 Un casque pour Tympan</li>
                <li>⚠️ Pénombre affiche de brèves lueurs</li>
            </ul>
            <div class="actions">
                <button class="button button-primary" type="button" data-action="start">Commencer</button>
            </div>
        </div>`;
    const button = app.querySelector('[data-action="start"]');
    button.addEventListener('click', () => run({ practice: false }));
    button.focus();
}

/** Un écran entre deux épreuves : la suivante, et la note de la précédente */
function transition(game, index, previous) {
    return new Promise((resolve) => {
        app.innerHTML = `
            <div class="panel intro transition" data-game="${game.id}">
                ${previous ? `<p class="transition-previous">${previous.game.emoji} ${escape(previous.game.name)} : <strong>${previous.note}/100</strong></p>` : ''}
                <p class="eyebrow">Épreuve ${index + 1} / ${GAMES.length} · ${escape(game.reflex)}</p>
                <h1>${game.emoji} ${escape(game.name)}</h1>
                <p class="lede">${escape(game.tagline)}</p>
                <p>${escape(game.rule)}</p>
                <p class="intro-meta-line">🕹️ ${escape(game.controls)}</p>
                <div class="actions">
                    <button class="button button-primary" type="button" data-action="go">C'est parti</button>
                </div>
            </div>`;
        const button = app.querySelector('[data-action="go"]');
        button.addEventListener('click', resolve, { once: true });
        button.focus();
    });
}

async function run({ practice }) {
    const notes = {};
    let previous = null;
    try {
        for (const [index, game] of GAMES.entries()) {
            await transition(game, index, previous);
            const options = await prepare(game, app);
            const specs = game.plan(createRng(dailySeed(day, game.id)), DAILY_TRIALS, DAILY_PHASES);
            const score = await playGame(app, game, specs, options);
            notes[game.id] = score.note;
            previous = { game, note: score.note };
        }
    } catch (error) {
        if (error instanceof Quit) {
            intro();

            return;
        }
        console.error(error);
        app.innerHTML = '<div class="panel"><h2>Oups</h2><p>Le Sursaut s\'est arrêté sur une erreur. Rechargez la page pour recommencer.</p></div>';

        return;
    }

    const title = profileTitle(notes);
    const saved = practice ? false : saveDaily(day, notes, title);
    showFinal(notes, title, { saved, practice });
}

function shareText(notes, title) {
    const n = notes;

    return `Sursaut · ${formatDay(day, true)} · ${globalNote(notes)}/100\n`
        + `🎭 ${n.feinte}  🥁 ${n.contretemps}  🔦 ${n.penombre}  🎧 ${n.tympan}\n`
        + `« ${title} » · ${location.host}${location.pathname.replace(/[^/]*$/, '')}`;
}

async function share(text, button) {
    const label = button.textContent;
    try {
        if (navigator.share && matchMedia('(pointer: coarse)').matches) {
            await navigator.share({ text });

            return;
        }
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copié ✓';
    } catch (error) {
        if (error?.name === 'AbortError') {
            return;
        }
        button.textContent = 'Copie impossible';
    }
    setTimeout(() => {
        button.textContent = label;
    }, 2000);
}

function showFinal(notes, title, { saved = false, already = false, practice = false } = {}) {
    const total = globalNote(notes);
    const days = streak(day);
    const rows = GAMES
        .map((game) => `<li data-game="${game.id}"><span>${game.emoji} ${escape(game.name)}</span><strong>${notes[game.id]}</strong></li>`)
        .join('');
    let status = '';
    if (practice) {
        status = 'Entraînement : cette tentative n\'est pas gardée.';
    } else if (already) {
        status = 'Votre Sursaut du jour est fait. Revenez demain pour un nouveau tirage.';
    } else if (saved) {
        status = 'Note du jour enregistrée.';
    }

    app.innerHTML = `
        <div class="panel final">
            <p class="eyebrow">⚡ Le Sursaut du ${escape(formatDay(day))}</p>
            <div class="final-grid">
                <div>
                    <p class="result-note"><span class="result-number">0</span><small>/100</small></p>
                    <p class="final-title">« ${escape(title)} »</p>
                    <p class="final-description">${escape(TITLE_DESCRIPTIONS[title] ?? '')}</p>
                    <ul class="final-notes">${rows}</ul>
                    ${days > 1 ? `<p class="streak">🔥 ${days} jours de suite</p>` : ''}
                    <p class="final-status">${escape(status)}</p>
                </div>
                <div class="final-radar"></div>
            </div>
            <pre class="share-sample">${escape(shareText(notes, title))}</pre>
            <div class="actions">
                <button class="button button-primary" type="button" data-action="share">Partager</button>
                <button class="button button-ghost" type="button" data-action="practice">S'entraîner sur ce tirage</button>
                <a class="button button-link" href="./#epreuves">Jeu libre</a>
            </div>
        </div>`;

    app.querySelector('.final-radar').append(radar(notes, { label: 'Profil du jour' }));
    countUp(app.querySelector('.result-number'), total);
    const shareButton = app.querySelector('[data-action="share"]');
    shareButton.addEventListener('click', () => share(shareText(notes, title), shareButton));
    app.querySelector('[data-action="practice"]').addEventListener('click', () => run({ practice: true }));
    shareButton.focus();
}

intro();
