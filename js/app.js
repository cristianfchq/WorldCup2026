import { ParticipantRepository } from './services/ParticipantRepository.js';
import { MatchRepository } from './services/MatchRepository.js';
import { PredictionRepository } from './services/PredictionRepository.js';
import { BetRepository } from './services/BetRepository.js';
import { ScoringService } from './services/ScoringService.js';
import { Prediction } from './models/Prediction.js';
import { BET_AMOUNT_BS } from './config/payment-config.js';
import { ThemeToggle } from './ui/ThemeToggle.js';
import { ParticipantSelector } from './ui/ParticipantSelector.js';
import { PhaseTabs } from './ui/PhaseTabs.js';
import { DateTabs } from './ui/DateTabs.js';
import { MatchListView } from './ui/MatchListView.js';
import { Leaderboard } from './ui/Leaderboard.js';
import { ParticipantHistory } from './ui/ParticipantHistory.js';
import { ParticipantDebts } from './ui/ParticipantDebts.js';
import { Toast } from './ui/Toast.js';
import { WelcomeModal } from './ui/WelcomeModal.js';
import { MatchPredictionsModal } from './ui/MatchPredictionsModal.js';
import { findMostRelevantMatch } from './utils/DateUtils.js';
import { StorageUtils } from './utils/StorageUtils.js';

/**
 * Orquesta la página pública en dos pasos:
 *   1) "¿Quién eres?" (gate-card #name-gate): elegir nombre una sola vez,
 *      guardado en localStorage para las próximas visitas.
 *   2) Pronósticos (#main-content): fase -> fecha -> partidos de esa fecha,
 *      con la fecha de hoy auto-seleccionada, y tabla de posiciones.
 *
 * Partidos, TODOS los pronósticos y TODAS las apuestas se traen UNA sola
 * vez por sesión (loadSharedData) y se cachean en memoria. Cambiar de
 * fase/fecha/participante nunca vuelve a leer Firestore: todo se recalcula
 * desde esa copia. Solo el botón "🔄 Actualizar" o recargar la página
 * traen datos frescos (ver memoria "gameproject-firestore-read-optimization").
 */
class PredictionsApp {
  constructor() {
    this.participantRepository = new ParticipantRepository();
    this.matchRepository = new MatchRepository();
    this.predictionRepository = new PredictionRepository();
    this.betRepository = new BetRepository();
    this.scoringService = new ScoringService(this.matchRepository, this.predictionRepository);

    this.participants = [];
    this.matches = [];
    this.allPredictions = [];
    this.allBets = [];
    this.predictionsByMatchId = new Map();
    this.selectedParticipantId = StorageUtils.getSelectedParticipantId();
    this.activePhase = null;
    this.activeDate = null;
    this.isSharedDataReady = false;
  }

  mount() {
    this.themeToggle = new ThemeToggle(document.getElementById('theme-toggle'));

    this.gateEnterBtn = document.getElementById('gate-enter-btn');
    this.pendingParticipantId = null;

    this.gateSelector = new ParticipantSelector(document.getElementById('gate-select'), {
      onSelect: (id) => {
        this.pendingParticipantId = id;
        this.updateGateEnterButton();
      },
    });

    this.gateEnterBtn.addEventListener('click', () => {
      if (this.pendingParticipantId) this.selectParticipant(this.pendingParticipantId);
    });

    document.getElementById('change-participant-btn').addEventListener('click', () => this.showGate());

    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshAllData());

    this.phaseTabs = new PhaseTabs(document.getElementById('phase-tabs'), {
      onChange: (phase) => this.handlePhaseChange(phase),
    });

    this.dateTabs = new DateTabs(document.getElementById('date-tabs'), {
      onChange: (date) => this.handleDateChange(date),
    });

    this.matchListView = new MatchListView(document.getElementById('match-list'), {
      onSavePrediction: (matchId, scoreA, scoreB, penaltyInfo) =>
        this.handleSavePrediction(matchId, scoreA, scoreB, penaltyInfo),
      onViewPredictions: (match) => this.handleViewPredictions(match),
    });

