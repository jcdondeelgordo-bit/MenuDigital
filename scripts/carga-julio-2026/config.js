export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzo45isSgsJoCJxyvBl81Eb9fMAMwsB3GS5IRwV9QxTgk7NLfj8BiE8j5CgeP6dWgb6/exec';
export const MARCA_CARGA = 'Carga histórica Julio 2026 (script)';
export const MOTIVO_JC = 'Carga histórica desde archivo Excel (J/C julio 2026)';

export function normalizar(s) {
  return (s || '').toString().toUpperCase().trim().replace(/\s+/g, ' ');
}
