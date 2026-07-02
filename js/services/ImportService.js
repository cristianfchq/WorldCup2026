/**
 * Lee archivos JSON (formato de /data/participants.example.json y
 * /data/matches.example.json) y los sube a Firestore usando los
 * repositorios correspondientes. Es el corazón de los botones "Importar"
 * del panel admin.
 */
export class ImportService {
  constructor(participantRepository, matchRepository) {
    this.participantRepository = participantRepository;
    this.matchRepository = matchRepository;
  }

  async readJsonFile(file) {
    const text = await file.text();
    return JSON.parse(text);
  }

  /** @returns {Promise<number>} cantidad de participantes importados */
  async importParticipants(file) {
    const { participants } = await this.readJsonFile(file);
    if (!Array.isArray(participants)) {
      throw new Error('El archivo debe tener la forma { "participants": [{ "name": "..." }] }');
    }
    for (const raw of participants) {
      await this.participantRepository.createFromName(raw.name);
    }
    return participants.length;
  }

  /** @returns {Promise<number>} cantidad de partidos importados */
  async importMatches(file) {
    const { matches } = await this.readJsonFile(file);
    if (!Array.isArray(matches)) {
      throw new Error('El archivo debe tener la forma { "matches": [{ "phase": "...", ... }] }');
    }
    for (const raw of matches) {
      await this.matchRepository.createFromRaw(raw);
    }
    return matches.length;
  }
}
