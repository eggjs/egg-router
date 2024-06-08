import { debuglog } from 'node:util';
import pathToRegExp, { type Key } from 'path-to-regexp';
import URI from 'urijs';
import { decodeURIComponent as safeDecodeURIComponent } from 'utility';
import type {
  MiddlewareFunc,
  MiddlewareFuncWithParamProperty,
  ParamMiddlewareFunc,
} from './types.js';

const debug = debuglog('egg-router:layer');

export interface LayerOptions {
  prefix?: string;
  /** route name */
  name?: string;
  /** case sensitive (default: false) */
  sensitive?: boolean;
  /** require the trailing slash (default: false) */
  strict?: boolean;
  ignoreCaptures?: boolean;
}

export interface LayerURLOptions {
  query?: string | object;
}

export class Layer {
  readonly opts: LayerOptions;
  readonly name?: string;
  readonly methods: string[] = [];
  readonly stack: MiddlewareFuncWithParamProperty[];
  path: string;
  regexp: RegExp;
  paramNames: Key[] = [];

  /**
   * Initialize a new routing Layer with given `method`, `path`, and `middleware`.
   *
   * @param {String|RegExp} path Path string or regular expression.
   * @param {Array} methods Array of HTTP verbs.
   * @param {Array|Function} middlewares Layer callback/middleware or series of.
   * @param {Object=} opts optional params
   * @param {String=} opts.name route name
   * @param {String=} opts.sensitive case sensitive (default: false)
   * @param {String=} opts.strict require the trailing slash (default: false)
   * @private
   */
  constructor(path: string | RegExp, methods: string[], middlewares: MiddlewareFunc | MiddlewareFunc[], opts?: LayerOptions) {
    this.opts = opts ?? {};
    this.opts.prefix = this.opts.prefix ?? '';
    this.name = this.opts.name;
    this.stack = Array.isArray(middlewares) ? middlewares : [ middlewares ];

    for (const method of methods) {
      const l = this.methods.push(method.toUpperCase());
      if (this.methods[l - 1] === 'GET') {
        this.methods.unshift('HEAD');
      }
    }

    // ensure middleware is a function
    this.stack.forEach(fn => {
      const type = (typeof fn);
      if (type !== 'function') {
        throw new TypeError(
          methods.toString() + ' `' + (this.opts.name || path) + '`: `middleware` '
          + 'must be a function, not `' + type + '`',
        );
      }
    });

    this.path = typeof path === 'string' ? path : String(path);
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
  match(path: string): boolean {
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
  params(path: string, captures: Array<string>, existingParams?: Record<string, any>): object {
    const params = existingParams || {};

    for (let len = captures.length, i = 0; i < len; i++) {
      const paramName = this.paramNames[i];
      if (paramName) {
        const c = captures[i];
        params[paramName.name] = c ? safeDecodeURIComponent(c) : c;
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
  captures(path: string): Array<string> {
    if (this.opts.ignoreCaptures) return [];
    const m = path.match(this.regexp);
    return m ? m.slice(1) : [];
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
  url(params: object, options?: LayerURLOptions): string {
    let args: Array<string | number> | object = params;
    const url = this.path.replace(/\(\.\*\)/g, '');
    const toPath = pathToRegExp.compile(url);

    if (typeof params !== 'object') {
      // route.url(123, 456, options);
      args = Array.prototype.slice.call(arguments);
      if (Array.isArray(args)) {
        if (typeof args[args.length - 1] === 'object') {
          options = args[args.length - 1];
          args = args.slice(0, args.length - 1);
        }
      }
    }

    const tokens = pathToRegExp.parse(url);
    let replace: Record<string, any> = {};

    if (Array.isArray(args)) {
      for (let len = tokens.length, i = 0, j = 0; i < len; i++) {
        const token = tokens[i];
        if (typeof token === 'object' && token.name) {
          replace[token.name] = args[j++];
        }
      }
    } else if (tokens.some(token => typeof token === 'object' && token.name)) {
      replace = params;
    } else {
      options = params;
    }

    const replaced = toPath(replace);

    if (options?.query) {
      const urlObject = new URI(replaced);
      urlObject.search(options.query);
      return urlObject.toString();
    }

    return replaced;
  }

  #urlWithArgs(args: any[], options?: object) {

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
  param(param: string, fn: ParamMiddlewareFunc): Layer {
    const stack = this.stack;
    const params = this.paramNames;
    const middleware: MiddlewareFuncWithParamProperty = function(this: any, ctx, next) {
      return fn.call(this, ctx.params[param], ctx, next);
    };
    middleware.param = param;

    const names = params.map(p => {
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
  setPrefix(prefix: string): Layer {
    if (this.path) {
      this.path = prefix + this.path;
      this.paramNames = [];
      this.regexp = pathToRegExp(this.path, this.paramNames, this.opts);
    }
    return this;
  }
}
