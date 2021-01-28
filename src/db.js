import sequelize from 'sequelize';

const uri = process.env.HUB_DB;
let sql;

if (uri) {
    sql = new sequelize.Sequelize(uri, { logging: false });
} else {
    sql = new sequelize.Sequelize({
        dialect: 'sqlite',
        storage: 'database.sqlite',
        // eslint-disable-next-line no-console
        // logging: (...msg) => console.log(msg), // Displays all log function call parameters
    });
}

export const Callback = sql.define('Callback', {
    user: {
        type: sequelize.DataTypes.STRING,
        allowNull: false,
    },
    uuid: {
        type: sequelize.DataTypes.STRING,
        allowNull: false,
    },
    autoDelete: {
        type: sequelize.DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
    },
    result: {
        type: sequelize.DataTypes.JSON,
        allowNull: true,
    },
    resultHeaders: {
        type: sequelize.DataTypes.JSON,
        allowNull: true,
    },
    response: {
        type: sequelize.DataTypes.JSON,
        allowNull: true,
    },
    responseHeaders: {
        type: sequelize.DataTypes.JSON,
        allowNull: true,
    },
});

export const Sequelize = sql;
