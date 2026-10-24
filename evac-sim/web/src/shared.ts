export const $ = <T extends Element>(selector: string): T =>
    document.querySelector(selector) as T;

/** Очистка SVG от скриптов (XSS-защита) */
export function cleanSvg(text: string): { svg: string, vb: [number, number, number, number] } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;

    if (doc.querySelector('parsererror') || svg.nodeName !== 'svg') {
        throw new Error('Файл не похож на SVG.');
    }

    svg.querySelectorAll('script,foreignObject').forEach(n => n.remove());
    svg.querySelectorAll('*').forEach(n => {
        [...n.attributes].forEach(a => {
            if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) {
                n.removeAttribute(a.name);
            }
        });
    });

    let vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some(isNaN)) {
        vb = [0, 0, parseFloat(svg.getAttribute('width') || '') || 1000, parseFloat(svg.getAttribute('height') || '') || 700];
    }
    svg.setAttribute('viewBox', vb.join(' '));

    return {
        svg: new XMLSerializer().serializeToString(svg),
        vb: vb as [number, number, number, number]
    };
}