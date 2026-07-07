import { ParticipantRepository } from './services/ParticipantRepository.js';
import { MatchRepository } from './services/MatchRepository.js';
import { PredictionRepository } from './services/PredictionRepository.js';
import { BetRepository } from './services/BetRepository.js';
import { ScoringService } from './services/ScoringService.js';
import { ImportService } from './services/ImportService.js';
import { AdminAuthService } from './services/AdminAuthService.js';
import { Prediction } from './models/Prediction.js';
import { ThemeToggle } from './ui/ThemeToggle.js';
import { Toast } from './ui/Toast.js';
import { PredictionsOverview } from './ui/PredictionsOverview.js';
import { PaymentsSummary } from './ui/PaymentsSummary.js';
import { ParticipantDebts } from './ui/ParticipantDebts.js';
import { ParticipantSelector } from './ui/ParticipantSelector.js';
import { TabsComponent } from './ui/TabsComponent.js';
import { PHASES } from './config/app-config.js';

const ADMIN_TABS = [
  { key: 'import', label: '📥 Importar' },
  { key: 'results', label: '🏆 Resultados' },
  { key: 'overview', label: '📊 Pronósticos y pagos' },
  { key: 'payments', label: '💳 Resumen de pagos' },
  { key: 'debts', label: '💰 Pagos' },
];

/** Orquesta el panel de administración: PIN, importación y carga de resultados. */
class AdminApp {
  constructor() {
    this.authService = new AdminAuthService();
    this.participantRepository = new ParticipantRepository();
    this.matchRepository = new MatchRepository();
    this.predictionRepository = new PredictionRepository();
    this.betRepository = new BetRepository();
    this.scoringService = new ScoringService(this.matchRepository, this.predictionRepository);
    this.importService = new ImportService(this.participantRepository, this.matchRepository);
    this.predictionsOverview = null; // se crea en showPanel(), cuando el DOM del panel ya existe
    this.paymentsSummary = null;
    this.participantDebts = null;
    this.debtsParticipantSelector = null;
    this.selectedDebtsParticipantId = null;

    // Cache en memoria COMPARTIDA entre "Pronósticos y pagos", "Resumen de
    // pagos" y "Pagos": se carga una vez (o con "🔄 Actualizar") y todos los
    // botones que marcan pagos o desbloquean pronósticos (en cualquiera de
    // esas 3 secciones) actualizan esta misma copia y repintan las 3 a la
    // vez, sin volver a leer Firestore. Así un cambio hecho en una sección
    // se refleja al instante en las otras.
    this.matches = [];
    this.participants = [];
    this.predictions = [];
    this.bets = [];
  }

  mount() {
    this.themeToggle = new ThemeToggle(document.getElementById('theme-toggle'));
    this.toast = new Toast(document.getElementById('toast-container'));

    if (this.authService.isUnlocked()) {
      this.showPanel();
    } else {
      this.showGate();
    }
  }

  showAdminTab(key) {
    document.getElementById('admin-tab-import').hidden = key !== 'import';
    document.getElementById('admin-tab-results').hidden = key !== 'results';
    document.getElementById('admin-tab-overview').hidden = key !== 'overview';
    document.getElementById('admin-tab-payments').hidden = key !== 'payments';
    document.getElementById('admin-tab-debts').hidden = key !== 'debts';
  }

