import { formatReadableDate } from '../utils/DateUtils.js';

/**
 * "Mis deudas": un row por cada partido (con fecha hasta hoy) mostrando si
 * el participante ya pagó su apuesta de ese partido. Debajo de la tabla, un
 * resumen con el total que debería pagar, lo que ya pagó y lo pendiente.
 */
export class ParticipantDebts {
    constructor(containerElement) {
        this.container = containerElement;
    }

    render({ rows, totalDue, totalPaid, totalPending }) {
        this.container.innerHTML = '';

        if (rows.length === 0) {
            this.container.innerHTML = '<p class="empty-state">Todavía no hay partidos con fecha hasta hoy.</p>';
            return;
        }

        const bodyRows = rows
            .map(
                ({ match, paid }) => `
          <tr>
            <td>${match.teamA} vs ${match.teamB}</td>
            <td>${formatReadableDate(match.date)}</td>
            <td class="payments-summary-icon">${paid ? '✅' : '❌'}</td>
          </tr>
        `
            )
            .join('');

        this.container.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr><th>Partido</th><th>Fecha</th><th>Pagado</th></tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="debts-summary">
        <div class="debts-summary__item">
          <span class="debts-summary__label">Total a pagar</span>
          <span class="debts-summary__value">Bs ${formatBs(totalDue)}</span>
        </div>
        <div class="debts-summary__item">
          <span class="debts-summary__label">Ya pagó</span>
          <span class="debts-summary__value payments-summary-won">Bs ${formatBs(totalPaid)}</span>
        </div>
        <div class="debts-summary__item">
          <span class="debts-summary__label">Pendiente</span>
          <span class="debts-summary__value ${totalPending > 0 ? 'payments-summary-pending' : ''}">Bs ${formatBs(totalPending)}</span>
        </div>
      </div>
    `;
    }
}

/** Redondea a 2 decimales pero sin arrastrar ceros innecesarios (7.5, no 7.50). */
function formatBs(amount) {
    return Number(amount.toFixed(2));
}
