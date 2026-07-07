/**
 * Modal que muestra, para un partido puntual, el pronóstico de TODOS los
 * participantes y cuánto le tocaría a cada uno si gana (mismo criterio de
 * "Total a pagar" que en el panel admin: pozo proyectado como si TODOS ya
 * hubieran pagado, repartido solo entre quienes acertaron el marcador
 * EXACTO). Se abre desde el botón "👀 Ver pronósticos" de cada partido.
 */
export class MatchPredictionsModal {
  show(match, rows) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--predictions';

    const realIsTie = match.hasRealResult && match.realScoreA === match.realScoreB;
    const resultLabel = !match.hasRealResult
      ? 'Sin resultado aún'
      : match.wentToPenalties && realIsTie
        ? `${match.realScoreA} - ${match.realScoreB} (🎯 ${match.penaltyWinner === 'teamA' ? match.teamA : match.teamB})`
        : `${match.realScoreA} - ${match.realScoreB}`;

    const bodyRows = rows
      .map(
        ({ participantName, predictionLabel, isWinner, amountLabel }) => `
          <tr class="${isWinner ? 'row--correct' : ''}">
            <td>${participantName}</td>
            <td>${predictionLabel}</td>
            <td>${amountLabel}</td>
          </tr>
        `
      )
      .join('');

    overlay.innerHTML = `
      <div class="modal-card modal-card--predictions">
        <button type="button" class="icon-btn modal-card__close" aria-label="Cerrar">✕</button>
        <h2>${match.teamA} vs ${match.teamB}</h2>
        <p class="modal-card__result">Resultado: ${resultLabel}</p>
        <div class="modal-card__table-wrapper">
          <table class="leaderboard-table">
            <thead>
              <tr><th>Participante</th><th>Pronóstico</th><th>Total a pagar</th></tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('modal-overlay--visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector('.modal-card__close').addEventListener('click', close);

    requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
  }
}