  showGate() {
    document.getElementById('admin-gate').hidden = false;
    document.getElementById('admin-panel').hidden = true;

    const form = document.getElementById('admin-gate-form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const pin = document.getElementById('admin-pin-input').value;
      if (this.authService.tryUnlock(pin)) {
        this.showPanel();
      } else {
        this.toast.show('PIN incorrecto', 'error');
      }
    });
  }

  showPanel() {
    document.getElementById('admin-gate').hidden = true;
    document.getElementById('admin-panel').hidden = false;

    document.getElementById('logout-btn').addEventListener('click', () => {
      this.authService.lock();
      window.location.reload();
    });

    document.getElementById('import-participants-btn').addEventListener('click', () => this.importParticipants());
    document.getElementById('import-matches-btn').addEventListener('click', () => this.importMatches());
    document.getElementById('refresh-overview-btn').addEventListener('click', () => this.renderPredictionsOverview());
    document.getElementById('refresh-payments-btn').addEventListener('click', () => this.renderPredictionsOverview());
    document.getElementById('recalculate-all-btn').addEventListener('click', () => this.handleRecalculateAll());

    new TabsComponent(document.getElementById('admin-tabs'), ADMIN_TABS, {
      onChange: (key) => this.showAdminTab(key),
    });

    this.predictionsOverview = new PredictionsOverview(document.getElementById('predictions-overview'), {
      onUnlock: (match, participant, prediction) => this.handleUnlockPrediction(match, participant, prediction),
      onToggleBet: (matchId, participant, paid) => this.handleToggleBet(matchId, participant, paid),
    });

    this.paymentsSummary = new PaymentsSummary(document.getElementById('payments-summary'));

    this.participantDebts = new ParticipantDebts(document.getElementById('admin-participant-debts'));
    this.debtsParticipantSelector = new ParticipantSelector(document.getElementById('debts-participant-select'), {
      onSelect: (id) => this.handleDebtsParticipantChange(id),
    });

    this.renderResultsForm();
    this.renderPredictionsOverview();
  }

  async importParticipants() {
    const file = document.getElementById('participants-file').files[0];
    if (!file) return this.toast.show('Elige primero un archivo .json', 'error');
    try {
      const { created, skipped } = await this.importService.importParticipants(file);
      const skippedText = skipped > 0 ? ` (${skipped} ya existían, no se tocaron)` : '';
      this.toast.show(`${created} participante(s) nuevo(s) importado(s)${skippedText} ✅`, 'success');
      this.renderResultsForm();
      this.renderPredictionsOverview();
    } catch (error) {
      console.error(error);
      this.toast.show(error.message, 'error');
    }
  }

  async importMatches() {
    const file = document.getElementById('matches-file').files[0];
    if (!file) return this.toast.show('Elige primero un archivo .json', 'error');
    try {
      const { created, skipped } = await this.importService.importMatches(file);
      const skippedText = skipped > 0 ? ` (${skipped} ya existían, no se tocaron)` : '';
      this.toast.show(`${created} partido(s) nuevo(s) importado(s)${skippedText} ✅`, 'success');
      this.renderResultsForm();
      this.renderPredictionsOverview();
    } catch (error) {
      console.error(error);
      this.toast.show(error.message, 'error');
    }
  }

  async handleRecalculateAll() {
    try {
      const count = await this.scoringService.recalculateAll();
      this.toast.show(`Puntos recalculados en ${count} partido(s) ✅`, 'success');
      this.renderPredictionsOverview();
    } catch (error) {
      console.error(error);
      this.toast.show('No se pudo recalcular', 'error');
    }
  }

  /**
   * "🔓 Desbloquear" en la tabla de "Pronósticos y pagos", para cualquier
   * participante, incluso los que todavía no pronosticaron nada:
   * - Si ya existía un pronóstico (bloqueado): unlock() lo actualiza
   *   in-place (es el mismo objeto que ya está en this.predictions), así
   *   que solo hace falta repintar desde la caché.
   * - Si no existía ninguno: se crea un pronóstico "placeholder" (0-0, sin
   *   bloquear, hasSubmitted: false) para ese participante. Esto le da una
   *   excepción puntual para pronosticar aunque las apuestas del partido ya
   *   estén cerradas para todos los demás (ver MatchCard.isLocked). Nace en
   *   0-0 porque las reglas de Firestore exigen un marcador numérico válido
   *   al crear un pronóstico, pero hasSubmitted: false evita que ese 0-0 de
   *   relleno cuente como un acierto real si el partido termina justo 0-0
   *   antes de que el participante lo sobrescriba con su pronóstico real.
   */
  async handleUnlockPrediction(match, participant, prediction) {
    try {
      if (prediction) {
        await this.predictionRepository.unlock(prediction);
      } else {
        const placeholder = new Prediction({
          id: Prediction.buildId(match.id, participant.id),
          matchId: match.id,
          participantId: participant.id,
          participantName: participant.name,
          scoreA: 0,
          scoreB: 0,
          locked: false,
          hasSubmitted: false,
        });
        await this.predictionRepository.save(placeholder);
        this.predictions.push(placeholder);
      }
      this.toast.show(`${participant.name} puede volver a pronosticar este partido ✅`, 'success');
      this.repaintPaymentsSections();
    } catch (error) {
      console.error(error);
      this.toast.show('No se pudo habilitar el pronóstico', 'error');
    }
  }

  /** "Apuesta" en la tabla de "Pronósticos y pagos": actualiza this.bets en memoria y repinta las 3 secciones de pagos al instante, sin releer Firestore. */
  async handleToggleBet(matchId, participant, paid) {
    try {
      const bet = await this.betRepository.setPaid(matchId, participant, paid);
      this.upsertCachedBet(bet);

      this.toast.show(
        paid ? `Apuesta de ${participant.name} marcada como cancelada ✅` : `Apuesta de ${participant.name} marcada como no cancelada`,
        'success'
      );
      this.repaintPaymentsSections();
    } catch (error) {
      console.error(error);
      this.toast.show('No se pudo actualizar la apuesta', 'error');
    }
  }

  handleDebtsParticipantChange(participantId) {
    this.selectedDebtsParticipantId = participantId;
    this.renderParticipantDebtsFromCache(participantId);
  }

  /** Misma tabla que "Mis deudas" de la página pública, con una columna extra para marcar el pago. Cálculo puro desde this.matches/this.bets ya cacheados. */
  renderParticipantDebtsFromCache(participantId) {
    const summary = this.scoringService.buildDebtsSummary(participantId, this.matches, this.bets);
    this.participantDebts.render(summary, {
      onTogglePaid: (match, paid) => this.handleToggleDebtPaid(participantId, match, paid),
    });
  }

  /** Botón de pago en la tabla de "Pagos": misma actualización en memoria que handleToggleBet, para que "Pronósticos y pagos" y "Resumen de pagos" se enteren al instante. */
  async handleToggleDebtPaid(participantId, match, paid) {
    const participant = this.participants.find((p) => p.id === participantId);
    if (!participant) return;
    try {
      const bet = await this.betRepository.setPaid(match.id, participant, !paid);
      this.upsertCachedBet(bet);

      this.toast.show(
        !paid ? `Apuesta de ${participant.name} marcada como cancelada ✅` : `Apuesta de ${participant.name} marcada como no cancelada`,
        'success'
      );
      this.repaintPaymentsSections();
    } catch (error) {
      console.error(error);
      this.toast.show('No se pudo actualizar la apuesta', 'error');
    }
  }

  /** Reemplaza (o agrega) un Bet en this.bets, ya que betRepository.setPaid() devuelve un objeto nuevo en vez de mutar uno existente. */
  upsertCachedBet(bet) {
    const index = this.bets.findIndex((b) => b.id === bet.id);
    if (index >= 0) this.bets[index] = bet;
    else this.bets.push(bet);
  }

  /** Trae de Firestore los 4 datasets compartidos y los cachea en memoria. Llamar solo al entrar y desde "🔄 Actualizar"; los botones de pago/desbloqueo NO deben llamar a esto: actualizan la caché y repintan con repaintPaymentsSections(). */
  async renderPredictionsOverview() {
    const [matches, participants, predictions, bets] = await Promise.all([
      this.matchRepository.getAll(),
      this.participantRepository.getAll(),
      this.predictionRepository.getAll(),
      this.betRepository.getAll(),
    ]);

    this.matches = matches;
    this.participants = participants;
    this.predictions = predictions;
    this.bets = bets;
    this.repaintPaymentsSections();
  }

  /**
   * Repinta "Pronósticos y pagos", "Resumen de pagos" y (si hay un
   * participante elegido) la tabla de "Pagos", todo desde la caché en
   * memoria y sin leer Firestore. Es el punto único que hace que un pago
   * marcado en cualquiera de las 3 secciones se vea reflejado en las otras.
   */
  repaintPaymentsSections() {
    const predictionsByMatchId = new Map();
    for (const prediction of this.predictions) {
      if (!predictionsByMatchId.has(prediction.matchId)) predictionsByMatchId.set(prediction.matchId, []);
      predictionsByMatchId.get(prediction.matchId).push(prediction);
    }

    const betsByMatchId = new Map();
    for (const bet of this.bets) {
      if (!betsByMatchId.has(bet.matchId)) betsByMatchId.set(bet.matchId, []);
      betsByMatchId.get(bet.matchId).push(bet);
    }

    this.predictionsOverview.render(this.matches, this.participants, predictionsByMatchId, betsByMatchId);
    this.paymentsSummary.render(this.participants, this.matches, predictionsByMatchId, betsByMatchId);

    this.debtsParticipantSelector.render(this.participants, this.selectedDebtsParticipantId);
    if (this.selectedDebtsParticipantId) this.renderParticipantDebtsFromCache(this.selectedDebtsParticipantId);
  }

  async renderResultsForm() {
    const matches = await this.matchRepository.getAll();
    const container = document.getElementById('results-form');
    container.innerHTML = '';

    if (matches.length === 0) {
      container.innerHTML = '<p class="empty-state">Todavía no importaste partidos.</p>';
      return;
    }

    for (const match of matches) {
      const phaseLabel = PHASES.find((p) => p.key === match.phase)?.label || match.phase;

      const wrapper = document.createElement('div');
      wrapper.className = 'result-row-wrapper';

      // Validación estricta: el sello "🎯 Penales: X" solo se muestra si el
      // marcador real REALMENTE quedó empatado (evita mostrar algo
      // inconsistente si el dato quedó mal guardado de pruebas anteriores).
      const matchWasRealTie = match.hasRealResult && match.realScoreA === match.realScoreB;

      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `
        <span>
          ${phaseLabel} · ${match.teamA} vs ${match.teamB} (${match.date})
          ${match.bettingClosed ? '<span class="badge badge--closed">🚫 Apuestas cerradas</span>' : ''}
          ${match.wentToPenalties && matchWasRealTie ? `<span class="badge badge--closed">🎯 Penales: ${match.penaltyWinner === 'teamA' ? match.teamA : match.teamB}</span>` : ''}
        </span>
        <input type="number" min="0" class="result-score" data-side="A" value="${match.realScoreA ?? ''}" />
        <input type="number" min="0" class="result-score" data-side="B" value="${match.realScoreB ?? ''}" />
        <button type="button" class="btn penalty-toggle-btn ${match.wentToPenalties ? 'penalty-toggle-btn--active' : ''}">
          ${match.wentToPenalties ? '🎯 Penales activado' : '🎯 Penales'}
        </button>
        <button type="button" class="btn btn--primary">Guardar</button>
        <button type="button" class="btn toggle-betting-btn">
          ${match.bettingClosed ? '🔓 Reabrir apuestas' : '🔒 Cerrar apuestas'}
        </button>
      `;
      wrapper.appendChild(row);

      const penaltySection = document.createElement('div');
      penaltySection.className = 'penalty-section';
      penaltySection.hidden = !match.wentToPenalties;
      penaltySection.innerHTML = `
        <p class="penalty-section__label">¿Quién clasificó por penales?</p>
        <div class="penalty-section__choices">
          <button type="button" class="btn penalty-choice ${match.penaltyWinner === 'teamA' ? 'penalty-choice--active' : ''}" data-team="teamA">${match.teamA}</button>
          <button type="button" class="btn penalty-choice ${match.penaltyWinner === 'teamB' ? 'penalty-choice--active' : ''}" data-team="teamB">${match.teamB}</button>
        </div>
      `;
      wrapper.appendChild(penaltySection);

      const errorLabel = document.createElement('p');
      errorLabel.className = 'match-card__error';
      errorLabel.hidden = true;
      wrapper.appendChild(errorLabel);

      const showError = (message) => {
        errorLabel.textContent = message;
        errorLabel.hidden = false;
      };
      const hideError = () => {
        errorLabel.hidden = true;
      };

      let penaltyMode = Boolean(match.wentToPenalties);
      let penaltyWinner = match.penaltyWinner ?? null;
      const choiceButtons = penaltySection.querySelectorAll('.penalty-choice');
      const penaltyToggleBtn = row.querySelector('.penalty-toggle-btn');

      choiceButtons.forEach((button) => {
        button.addEventListener('click', () => {
          penaltyWinner = button.dataset.team;
          hideError();
          choiceButtons.forEach((b) => b.classList.toggle('penalty-choice--active', b === button));
        });
      });

      penaltyToggleBtn.addEventListener('click', () => {
        // Apagar penales debe funcionar siempre, sin importar qué haya en
        // los campos de marcador en ese momento.
        if (penaltyMode) {
          penaltyMode = false;
          penaltyWinner = null;
          hideError();
          penaltySection.hidden = true;
          penaltyToggleBtn.textContent = '🎯 Penales';
          penaltyToggleBtn.classList.remove('penalty-toggle-btn--active');
          choiceButtons.forEach((b) => b.classList.remove('penalty-choice--active'));
          return;
        }

        const scoreAValue = row.querySelector('[data-side="A"]').value;
        const scoreBValue = row.querySelector('[data-side="B"]').value;
        const scoreA = Number(scoreAValue);
        const scoreB = Number(scoreBValue);

        if (scoreAValue === '' || scoreBValue === '' || Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
          return showError('Primero completa el marcador del empate para poder marcar penales.');
        }
        if (scoreA !== scoreB) {
          return showError('Para marcar penales, el marcador debe estar empatado (ej. 1-1).');
        }

        hideError();
        penaltyMode = true;
        penaltySection.hidden = false;
        penaltyToggleBtn.textContent = '🎯 Penales activado';
        penaltyToggleBtn.classList.add('penalty-toggle-btn--active');
      });

      row.querySelector('.btn--primary').addEventListener('click', async () => {
        const scoreA = Number(row.querySelector('[data-side="A"]').value);
        const scoreB = Number(row.querySelector('[data-side="B"]').value);
        if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
          return showError('Ingresa un marcador válido');
        }
        if (penaltyMode) {
          if (scoreA !== scoreB) {
            return showError('El marcador ya no está empatado: desactiva penales o corrígelo.');
          }
          if (!penaltyWinner) {
            return showError('Elige quién clasificó por penales.');
          }
        }
        try {
          hideError();
          await this.matchRepository.saveRealResult(match.id, scoreA, scoreB, penaltyMode, penaltyMode ? penaltyWinner : null);
          await this.scoringService.recalculateForMatch(match.id);
          this.toast.show('Resultado guardado y puntos recalculados ✅', 'success');
          this.renderResultsForm();
          this.renderPredictionsOverview();
        } catch (error) {
          console.error(error);
          showError('No se pudo guardar el resultado (revisa las reglas de Firestore)');
        }
      });

      row.querySelector('.toggle-betting-btn').addEventListener('click', async () => {
        try {
          await this.matchRepository.setBettingClosed(match.id, !match.bettingClosed);
          this.toast.show(
            match.bettingClosed ? 'Apuestas reabiertas para este partido ✅' : 'Apuestas cerradas para este partido ✅',
            'success'
          );
          this.renderResultsForm();
          this.renderPredictionsOverview();
        } catch (error) {
          console.error(error);
          this.toast.show('No se pudo actualizar el estado de apuestas', 'error');
        }
      });

      container.appendChild(wrapper);
    }
  }
}

new AdminApp().mount();
