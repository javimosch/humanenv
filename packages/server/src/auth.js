"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBasicAuthMiddleware = createBasicAuthMiddleware;
const basic_auth_1 = __importDefault(require("basic-auth"));
function createBasicAuthMiddleware(username, password) {
    return (req, res, next) => {
        const credentials = (0, basic_auth_1.default)(req);
        if (!credentials || credentials.name !== username || credentials.pass !== password) {
            res.set('WWW-Authenticate', 'Basic realm="HumanEnv Admin"');
            return res.status(401).send('Authentication required');
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map