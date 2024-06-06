const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      if (env === 'development') {
        webpackConfig.plugins.push(new ReactRefreshWebpackPlugin());

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
      }

      return webpackConfig;
    },
  },
};
