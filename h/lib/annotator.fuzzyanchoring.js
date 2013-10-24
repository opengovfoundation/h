// Generated by CoffeeScript 1.6.3
/*
** Annotator 1.2.6-dev-0c2668e
** https://github.com/okfn/annotator/
**
** Copyright 2012 Aron Carroll, Rufus Pollock, and Nick Stenning.
** Dual licensed under the MIT and GPLv3 licenses.
** https://github.com/okfn/annotator/blob/master/LICENSE
**
** Built at: 2013-10-24 17:59:31Z
*/



/*
//
*/

// Generated by CoffeeScript 1.6.3
(function() {
  var _ref,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Annotator.Plugin.FuzzyAnchoring = (function(_super) {
    __extends(FuzzyAnchoring, _super);

    function FuzzyAnchoring() {
      this.findAnchorWithFuzzyMatching = __bind(this.findAnchorWithFuzzyMatching, this);
      this.findAnchorWithTwoPhaseFuzzyMatching = __bind(this.findAnchorWithTwoPhaseFuzzyMatching, this);
      _ref = FuzzyAnchoring.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    FuzzyAnchoring.prototype.pluginInit = function() {
      var _this = this;
      this.textFinder = new DomTextMatcher(function() {
        return _this.annotator.domMapper.getCorpus();
      });
      this.annotator.virtualAnchoringStrategies.push({
        name: "two-phase fuzzy",
        code: this.findAnchorWithTwoPhaseFuzzyMatching
      });
      return this.annotator.virtualAnchoringStrategies.push({
        name: "one-phase fuzzy",
        code: this.findAnchorWithFuzzyMatching
      });
    };

    FuzzyAnchoring.prototype.findAnchorWithTwoPhaseFuzzyMatching = function(target) {
      var expectedEnd, expectedStart, match, options, posSelector, prefix, quote, quoteSelector, result, suffix;
      quoteSelector = this.annotator.findSelector(target.selector, "TextQuoteSelector");
      prefix = quoteSelector != null ? quoteSelector.prefix : void 0;
      suffix = quoteSelector != null ? quoteSelector.suffix : void 0;
      quote = quoteSelector != null ? quoteSelector.exact : void 0;
      if (!((prefix != null) && (suffix != null))) {
        return null;
      }
      posSelector = this.annotator.findSelector(target.selector, "TextPositionSelector");
      expectedStart = posSelector != null ? posSelector.start : void 0;
      expectedEnd = posSelector != null ? posSelector.end : void 0;
      options = {
        contextMatchDistance: this.annotator.domMapper.getDocLength() * 2,
        contextMatchThreshold: 0.5,
        patternMatchThreshold: 0.5,
        flexContext: true
      };
      result = this.textFinder.searchFuzzyWithContext(prefix, suffix, quote, expectedStart, expectedEnd, false, options);
      if (!result.matches.length) {
        return null;
      }
      match = result.matches[0];
      return {
        type: "text range",
        start: match.start,
        end: match.end,
        startPage: this.annotator.domMapper.getPageIndexForPos(match.start),
        endPage: this.annotator.domMapper.getPageIndexForPos(match.end),
        quote: match.found,
        diffHTML: !match.exact ? match.comparison.diffHTML : void 0,
        diffCaseOnly: !match.exact ? match.exactExceptCase : void 0
      };
    };

    FuzzyAnchoring.prototype.findAnchorWithFuzzyMatching = function(target) {
      var expectedStart, len, match, options, posSelector, quote, quoteSelector, result;
      quoteSelector = this.annotator.findSelector(target.selector, "TextQuoteSelector");
      quote = quoteSelector != null ? quoteSelector.exact : void 0;
      if (quote == null) {
        return null;
      }
      posSelector = this.annotator.findSelector(target.selector, "TextPositionSelector");
      expectedStart = posSelector != null ? posSelector.start : void 0;
      len = this.annotator.domMapper.getDocLength();
      if (expectedStart == null) {
        expectedStart = len / 2;
      }
      options = {
        matchDistance: len * 2,
        withFuzzyComparison: true
      };
      result = this.textFinder.searchFuzzy(quote, expectedStart, false, options);
      if (!result.matches.length) {
        return null;
      }
      match = result.matches[0];
      return {
        type: "text range",
        start: match.start,
        end: match.end,
        startPage: this.annotator.domMapper.getPageIndexForPos(match.start),
        endPage: this.annotator.domMapper.getPageIndexForPos(match.end),
        quote: match.found,
        diffHTML: !match.exact ? match.comparison.diffHTML : void 0,
        diffCaseOnly: !match.exact ? match.exactExceptCase : void 0
      };
    };

    return FuzzyAnchoring;

  })(Annotator.Plugin);

}).call(this);

//
//@ sourceMappingURL=annotator.fuzzyanchoring.map