export type ArenaWorldPaintFrame = {
  camX: number;
  camY: number;
  px: number;
  py: number;
  spriteDrawOffsetY: number;
  hitDrawOffsetX: number;
  bodyW: number;
  heroHp: number;
  heroHpMax: number;
  heroIFrames: boolean;
  facing: 'left' | 'right';
  enemies: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    hp: number;
    visible: boolean;
    flash: boolean;
    iFrames: boolean;
  }>;
  dummies: Array<{
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    hp: number;
    visible: boolean;
    flash: boolean;
  }>;
  lavaSurfaceY: number | null;
  worldH: number;
  worldW: number;
  debugHit: null | { x: number; y: number; w: number; h: number };
  dmgFloats: Array<{
    id: number;
    x: number;
    y: number;
    text: string;
    opacity: number;
  }>;
};

export type ArenaWorldPaintHandle = {
  paint: (frame: ArenaWorldPaintFrame) => void;
};
