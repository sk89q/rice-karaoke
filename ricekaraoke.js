// $Id$
/*
 * RiceKaraoke JavaScript karaoke engine 
 * <http://code.google.com/p/ricekaraoke/>
 * Licensed under the GNU General Public License version 3
 * Copyright (c) 2005-2009 sk89q <http://sk89q.therisenrealm.com>
 */

/**
 * RiceKaraoke is a karaoke timing engine for JavaScript. All it does is
 * take in the current time progress of a song and calls a renderer with
 * to display the karaoke. It accepts timings in KRL format and will
 * automatically generate preparation countdowns ("Ready... 3... 2... 1..."),
 * generate notices of instrumental portions, and show upcoming lyrics. The
 * timing engine supports for gradual fragment highlighting.
 *  
 */

/**
 * Instantiates a karaoke engine. This needs to be given the timings as a
 * JavaScript data structure in KRL format. The constructor will not
 * check the validity of the passed timings.
 * 
 * To actually show lyrics, look into the createShow() method.
 * 
 * @param {Array} timings
 */
function RiceKaraoke(timings) {
    // The timings need to be sorted due to the way that this works
    this.timings = timings.sort(function(a, b) {
        if (a.start == b.start) {
            return 0;
        }
        return a.start < b.start ? -1 : 1;
    });
}

/**
 * Used to convert Simple KRL to KRL.
 * 
 * @param {Array} simpleTimings
 * @return {Array}
 */
RiceKaraoke.simpleTimingToTiming = function(simpleTimings) {
    var timings = [];
    var y = 0;
    for (var i in simpleTimings) {
        timings[y++] = {
            start: simpleTimings[i][0],
            end: simpleTimings[i][1],
            line: RiceKaraoke.simpleKarakokeToKaraoke(simpleTimings[i][2]),
            renderOptions: simpleTimings[i].length >= 4 ? simpleTimings[i][3] : {}
        };
    }
    
    return timings;
};

/**
 * Used to convert Simple KRL fragments to KRL fragments. See
 * simpleTimingToTiming();
 * 
 * @param {Array} simpleKaraoke
 * @return {Array}
 */
RiceKaraoke.simpleKarakokeToKaraoke = function(simpleKaraoke) {
    var karaoke = [];
    var y = 0;
    for (var i in simpleKaraoke) {
        karaoke[y++] = {
            start: simpleKaraoke[i][0],
            text: simpleKaraoke[i][1],
            end: simpleKaraoke[i].length >= 3 ? parseFloat(simpleKaraoke[i][2]) : null,
            renderOptions: simpleKaraoke[i].length >= 4 ? simpleKaraoke[i][3] : {}
        };
    }
    
    return karaoke;
};

/**
 * Creates a "show." A show has a group of settings associated with it and
 * you can create different shows if you want to use different settings (and
 * have more than one karaoke display on the same page, for whatever reason).
 * You also need a new show for every new display.
 * 
 * @param displayEngine Needs to be a karaoke renderer instance
 * @param {Number} numLines Number of karaoke lines
 * @returns {RiceKaraokeShow}
 */
RiceKaraoke.prototype.createShow = function(displayEngine, numLines) {
    return new RiceKaraokeShow(this, displayEngine, numLines);
};

/**
 * Represents a show. Use RiceKaraoke's createShow() method to create an
 * instance of this. You should not need to create an instance of this
 * yourself.
 * 
 * @param {RiceKaraoke} engine
 * @param displayEngine
 * @param {Number} numLines
 */
function RiceKaraokeShow(engine, displayEngine, numLines) {
    this.showReady = true;
    this.showInstrumental = true;
    
    this.upcomingThreshold = 5; // Number of seconds before a line to show its
                                // upcoming line
    this.readyThreshold = 2; // How long ago the previous line had to be in
                             // order to show that "Ready..." countdown. Be
                             // aware that the "Ready..." message shows with the
                             // upcoming message, and so the readyThreshold
                             // cannot be higher than upcomingThreshold.
    this.antiFlickerThreshold = .5;
    
    // == No user-editable settings below ==
    
    this._engine = engine;
    this._displayEngine = displayEngine;
    this._numLines = numLines;
    
    this._displays = [];
    this._index = 0;
    this._relativeLastKaraokeLine = 0;
    this._hasReadyLine = false;
    this._hasInstrumentalLine = false;
    
    this.reset();
}

/**
 * Represents a karaoke line. This is used for the renderer, and it is not
 * used for anything else as each line is a specific object in this
 * class.
 * 
 */
