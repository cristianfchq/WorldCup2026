/**
 * Historial personal de apuestas del participante logueado: un row por
 * partido con resultado real ya cargado, mostrando el marcador real, su
 * pronóstico, si acertó (✅/❌), cuánto recibió por esa apuesta y cuánto de
 * ese partido quedó "🏠 Para Whisky" (cuando NADIE acertó el marcador
 * exacto, el pozo entero no se reparte y queda para la casa). Al pie, el
 * total ganado y el total acumulado para whisky, en Bs.
 *
 * Si se pasa `onSelectMatch`, cada fila de partido se vuelve clickeable
 * (igual que el botón "👀 Ver pronósticos" de la tarjeta del partido) y
 * abre el mismo modal con el pronóstico de todos los participantes.
 */
export class ParticipantHistory {
  constructor(containerElement, { onSelectMatch } = {}) {
    this.container = containerElement;
    this.onSelectMatch = onSelectMatch;
  }

  render(rows) {
    this.container.innerHTML = '';

    if (rows.length === 0) {
      this.container.innerHTML =
        '<p class="empty-state">Todavía no hay partidos con resultado real cargado para tus pronósticos.</p>';
      return;
    }

    let totalWon = 0;
    let totalHouse = 0;
    const bodyRows = rows
      .map(({ match, prediction, isWinner, amountReceived, houseAmount }) => {
        totalWon += amountReceived;
        totalHouse += houseAmount;

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

        // Filas mutuamente excluyentes: verde si ESTE participante acertó,
        // cálido/ámbar si NADIE acertó ese partido (pozo para la casa).
        const rowStateClass = isWinner ? 'row--correct' : houseAmount > 0 ? 'row--house' : '';
        const clickableClass = this.onSelectMatch ? ' row--clickable' : '';
        return `
          <tr class="${rowStateClass}${clickableClass}" data-match-id="${match.id}">
            <td>${match.teamA} vs ${match.teamB}</td>
            <td>${realResult}</td>
            <td>${myGuess}</td>
            <td>${isWinner ? '✅' : '❌'}</td>
            <td class="${isWinner ? 'payments-summary-won' : ''}">${isWinner ? `Bs ${formatBs(amountReceived)}` : '—'}</td>
            <td>${houseAmount > 0 ? `Bs ${formatBs(houseAmount)}` : '—'}</td>
          </tr>
        `;
      })
      .join('');

    this.container.innerHTML = `
      <div class="table-scroll">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Partido</th>
              <th>Resultado real</th>
              <th>Mi pronóstico</th>
              <th>Acierto</th>
              <th>Monto recibido</th>
              <th title="Cuando nadie acertó el marcador exacto, el pozo de ese partido queda para la casa">🏠 Para Whisky</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
            <tr class="payments-total-row">
              <td colspan="4">Total ganado</td>
              <td>Bs ${formatBs(totalWon)}</td>
              <td></td>
            </tr>
            <tr class="payments-total-row">
              <td colspan="5">🏠 Para Whisky</td>
              <td>Bs ${formatBs(totalHouse)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    if (this.onSelectMatch) {
      const matchesById = new Map(rows.map(({ match }) => [match.id, match]));
      this.container.querySelectorAll('tbody tr[data-match-id]').forEach((tr) => {
        tr.addEventListener('click', () => this.onSelectMatch(matchesById.get(tr.dataset.matchId)));
      });
    }
  }
}

/** Redondea a 2 decimales pero sin arrastrar ceros innecesarios (7.5, no 7.50). */
function formatBs(amount) {
  return Number(amount.toFixed(2));
}
