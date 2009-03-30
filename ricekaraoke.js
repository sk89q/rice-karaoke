// $Id$
/*
 * RiceKaraoke JavaScript karaoke engine 
 * Copyright (c) 2005-2009 sk89q <http://sk89q.therisenrealm.com>
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

RiceKaraoke.prototype.createShow = function(displayEngine, numLines) {
    return new RiceKaraokeShow(this, displayEngine, numLines);
};

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
    
    this.engine = engine;
    this.displayEngine = displayEngine;
    
    this.displays = []; // List of display objects
    // Prefill the displays array with null
    // The length of this array is used to get the number of available displays
    for (var i = 0; i < numLines; i++) {
        this.displays[this.displays.length] = null;
        this.displayEngine.getDisplay(i).clear();
    }
    
    this.index = 0; // Current index in the list of timings, which is used so
                    // so that portions of the array that have been passed 
                    // will no longer be iterated through.
    this.relativeLastKaraokeLine = 0; // Store the last time that a karaoke
                                      // line was displayed. This can be in the
                                      // future, because it is the end property
                                      // of a timing.
    this.hasReadyLine = false; // Remembers whether a "Ready... 3... 2... 1...
                               // line is presently being shown.
    this.hasInstrumentalLine = false;
}

RiceKaraokeShow.TYPE_KARAOKE = 0;
RiceKaraokeShow.TYPE_UPCOMING = 1;
RiceKaraokeShow.TYPE_READY = 2;
RiceKaraokeShow.TYPE_INSTRUMENTAL = 3;

RiceKaraokeShow.prototype.render = function(elapsed) {
    var freeDisplays = [];
    var displaysToClear = [];
    var unfreedDisplays = {}; 
    var displaysToUpdate = [];

    // Look for empty displays and displays that need to be updated
    for (var i in this.displays) {
        // Display has been empty for a while
        if (this.displays[i] == null) {
            freeDisplays[freeDisplays.length] = i;
        // Line needs to expire
        } else if (this.displays[i].end <= elapsed) {
            if (this.displays[i] instanceof RiceKaraokeReadyLine) {
                this.hasReadyLine = false;
            }
            if (this.displays[i] instanceof RiceKaraokeInstrumentalLine) {
                this.hasInstrumentalLine = false;
            }
            // It's time for this line to expire, but it may return a
            // replacement for itself
            var replacement = this.displays[i].expire(elapsed);
            if (replacement != null) {
                this.displays[i] = replacement;
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
        for (var i = this.index; i < this.engine.timings.length; i++) {
            if (freeDisplays.length == 0) {
                break;
            }
            
            var timing = this.engine.timings[i];

            // A line needs to be shown
            if (timing.start <= elapsed && timing.end >= elapsed) {
                var freeDisplay = freeDisplays.shift();
                unfreedDisplays[freeDisplay] = true; // Kind of ugly
                this.displays[freeDisplay] = new RiceKaraokeKaraokeLine(
                    this.getDisplay(freeDisplay), elapsed, timing
                );
                this.relativeLastKaraokeLine = timing.end;
                this.index = i + 1;
            // Do an upcoming line
            } else if ((timing.start - this.upcomingThreshold <= elapsed ||
                       timing.start - this.relativeLastKaraokeLine < this.antiFlickerThreshold) && 
                       timing.end >= elapsed) {
                var freeDisplay = freeDisplays.shift();
                unfreedDisplays[freeDisplay] = true; // Kind of ugly
                this.displays[freeDisplay] = new RiceKaraokeUpcomingLine(
                    this.getDisplay(freeDisplay), elapsed, timing
                );
                this.index = i + 1;
                
                // If the last line was a while ago, we need to do that 
                // 'Ready...' stuff
                if (this.showReady &&
                    elapsed - this.relativeLastKaraokeLine >= this.readyThreshold &&
                    !this.hasReadyLine && freeDisplays.length >= 0) {
                    var freeDisplay = freeDisplays.shift();
                    unfreedDisplays[freeDisplay] = true; // Kind of ugly
                    this.displays[freeDisplay] = new RiceKaraokeReadyLine(
                        this.getDisplay(freeDisplay), elapsed, timing.start - elapsed
                    );
                    this.hasReadyLine = true;
                }
                
                // This is for the actual line later on, since we won't come
                // back to this for loop when the engine transitions from the
                // upcoming line to the karaoke line
                this.relativeLastKaraokeLine = timing.end;
            // Do an instrumental line
            } else if (this.showInstrumental && freeDisplays.length == this.displays.length) {
                var freeDisplay = freeDisplays.shift();
                unfreedDisplays[freeDisplay] = true; // Kind of ugly);
                this.displays[freeDisplay] = new RiceKaraokeInstrumentalLine(
                    this.getDisplay(freeDisplay), elapsed, timing.start - this.upcomingThreshold
                );
                this.hasInstrumentalLine = true;
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
                this.displays[displaysToClear[i]] = null;
                this.displayEngine.getDisplay(displaysToClear[i]).clear();
            }
        }
    }

    // Update lines
    if (displaysToUpdate.length > 0) {
        for (var i in displaysToUpdate) {
            this.displays[displaysToUpdate[i]].update(elapsed)
        }
    }
};

RiceKaraokeShow.prototype.getDisplay = function(displayIndex) {
    return this.displayEngine.getDisplay(displayIndex);
};

function RiceKaraokeKaraokeLine(display, elapsed, timing) {
    this.display = display;
    this.timing = timing;
    this.elapsed = elapsed;
    this.end = timing.end;
    
    this.display.type = RiceKaraokeShow.TYPE_KARAOKE;
    this.update(elapsed);
}

RiceKaraokeKaraokeLine.prototype.update = function(elapsed) {
    var passedFragments = [];
    var currentFragmentPercent = 0.0;
    var currentFragment = null;
    var upcomingFragments = [];

    for (var l = 0; l < this.timing.line.length; l++) {
        var fragment = this.timing.line[l];
        if (this.timing.start + fragment.start <= elapsed) {
            // The last currentFragment wasn't really a currentFragment
            if (currentFragment != null) {
                passedFragments[passedFragments.length] = currentFragment;
            }
            currentFragment = fragment;
            // Percent elapsed for the current fragment
            var fragmentEnd = this.timing.line.end ? this.timing.line.end :
                                  (this.timing.line.length > l + 1 ?
                                  this.timing.line[l + 1].start :
                                  this.timing.end - this.timing.start);
            currentFragmentPercent = (elapsed - (this.timing.start + fragment.start)) /
                                     (fragmentEnd - fragment.start) * 100;
        } else {
            upcomingFragments[upcomingFragments.length] = fragment;
        }
    }
    
    this.display.renderKaraoke(passedFragments, currentFragment,
                               upcomingFragments, currentFragmentPercent);
};

RiceKaraokeKaraokeLine.prototype.expire = function(elapsed) {
    return null;
};

function RiceKaraokeUpcomingLine(display, elapsed, timing) {
    this.display = display;
    this.timing = timing;
    this.elapsed = elapsed;
    this.end = timing.start;

    var text = '';
    for (var i in timing.line) {
        text += timing.line[i].text;
    }

    this.display.type = RiceKaraokeShow.TYPE_UPCOMING;
    this.display.renderText(text);
}

RiceKaraokeUpcomingLine.prototype.update = function(elapsed) {
    return true;
};

RiceKaraokeUpcomingLine.prototype.expire = function(elapsed) {
    return new RiceKaraokeKaraokeLine(this.display, elapsed, this.timing);
};

function RiceKaraokeReadyLine(display, elapsed, countdown) {
    this.display = display;
    this.start = elapsed;
    this.end = elapsed + countdown

    this.display.type = RiceKaraokeShow.TYPE_READY;
    this.display.renderReadyCountdown(Math.round(countdown + 1));
}

RiceKaraokeReadyLine.prototype.update = function(elapsed) {
    var countdown = this.end - elapsed;
    this.display.renderReadyCountdown(Math.round(countdown + 1));
    
    return true;
};

RiceKaraokeReadyLine.prototype.expire = function(elapsed) {
    return null;
};

function RiceKaraokeInstrumentalLine(display, elapsed, end) {
    this.display = display;
    this.start = elapsed;
    this.end = end

    this.display.type = RiceKaraokeShow.TYPE_INSTRUMENTAL;
    this.display.renderInstrumental();
}

RiceKaraokeInstrumentalLine.prototype.update = function(elapsed) {
    return true;
};

RiceKaraokeInstrumentalLine.prototype.expire = function(elapsed) {
    return null;
};