RiceKaraokeShow.TYPE_KARAOKE = 0;
/**
 * Represents an upcoming line. This is used for the renderer, and it is not
 * used for anything else as each line is a specific object in this
 * class.
 * 
 */
RiceKaraokeShow.TYPE_UPCOMING = 1;
/**
 * Represents a preparation line. This is used for the renderer, and it is not
 * used for anything else as each line is a specific object in this
 * class.
 * 
 */
RiceKaraokeShow.TYPE_READY = 2;
/**
 * Represents an instrumental line. This is used for the renderer, and it is not
 * used for anything else as each line is a specific object in this
 * class.
 * 
 */
RiceKaraokeShow.TYPE_INSTRUMENTAL = 3;

/**
 * Attempts to reset most of the progress of the show. During the progress
 * of the show, some numbers are cached in order to reduce the number of
 * iterations performed. While moving ahead in the music track is fine, you
 * cannot move backwards unless you call this method.
 * 
 * If you allow a scrubber for the music/video, then you need to make frequent
 * calls of this method whenever the user changes the media's position. Once
 * this is called, a "rewind" is basically made on the timings. This should not
 * be too large of a performance hit.
 * 
 */
RiceKaraokeShow.prototype.reset = function() {
    this._displays = []; // Clear
    
    // Prefill the displays array with null
    // The length of this array is used to get the number of available displays
    for (var i = 0; i < this._numLines; i++) {
        this._displays[this._displays.length] = null;
        this._displayEngine.getDisplay(i).clear();
    }

    this._index = 0;
    this._relativeLastKaraokeLine = 0;
    this._hasReadyLine = false;
    this._hasInstrumentalLine = false;
};

/**
 * Takes in a timing and renders it. This should be called multiple times
 * within the same second.
 * 
 * "Accurate" mode means that a millisecond back will be rendered for the number
 * of available displays. This is for use with a scrubber, but it should not
 * be used during normal play.
 * 
 * @param {Number} elapsed
 * @param {Boolean} accurate
 */
