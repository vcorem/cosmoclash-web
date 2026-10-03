export const icons: Record<string, string> = {
  map: '<circle cx="12" cy="12" r="8"/><path d="m12 4 2.4 5.6L20 12l-5.6 2.4L12 20l-2.4-5.6L4 12l5.6-2.4Z"/>',
  ship: '<path d="m12 2 7 18-7-3-7 3Z"/><path d="M12 9v8M9 22l3-2 3 2"/>',
  contacts:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 5"/>',
  log: '<path d="M6 3h13v18H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 0v18M9 8h6M9 12h6"/>',
  fuel: '<path d="m13 2-8 12h6l-1 8 9-12h-6Z"/>',
  hull: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  credits: '<path d="m12 2 9 5v10l-9 5-9-5V7Zm-9 5 9 5 9-5m-9 5v10"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  scan: '<path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M8 12h8m-4-4v8"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sound:
    '<path d="M4 9h4l5-4v14l-5-4H4Zm12-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  save: '<path d="M4 3h13l4 4v14H3V3Zm3 0v6h10V3M7 21v-7h10v7"/>',
  restart: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
};
export function icon(name: string, cls = ""): string {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.map}</svg>`;
}
export function portrait(id: string, color: string): string {
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const style = seed % 5;
  const shapes = [
    '<path d="M100 28C45 28 31 97 62 130L54 178H146L138 130C169 97 155 28 100 28Z"/><path d="M61 81Q100 119 139 81M72 105Q100 134 128 105M85 52V77M115 52V77"/>',
    '<path d="m100 27 51 34-9 82-42 32-42-32-9-82Z"/><path d="m49 61 51 39 51-39M100 100v75M70 62l30 16 30-16M58 110l25 10m59-10-25 10"/>',
    '<circle cx="100" cy="100" r="54"/><circle cx="100" cy="100" r="23"/><path d="M100 22v34m0 88v34M22 100h34m88 0h34M45 45l24 24m62 62 24 24M45 155l24-24m62-62 24-24"/>',
    '<path d="M58 174V65l42-37 42 37v109M58 82h84M74 55v91m26-117v145m26-119v91"/><path d="M75 105q25-18 50 0m-50 26q25 18 50 0"/>',
    '<path d="M59 174Q20 98 59 56Q100 15 141 56Q180 98 141 174M59 174q41-29 82 0M62 63q38 59 76 0M75 117q25-17 50 0"/><circle cx="77" cy="82" r="6"/><circle cx="123" cy="82" r="6"/>',
  ][style];
  return `<svg class="alien-portrait" viewBox="0 0 200 200" role="img" aria-label="${id} transmission portrait"><defs><radialGradient id="portrait-${seed}"><stop stop-color="${color}" stop-opacity=".2"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="96" fill="url(#portrait-${seed})"/><g fill="${color}" fill-opacity=".035" stroke="${color}" stroke-width="1.4">${shapes}</g><g stroke="${color}" opacity=".3" fill="none"><circle cx="100" cy="100" r="86"/><path d="M10 100h16m148 0h16M100 10v16m0 148v16"/></g></svg>`;
}
