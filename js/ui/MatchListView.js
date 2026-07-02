import { MatchCard } from './MatchCard.js';

/** Pinta los partidos de la fecha activa (la fase y la fecha ya las eligen los tabs de arriba). */
export class MatchListView {
  constructor(containerElement, { onSavePrediction }) {
    this.container = containerElement;
    this.onSavePrediction = onSavePrediction;
  }

  render(matches, predictionsByMatchId) {
    this.container.innerHTML = '';

    if (matches.length === 0) {
      this.container.innerHTML = '<p class="empty-state">Todavía no hay partidos cargados para esta fecha.</p>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'match-day__list';
    matches.forEach((match) => {
      const card = new MatchCard(match, predictionsByMatchId.get(match.id), {
        onSave: this.onSavePrediction,
      });
      list.appendChild(card.render());
    });

    this.container.appendChild(list);
  }
}