RiceKaraokeShow.prototype.render = function(elapsed, accurate) {
    if (accurate) {
        var numDisplays = this._displays.length;
        for (var i = numDisplays; i > 0; i--) {
            this.render(elapsed - i / 1000, false);
        }
        
        // Now we need to find an accurate value for _relativeLastKaraokeLine
        this._relativeLastKaraokeLine = 0;
        for (var i = 0; i < this._engine.timings.length; i++) {
            if (this._engine.timings[i].start < elapsed &&
                this._engine.timings[i].end > this._relativeLastKaraokeLine) {
                this._relativeLastKaraokeLine = this._engine.timings[i].end;
                break;
            }
        }
    }
    
    var freeDisplays = [];
    var displaysToClear = [];
    var unfreedDisplays = {}; 
    var displaysToUpdate = [];

    // Look for empty displays and displays that need to be updated
    for (var i in this._displays) {
        // Display has been empty for a while
        if (this._displays[i] == null) {
            freeDisplays[freeDisplays.length] = i;
        // Line needs to expire
        } else if (this._displays[i].end <= elapsed) {
            if (this._displays[i] instanceof RiceKaraokeReadyLine) {
                this._hasReadyLine = false;
            }
            if (this._displays[i] instanceof RiceKaraokeInstrumentalLine) {
                this._hasInstrumentalLine = false;
            }
            // It's time for this line to expire, but it may return a
            // replacement for itself
            var replacement = this._displays[i].expire(elapsed);
            if (replacement != null) {
                this._displays[i] = replacement;
            // Otherwise we just mark the slot as free
            } else {
                freeDisplays[freeDisplays.length] = i;
                displaysToClear[displaysToClear.length] = i;
            }
        // The line exists, so we need to update it
        } else {
            displaysToUpdate[displaysToUpdate.length] = i;
        }
    }
    
    // If there are free displays, look for lines to push onto the player
    if (freeDisplays.length > 0) {
        for (var i = this._index; i < this._engine.timings.length; i++) {
            if (freeDisplays.length == 0) {
                break;
            }
            
            var timing = this._engine.timings[i];

            // A line needs to be shown
            if (timing.start <= elapsed && timing.end >= elapsed) {
                var freeDisplay = freeDisplays.shift();
                unfreedDisplays[freeDisplay] = true; // Kind of ugly
                this._displays[freeDisplay] = new RiceKaraokeKaraokeLine(
                    this.getDisplay(freeDisplay), elapsed, timing
                );
                this._relativeLastKaraokeLine = timing.end;
                this._index = i + 1;
            // Do an upcoming line
            } else if ((timing.start - this.upcomingThreshold <= elapsed ||
                       timing.start - this._relativeLastKaraokeLine < this.antiFlickerThreshold) && 
                       timing.end >= elapsed) {
                var freeDisplay = freeDisplays.shift();
                unfreedDisplays[freeDisplay] = true; // Kind of ugly
                this._displays[freeDisplay] = new RiceKaraokeUpcomingLine(
                    this.getDisplay(freeDisplay), elapsed, timing
                );
                this._index = i + 1;
                
                // If the last line was a while ago, we need to do that 
                // 'Ready...' stuff
                if (this.showReady &&
                    elapsed - this._relativeLastKaraokeLine >= this.readyThreshold &&
                    !this._hasReadyLine && freeDisplays.length >= 0) {
                    var freeDisplay = freeDisplays.shift();
                    unfreedDisplays[freeDisplay] = true; // Kind of ugly
                    this._displays[freeDisplay] = new RiceKaraokeReadyLine(
                        this.getDisplay(freeDisplay), elapsed, timing.start - elapsed
                    );
                    this._hasReadyLine = true;
                }
                
                // This is for the actual line later on, since we won't come
                // back to this for loop when the engine transitions from the
                // upcoming line to the karaoke line
                this._relativeLastKaraokeLine = timing.end;
            // Do an instrumental line
            } else if (this.showInstrumental && freeDisplays.length == this._displays.length &&
                       !this._hasInstrumentalLine) {
                var freeDisplay = freeDisplays.shift();
                unfreedDisplays[freeDisplay] = true; // Kind of ugly);
                this._displays[freeDisplay] = new RiceKaraokeInstrumentalLine(
                    this.getDisplay(freeDisplay), elapsed, timing.start - this.upcomingThreshold
                );
                this._hasInstrumentalLine = true;
            // Else we do nothing
            } else if (timing.end > elapsed) {
                break;
            }
        }
    }

    // We need to clear displays that are empty and were not updated with
    // a new karaoke line
    if (displaysToClear.length > 0) {
        for (var i in displaysToClear) {
            if (!(displaysToClear[i] in unfreedDisplays)) {
                this._displays[displaysToClear[i]] = null;
                this._displayEngine.getDisplay(displaysToClear[i]).clear();
            }
        }
    }

    // Update lines
    if (displaysToUpdate.length > 0) {
        for (var i in displaysToUpdate) {
            this._displays[displaysToUpdate[i]].update(elapsed)
        }
    }
};

/**
 * Get a particular numbered display from the renderer.
 * 
 * @param {Number} displayIndex
 * @return
 */
RiceKaraokeShow.prototype.getDisplay = function(displayIndex) {
    return this._displayEngine.getDisplay(displayIndex);
};

/**
 * Represents the current karaoke line (to be highlighted). Once the line is
 * over with, this object will be left to the garbage collector.
 * 
 * @param display
 * @param {Number} elapsed
 * @param {Object} timing Current line
 */
function RiceKaraokeKaraokeLine(display, elapsed, timing) {
    this._display = display;
    this._timing = timing;
    this._elapsed = elapsed;
    this.end = timing.end; // Used by RiceKaraokeShow to know when to let this
                           // object "expire" (and leave it to the GC)
    
    this._display.type = RiceKaraokeShow.TYPE_KARAOKE;
    this.update(elapsed);
}

/**
 * This is called everytime render() of RiceKaraokeShow is called, but only if
 * this object hasn't expired.
 * 
 * @param {Number} elapsed
 * @param {Boolean} Whether this object should be kept (and not expire)
 */
RiceKaraokeKaraokeLine.prototype.update = function(elapsed) {
    var passedFragments = [];
    var currentFragmentPercent = 0.0;
    var currentFragment = null;
    var upcomingFragments = [];

    for (var l = 0; l < this._timing.line.length; l++) {
        var fragment = this._timing.line[l];
        if (this._timing.start + fragment.start <= elapsed) {
            // The last currentFragment wasn't really a currentFragment
            if (currentFragment != null) {
                passedFragments[passedFragments.length] = currentFragment;
            }
            currentFragment = fragment;
            // Percent elapsed for the current fragment
            var fragmentEnd = this._timing.line.end ? this._timing.line.end :
                                  (this._timing.line.length > l + 1 ?
                                  this._timing.line[l + 1].start :
                                  this._timing.end - this._timing.start);
            currentFragmentPercent = (elapsed - (this._timing.start + fragment.start)) /
                                     (fragmentEnd - fragment.start) * 100;
        } else {
            upcomingFragments[upcomingFragments.length] = fragment;
        }
    }
    
    this._display.renderKaraoke(passedFragments, currentFragment,
                               upcomingFragments, currentFragmentPercent);
    
    return true;
};

