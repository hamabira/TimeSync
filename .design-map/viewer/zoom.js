(() => {
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 2;

  function clampScale(scale) {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  }

  function scaleForWheel(scale, deltaY) {
    return clampScale(scale * Math.exp(-deltaY * 0.002));
  }

  function anchoredScroll(currentScroll, pointerOffset, currentScale, nextScale, oldMargin = 0, nextMargin = oldMargin) {
    return ((currentScroll + pointerOffset - oldMargin) / currentScale) * nextScale + nextMargin - pointerOffset;
  }

  window.DesignMapZoom = { MIN_SCALE, MAX_SCALE, clampScale, scaleForWheel, anchoredScroll };
})();
