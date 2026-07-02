import { BET_AMOUNT_BS } from '../config/payment-config.js';
import { todayAsIsoDate } from '../utils/DateUtils.js';

/**
 * Matriz participante × partido: un vistazo rápido de quién pagó qué, con el
 * total que le corresponde a cada uno y lo pendiente.
 *
 * La columna "Ganado" y la fila de "la casa" son una PROYECCIÓN: se calculan
 * como si TODOS los participantes ya hubieran pagado (pozo = cantidad total
 * de participantes × BET_AMOUNT_BS), no con base en quién pagó de verdad.
 * Así se puede ver cuánto le tocaría a cada ganador una vez que se cobre
 * todo, sin esperar a que se pongan al día los que deben. La ganancia de la
 * casa es simplemente TOTAL "Debe pagar" − TOTAL "Ganado": lo que sobra sin
 * repartir porque en algunos partidos nadie acertó.
 *
 * Un toggle permite elegir el alcance: por defecto, solo partidos con fecha
 * hasta hoy; la otra opción incluye TODOS los partidos importados (incluso
 * futuros). El componente recuerda los últimos datos recibidos para poder
 * volver a pintarse solo al cambiar el toggle, sin pedirle nada a admin.js.
 */
export class PaymentsSummary {
  constructor(containerElement) {
    this.container = containerElement;
    this.showAllMatches = false;
    this.lastData = null;
  }

  render(participants, allMatches, predictionsByMatchId, betsByMatchId) {
    this.lastData = { participants, allMatches, predictionsByMatchId, betsByMatchId };
    this.renderTable();
  }