/**
 * Called when this object is expiring. This should return another object to
 * replace itself. Because we don't need to replace this with anything, we will
 * return a null.
 * 
 * @param {Number} elapsed
 * @return
 */
RiceKaraokeKaraokeLine.prototype.expire = function(elapsed) {
    return null;
};

/**
 * Used to represent preparation lines. This will replace itself with an
 * instance of RiceKaraokeKaraokeLine.
 * 
 * @param display
 * @param {Number} elapsed
 * @param {Object} timing The line/timing that this ready line is for
 */
function RiceKaraokeUpcomingLine(display, elapsed, timing) {
    this._display = display;
    this._timing = timing;
    this._elapsed = elapsed;
    this.end = timing.start; // Used by RiceKaraokeShow to know when to let this
                             // object "expire" (and leave it to the GC)

    var text = '';
    for (var i in timing.line) {
        text += timing.line[i].text;
    }

    this._display.type = RiceKaraokeShow.TYPE_UPCOMING;
    this._display.renderText(text);
}

/**
 * This is called everytime render() of RiceKaraokeShow is called, but only if
 * this object hasn't expired.
 * 
 * @param {Number} elapsed
 * @param {Boolean} Whether this object should be kept (and not expire)
 */
RiceKaraokeUpcomingLine.prototype.update = function(elapsed) {
    return true;
};

/**
 * Called when this object is expiring. We want to replace this with the
 * actual karaoke line.
 * 
 * @param {Number} elapsed
 * @return
 */
RiceKaraokeUpcomingLine.prototype.expire = function(elapsed) {
    return new RiceKaraokeKaraokeLine(this._display, elapsed, this._timing);
};

/**
 * Used to represent preparation lines.
 * 
 * @param display
 * @param {Number} elapsed
 * @param {Number} countdown Number of seconds until the karaoke line comes up
 * @return
 */
function RiceKaraokeReadyLine(display, elapsed, countdown) {
    this._display = display;
    this._start = elapsed;
    this.end = elapsed + countdown;  // Expire after the countdown ends

    this._display.type = RiceKaraokeShow.TYPE_READY;
    this._display.renderReadyCountdown(Math.round(countdown + 1));
}

/**
 * This is called everytime render() of RiceKaraokeShow is called, but only if
 * this object hasn't expired. We need to re-render a different number.
 * 
 * @param {Number} elapsed
 * @param {Boolean} Whether this object should be kept (and not expire)
 */
RiceKaraokeReadyLine.prototype.update = function(elapsed) {
    var countdown = this.end - elapsed;
    this._display.renderReadyCountdown(Math.round(countdown + 1));
    
    return true;
};

/**
 * Called when this object is expiring. This should return another object to
 * replace itself. Because we don't need to replace this with anything, we will
 * return a null.
 * 
 * @param {Number} elapsed
 * @return
 */
RiceKaraokeReadyLine.prototype.expire = function(elapsed) {
    return null;
};

/**
 * Represents an instrumental line.
 * 
 * @param display
 * @param {Number} elapsed
 * @param {Number} end
 */
function RiceKaraokeInstrumentalLine(display, elapsed, end) {
    this._display = display;
    this._start = elapsed;
    this.end = end

    this._display.type = RiceKaraokeShow.TYPE_INSTRUMENTAL;
    this._display.renderInstrumental();
}

/**
 * This is called everytime render() of RiceKaraokeShow is called, but only if
 * this object hasn't expired.
 * 
 * @param {Number} elapsed
 * @param {Boolean} Whether this object should be kept (and not expire)
 */
RiceKaraokeInstrumentalLine.prototype.update = function(elapsed) {
    return true;
};

/**
 * Called when this object is expiring. This should return another object to
 * replace itself. Because we don't need to replace this with anything, we will
 * return a null.
 * 
 * @param {Number} elapsed
 * @return
 */
RiceKaraokeInstrumentalLine.prototype.expire = function(elapsed) {
    return null;
};