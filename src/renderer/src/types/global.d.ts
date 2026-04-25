import type { NotesApi } from '../../../shared/types/notes';

declare global {
  interface Window {
    notesApi?: NotesApi;
  }
}

export {};
