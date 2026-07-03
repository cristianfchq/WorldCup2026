/**
 * Tabs horizontales genéricos: recibe una lista de { key, label } y avisa
 * cuál quedó activo. Reutiliza el mismo look de PhaseTabs (clase CSS
 * "phase-tab") para que cualquier lugar del sitio que use tabs se vea igual.
 */
export class TabsComponent {
  constructor(containerElement, tabs, { onChange, initialKey }) {
    this.container = containerElement;
    this.tabs = tabs;
    this.onChange = onChange;
    this.activeKey = initialKey ?? tabs[0]?.key ?? null;
    this.render();
  }

  render() {
    this.container.innerHTML = this.tabs
      .map(
        (tab) => `
          <button
            class="phase-tab ${tab.key === this.activeKey ? 'phase-tab--active' : ''}"
            data-key="${tab.key}"
            type="button"
          >${tab.label}</button>
        `
      )
      .join('');

    this.container.querySelectorAll('.phase-tab').forEach((button) => {
      button.addEventListener('click', () => this.setActive(button.dataset.key));
    });
  }

  setActive(key) {
    this.activeKey = key;
    this.render();
    this.onChange(key);
  }
}
