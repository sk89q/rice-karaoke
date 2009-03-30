// $Id$
/*
 * RiceKaraoke JavaScript karaoke engine 
 * Licensed under the GNU General Public License version 3
 * Copyright (c) 2005-2009 sk89q <http://sk89q.therisenrealm.com>
 */

/**
 * Creates an instance of the SimpleKaraokeDisplayEngine. This is a simple
 * karaoke display renderer for RiceKaraoke that supports granular per-syllable
 * highlighting. However, this renderer does not handle wrapping of the lines
 * at all. To render highlighting, this render places an overlay element over
 * the text and changes its width so that only the highlighted content shows.
 * 
 * To use this renderer, just create a new instance of this class with the ID
 * of the element that you want the karaoke lines in. You do not need to
 * populate this element with any children. You will need to add some CSS
 * styling to make the highlighting show.
 * 
 * @param {String} containerID
 * @param {Number} numLines
 */
function SimpleKaraokeDisplayEngine(containerID, numLines) {
    var elm = document.getElementById(containerID);
    if (!elm) {
        throw new Exception("Can't find element #" + containerID)
    }
    this._container = jQuery(elm);
    this._displays = [];
    
    // We create a "display" element for each line of karaoke. In terms of
    // HTML, this is one DIV element per display. We create an instance of
    // SimpleKaraokeDisplay here and we do not ever need to re-create it.
    for (var i = 0; i < numLines; i++) {        
        this._displays[i] = new SimpleKaraokeDisplay(this, this._container, i);
    }
}

/**
 * Gets a display for a particular numbered karaoke line. This is called by
 * the RiceKaraoke object primarily.
 * 
 * @param {Number} displayIndex
 * @return {SimpleKaraokeDisplay}
 */
SimpleKaraokeDisplayEngine.prototype.getDisplay = function(displayIndex) {
    return this._displays[displayIndex];
};

/**
 * This represents an actual karaoke numbered display. This class should not
 * be instantiated by you. The engine's getDisplay() method is made for
 * that purpose. However, the only thing that would be using this is the
 * RiceKaraoke engine.
 * 
 * @param {SimpleKaraokeDisplayEngine} engine
 * @param {DOMNode|DOMDocument} container
 * @param {array} displayIndex Display index number
 */
function SimpleKaraokeDisplay(engine, container, displayIndex) {
    this.type = RiceKaraokeShow.TYPE_KARAOKE;
    
    this._engine = engine;
    
    // Create display
    this._display = jQuery(document.createElement('div'));
    this._display.attr('id', 'karaoke-display-' + displayIndex);
    this._display.attr('class', 'karaoke-display');
    
    // Will contain the karaoke line / regular text
    this._element = jQuery(document.createElement('div'));
    this._element.attr('class', 'karaoke-line');
    this._display.append(this._element);
    
    container.append(this._display);
    
    // Empty overlay
    this._overlay = null;
    
    // Set the initial class and clear the display
    this._currentCSSClass = null;
    this._setClass();
    this.clear();
}

/**
 * Escapes HTML.
 * 
 * @param {String} str
 * @return {String}
 */
SimpleKaraokeDisplay._escapeHTML = function(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&gt;')
        .replace(/>/g, '&lt;');
};

/**
 * Used to set the class of the container karaoke element. This will only change
 * the class if it needs to.
 *
 */
SimpleKaraokeDisplay.prototype._setClass = function() {
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
    if (wantedClass != this._currentCSSClass) {
        this._display.attr('class', 'karaoke-display ' + wantedClass);
        this._currentCSSClass = wantedClass;
    }
};

/**
 * Remove the overlay element from the DOM tree.
 * 
 */
SimpleKaraokeDisplay.prototype._removeOverlay = function() {
    if (this._overlay != null) {
        this._overlay.remove();
        this._overlay = null;
    }
};

/**
 * Clears the display.
 *
 */
SimpleKaraokeDisplay.prototype.clear = function() {
    this._element.text('');
    this._removeOverlay();
};

