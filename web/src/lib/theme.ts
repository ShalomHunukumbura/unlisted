export const THEME_KEY = "unlisted:theme";

/**
 * Sets <html data-theme> before the page paints, so a saved choice never
 * flashes the other theme first. Inlined in the layout's <head>.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
