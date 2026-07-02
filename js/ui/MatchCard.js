/**
 * Renderiza un partido individual: nombres de equipos, inputs de marcador,
 * botón de penales y botón de guardar. Tres estados posibles:
 * - Ya se guardó un pronóstico (bloqueado): campos deshabilitados, "🔒 Enviado".
 * - El admin cerró las apuestas de ESTE partido y nunca se guardó nada:
 *   se muestra "Sin pronóstico" en vez de inputs vacíos, con "🚫 Apuestas cerradas".
 * - Ninguno de los anteriores: formulario editable normal, con la opción de
 *   marcar "Penales" cuando el pronóstico es un empate.
 */
export class MatchCard {
  constructor(match, prediction, { onSave }) {
    this.match = match;
    this.prediction = prediction;
    this.onSave = onSave;
  }

  get isSubmitted() {
    return Boolean(this.prediction?.locked);
  }

  get isClosedWithoutPrediction() {
    return Boolean(this.match.bettingClosed) && !this.isSubmitted;
  }

  get isLocked() {
    return this.isSubmitted || Boolean(this.match.bettingClosed);
  }

  render() {
    const article = document.createElement('article');
    article.className = 'match-card';

    const badge = this.isSubmitted
      ? '<span class="badge badge--locked">🔒 Enviado</span>'
      : this.match.bettingClosed
        ? '<span class="badge badge--closed">🚫 Apuestas cerradas</span>'
        : '';

    const scoreArea = this.isClosedWithoutPrediction
      ? '<span class="match-card__no-bet">Sin pronóstico</span>'
      : `
        <div class="match-card__score">
          <input type="number" min="0" class="score-input" data-side="A" value="${this.prediction?.scoreA ?? ''}" />
          <span>-</span>
          <input type="number" min="0" class="score-input" data-side="B" value="${this.prediction?.scoreB ?? ''}" />
        </div>
      `;

    // Validación estricta: el resumen de penales solo se muestra si el
    // pronóstico REALMENTE quedó empatado (evita mostrar algo inconsistente
    // por datos viejos donde el flag pudo quedar mal guardado).
    const predictionIsTie = Boolean(this.prediction) && this.prediction.scoreA === this.prediction.scoreB;
    const penaltyWinnerLabel =
      this.prediction?.wentToPenalties && predictionIsTie
        ? this.prediction.penaltyWinner === 'teamA'
          ? this.match.teamA
          : this.prediction.penaltyWinner === 'teamB'
            ? this.match.teamB
            : null
        : null;

    article.innerHTML = `
      <div class="match-card__teams">
        <span class="match-card__team" data-team="teamA">${this.match.teamA}</span>
        ${scoreArea}
        <span class="match-card__team" data-team="teamB">${this.match.teamB}</span>
      </div>
      <div class="match-card__meta">
        <span>${this.match.time} h · ${this.match.venue}</span>
        ${badge}
      </div>
      ${
        this.isLocked && penaltyWinnerLabel
          ? `<p class="match-card__penalty-info">🎯 Penales: clasifica ${penaltyWinnerLabel}</p>`
          : ''
      }
      <p class="match-card__error" hidden></p>
      ${
        this.isClosedWithoutPrediction
          ? ''
          : `
            <div class="penalty-section" hidden>
              <p class="penalty-section__label">¿Quién clasifica por penales?</p>
              <div class="penalty-section__choices">
                <button type="button" class="btn penalty-choice" data-team="teamA">${this.match.teamA}</button>
                <button type="button" class="btn penalty-choice" data-team="teamB">${this.match.teamB}</button>
              </div>
            </div>
            <div class="match-card__actions">
              <button type="button" class="btn penalty-toggle-btn">🎯 Penales</button>
              <button type="button" class="btn btn--primary match-card__save">Guardar pronóstico</button>
            </div>
          `
      }
    `;

    if (this.isClosedWithoutPrediction) return article;

    const inputs = article.querySelectorAll('.score-input');
    const saveButton = article.querySelector('.match-card__save');
    const penaltyToggleBtn = article.querySelector('.penalty-toggle-btn');
    const penaltySection = article.querySelector('.penalty-section');
    const errorLabel = article.querySelector('.match-card__error');
    const choiceButtons = article.querySelectorAll('.penalty-choice');

    const showError = (message) => {
      errorLabel.textContent = message;
      errorLabel.hidden = false;
    };
    const hideError = () => {
      errorLabel.hidden = true;
    };

    if (this.isLocked) {
      inputs.forEach((input) => (input.disabled = true));
      saveButton.disabled = true;
      saveButton.textContent = this.isSubmitted ? 'Bloqueado' : 'Cerrado';
      penaltyToggleBtn.disabled = true;
      return article;
    }

    let penaltyMode = Boolean(this.prediction?.wentToPenalties);
    let penaltyWinner = this.prediction?.penaltyWinner ?? null;

    const syncPenaltyUI = () => {
      penaltySection.hidden = !penaltyMode;
      penaltyToggleBtn.textContent = penaltyMode ? '🎯 Penales activado' : '🎯 Penales';
      penaltyToggleBtn.classList.toggle('penalty-toggle-btn--active', penaltyMode);
      choiceButtons.forEach((button) => {
        button.classList.toggle('penalty-choice--active', button.dataset.team === penaltyWinner);
      });
    };
    syncPenaltyUI();

    choiceButtons.forEach((button) => {
      button.addEventListener('click', () => {
        penaltyWinner = button.dataset.team;
        hideError();
        syncPenaltyUI();
      });
    });

    penaltyToggleBtn.addEventListener('click', () => {
      // Apagar penales debe funcionar siempre, sin importar qué haya en los
      // campos de marcador (por ejemplo, si el usuario se arrepintió y ya
      // cambió el resultado a uno que no está empatado).
      if (penaltyMode) {
        penaltyMode = false;
        penaltyWinner = null;
        hideError();
        syncPenaltyUI();
        return;
      }

      const scoreAValue = article.querySelector('[data-side="A"]').value;
      const scoreBValue = article.querySelector('[data-side="B"]').value;
      const scoreA = Number(scoreAValue);
      const scoreB = Number(scoreBValue);

      if (scoreAValue === '' || scoreBValue === '' || Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
        return showError('Primero completa el marcador para poder marcar penales.');
      }
      if (scoreA !== scoreB) {
        return showError('Para marcar penales, el marcador debe estar empatado (ej. 1-1).');
      }

      hideError();
      penaltyMode = true;
      syncPenaltyUI();
    });

    saveButton.addEventListener('click', () => {
      const scoreAValue = article.querySelector('[data-side="A"]').value;
      const scoreBValue = article.querySelector('[data-side="B"]').value;

      if (scoreAValue === '' || scoreBValue === '') {
        return showError('Completa los dos campos con tu pronóstico antes de guardar.');
      }

      const scoreA = Number(scoreAValue);
      const scoreB = Number(scoreBValue);
      if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
        return showError('Ingresa un marcador válido.');
      }

      // Es un empate y todavía no se activó "Penales": se activa solo (la
      // misma lógica que el botón) y se pide elegir antes de guardar de verdad.
      if (scoreA === scoreB && !penaltyMode) {
        penaltyMode = true;
        syncPenaltyUI();
        return showError('Es un empate: elige quién clasifica por penales y presiona "Guardar pronóstico" de nuevo.');
      }

      if (penaltyMode) {
        if (scoreA !== scoreB) {
          return showError('El marcador ya no está empatado: desactiva penales o corrígelo.');
        }
        if (!penaltyWinner) {
          return showError('Elige quién clasifica por penales.');
        }
      }

      hideError();
      this.onSave(this.match.id, scoreA, scoreB, {
        wentToPenalties: penaltyMode,
        penaltyWinner: penaltyMode ? penaltyWinner : null,
      });
    });

    return article;
  }
}
