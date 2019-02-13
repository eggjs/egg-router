'use strict';

/**
 * RESTful resource routing middleware for eggjs.
 */

const debug = require('debug')('egg-router');
const compose = require('koa-compose');
const HttpError = require('http-errors');
const methods = require('methods');
const Layer = require('./layer');

/**
 * @module koa-router
 */
class Router {
  /**
   * Create a new router.
   *
   * @example
   *
   * Basic usage:
   *
   * ```javascript
   * var Koa = require('koa');
   * var Router = require('koa-router');
   *
   * var app = new Koa();
   * var router = new Router();
   *
   * router.get('/', (ctx, next) => {
   *   // ctx.router available
   * });
   *
   * app
   *   .use(router.routes())
   *   .use(router.allowedMethods());
   * ```
   *
   * @alias module:koa-router
   * @param {Object=} opts optional
   * @param {String=} opts.prefix prefix router paths
   * @constructor
   */
  constructor(opts) {
    this.opts = opts || {};
    this.methods = this.opts.methods || [
      'HEAD',
      'OPTIONS',
      'GET',
      'PUT',
      'PATCH',
      'POST',
      'DELETE',
    ];

    this.params = {};
    this.stack = [];
  }

  /**
   * Use given middleware.
   *
   * Middleware run in the order they are defined by `.use()`. They are invoked
   * sequentially, requests start at the first middleware and work their way
   * "down" the middleware stack.
   *
   * @example
   *
   * ```javascript
   * // session middleware will run before authorize
   * router
   *   .use(session())
   *   .use(authorize());
   *
   * // use middleware only with given path
   * router.use('/users', userAuth());
   *
   * // or with an array of paths
   * router.use(['/users', '/admin'], userAuth());
   *
   * app.use(router.routes());
   * ```
   *
   * @param {String=} path path string
   * @param {Function} middleware middleware function
   * @return {Router} router instance
   */
  use(/* path, middleware */) {
    const router = this;
    const middleware = Array.prototype.slice.call(arguments);
    let path;

    // support array of paths
    if (Array.isArray(middleware[0]) && typeof middleware[0][0] === 'string') {
      middleware[0].forEach(function(p) {
        router.use.apply(router, [ p ].concat(middleware.slice(1)));
      });

      return this;
    }

    const hasPath = typeof middleware[0] === 'string';
    if (hasPath) {
      path = middleware.shift();
    }

    middleware.forEach(function(m) {
      if (m.router) {
        m.router.stack.forEach(function(nestedLayer) {
          if (path) nestedLayer.setPrefix(path);
          if (router.opts.prefix) nestedLayer.setPrefix(router.opts.prefix);
          router.stack.push(nestedLayer);
        });

        if (router.params) {
          Object.keys(router.params).forEach(function(key) {
            m.router.param(key, router.params[key]);
          });
        }
      } else {
        router.register(path || '(.*)', [], m, { end: false, ignoreCaptures: !hasPath });
      }
    });

    return this;
  }

  /**
   * Set the path prefix for a Router instance that was already initialized.
   *
   * @example
   *
   * ```javascript
   * router.prefix('/things/:thing_id')
   * ```
   *
   * @param {String} prefix prefix string
   * @return {Router} router instance
   */
  prefix(prefix) {
    prefix = prefix.replace(/\/$/, '');

    this.opts.prefix = prefix;

    this.stack.forEach(function(route) {
      route.setPrefix(prefix);
    });

    return this;
  }

  /**
   * Returns router middleware which dispatches a route matching the request.
   *
   * @return {Function} middleware function
   */
  routes() {
    const router = this;

    const dispatch = function dispatch(ctx, next) {
      debug('%s %s', ctx.method, ctx.path);

      const path = router.opts.routerPath || ctx.routerPath || ctx.path;
      const matched = router.match(path, ctx.method);

      if (ctx.matched) {
        ctx.matched.push.apply(ctx.matched, matched.path);
      } else {
        ctx.matched = matched.path;
      }

      ctx.router = router;

      if (!matched.route) return next();

      const matchedLayers = matched.pathAndMethod;
      const mostSpecificLayer = matchedLayers[matchedLayers.length - 1];
      ctx._matchedRoute = mostSpecificLayer.path;
      if (mostSpecificLayer.name) {
        ctx._matchedRouteName = mostSpecificLayer.name;
      }

      const layerChain = matchedLayers.reduce(function(memo, layer) {
        memo.push(function(ctx, next) {
          ctx.captures = layer.captures(path, ctx.captures);
          ctx.params = layer.params(path, ctx.captures, ctx.params);
          ctx.routerName = layer.name;
          ctx.routerPath = layer.path;
          return next();
        });
        return memo.concat(layer.stack);
      }, []);

      return compose(layerChain)(ctx, next);
    };

    dispatch.router = this;

    return dispatch;
  }

