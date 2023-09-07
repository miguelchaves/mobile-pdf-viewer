// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

const isProduction = process.env.NODE_ENV == 'production';


const stylesHandler = 'style-loader';



const config = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
        open: true,
        host: 'localhost',
        static: {
            directory: path.join(__dirname, 'assets'),
        },
        port: 9000,
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'index.html',
        }),
        // Add your plugins here
        // Learn more about plugins from https://webpack.js.org/configuration/plugins/
        new CopyWebpackPlugin({
            patterns: [
                { from: 'assets', to: 'assets' },
                { from: 'node_modules/pdfjs-dist/web/pdf_viewer.css', to: 'assets/pdf_viewer.css' },
                { from: 'node_modules/pdfjs-dist/build/pdf.min.js', to: 'assets/pdf.min.js' },
                { from: 'node_modules/pdfjs-dist/web/pdf_viewer.js', to: 'assets/pdf_viewer.js' },
                { from: 'node_modules/pdfjs-dist/build/pdf.worker.min.js', to: 'assets/pdf.worker.min.js' },
                { from: 'node_modules/pdfjs-dist/cmaps', to: 'assets/cmaps' },
            ]
        })
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/i,
                loader: 'babel-loader',
            },
            {
                test: /\.css$/i,
                use: [stylesHandler, 'css-loader', 'postcss-loader'],
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: 'asset',
            },

            // Add your rules for custom modules here
            // Learn more about loaders from https://webpack.js.org/loaders/
        ],
    },
    optimization: {
        minimizer: isProduction ? [
          new CssMinimizerPlugin(),
        ] : [],
      },
};

module.exports = () => {
    if (isProduction) {
        config.mode = 'production';
        
        
    } else {
        config.mode = 'development';
    }
    return config;
};
