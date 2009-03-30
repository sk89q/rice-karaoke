// $Id$
/*
 * RiceKaraoke JavaScript karaoke engine 
 * Copyright (c) 2005-2009 sk89q <http://sk89q.therisenrealm.com>
 */

// A lot could be done to improve this renderer!

function SimpleKaraokeDisplayEngine(containerID, numLines) {
    this.container = document.getElementById(containerID);
    this.displays = [];
    
    // Create display elements
    for (var i = 0; i < numLines; i++) {
        var displayElement = document.createElement('div');
        displayElement.id = 'karaoke-display-' + i;
        
        var karaokeLine = document.createElement('div');
        karaokeLine.className = 'karaoke-line';
        displayElement.appendChild(karaokeLine);
        
        var karaokeOverlay = document.createElement('div');
        karaokeOverlay.className = 'karaoke-overlay';
        displayElement.appendChild(karaokeOverlay);
        
        this.container.appendChild(displayElement);
        
        this.displays[i] = new SimpleKaraokeDisplay(this, displayElement, karaokeLine, karaokeOverlay);
    }
}

SimpleKaraokeDisplayEngine.prototype.getDisplay = function(displayIndex) {
    return this.displays[displayIndex];
};

function SimpleKaraokeDisplay(engine, displayElement, karaokeLine, karaokeOverlay) {
    this.engine = engine;
    this.type = RiceKaraokeShow.TYPE_KARAOKE;

    this.display = displayElement;
    this.element = karaokeLine;
    this.overlay = karaokeOverlay;
    
    this.currentCSSClass = null;
    this.setClass();
}

SimpleKaraokeDisplay.escapeHTML = function(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&gt;')
        .replace(/>/g, '&lt;');
}

SimpleKaraokeDisplay.prototype.clear = function() {
    this.element.innerHTML = '';
    this.overlay.innerHTML = '';
}

SimpleKaraokeDisplay.prototype.renderText = function(text) {
    this.setClass();
    this.element.innerHTML = SimpleKaraokeDisplay.escapeHTML(text);
    this.overlay.innerHTML = '';
};

SimpleKaraokeDisplay.prototype.renderReadyCountdown = function(countdown) {
    var content = '(Ready... ' + countdown + ')';
    this.setClass();
    this.element.innerHTML = content;
    this.overlay.innerHTML = '';
};

SimpleKaraokeDisplay.prototype.renderInstrumental = function() {
    var content = '&#9835; Instrumental &#9835;';
    this.setClass();
    this.element.innerHTML = content;
    this.overlay.innerHTML = '';
};

SimpleKaraokeDisplay.prototype.renderKaraoke = function(passed, current, upcoming, 
                                                        fragmentPercent) {
    var passedText = '';
    for (var i in passed) {
        passedText += passed[i].text;
    }
    
    var upcomingText = '';
    for (var i in upcoming) {
        upcomingText += upcoming[i].text;
    }
    
    // Text underneath the highlighting
    var content = passedText + current.text + upcomingText;
    
    // If there is a space at the beginning of current.text, we need to remove
    // it and move it to passedText, because the space is not part of the
    // karaoke
    var strippedCurrentText = current.text.replace(/^\s+/, '');
    var m;
    if (m = current.text.match(/^\s+/)) {
        passedText += m[0];
    }
    
    this.setClass();
    
    // Create a test element to find the width of the passed text and the
    // current text
    var test = document.createElement('div');
    test.style.display = 'inline';
    test.style.visibility = 'hidden';
    test.style.padding = '0';
    this.element.parentNode.appendChild(test);
    // Get total text width
    test.innerHTML = SimpleKaraokeDisplay.escapeHTML(content);
    var totalTextWidth = $(test).width();
    // Get passed text width
    test.innerHTML = SimpleKaraokeDisplay.escapeHTML(passedText);
    var passedTextWidth = $(test).width();
    // Get current text width
    test.innerHTML = SimpleKaraokeDisplay.escapeHTML(strippedCurrentText);
    var currentTextWidth = $(test).width();
    test.parentNode.removeChild(test);

    this.element.innerHTML = SimpleKaraokeDisplay.escapeHTML(content);
    while (this.overlay.childNodes.length > 0) {
        this.overlay.removeChild(this.overlay.firstChild);
    }
    var innerOverlay = document.createElement('div');
    innerOverlay.className = 'karaoke-inner-overlay';
    innerOverlay.innerHTML = SimpleKaraokeDisplay.escapeHTML(passedText + current.text);
    this.overlay.appendChild(innerOverlay);
    this.overlay.style.width = totalTextWidth + 'px';
    innerOverlay.style.width = (passedTextWidth + (fragmentPercent / 100 * currentTextWidth)) + 'px';
};

SimpleKaraokeDisplay.prototype.setClass = function() {
    if (this.type == RiceKaraokeShow.TYPE_UPCOMING) {
        var wantedClass = 'karaoke-type-upcoming';
    } else if (this.type == RiceKaraokeShow.TYPE_READY) {
        var wantedClass = 'karaoke-type-ready';
    } else if (this.type == RiceKaraokeShow.TYPE_INSTRUMENTAL) {
        var wantedClass = 'karaoke-type-instrumental';
    } else {
        var wantedClass = 'karaoke-type-karaoke';
    }
    
    // Only change the className if it needs changing
    if (wantedClass != this.currentCSSClass) {
        this.display.className = wantedClass;
        this.currentCSSClass = wantedClass;
    }
};