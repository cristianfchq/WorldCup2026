// Reglas de puntaje del ranking. Edita solo estos números para cambiar cómo
// se reparten los puntos; ScoringService.js usa estos valores, no hace falta
// tocar ninguna otra parte del código.
// EXACT_SCORE_POINTS y CORRECT_WINNER_POINTS deben coincidir siempre: los
// puntos de la tabla de posiciones tienen que ser el mismo número que la
// cantidad de veces que se resalta el nombre del participante en las tablas
// del admin (que solo resaltan el marcador exacto, ver
// Prediction.guessedExactResult). Si algún día se quiere dar puntaje parcial
// por acertar solo el ganador, hay que aceptar que esos dos números dejarán
// de coincidir.
export const SCORING_RULES = {
  EXACT_SCORE_POINTS: 1, // acertó el marcador exacto (o, en penales, también a quién clasificó): 1 punto
  CORRECT_WINNER_POINTS: 0, // acertó quién gana pero no el marcador exacto: no suma
  WRONG_POINTS: 0, // no acertó ni el ganador
};
