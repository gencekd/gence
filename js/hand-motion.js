// Positive turn is clockwise in the atlas. Three.js applies the opposite Y rotation.
import {ACTIONS} from './gestures.js';

export function handMotion(action, walkSpeed, turnSpeed) {
  const speed = action === ACTIONS.WALK ? walkSpeed : 0;
  const turn = action === ACTIONS.RIGHT ? turnSpeed : action === ACTIONS.LEFT ? -turnSpeed : 0;
  return {speed, turn};
}

// Both scenes use the same per-site calibration, including edits made in VR.
export function bindHandSetting(input, output, setting, unit, apply) {
  const key = '346.hand.' + setting;
  const refresh = () => {
    const value = input.valueAsNumber;
    output.textContent = (setting === 'turn' ? value : value.toFixed(2)) + unit;
    apply(value);
  };
  const restore = () => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && Number.isFinite(Number(saved))) input.value = saved;
    } catch {}
    refresh();
  };
  restore();
  window.addEventListener('pageshow', restore);
  input.addEventListener('input', () => {
    refresh();
    try { localStorage.setItem(key, input.value); } catch {}
  });
}
