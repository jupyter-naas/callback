import express from 'express';
import morgan from 'morgan';
import Sentry from '@sentry/node';
import Tracing from '@sentry/tracing';
import routerCallback from './callback';
import {
    Callback, Sequelize,
} from './db';

const app = express();
const port = (process.env.PORT || 3004);

app.set('port', port);
app.use(morgan('tiny'));
app.use(express.json());
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Tracing.Integrations.Express({ app }),
        ],
        tracesSampleRate: 1.0,
    });
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
}

app.use('/', routerCallback);
app.get('/', (req, res) => res.status(200).json({ status: 'ok' }));
if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
    // eslint-disable-next-line no-console
    console.log('Sentry enabled', process.env.SENTRY_DSN);
}
// eslint-disable-next-line no-console
console.log('Start server');
app.listen(app.get('port'), async () => {
    try {
        await Sequelize.authenticate();
        await Callback.sync();
        // eslint-disable-next-line no-console
        console.log('Connection has been established successfully.');
        // eslint-disable-next-line no-console
        console.log(`Callback PID ${process.pid}, port ${app.get('port')}, http://localhost:${app.get('port')}`);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Unable to connect to the database:', err);
    }
});
