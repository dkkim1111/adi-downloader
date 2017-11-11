const config = require('../config/config');

const Sequelize = require('sequelize');
const sequelize = new Sequelize('maindb', null, null, {
    dialect: config.database.dialect,
    storage: config.database.storage
});

let Task = sequelize.define('task', {
    title: Sequelize.STRING,
    link: Sequelize.STRING,
    webtoonId: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    startIdx: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    endIdx: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    error: Sequelize.STRING,
    status: Sequelize.INTEGER
});

Task.CONST = {
    STATUS: {
        STATUS_WAIT: 1,
        STATUS_PROCESSING: 2,
        STATUS_DONE: 3,
        STATUS_ERROR: 4
    }
};
Task.prototype.toString = () => {
  return `[Task Model] webtoonId : ${this.webtoonId}, startIdx : ${this.startIdx}, endIdx : ${this.endIdx}`;
};
module.exports = Task;