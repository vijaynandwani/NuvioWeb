(function installNuvioTrailerAdblock() {
  "use strict";

  // Adapted for Nuvio's embedded trailer player from webosbrew/youtube-webos:
  // https://github.com/webosbrew/youtube-webos/blob/main/src/adblock.js
  // https://github.com/webosbrew/youtube-webos/blob/main/src/hooks/json-stringify.ts
  //
  // webOS injects this file into every frame owned by the application. Keep the
  // hook strictly scoped to YouTube embed documents so Nuvio's own JSON parsing
  // and unrelated pages remain untouched.
  var hostname = String(
    window.location && window.location.hostname ? window.location.hostname : ""
  ).toLowerCase();
  var pathname = String(
    window.location && window.location.pathname ? window.location.pathname : ""
  );
  var isYoutubeHost =
    hostname === "youtube.com" ||
    hostname.slice(-12) === ".youtube.com" ||
    hostname === "youtube-nocookie.com" ||
    hostname.slice(-21) === ".youtube-nocookie.com";

  if (!isYoutubeHost || pathname.indexOf("/embed/") !== 0) {
    return;
  }
  if (window.__nuvioTrailerAdblockInstalled) {
    return;
  }
  window.__nuvioTrailerAdblockInstalled = true;

  var originalParse = JSON.parse;
  var originalStringify = JSON.stringify;

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function cloneEnumerableObject(value) {
    var clone = Array.isArray(value) ? [] : {};
    var key;
    for (key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        clone[key] = value[key];
      }
    }
    return clone;
  }

  function markInlinePlaybackNoAd(value) {
    var playbackContext;
    var contentPlaybackContext;
    var clonedValue;
    var clonedPlaybackContext;
    var clonedContentPlaybackContext;

    if (!isObject(value)) {
      return value;
    }
    playbackContext = value.playbackContext;
    contentPlaybackContext = isObject(playbackContext) && playbackContext.contentPlaybackContext;
    if (!isObject(contentPlaybackContext)) {
      return value;
    }

    // YouTube freezes some request objects. Clone only the affected path instead
    // of mutating it, mirroring youtube-webos's structuredClone workaround while
    // remaining compatible with Chromium 68.
    clonedValue = cloneEnumerableObject(value);
    clonedPlaybackContext = cloneEnumerableObject(playbackContext);
    clonedContentPlaybackContext = cloneEnumerableObject(contentPlaybackContext);
    clonedContentPlaybackContext.isInlinePlaybackNoAd = true;
    clonedPlaybackContext.contentPlaybackContext = clonedContentPlaybackContext;
    clonedValue.playbackContext = clonedPlaybackContext;
    return clonedValue;
  }

  JSON.stringify = function nuvioTrailerStringify(value, replacer, space) {
    var filteredValue = value;
    try {
      filteredValue = markInlinePlaybackNoAd(value);
    } catch (_) {
      // Fail open: an upstream YouTube shape change must never break trailers.
    }
    return originalStringify.call(this, filteredValue, replacer, space);
  };

  JSON.parse = function nuvioTrailerParse() {
    var result = originalParse.apply(this, arguments);
    try {
      if (isObject(result) && result.adPlacements) {
        delete result.adPlacements;
      }
      if (isObject(result) && Array.isArray(result.adSlots)) {
        delete result.adSlots;
      }
      if (isObject(result) && result.playerAds) {
        delete result.playerAds;
      }
    } catch (_) {
      // Fail open: return YouTube's original response if filtering is no longer safe.
    }
    return result;
  };

  console.info("[Nuvio] YouTube trailer ad filters enabled");
})();
