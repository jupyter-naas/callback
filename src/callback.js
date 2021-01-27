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
        if (req.body) {
            response = req.body.response || null;
            responseHeaders = req.body.responseHeaders || null;
        }
        Callback.create({
            user: req.auth.email,
            uuid: uid,
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
        }).then((data) => res.status(200).json(data))
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
const saveResponse = async (req, res) => {
    try {
        if (!req.params.uid) {
            return res.status(500).send({ error: 'Callback need uid' });
        }
        const cb = await Callback.findOne({
            where: {
                uuid: req.params.uid,
            },
        });
        if (!cb) {
            return res.status(500).send({ error: 'Callback not found' });
        }
        if (req.body) {
            if (isObject(req.body)) {
                cb.result = req.body;
            } else {
                cb.result = { data: req.body };
            }
        }
        if (req.headers) {
            cb.resultHeaders = req.headers;
        }
        cb.save();
        return res.status(200).send(cb);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Send Error:', err);
        return res.status(500).send({ error: err });
    }
};

const routerEmail = express.Router();

routerEmail.route('/').post(authToHub, add);
routerEmail.route('/').get(authToHub, getCb);
routerEmail.route('/').delete(authToHub, deleteOne);
routerEmail.route('/admin').get(authToHub, getAdmin);
routerEmail.route('/:uid').all(saveResponse);

export default routerEmail;
