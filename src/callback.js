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
        let uid = uuid.v4();
        let user = req.auth.email;
        let response = null;
        let result = null;
        let responseHeaders = null;
        let autoDelete = null;
        if (req.body) {
            autoDelete = Boolean(req.body.autoDelete);
            response = req.body.response || null;
            result = req.body.result || null;
            responseHeaders = req.body.responseHeaders || null;
            user = req.body.user && req.auth.admin ? req.body.user : req.auth.email;
            uid = req.body.uuid && req.auth.admin ? req.body.uuid : uid;
        }
        const newItem = {
            user,
            uuid: uid,
            autoDelete,
            result,
            response,
            responseHeaders,
        }
        const foundItem = await Callback.findOne({user, uuid: uid});
        if (!foundItem) {
            await Callback.create(newItem);
        } else {
            await Callback.update(newItem, {user, uuid: uid});
        }
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
                user: req.query.user && req.auth.admin ? req.query.user : req.auth.email,
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
            user: req.query.user && req.auth.admin ? req.query.user : req.auth.email,
        },
    }).then((data) => {
        let f_data = data;
        if (!req.auth.admin) {
            f_data = data.filter((cb)=> {
                return !cb.uuid.startsWith("naas_");
            });
        }
        return res.status(200).json({ callbacks: f_data })
    })
        .catch((err) => res.status(500).json(err));
};

const deleteOne = async (req, res) => Callback.destroy({
    where: {
        user: req.body.user && req.auth.admin ? req.body.user : req.auth.email,
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
        const data = cb.toJSON();
        let dataRes = { status: "ok" };
        let naas_override = true;
        if (data.responseHeaders) {
            data.responseHeaders.keys().forEach((headerKey) => {
                if (headerKey === "naas_no_override") {
                    allow_multi = Boolean(data.responseHeaders[headerKey]);
                } else {
                    res.header(headerKey, data.responseHeaders[headerKey]);
                }
            });
        }
        if (data.response) {
            dataRes = data.response;
        }
        if (!naas_override && data.result) {
            return res.status(200).send(dataRes);
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
        return cb.update(update).then(() => res.status(200).send(dataRes));
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
