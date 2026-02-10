// Token Value Display Script
//
// Shows the computed (resolved) value of CSS custom properties next to each
// .token-value element in the token documentation pages. For example, a color
// token swatch might display "(#3b82f6)" beside the variable name.
//
// How it reaches the browser:
//   1. `swatchkit init` copies this file to swatchkit/tokens/script.js
//   2. The build scans section directories for loose .js files, collects them
//      (along with any component-folder scripts), wraps each in an IIFE, and
//      concatenates them into dist/swatchkit/js/swatches.js
//   3. The layout templates include a <script> tag pointing to js/swatches.js

const elements = document.querySelectorAll('.token-value');
if (elements.length > 0) {
  elements.forEach(el => {
    const prop = el.getAttribute('data-var');
    // Since this script runs at the end of body, styles should be loaded.
    const computed = getComputedStyle(el).getPropertyValue(prop).trim();
    if (computed) {
      el.innerHTML += ` <span style="opacity: 0.5; font-family: monospace; font-size: 0.8em">(${computed})</span>`;
    } else {
        // Fallback for when the variable isn't directly on the element or is global
        // Try creating a temp element to read the variable
        const temp = document.createElement('div');
        temp.style.fontSize = '16px'; // Force a known base
        temp.style.lineHeight = `var(${prop})`;
        document.body.appendChild(temp);
        const computedPx = getComputedStyle(temp).lineHeight;
        document.body.removeChild(temp);
        
        let displayValue = computedPx;
        if (computedPx.endsWith('px')) {
            const pxVal = parseFloat(computedPx);
            const ratio = pxVal / 16;
            displayValue = Math.round(ratio * 100) / 100;
        }
        
        if(displayValue) {
             el.innerHTML += ` <span style="opacity: 0.5; font-family: monospace; font-size: 0.8em">(${displayValue})</span>`;
        }
    }
  });
}
