/*
 * Le profil de réflexes : quatre axes en losange (inhibition en haut, rythme à droite, œil en bas,
 * oreille à gauche), notes de 0 à 100. SVG sans attribut style (compatible avec la CSP du site).
 */
const SVG = 'http://www.w3.org/2000/svg';

const AXES = [
    { id: 'feinte', label: '🎭 Inhibition', angle: -90 },
    { id: 'contretemps', label: '🥁 Rythme', angle: 0 },
    { id: 'penombre', label: '🔦 Œil', angle: 90 },
    { id: 'tympan', label: '🎧 Oreille', angle: 180 },
];

const node = (name, attributes = {}) => {
    const element = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, String(value));
    }

    return element;
};

const point = (angle, radius) => {
    const rad = (angle * Math.PI) / 180;

    return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)];
};

/** notes : { feinte, contretemps, penombre, tympan } (une note absente compte pour 0) */
export function radar(notes, { label = 'Profil de réflexes' } = {}) {
    const svg = node('svg', { viewBox: '-40 -14 280 228', class: 'radar', role: 'img' });
    svg.setAttribute('aria-label', `${label} : ${AXES.map((axis) => `${axis.label.slice(3)} ${notes[axis.id] ?? 0}`).join(', ')}`);

    for (const level of [25, 50, 75, 100]) {
        const points = AXES.map((axis) => point(axis.angle, (level / 100) * 80).join(',')).join(' ');
        svg.append(node('polygon', { points, class: 'radar-grid' }));
    }
    for (const axis of AXES) {
        const [x, y] = point(axis.angle, 80);
        svg.append(node('line', { x1: 100, y1: 100, x2: x, y2: y, class: 'radar-axis' }));
    }

    const shape = AXES.map((axis) => point(axis.angle, (Math.max(4, notes[axis.id] ?? 0) / 100) * 80).join(',')).join(' ');
    svg.append(node('polygon', { points: shape, class: 'radar-shape' }));

    for (const axis of AXES) {
        const [x, y] = point(axis.angle, (Math.max(4, notes[axis.id] ?? 0) / 100) * 80);
        svg.append(node('circle', { cx: x, cy: y, r: 3.5, class: `radar-dot radar-dot-${axis.id}` }));

        const [lx, ly] = point(axis.angle, 98);
        const anchor = axis.angle === 0 ? 'start' : axis.angle === 180 ? 'end' : 'middle';
        const text = node('text', { x: lx, y: ly + (axis.angle === 90 ? 10 : axis.angle === -90 ? -2 : 4), 'text-anchor': anchor, class: 'radar-label' });
        text.textContent = `${axis.label} ${notes[axis.id] ?? '–'}`;
        svg.append(text);
    }

    return svg;
}
