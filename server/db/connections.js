module.exports = [
  {
    name: 'LocalSQLite',
    type: 'sqlite',
    path: './data.sqlite'
  },
  {
    name: 'RemoteMySQL',
    type: 'mysql',
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test'
  },
  {
    name: 'PostgresRemote',
    type: 'postgres',
    host: 'localhost',
    user: 'postgres',
    password: '1234',
    database: 'demo'
  },
  {
    name: 'RedisCache',
    type: 'redis',
    host: '127.0.0.1',
    port: 6379
  }  
];