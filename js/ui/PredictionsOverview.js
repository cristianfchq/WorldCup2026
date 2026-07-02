import { groupMatchesByDate, formatReadableDate } from '../utils/DateUtils.js';
import { PHASES } from '../config/app-config.js';
import { BET_AMOUNT_BS } from '../config/payment-config.js';

/**
 * Vista para el admin: por cada partido, muestra el pronóstico de TODOS los
 * participantes (o "Sin pronóstico" si todavía no pronosticó), agrupado por
 * fase y fecha igual que la vista pública. Si un pronóstico ya está
 * bloqueado, ofrece un botón para desbloquearlo (por si el participante se
 * equivocó). También registra, por partido, si cada participante ya pagó su
 * apuesta, con un total recaudado al pie de cada tabla.
 *
 * OJO: "ganador de la apuesta" (fila resaltada, reparto del pozo) exige el
 * marcador EXACTO (Prediction.guessedExactResult). Es distinto de los puntos
 * de la tabla de posiciones general, donde acertar solo el ganador también
 * suma.
 */
export class PredictionsOverview {
  constructor(containerElement, { onUnlock, onToggleBet }) {
    this.container = containerElement;
    this.onUnlock = onUnlock;
    this.onToggleBet = onToggleBet;
  }

  /**
   * @param {Match[]} matches
   * @param {Participant[]} participants
   * @param {Map<string, Prediction[]>} predictionsByMatchId - todas las
   *        predicciones de TODOS los participantes, agrupadas por matchId.
   * @param {Map<string, Bet[]>} betsByMatchId - todos los registros de pago
   *        de apuestas, agrupados por matchId.
   */
  render(matches, participants, predictionsByMatchId, betsByMatchId) {
    this.container.innerHTML = '';

    if (matches.length === 0) {
      this.container.innerHTML = '<p class="empty-state">Todavía no hay partidos importados.</p>';
      return;
    }
    if (participants.length === 0) {
      this.container.innerHTML = '<p class="empty-state">Todavía no hay participantes importados.</p>';
      return;
    }

    for (const phase of PHASES) {
      const matchesOfPhase = matches.filter((m) => m.phase === phase.key);
      if (matchesOfPhase.length === 0) continue;

      const phaseHeading = document.createElement('h3');
      phaseHeading.className = 'match-day__title';
      phaseHeading.textContent = phase.label;
      this.container.appendChild(phaseHeading);

      const groups = groupMatchesByDate(matchesOfPhase);
      for (const [date, matchesOfDate] of groups) {
        const dateHeading = document.createElement('p');
        dateHeading.style.color = 'var(--color-text-muted)';
        dateHeading.style.textTransform = 'capitalize';
        dateHeading.textContent = formatReadableDate(date);
        this.container.appendChild(dateHeading);

        matchesOfDate.forEach((match) => {
          this.container.appendChild(
            this.renderMatchTable(match, participants, predictionsByMatchId, betsByMatchId)
          );
        });
      }
    }
  }

