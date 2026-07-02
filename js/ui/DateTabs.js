import { todayAsIsoDate, formatShortDate, findMostRelevantDate } from '../utils/DateUtils.js';

/**
 * Tabs de fecha, anidados dentro de una fase (16vos, 8vos, etc.). Cada vez
 * que cambian las fechas disponibles (porque se cambió de fase), se
 * auto-selecciona la fecha más relevante (hoy, si hay partidos hoy).
 */
export class DateTabs {
  constructor(containerElement, { onChange }) {
    this.container = containerElement;
    this.onChange = onChange;
    this.dates = [];
    this.activeDate = null;
  }

  /** Reemplaza el set de fechas disponibles (al cambiar de fase) y auto-selecciona una. */
  setDates(dates) {
    this.dates = dates;
    this.activeDate = findMostRelevantDate(dates);
    this.render();
    if (this.activeDate) this.onChange(this.activeDate);
  }

  render() {
    if (this.dates.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    const today = todayAsIsoDate();
    this.container.innerHTML = this.dates
      .map(
        (date) => `
          <button
            class="date-tab ${date === this.activeDate ? 'date-tab--active' : ''}"
            data-date="${date}"
            type="button"
          >${formatShortDate(date)}${date === today ? ' · Hoy' : ''}</button>
        `
      )
      .join('');

    this.container.querySelectorAll('.date-tab').forEach((button) => {
      button.addEventListener('click', () => this.setActive(button.dataset.date));
    });
  }

  setActive(date) {
    this.activeDate = date;
    this.render();
    this.onChange(date);
  }
}
