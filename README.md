# @eggjs/router

[![NPM version](https://img.shields.io/npm/v/@eggjs/router.svg?style=flat-square)](https://npmjs.org/package/@eggjs/router)
[![NPM download](https://img.shields.io/npm/dm/@eggjs/router.svg?style=flat-square)](https://npmjs.org/package/@eggjs/router)
[![Node.js CI](https://github.com/eggjs/egg-router/actions/workflows/nodejs.yml/badge.svg?branch=master)](https://github.com/eggjs/egg-router/actions/workflows/nodejs.yml)
[![Test coverage](https://img.shields.io/codecov/c/github/eggjs/egg-router.svg?style=flat-square)](https://codecov.io/gh/eggjs/egg-router)
[![Known Vulnerabilities](https://snyk.io/test/npm/@eggjs/router/badge.svg?style=flat-square)](https://snyk.io/test/npm/@eggjs/router)

Router core component for [Egg.js](https://github.com/eggjs).

> **This repository is a fork of [koa-router](https://github.com/alexmingoia/koa-router).** with some additional features.
> And thanks for the great work of @alexmingoia and the original team.

## API Reference

- [@eggjs/router](#eggjsrouter)
  - [API Reference](#api-reference)
    - [Router ⏏](#router-)
      - [new Router(\[opts\])](#new-routeropts)
      - [router.get|put|post|patch|delete|del ⇒ Router](#routergetputpostpatchdeletedel--router)
      - [Named routes](#named-routes)
      - [Multiple middleware](#multiple-middleware)
    - [Nested routers](#nested-routers)
      - [Router prefixes](#router-prefixes)
      - [URL parameters](#url-parameters)
      - [router.routes ⇒ function](#routerroutes--function)
      - [router.use(\[path\], middleware) ⇒ Router](#routerusepath-middleware--router)
      - [router.prefix(prefix) ⇒ Router](#routerprefixprefix--router)
      - [router.allowedMethods(\[options\]) ⇒ function](#routerallowedmethodsoptions--function)
      - [router.redirect(source, destination, \[code\]) ⇒ Router](#routerredirectsource-destination-code--router)
      - [router.route(name) ⇒ Layer | false](#routerroutename--layer--false)
      - [router.url(name, params, \[options\]) ⇒ String | Error](#routerurlname-params-options--string--error)
      - [router.param(param, middleware) ⇒ Router](#routerparamparam-middleware--router)
      - [Router.url(path, params \[, options\]) ⇒ String](#routerurlpath-params--options--string)
  - [Tests](#tests)
  - [Breaking changes on v3](#breaking-changes-on-v3)
  - [License](#license)
  - [Contributors](#contributors)

<a name="exp_module_egg-router--Router"></a>

### Router ⏏

**Kind**: Exported class
<a name="new_module_egg-router--Router_new"></a>

#### new Router([opts])

Create a new router.

| Param | Type | Description |
| ---   | ---   | --- |
| [opts] | <code>Object</code> |  |
| [opts.prefix] | <code>String</code> | prefix router paths |

**Example**
Basic usage:

```ts
import Koa from '@eggjs/koa';
import Router from '@eggjs/router';

const app = new Koa();
const router = new Router();

router.get('/', async (ctx, next) => {
  // ctx.router available
});

app
  .use(router.routes())
  .use(router.allowedMethods());
```

<a name="module_egg-router--Router+get|put|post|patch|delete|del"></a>

#### router.get|put|post|patch|delete|del ⇒ <code>Router</code>

Create `router.verb()` methods, where *verb* is one of the HTTP verbs such
as `router.get()` or `router.post()`.

Match URL patterns to callback functions or controller actions using `router.verb()`,
where **verb** is one of the HTTP verbs such as `router.get()` or `router.post()`.

Additionaly, `router.all()` can be used to match against all methods.

```ts
router
  .get('/', (ctx, next) => {
    ctx.body = 'Hello World!';
  })
  .post('/users', (ctx, next) => {
    // ...
  })
  .put('/users/:id', (ctx, next) => {
    // ...
  })
  .del('/users/:id', (ctx, next) => {
    // ...
  })
  .all('/users/:id', (ctx, next) => {
    // ...
  });
```

When a route is matched, its path is available at `ctx.routePath` and if named,
the name is available at `ctx.routeName`

Route paths will be translated to regular expressions using
[path-to-regexp](https://github.com/pillarjs/path-to-regexp).

Query strings will not be considered when matching requests.

#### Named routes

Routes can optionally have names. This allows generation of URLs and easy
renaming of URLs during development.

```ts
router.get('user', '/users/:id', (ctx, next) => {
 // ...
});

router.url('user', 3);
// => "/users/3"
```

#### Multiple middleware

Multiple middleware may be given:

```ts
router.get(
  '/users/:id',
  (ctx, next) => {
    return User.findOne(ctx.params.id).then(function(user) {
      ctx.user = user;
      next();
    });
  },
  ctx => {
    console.log(ctx.user);
    // => { id: 17, name: "Alex" }
  }
);
```

### Nested routers

Nesting routers is supported:

```ts
const forums = new Router();
const posts = new Router();

posts.get('/', (ctx, next) => {...});
posts.get('/:pid', (ctx, next) => {...});
forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods());

// responds to "/forums/123/posts" and "/forums/123/posts/123"
app.use(forums.routes());
```

#### Router prefixes

Route paths can be prefixed at the router level:

```ts
const router = new Router({
  prefix: '/users'
});

router.get('/', ...); // responds to "/users"
router.get('/:id', ...); // responds to "/users/:id"
```

#### URL parameters

Named route parameters are captured and added to `ctx.params`.

```ts
router.get('/:category/:title', (ctx, next) => {
  console.log(ctx.params);
  // => { category: 'programming', title: 'how-to-node' }
});
```

The [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module is
used to convert paths to regular expressions.

**Kind**: instance property of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type | Description |
| ---   | ---  | --- |
| path | <code>String</code> |  |
| [middleware] | <code>function</code> | route middleware(s) |
| callback | <code>function</code> | route callback |

<a name="module_egg-router--Router+routes"></a>

#### router.routes ⇒ <code>function</code>
Returns router middleware which dispatches a route matching the request.

**Kind**: instance property of <code>[Router](#exp_module_egg-router--Router)</code>
<a name="module_egg-router--Router+use"></a>

#### router.use([path], middleware) ⇒ <code>Router</code>

Use given middleware.

Middleware run in the order they are defined by `.use()`. They are invoked
sequentially, requests start at the first middleware and work their way
"down" the middleware stack.

**Kind**: instance method of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type |
| --- | --- |
| [path] | <code>String</code> |
| middleware | <code>function</code> |
| [...] | <code>function</code> |

**Example**

```ts
// session middleware will run before authorize
router
  .use(session())
  .use(authorize());

// use middleware only with given path
router.use('/users', userAuth());

// or with an array of paths
router.use(['/users', '/admin'], userAuth());

app.use(router.routes());
```

<a name="module_egg-router--Router+prefix"></a>

#### router.prefix(prefix) ⇒ <code>Router</code>

Set the path prefix for a Router instance that was already initialized.

**Kind**: instance method of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type |
| --- | --- |
| prefix | <code>String</code> |

**Example**

```ts
router.prefix('/things/:thing_id')
```

<a name="module_egg-router--Router+allowedMethods"></a>

#### router.allowedMethods([options]) ⇒ <code>function</code>

Returns separate middleware for responding to `OPTIONS` requests with
an `Allow` header containing the allowed methods, as well as responding
with `405 Method Not Allowed` and `501 Not Implemented` as appropriate.

**Kind**: instance method of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> |  |
| [options.throw] | <code>Boolean</code> | throw error instead of setting status and header |
| [options.notImplemented] | <code>function</code> | throw the returned value in place of the default NotImplemented error |
| [options.methodNotAllowed] | <code>function</code> | throw the returned value in place of the default MethodNotAllowed error |

**Example**

```ts
import Koa from '@eggjs/koa';
import Router from '@eggjs/router';

const app = new Koa();
const router = new Router();

app.use(router.routes());
app.use(router.allowedMethods());
```

**Example with [Boom](https://github.com/hapijs/boom)**

```ts
import Koa from '@eggjs/koa';
import Router from '@eggjs/router';
import Boom from 'boom';

const app = new Koa();
const router = new Router();

app.use(router.routes());
app.use(router.allowedMethods({
  throw: true,
  notImplemented: () => new Boom.notImplemented(),
  methodNotAllowed: () => new Boom.methodNotAllowed()
}));
```

<a name="module_egg-router--Router+redirect"></a>

#### router.redirect(source, destination, [code]) ⇒ <code>Router</code>

Redirect `source` to `destination` URL with optional 30x status `code`.

Both `source` and `destination` can be route names.

```javascript
router.redirect('/login', 'sign-in');
```

This is equivalent to:

```ts
router.all('/login', ctx => {
  ctx.redirect('/sign-in');
  ctx.status = 301;
});
```

**Kind**: instance method of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type | Description |
| --- | --- | --- |
| source | <code>String</code> | URL or route name. |
| destination | <code>String</code> | URL or route name. |
| [code] | <code>Number</code> | HTTP status code (default: 301). |

<a name="module_egg-router--Router+route"></a>

#### router.route(name) ⇒ <code>Layer</code> &#124; <code>false</code>

Lookup route with given `name`.

**Kind**: instance method of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type |
| --- | --- |
| name | <code>String</code> |

<a name="module_egg-router--Router+url"></a>

#### router.url(name, params, [options]) ⇒ <code>String</code> &#124; <code>Error</code>

Generate URL for route. Takes a route name and map of named `params`.

**Kind**: instance method of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | route name |
| params | <code>Object</code> | url parameters |
| [options] | <code>Object</code> | options parameter |
| [options.query] | <code>Object</code> &#124; <code>String</code> | query options |

**Example**

```ts
router.get('user', '/users/:id', (ctx, next) => {
  // ...
});

router.url('user', 3);
// => "/users/3"

router.url('user', { id: 3 });
// => "/users/3"

router.use((ctx, next) => {
  // redirect to named route
  ctx.redirect(ctx.router.url('sign-in'));
})

router.url('user', { id: 3 }, { query: { limit: 1 } });
// => "/users/3?limit=1"

router.url('user', { id: 3 }, { query: "limit=1" });
// => "/users/3?limit=1"
```

<a name="module_egg-router--Router+param"></a>

#### router.param(param, middleware) ⇒ <code>Router</code>

Run middleware for named route parameters. Useful for auto-loading or
validation.

**Kind**: instance method of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type |
| --- | --- |
| param | <code>String</code> |
| middleware | <code>function</code> |

**Example**

```ts
router
  .param('user', (id, ctx, next) => {
    ctx.user = users[id];
    if (!ctx.user) return ctx.status = 404;
    return next();
  })
  .get('/users/:user', ctx => {
    ctx.body = ctx.user;
  })
  .get('/users/:user/friends', ctx => {
    return ctx.user.getFriends().then(function(friends) {
      ctx.body = friends;
    });
  })
  // /users/3 => {"id": 3, "name": "Alex"}
  // /users/3/friends => [{"id": 4, "name": "TJ"}]
```

<a name="module_egg-router--Router.url"></a>

#### Router.url(path, params [, options]) ⇒ <code>String</code>

Generate URL from url pattern and given `params`.

**Kind**: static method of <code>[Router](#exp_module_egg-router--Router)</code>

| Param | Type | Description |
| --- | --- | --- |
| path | <code>String</code> | url pattern |
| params | <code>Object</code> | url parameters |
| [options] | <code>Object</code> | options parameter |
| [options.query] | <code>Object</code> &#124; <code>String</code> | query options |

**Example**

```ts
const url = Router.url('/users/:id', {id: 1});
// => "/users/1"

const url = Router.url('/users/:id', {id: 1}, {query: { active: true }});
// => "/users/1?active=true"
```

## Tests

Run tests using `npm test`.

## Breaking changes on v3

- Drop generator function support
- Drop Node.js < 18.19.0 support

## License

[MIT](LICENSE)

<!-- GITCONTRIBUTOR_START -->

## Contributors

|[<img src="https://avatars.githubusercontent.com/u/1112718?v=4" width="100px;"/><br/><sub><b>alexmingoia</b></sub>](https://github.com/alexmingoia)<br/>|[<img src="https://avatars.githubusercontent.com/u/1413330?v=4" width="100px;"/><br/><sub><b>jbielick</b></sub>](https://github.com/jbielick)<br/>|[<img src="https://avatars.githubusercontent.com/u/985607?v=4" width="100px;"/><br/><sub><b>dead-horse</b></sub>](https://github.com/dead-horse)<br/>|[<img src="https://avatars.githubusercontent.com/u/156269?v=4" width="100px;"/><br/><sub><b>fengmk2</b></sub>](https://github.com/fengmk2)<br/>|[<img src="https://avatars.githubusercontent.com/u/1024246?v=4" width="100px;"/><br/><sub><b>wachunei</b></sub>](https://github.com/wachunei)<br/>|[<img src="https://avatars.githubusercontent.com/u/160197?v=4" width="100px;"/><br/><sub><b>dominicbarnes</b></sub>](https://github.com/dominicbarnes)<br/>|
| :---: | :---: | :---: | :---: | :---: | :---: |
|[<img src="https://avatars.githubusercontent.com/u/25254?v=4" width="100px;"/><br/><sub><b>tj</b></sub>](https://github.com/tj)<br/>|[<img src="https://avatars.githubusercontent.com/u/166834?v=4" width="100px;"/><br/><sub><b>aheckmann</b></sub>](https://github.com/aheckmann)<br/>|[<img src="https://avatars.githubusercontent.com/u/385716?v=4" width="100px;"/><br/><sub><b>kilianc</b></sub>](https://github.com/kilianc)<br/>|[<img src="https://avatars.githubusercontent.com/u/98955?v=4" width="100px;"/><br/><sub><b>secretfader</b></sub>](https://github.com/secretfader)<br/>|[<img src="https://avatars.githubusercontent.com/u/474587?v=4" width="100px;"/><br/><sub><b>ilkkao</b></sub>](https://github.com/ilkkao)<br/>|[<img src="https://avatars.githubusercontent.com/u/6873217?v=4" width="100px;"/><br/><sub><b>HeavenDuke</b></sub>](https://github.com/HeavenDuke)<br/>|
|[<img src="https://avatars.githubusercontent.com/u/2842176?v=4" width="100px;"/><br/><sub><b>XadillaX</b></sub>](https://github.com/XadillaX)<br/>|[<img src="https://avatars.githubusercontent.com/u/200876?v=4" width="100px;"/><br/><sub><b>yiminghe</b></sub>](https://github.com/yiminghe)<br/>|[<img src="https://avatars.githubusercontent.com/u/32174276?v=4" width="100px;"/><br/><sub><b>semantic-release-bot</b></sub>](https://github.com/semantic-release-bot)<br/>|[<img src="https://avatars.githubusercontent.com/u/6794386?v=4" width="100px;"/><br/><sub><b>vkhv</b></sub>](https://github.com/vkhv)<br/>|[<img src="https://avatars.githubusercontent.com/u/7627362?v=4" width="100px;"/><br/><sub><b>vikramdurai</b></sub>](https://github.com/vikramdurai)<br/>|[<img src="https://avatars.githubusercontent.com/u/9271565?v=4" width="100px;"/><br/><sub><b>Tankenstein</b></sub>](https://github.com/Tankenstein)<br/>|
|[<img src="https://avatars.githubusercontent.com/u/2822996?v=4" width="100px;"/><br/><sub><b>richardprior</b></sub>](https://github.com/richardprior)<br/>|[<img src="https://avatars.githubusercontent.com/u/1635441?v=4" width="100px;"/><br/><sub><b>joesonw</b></sub>](https://github.com/joesonw)<br/>|[<img src="https://avatars.githubusercontent.com/u/875091?v=4" width="100px;"/><br/><sub><b>ifroz</b></sub>](https://github.com/ifroz)<br/>|[<img src="https://avatars.githubusercontent.com/u/13130706?v=4" width="100px;"/><br/><sub><b>jeynish</b></sub>](https://github.com/jeynish)<br/>|[<img src="https://avatars.githubusercontent.com/u/72027?v=4" width="100px;"/><br/><sub><b>jergason</b></sub>](https://github.com/jergason)<br/>|[<img src="https://avatars.githubusercontent.com/u/227713?v=4" width="100px;"/><br/><sub><b>atian25</b></sub>](https://github.com/atian25)<br/>|
|[<img src="https://avatars.githubusercontent.com/u/130963?v=4" width="100px;"/><br/><sub><b>lagden</b></sub>](https://github.com/lagden)<br/>|[<img src="https://avatars.githubusercontent.com/u/484559?v=4" width="100px;"/><br/><sub><b>fixe</b></sub>](https://github.com/fixe)<br/>|[<img src="https://avatars.githubusercontent.com/u/2671328?v=4" width="100px;"/><br/><sub><b>viliam-jobko</b></sub>](https://github.com/viliam-jobko)<br/>|[<img src="https://avatars.githubusercontent.com/u/2971112?v=4" width="100px;"/><br/><sub><b>mzyy94</b></sub>](https://github.com/mzyy94)<br/>|[<img src="https://avatars.githubusercontent.com/u/687842?v=4" width="100px;"/><br/><sub><b>jeromew</b></sub>](https://github.com/jeromew)<br/>|[<img src="https://avatars.githubusercontent.com/u/6897780?v=4" width="100px;"/><br/><sub><b>killagu</b></sub>](https://github.com/killagu)<br/>|
|[<img src="https://avatars.githubusercontent.com/u/8069753?v=4" width="100px;"/><br/><sub><b>RobertHerhold</b></sub>](https://github.com/RobertHerhold)<br/>|[<img src="https://avatars.githubusercontent.com/u/4619802?v=4" width="100px;"/><br/><sub><b>yudppp</b></sub>](https://github.com/yudppp)<br/>|[<img src="https://avatars.githubusercontent.com/u/3173170?v=4" width="100px;"/><br/><sub><b>thedark1337</b></sub>](https://github.com/thedark1337)<br/>|[<img src="https://avatars.githubusercontent.com/u/6903313?v=4" width="100px;"/><br/><sub><b>x-cold</b></sub>](https://github.com/x-cold)<br/>|[<img src="https://avatars.githubusercontent.com/u/6713367?v=4" width="100px;"/><br/><sub><b>zzuieliyaoli</b></sub>](https://github.com/zzuieliyaoli)<br/>|[<img src="https://avatars.githubusercontent.com/u/81891?v=4" width="100px;"/><br/><sub><b>ryankask</b></sub>](https://github.com/ryankask)<br/>|
|[<img src="https://avatars.githubusercontent.com/u/4810916?v=4" width="100px;"/><br/><sub><b>pschwyter</b></sub>](https://github.com/pschwyter)<br/>|[<img src="https://avatars.githubusercontent.com/u/62940?v=4" width="100px;"/><br/><sub><b>mikefrey</b></sub>](https://github.com/mikefrey)<br/>|[<img src="https://avatars.githubusercontent.com/u/300104?v=4" width="100px;"/><br/><sub><b>dizlexik</b></sub>](https://github.com/dizlexik)<br/>|[<img src="https://avatars.githubusercontent.com/u/2505474?v=4" width="100px;"/><br/><sub><b>jeffijoe</b></sub>](https://github.com/jeffijoe)<br/>|[<img src="https://avatars.githubusercontent.com/u/349336?v=4" width="100px;"/><br/><sub><b>iliakan</b></sub>](https://github.com/iliakan)<br/>|[<img src="https://avatars.githubusercontent.com/u/615334?v=4" width="100px;"/><br/><sub><b>frederickfogerty</b></sub>](https://github.com/frederickfogerty)<br/>|
[<img src="https://avatars.githubusercontent.com/u/2552790?v=4" width="100px;"/><br/><sub><b>t3chnoboy</b></sub>](https://github.com/t3chnoboy)<br/>|[<img src="https://avatars.githubusercontent.com/u/1484279?v=4" width="100px;"/><br/><sub><b>bitinn</b></sub>](https://github.com/bitinn)<br/>|[<img src="https://avatars.githubusercontent.com/u/1441230?v=4" width="100px;"/><br/><sub><b>drGrove</b></sub>](https://github.com/drGrove)<br/>|[<img src="https://avatars.githubusercontent.com/u/12624092?v=4" width="100px;"/><br/><sub><b>CreativeCactus</b></sub>](https://github.com/CreativeCactus)<br/>|[<img src="https://avatars.githubusercontent.com/u/1773785?v=4" width="100px;"/><br/><sub><b>bguiz</b></sub>](https://github.com/bguiz)<br/>

This project follows the git-contributor [spec](https://github.com/xudafeng/git-contributor), auto updated at `Sun Jun 16 2024 12:28:11 GMT+0800`.

<!-- GITCONTRIBUTOR_END -->