  /**
   * Returns separate middleware for responding to `OPTIONS` requests with
   * an `Allow` header containing the allowed methods, as well as responding
   * with `405 Method Not Allowed` and `501 Not Implemented` as appropriate.
   *
   * @example
   *
   * ```javascript
   * var Koa = require('koa');
   * var Router = require('koa-router');
   *
   * var app = new Koa();
   * var router = new Router();
   *
   * app.use(router.routes());
   * app.use(router.allowedMethods());
   * ```
   *
   * **Example with [Boom](https://github.com/hapijs/boom)**
   *
   * ```javascript
   * var Koa = require('koa');
   * var Router = require('koa-router');
   * var Boom = require('boom');
   *
   * var app = new Koa();
   * var router = new Router();
   *
   * app.use(router.routes());
   * app.use(router.allowedMethods({
   *   throw: true,
   *   notImplemented: () => new Boom.notImplemented(),
   *   methodNotAllowed: () => new Boom.methodNotAllowed()
   * }));
   * ```
   *
   * @param {Object=} options optional params
   * @param {Boolean=} options.throw throw error instead of setting status and header
   * @param {Function=} options.notImplemented throw the returned value in place of the default NotImplemented error
   * @param {Function=} options.methodNotAllowed throw the returned value in place of the default MethodNotAllowed error
   * @return {Function} middleware function
   */
  allowedMethods(options) {
    options = options || {};
    const implemented = this.methods;

    return function allowedMethods(ctx, next) {
      return next().then(function() {
        const allowed = {};

        if (!ctx.status || ctx.status === 404) {
          ctx.matched.forEach(function(route) {
            route.methods.forEach(function(method) {
              allowed[method] = method;
            });
          });

          const allowedArr = Object.keys(allowed);

          if (!implemented.includes(ctx.method)) {
            if (options.throw) {
              let notImplementedThrowable;
              if (typeof options.notImplemented === 'function') {
                notImplementedThrowable = options.notImplemented(); // set whatever the user returns from their function
              } else {
                notImplementedThrowable = new HttpError.NotImplemented();
              }
              throw notImplementedThrowable;
            } else {
              ctx.status = 501;
              ctx.set('Allow', allowedArr.join(', '));
            }
          } else if (allowedArr.length) {
            if (ctx.method === 'OPTIONS') {
              ctx.status = 200;
              ctx.body = '';
              ctx.set('Allow', allowedArr.join(', '));
            } else if (!allowed[ctx.method]) {
              if (options.throw) {
                let notAllowedThrowable;
                if (typeof options.methodNotAllowed === 'function') {
                  notAllowedThrowable = options.methodNotAllowed(); // set whatever the user returns from their function
                } else {
                  notAllowedThrowable = new HttpError.MethodNotAllowed();
                }
                throw notAllowedThrowable;
              } else {
                ctx.status = 405;
                ctx.set('Allow', allowedArr.join(', '));
              }
            }
          }
        }
      });
    };
  }

  /**
   * Register route with all methods.
   *
   * @param {String} name Optional.
   * @param {String} path path string
   * @param {Function=} middleware You may also pass multiple middleware.
   * @param {Function} callback callback function
   * @return {Router} router instance
   * @private
   */
  all(name, path/* , middleware */) {
    let middleware;

    if (typeof path === 'string') {
      middleware = Array.prototype.slice.call(arguments, 2);
    } else {
      middleware = Array.prototype.slice.call(arguments, 1);
      path = name;
      name = null;
    }

    this.register(path, methods, middleware, {
      name,
    });

    return this;
  }

  /**
   * Redirect `source` to `destination` URL with optional 30x status `code`.
   *
   * Both `source` and `destination` can be route names.
   *
   * ```javascript
   * router.redirect('/login', 'sign-in');
   * ```
   *
   * This is equivalent to:
   *
   * ```javascript
   * router.all('/login', ctx => {
   *   ctx.redirect('/sign-in');
   *   ctx.status = 301;
   * });
   * ```
   *
   * @param {String} source URL or route name.
   * @param {String} destination URL or route name.
   * @param {Number=} code HTTP status code (default: 301).
   * @return {Router} router instance
   */
  redirect(source, destination, code) {
    // lookup source route by name
    if (source[0] !== '/') {
      source = this.url(source);
    }

    // lookup destination route by name
    if (destination[0] !== '/') {
      destination = this.url(destination);
    }

    return this.all(source, ctx => {
      ctx.redirect(destination);
      ctx.status = code || 301;
    });
  }

