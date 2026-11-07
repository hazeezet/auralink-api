import Fastify from "fastify";
import appService from "./app";
import closeWithGrace from "close-with-grace";

const isProduction = process.env.NODE_ENV === "production";

const app = Fastify({
    logger: isProduction
        ? false
        : {
            transport: {
                target: "pino-pretty",
            },
        },
});

app.register(appService);

const closeListeners = closeWithGrace({ delay: 500 }, async ({ err }) => {
    if (err) {
        app.log.error(err);
    }
    await app.close();
});

app.addHook("onClose", (_instance, done) => {
    closeListeners.uninstall();
    done();
});

const port = Number(process.env.PORT) || 5000;
const host = process.env.HOST || (isProduction ? "0.0.0.0" : "localhost");

app.listen({ port, host }, (err) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }
});

export default app;
export { app };
