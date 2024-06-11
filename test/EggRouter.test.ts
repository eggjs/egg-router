import { strict as assert } from 'node:assert';
import is from 'is-type-of';
import { EggRouter } from '../src/index.js';

describe('test/EggRouter.test.ts', () => {
  it('creates new router with egg app', () => {
    const app = { controller: {} };
    const router = new EggRouter({}, app);
    assert(router);
    [ 'head', 'options', 'get', 'put', 'patch', 'post', 'delete', 'all', 'resources' ].forEach(method => {
      assert.equal(typeof Reflect.get(router, method), 'function');
    });
  });

  it('should throw error on generator function', () => {
    const app = {
      controller: {
        async foo() { return; },
        hello: {
          * world() { return; },
        },
      },
    };

    const router = new EggRouter({}, app);
    router.get('/foo', app.controller.foo);
    assert.throws(() => {
      router.post('/hello/world', app.controller.hello.world as any);
    }, (err: TypeError) => {
      assert(err instanceof TypeError);
      assert.equal(err.message, 'post `/hello/world`: Please use async function instead of generator function');
      return true;
    });
  });

  it('should app.verb(url, controller) work', () => {
    const app = {
      controller: {
        async foo() { return; },
        hello: {
          world() { return; },
        },
      },
    };

    const router = new EggRouter({}, app);
    router.get('/foo', app.controller.foo);
    router.post('/hello/world', app.controller.hello.world);

    assert(router.stack[0].path === '/foo');
    assert.deepEqual(router.stack[0].methods, [ 'HEAD', 'GET' ]);
    assert(router.stack[0].stack.length === 1);
    assert(router.stack[1].path === '/hello/world');
    assert.deepEqual(router.stack[1].methods, [ 'POST' ]);
    assert(router.stack[1].stack.length === 1);
  });

  it('should app.verb(name, url, controller) work', () => {
    const app = {
      controller: {
        async foo() { return; },
        hello: {
          world() { return; },
        },
      },
    };

    const router = new EggRouter({}, app);
    router.get('foo', '/foo', app.controller.foo);
    router.post('hello', '/hello/world', app.controller.hello.world);

    assert(router.stack[0].name === 'foo');
    assert(router.stack[0].path === '/foo');
    assert.deepEqual(router.stack[0].methods, [ 'HEAD', 'GET' ]);
    assert(router.stack[0].stack.length === 1);
    assert(router.stack[1].name === 'hello');
    assert(router.stack[1].path === '/hello/world');
    assert.deepEqual(router.stack[1].methods, [ 'POST' ]);
    assert(router.stack[1].stack.length === 1);
  });

  it('should app.verb(name, url, controllerString) work', () => {
    const app = {
      controller: {
        async foo() { return; },
        hello: {
          world() { return; },
        },
      },
    };

    const router = new EggRouter({}, app);
    router.get('foo', '/foo', 'foo');
    router.post('hello', '/hello/world', 'hello.world');

    assert(router.stack[0].name === 'foo');
    assert(router.stack[0].path === '/foo');
    assert.deepEqual(router.stack[0].methods, [ 'HEAD', 'GET' ]);
    assert(router.stack[0].stack.length === 1);
    assert(router.stack[1].name === 'hello');
    assert(router.stack[1].path === '/hello/world');
    assert.deepEqual(router.stack[1].methods, [ 'POST' ]);
    assert(router.stack[1].stack.length === 1);
  });

  it('should app.verb() throw if not found controller', () => {
    const app = {
      controller: {
        async foo() { return; },
        hello: {
          world() { return; },
        },
      },
    };

    const router = new EggRouter({}, app);
    assert.throws(() => {
      router.get('foo', '/foo', 'foobar');
    }, /app.controller.foobar not exists/);

    assert.throws(() => {
      router.get('/foo', (app as any).bar);
    }, /controller not exists/);
  });

  it('should app.verb(name, url, [middlewares], controllerString) work', () => {
    const app = {
      controller: {
        async foo() { return; },
        hello: {
          world() { return; },
        },
      },
    };

    const asyncMiddleware1 = async function() { return; };
    const asyncMiddleware = async function() { return; };
    const commonMiddleware = function() {};

    const router = new EggRouter({}, app);
    router.get('foo', '/foo', asyncMiddleware1, asyncMiddleware, commonMiddleware, 'foo');
    router.post('hello', '/hello/world', asyncMiddleware1, asyncMiddleware, commonMiddleware, 'hello.world');
    router.get('foo', '/foo', asyncMiddleware1, asyncMiddleware, commonMiddleware, 'foo');
    router.post('hello', '/hello/world', asyncMiddleware1, asyncMiddleware, commonMiddleware, 'hello.world');

    assert(router.stack[0].name === 'foo');
    assert(router.stack[0].path === '/foo');
    assert.deepEqual(router.stack[0].methods, [ 'HEAD', 'GET' ]);
    assert(router.stack[0].stack.length === 4);
    assert(!is.generatorFunction(router.stack[0].stack[0]));
    assert(is.asyncFunction(router.stack[0].stack[1]));
    assert(!is.generatorFunction(router.stack[0].stack[3]));
    assert(router.stack[1].name === 'hello');
    assert(router.stack[1].path === '/hello/world');
    assert.deepEqual(router.stack[1].methods, [ 'POST' ]);
    assert(router.stack[1].stack.length === 4);
    assert(!is.generatorFunction(router.stack[1].stack[0]));
    assert(is.asyncFunction(router.stack[1].stack[1]));
    assert(!is.generatorFunction(router.stack[1].stack[3]));
  });

  it('should app.resource() work', () => {
    const app = {
      controller: {
        post: {
          async index() { return; },
          async show() { return; },
          async create() { return; },
          async update() { return; },
          async new() { return; },
        },
      },
    };

    const asyncMiddleware = async function() { return; };

    const router = new EggRouter({}, app);
    router.resources('/post', asyncMiddleware, app.controller.post);
    assert.equal(router.stack.length, 5);
    assert.equal(router.stack[0].stack.length, 2);

    router.resources('api_post', '/api/post', app.controller.post);
    assert.equal(router.stack.length, 10);
    assert.equal(router.stack[5].stack.length, 1);
    assert.equal(router.stack[5].name, 'api_posts');
  });

  it('should router.url work', () => {
    const app = {
      controller: {
        async foo() { return; },
        hello: {
          world() { return; },
        },
      },
    };
    const router = new EggRouter({}, app);
    router.get('post', '/post/:id', app.controller.foo);
    router.get('hello', '/hello/world', app.controller.hello.world);

    assert.equal(router.url('post', { id: 1, foo: [ 1, 2 ], bar: 'bar' }), '/post/1?foo=1&foo=2&bar=bar');
    assert.equal(router.url('post', { foo: [ 1, 2 ], bar: 'bar' }), '/post/:id?foo=1&foo=2&bar=bar');
    assert.equal(router.url('fooo'), '');
    assert.equal(router.url('hello'), '/hello/world');

    assert.equal(router.pathFor('post', { id: 1, foo: [ 1, 2 ], bar: 'bar' }), '/post/1?foo=1&foo=2&bar=bar');
    assert.equal(router.pathFor('fooo'), '');
    assert.equal(router.pathFor('hello'), '/hello/world');
  });
});
