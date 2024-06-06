module.exports = {
    webpack: {
      configure: (webpackConfig) => {
        // Add our own source-map-loader rule
        webpackConfig.module.rules.push({
          test: /\.js$/,
          enforce: 'pre',
          use: ['source-map-loader'],
          exclude: [/node_modules\/skulpt/],
        });
  
        // Filter out specific warnings
        webpackConfig.plugins.push({
          apply: (compiler) => {
            compiler.hooks.done.tap('done', (stats) => {
              stats.compilation.warnings = stats.compilation.warnings.filter(function (warning) {
                return !/Failed to parse source map/.test(warning.message);
              });
            });
          }
        });
  
        return webpackConfig;
      },
    },
    devServer: {
      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
          throw new Error('webpack-dev-server is not defined');
        }
  
        // Middleware setup
        middlewares.unshift(evalSourceMapMiddleware(devServer));
        middlewares.push(redirectServedPath(paths.publicUrlOrPath));
        middlewares.push(noopServiceWorkerMiddleware(paths.publicUrlOrPath));
  
        return middlewares;
      },
    },
  };
  