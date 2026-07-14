export const physicsLabEnabled = (): boolean => new URLSearchParams(window.location.search).get('physicsLab') === '1';
export const toyTestEnabled = (): boolean => new URLSearchParams(window.location.search).get('toyTest') === '1';
