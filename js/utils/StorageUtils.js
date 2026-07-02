const THEME_KEY = 'mundial-theme';
const SELECTED_PARTICIPANT_KEY = 'mundial-selected-participant';

/** Pequeño wrapper sobre localStorage para no repetir strings mágicos. */
export const StorageUtils = {
  getTheme: () => localStorage.getItem(THEME_KEY),
  setTheme: (theme) => localStorage.setItem(THEME_KEY, theme),

  getSelectedParticipantId: () => localStorage.getItem(SELECTED_PARTICIPANT_KEY),
  setSelectedParticipantId: (id) => localStorage.setItem(SELECTED_PARTICIPANT_KEY, id),
  clearSelectedParticipant: () => localStorage.removeItem(SELECTED_PARTICIPANT_KEY),
};
