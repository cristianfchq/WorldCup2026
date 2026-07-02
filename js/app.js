import { ParticipantRepository } from './services/ParticipantRepository.js';
import { MatchRepository } from './services/MatchRepository.js';
import { PredictionRepository } from './services/PredictionRepository.js';
import { ScoringService } from './services/ScoringService.js';
import { Prediction } from './models/Prediction.js';
import { ThemeToggle } from './ui/ThemeToggle.js';
import { ParticipantSelector } from './ui/ParticipantSelector.js';
import { PhaseTabs } from './ui/PhaseTabs.js';
import { DateTabs } from './ui/DateTabs.js';
import { MatchListView } from './ui/MatchListView.js';
import { Leaderboard } from './ui/Leaderboard.js';
import { Toast } from './ui/Toast.js';
import { WelcomeModal } from './ui/WelcomeModal.js';
import { findMostRelevantMatch } from './utils/DateUtils.js';
import { StorageUtils } from './utils/StorageUtils.js';

/**
 * Orquesta la página pública en dos pasos:
 *   1) "¿Quién eres?" (gate-card #name-gate): elegir nombre una sola vez,
 *      guardado en localStorage para las próximas visitas.
 *   2) Pronósticos (#main-content): fase -> fecha -> partidos de esa fecha,
 *      con la fecha de hoy auto-seleccionada, y tabla de posiciones.
 */
class PredictionsApp {
  constructor() {
    this.participantRepository = new ParticipantRepository();
    this.matchRepository = new MatchRepository();
    this.predictionRepository = new PredictionRepository();
    this.scoringService = new ScoringService(this.matchRepository, this.predictionRepository);

    this.participants = [];
    this.matches = [];
    this.predictionsByMatchId = new Map();
    this.selectedParticipantId = StorageUtils.getSelectedParticipantId();
    this.activePhase = null;
    this.activeDate = null;
  }

  mount() {
    this.themeToggle = new ThemeToggle(document.getElementById('theme-toggle'));

    this.gateEnterBtn = document.getElementById('gate-enter-btn');
    this.pendingParticipantId = null;

    this.gateSelector = new ParticipantSelector(document.getElementById('gate-select'), {
      onSelect: (id) => {
        this.pendingParticipantId = id;
        this.gateEnterBtn.disabled = !id;
      },
    });

    this.gateEnterBtn.addEventListener('click', () => {
      if (this.pendingParticipantId) this.selectParticipant(this.pendingParticipantId);
    });

    document.getElementById('change-participant-btn').addEventListener('click', () => this.showGate());

    this.phaseTabs = new PhaseTabs(document.getElementById('phase-tabs'), {
      onChange: (phase) => this.handlePhaseChange(phase),
    });

    this.dateTabs = new DateTabs(document.getElementById('date-tabs'), {
      onChange: (date) => this.handleDateChange(date),
    });

    this.matchListView = new MatchListView(document.getElementById('match-list'), {
      onSavePrediction: (matchId, scoreA, scoreB, penaltyInfo) =>
        this.handleSavePrediction(matchId, scoreA, scoreB, penaltyInfo),
    });

    this.leaderboard = new Leaderboard(document.getElementById('leaderboard'));
    this.toast = new Toast(document.getElementById('toast-container'));
    this.welcomeModal = new WelcomeModal();

    this.loadInitialData();
  }

  async loadInitialData() {
    this.participants = await this.participantRepository.getAll();

    // Si ya se eligió nombre en una visita anterior, se deja PRESELECCIONADO
    // en el combobox (comodidad), pero SIEMPRE hay que presionar "Ingresar"
    // para entrar al sistema: nunca se salta esta pantalla automáticamente.
    const knownParticipant = this.participants.find((p) => p.id === this.selectedParticipantId);
    this.pendingParticipantId = knownParticipant ? knownParticipant.id : null;
    this.gateSelector.render(this.participants, this.pendingParticipantId);
    this.gateEnterBtn.disabled = !this.pendingParticipantId;

    this.matches = await this.matchRepository.getAll();

    // La fase que contiene los partidos de hoy (o la más cercana) se abre
    // por defecto; dentro de ella, DateTabs auto-selecciona la fecha de hoy.
    const relevantMatch = findMostRelevantMatch(this.matches);
    this.activePhase = relevantMatch ? relevantMatch.phase : this.phaseTabs.activePhase;
    this.phaseTabs.setActive(this.activePhase);
  }

