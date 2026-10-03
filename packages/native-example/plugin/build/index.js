"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("expo/config-plugins");
// A typed config plugin: the shape packages/vision will use to own its native
// requirements (usage strings, deployment target). This one writes one
// Info.plist key that the Swift module reads back at runtime.
const withNativeExample = (config, props) => (0, config_plugins_1.withInfoPlist)(config, (mod) => {
    mod.modResults.SalNativeExample = props?.value ?? 'written by @app/native-example';
    return mod;
});
exports.default = (0, config_plugins_1.createRunOncePlugin)(withNativeExample, '@app/native-example', '0.1.0');
