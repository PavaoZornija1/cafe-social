import {
  ACTION_ARC_ANGLES_HIT_DASH_JUMP,
  ACTION_ARC_CENTER_X,
  ACTION_ARC_CENTER_Y,
  ACTION_ARC_R,
  ACTION_CIRCLE_SIZE,
} from './constants';

export function actionArcButtonPositions(): { left: number; top: number }[] {
  const half = ACTION_CIRCLE_SIZE / 2;
  const r = ACTION_ARC_R;
  return ACTION_ARC_ANGLES_HIT_DASH_JUMP.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      left: ACTION_ARC_CENTER_X + r * Math.cos(rad) - half,
      top: ACTION_ARC_CENTER_Y - r * Math.sin(rad) - half,
    };
  });
}

export const ACTION_ARC_LAYOUT = actionArcButtonPositions();
