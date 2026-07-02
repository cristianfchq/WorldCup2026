// Configuración general de la aplicación: fases del torneo y textos asociados.
// Agregar una fase nueva es tan simple como sumar un objeto aquí; el resto de
// la app (tabs, importación de partidos, etc.) la reconoce automáticamente.
export const PHASES = [
  { key: 'ro32', label: '16vos de Final' },
  { key: 'ro16', label: '8vos de Final' },
  { key: 'quarters', label: 'Cuartos de Final' },
  { key: 'semis', label: 'Semifinal' },
  { key: 'final', label: 'Final' },
];

// Los horarios de los partidos se guardan como fecha+hora local (sin
// conversión de zona horaria). Esto funciona bien porque todos los
// participantes están en la misma zona horaria. Si no fuera el caso, este es
// el lugar donde se debería agregar lógica de conversión con Intl/Temporal.
export const APP_TIMEZONE_NOTE = 'America/Lima';
