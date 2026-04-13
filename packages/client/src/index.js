"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HumanEnvClient = void 0;
const ws_manager_js_1 = require("./ws-manager.js");
Object.defineProperty(exports, "HumanEnvClient", { enumerable: true, get: function () { return ws_manager_js_1.HumanEnvClient; } });
let singleton = null;
let configSet = false;
async function ensure() {
    if (!singleton)
        throw new Error('humanenv.config() must be called first');
    return singleton;
}
exports.default = {
    config(cfg) {
        if (configSet)
            return;
        configSet = true;
        singleton = new ws_manager_js_1.HumanEnvClient(cfg);
    },
    async get(keyOrKeys) {
        const client = await ensure();
        return client.get(keyOrKeys);
    },
    async set(key, value) {
        const client = await ensure();
        return client.set(key, value);
    },
    disconnect() {
        if (singleton) {
            singleton.disconnect();
            singleton = null;
            configSet = false;
        }
    },
};
//# sourceMappingURL=index.js.map