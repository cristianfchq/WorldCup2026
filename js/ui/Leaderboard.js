/** Tabla de posiciones con el puntaje acumulado de cada participante. */
export class Leaderboard {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(rows) {
    if (rows.length === 0) {
      this.container.innerHTML = '<p class="empty-state">Todavía no hay resultados cargados.</p>';
      return;
    }

    const items = rows
      .map(
        (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${row.participantName}</td>
          <td>${row.points}</td>
          <td>${row.matchesScored}</td>
        </tr>
      `
      )
      .join('');

    this.container.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr><th>#</th><th>Participante</th><th># Aciertos</th><th>Partidos calificados</th></tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
    `;
  }
}