    this.leaderboard = new Leaderboard(document.getElementById('leaderboard'));
    this.participantHistory = new ParticipantHistory(document.getElementById('participant-history'), {
      onSelectMatch: (match) => this.handleViewPredictions(match),
    });
    this.participantDebts = new ParticipantDebts(document.getElementById('participant-debts'));
    this.toast = new Toast(document.getElementById('toast-container'));
    this.welcomeModal = new WelcomeModal();
    this.matchPredictionsModal = new MatchPredictionsModal();

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
    this.updateGateEnterButton();

    await this.loadSharedData();

    // La fase que contiene los partidos de hoy (o la más cercana) se abre
    // por defecto; dentro de ella, DateTabs auto-selecciona la fecha de hoy.
    const relevantMatch = findMostRelevantMatch(this.matches);
    this.activePhase = relevantMatch ? relevantMatch.phase : this.phaseTabs.activePhase;
    this.phaseTabs.setActive(this.activePhase);
  }

  /**
   * Trae partidos, TODOS los pronósticos y TODAS las apuestas de una sola
   * vez, y los cachea en memoria. Se llama al entrar y desde "🔄 Actualizar".
   */
  async loadSharedData() {
    this.isSharedDataReady = false;
    const [matches, allPredictions, allBets] = await Promise.all([
      this.matchRepository.getAll(),
      this.predictionRepository.getAll(),
      this.betRepository.getAll(),
    ]);
    this.matches = matches;
    this.allPredictions = allPredictions;
    this.allBets = allBets;
    this.isSharedDataReady = true;
    this.updateGateEnterButton();
  }

  /** Handler del botón "🔄 Actualizar": única forma de traer datos frescos aparte de recargar la página. */
  async refreshAllData() {
    await this.loadSharedData();
    if (this.selectedParticipantId) {
      await this.loadPredictionsForSelectedParticipant();
      this.renderMatchesForActiveDate();
      this.refreshLeaderboard();
      this.refreshParticipantHistory();
      this.refreshParticipantDebts();
    }
    this.toast.show('Datos actualizados ✅', 'success');
  }

  /**
   * Centraliza cuándo se habilita "Ingresar": requiere un nombre elegido Y
   * los datos compartidos ya cargados, para evitar entrar con las tablas
   * (posiciones, mis apuestas, mis deudas) vacías por una condición de
   * carrera. Se llama desde todos los lugares donde cualquiera de las dos
   * condiciones puede cambiar.
   */
  updateGateEnterButton() {
    this.gateEnterBtn.disabled = !(this.pendingParticipantId && this.isSharedDataReady);
  }

  /** Paso 1: se elige (o ya se conocía) el participante -> pasar al paso 2. */
  async selectParticipant(participantId) {
    const participant = this.participants.find((p) => p.id === participantId);
    if (!participant) return;

    this.selectedParticipantId = participantId;
    StorageUtils.setSelectedParticipantId(participantId);
    await this.loadPredictionsForSelectedParticipant();
    this.renderMatchesForActiveDate();
    this.refreshLeaderboard();
    this.refreshParticipantHistory();
    this.refreshParticipantDebts();

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

    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) refreshBtn.hidden = false;
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

    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) refreshBtn.hidden = true;

    this.gateSelector.render(this.participants, null);
    this.updateGateEnterButton();
  }

  async loadPredictionsForSelectedParticipant() {
    const predictions = this.allPredictions.filter((p) => p.participantId === this.selectedParticipantId);
    this.predictionsByMatchId = new Map(predictions.map((p) => [p.matchId, p]));
  }

  /** Al cambiar de fase, se recalculan las fechas disponibles de ESA fase (DateTabs se auto-selecciona sola). No vuelve a leer Firestore ni recalcula posiciones/apuestas/deudas: esas no dependen de la fase activa. */
  handlePhaseChange(phase) {
    this.activePhase = phase;
    const datesOfPhase = [...new Set(this.matches.filter((m) => m.phase === phase).map((m) => m.date))].sort();
    this.dateTabs.setDates(datesOfPhase);
  }

  handleDateChange(date) {
    this.activeDate = date;
    this.renderMatchesForActiveDate();
  }

  renderMatchesForActiveDate() {
    const matchesOfDate = this.matches.filter((m) => m.phase === this.activePhase && m.date === this.activeDate);
    this.matchListView.render(matchesOfDate, this.predictionsByMatchId);
  }

  /** Cálculo puro desde this.allPredictions (ya cacheado), sin leer Firestore. */
  refreshLeaderboard() {
    const leaderboardRows = this.scoringService.buildLeaderboard(this.allPredictions);
    this.leaderboard.render(leaderboardRows);
  }

  /** Igual que refreshLeaderboard(), pero para la tabla personal "Mis apuestas" del participante logueado. */
  refreshParticipantHistory() {
    if (!this.selectedParticipantId) return;
    const rows = this.scoringService.buildParticipantHistory(
      this.selectedParticipantId,
      this.matches,
      this.allPredictions,
      this.participants.length
    );
    this.participantHistory.render(rows);
  }

  /** Igual que refreshParticipantHistory(), pero para "Mis deudas" (qué debería pagar / ya pagó / le falta). */
  refreshParticipantDebts() {
    if (!this.selectedParticipantId) return;
    const summary = this.scoringService.buildDebtsSummary(this.selectedParticipantId, this.matches, this.allBets);
    this.participantDebts.render(summary);
  }

  /**
   * Abre el modal "Ver pronósticos" de un partido: pronóstico de TODOS los
   * participantes y cuánto le tocaría a cada uno si gana. Se arma desde
   * this.allPredictions/this.participants, ya cacheados en memoria, sin
   * volver a leer Firestore.
   */
  handleViewPredictions(match) {
    const predictionsForMatch = this.allPredictions.filter((p) => p.matchId === match.id);
    const predictionByParticipant = new Map(predictionsForMatch.map((p) => [p.participantId, p]));

    const winnersCount = predictionsForMatch.filter((p) => p.guessedExactResult(match)).length;
    const projectedPool = this.participants.length * BET_AMOUNT_BS;
    const amountPerWinner = winnersCount > 0 ? projectedPool / winnersCount : 0;

    const rows = this.participants.map((participant) => {
      const prediction = predictionByParticipant.get(participant.id) || null;
      const isWinner = Boolean(prediction?.guessedExactResult(match));

      const predictionIsTie = Boolean(prediction) && prediction.scoreA === prediction.scoreB;
      const penaltyPick =
        prediction?.wentToPenalties && predictionIsTie
          ? ` (🎯 ${prediction.penaltyWinner === 'teamA' ? match.teamA : match.teamB})`
          : '';
      const predictionLabel = prediction ? `${prediction.scoreA} - ${prediction.scoreB}${penaltyPick}` : 'Sin pronóstico';
      const amountLabel = isWinner ? `Bs ${formatBs(amountPerWinner)}` : '—';

      return { participantName: participant.name, predictionLabel, isWinner, amountLabel };
    });

    this.matchPredictionsModal.show(match, rows);
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

      // Actualiza la copia en memoria en vez de volver a leer Firestore.
      const index = this.allPredictions.findIndex((p) => p.id === prediction.id);
      if (index >= 0) this.allPredictions[index] = prediction;
      else this.allPredictions.push(prediction);

      this.renderMatchesForActiveDate();
      this.toast.show('Pronóstico guardado y bloqueado ✅', 'success');
    } catch (error) {
      console.error(error);
      this.toast.show('No se pudo guardar (¿ya estaba bloqueado?)', 'error');
    }
  }
}

/** Redondea a 2 decimales pero sin arrastrar ceros innecesarios (7.5, no 7.50). */
function formatBs(amount) {
  return Number(amount.toFixed(2));
}

new PredictionsApp().mount();
