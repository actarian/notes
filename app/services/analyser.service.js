/* global angular */

(function() {
    "use strict";

    var app = angular.module('app');

    app.factory('AudioSound', ['$q', function($q) {

        window.AudioContext = window.AudioContext || window.webkitAudioContext;

        var ctx = new AudioContext();
        var buffers = {};

        function AudioSound(path, $options) {
            var options = {
                volume: 0.85,
                loop: false,
            };
            if ($options) {
                angular.extend(options, $options);
            }
            var sound = this;
            sound.path = path;
            sound.options = options;
            addAnalyserNode();
            addGainNode();
        }

        AudioSound.prototype = {
            nodes: {},
            addGainNode: function() {
                var sound = this;
                var node = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
                node.gain.value = sound.options.volume;
                node.connect(ctx.destination);
                sound.nodes.gain = node;
            },
            addAnalyserNode: function() {
                var sound = this;
                if (sound.options.analyser) {
                    var node = ctx.createAnalyser();
                    node.fftSize = 256 * 2;
                    sound.data = new Uint8Array(node.frequencyBinCount);
                    sound.nodes.analyser = node;
                }
            },
            connectNodes: function() {
                var sound = this;
                var source = sound.source;
                for (var p in sound.nodes) {
                    source.connect(sound.nodes[p]);
                }
            },
            getBuffer: function() {
                var deferred = $q.defer();
                var path = this.path;
                var buffer = buffers[path];
                if (buffer) {
                    deferred.resolve(buffer);
                } else {
                    AudioSound.load(this).then(function(buffer) {
                        deferred.resolve(buffer);
                    }, function(error) {
                        deferred.reject(error);
                    });
                }
                return deferred.promise;
            },
            getSource: function() {
                var deferred = $q.defer();
                var source = this.source;
                if (source) {
                    deferred.resolve(source);
                } else {
                    var sound = this;
                    this.getBuffer().then(function(buffer) {
                        var source = ctx.createBufferSource();
                        source.buffer = buffer;
                        sound.source = source;
                        connectNodes();
                        deferred.resolve(source);
                    }, function(error) {
                        deferred.reject(error);
                    });
                }
                return deferred.promise;
            },
            play: function() {
                var options = this.options;
                this.getSource().then(function(source) {
                    source.loop = options.loop;
                    if (source.start) {
                        source.start(0); // when, offset, duration
                    } else {
                        source.noteOn(0); // when, offset, duration
                    }
                });
                console.log('AudioSound.play');
            },
            stop: function() {
                var sound = this;
                var source = sound.source;
                if (source) {
                    if (source.stop) {
                        source.stop(0); // when
                    } else {
                        source.noteOff(0); // when
                    }
                }
                console.log('AudioSound.stop');
            },
            update: function() {
                var sound = this;
                if (sound.nodes.analyser) {
                    sound.nodes.analyser.getByteFrequencyData(sound.data);
                }
            }
        };

        function load(sound) {
            var deferred = $q.defer();
            var xhr = new XMLHttpRequest();
            xhr.responseType = "arraybuffer";
            xhr.open("GET", sound.path, true);
            xhr.onload = function() {
                ctx.decodeAudioData(xhr.response, function(buffer) {
                    if (!buffer) {
                        console.log('AudioSound.load.decodeAudioData.error', sound.path);
                        deferred.reject('AudioSound.load.decodeAudioData.error');
                        return;
                    }
                    // console.log('AudioSound.decodeAudioData', sound.path);
                    buffers[sound.path] = buffer;
                    deferred.resolve(buffer);
                });
            };
            xhr.onerror = function(error) {
                console.log('AudioManager.xhr.onerror', error);
                deferred.reject(error);
            };
            xhr.send();
            return deferred.promise;
        }

        AudioSound.load = load;

        return AudioSound;
    }]);

}());