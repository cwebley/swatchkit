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
