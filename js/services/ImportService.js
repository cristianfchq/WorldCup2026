/**
 * Lee archivos JSON (formato de /data/participants.example.json y
 * /data/matches.example.json) y los sube a Firestore usando los
 * repositorios correspondientes. Es el corazón de los botones "Importar"
 * del panel admin. Es seguro volver a importar un archivo con datos ya
 * existentes mezclados con datos nuevos: solo se crea lo que falta.
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

  /** @returns {Promise<{created: number, skipped: number}>} */
  async importParticipants(file) {
    const { participants } = await this.readJsonFile(file);
    if (!Array.isArray(participants)) {
      throw new Error('El archivo debe tener la forma { "participants": [{ "name": "..." }] }');
    }

    let created = 0;
    for (const raw of participants) {
      const wasCreated = await this.participantRepository.createIfNotExists(raw.name);
      if (wasCreated) created += 1;
    }
    return { created, skipped: participants.length - created };
  }

  /** @returns {Promise<{created: number, skipped: number}>} */
  async importMatches(file) {
    const { matches } = await this.readJsonFile(file);
    if (!Array.isArray(matches)) {
      throw new Error('El archivo debe tener la forma { "matches": [{ "phase": "...", ... }] }');
    }

    let created = 0;
    for (const raw of matches) {
      const wasCreated = await this.matchRepository.createIfNotExists(raw);
      if (wasCreated) created += 1;
    }
    return { created, skipped: matches.length - created };
  }
}
