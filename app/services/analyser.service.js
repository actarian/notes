/* global angular */

(function() {
    "use strict";

    var app = angular.module('app');

    app.factory('AudioSound', ['$q', function($q) {

        function AudioSound(path, options) {
            var defaultOptions = {
                volume: 85,
                loop: false,
            };
            if (options) {
                angular.extend(defaultOptions, options);
            }
            // var manager = AudioManager.getInstance();
            var sound = this;
            sound.path = path;
            sound.options = defaultOptions;
            // sound.manager = manager;
            sound.setVolume(defaultOptions.volume);
            // manager.add(sound);
            if (sound.options.analyser) {
                var analyser = ctx.createAnalyser();
                analyser.fftSize = 256 * 2;
                sound.data = new Uint8Array(analyser.frequencyBinCount);
                sound.analyser = analyser;
            }
        }

        var _AudioContext = window.AudioContext || window.webkitAudioContext;
        var ctx = new _AudioContext();
        var buffers = {};

        AudioSound.translateVolume = function(volume, inverse) {
            return inverse ? volume * 100 : volume / 100;
        };

        AudioSound.load = function(sound) {
            var deferred = $q.defer();
            var path = sound.path;
            var xhr = new XMLHttpRequest();
            xhr.responseType = "arraybuffer";
            xhr.open("GET", path, true);
            xhr.onload = function() {
                // Asynchronously decode the audio file data in xhr.response
                ctx.decodeAudioData(xhr.response, function(buffer) {
                    if (!buffer) {
                        console.log('AudioSound.load.decodeAudioData.error', path);
                        deferred.reject('AudioSound.load.decodeAudioData.error');
                        return;
                    }
                    console.log('AudioSound.decodeAudioData', path);
                    buffers[path] = buffer;
                    deferred.resolve(buffer);
                });
            };
            xhr.onerror = function(error) {
                console.log('AudioManager.xhr.onerror', error);
                deferred.reject(error);
            };
            xhr.send();
            return deferred.promise;
        };

        AudioSound.prototype = {
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
                        var gainNode = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
                        gainNode.gain.value = sound.volume;
                        source.buffer = buffer;
                        source.connect(gainNode);
                        if (sound.analyser) {
                            source.connect(sound.analyser);
                            // source.connect(ctx.destination);
                        }
                        gainNode.connect(ctx.destination);
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
                        source.start(0); // (0, 2, 1);
                    } else {
                        source.noteOn(0); // (0, 2, 1);
                    }
                });
                console.log('AudioSound.play');
            },
            stop: function() {
                this.getSource().then(function(source) {
                    if (source.stop) {
                        source.stop(0); // (0, 2, 1);
                    } else {
                        source.noteOff(0); // (0, 2, 1);
                    }
                });
                console.log('AudioSound.stop');
            },
            getVolume: function() {
                return AudioSound.translateVolume(this.volume, true);
            },
            // Expect to receive in range 0-100
            setVolume: function(volume) {
                this.volume = AudioSound.translateVolume(volume);
            },
            update: function() {
                var sound = this;
                if (sound.analyser) {
                    sound.analyser.getByteFrequencyData(sound.data);
                }
            }
        };

        return AudioSound;
    }]);

}());