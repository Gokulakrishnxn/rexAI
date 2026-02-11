const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.startsWith('zeego/')) {
        return {
            filePath: require.resolve('./src/mocks/zeegoStub.js'),
            type: 'sourceFile',
        };
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
