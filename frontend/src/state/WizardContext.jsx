import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { DEFAULT_CRITERIA, cleanRequirements, wizardReducer } from './criteria.js';

const KEY = 'pf.wizard.v2';
const Ctx = createContext(null);

function init() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...DEFAULT_CRITERIA, ...saved, requirements: cleanRequirements(saved.requirements) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CRITERIA, requirements: {} };
}

/**
 * Central owner of the wizard state. It is kept in localStorage, so the user's choices survive page
 * changes, browser Back/Forward, reloads and closing the tab. They disappear only when the user
 * presses "Clear everything" (dispatch({ type: 'reset' })).
 */
export function WizardProvider({ children }) {
  const [criteria, dispatch] = useReducer(wizardReducer, undefined, init);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(criteria)); } catch { /* ignore */ }
  }, [criteria]);
  const value = useMemo(() => ({ criteria, dispatch }), [criteria]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWizard = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWizard must be used inside <WizardProvider>');
  return v;
};
