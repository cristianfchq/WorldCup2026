import { ParticipantRepository } from './services/ParticipantRepository.js';
import { MatchRepository } from './services/MatchRepository.js';
import { PredictionRepository } from './services/PredictionRepository.js';
import { BetRepository } from './services/BetRepository.js';
import { ScoringService } from './services/ScoringService.js';
import { ImportService } from './services/ImportService.js';
import { AdminAuthService } from './services/AdminAuthService.js';
import { ThemeToggle } from './ui/ThemeToggle.js';
import { Toast } from './ui/Toast.js';
import { PredictionsOverview } from './ui/PredictionsOverview.js';
import { PaymentsSummary } from './ui/PaymentsSummary.js';
import { TabsComponent } from './ui/TabsComponent.js';
import { PHASES } from './config/app-config.js';

const ADMIN_TABS = [
  { key: 'import', label: '📥 Importar' },
  { key: 'results', label: '🏆 Resultados' },
  { key: 'overview', label: '📊 Pronósticos y pagos' },
  { key: 'payments', label: '💳 Resumen de pagos' },
];

/** Orquesta el panel de administración: PIN, importación y carga de resultados. */
class AdminApp {
  constructor() {
    this.authService = new AdminAuthService();
    this.participantRepository = new ParticipantRepository();
    this.matchRepository = new MatchRepository();
    this.predictionRepository = new PredictionRepository();
    this.betRepository = new BetRepository();
    this.scoringService = new ScoringService(
      this.matchRepository,
      this.predictionRepository,
      this.participantRepository,
      this.betRepository
    );
    this.importService = new ImportService(this.participantRepository, this.matchRepository);
    this.predictionsOverview = null; // se crea en showPanel(), cuando el DOM del panel ya existe
    this.paymentsSummary = null;
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
      onUnlock: (prediction) => this.handleUnlockPrediction(prediction),
      onToggleBet: (matchId, participant, paid) => this.handleToggleBet(matchId, participant, paid),
    });

    this.paymentsSummary = new PaymentsSummary(document.getElementById('payments-summary'));

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

  async handleUnlockPrediction(prediction) {
    try {
      await this.predictionRepository.unlock(prediction);
      this.toast.show(`Pronóstico de ${prediction.participantName} desbloqueado ✅`, 'success');
      this.renderPredictionsOverview();
    } catch (error) {
      console.error(error);
      this.toast.show('No se pudo desbloquear', 'error');
    }
  }

  async handleToggleBet(matchId, participant, paid) {
    try {
      await this.betRepository.setPaid(matchId, participant, paid);
      this.toast.show(
        paid ? `Apuesta de ${participant.name} marcada como cancelada ✅` : `Apuesta de ${participant.name} marcada como no cancelada`,
        'success'
      );
      this.renderPredictionsOverview();
    } catch (error) {
      console.error(error);
      this.toast.show('No se pudo actualizar la apuesta', 'error');
    }
  }

  /** Agrupa predicciones y apuestas por matchId y las manda a PredictionsOverview y PaymentsSummary. */
  async renderPredictionsOverview() {
    const [matches, participants, predictions, bets] = await Promise.all([
      this.matchRepository.getAll(),
      this.participantRepository.getAll(),
      this.predictionRepository.getAll(),
      this.betRepository.getAll(),
    ]);

    const predictionsByMatchId = new Map();
    for (const prediction of predictions) {
      if (!predictionsByMatchId.has(prediction.matchId)) predictionsByMatchId.set(prediction.matchId, []);
      predictionsByMatchId.get(prediction.matchId).push(prediction);
    }

    const betsByMatchId = new Map();
    for (const bet of bets) {
      if (!betsByMatchId.has(bet.matchId)) betsByMatchId.set(bet.matchId, []);
      betsByMatchId.get(bet.matchId).push(bet);
    }

    this.predictionsOverview.render(matches, participants, predictionsByMatchId, betsByMatchId);
    this.paymentsSummary.render(participants, matches, predictionsByMatchId, betsByMatchId);
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
