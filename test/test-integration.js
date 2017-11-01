'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
chai.use(require('sinon-chai'));
const redis = require('redis-mock');
const request = require('supertest');
const mockery = require('mockery');
const upath = require('upath');

let Ravel, Routes, mapping, transaction, app;

describe('Ravel MySQLProvider integration test', () => {
  beforeEach((done) => {
    process.removeAllListeners('unhandledRejection');
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });
    // scaffold basic Ravel app
    Ravel = require('ravel');
    Routes = Ravel.Routes;
    mapping = Routes.mapping;
    transaction = Routes.transaction;
    mockery.registerMock('redis', redis);
    app = new Ravel();
    app.set('log level', app.log.NONE);
    new (require('../lib/ravel-mysql-provider'))(app); // eslint-disable-line new-cap, no-new
    app.set('mysql options', {
      user: 'root',
      password: 'password',
      port: 13306
    });
    app.set('keygrip keys', ['mysecret']);

    done();
  });

  afterEach((done) => {
    process.removeAllListeners('unhandledRejection');
    mockery.deregisterAll();
    mockery.disable();
    done();
  });

  it('should provide clients with a connection to query an existing MySQL database', async () => {
    class TestRoutes extends Routes {
      constructor () {
        super('/');
      }

      @transaction
      @mapping(Routes.GET, 'test')
      testHandler (ctx) {
        expect(ctx).to.have.a.property('transaction').that.is.an('object');
        expect(ctx.transaction).to.have.a.property('mysql').that.is.an('object');
        return new Promise((resolve, reject) => {
          ctx.transaction.mysql.query('SELECT 1 AS col', (err, rows) => {
            if (err) { return reject(err); }
            ctx.body = rows[0];
            resolve(rows[0]);
          });
        });
      }
    }
    mockery.registerMock(upath.join(app.cwd, 'routes'), TestRoutes);
    app.routes('routes');
    await app.init();
    app.emit('pre listen');

    return new Promise((resolve, reject) => {
      request.agent(app.server)
        .get('/test')
        .expect(200, JSON.stringify({col: '1'}))
        .end((err) => {
          app.close();
          if (err) return reject(err);
          resolve(err);
        });
    });
  });

  it('should trigger a rollback when a query fails', async () => {
    let spy;
    class TestRoutes extends Routes {
      constructor () {
        super('/');
      }

      @transaction
      @mapping(Routes.GET, 'test')
      testHandler (ctx) {
        expect(ctx).to.have.a.property('transaction').that.is.an('object');
        expect(ctx.transaction).to.have.a.property('mysql').that.is.an('object');
        spy = sinon.spy(ctx.transaction.mysql, 'rollback');
        return Promise.reject(new Error());
      }
    }
    mockery.registerMock(upath.join(app.cwd, 'routes'), TestRoutes);
    app.routes('routes');
    await app.init();
    app.emit('pre listen');

    return new Promise((resolve, reject) => {
      request.agent(app.server)
        .get('/test')
        .end((err) => {
          try {
            expect(spy).to.have.been.called;
            if (err) return reject(err);
            resolve();
          } catch (e) {
            reject(e);
          } finally {
            app.close();
          }
        });
    });
  });
});
