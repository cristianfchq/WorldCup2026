const VISIBLE_MS = 2000;

/** Modal breve de bienvenida que aparece al entrar y se cierra solo. */
export class WelcomeModal {
  show(participantName) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <p class="modal-card__icon">👋</p>
        <h2>¡Bienvenido, ${participantName}!</h2>
      </div>
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

    setTimeout(() => {
      overlay.classList.remove('modal-overlay--visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    }, VISIBLE_MS);
  }
}
