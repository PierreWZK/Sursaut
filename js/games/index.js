/* Les quatre épreuves, dans l'ordre du Sursaut du jour */
import contretemps from './contretemps.js';
import feinte from './feinte.js';
import penombre from './penombre.js';
import tympan from './tympan.js';

export const GAMES = [feinte, contretemps, penombre, tympan];

export const gameById = (id) => GAMES.find((game) => game.id === id) ?? null;