/**
 * Renders text (no HTML). This is called by the karaoke engine to show just
 * plain text, which is usually the upcoming karaoke line. This can be called
 * multiple times for the same piece of text, although it practice it usually
 * doesn't happen.
 * 
 * @param {String} text
 */
SimpleKaraokeDisplay.prototype.renderText = function(text) {
    this._setClass();
    this._element.text(text);
    this._removeOverlay();
};

/**
 * Renders the "Ready... 3... 2... 1..." countdown. This can be called multiple
 * times for the same number (although it practice, it isn't). The karaoke
 * engine passes a float for the countdown.
 * 
 * @param {Number} countdown
 */
SimpleKaraokeDisplay.prototype.renderReadyCountdown = function(countdown) {
    var content = '(Ready... ' + countdown + ')';
    this._setClass();
    this._element.text(content);
    this._removeOverlay();
};

/**
 * Renders the instrumental line. This can be called multiple times, although
 * in practice it isn't. 
 * 
 */
SimpleKaraokeDisplay.prototype.renderInstrumental = function() {
    var content = '&#9835; Instrumental &#9835;';
    this._setClass();
    this._element.html(content);
    this._removeOverlay();
};

/**
 * Renders a karaoke line, including its highlight. This can be called multiple
 * times for the same input, although this does not happen in practice.
 * 
 * "passed" is an array of words/fragments that have already been "passed." The
 * items in this array are the fragment hashes/objects from the original KRL
 * timing array. Each item, thus, has the keys of start, end (could be null or
 * NaN), text, and renderOptions. renderOptions is an object that can contain
 * anything.
 * 
 * "current" has the current fragment that needs to be highlighted. It is a 
 * fragment from the KRL timing data structure (see above).
 * 
 * "upcoming" contains the words/fragments that are coming up. It is in the same
 * type and format as "passed".
 * 
 * To know how much of the current fragment to highlight, fragmentPercent has
 * the percent that needs to be highlighted. fragmentPercent's range is 0-100.
 * 
 * Be aware about spaces in the current fragment. It depends on who did the
 * timing and how s/he did it. The spaces may not actually count as part of
 * what to highlight. This method implement discards spaces from the beginning
 * (and puts it onto the "passed" part) but it leaves spaces at the end. This
 * means that each karaoke fragment starts right when the lyric fragment is
 * sung, but it may not end right when it ends.
 * 
 * @param {Array} passed
 * @param {Object} current
 * @param {Array} upcoming
 * @param fragmentPercent
 */
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
    
    this._setClass();
    
    // Create a test element to find widths
    var test = jQuery('<div style="display: inline; visibility: hidden; ' + 
                      'margin: 0; padding: 0; border: 0"></div>');
    this._element.parent().append(test); // Need to append it to have it inherit
                                         // its parent styles, and so we can
                                         // actually get some measurements
    var totalTextWidth = test.text(content).width();
    var passedTextWidth = test.text(passedText).width();
    var currentTextWidth = test.text(strippedCurrentText).width();
    test.remove(); // Goodbye!
    
    // Create an inner element, so we can get the top/left of the text
    this._element.empty();
    var innerElement = jQuery(document.createElement('span'));
    innerElement.text(content);
    this._element.append(innerElement);

    // Need this information to place the inner overlay
    var pos = innerElement.position();
    var innerElementLeft = pos.left;
    var elementHeight = this._element.height();
    
    // Now for the overlay
    this._removeOverlay();
    var overlay = jQuery(document.createElement('div'));
    overlay.attr('class', 'karaoke-overlay');
    overlay.text(passedText + current.text);
    overlay.css('position', 'relative');
    overlay.css('white-space', 'nowrap');
    overlay.css('overflow', 'hidden');
    overlay.width(passedTextWidth + (fragmentPercent / 100 * currentTextWidth));
    overlay.css('margin-top', '-' + elementHeight + 'px');
    overlay.css('visibility', 'hidden');
    this._display.append(overlay);
    overlay.css('left', innerElementLeft - overlay.position().left);
    overlay.css('visibility', '');
    this._overlay = overlay;
};