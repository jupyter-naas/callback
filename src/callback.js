import express from 'express';
import axios from 'axios';
import * as uuid from 'uuid';
import {
    Callback,
} from './db';

const hubHost = process.env.HUB_HOST || 'app.naas.ai';

const authToHub = async (req, res, next) => {
    try {
        const options = {
            headers: {
                'content-type': 'application/json',
                authorization: req.headers.authorization,
            },
        };
        const result = await axios.get(`https://${hubHost}/hub/api/user`, options);
        if (!result || !result.data || !result.data.name) {
            throw Error('User not found');
        }
        req.auth = { email: result.data.name, admin: result.data.admin };
        return next();
    } catch (err) {
        return res.status(500).send(err);
    }
};

const add = async (req, res) => {
    try {
        const uid = uuid.v4();
        let response = null;
        let responseHeaders = null;
        let autoDelete = null;
        if (req.body) {
            autoDelete = req.body.autoDelete || true;
            response = req.body.response || null;
            responseHeaders = req.body.responseHeaders || null;
        }
        Callback.create({
            user: req.body.user ? && req.body.user && req.auth.admin : req.auth.email,
            uuid: uid,
            autoDelete,
            response,
            responseHeaders,
        });
        return res.json({ uuid: uid });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Send Error:', err);
        return res.status(500).send({ error: err });
    }
};

const getCb = async (req, res) => {
    if (req.query && req.query.uuid) {
        return Callback.findOne({
            where: {
                user: req.auth.email,
                uuid: req.query.uuid,
            },
        }).then((data) => {
            const resData = data.toJSON();
            if (data.autoDelete) {
                return Callback.destroy({
                    where: {
                        user: req.auth.email,
                        uuid: req.body.uuid,
                    },
                }).then(() => res.status(200).json(resData));
            }
            return res.status(200).json(resData);
        })
            .catch((err) => res.status(500).json(err));
    }
    return Callback.findAll({
        where: {
            user: req.auth.email,
        },
    }).then((data) => res.status(200).json({ callbacks: data }))
        .catch((err) => res.status(500).json(err));
};

const deleteOne = async (req, res) => Callback.destroy({
    where: {
        user: req.auth.email,
        uuid: req.body.uuid,
    },
}).then((data) => res.status(200).json(data));

const getAdmin = async (req, res) => {
    if (req.auth.admin) {
        return Callback.findAll()
            .then((data) => res.status(200).json({ callbacks: data }))
            .catch((err) => res.status(500).json(err));
    }
    return res.status(500).send({ error: 'Unable to access the data' });
};

const isObject = (obj) => obj !== null && typeof obj === 'object' && Array.isArray(obj) === false;

const saveResponse = (req, res) => {
    if (!req.params.uid) {
        return res.status(500).send({ error: 'Callback need uid' });
    }
    return Callback.findOne({
        where: {
            uuid: req.params.uid,
        },
    }).then((cb) => {
        if (!cb) {
            return res.status(500).send({ error: 'Callback not found' });
        }
        const update = { result: null, resultHeaders: null };
        if (req.body) {
            update.result = { data: req.body };
            if (isObject(req.body)) {
                update.result = req.body;
            }
        }
        if (req.headers) {
            update.resultHeaders = req.headers;
        }
        return cb.update(update).then((data) => res.status(200).send(data));
    }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Send Error:', err);
        return res.status(500).send({ error: err });
    });
};

const routerEmail = express.Router();

routerEmail.route('/').post(authToHub, add);
routerEmail.route('/').get(authToHub, getCb);
routerEmail.route('/').delete(authToHub, deleteOne);
routerEmail.route('/admin').get(authToHub, getAdmin);
routerEmail.route('/:uid').all(saveResponse);

export default routerEmail;
