'use strict';

const debug = require('debug')('egg-router:layer');
const pathToRegExp = require('path-to-regexp');
const uri = require('urijs');
const utility = require('utility');

module.exports = class Layer {
  /**
   * Initialize a new routing Layer with given `method`, `path`, and `middleware`.
   *
   * @param {String|RegExp} path Path string or regular expression.
   * @param {Array} methods Array of HTTP verbs.
   * @param {Array} middleware Layer callback/middleware or series of.
   * @param {Object=} opts optional params
   * @param {String=} opts.name route name
   * @param {String=} opts.sensitive case sensitive (default: false)
   * @param {String=} opts.strict require the trailing slash (default: false)
   * @private
   */
  constructor(path, methods, middleware, opts) {
    this.opts = opts || {};
    this.name = this.opts.name || null;
    this.methods = [];
    this.paramNames = [];
    this.stack = Array.isArray(middleware) ? middleware : [ middleware ];

    methods.forEach(function(method) {
      const l = this.methods.push(method.toUpperCase());
      if (this.methods[l - 1] === 'GET') {
        this.methods.unshift('HEAD');
      }
    }, this);

    // ensure middleware is a function
    this.stack.forEach(function(fn) {
      const type = (typeof fn);
      if (type !== 'function') {
        throw new Error(
          methods.toString() + ' `' + (this.opts.name || path) + '`: `middleware` '
          + 'must be a function, not `' + type + '`'
        );
      }
    }, this);

    this.path = path;
    this.regexp = pathToRegExp(path, this.paramNames, this.opts);

    debug('defined route %s %s', this.methods, this.opts.prefix + this.path);
  }

  /**
   * Returns whether request `path` matches route.
   *
   * @param {String} path path string
   * @return {Boolean} matched or not
   * @private
   */
  match(path) {
    return this.regexp.test(path);
  }

  /**
   * Returns map of URL parameters for given `path` and `paramNames`.
   *
   * @param {String} path path string
   * @param {Array.<String>} captures captures strings
   * @param {Object=} existingParams existing params
   * @return {Object} params object
   * @private
   */
  params(path, captures, existingParams) {
    const params = existingParams || {};

    for (let len = captures.length, i = 0; i < len; i++) {
      if (this.paramNames[i]) {
        const c = captures[i];
        params[this.paramNames[i].name] = c ? utility.decodeURIComponent(c) : c;
      }
    }
    return params;
  }

  /**
   * Returns array of regexp url path captures.
   *
   * @param {String} path path string
   * @return {Array.<String>} captures strings
   * @private
   */
  captures(path) {
    if (this.opts.ignoreCaptures) return [];
    return path.match(this.regexp).slice(1);
  }

  /**
   * Generate URL for route using given `params`.
   *
   * @example
   *
   * ```javascript
   * var route = new Layer(['GET'], '/users/:id', fn);
   *
   * route.url({ id: 123 }); // => "/users/123"
   * ```
   *
   * @param {Object} params url parameters
   * @param {Object} [options] optional parameters
   * @return {String} url string
   * @private
   */
  url(params, options) {
    let args = params;
    const url = this.path.replace(/\(\.\*\)/g, '');
    const toPath = pathToRegExp.compile(url);

    if (typeof params !== 'object') {
      args = Array.prototype.slice.call(arguments);
      if (typeof args[args.length - 1] === 'object') {
        options = args[args.length - 1];
        args = args.slice(0, args.length - 1);
      }
    }

    const tokens = pathToRegExp.parse(url);
    let replace = {};

    if (args instanceof Array) {
      for (let len = tokens.length, i = 0, j = 0; i < len; i++) {
        if (tokens[i].name) replace[tokens[i].name] = args[j++];
      }
    } else if (tokens.some(token => token.name)) {
      replace = params;
    } else {
      options = params;
    }

    let replaced = toPath(replace);

    if (options && options.query) {
      replaced = new uri(replaced);
      replaced.search(options.query);
      return replaced.toString();
    }

    return replaced;
  }

  /**
   * Run validations on route named parameters.
   *
   * @example
   *
   * ```javascript
   * router
   *   .param('user', function (id, ctx, next) {
   *     ctx.user = users[id];
   *     if (!user) return ctx.status = 404;
   *     next();
   *   })
   *   .get('/users/:user', function (ctx, next) {
   *     ctx.body = ctx.user;
   *   });
   * ```
   *
   * @param {String} param param string
   * @param {Function} fn middleware function
   * @return {Layer} layer instance
   * @private
   */
  param(param, fn) {
    const stack = this.stack;
    const params = this.paramNames;
    const middleware = function(ctx, next) {
      return fn.call(this, ctx.params[param], ctx, next);
    };
    middleware.param = param;

    const names = params.map(function(p) {
      return p.name;
    });

    const x = names.indexOf(param);
    if (x > -1) {
      // iterate through the stack, to figure out where to place the handler fn
      stack.some(function(fn, i) {
        // param handlers are always first, so when we find an fn w/o a param property, stop here
        // if the param handler at this part of the stack comes after the one we are adding, stop here
        if (!fn.param || names.indexOf(fn.param) > x) {
          // inject this param handler right before the current item
          stack.splice(i, 0, middleware);
          return true; // then break the loop
        }
        return false;
      });
    }

    return this;
  }

  /**
   * Prefix route path.
   *
   * @param {String} prefix prefix string
   * @return {Layer} layer instance
   * @private
   */
  setPrefix(prefix) {
    if (this.path) {
      this.path = prefix + this.path;
      this.paramNames = [];
      this.regexp = pathToRegExp(this.path, this.paramNames, this.opts);
    }

    return this;
  }
};
