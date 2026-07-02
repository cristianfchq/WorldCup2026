import { PHASES } from '../config/app-config.js';

/** Tabs horizontales para elegir la fase del torneo (16vos, 8vos, etc.). */
export class PhaseTabs {
  constructor(containerElement, { onChange }) {
    this.container = containerElement;
    this.onChange = onChange;
    this.activePhase = PHASES[0].key;
    this.render();
  }

  render() {
    this.container.innerHTML = PHASES.map(
      (phase) => `
        <button
          class="phase-tab ${phase.key === this.activePhase ? 'phase-tab--active' : ''}"
          data-phase="${phase.key}"
          type="button"
        >${phase.label}</button>
      `
    ).join('');

    this.container.querySelectorAll('.phase-tab').forEach((button) => {
      button.addEventListener('click', () => this.setActive(button.dataset.phase));
    });
  }

  setActive(phaseKey) {
    this.activePhase = phaseKey;
    this.render();
    this.onChange(phaseKey);
  }
}
