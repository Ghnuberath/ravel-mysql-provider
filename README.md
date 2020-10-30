# ravel-mysql-provider

> Ravel DatabaseProvider for MySQL

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/raveljs/ravel-mysql-provider/main/LICENSE) [![npm version](https://badge.fury.io/js/ravel-mysql-provider.svg)](http://badge.fury.io/js/ravel-mysql-provider) [![Dependency Status](https://david-dm.org/raveljs/ravel-mysql-provider.svg)](https://david-dm.org/raveljs/ravel-mysql-provider) [![npm](https://img.shields.io/npm/dm/ravel.svg?maxAge=2592000)](https://www.npmjs.com/package/ravel) [![Build Status](https://travis-ci.org/raveljs/ravel-mysql-provider.svg?branch=main)](https://travis-ci.org/raveljs/ravel-mysql-provider) [![Test Coverage](https://codeclimate.com/github/raveljs/ravel-mysql-provider/badges/coverage.svg)](https://codeclimate.com/github/raveljs/ravel-mysql-provider/coverage)

`ravel-mysql-provider` is a `DatabaseProvider` for Ravel, wrapping the powerful node [mysql](https://github.com/mysqljs/mysql) library. It supports connection pooling as well as Ravel's [transaction system](http://raveljs.github.io/docs/latest/#transaction) (including rollbacks).

## Example usage:

### Step 1: Import and instantiate the MySQLProvider

*app.js*
```javascript
const app = new require('ravel')();
const MySQLProvider = require('ravel-mysql-provider');
app.registerProvider(MySQLProvider);
// ... other providers and parameters
app.scan('./modules');
app.scan('./resources');
// ... the rest of your Ravel app
app.start();
```

### Step 2: Access connections via `@transaction`

*resources/posts_resource.js*
```javascript
const Ravel = require('ravel');
const autoinject = Ravel.autoinject;
const Resource = Ravel.Resource;
const transaction = Resource.transaction;

@Resource('/post')
@autoinject('posts')
class PostsResource {
  /**
   * Retrieve a single post
   */
  @transaction('mysql')
  get(ctx) {
    // Best practice is to pass the transaction object through to a Module, where you handle the actual business logic.
    return this.posts.getPost(ctx.transaction, ctx.params.id)
    .then((posts) => {
      ctx.body = posts;
    });
  }
}
```

### Step 3: Use connections to perform queries

*modules/posts.js*
```javascript
const Ravel = require('ravel');
const Module = Ravel.Module;

@Module('posts')
class Posts {
  getPost(transaction, id) {
    return new Promise((resolve, reject) => {
      const mysql = transaction['mysql'];
      // for more information about the mysql connection's capabilities, visit the docs: https://github.com/mysqljs/mysql
      mysql.query(
        `SELECT * from posts WHERE \`id\` = ?`,
        [id],
        (err, results) => {
          if (err) { return reject(err); }
          resolve(results);
        }
      );
    });
  }
}
```

### Step 4: Configuration

Requiring the `ravel-mysql-provider` module will register a configuration parameter with Ravel which must be supplied via `.ravelrc` or `app.set()`:

*.ravelrc*
```json
{
  "mysql options": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "a password",
    "database": "mydatabase"
  }
}
```

All options for a `mysql` connection are supported, and are documented [here](https://github.com/mysqljs/mysql#establishing-connections).

## Additional Notes

### Multiple Simultaneous Providers

`ravel-mysql-provider` also supports multiple simultaneous pools for different mysql databases, as long as you name them:

*app.js*
```javascript
const app = new require('ravel')();
const MySQLProvider = require('ravel-mysql-provider');
app.registerProvider(app, 'first mysql');
app.registerProvider(app, 'second mysql');
// ... other providers and parameters
app.start();
```

*.ravelrc*
```json
{
  "first mysql options": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "a password",
    "database": "myfirstdatabase"
  },
  "second mysql options": {
    "host": "localhost",
    "port": 3307,
    "user": "root",
    "password": "another password",
    "database": "myseconddatabase"
  }
}
```

*resources/posts_resource.js*
```javascript
const Ravel = require('ravel');
const Resource = Ravel.Resource;
const transaction = Resource.transaction;

@Resource('/post')
class PostsResource {
  // ...
  @transaction('first mysql', 'second mysql')
  get(ctx) {
    // can use ctx.transaction['first mysql']
    // and ctx.transaction['second mysql']
  }
}
```

### Named Parameter Syntax

`ravel-mysql-provider` bakes-in the named parameter syntax described [here](https://github.com/mysqljs/mysql#custom-format).
