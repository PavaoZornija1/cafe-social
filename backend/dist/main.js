"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
require("reflect-metadata");
const _core = require("@nestjs/core");
const _config = require("@nestjs/config");
const _appmodule = require("./app.module");
async function bootstrap() {
    const app = await _core.NestFactory.create(_appmodule.AppModule);
    const configService = app.get(_config.ConfigService);
    const port = configService.get('PORT') ?? 3001;
    app.setGlobalPrefix('api');
    await app.listen(port);
    // eslint-disable-next-line no-console
    console.log(`Cafe Social backend is running on http://localhost:${port}/api`);
}
bootstrap();

//# sourceMappingURL=main.js.map