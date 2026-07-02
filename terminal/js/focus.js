class FocusManager {
    constructor() {
        this.elements = [];
        this.currentElement = null;
    }

    scan(container) {
        this.elements = Array.from(container.querySelectorAll('[data-selectable]'));
        
        if (this.elements.length > 0 && !this.elements.includes(this.currentElement)) {
            this.setFocus(this.elements[0]);
        }
    }

    move(direction) {
        if (this.elements.length === 0) return;
        
        let currentIndex = this.elements.indexOf(this.currentElement);
        if (currentIndex === -1) currentIndex = 0;

        if (direction === 'DOWN' || direction === 'RIGHT') currentIndex++;
        if (direction === 'UP' || direction === 'LEFT') currentIndex--;
        
        currentIndex = (currentIndex + this.elements.length) % this.elements.length;
        this.setFocus(this.elements[currentIndex]);
    }

    setFocus(element) {
        if (this.currentElement) this.currentElement.classList.remove('focused');
        this.currentElement = element;
        
        if (this.currentElement) {
            this.currentElement.classList.add('focused');
            this.currentElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            if (typeof CAIN_Audio !== 'undefined') CAIN_Audio.navHover();
        }
    }

    activate() {
        if (this.currentElement) {
            if (typeof CAIN_Audio !== 'undefined') CAIN_Audio.navSelect();
            return this.currentElement;
        }
        return null;
    }
}