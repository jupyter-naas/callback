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

const getOne = async (req, res) => Callback.findOne({
    where: {
        user: req.auth.email,
        uuid: req.params.uuid,
    },
}).then((data) => res.status(200).json(data)).catch((err) => res.status(500).json(err));

const deleteOne = async (req, res) => Callback.destroy({
    where: {
        user: req.auth.email,
        uuid: req.params.uuid,
    },
}).then((data) => res.status(200).json(data));

const getList = async (req, res) => Callback.findAll({
    where: {
        user: req.auth.email,
    },
}).then((data) => res.send({ callbacks: data })).catch((err) => res.status(500).json(err));

const getListAdmin = async (req, res) => {
    if (req.auth.admin) {
        return Callback.findAll()
            .then((data) => res.send({ callbacks: data }))
            .catch((err) => res.status(500).json(err));
    }
    return res.status(500).send({ error: 'Unable to access the data' });
};

const saveResponse = async (req, res) => {
    try {
        const cb = await Callback.findOne({
            user: req.auth.email,
            uuid: req.params.uid,
        });
        if (req.body) {
            cb.result = req.body;
        }
        if (req.headers) {
            cb.resultHeaders = req.headers;
        }
        cb.save();
        return res.send(cb.response);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Send Error:', err);
        return res.status(500).send({ error: err });
    }
};

const routerEmail = express.Router();

routerEmail.route('/').post(authToHub, add);
routerEmail.route('/list').get(authToHub, getList);
routerEmail.route('/list_all').get(authToHub, getListAdmin);
routerEmail.route('/:uuid').get(authToHub, getOne);
routerEmail.route('/:uuid').delete(authToHub, deleteOne);
routerEmail.route('/:uuid').all(saveResponse);

export default routerEmail;
