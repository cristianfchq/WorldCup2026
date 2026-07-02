import { ADMIN_PIN } from '../config/admin-config.js';

const SESSION_KEY = 'mundial-admin-session';

/**
 * Control de acceso al panel admin. Ver la advertencia en admin-config.js:
 * esto es una barrera de interfaz, no una medida de seguridad real, porque
 * el proyecto no usa Firebase Authentication.
 */
export class AdminAuthService {
  isUnlocked() {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  }

  tryUnlock(pin) {
    const isCorrect = pin === ADMIN_PIN;
    if (isCorrect) sessionStorage.setItem(SESSION_KEY, 'true');
    return isCorrect;
  }

  lock() {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