  renderMatchTable(match, participants, predictionsByMatchId, betsByMatchId) {
    const predictions = predictionsByMatchId.get(match.id) || [];
    const predictionByParticipant = new Map(predictions.map((p) => [p.participantId, p]));

    const bets = betsByMatchId.get(match.id) || [];
    const betByParticipant = new Map(bets.map((b) => [b.participantId, b]));

    const wrapper = document.createElement('div');
    wrapper.className = 'admin-section';

    // Validación estricta: solo se muestra "clasificó por penales" si el
    // marcador real REALMENTE está empatado. Evita mostrar algo inconsistente
    // si el flag quedó mal guardado (por ejemplo, de pruebas anteriores).
    const matchWasRealTie = match.hasRealResult && match.realScoreA === match.realScoreB;
    const title = document.createElement('h4');
    title.textContent =
      match.wentToPenalties && matchWasRealTie
        ? `${match.teamA} vs ${match.teamB} (clasificó ${match.penaltyWinner === 'teamA' ? match.teamA : match.teamB} por penales)`
        : `${match.teamA} vs ${match.teamB}`;
    wrapper.appendChild(title);

    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    table.innerHTML =
      '<thead><tr><th>Participante</th><th>Pronóstico</th><th>Estado</th><th>Apuesta</th><th>Monto ganado</th>' +
      '<th title="Lo que le tocaría al ganador si TODOS los participantes ya hubieran pagado">Total a pagar</th>' +
      '<th>Acciones</th></tr></thead>';

    // Primera pasada: cuánto se recaudó y cuántos acertaron el MARCADOR
    // EXACTO (no alcanza con acertar solo el ganador), para poder repartir
    // el pozo entre los ganadores reales en la segunda pasada.
    let paidCount = 0;
    let winnersCount = 0;
    participants.forEach((participant) => {
      if (betByParticipant.get(participant.id)?.paid) paidCount += 1;
      if (predictionByParticipant.get(participant.id)?.guessedExactResult(match)) winnersCount += 1;
    });

    const totalPool = paidCount * BET_AMOUNT_BS;
    const amountPerWinner = winnersCount > 0 ? totalPool / winnersCount : 0;

    // "Total a pagar": no depende de quién pagó de verdad, es la proyección
    // de cuánto le tocaría al ganador si TODOS los participantes pagaran.
    const projectedPool = participants.length * BET_AMOUNT_BS;
    const projectedAmountPerWinner = winnersCount > 0 ? projectedPool / winnersCount : 0;

    const tbody = document.createElement('tbody');

    participants.forEach((participant) => {
      const prediction = predictionByParticipant.get(participant.id);
      const bet = betByParticipant.get(participant.id);
      const isPaid = Boolean(bet?.paid);
      const isWinner = Boolean(prediction?.guessedExactResult(match));

      const row = document.createElement('tr');

      // Igual acá: el pronóstico debe estar REALMENTE empatado para mostrar
      // a quién eligió el participante por penales.
      const predictionIsTie = Boolean(prediction) && prediction.scoreA === prediction.scoreB;
      const penaltyPick =
        prediction?.wentToPenalties && predictionIsTie
          ? ` (🎯 ${prediction.penaltyWinner === 'teamA' ? match.teamA : match.teamB})`
          : '';
      const score = prediction ? `${prediction.scoreA} - ${prediction.scoreB}${penaltyPick}` : '—';
      const status = prediction
        ? prediction.locked
          ? '🔒 Enviado'
          : 'Guardado (sin bloquear)'
        : match.bettingClosed
          ? 'Sin pronóstico (apuestas cerradas)'
          : 'Sin pronóstico';
      const wonAmount = isWinner ? `Bs ${formatBs(amountPerWinner)}` : '—';
      const totalToPay = isWinner ? `Bs ${formatBs(projectedAmountPerWinner)}` : '—';

      // Se resalta solo a quien acertó el marcador exacto (ver
      // guessedExactResult en Prediction.js) — acertar solo el ganador
      // cuenta para la tabla de posiciones general, pero no gana el pozo.
      if (isWinner) row.classList.add('row--correct');

      row.innerHTML = `<td>${participant.name}</td><td>${score}</td><td>${status}</td><td></td><td>${wonAmount}</td><td>${totalToPay}</td><td></td>`;

      const betCell = row.children[3];
      const betButton = document.createElement('button');
      betButton.type = 'button';
      betButton.className = `btn payment-toggle ${isPaid ? 'payment-toggle--paid' : 'payment-toggle--unpaid'}`;
      betButton.textContent = isPaid ? 'Cancelado' : 'No cancelado';
      betButton.addEventListener('click', () => this.onToggleBet(match.id, participant, !isPaid));
      betCell.appendChild(betButton);

      if (prediction?.locked) {
        const unlockButton = document.createElement('button');
        unlockButton.type = 'button';
        unlockButton.className = 'btn';
        unlockButton.textContent = '🔓 Desbloquear';
        unlockButton.addEventListener('click', () => this.onUnlock(prediction));
        row.lastElementChild.appendChild(unlockButton);
      }

      tbody.appendChild(row);
    });

    const totalRow = document.createElement('tr');
    totalRow.className = 'payments-total-row';
    const winnerSummary =
      winnersCount > 0
        ? `Bs ${formatBs(amountPerWinner)} c/u (${winnersCount} ganador${winnersCount === 1 ? '' : 'es'})`
        : '—';
    totalRow.innerHTML = `
      <td colspan="4">Total recaudado en este partido</td>
      <td colspan="3">Bs ${totalPool} · Por ganador: ${winnerSummary}</td>
    `;
    tbody.appendChild(totalRow);

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }
}

/** Redondea a 2 decimales pero sin arrastrar ceros innecesarios (7.5, no 7.50). */
function formatBs(amount) {
  return Number(amount.toFixed(2));
}
