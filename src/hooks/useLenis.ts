
// Lenis implementation removed - using default browser scrolling
// This file is kept to avoid import errors but exports an empty hook

export const useLenis = () => {
  return {
    lenis: null,
    scrollTo: () => {},
    scrollToTop: () => {},
    start: () => {},
    stop: () => {},
    isScrolling: () => false,
    setMaximumResponsiveness: () => {},
    getCurrentScroll: () => 0,
    getVelocity: () => 0,
    forceUpdate: () => {},
    zeroLatencyConfig: null
  };
};
