/**
 * Verda DOM Utilities and rendering functions (Placeholder for Phase 2 UI integration)
 */
const VerdaDOM = {
  /**
   * Helper to query elements securely
   */
  $(selector) {
    return document.querySelector(selector);
  },

  /**
   * Helper to create elements with classes/attributes
   */
  createElement(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'class') {
        element.className = value;
      } else if (key.startsWith('aria-') || key === 'role' || key === 'id') {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    }
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child) {
        element.appendChild(child);
      }
    }
    return element;
  },

  /**
   * Render alert banner with ARIA support
   */
  showAlert(message, type = 'info') {
    const alertBox = this.createElement('div', {
      class: `alert alert-${type}`,
      role: 'alert'
    }, message);
    document.body.appendChild(alertBox);
    setTimeout(() => alertBox.remove(), 5000);
  }
};
