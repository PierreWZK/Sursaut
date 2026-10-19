/* Petits outils DOM partagés par les pages */

/** Échappe un texte pour l'insérer dans un gabarit HTML */
export function escape(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

/** Fait défiler un nombre de 0 à `value` (instantané si l'utilisateur préfère moins d'animations) */
export function countUp(element, value, duration = 900) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.textContent = String(value);

        return;
    }
    const start = performance.now();
    const step = (time) => {
        const progress = Math.min(1, (time - start) / duration);
        const eased = 1 - (1 - progress) ** 3;
        element.textContent = String(Math.round(value * eased));
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };
    requestAnimationFrame(step);
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** « 2026-10-19 » → « 19 octobre » (ou « 19 oct. ») */
export function formatDay(dayKey, short = false) {
    const date = new Date(`${dayKey}T12:00:00Z`);

    return (short ? shortDayFormat : dayFormat).format(date);
}
