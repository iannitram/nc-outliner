export const numberingStyles = ['none', 'decimal', 'alpha', 'roman', 'section'];
export const numberingSuffixes = ['.', ')', ':', ''];

export function numberingSettings(document) {
  return { style: document.numbering?.style ?? 'none', suffix: document.numbering?.suffix ?? '.' };
}

export function setNumbering(document, settings) {
  if (!numberingStyles.includes(settings.style) || !numberingSuffixes.includes(settings.suffix)) throw new Error('Invalid numbering settings');
  const previous = numberingSettings(document);
  if (previous.style === settings.style && previous.suffix === settings.suffix) return document;
  return { ...document, numbering: { ...settings } };
}

function alpha(number) {
  let result = '';
  while (number > 0) { number--; result = String.fromCharCode(97 + number % 26) + result; number = Math.floor(number / 26); }
  return result;
}
function roman(number) {
  let result = '';
  for (const [value, symbol] of [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) {
    while (number >= value) { result += symbol; number -= value; }
  }
  return result;
}

/** Number the full sibling tree, so search/collapse never renumber hidden rows. */
export function rowNumbers(document) {
  const { style, suffix } = numberingSettings(document);
  const labels = new Map();
  if (style === 'none') return labels;
  function visit(rows, path = []) {
    rows.forEach((row, index) => {
      const number = index + 1;
      const next = [...path, number];
      const label = style === 'section' ? next.join('.') : style === 'alpha' ? alpha(number) : style === 'roman' ? roman(number) : String(number);
      labels.set(row.id, label + suffix);
      visit(row.children ?? [], next);
    });
  }
  visit(document.rows);
  return labels;
}

export function mountNumberingControls(toolbar, context) {
  const dom = toolbar.ownerDocument;
  const style = dom.createElement('select');
  style.setAttribute('aria-label', 'Row numbering');
  for (const [value, text] of [['none', 'No numbering'], ['decimal', '1. Numbers'], ['alpha', 'a. Letters'], ['roman', 'i. Roman'], ['section', '1.1 Section numbers']]) {
    const option = dom.createElement('option'); option.value = value; option.textContent = text; style.appendChild(option);
  }
  const suffix = dom.createElement('select');
  suffix.setAttribute('aria-label', 'Number suffix');
  for (const value of numberingSuffixes) {
    const option = dom.createElement('option'); option.value = value; option.textContent = value || 'No suffix'; suffix.appendChild(option);
  }
  function change() {
    context.change((document) => setNumbering(document, { style: style.value, suffix: suffix.value }), { type: 'numbering', selection: context.getSelection() });
  }
  style.addEventListener('change', change); suffix.addEventListener('change', change);
  toolbar.appendChild(style); toolbar.appendChild(suffix);
  return (document) => { const settings = numberingSettings(document); style.value = settings.style; suffix.value = settings.suffix; suffix.disabled = settings.style === 'none'; };
}
