module.exports = {
    testEnvironment: 'node',
    setupFiles: ['dotenv-safe/config'],
    roots: ['./test'],
    modulePaths: ['./'],
    moduleNameMapper: {
      '@/(.*)': ['<rootDir>/$1']
    }
  };