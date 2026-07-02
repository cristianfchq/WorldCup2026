/** Notificación breve flotante (éxito/error) reutilizada en toda la app. */
export class Toast {
  constructor(containerElement) {
    this.container = containerElement;
  }

  show(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    this.container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