  /**
   * Create and register a route.
   *
   * @param {String} path Path string.
   * @param {Array.<String>} methods Array of HTTP verbs.
   * @param {Function} middleware Multiple middleware also accepted.
   * @param {Object} [opts] optional params
   * @return {Layer} layer instance
   * @private
   */
  register(path, methods, middleware, opts) {
    opts = opts || {};

    const router = this;
    const stack = this.stack;

    // support array of paths
    if (Array.isArray(path)) {
      path.forEach(function(p) {
        router.register.call(router, p, methods, middleware, opts);
      });

      return this;
    }

    // create route
    const route = new Layer(path, methods, middleware, {
      end: opts.end === false ? opts.end : true,
      name: opts.name,
      sensitive: opts.sensitive || this.opts.sensitive || false,
      strict: opts.strict || this.opts.strict || false,
      prefix: opts.prefix || this.opts.prefix || '',
      ignoreCaptures: opts.ignoreCaptures,
    });

    if (this.opts.prefix) {
      route.setPrefix(this.opts.prefix);
    }

    // add parameter middleware
    Object.keys(this.params).forEach(function(param) {
      route.param(param, this.params[param]);
    }, this);

    stack.push(route);

    return route;
  }

  /**
   * Lookup route with given `name`.
   *
   * @param {String} name route name
   * @return {Layer|false} layer instance of false
   */
  route(name) {
    const routes = this.stack;

    for (let len = routes.length, i = 0; i < len; i++) {
      if (routes[i].name && routes[i].name === name) {
        return routes[i];
      }
    }

    return false;
  }

  /**
   * Generate URL for route. Takes a route name and map of named `params`.
   *
   * @example
   *
   * ```javascript
   * router.get('user', '/users/:id', (ctx, next) => {
   *   // ...
   * });
   *
   * router.url('user', 3);
   * // => "/users/3"
   *
   * router.url('user', { id: 3 });
   * // => "/users/3"
   *
   * router.use((ctx, next) => {
   *   // redirect to named route
   *   ctx.redirect(ctx.router.url('sign-in'));
   * })
   *
   * router.url('user', { id: 3 }, { query: { limit: 1 } });
   * // => "/users/3?limit=1"
   *
   * router.url('user', { id: 3 }, { query: "limit=1" });
   * // => "/users/3?limit=1"
   * ```
   *
   * @param {String} name route name
   * @param {Object} params url parameters
   * @param {Object} [options] options parameter
   * @param {Object|String} [options.query] query options
   * @return {String|Error} string or error instance
   */
  url(name/* , params */) {
    const route = this.route(name);

    if (route) {
      const args = Array.prototype.slice.call(arguments, 1);
      return route.url.apply(route, args);
    }

    return new Error('No route found for name: ' + name);
  }

  /**
   * Match given `path` and return corresponding routes.
   *
   * @param {String} path path string
   * @param {String} method method name
   * @return {Object.<path, pathAndMethod>} returns layers that matched path and
   * path and method.
   * @private
   */
  match(path, method) {
    const layers = this.stack;
    let layer;
    const matched = {
      // matched path
      path: [],
      // matched path and method(including none method)
      pathAndMethod: [],
      // method matched or not
      route: false,
    };

    for (let len = layers.length, i = 0; i < len; i++) {
      layer = layers[i];

      debug('test %s %s', layer.path, layer.regexp);

      if (layer.match(path)) {
        matched.path.push(layer);

        if (layer.methods.length === 0 || layer.methods.includes(method)) {
          matched.pathAndMethod.push(layer);
          if (layer.methods.length) matched.route = true;
        }
        // if (layer.methods.length === 0) {
        //   matched.pathAndMethod.push(layer);
        // } else if (layer.methods.includes(method)) {
        //   matched.pathAndMethod.push(layer);
        //   matched.route = true;
        // }
      }
    }

    return matched;
  }

  /**
   * Run middleware for named route parameters. Useful for auto-loading or
   * validation.
   *
   * @example
   *
   * ```javascript
   * router
   *   .param('user', (id, ctx, next) => {
   *     ctx.user = users[id];
   *     if (!ctx.user) return ctx.status = 404;
   *     return next();
   *   })
   *   .get('/users/:user', ctx => {
   *     ctx.body = ctx.user;
   *   })
   *   .get('/users/:user/friends', ctx => {
   *     return ctx.user.getFriends().then(function(friends) {
   *       ctx.body = friends;
   *     });
   *   })
   *   // /users/3 => {"id": 3, "name": "Alex"}
   *   // /users/3/friends => [{"id": 4, "name": "TJ"}]
   * ```
   *
   * @param {String} param param
   * @param {Function} middleware route middleware
   * @return {Router} instance
   */
  param(param, middleware) {
    this.params[param] = middleware;
    this.stack.forEach(function(route) {
      route.param(param, middleware);
    });
    return this;
  }
}

