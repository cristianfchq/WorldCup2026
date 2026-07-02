/** Combobox para elegir "quién soy" antes de poder pronosticar. */
export class ParticipantSelector {
  constructor(selectElement, { onSelect }) {
    this.select = selectElement;
    this.onSelect = onSelect;
    this.select.addEventListener('change', () => this.onSelect(this.select.value || null));
  }

  render(participants, selectedId) {
    const placeholder = '<option value="" disabled selected>Selecciona tu nombre</option>';
    const options = participants
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join('');
    this.select.innerHTML = placeholder + options;
    if (selectedId && participants.some((p) => p.id === selectedId)) {
      this.select.value = selectedId;
    }
  }
}
