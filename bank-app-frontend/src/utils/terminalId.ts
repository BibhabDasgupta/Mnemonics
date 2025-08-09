// --- File: src/utils/terminalId.ts ---

import { v4 as uuidv4 } from 'uuid';

const TERMINAL_ID_KEY = 'glowbank_terminal_id';

/**
 * Retrieves the unique terminal ID from localStorage.
 * If it doesn't exist, it generates a new one, stores it, and returns it.
 * @returns {string} The unique terminal ID for the client.
 */
export const getOrSetTerminalId = (): string => {
    let terminalId = localStorage.getItem(TERMINAL_ID_KEY);

    if (!terminalId) {
        terminalId = uuidv4();
        localStorage.setItem(TERMINAL_ID_KEY, terminalId);
    }

    return terminalId;
};