  renderTable() {
    this.container.innerHTML = '';
    if (!this.lastData) return;

    const { participants, allMatches, predictionsByMatchId, betsByMatchId } = this.lastData;

    const toggle = this.buildToggle();
    this.container.appendChild(toggle);

    if (participants.length === 0) {
      this.container.insertAdjacentHTML('beforeend', '<p class="empty-state">Todavía no hay participantes importados.</p>');
      return;
    }

    const today = todayAsIsoDate();
    const matches = this.showAllMatches ? allMatches : allMatches.filter((match) => match.date <= today);

    if (matches.length === 0) {
      const message = this.showAllMatches
        ? 'Todavía no hay partidos importados.'
        : 'Todavía no hay partidos con fecha hasta hoy.';
      this.container.insertAdjacentHTML('beforeend', `<p class="empty-state">${message}</p>`);
      return;
    }

    // Una pasada por partido: quién pagó, y cómo se reparte el pozo de ESE
    // partido entre quienes acertaron (si nadie acertó, ese pozo no se
    // reparte, y termina siendo parte de la ganancia de la casa).
    const paidLookup = new Map(); // matchId -> Map(participantId -> paid boolean)
    const winningsByParticipant = new Map(); // participantId -> Bs acumulados

    for (const match of matches) {
      const bets = betsByMatchId.get(match.id) || [];
      paidLookup.set(match.id, new Map(bets.map((b) => [b.participantId, b.paid])));

      // Solo cuenta como ganador de la apuesta quien acertó el marcador
      // EXACTO (guessedExactResult), no quien solo acertó el ganador.
      const predictions = predictionsByMatchId.get(match.id) || [];
      const winners = predictions.filter((p) => p.guessedExactResult(match));
      if (winners.length === 0) continue;

      // Pozo hipotético: como si todos los participantes ya hubieran
      // pagado su apuesta de este partido, no solo los que pagaron de verdad.
      const hypotheticalPool = participants.length * BET_AMOUNT_BS;
      const amountPerWinner = hypotheticalPool / winners.length;
      for (const winner of winners) {
        winningsByParticipant.set(
          winner.participantId,
          (winningsByParticipant.get(winner.participantId) || 0) + amountPerWinner
        );
      }
    }

    const totalDue = matches.length * BET_AMOUNT_BS;

    const headerCells = matches
      .map((match) => `<th title="${match.date}">${match.teamA} vs ${match.teamB}</th>`)
      .join('');

    // Totales acumulados fila por fila, para la fila "TOTAL" del pie.
    let sumDue = 0;
    let sumPaid = 0;
    let sumPending = 0;
    let sumWon = 0;

    const bodyRows = participants
      .map((participant) => {
        let paidCount = 0;
        const cells = matches
          .map((match) => {
            const paid = Boolean(paidLookup.get(match.id)?.get(participant.id));
            if (paid) paidCount += 1;
            return `<td class="payments-summary-icon">${paid ? '✅' : '❌'}</td>`;
          })
          .join('');

        const paidAmount = paidCount * BET_AMOUNT_BS;
        const pending = totalDue - paidAmount;
        const won = formatBs(winningsByParticipant.get(participant.id) || 0);

        sumDue += totalDue;
        sumPaid += paidAmount;
        sumPending += pending;
        sumWon += won;

        return `
          <tr>
            <td>${participant.name}</td>
            ${cells}
            <td>Bs ${totalDue}</td>
            <td>Bs ${paidAmount}</td>
            <td class="${pending > 0 ? 'payments-summary-pending' : ''}">Bs ${pending}</td>
            <td class="payments-summary-won">Bs ${won}</td>
          </tr>
        `;
      })
      .join('');

    // Por cada partido, cuántos de los participantes ya pagaron (real, no proyectado).
    const matchTotalCells = matches
      .map((match) => {
        const paidForMatch = participants.filter((p) => paidLookup.get(match.id)?.get(p.id)).length;
        return `<td class="payments-summary-icon">${paidForMatch}/${participants.length}</td>`;
      })
      .join('');

    const totalsRow = `
      <tr class="payments-total-row">
        <td>TOTAL</td>
        ${matchTotalCells}
        <td>Bs ${formatBs(sumDue)}</td>
        <td>Bs ${formatBs(sumPaid)}</td>
        <td>Bs ${formatBs(sumPending)}</td>
        <td>Bs ${formatBs(sumWon)}</td>
      </tr>
    `;

    // Ganancia de la casa = TOTAL "Debe pagar" - TOTAL "Ganado": lo que
    // sobra sin repartir (los pozos de los partidos sin ningún ganador).
    // OJO: el primer <td> de la fila NO debe llevar colspan, porque
    // .payments-summary-table td:first-child tiene position:sticky y esa
    // combinación hace que el navegador no la pinte bien (queda invisible).
    const houseProfit = sumDue - sumWon;
    const middleColspan = matches.length + 3; // partidos + Debe pagar/Ya pagó/Pendiente
    const houseRow = `
      <tr class="payments-total-row">
        <td>🏠 Para Whisky</td>
        <td colspan="${middleColspan}">Ganancia para la casa (Debe pagar − Ganado, si todos pagan)</td>
        <td>Bs ${formatBs(houseProfit)}</td>
      </tr>
    `;

    const matchWord = matches.length === 1 ? 'partido' : 'partidos';
    const scopeNote = this.showAllMatches
      ? `Contando TODOS los partidos importados: ${matches.length} ${matchWord} (incluye los que todavía no se juegan).`
      : `Contando partidos hasta hoy (${today}): ${matches.length} ${matchWord}. Los partidos futuros no se cobran todavía.`;

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'payments-summary-scroll';
    scrollWrapper.innerHTML = `
      <p class="empty-state" style="padding: 0 0 0.8rem; text-align: left;">${scopeNote}</p>
      <table class="leaderboard-table payments-summary-table">
        <thead>
          <tr>
            <th>Participante</th>
            ${headerCells}
            <th>Debe pagar</th>
            <th>Ya pagó</th>
            <th>Pendiente</th>
            <th title="Calculado como si todos ya hubieran pagado">Ganado (proyectado)</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          ${totalsRow}
          ${houseRow}
        </tbody>
      </table>
    `;

    this.container.appendChild(scrollWrapper);
  }

  buildToggle() {
    const wrapper = document.createElement('label');
    wrapper.className = 'toggle-switch';
    wrapper.innerHTML = `
      <input type="checkbox" ${this.showAllMatches ? 'checked' : ''} />
      <span class="toggle-switch__track"><span class="toggle-switch__thumb"></span></span>
      <span class="toggle-switch__text">${this.showAllMatches ? 'Todos los partidos' : 'Solo hasta hoy'}</span>
    `;
    wrapper.querySelector('input').addEventListener('change', (event) => {
      this.showAllMatches = event.target.checked;
      this.renderTable();
    });
    return wrapper;
  }
}

/** Redondea a 2 decimales pero sin arrastrar ceros innecesarios (7.5, no 7.50). */
function formatBs(amount) {
  return Number(amount.toFixed(2));
}
