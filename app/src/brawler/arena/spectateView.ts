export function clampArenaCamera(
  camX: number,
  camY: number,
  worldW: number,
  worldH: number,
  arenaW: number,
  arenaInnerH: number,
): { x: number; y: number } {
  const maxX = Math.max(0, worldW - arenaW);
  const maxY = Math.max(0, worldH - arenaInnerH);
  return {
    x: Math.max(0, Math.min(maxX, camX)),
    y: Math.max(0, Math.min(maxY, camY)),
  };
}

export function heroFollowCamera(
  px: number,
  py: number,
  bodyW: number,
  bodyH: number,
  worldW: number,
  worldH: number,
  arenaW: number,
  arenaInnerH: number,
): { x: number; y: number } {
  return clampArenaCamera(
    px + bodyW / 2 - arenaW / 2,
    py + bodyH / 2 - arenaInnerH / 2,
    worldW,
    worldH,
    arenaW,
    arenaInnerH,
  );
}
