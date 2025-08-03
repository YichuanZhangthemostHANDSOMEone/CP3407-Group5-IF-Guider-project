// webpack.config.js
const path    = require('path');
const webpack = require('webpack');
const Dotenv  = require('dotenv-webpack');

module.exports = {
    mode: 'development',

    entry: {
    main:            './src/index.ts',
    topics:          './src/topics.ts',
    quiz:            './src/quiz.ts',
    result:          './src/result.ts',
    'lego-result':   './src/legoResult.ts',
    login:           './src/login.ts',
    register:        './src/register.ts',
    student_record:  './src/student_record.ts',
    teacher_list:    './src/teacher_list.ts',
    teacher_record:  './src/teacher_record.ts',
    quiz_editor:     './src/quiz_editor.ts',
},


    output: {
        filename:   '[name].bundle.js',
        path:       path.resolve(__dirname, 'dist'),
        publicPath: '/'
    },

    resolve: {
        extensions: ['.ts', '.js', '.mjs'],
        alias: {
        '@modules':           path.resolve(__dirname, 'src/modules'),
        'process/browser':    require.resolve('process/browser'),
    },
    fallback: {
        process: require.resolve('process/browser'),
        util:    require.resolve('util/'),
        path:    require.resolve('path-browserify'),
        fs:      false,
        crypto:  false
    }
    },

module: {
    rules: [
        // 支持 .mjs 的 ESM 模块
        {
            test: /\.mjs$/,
            include: /node_modules/,
            type: 'javascript/auto'
        },
        // Typescript
        {
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/
        },
        // CSS
        {
            test: /\.css$/i,
            use: ['style-loader', 'css-loader']
        },
        // 图片等资源
        {
            test: /\.(png|jpe?g|gif)$/i,
            type: 'asset/resource'
        }
    ]
},


plugins: [
    // 读取 .env 并注入 process.env.*
    new Dotenv({
        path: './.env',
        safe: false
    }),

    // 自动给每个模块注入 process
    new webpack.ProvidePlugin({
        process: 'process/browser'
    })
],

devServer: {
    static:             path.join(__dirname, 'public'),
    historyApiFallback: true,
    port:               8080,
    open:               true,
    proxy: [
        {
            context: ['/api'],
            target: 'http://localhost:3000',
            changeOrigin: true,
        },
    ]
}

};