import { StorageUtils } from '../utils/StorageUtils.js';

const DARK = 'dark';
const LIGHT = 'light';

/** Botón de modo claro/oscuro. Aplica el tema como atributo en <html>. */
export class ThemeToggle {
  constructor(buttonElement) {
    this.button = buttonElement;
    this.button.addEventListener('click', () => this.toggle());
    this.applyTheme(this.getPreferredTheme());
  }

  getPreferredTheme() {
    return (
      StorageUtils.getTheme() ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT)
    );
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.button.textContent = theme === DARK ? '☀️' : '🌙';
    StorageUtils.setTheme(theme);
  }

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.applyTheme(current === DARK ? LIGHT : DARK);
  }
}
