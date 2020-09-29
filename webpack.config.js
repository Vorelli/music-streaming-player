const path = require('path');
const HtmlPlugin = require('html-webpack-plugin');

const rules = [
  {
    test: /\.(js|jsx)$/,
    exclude: /node_modules/,
    use: { loader: 'babel-loader' }
  },
  {
    test: /\.css$/i,
    exclude: /node_modules/,
    use: ['style-loader', 'css-loader']
  },
  {
    test: /\.s[ac]ss$/i,
    exclude: /node_modules/,
    use: ['style-loader', 'css-loader', 'sass-loader']
  }
];

module.exports = {
  entry: path.join(__dirname, 'src', 'index.js'),
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, './build'),
    publicPath: '/'
  },
  module: { rules },
  plugins: [new HtmlPlugin({ template: './public/index.html' })],
  devServer: { compress: true, historyApiFallback: true }
};
