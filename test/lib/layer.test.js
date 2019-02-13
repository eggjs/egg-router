'use strict';

const Koa = require('koa');
const http = require('http');
const request = require('supertest');
require('should');
const Router = require('../../lib/router');
const Layer = require('../../lib/layer');

describe('test/lib/layer.test.js', function() {
  it('composes multiple callbacks/middlware', function(done) {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    router.get(
      '/:category/:title',
      function(ctx, next) {
        ctx.status = 500;
        return next();
      },
      function(ctx, next) {
        ctx.status = 204;
        return next();
      }
    );
    request(http.createServer(app.callback()))
      .get('/programming/how-to-node')
      .expect(204)
      .end(function(err) {
        if (err) return done(err);
        done();
      });
  });

  describe('Layer#match()', function() {
    it('captures URL path parameters', function(done) {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get('/:category/:title', function(ctx) {
        ctx.should.have.property('params');
        ctx.params.should.be.type('object');
        ctx.params.should.have.property('category', 'match');
        ctx.params.should.have.property('title', 'this');
        ctx.status = 204;
      });
      request(http.createServer(app.callback()))
        .get('/match/this')
        .expect(204)
        .end(function(err) {
          if (err) return done(err);
          done();
        });
    });

    it('return orginal path parameters when decodeURIComponent throw error', function(done) {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get('/:category/:title', function(ctx) {
        ctx.should.have.property('params');
        ctx.params.should.be.type('object');
        ctx.params.should.have.property('category', '100%');
        ctx.params.should.have.property('title', '101%');
        ctx.status = 204;
      });
      request(http.createServer(app.callback()))
        .get('/100%/101%')
        .expect(204)
        .end(done);
    });

    it('populates ctx.captures with regexp captures', function(done) {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get(/^\/api\/([^\/]+)\/?/i, function(ctx, next) {
        ctx.should.have.property('captures');
        ctx.captures.should.be.instanceOf(Array);
        ctx.captures.should.have.property(0, '1');
        return next();
      }, function(ctx) {
        ctx.should.have.property('captures');
        ctx.captures.should.be.instanceOf(Array);
        ctx.captures.should.have.property(0, '1');
        ctx.status = 204;
      });
      request(http.createServer(app.callback()))
        .get('/api/1')
        .expect(204)
        .end(function(err) {
          if (err) return done(err);
          done();
        });
    });

    it('return orginal ctx.captures when decodeURIComponent throw error', function(done) {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get(/^\/api\/([^\/]+)\/?/i, function(ctx, next) {
        ctx.should.have.property('captures');
        ctx.captures.should.be.type('object');
        ctx.captures.should.have.property(0, '101%');
        return next();
      }, function(ctx) {
        ctx.should.have.property('captures');
        ctx.captures.should.be.type('object');
        ctx.captures.should.have.property(0, '101%');
        ctx.status = 204;
      });
      request(http.createServer(app.callback()))
        .get('/api/101%')
        .expect(204)
        .end(function(err) {
          if (err) return done(err);
          done();
        });
    });

    it('populates ctx.captures with regexp captures include undefiend', function(done) {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get(/^\/api(\/.+)?/i, function(ctx, next) {
        ctx.should.have.property('captures');
        ctx.captures.should.be.type('object');
        ctx.captures.should.have.property(0, undefined);
        return next();
      }, function(ctx) {
        ctx.should.have.property('captures');
        ctx.captures.should.be.type('object');
        ctx.captures.should.have.property(0, undefined);
        ctx.status = 204;
      });
      request(http.createServer(app.callback()))
        .get('/api')
        .expect(204)
        .end(function(err) {
          if (err) return done(err);
          done();
        });
    });

    it('should throw friendly error message when handle not exists', function() {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      let notexistHandle;
      (function() {
        router.get('/foo', notexistHandle);
      }).should.throw('get `/foo`: `middleware` must be a function, not `undefined`');

      (function() {
        router.get('foo router', '/foo', notexistHandle);
      }).should.throw('get `foo router`: `middleware` must be a function, not `undefined`');

      (function() {
        router.post('/foo', function() {}, notexistHandle);
      }).should.throw('post `/foo`: `middleware` must be a function, not `undefined`');
    });
  });

  describe('Layer#param()', function() {
    it('composes middleware for param fn', function(done) {
      const app = new Koa();
      const router = new Router();
      const route = new Layer('/users/:user', [ 'GET' ], [ function(ctx) {
        ctx.body = ctx.user;
      } ]);
      route.param('user', function(id, ctx, next) {
        ctx.user = { name: 'alex' };
        if (!id) {
          ctx.status = 404;
          return;
        }
        return next();
      });
      router.stack.push(route);
      app.use(router.middleware());
      request(http.createServer(app.callback()))
        .get('/users/3')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);
          res.should.have.property('body');
          res.body.should.have.property('name', 'alex');
          done();
        });
    });

    it('ignores params which are not matched', function(done) {
      const app = new Koa();
      const router = new Router();
      const route = new Layer('/users/:user', [ 'GET' ], [ function(ctx) {
        ctx.body = ctx.user;
      } ]);
      route.param('user', function(id, ctx, next) {
        ctx.user = { name: 'alex' };
        if (!id) {
          ctx.status = 404;
          return;
        }
        return next();
      });
      route.param('title', function(id, ctx, next) {
        ctx.user = { name: 'mark' };
        if (!id) {
          ctx.status = 404;
          return;
        }
        return next();
      });
      router.stack.push(route);
      app.use(router.middleware());
      request(http.createServer(app.callback()))
        .get('/users/3')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);
          res.should.have.property('body');
          res.body.should.have.property('name', 'alex');
          done();
        });
    });
  });

  describe('Layer#url()', function() {
    it('generates route URL', function() {
      const route = new Layer('/:category/:title', [ 'get' ], [ function() {} ], 'books');
      let url = route.url({ category: 'programming', title: 'how-to-node' });
      url.should.equal('/programming/how-to-node');
      url = route.url('programming', 'how-to-node');
      url.should.equal('/programming/how-to-node');
    });

    it('escapes using encodeURIComponent()', function() {
      const route = new Layer('/:category/:title', [ 'get' ], [ function() {} ], 'books');
      const url = route.url({ category: 'programming', title: 'how to node' });
      url.should.equal('/programming/how%20to%20node');
    });
  });
});
