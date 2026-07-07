import { BET_AMOUNT_BS } from '../config/payment-config.js';
import { todayAsIsoDate } from '../utils/DateUtils.js';

/**
 * Calcula y persiste los puntos de todos los pronósticos de un partido una
 * vez que el admin carga el resultado real, y arma la tabla de posiciones.
 */
export class ScoringService {
  constructor(matchRepository, predictionRepository, participantRepository, betRepository) {
    this.matchRepository = matchRepository;
    this.predictionRepository = predictionRepository;
    this.participantRepository = participantRepository;
    this.betRepository = betRepository;
  }

  /** Recalcula y guarda los puntos de cada pronóstico hecho para ese partido. */
  async recalculateForMatch(matchId) {
    const match = await this.matchRepository.getById(matchId);
    if (!match || !match.hasRealResult) return [];

    const predictions = await this.predictionRepository.getByMatch(matchId);
    for (const prediction of predictions) {
      prediction.points = prediction.computePoints(match);
      await this.predictionRepository.save(prediction);
    }
    return predictions;
  }

  /**
   * Vuelve a calcular los puntos de TODOS los partidos que ya tienen
   * resultado real cargado, con las reglas y datos actuales. Útil después
   * de cambiar SCORING_RULES, o si se sospecha que algún puntaje quedó
   * desactualizado por pruebas anteriores. No borra ni modifica pronósticos
   * ni resultados, solo recalcula el campo "points" de cada uno.
   */
  async recalculateAll() {
    const matches = await this.matchRepository.getAll();
    const matchesWithResult = matches.filter((match) => match.hasRealResult);
    for (const match of matchesWithResult) {
      await this.recalculateForMatch(match.id);
    }
    return matchesWithResult.length;
  }

  /** Suma los puntos de todos los partidos ya calificados, por participante. */
  async buildLeaderboard() {
    const predictions = await this.predictionRepository.getAll();
    const totalsByParticipant = new Map();

    for (const prediction of predictions) {
      if (prediction.points === null) continue;
      const current = totalsByParticipant.get(prediction.participantId) || {
        participantId: prediction.participantId,
        participantName: prediction.participantName,
        points: 0,
        matchesScored: 0,
      };
      current.points += prediction.points;
      current.matchesScored += 1;
      totalsByParticipant.set(prediction.participantId, current);
    }

    return [...totalsByParticipant.values()].sort((a, b) => b.points - a.points);
  }

  /**
   * Arma el historial de apuestas de UN participante: por cada partido con
   * resultado real donde pronosticó, el marcador real, su pronóstico, si
   * acertó el marcador EXACTO (Prediction.guessedExactResult, igual que en
   * el panel admin) y cuánto recibiría por esa apuesta.
   *
   * El monto es una PROYECCIÓN, igual que "Ganado (proyectado)" del admin:
   * se calcula como si TODOS los participantes ya hubieran pagado (pozo =
   * cantidad total de participantes × BET_AMOUNT_BS), no según quién pagó
   * de verdad.
   */
  async buildParticipantHistory(participantId) {
    const [matches, myPredictions, allParticipants] = await Promise.all([
      this.matchRepository.getAll(),
      this.predictionRepository.getByParticipant(participantId),
      this.participantRepository.getAll(),
    ]);
    const myPredictionByMatchId = new Map(myPredictions.map((p) => [p.matchId, p]));
    const hypotheticalPool = allParticipants.length * BET_AMOUNT_BS;

    const rows = [];
    for (const match of matches) {
      if (!match.hasRealResult) continue;

      const prediction = myPredictionByMatchId.get(match.id);
      if (!prediction) continue;

      const isWinner = prediction.guessedExactResult(match);
      let amountReceived = 0;

      if (isWinner) {
        const predictionsForMatch = await this.predictionRepository.getByMatch(match.id);
        const winnersCount = predictionsForMatch.filter((p) => p.guessedExactResult(match)).length;
        amountReceived = winnersCount > 0 ? hypotheticalPool / winnersCount : 0;
      }

      rows.push({ match, prediction, isWinner, amountReceived });
    }

    rows.sort((a, b) => `${a.match.date}${a.match.time}`.localeCompare(`${b.match.date}${b.match.time}`));
    return rows;
  }

  /**
   * Arma "mis deudas": por cada partido con fecha hasta hoy, si el
   * participante ya pagó su apuesta de Bs 5, sin importar si pronosticó o
   * no (igual criterio que el Resumen de pagos del admin: todos deben por
   * todos los partidos jugados). Incluye los 3 totales para el pie de tabla.
   */
  async buildDebtsSummary(participantId) {
    const [allMatches, bets] = await Promise.all([
      this.matchRepository.getAll(),
      this.betRepository.getByParticipant(participantId),
    ]);

    const today = todayAsIsoDate();
    const matches = allMatches
      .filter((match) => match.date <= today)
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    const paidByMatchId = new Map(bets.filter((b) => b.paid).map((b) => [b.matchId, true]));
    const rows = matches.map((match) => ({ match, paid: paidByMatchId.has(match.id) }));

    const totalDue = matches.length * BET_AMOUNT_BS;
    const totalPaid = rows.filter((r) => r.paid).length * BET_AMOUNT_BS;
    const totalPending = totalDue - totalPaid;

    return { rows, totalDue, totalPaid, totalPending };
  }
}
