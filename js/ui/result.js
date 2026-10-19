/* L'écran de résultat d'une épreuve : note sur 100, son mot, le détail, le record */
import { grade } from '../core/score.js';
import { countUp, escape } from './dom.js';

export function renderResult(root, game, score, { isRecord = false, record = null, actions = '' } = {}) {
    const rows = game.stats(score)
        .map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`)
        .join('');

    root.innerHTML = `
        <div class="panel result" data-game="${game.id}">
            <p class="eyebrow">${game.emoji} ${escape(game.name)} · ${escape(game.reflex)}</p>
            <p class="result-note"><span class="result-number">0</span><small>/100</small></p>
            <p class="result-grade">${escape(grade(score.note))}</p>
            ${isRecord ? '<p class="badge badge-record">Nouveau record !</p>' : record !== null ? `<p class="result-record">Record : ${record}</p>` : ''}
            <dl class="result-stats">${rows}</dl>
            <div class="actions">${actions}</div>
        </div>`;
    countUp(root.querySelector('.result-number'), score.note);
}
