/**
 * Historial personal de apuestas del participante logueado: un row por
 * partido con resultado real ya cargado, mostrando el marcador real, su
 * pronóstico, si acertó (✅/❌) y cuánto recibió por esa apuesta. Al pie,
 * el total ganado en Bs.
 */
export class ParticipantHistory {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(rows) {
    this.container.innerHTML = '';

    if (rows.length === 0) {
      this.container.innerHTML =
        '<p class="empty-state">Todavía no hay partidos con resultado real cargado para tus pronósticos.</p>';
      return;
    }

    let totalWon = 0;
    const bodyRows = rows
      .map(({ match, prediction, isWinner, amountReceived }) => {
        totalWon += amountReceived;

        const realIsTie = match.hasRealResult && match.realScoreA === match.realScoreB;
        const realResult =
          match.wentToPenalties && realIsTie
            ? `${match.realScoreA} - ${match.realScoreB} (🎯 ${match.penaltyWinner === 'teamA' ? match.teamA : match.teamB})`
            : `${match.realScoreA} - ${match.realScoreB}`;

        // Un pronóstico "placeholder" (hasSubmitted: false, creado por el
        // admin al usar "🔓 Desbloquear" con alguien que nunca pronosticó)
        // no es un pronóstico real: se muestra igual que "Sin pronóstico".
        const myGuessIsTie = Boolean(prediction) && prediction.scoreA === prediction.scoreB;
        const myGuess = !prediction?.hasSubmitted
          ? 'Sin pronóstico'
          : prediction.wentToPenalties && myGuessIsTie
            ? `${prediction.scoreA} - ${prediction.scoreB} (🎯 ${prediction.penaltyWinner === 'teamA' ? match.teamA : match.teamB})`
            : `${prediction.scoreA} - ${prediction.scoreB}`;

        return `
          <tr class="${isWinner ? 'row--correct' : ''}">
            <td>${match.teamA} vs ${match.teamB}</td>
            <td>${realResult}</td>
            <td>${myGuess}</td>
            <td>${isWinner ? '✅' : '❌'}</td>
            <td class="${isWinner ? 'payments-summary-won' : ''}">${isWinner ? `Bs ${formatBs(amountReceived)}` : '—'}</td>
          </tr>
        `;
      })
      .join('');

    this.container.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Partido</th>
            <th>Resultado real</th>
            <th>Mi pronóstico</th>
            <th>Acierto</th>
            <th>Monto recibido</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr class="payments-total-row">
            <td colspan="4">Total ganado</td>
            <td>Bs ${formatBs(totalWon)}</td>
          </tr>
        </tbody>
      </table>
    `;
  }
}

/** Redondea a 2 decimales pero sin arrastrar ceros innecesarios (7.5, no 7.50). */
function formatBs(amount) {
  return Number(amount.toFixed(2));
}
