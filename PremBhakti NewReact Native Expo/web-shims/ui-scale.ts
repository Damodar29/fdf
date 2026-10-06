// Browser stand-in for modules/ui-scale: the browser keeps its own zoom.
export const getUiScale = () => 1;
export const setUiScale = (_scale: number) => false;