  /** Paso 1: se elige (o ya se conocía) el participante -> pasar al paso 2. */
  async selectParticipant(participantId) {
    const participant = this.participants.find((p) => p.id === participantId);
    if (!participant) return;

    this.selectedParticipantId = participantId;
    StorageUtils.setSelectedParticipantId(participantId);
    await this.loadPredictionsForSelectedParticipant();
    this.renderMatchesForActiveDate();
    await this.refreshLeaderboard();

    this.showMainContent(participant.name);
    this.welcomeModal.show(participant.name);
  }

  showMainContent(participantName) {
    document.getElementById('name-gate').hidden = true;
    document.getElementById('main-content').hidden = false;

    const label = document.getElementById('current-participant-label');
    label.textContent = `Hola, ${participantName}`;
    label.hidden = false;
    document.getElementById('change-participant-btn').hidden = false;
  }

  /** Vuelve al paso 1 para elegir otro nombre (ej. alguien más usa el mismo celular). */
  showGate() {
    this.selectedParticipantId = null;
    this.pendingParticipantId = null;
    this.predictionsByMatchId = new Map();
    StorageUtils.clearSelectedParticipant();

    document.getElementById('main-content').hidden = true;
    document.getElementById('name-gate').hidden = false;
    document.getElementById('current-participant-label').hidden = true;
    document.getElementById('change-participant-btn').hidden = true;

    this.gateSelector.render(this.participants, null);
    this.gateEnterBtn.disabled = true;
  }

  async loadPredictionsForSelectedParticipant() {
    const predictions = await this.predictionRepository.getByParticipant(this.selectedParticipantId);
    this.predictionsByMatchId = new Map(predictions.map((p) => [p.matchId, p]));
  }

  /** Al cambiar de fase, se recalculan las fechas disponibles de ESA fase (DateTabs se auto-selecciona sola). */
  handlePhaseChange(phase) {
    this.activePhase = phase;
    const datesOfPhase = [...new Set(this.matches.filter((m) => m.phase === phase).map((m) => m.date))].sort();
    this.dateTabs.setDates(datesOfPhase);
    this.refreshLeaderboard();
  }

  handleDateChange(date) {
    this.activeDate = date;
    this.renderMatchesForActiveDate();
  }

  renderMatchesForActiveDate() {
    const matchesOfDate = this.matches.filter((m) => m.phase === this.activePhase && m.date === this.activeDate);
    this.matchListView.render(matchesOfDate, this.predictionsByMatchId);
  }

  /** Se llama al entrar y cada vez que se cambia de fase, para reflejar resultados que el admin haya cargado mientras tanto. */
  async refreshLeaderboard() {
    const leaderboardRows = await this.scoringService.buildLeaderboard();
    this.leaderboard.render(leaderboardRows);
  }

  async handleSavePrediction(matchId, scoreA, scoreB, penaltyInfo = { wentToPenalties: false, penaltyWinner: null }) {
    const participant = this.participants.find((p) => p.id === this.selectedParticipantId);
    if (!participant) return;

    const prediction = new Prediction({
      id: Prediction.buildId(matchId, participant.id),
      matchId,
      participantId: participant.id,
      participantName: participant.name,
      scoreA,
      scoreB,
      wentToPenalties: penaltyInfo.wentToPenalties,
      penaltyWinner: penaltyInfo.penaltyWinner,
      locked: true, // se bloquea apenas se guarda, tal como se pidió
    });

    try {
      await this.predictionRepository.save(prediction);
      this.predictionsByMatchId.set(matchId, prediction);
      this.renderMatchesForActiveDate();
      this.toast.show('Pronóstico guardado y bloqueado ✅', 'success');
    } catch (error) {
      console.error(error);
      this.toast.show('No se pudo guardar (¿ya estaba bloqueado?)', 'error');
    }
  }
}

new PredictionsApp().mount();
