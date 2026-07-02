/**
 * Calcula y persiste los puntos de todos los pronósticos de un partido una
 * vez que el admin carga el resultado real, y arma la tabla de posiciones.
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
}