/**
 * Create `router.verb()` methods, where *verb* is one of the HTTP verbs such
 * as `router.get()` or `router.post()`.
 *
 * Match URL patterns to callback functions or controller actions using `router.verb()`,
 * where **verb** is one of the HTTP verbs such as `router.get()` or `router.post()`.
 *
 * Additionaly, `router.all()` can be used to match against all methods.
 *
 * ```javascript
 * router
 *   .get('/', (ctx, next) => {
 *     ctx.body = 'Hello World!';
 *   })
 *   .post('/users', (ctx, next) => {
 *     // ...
 *   })
 *   .put('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .del('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .all('/users/:id', (ctx, next) => {
 *     // ...
 *   });
 * ```
 *
 * When a route is matched, its path is available at `ctx._matchedRoute` and if named,
 * the name is available at `ctx._matchedRouteName`
 *
 * Route paths will be translated to regular expressions using
 * [path-to-regexp](https://github.com/pillarjs/path-to-regexp).
 *
 * Query strings will not be considered when matching requests.
 *
 * #### Named routes
 *
 * Routes can optionally have names. This allows generation of URLs and easy
 * renaming of URLs during development.
 *
 * ```javascript
 * router.get('user', '/users/:id', (ctx, next) => {
 *  // ...
 * });
 *
 * router.url('user', 3);
 * // => "/users/3"
 * ```
 *
 * #### Multiple middleware
 *
 * Multiple middleware may be given:
 *
 * ```javascript
 * router.get(
 *   '/users/:id',
 *   (ctx, next) => {
 *     return User.findOne(ctx.params.id).then(function(user) {
 *       ctx.user = user;
 *       next();
 *     });
 *   },
 *   ctx => {
 *     console.log(ctx.user);
 *     // => { id: 17, name: "Alex" }
 *   }
 * );
 * ```
 *
 * ### Nested routers
 *
 * Nesting routers is supported:
 *
 * ```javascript
 * var forums = new Router();
 * var posts = new Router();
 *
 * posts.get('/', (ctx, next) => {...});
 * posts.get('/:pid', (ctx, next) => {...});
 * forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods());
 *
 * // responds to "/forums/123/posts" and "/forums/123/posts/123"
 * app.use(forums.routes());
 * ```
 *
 * #### Router prefixes
 *
 * Route paths can be prefixed at the router level:
 *
 * ```javascript
 * var router = new Router({
 *   prefix: '/users'
 * });
 *
 * router.get('/', ...); // responds to "/users"
 * router.get('/:id', ...); // responds to "/users/:id"
 * ```
 *
 * #### URL parameters
 *
 * Named route parameters are captured and added to `ctx.params`.
 *
 * ```javascript
 * router.get('/:category/:title', (ctx, next) => {
 *   console.log(ctx.params);
 *   // => { category: 'programming', title: 'how-to-node' }
 * });
 * ```
 *
 * The [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module is
 * used to convert paths to regular expressions.
 *
 * @name get|put|post|patch|delete|del
 * @memberof module:koa-router.prototype
 * @param {String} path
 * @param {Function=} middleware route middleware(s)
 * @param {Function} callback route callback
 * @returns {Router}
 */

methods.forEach(function(method) {
  Router.prototype[method] = function(name, path /* , middleware */) {
    let middleware;

    if (typeof path === 'string' || path instanceof RegExp) {
      middleware = Array.prototype.slice.call(arguments, 2);
    } else {
      middleware = Array.prototype.slice.call(arguments, 1);
      path = name;
      name = null;
    }

    this.register(path, [ method ], middleware, {
      name,
    });

    return this;
  };
});

// Alias for `router.delete()` because delete is a reserved word
Router.prototype.del = Router.prototype.delete;

/**
 * Generate URL from url pattern and given `params`.
 *
 * @example
 *
 * ```javascript
 * var url = Router.url('/users/:id', {id: 1});
 * // => "/users/1"
 * ```
 *
 * @param {String} path url pattern
 * @param {Object} params url parameters
 * @return {String} url string
 */
Router.url = function(path/* , params */) {
  const args = Array.prototype.slice.call(arguments, 1);
  return Layer.prototype.url.apply({ path }, args);
};

Router.prototype.middleware = Router.prototype.routes;

module.exports = Router;
