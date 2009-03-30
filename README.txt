RiceKaraoke JavaScript karaoke engine
Copyright (c) 2005 and onward sk89q <http://sk89q.therisenrealm.com>
Licensed under the GNU General Public License v3

Introduction
------------

RiceKaraoke is a karaoke engine written in JavaScript. It takes in a
list of lyrics with their timings and calls a renderer at the
appropriate time with the appropriate lyrics. RiceKaraoke supports
per-word highlighting, "Ready... 3... 2... 1..." countdowns, and
indications of instrumental portions.

A simple renderer has been supplied that can do basic left-aligned
karaoke. Good luck if you want to apply more CSS to the HTML generated
by this renderer.

Usage
-----

RiceKaraoke takes in both KRL and Simple KRL, the native format of
RiceKaraoke for lyrics and timing. It is nothing more than a JavaScript
data structure consisting of arrays and objects.

KRL looks like this:
[
    {
        start: 0.0,
        end: 5.2,
        line: [
            {
                start: 0.0,
                text: 'The',
                end: null, // Can be null
                renderOptions: {
                    // Anything that you want
                    // The renderer has access to this
                }
            },
            {
                start: .5,
                text: 'roses',
                end: null,
                renderOptions: {}
            }
            // etc.
        ],
        renderOptions: {}
    }
    {
        start: 5.2,
        end: 6,
        line: [
            {
                start: 0.0,
                text: 'When',
                end: null,
                renderOptions: {}
            },
            {
                start: .6,
                text: 'the',
                end: null,
                renderOptions: {}
            }
            // etc.
        ],
        renderOptions: {}
    },
    // etc.
]

The above in Simple KRL:
[
    [
        0.0, 5.2, [
            [0.0, 'The', null, {}],
            [.5, 'roses', null, {}]
            }
            // etc.
        ], {}
    ]
    // etc.
]

RiceKaraoke.simpleTimingToTiming can be used to convert from Simple KRL
to KRL.

To use RiceKaraoke:
var numDisplayLines = 2; // Number of lines to do the karaoke with
var karaoke = new RiceKaraoke(
    RiceKaraoke.simpleTimingToTiming(timings)
);
// karaoke-display is the ID of a DIV
var renderer = new SimpleKaraokeDisplayEngine('karaoke-display', 
    numDisplayLines);
var show = karaoke.createShow(renderer, numDisplayLines);

Then call show.render(...) with the number of elapsed seconds (float).

CSS used by the SimpleKaraokeDisplayEngine:

.karaoke-type-upcoming {
    color: #999999;
}
.karaoke-type-ready {
    color: #058359;
}
.karaoke-type-instrumental {
    color: #065BC4;
}
.karaoke-line {
    height: 45px;
}
.karaoke-overlay {
    height: 45px;
    margin: -45px 0 0 0;
}
.karaoke-type-karaoke .karaoke-inner-overlay {
    white-space: nowrap;
    overflow: hidden;
    color: #FF0000;
    font-weight: normal;
    text-decoration: underline;
}