/* Accueil : records sur les cartes, état du Sursaut du jour, profil des records */
import { todayKey } from './core/random.js';
import { globalNote } from './core/score.js';
import { load, streak } from './core/storage.js';
import { escape, formatDay } from './ui/dom.js';
import { radar } from './ui/radar.js';

const state = load();
const day = todayKey();

for (const element of document.querySelectorAll('[data-record]')) {
    const record = state.records[element.dataset.record];
    if (record !== undefined) {
        element.textContent = `Record : ${record}/100`;
        element.classList.add('has-record');
    }
}

const status = document.getElementById('daily-status');
status.querySelector('[data-daily-date]').textContent = `Sursaut du ${formatDay(day)}`;
const today = state.daily[day];
if (today) {
    const days = streak(day);
    status.querySelector('.daily-headline').innerHTML = `
        <span class="daily-score">${globalNote(today.notes)}<small>/100</small></span>
        <span class="daily-title">« ${escape(today.title)} »</span>
        ${days > 1 ? `<span class="streak">🔥 ${days} jours de suite</span>` : ''}`;
    status.querySelector('.button').textContent = 'Voir mon résultat';
} else if (streak(day) > 0) {
    status.querySelector('.daily-headline').textContent = `Pas encore joué aujourd'hui. Votre série : 🔥 ${streak(day)} jour${streak(day) > 1 ? 's' : ''}, ne la cassez pas !`;
}

if (Object.keys(state.records).length > 0) {
    document.getElementById('profile-chart').append(radar(state.records, { label: 'Profil de vos records' }));
    document.querySelector('[data-profile-empty]').hidden = true;
} else {
    document.getElementById('profile-chart').append(radar({}, { label: 'Profil vide' }));
}
