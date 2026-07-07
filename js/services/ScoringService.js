import { BET_AMOUNT_BS } from '../config/payment-config.js';
import { todayAsIsoDate } from '../utils/DateUtils.js';

/**
 * Calcula los puntos de los pronósticos y arma la tabla de posiciones,
 * "mis apuestas" y "mis deudas". Es un servicio de CÁLCULO PURO: los
 * métodos de lectura reciben los datos ya cargados como parámetros y nunca
 * consultan Firestore por su cuenta (ver memoria
 * "gameproject-firestore-read-optimization"). Las únicas excepciones son
 * recalculateForMatch/recalculateAll, que sí escriben en Firestore porque
 * son acciones deliberadas del admin, no algo disparado por la navegación.
 */
export class ScoringService {
  constructor(matchRepository, predictionRepository) {
    this.matchRepository = matchRepository;
    this.predictionRepository = predictionRepository;
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
  buildLeaderboard(allPredictions) {
    const totalsByParticipant = new Map();

    for (const prediction of allPredictions) {
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
   * resultado real cargado, el marcador real, su pronóstico (o `null` si no
   * pronosticó ese partido), si acertó el marcador EXACTO
   * (Prediction.guessedExactResult, igual que en el panel admin) y cuánto
   * recibiría por esa apuesta.
   *
   * El monto es una PROYECCIÓN, igual que "Ganado (proyectado)" del admin:
   * se calcula como si TODOS los participantes ya hubieran pagado (pozo =
   * cantidad total de participantes × BET_AMOUNT_BS), no según quién pagó
   * de verdad.
   *
   * `houseAmount` es esa misma proyección de pozo, pero para "Para Whisky":
   * si NADIE acertó el marcador exacto de ese partido, el pozo completo no
   * se reparte y queda para la casa (mismo criterio que "🏠 Para Whisky" en
   * el Resumen de pagos del admin, aplicado partido por partido).
   */
  buildParticipantHistory(participantId, matches, allPredictions, participantsCount) {
    const predictionsByMatchId = new Map();
    for (const prediction of allPredictions) {
      if (!predictionsByMatchId.has(prediction.matchId)) predictionsByMatchId.set(prediction.matchId, []);
      predictionsByMatchId.get(prediction.matchId).push(prediction);
    }

    const hypotheticalPool = participantsCount * BET_AMOUNT_BS;

    const rows = [];
    for (const match of matches) {
      if (!match.hasRealResult) continue;

      const predictionsForMatch = predictionsByMatchId.get(match.id) || [];
      const prediction = predictionsForMatch.find((p) => p.participantId === participantId) || null;

      const winnersCount = predictionsForMatch.filter((p) => p.guessedExactResult(match)).length;
      const isWinner = Boolean(prediction?.guessedExactResult(match));
      const amountReceived = isWinner && winnersCount > 0 ? hypotheticalPool / winnersCount : 0;
      const houseAmount = winnersCount === 0 ? hypotheticalPool : 0;

      rows.push({ match, prediction, isWinner, amountReceived, houseAmount });
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
  buildDebtsSummary(participantId, allMatches, allBets) {
    const today = todayAsIsoDate();
    const matches = allMatches
      .filter((match) => match.date <= today)
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    const paidByMatchId = new Map(
      allBets.filter((b) => b.participantId === participantId && b.paid).map((b) => [b.matchId, true])
    );
    const rows = matches.map((match) => ({ match, paid: paidByMatchId.has(match.id) }));

    const totalDue = matches.length * BET_AMOUNT_BS;
    const totalPaid = rows.filter((r) => r.paid).length * BET_AMOUNT_BS;
    const totalPending = totalDue - totalPaid;

    return { rows, totalDue, totalPaid, totalPending };
  }
}
